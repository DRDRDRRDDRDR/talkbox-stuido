/**
 * piano-roll.js - Canvas 钢琴卷帘窗组件
 */
window.TalkboxStudio = window.TalkboxStudio || {};

(function() {
  var KEY_WIDTH = 60;
  var PIXELS_PER_BEAT = 80;
  var OCTAVES = 4;
  var START_OCTAVE = 2;
  var TOTAL_KEYS = OCTAVES * 12;

  function midiToIndex(midi) { return midi - (START_OCTAVE * 12 + 12); }
  function indexToMidi(idx) { return idx + START_OCTAVE * 12 + 12; }

  TalkboxStudio.PianoRoll = class {
    constructor(canvas, rulerCanvas, wrapEl) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rulerCanvas = rulerCanvas;
      this.rulerCtx = rulerCanvas.getContext('2d');
      this.wrapEl = wrapEl;
      this.notes = [];
      this.selectedNotes = new Set();
      this.trackColor = '#e94560';
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.zoom = 1;
      this.snapValue = '8n';
      this.gridOn = true;
      this.tool = 'select';
      this._dragging = false;
      this._dragType = null;
      this._dragStart = null;
      this._resizeNote = null;
      this._mousePos = { x:0, y:0 };
      this._selRect = null;
      this.playheadBeat = undefined;
      this._callbacks = { onNotesChange: null, onSelectionChange: null, onNoteDblClick: null };
      this._lastClickTime = 0;
      this._lastClickPos = { x: 0, y: 0 };
      this._maxBeats = 32;
      this._undoStack = [];
      this._redoStack = [];
      this._undoMaxSize = 50;
      this._initEvents();
      this._resize();
      this.render();
    }

    get pixelPerBeat() { return PIXELS_PER_BEAT * this.zoom; }
    get totalBeats() { return this._maxBeats; }
    get totalWidth() { return this.totalBeats * this.pixelPerBeat; }
    get totalHeight() { return TOTAL_KEYS * KEY_WIDTH; }

    _initEvents() {
      var self = this;
      this.canvas.addEventListener('mousedown', function(e) { self._onMouseDown(e); });
      this.canvas.addEventListener('mousemove', function(e) { self._onMouseMove(e); });
      this.canvas.addEventListener('mouseup', function(e) { self._onMouseUp(e); });
      this.canvas.addEventListener('wheel', function(e) { self._onWheel(e); }, { passive:false });
      this.canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
      this.canvas.addEventListener('touchstart', function(e) { self._onTouchStart(e); }, { passive:false });
      this.canvas.addEventListener('touchmove', function(e) { self._onTouchMove(e); }, { passive:false });
      this.canvas.addEventListener('touchend', function(e) { self._onTouchEnd(e); });
      var wrap = this.wrapEl;
      wrap.addEventListener('scroll', function() {
        self.scrollTop = wrap.scrollTop;
        self.scrollLeft = wrap.scrollLeft;
        self.render();
        self._renderRuler();
      });
      document.addEventListener('keydown', function(e) { self._onKeyDown(e); });

      // DEBUG: capture-phase listeners to verify events reach canvas
      document.addEventListener('mousedown', function(e) {
        if (e.target === self.canvas) console.log('[DIAG] canvas mousedown x=' + e.clientX + ' y=' + e.clientY + ' tool=' + self.tool);
      }, true);
      document.addEventListener('mousemove', function(e) {
        if (e.target === self.canvas) console.log('[DIAG] canvas mousemove x=' + e.clientX + ' y=' + e.clientY + ' dragType=' + self._dragType);
      }, true);
      document.addEventListener('mouseup', function(e) {
        if (e.target === self.canvas) console.log('[DIAG] canvas mouseup dragType=' + self._dragType + ' dragging=' + self._dragging);
      }, true);
    }

    _resize() {
      var dpr = window.devicePixelRatio || 1;
      var vw = this.wrapEl.clientWidth;
      var w = this.totalWidth * dpr;
      var h = this.totalHeight * dpr;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.rulerCanvas.width = vw * dpr;
      this.rulerCanvas.height = 24 * dpr;
      this.rulerCanvas.style.width = vw + 'px';
      this.rulerCanvas.style.height = '24px';
      this.rulerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    autoResize(notes) {
      var maxBeat = 32;
      if (notes) {
        for (var i = 0; i < notes.length; i++) {
          var noteEnd = this.timeToBeats(notes[i].time) + this.timeToBeats(notes[i].duration);
          if (noteEnd > maxBeat) maxBeat = noteEnd;
        }
      }
      this._maxBeats = Math.max(maxBeat + 8, 32);
      this._resize();
      this.render();
    }

    _clientToCanvas(clientX, clientY) {
      var rect = this.wrapEl.getBoundingClientRect();
      return { x: clientX - rect.left + this.scrollLeft, y: clientY - rect.top + this.scrollTop };
    }

    _snapBeat(beat) {
      if (!this.gridOn) return beat;
      var div = { '4n':1, '8n':0.5, '16n':0.25, '32n':0.125 }[this.snapValue] || 0.5;
      return Math.round(beat / div) * div;
    }

    _beatToTime(beat) {
      var bars = Math.floor(beat / 4);
      var beats = Math.floor(beat % 4);
      var sixteenths = Math.floor(((beat % 4) - beats) * 4);
      return bars + ':' + beats + ':' + sixteenths;
    }

    timeToBeats(timeStr) {
      var parts = timeStr.split(':').map(Number);
      return parts[0] * 4 + parts[1] + parts[2] * 0.25;
    }

    _noteTimeToBeats(note) { return this.timeToBeats(note.time); }

    noteDurToBeats(note) {
      var parts = note.duration.split(':').map(Number);
      return parts[0] * 4 + parts[1] + parts[2] * 0.25;
    }

    _beatDurationToTime(beatDur) {
      var bars = Math.floor(beatDur / 4);
      var beats = Math.floor(beatDur % 4);
      var sixteenths = Math.floor(((beatDur % 4) - beats) * 4);
      return bars + ':' + beats + ':' + sixteenths;
    }

    _hitTest(x, y) {
      for (var i = this.notes.length - 1; i >= 0; i--) {
        var n = this.notes[i];
        var nx = this._noteTimeToBeats(n) * this.pixelPerBeat;
        var ny = midiToIndex(n.midi) * KEY_WIDTH;
        var nw = this.noteDurToBeats(n) * this.pixelPerBeat;
        if (x >= nx && x <= nx + nw && y >= ny && y <= ny + KEY_WIDTH) {
          var zone = y >= ny + KEY_WIDTH * 0.75 ? 'intensity' : 'body';
          return { note:n, index:i, zone:zone };
        }
      }
      return null;
    }

    _hitTestEdge(x, y, note) {
      var nx = this._noteTimeToBeats(note) * this.pixelPerBeat;
      var nw = this.noteDurToBeats(note) * this.pixelPerBeat;
      var tol = 8;
      if (x >= nx - tol && x <= nx + tol) return 'resize-left';
      if (x >= nx + nw - tol && x <= nx + nw + tol) return 'resize-right';
      if (x >= nx && x <= nx + nw) return 'move';
      return null;
    }

    _onMouseDown(e) {
      var p = this._clientToCanvas(e.clientX, e.clientY);
      this._mousePos = { x: p.x, y: p.y };

      // 双击检测（仅 select 工具且未按 Shift 时）
      var now = Date.now();
      var dx = Math.abs(p.x - this._lastClickPos.x);
      var dy = Math.abs(p.y - this._lastClickPos.y);
      if (this.tool === 'select' && !e.shiftKey && (now - this._lastClickTime) < 400 && dx < 8 && dy < 8) {
        this._lastClickTime = 0;
        var hit = this._hitTest(p.x, p.y);
        if (hit && this._callbacks.onNoteDblClick) {
          this._callbacks.onNoteDblClick(hit.note, p.x, p.y);
        }
        return;
      }
      this._lastClickTime = now;
      this._lastClickPos = { x: p.x, y: p.y };

      var rect = this.canvas.getBoundingClientRect();
      console.log('[PR] mousedown tool=' + this.tool + ' canvas=' + p.x.toFixed(0) + ',' + p.y.toFixed(0) +
        ' client=' + e.clientX + ',' + e.clientY +
        ' scrollTop=' + this.scrollTop + ' scrollLeft=' + this.scrollLeft +
        ' canvasH=' + this.totalHeight + ' clientH=' + this.wrapEl.clientHeight +
        ' rectTop=' + rect.top.toFixed(0) + ' rectH=' + rect.height.toFixed(0));
      // DEBUG: draw a red dot at click position
      var ctx = this.ctx;
      var dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(-this.scrollLeft, -this.scrollTop);
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.font = '10px monospace';
      ctx.fillText('(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')', p.x + 8, p.y - 8);
      ctx.restore();
      if (this.tool === 'draw') this._startDraw(p.x, p.y);
      else if (this.tool === 'select') this._startSelect(p.x, p.y, e.shiftKey);
      else if (this.tool === 'eraser') this._startErase(p.x, p.y);
    }

    _onMouseMove(e) {
      var p = this._clientToCanvas(e.clientX, e.clientY);
      this._mousePos = { x: p.x, y: p.y };
      if (this._dragType === 'create') this._updateDraw(p.x, p.y);
      else if (this._dragType === 'move') this._updateMove(p.x, p.y);
      else if (this._dragType === 'resize-left' || this._dragType === 'resize-right') this._updateResize(p.x, p.y);
      else if (this._dragType === 'select-rect') this._updateSelectRect(p.x, p.y);
      else if (this._dragType === 'adjust-intensity') this._updateIntensity(p.x, p.y);
      this._updateCursor(p.x, p.y);
    }

    _onMouseUp(e) {
      console.log('[PR] mouseup dragType=' + this._dragType + ' dragging=' + this._dragging + ' selRect=' + !!this._selRect);
      if (this._dragType === 'create' && this._dragStart) this._commitDraw(this._mousePos.x);
      // 框选模式下，极小拖拽视为点击音符
      if (this._dragType === 'select-rect' && this._dragStart && this._dragStart._hitNote) {
        var selW = this._selRect ? Math.abs(this._selRect.right - this._selRect.left) : 0;
        var selH = this._selRect ? Math.abs(this._selRect.bottom - this._selRect.top) : 0;
        if (selW < 4 && selH < 4) {
          var nid = this._dragStart._hitNote.id;
          if (this._dragStart._shiftClick) {
            // Shift+单击 → toggle
            if (this.selectedNotes.has(nid)) {
              this.selectedNotes.delete(nid);
            } else {
              this.selectedNotes.add(nid);
            }
          } else {
            this.selectedNotes.clear();
            this.selectedNotes.add(nid);
          }
          this._notifySelection();
        }
      }
      if (!this._dragging) {
        this._dragType = null;
        this._dragStart = null;
        this._selRect = null;
        this._moveStarted = false;
        return;
      }
      // 移动模式下松开时吸附到网格
      if (this._gridOn && this._dragType === 'move' && this._moveStarted) {
        var _noteKeys = Array.from(this.selectedNotes);
        for (var _i = 0; _i < this.notes.length; _i++) {
          if (_noteKeys.indexOf(this.notes[_i].id) >= 0) {
            var b = this._noteTimeToBeats(this.notes[_i]);
            this.notes[_i].time = this._beatToTime(this._snapBeat(b));
          }
        }
      }
      this._dragging = false;
      this._dragType = null;
      this._dragStart = null;
      this._resizeNote = null;
      this._selRect = null;
      this._moveStarted = false;
      this.render();
      this._notifyChange();
    }

    _onWheel(e) {
      e.preventDefault();
      this.scrollTop = Math.max(0, Math.min(this.totalHeight - this.wrapEl.clientHeight, this.scrollTop + e.deltaY));
      this.wrapEl.scrollTop = this.scrollTop;
      this.render();
    }

    _onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        var p = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
        if (this.tool === 'draw') this._startDraw(p.x, p.y);
        else if (this.tool === 'select') this._startSelect(p.x, p.y, false);
        else if (this.tool === 'eraser') this._startErase(p.x, p.y);
      }
    }

    _onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        var p = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
        this._mousePos = p;
        if (this._dragType === 'create') this._updateDraw(p.x, p.y);
        else if (this._dragType === 'move') this._updateMove(p.x, p.y);
        else if (this._dragType === 'resize-left' || this._dragType === 'resize-right') this._updateResize(p.x, p.y);
        else if (this._dragType === 'select-rect') this._updateSelectRect(p.x, p.y);
      }
    }

    _onTouchEnd(e) { this._onMouseUp(e); }

    _startDraw(x, y) {
      this._dragging = true;
      this._pushUndo();
      this._dragType = 'create';
      var beat = x / this.pixelPerBeat;
      var snapBeat = this._snapBeat(beat);
      var keyIndex = Math.floor(y / KEY_WIDTH);
      if (keyIndex < 0 || keyIndex >= TOTAL_KEYS) return;
      var midi = indexToMidi(keyIndex);
      var hit = this._hitTest(x, y);
      if (hit) {
        this._dragType = 'move';
        this.selectedNotes.clear();
        this.selectedNotes.add(hit.note.id);
        this._dragStart = { startX: x, startBeat: this._noteTimeToBeats(hit.note), startMidi: hit.note.midi, _snap: this._snapSelected() };
        return;
      }
      this._dragStart = { beat: snapBeat, midi: midi };
    }

    _updateDraw(x, y) {
      var startBeat = this._dragStart.beat;
      var beat = x / this.pixelPerBeat;
      var endBeat = Math.max(startBeat + 0.125, this._snapBeat(beat));
      this.render();
      var nx = startBeat * this.pixelPerBeat;
      var ny = midiToIndex(this._dragStart.midi) * KEY_WIDTH;
      var nw = (endBeat - startBeat) * this.pixelPerBeat;
      this.ctx.fillStyle = this.trackColor + '88';
      this.ctx.fillRect(nx + 1, ny + 1, nw - 2, KEY_WIDTH - 2);
      this.ctx.strokeStyle = this.trackColor;
      this.ctx.strokeRect(nx + 1, ny + 1, nw - 2, KEY_WIDTH - 2);
    }

    _commitDraw(endX) {
      if (!this._dragStart) return;
      var endBeat = this._snapBeat(endX / this.pixelPerBeat);
      var startBeat = this._dragStart.beat;
      if (endBeat <= startBeat) return;
      var note = {
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        midi: this._dragStart.midi,
        time: this._beatToTime(startBeat),
        duration: this._beatDurationToTime(endBeat - startBeat),
        intensity: 0.75,
        volume: 0,
        wave: null,
        porta: null,
        attack: null,
        release: null
      };
      this.notes.push(note);
      this._notifyChange();
    }

    _startSelect(x, y, shiftKey) {
      shiftKey = shiftKey || false;
      var hit = this._hitTest(x, y);
      console.log('[PR] _startSelect hit=' + !!hit + ' shift=' + shiftKey + ' notes=' + this.notes.length + ' selected=' + this.selectedNotes.size);

      // 强度条区域拖拽
      if (hit && hit.zone === 'intensity' && this.tool === 'select') {
        this._dragging = true;
        this._dragType = 'adjust-intensity';
        this._dragStart = { note: hit.note, startY: y, startIntensity: hit.note.intensity || 0.75 };
        return;
      }

      if (hit) {
        var edge = this._hitTestEdge(x, y, hit.note);
        console.log('[PR] _startSelect edge=' + edge);
        // 点击音符边缘 → 始终进入 resize 模式
        if (edge === 'resize-left' || edge === 'resize-right') {
          this._pushUndo();
          this._dragging = true;
          this._dragType = edge;
          this._resizeNote = hit.note;
          this._dragStart = { beat: this._noteTimeToBeats(hit.note), midi: hit.note.midi, dur: this.noteDurToBeats(hit.note) };
          if (!shiftKey) this.selectedNotes.clear();
          this.selectedNotes.add(hit.note.id);
          this._notifySelection();
          return;
        }
        // 点击已选中音符（无 Shift）→ 拖拽移动
        if (!shiftKey && this.selectedNotes.has(hit.note.id)) {
          this._pushUndo();
          this._dragging = true;
          this._dragType = 'move';
          this._dragStart = { startX: x, startY: y, startBeat: this._noteTimeToBeats(hit.note), startMidi: hit.note.midi, _snap: this._snapSelected() };
          return;
        }
      }

      // 框选优先：始终以 select-rect 启动，拖拽距离超过阈值才真正框选
      console.log('[PR] _startSelect → select-rect mode');
      this._dragging = true;
      this._dragType = 'select-rect';
      this._dragStart = { x: x, y: y };
      if (hit) {
        this._dragStart._hitNote = hit.note;
      }
      this._dragStart._shiftClick = shiftKey;
      if (!shiftKey) this.selectedNotes.clear();
      this._notifySelection();
    }

    _snapSelected() {
      var keys = Array.from(this.selectedNotes);
      var list = [];
      for (var i = 0; i < this.notes.length; i++) {
        var n = this.notes[i];
        if (keys.indexOf(n.id) >= 0) {
          list.push({ note: n, beat: this._noteTimeToBeats(n), midi: n.midi });
        }
      }
      return list;
    }

    _updateMove(x, y) {
      var dx = x - this._dragStart.startX;
      var dy = y - (this._dragStart.startY || y);
      if (!this._moveStarted && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      this._moveStarted = true;
      var beatDelta = dx / this.pixelPerBeat;
      var snap = this._dragStart._snap;
      for (var i = 0; i < snap.length; i++) {
        var s = snap[i];
        s.note.time = this._beatToTime(Math.max(0, s.beat + beatDelta));
        if (snap.length === 1) {
          var midiDelta = Math.round(dy / KEY_WIDTH);
          s.note.midi = Math.max(24, Math.min(83, snap[0].midi + midiDelta));
        }
      }
      this.render();
    }

    _updateResize(x, y) {
      if (!this._resizeNote) return;
      var beat = x / this.pixelPerBeat;
      var snapBeat = this._snapBeat(beat);
      var n = this._resizeNote;
      if (this._dragType === 'resize-right') {
        var newDur = Math.max(0.125, snapBeat - this._noteTimeToBeats(n));
        n.duration = this._beatDurationToTime(newDur);
      } else if (this._dragType === 'resize-left') {
        var origEnd = this._noteTimeToBeats(n) + this.noteDurToBeats(n);
        var newStart = Math.min(snapBeat, origEnd - 0.125);
        n.time = this._beatToTime(newStart);
        n.duration = this._beatDurationToTime(origEnd - newStart);
      }
      this.render();
    }

    _updateSelectRect(x, y) {
      var sx = this._dragStart.x, sy = this._dragStart.y;
      this._selRect = { left: Math.min(sx,x), top: Math.min(sy,y), right: Math.max(sx,x), bottom: Math.max(sy,y) };
      this.selectedNotes.clear();
      for (var i = 0; i < this.notes.length; i++) {
        var n = this.notes[i];
        var nx = this._noteTimeToBeats(n) * this.pixelPerBeat;
        var ny = midiToIndex(n.midi) * KEY_WIDTH;
        var nw = this.noteDurToBeats(n) * this.pixelPerBeat;
        if (nx + nw >= this._selRect.left && nx <= this._selRect.right &&
            ny + KEY_WIDTH >= this._selRect.top && ny <= this._selRect.bottom) {
          this.selectedNotes.add(n.id);
        }
      }
      console.log('[PR] _updateSelectRect sel=' + this.selectedNotes.size + ' rect=' +
        this._selRect.left.toFixed(0) + ',' + this._selRect.top.toFixed(0) + ' ' +
        this._selRect.right.toFixed(0) + ',' + this._selRect.bottom.toFixed(0));
      this._notifySelection();
      this.render();
    }

    _updateIntensity(x, y) {
      var ds = this._dragStart;
      var dy = y - ds.startY;
      var newIntensity = Math.max(0.1, Math.min(1.0, ds.startIntensity - dy / KEY_WIDTH));
      ds.note.intensity = newIntensity;
      this.render();
      this._notifyChange();
    }

    _updateCursor(x, y) {
      if (this._dragging) return;
      var hit = this._hitTest(x, y);
      if (hit && this.tool === 'select') {
        if (hit.zone === 'intensity') {
          this.canvas.style.cursor = 'ns-resize';
        } else {
          var edge = this._hitTestEdge(x, y, hit.note);
          this.canvas.style.cursor = (edge === 'resize-left' || edge === 'resize-right') ? 'ew-resize' : 'move';
        }
      } else {
        this.canvas.style.cursor = this.tool === 'eraser' ? 'pointer' : 'crosshair';
      }
    }

    _startErase(x, y) {
      var hit = this._hitTest(x, y);
      if (hit) {
        this._pushUndo();
        this.notes.splice(hit.index, 1);
        this.selectedNotes.delete(hit.note.id);
        this._notifyChange();
        this.render();
      }
    }

    _onKeyDown(e) {
      if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); this.selectAll(); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); this.redo(); }
      if (e.key === 'Escape') { this.selectedNotes.clear(); this._notifySelection(); this.render(); }
    }

    _pushUndo() {
      this._undoStack.push(this.notes.map(function(n) { return Object.assign({}, n); }));
      if (this._undoStack.length > this._undoMaxSize) this._undoStack.shift();
      this._redoStack = [];
    }

    undo() {
      if (this._undoStack.length === 0) return;
      this._redoStack.push(this.notes.map(function(n) { return Object.assign({}, n); }));
      this.notes = this._undoStack.pop();
      this.selectedNotes.clear();
      this.render();
      this._notifyChange();
    }

    redo() {
      if (this._redoStack.length === 0) return;
      this._undoStack.push(this.notes.map(function(n) { return Object.assign({}, n); }));
      this.notes = this._redoStack.pop();
      this.selectedNotes.clear();
      this.render();
      this._notifyChange();
    }

    getUndoState() {
      return {
        undoStack: this._undoStack.map(function(stack) {
          return stack.map(function(n) { return Object.assign({}, n); });
        }),
        redoStack: this._redoStack.map(function(stack) {
          return stack.map(function(n) { return Object.assign({}, n); });
        })
      };
    }

    setUndoState(state) {
      if (!state) return;
      this._undoStack = (state.undoStack || []).map(function(stack) {
        return stack.map(function(n) { return Object.assign({}, n); });
      });
      this._redoStack = (state.redoStack || []).map(function(stack) {
        return stack.map(function(n) { return Object.assign({}, n); });
      });
    }

    render() {
      var ctx = this.ctx;
      var dpr = window.devicePixelRatio || 1;
      var vw = this.wrapEl.clientWidth;
      var vh = this.wrapEl.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(this.scrollLeft, this.scrollTop, vw, vh);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(this.scrollLeft, this.scrollTop, vw, vh);
      this._renderGrid(ctx, vw, this.totalHeight);
      this._renderPianoKeys(ctx, vw, this.totalHeight);
      this._renderNotes(ctx);
      // 强度拖拽时的浮动百分比标签
      if (this._dragType === 'adjust-intensity' && this._dragStart) {
        var pct = Math.round(this._dragStart.note.intensity * 100);
        var pctText = pct + '%';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var textW = ctx.measureText(pctText).width + 12;
        var textH = 18;
        var tx = this._mousePos.x;
        var ty = this._mousePos.y - 18;
        // 半透明黑底圆角矩形
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        this._roundRect(ctx, tx - textW / 2, ty - textH / 2, textW, textH, 4);
        ctx.fill();
        // 白色文字
        ctx.fillStyle = '#fff';
        ctx.fillText(pctText, tx, ty);
      }
      if (this._selRect) {
        ctx.fillStyle = 'rgba(14,165,233,0.15)';
        ctx.fillRect(this._selRect.left, this._selRect.top, this._selRect.right - this._selRect.left, this._selRect.bottom - this._selRect.top);
        ctx.strokeStyle = '#0ea5e9';
        ctx.setLineDash([4,4]);
        ctx.strokeRect(this._selRect.left, this._selRect.top, this._selRect.right - this._selRect.left, this._selRect.bottom - this._selRect.top);
        ctx.setLineDash([]);
      }
      if (this.playheadBeat !== undefined) {
        var px = this.playheadBeat * this.pixelPerBeat;
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 1, this.scrollTop, 2, vh);
      }
    }

    _renderGrid(ctx, w, h) {
      var bpx = this.pixelPerBeat;
      var vw = this.wrapEl.clientWidth;
      var margin = bpx * 4; // 缓冲区
      var xMin = Math.max(0, this.scrollLeft - margin);
      var xMax = this.scrollLeft + vw + margin;
      var bStart = Math.floor(xMin / bpx / 0.25) * 0.25;
      for (var b = bStart; b <= this.totalBeats && b * bpx <= xMax; b += 0.25) {
        var x = b * bpx;
        if (b % 1 === 0) { ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 1; }
        else if (b % 0.5 === 0) { ctx.strokeStyle = '#252545'; ctx.lineWidth = 0.5; }
        else { ctx.strokeStyle = '#222240'; ctx.lineWidth = 0.3; }
        ctx.beginPath(); ctx.moveTo(x, this.scrollTop); ctx.lineTo(x, this.scrollTop + this.wrapEl.clientHeight); ctx.stroke();
      }
      ctx.strokeStyle = '#252545'; ctx.lineWidth = 0.3;
      for (var i = 0; i <= TOTAL_KEYS; i++) {
        var y = i * KEY_WIDTH;
        ctx.beginPath(); ctx.moveTo(xMin, y); ctx.lineTo(xMax, y); ctx.stroke();
      }
    }

    _renderPianoKeys(ctx, w, h) {
      var vw = this.wrapEl.clientWidth;
      var vh = this.wrapEl.clientHeight;
      var iStart = Math.floor(this.scrollTop / KEY_WIDTH);
      var iEnd = Math.min(TOTAL_KEYS, Math.ceil((this.scrollTop + vh) / KEY_WIDTH));
      var isBlack = function(midi) { return [1,3,6,8,10].indexOf(midi % 12) >= 0; };
      for (var i = iStart; i < iEnd; i++) {
        var midi = indexToMidi(i);
        var y = i * KEY_WIDTH;
        ctx.fillStyle = isBlack(midi) ? '#15152a' : '#1e1e38';
        ctx.fillRect(this.scrollLeft, y, vw, KEY_WIDTH);
      }
      for (var i = iStart; i < iEnd; i++) {
        var midi = indexToMidi(i);
        if (midi % 12 === 0) {
          var oct = Math.floor(midi / 12) - 1;
          var y = i * KEY_WIDTH + KEY_WIDTH / 2 + 3;
          ctx.fillStyle = '#444';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('C' + oct, this.scrollLeft + 4, y);
        }
      }
    }

    _renderNotes(ctx) {
      var self = this;
      var vw = this.wrapEl.clientWidth;
      var beatMin = this.scrollLeft / this.pixelPerBeat - 1;
      var beatMax = (this.scrollLeft + vw) / this.pixelPerBeat + 1;
      this.notes.forEach(function(note) {
        var beatStart = self._noteTimeToBeats(note);
        var beatEnd = beatStart + self.noteDurToBeats(note);
        if (beatEnd < beatMin || beatStart > beatMax) return;
        var x = beatStart * self.pixelPerBeat;
        var y = midiToIndex(note.midi) * KEY_WIDTH;
        var w = Math.max(2, self.noteDurToBeats(note) * self.pixelPerBeat);
        var h = KEY_WIDTH;
        var sel = self.selectedNotes.has(note.id);
        var grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, sel ? '#ff6b81' : self.trackColor);
        grad.addColorStop(1, sel ? '#cc4055' : '#b0304a');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = sel ? 2 : 1;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        // 强度条 (FL Studio 风格)
        var intensityVal = note.intensity || 0.75;
        var intH = Math.max(6, h * 0.3);
        var intY = y + h - intH;
        var intW = Math.max(2, (w - 2) * intensityVal);
        // 强度条背景（满宽度暗色底）
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 1, intY + 1, w - 2, intH - 2);
        // 强度条前景（亮色，按 intensity 缩放宽度）
        var intGrad = ctx.createLinearGradient(x, intY, x, intY + intH);
        intGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
        intGrad.addColorStop(1, 'rgba(255,255,255,0.35)');
        ctx.fillStyle = intGrad;
        ctx.fillRect(x + 1, intY + 1, intW, intH - 2);
        // 分隔线
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 1, intY);
        ctx.lineTo(x + w - 1, intY);
        ctx.stroke();
        if (w > 40) {
          var names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
          var name = names[note.midi % 12];
          var oct = Math.floor(note.midi / 12) - 1;
          ctx.fillStyle = '#fff';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(name + oct, x + w/2, y + h/2 + 4);
        }
        // 强度百分比标签
        if (w > 25) {
          var ipct = Math.round(intensityVal * 100);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ipct + '%', x + w/2, intY + intH - 3);
        }
        // 元音覆写标签
        if (note.vowel !== null && note.vowel !== undefined) {
          var vLabel = note.vowel === 'bypass' ? 'OFF' : note.vowel;
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          var vw2 = ctx.measureText(vLabel).width + 6;
          var vh2 = 13;
          var vx = x + w - 3;
          var vy = y + 1;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          self._roundRect(ctx, vx - vw2, vy, vw2, vh2, 3);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(vLabel, vx - 2, vy + 1);
        }
      });
    }

    _renderRuler() {
      var ctx = this.rulerCtx;
      var dpr = window.devicePixelRatio || 1;
      var vw = this.wrapEl.clientWidth;
      ctx.setTransform(dpr, 0, 0, dpr, -this.scrollLeft * dpr, 0);
      ctx.clearRect(this.scrollLeft, 0, vw, 24);
      ctx.fillStyle = '#16213e';
      ctx.fillRect(this.scrollLeft, 0, vw, 24);
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      var bpx = this.pixelPerBeat;
      var bStart = Math.floor(this.scrollLeft / bpx);
      var bEnd = Math.min(this.totalBeats, Math.ceil((this.scrollLeft + vw) / bpx));
      for (var b = bStart; b <= bEnd; b++) {
        var x = b * bpx;
        if (b % 4 === 0) { ctx.fillStyle = '#a0a0b8'; ctx.fillText((b/4+1), x, 14); }
        else { ctx.fillStyle = '#555'; ctx.fillText((b%4), x, 14); }
      }
    }

    // === 公开 API ===
    addNote(midi, time, duration) {
      duration = duration || '0:0:2';
      var note = { id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), midi: midi, time: time, duration: duration, intensity: 0.75,
        volume: 0, wave: null, porta: null, attack: null, release: null };
      this.notes.push(note);
      this.render();
      this._notifyChange();
      return note;
    }

    deleteSelected() {
      var ids = Array.from(this.selectedNotes);
      if (ids.length === 0) return;
      this._pushUndo();
      this.notes = this.notes.filter(function(n) { return ids.indexOf(n.id) < 0; });
      this.selectedNotes.clear();
      this.render();
      this._notifyChange();
    }

    selectAll() {
      this.selectedNotes.clear();
      var self = this;
      this.notes.forEach(function(n) { self.selectedNotes.add(n.id); });
      this._notifySelection();
      this.render();
    }

    quantize() {
      this._pushUndo();
      var self = this;
      this.notes.forEach(function(n) {
        var beat = self._noteTimeToBeats(n);
        n.time = self._beatToTime(self._snapBeat(beat));
      });
      this.render();
      this._notifyChange();
    }

    clear() {
      this._pushUndo();
      this.notes = [];
      this.selectedNotes.clear();
      this.render();
      this._notifyChange();
    }

    getNotes() { return this.notes.slice(); }

    setNotes(notes) {
      this._pushUndo();
      this.notes = notes.map(function(n) {
        var copy = Object.assign({}, n);
        if (copy.intensity === undefined) copy.intensity = 0.75;
        if (copy.vowel === undefined) copy.vowel = null;
        if (copy.volume === undefined) copy.volume = 0;
        if (copy.wave === undefined) copy.wave = null;
        if (copy.porta === undefined) copy.porta = null;
        if (copy.attack === undefined) copy.attack = null;
        if (copy.release === undefined) copy.release = null;
        return copy;
      });
      this.selectedNotes.clear();
      this.render();
    }

    setTrackColor(color) { this.trackColor = color; this.render(); }

    setPlayheadBeat(beat) { this.playheadBeat = beat; this.render(); }

    _commitDrawIfNeeded() {
      if (this._dragType === 'create' && this._dragStart) {
        this._commitDraw(this._mousePos.x);
        this.render();
      }
    }

    on(event, cb) {
      if (event === 'notesChange') this._callbacks.onNotesChange = cb;
      else if (event === 'selectionChange') this._callbacks.onSelectionChange = cb;
      else if (event === 'noteDblClick') this._callbacks.onNoteDblClick = cb;
    }

    reset() {
      this.notes = [];
      this.selectedNotes.clear();
      this._undoStack = [];
      this._redoStack = [];
      this._maxBeats = 32;
      this.zoom = 1;
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.wrapEl.scrollTop = 0;
      this.wrapEl.scrollLeft = 0;
      this._selRect = null;
      this._resize();
      this.render();
      this._notifyChange();
    }

    _notifyChange() { if (this._callbacks.onNotesChange) this._callbacks.onNotesChange(this.notes); }
    _notifySelection() { if (this._callbacks.onSelectionChange) this._callbacks.onSelectionChange(Array.from(this.selectedNotes)); }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  };
})();