/**
 * app.js - Talkbox Studio 主入口
 * 适配现有 index.html 中的元素 ID
 */
window.TalkboxStudio = window.TalkboxStudio || {};

(function() {
  var AudioEngine = TalkboxStudio.AudioEngine;
  var PianoRoll = TalkboxStudio.PianoRoll;
  var Storage = TalkboxStudio.Storage;
  var MidiImport = TalkboxStudio.MidiImport;
  var VOWEL_PRESETS = TalkboxStudio.VOWEL_PRESETS;
  var TIMBRE_PRESETS = TalkboxStudio.TIMBRE_PRESETS;

  var engine = null;
  var pianoRoll = null;
  var currentProjectId = null;
  var tracks = [];
  var currentTrackIndex = 0;
  var isPlaying = false;
  var isRecording = false;
  var currentPart = null;
  var metronomeOn = false;
  var lastPlayheadBeat = -1;
  var isFormantAdvanced = false;

  function q(s) { return document.querySelector(s); }
  function qa(s) { return document.querySelectorAll(s); }

  // === 会话持久化 ===
  var SESSION_KEY = 'talkbox_session';
  var _saveTimer = null;

  function saveSession() {
    var sess = {
      tracks: tracks,
      currentTrackIndex: currentTrackIndex,
      bpm: engine ? engine.bpm : 120,
      tool: pianoRoll ? pianoRoll.tool : 'draw',
      snapValue: pianoRoll ? pianoRoll.snapValue : '16',
      gridOn: pianoRoll ? pianoRoll.gridOn : true,
      zoom: pianoRoll ? pianoRoll.zoom : 1,
      scrollLeft: pianoRoll ? pianoRoll.scrollLeft : 0,
      undoState: pianoRoll ? pianoRoll.getUndoState() : null,
      isFormantAdvanced: isFormantAdvanced,
      currentVowel: engine ? engine.currentVowel : 'aah',
      carrierWave: engine ? engine.carrierWave : 'sawtooth',
      portamento: engine ? engine.portamento : 0.03,
      attack: engine ? engine.attack : 0.01,
      release: engine ? engine.release : 0.08,
      volume: engine ? engine.volume : 0.8,
      currentQ: engine ? engine.currentQ : 0,
      f1: q('#f1-knob') ? parseInt(q('#f1-knob').value) : 730,
      f2: q('#f2-knob') ? parseInt(q('#f2-knob').value) : 1090,
      f3: q('#f3-knob') ? parseInt(q('#f3-knob').value) : 2440,
      formantMix: q('#mix-knob') ? parseInt(q('#mix-knob').value) : 50,
      defaultIntensity: engine ? engine.defaultIntensity : 0.75
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    } catch(e) {}
  }

  function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveSession, 200);
  }

  function loadSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    var s;
    try {
      s = JSON.parse(raw);
    } catch(e) {
      console.error('[loadSession] JSON parse error', e);
      return null;
    }

    var hasTracks = s.tracks && s.tracks.length > 0;
    if (hasTracks) {
      tracks = s.tracks;
    }
    if (!hasTracks) return s;

    // UI 恢复（best-effort：即使失败也不影响已加载的轨道）
    try {
      currentTrackIndex = (typeof s.currentTrackIndex === 'number') ? s.currentTrackIndex : 0;
      if (typeof s.bpm === 'number') { engine.setBPM(s.bpm); q('#bpm-input').value = s.bpm; }
      if (s.tool) {
        pianoRoll.tool = s.tool;
        q('#btn-tool-draw').classList.toggle('active', s.tool === 'draw');
        q('#btn-tool-select').classList.toggle('active', s.tool === 'select');
        q('#btn-tool-eraser').classList.toggle('active', s.tool === 'eraser');
      }
      if (s.snapValue) {
        pianoRoll.snapValue = s.snapValue;
        q('#snap-select').value = s.snapValue;
      }
      if (typeof s.gridOn === 'boolean') {
        pianoRoll.gridOn = s.gridOn;
        q('#btn-snap-grid').classList.toggle('active', s.gridOn);
      }
      if (typeof s.zoom === 'number') {
        pianoRoll.zoom = s.zoom;
        q('#zoom-label').textContent = s.zoom.toFixed(2) + 'x';
        pianoRoll._resize();
      }
      if (typeof s.scrollLeft === 'number') {
        q('#piano-roll-wrap').scrollLeft = s.scrollLeft;
        pianoRoll.scrollLeft = s.scrollLeft;
      }
      if (typeof s.isFormantAdvanced === 'boolean') {
        isFormantAdvanced = s.isFormantAdvanced;
        q('#formant-simple').classList.toggle('active', !isFormantAdvanced);
        q('#formant-advanced').classList.toggle('active', isFormantAdvanced);
        q('#btn-toggle-formant').textContent = isFormantAdvanced ? '简易' : '高级';
        q('#vowel-buttons').style.display = isFormantAdvanced ? 'none' : '';
        q('#formant-buttons').style.display = isFormantAdvanced ? '' : 'none';
      }
      if (s.currentVowel) {
        engine.currentVowel = s.currentVowel;
        qa('#vowel-buttons button').forEach(function(b) { b.classList.toggle('active', b.dataset.vowel === s.currentVowel); });
      }
      if (s.carrierWave) {
        engine.carrierWave = s.carrierWave;
        qa('#wave-buttons button').forEach(function(b) { b.classList.toggle('active', b.dataset.wave === s.carrierWave); });
      }
      if (typeof s.portamento === 'number') {
        engine.portamento = s.portamento;
        var pSlider = q('#portamento-slider');
        if (pSlider) pSlider.value = s.portamento;
      }
      if (typeof s.attack === 'number') {
        engine.attack = s.attack;
        var aSlider = q('#attack-slider');
        if (aSlider) aSlider.value = s.attack;
      }
      if (typeof s.release === 'number') {
        engine.release = s.release;
        var rSlider = q('#release-slider');
        if (rSlider) rSlider.value = s.release;
      }
      if (typeof s.volume === 'number') {
        engine.volume = s.volume;
        var vSlider = q('#volume-slider');
        if (vSlider) vSlider.value = s.volume;
      }
      if (typeof s.defaultIntensity === 'number') {
        engine.defaultIntensity = s.defaultIntensity;
        var iKnob = q('#intensity-knob');
        if (iKnob) { iKnob.value = Math.round(s.defaultIntensity * 100); q('#val-intensity').value = Math.round(s.defaultIntensity * 100); }
      }
      if (typeof s.currentQ === 'number') {
        engine.currentQ = s.currentQ;
        var qKnob = q('#q-knob');
        if (qKnob) { qKnob.value = s.currentQ; q('#val-q').value = s.currentQ.toFixed(1); }
      }
      if (typeof s.f1 === 'number' && typeof s.f2 === 'number' && typeof s.f3 === 'number') {
        var f1Knob = q('#f1-knob'), f2Knob = q('#f2-knob'), f3Knob = q('#f3-knob'), mixKnob = q('#mix-knob');
        var mixVal = (typeof s.formantMix === 'number') ? s.formantMix : 50;
        if (f1Knob) { f1Knob.value = s.f1; q('#val-f1').value = s.f1; }
        if (f2Knob) { f2Knob.value = s.f2; q('#val-f2').value = s.f2; }
        if (f3Knob) { f3Knob.value = s.f3; q('#val-f3').value = s.f3; }
        if (mixKnob) { mixKnob.value = mixVal; q('#val-mix').value = mixVal; }
        try { engine.setFormantAdvanced(s.f1, s.f2, s.f3, s.currentQ || 5, mixVal); } catch(e) {}
      }
    } catch(e) {
      console.error('[loadSession] UI restore failed', e);
    }

    return s;
  }

  function init() {
    pianoRoll = new PianoRoll(
      q('#piano-roll'),
      q('#time-ruler'),
      q('#piano-roll-wrap')
    );
    pianoRoll.on('notesChange', onNotesChange);
    pianoRoll.on('noteDblClick', onNoteDblClick);

    engine = new AudioEngine();
    showStartupOverlay();

    engine.on('timeUpdate', onTimeUpdate);
    engine.on('playStateChange', onPlayStateChange);
    engine.on('recordStateChange', onRecordStateChange);

    bindTransport();
    bindPianoRollTools();
    bindVowelControls();
    bindCarrierControls();
    bindPresetControls();
    bindProjectControls();
    bindMidiImport();
    bindTrackControls();
    bindReset();
    bindLangToggle();
    // 初始化国际化
    I18N.init();
    // 点击外部关闭轨道选择下拉
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#track-select')) q('#track-select').classList.remove('open');
    });
    bindSnap();
    bindZoom();
    bindFormantMode();
    bindDeleteSelected();
    bindTheme();
    bindHelpTooltips();
    bindNotePropsPanel();

    var sessionData = loadSession();
    if (tracks.length === 0) {
      tracks.push({ name: 'Track 1', color: '#e94560', notes: [] });
    }
    refreshTrackSelect();
    switchTrack(currentTrackIndex);
    pianoRoll.autoResize(pianoRoll.notes);
    if (sessionData && sessionData.undoState) { pianoRoll.setUndoState(sessionData.undoState); }

    q('#status-text').textContent = I18N.t('status.ready');
    q('#status-time').textContent = '1:1:0';

    window.addEventListener('beforeunload', saveSession);

    // 状态栏点击重新打开教程
    q('#status-text').style.cursor = 'pointer';
    q('#status-text').title = I18N.t('status.ready');
    q('#status-text').addEventListener('click', function() {
      showTutorial();
    });

    // 调试快捷键：Ctrl+Alt+T 强制弹出教程（忽略 seen 标记）
    // 注：Ctrl+Shift+T 被 Chrome 占用，改用 Ctrl+Alt+T
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.altKey && !e.shiftKey && e.key === 'T') {
        e.preventDefault();
        console.log('[Tutorial] Ctrl+Alt+T pressed, tutorialActive:', tutorialActive);
        if (tutorialActive) hideTutorial();
        else {
          localStorage.removeItem('talkbox_tutorial_seen');
          showTutorial();
        }
      }
    });
  }

  // === 时间更新 ===
  function onTimeUpdate(seconds) {
    var bpm = engine.bpm;
    var barsBeats = Tone.Time(seconds).toBarsBeatsSixteenths();
    var parts = barsBeats.split(':');
    var beats = parseInt(parts[0]) * 4 + parseInt(parts[1]) + parseInt(parts[2]) * 0.25;
    pianoRoll.setPlayheadBeat(beats);
    if (Math.floor(beats) !== Math.floor(lastPlayheadBeat)) {
      lastPlayheadBeat = beats;
      q('#status-time').textContent = barsBeats;
    }
  }

  function onPlayStateChange(playing) {
    isPlaying = playing;
    var btn = q('#btn-play');
    btn.classList.toggle('active', playing);
    if (!isRecording) q('#status-text').textContent = playing ? I18N.t('status.playing') : I18N.t('status.ready');
  }

  function onRecordStateChange(recording) {
    isRecording = recording;
    q('#btn-record').classList.toggle('active', recording);
    q('#status-text').textContent = recording ? I18N.t('status.recording') : I18N.t('status.ready');
  }

  function onNotesChange(notes) {
    if (tracks[currentTrackIndex]) {
      tracks[currentTrackIndex].notes = notes;
    }
    scheduleSave();
  }

  // === 音符属性面板 ===
  var _editingNote = null;

  function onNoteDblClick(note, canvasX, canvasY) {
    showNoteProps(note, canvasX, canvasY);
  }

  function showNoteProps(note, canvasX, canvasY) {
    _editingNote = note;
    var panel = q('#note-props');
    var nameLabel = q('#note-props-name');
    var intensitySlider = q('#note-props-intensity');
    var intensityVal = q('#note-props-intensity-val');
    var volumeSlider = q('#note-props-volume');
    var volumeVal = q('#note-props-volume-val');
    var waveSelect = q('#note-props-wave');
    var portaSlider = q('#note-props-porta');
    var portaVal = q('#note-props-porta-val');
    var attackSlider = q('#note-props-attack');
    var attackVal = q('#note-props-attack-val');
    var releaseSlider = q('#note-props-release');
    var releaseVal = q('#note-props-release-val');
    var vowelSelect = q('#note-props-vowel');

    // 音符名称
    var names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    nameLabel.textContent = names[note.midi % 12] + Math.floor(note.midi / 12 - 1);

    // 强度
    var pct = Math.round((note.intensity || 0.75) * 100);
    intensitySlider.value = pct;
    intensityVal.value = pct;

    // 音量
    var vol = note.volume != null ? note.volume : 0;
    volumeSlider.value = vol;
    volumeVal.value = vol;

    // 载波
    waveSelect.value = note.wave || '';

    // 滑音 (porta slider: 0-100 → actual 0-1.0)
    var porta = note.porta != null ? note.porta : 0;
    portaSlider.value = Math.round(porta * 100);
    portaVal.value = porta;

    // Attack (slider: 0-200 → actual 0-2.0)
    var atk = note.attack != null ? note.attack : 0;
    attackSlider.value = Math.round(atk * 100);
    attackVal.value = atk;

    // Release (slider: 0-200 → actual 0-2.0)
    var rel = note.release != null ? note.release : 0;
    releaseSlider.value = Math.round(rel * 100);
    releaseVal.value = rel;

    // 元音
    vowelSelect.value = note.vowel || '';

    // 定位面板
    panel.classList.remove('hidden');
    var container = q('#piano-roll-container');
    var wrap = q('#piano-roll-wrap');
    var wrapperRect = wrap.getBoundingClientRect();
    var contRect = container.getBoundingClientRect();

    // canvasX/canvasY 是 canvas 空间坐标（含滚动偏移）
    // 需转为容器内坐标
    var left = canvasX - pianoRoll.scrollLeft + wrapperRect.left - contRect.left;
    var top = canvasY - pianoRoll.scrollTop + wrapperRect.top - contRect.top + 20;

    // 边界保护
    var panelW = panel.offsetWidth || 210;
    var panelH = panel.offsetHeight || 100;
    if (left + panelW > contRect.width) left = contRect.width - panelW - 8;
    if (top + panelH > contRect.height) top = canvasY - pianoRoll.scrollTop + wrapperRect.top - contRect.top - panelH - 8;
    left = Math.max(4, left);
    top = Math.max(4, top);

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function hideNoteProps() {
    q('#note-props').classList.add('hidden');
    _editingNote = null;
  }

  function bindNotePropsPanel() {
    var panel = q('#note-props');
    var intensitySlider = q('#note-props-intensity');
    var intensityVal = q('#note-props-intensity-val');
    var vowelSelect = q('#note-props-vowel');

    q('#note-props-close').addEventListener('click', hideNoteProps);

    // Esc 关闭
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
        hideNoteProps();
        e.stopPropagation();
      }
    });

    // 点击面板外关闭（但不拦截钢琴卷帘区域，由钢琴卷帘双击逻辑处理）
    q('#piano-roll-container').addEventListener('mousedown', function(e) {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !e.target.closest('#piano-roll-wrap')) {
        hideNoteProps();
      }
    });

    // 强度滑块
    intensitySlider.addEventListener('input', function() {
      var v = parseInt(this.value);
      intensityVal.value = v;
      if (_editingNote) {
        _editingNote.intensity = v / 100;
        pianoRoll.render();
        scheduleSave();
      }
    });

    // 强度数值输入
    intensityVal.addEventListener('change', function() {
      var v = Math.max(10, Math.min(100, parseFloat(this.value) || 75));
      this.value = Math.round(v * 10) / 10;
      intensitySlider.value = v;
      if (_editingNote) {
        _editingNote.intensity = v / 100;
        pianoRoll.render();
        scheduleSave();
      }
    });

    // 音量滑块
    var volumeSlider = q('#note-props-volume');
    var volumeVal = q('#note-props-volume-val');
    volumeSlider.addEventListener('input', function() {
      var v = parseFloat(this.value);
      volumeVal.value = v;
      if (_editingNote) {
        _editingNote.volume = v;
        scheduleSave();
      }
    });

    // 音量数值输入
    volumeVal.addEventListener('change', function() {
      var v = Math.max(-30, Math.min(6, parseFloat(this.value) || 0));
      this.value = v;
      volumeSlider.value = v;
      if (_editingNote) {
        _editingNote.volume = v;
        scheduleSave();
      }
    });

    // 载波下拉
    var waveSelect = q('#note-props-wave');
    waveSelect.addEventListener('change', function() {
      if (_editingNote) {
        _editingNote.wave = this.value || null;
        scheduleSave();
      }
    });

    // 滑音滑块 + 数值
    var portaSlider = q('#note-props-porta');
    var portaVal = q('#note-props-porta-val');
    portaSlider.addEventListener('input', function() {
      var v = parseInt(this.value) / 100;
      portaVal.value = v;
      if (_editingNote) { _editingNote.porta = v; scheduleSave(); }
    });
    portaVal.addEventListener('change', function() {
      var v = Math.max(0, Math.min(1, parseFloat(this.value) || 0));
      this.value = v;
      portaSlider.value = Math.round(v * 100);
      if (_editingNote) { _editingNote.porta = v; scheduleSave(); }
    });

    // Attack 滑块 + 数值
    var attackSlider = q('#note-props-attack');
    var attackVal = q('#note-props-attack-val');
    attackSlider.addEventListener('input', function() {
      var v = parseInt(this.value) / 100;
      attackVal.value = v;
      if (_editingNote) { _editingNote.attack = v; scheduleSave(); }
    });
    attackVal.addEventListener('change', function() {
      var v = Math.max(0, Math.min(2, parseFloat(this.value) || 0));
      this.value = v;
      attackSlider.value = Math.round(v * 100);
      if (_editingNote) { _editingNote.attack = v; scheduleSave(); }
    });

    // Release 滑块 + 数值
    var releaseSlider = q('#note-props-release');
    var releaseVal = q('#note-props-release-val');
    releaseSlider.addEventListener('input', function() {
      var v = parseInt(this.value) / 100;
      releaseVal.value = v;
      if (_editingNote) { _editingNote.release = v; scheduleSave(); }
    });
    releaseVal.addEventListener('change', function() {
      var v = Math.max(0, Math.min(2, parseFloat(this.value) || 0));
      this.value = v;
      releaseSlider.value = Math.round(v * 100);
      if (_editingNote) { _editingNote.release = v; scheduleSave(); }
    });

    // 元音下拉
    vowelSelect.addEventListener('change', function() {
      if (_editingNote) {
        _editingNote.vowel = this.value || null;
        pianoRoll.render();
        scheduleSave();
      }
    });
  }

  // === 运输 ===
  function bindTransport() {
    q('#btn-play').addEventListener('click', handlePlay);
    q('#btn-stop').addEventListener('click', handleStop);
    q('#btn-record').addEventListener('click', handleRecord);
    q('#btn-metronome').addEventListener('click', handleMetronome);
    var bpmInput = q('#bpm-input');
    bpmInput.addEventListener('change', function() {
      var v = parseInt(this.value) || 120;
      engine.setBPM(v);
      scheduleSave();
    });
    bpmInput.addEventListener('wheel', function(e) {
      e.preventDefault();
      var v = Math.max(40, Math.min(300, parseInt(this.value) + (e.deltaY < 0 ? 1 : -1)));
      this.value = v;
      engine.setBPM(v);
      scheduleSave();
    });
  }

  function handlePlay() {
    q('#status-text').textContent = '正在初始化音频...';
    engine.init().then(function() {
      hideStartupOverlay();
      if (isPlaying) {
        engine.pause();
        return;
      }
      var state = Tone.Transport.state;
      if (state === 'stopped') {
        buildPart();
        Tone.Transport.position = 0;
      }
      engine.play();
      q('#status-text').textContent = '播放中';
    }).catch(function(e) {
      console.error(e);
      q('#status-text').textContent = '播放失败: ' + e.message;
    });
  }

  function handleStop() {
    engine.stop();
    clearPart();
    Tone.Transport.position = 0;
    lastPlayheadBeat = -1;
    pianoRoll.setPlayheadBeat(undefined);
    pianoRoll.render();
    q('#status-text').textContent = '已停止';
  }

  function handleRecord() {
    engine.init().then(function() {
      hideStartupOverlay();
      if (isRecording) {
        engine.stopRecording().then(function(blob) {
          if (blob) {
            var name = '录音_' + new Date().toISOString().slice(0,19).replace(/T/, '_').replace(/:/g, '-');
            Storage.saveRecording(blob, name).then(function() {
              q('#status-text').textContent = '录音已保存';
            });
          }
        });
      } else {
        scheduleCurrentTrack();
        engine.startRecording().catch(function() { alert(I18N.t('alert.mic')); });
      }
    });
  }

  function handleMetronome() {
    metronomeOn = engine.toggleMetronome();
    q('#btn-metronome').classList.toggle('active', metronomeOn);
  }

  // === 播放调度 (基于 Tone.Part) ===
  function buildPart() {
    if (currentPart) { currentPart.dispose(); currentPart = null; }
    var t = tracks[currentTrackIndex];
    if (!t || !t.notes || t.notes.length === 0) return;
    var bpm = engine.bpm;
    var beatToSec = 60 / bpm;
    var events = [];
    t.notes.forEach(function(note) {
      var beat = timeToBeats(note.time);
      var durBeats = timeToBeats(note.duration);
      var startSec = beat * beatToSec;
      var durSec = durBeats * beatToSec;
      var freq = Tone.Frequency(note.midi, 'midi').toFrequency();
      var intensity = note.intensity != null ? note.intensity : engine.defaultIntensity;
      var vowel = note.vowel || null;
      var volDb = note.volume != null ? note.volume : 0;
      var wave = note.wave || null;
      var porta = note.porta != null ? note.porta : null;
      var atk = note.attack != null ? note.attack : null;
      var rel = note.release != null ? note.release : null;
      events.push({ time: startSec, freq: freq, dur: durSec, intensity: intensity, vowel: vowel, volume: volDb, wave: wave, porta: porta, attack: atk, release: rel });
    });
    currentPart = new Tone.Part(function(time, ev) {
      var setObj = {};
      if (ev.wave) setObj['oscillator'] = { type: ev.wave };
      if (ev.porta != null) setObj['portamento'] = ev.porta;
      if (ev.attack != null || ev.release != null) {
        setObj['envelope'] = {};
        if (ev.attack != null) setObj['envelope'].attack = ev.attack;
        if (ev.release != null) setObj['envelope'].release = ev.release;
      }
      if (Object.keys(setObj).length) engine.synth.set(setObj);

      engine.intensityGain.gain.rampTo(ev.intensity, 0.01);
      if (ev.vowel) engine.setVowel(ev.vowel);
      engine.synth.volume.rampTo(ev.volume, 0.01);
      engine.synth.triggerAttackRelease(ev.freq, ev.dur, time);
    }, events).start(0);
    currentPart.loop = false;
  }

  function clearPart() {
    if (currentPart) { currentPart.dispose(); currentPart = null; }
  }

  function timeToBeats(t) {
    if (typeof t === 'number') return t;
    var parts = String(t).split(':').map(Number);
    return parts[0] * 4 + parts[1] + (parts[2] || 0) * 0.25;
  }

  // === 钢琴窗工具 ===
  function bindPianoRollTools() {
    q('#btn-tool-select').addEventListener('click', function() { setTool('select'); });
    q('#btn-tool-draw').addEventListener('click', function() { setTool('draw'); });
    q('#btn-tool-eraser').addEventListener('click', function() { setTool('eraser'); });
    q('#btn-quantize').addEventListener('click', function() { pianoRoll.quantize(); });
  }

  function setTool(tool) {
    pianoRoll.tool = tool;
    q('#btn-tool-select').classList.toggle('active', tool === 'select');
    q('#btn-tool-draw').classList.toggle('active', tool === 'draw');
    q('#btn-tool-eraser').classList.toggle('active', tool === 'eraser');
    scheduleSave();
  }

  function bindSnap() {
    q('#snap-select').addEventListener('change', function() {
      pianoRoll.snapValue = this.value;
      scheduleSave();
    });
    q('#btn-snap-grid').addEventListener('click', function() {
      pianoRoll.gridOn = !pianoRoll.gridOn;
      this.classList.toggle('active', pianoRoll.gridOn);
      pianoRoll.render();
      scheduleSave();
    });
    q('#btn-snap-grid').classList.add('active');
  }

  function bindZoom() {
    q('#btn-zoom-in').addEventListener('click', function() {
      pianoRoll.zoom = Math.min(4, pianoRoll.zoom * 1.25);
      pianoRoll._resize();
      pianoRoll.render();
      pianoRoll._renderRuler();
      q('#zoom-label').textContent = pianoRoll.zoom.toFixed(2) + 'x';
      scheduleSave();
    });
    q('#btn-zoom-out').addEventListener('click', function() {
      pianoRoll.zoom = Math.max(0.25, pianoRoll.zoom / 1.25);
      pianoRoll._resize();
      pianoRoll.render();
      pianoRoll._renderRuler();
      q('#zoom-label').textContent = pianoRoll.zoom.toFixed(2) + 'x';
      scheduleSave();
    });
  }

  function bindDeleteSelected() {
    q('#btn-delete-selected').addEventListener('click', function() {
      pianoRoll.deleteSelected();
    });
  }

  // === 元音控制 ===
  function bindVowelControls() {
    var btns = qa('#formant-simple .vowel-btn');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        btns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        engine.setVowel(this.dataset.vowel);
        scheduleSave();
      });
    });
    // 高级模式滑块
    var sliderIds = ['f1-knob','f2-knob','f3-knob','q-knob','mix-knob'];
    sliderIds.forEach(function(id) {
      var sl = q('#' + id);
      if (!sl) return;
      var defaultVal = parseFloat(sl.value);
      sl.addEventListener('input', updateFormantAdvanced);
      // 重置按钮
      var resetBtn = document.createElement('button');
      resetBtn.className = 'reset-btn';
      resetBtn.title = '重置';
      resetBtn.textContent = '↺';
      resetBtn.addEventListener('click', function() {
        sl.value = defaultVal;
        updateFormantAdvanced();
      });
      sl.insertAdjacentElement('afterend', resetBtn);
      // 包裹为 flex 行
      var row = document.createElement('div');
      row.className = 'slider-row';
      sl.parentNode.insertBefore(row, sl);
      row.appendChild(sl);
      row.appendChild(resetBtn);
    });
    // 共振峰数值输入框联动
    var valInputIds = ['val-f1','val-f2','val-f3','val-q','val-mix'];
    valInputIds.forEach(function(inpId) {
      var inp = q('#' + inpId);
      if (!inp) return;
      inp.addEventListener('input', function() {
        var v = parseFloat(this.value);
        if (isNaN(v)) return;
        var min = parseFloat(this.min), max = parseFloat(this.max);
        v = Math.max(min, Math.min(max, v));
        this.value = v;
        var sliderId = inpId.replace('val-', '') + '-knob';
        var sl = q('#' + sliderId);
        if (sl) { sl.value = v; sl.dispatchEvent(new Event('input')); }
      });
    });
  }

  function updateFormantAdvanced() {
    var f1 = parseInt(q('#f1-knob').value);
    var f2 = parseInt(q('#f2-knob').value);
    var f3 = parseInt(q('#f3-knob').value);
    var qv = parseFloat(q('#q-knob').value);
    var mix = parseInt(q('#mix-knob').value);
    q('#val-f1').value = f1;
    q('#val-f2').value = f2;
    q('#val-f3').value = f3;
    q('#val-q').value = qv.toFixed(1);
    q('#val-mix').value = mix;
    engine.setFormantAdvanced(f1, f2, f3, qv, mix);
    scheduleSave();
  }

  function bindFormantMode() {
    q('#btn-formant-mode').addEventListener('click', function() {
      isFormantAdvanced = !isFormantAdvanced;
      q('#formant-simple').classList.toggle('active', !isFormantAdvanced);
      q('#formant-advanced').classList.toggle('active', isFormantAdvanced);
      this.textContent = I18N.t(isFormantAdvanced ? 'formant.simple' : 'formant.advanced');
      scheduleSave();
    });
  }

  // === 载波控制 ===
  function bindCarrierControls() {
    qa('#carrier-section .wave-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        qa('#carrier-section .wave-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        engine.setCarrierWave(this.dataset.wave);
        scheduleSave();
      });
    });
    bindSlider('porta-knob', 'val-porta', function(v) { engine.setPortamento(v); scheduleSave(); }, 's');
    bindSlider('attack-knob', 'val-attack', function(v) { engine.setEnvelope(v, engine.release); scheduleSave(); }, 's');
    bindSlider('release-knob', 'val-release', function(v) { engine.setEnvelope(engine.attack, v); scheduleSave(); }, 's');
    bindSlider('volume-knob', 'val-volume', function(v) { engine.setVolume(v); scheduleSave(); }, 'dB');
    bindSlider('intensity-knob', 'val-intensity', function(v) { engine.setDefaultIntensity(v / 100); scheduleSave(); }, '%');
  }

  function bindSlider(sliderId, inputId, callback, unit) {
    var sl = q('#' + sliderId);
    var inp = q('#' + inputId);
    if (!sl || !inp) return;
    var defaultVal = parseFloat(sl.value);
    sl.addEventListener('input', function() {
      var v = parseFloat(this.value);
      inp.value = v;
      callback(v);
    });
    // 重置按钮
    var resetBtn = document.createElement('button');
    resetBtn.className = 'reset-btn';
    resetBtn.title = '重置';
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', function() {
      sl.value = defaultVal;
      inp.value = defaultVal;
      callback(defaultVal);
    });
    sl.insertAdjacentElement('afterend', resetBtn);
    // 包裹为 flex 行
    var row = document.createElement('div');
    row.className = 'slider-row';
    sl.parentNode.insertBefore(row, sl);
    row.appendChild(sl);
    row.appendChild(resetBtn);
    inp.addEventListener('input', function() {
      var v = parseFloat(this.value);
      if (isNaN(v)) return;
      var min = parseFloat(this.min), max = parseFloat(this.max);
      v = Math.max(min, Math.min(max, v));
      this.value = v;
      sl.value = v;
      callback(v);
    });
  }

  // === 音色预设 ===
  function bindPresetControls() {
    qa('#preset-section .preset-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        qa('#preset-section .preset-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        engine.applyPreset(this.dataset.preset);
        scheduleSave();
      });
    });
  }

  // === 项目管理 ===
  function bindProjectControls() {
    q('#btn-save').addEventListener('click', saveProject);
    q('#btn-load').addEventListener('click', showLoadDialog);
    q('#btn-export-audio').addEventListener('click', exportAudio);
  }

  function saveProject() {
    var name = prompt(I18N.t('project.prompt-save-name'), I18N.t('project.default-name'));
    if (!name) return;
    var project = {
      id: currentProjectId || undefined,
      name: name,
      tracks: tracks.map(function(t) { return { name: t.name, color: t.color, notes: t.notes.slice() }; }),
      bpm: engine.bpm,
      createdAt: Date.now()
    };
    Storage.saveProject(project).then(function(id) {
      currentProjectId = id;
      q('#status-text').textContent = I18N.t('status.saved', { name: name });
    }).catch(console.error);
  }

  function showLoadDialog() {
    Storage.listProjects().then(function(projects) {
      if (projects.length === 0) { alert(I18N.t('alert.no-projects')); return; }
      var list = projects.map(function(p, i) {
        return (i+1) + '. ' + p.name + ' (' + new Date(p.updatedAt).toLocaleString() + ')';
      }).join('\n');
      var idx = prompt(I18N.t('project.prompt-load') + '\n' + list);
      if (idx && projects[parseInt(idx)-1]) {
        loadProject(projects[parseInt(idx)-1]);
      }
    });
  }

  function loadProject(project) {
    tracks = project.tracks.map(function(t) { return { name: t.name, color: t.color, notes: t.notes.slice() }; });
    currentProjectId = project.id;
    engine.setBPM(project.bpm || 120);
    q('#bpm-input').value = project.bpm || 120;
    refreshTrackSelect();
    switchTrack(0);
    q('#status-text').textContent = I18N.t('status.loaded', { name: project.name });
    scheduleSave();
  }

  function exportAudio() {
    q('#status-text').textContent = I18N.t('status.init-audio');
    engine.init().then(function() {
      hideStartupOverlay();
      var t = tracks[currentTrackIndex];
      if (!t || !t.notes || t.notes.length === 0) {
        q('#status-text').textContent = I18N.t('status.no-notes');
        return;
      }

      var bpm = engine.bpm;
      var beatToSec = 60 / bpm;
      var events = [];
      var maxEndSec = 0;
      t.notes.forEach(function(note) {
        var beat = timeToBeats(note.time);
        var durBeats = timeToBeats(note.duration);
        var startSec = beat * beatToSec;
        var durSec = durBeats * beatToSec;
        var endSec = startSec + durSec;
        if (endSec > maxEndSec) maxEndSec = endSec;
        events.push({
          time: startSec,
          freq: Tone.Frequency(note.midi, 'midi').toFrequency(),
          dur: durSec
        });
      });
      var duration = Math.max(maxEndSec + 0.5, 2);

      q('#status-text').textContent = I18N.t('status.rendering');

      var vowel = engine.currentVowel;
      var carrierWave = engine.carrierWave;
      var portamento = engine.portamento;
      var att = engine.attack;
      var rel = engine.release;
      var vol = engine.volume;
      var qVal = engine.currentQ || 5;

      Tone.Offline(function() {
        var synth = new Tone.PolySynth(Tone.MonoSynth, {
          maxPolyphony: 8,
          voice: Tone.MonoSynth,
          options: {
            oscillator: { type: carrierWave },
            envelope: { attack: att, release: rel },
            portamento: portamento
          }
        });

        var output = new Tone.Channel(vol);

        if (vowel !== 'bypass') {
          var p = TalkboxStudio.VOWEL_PRESETS[vowel];
          if (p) {
            var f1 = new Tone.BiquadFilter({ type: 'bandpass', frequency: p.f1, Q: qVal });
            var f2 = new Tone.BiquadFilter({ type: 'bandpass', frequency: p.f2, Q: qVal });
            var f3 = new Tone.BiquadFilter({ type: 'bandpass', frequency: p.f3, Q: qVal });
            f1.connect(f2);
            f2.connect(f3);
            f3.toDestination();
            output.connect(f1);
          } else {
            output.toDestination();
          }
        } else {
          output.toDestination();
        }

        synth.connect(output);

        events.forEach(function(ev) {
          synth.triggerAttackRelease(ev.freq, ev.dur, ev.time);
        });

      }, duration).then(function(buffer) {
        var wav = audioBufferToWav(buffer);
        var blob = new Blob([wav], { type: 'audio/wav' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'talkbox_export.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
        q('#status-text').textContent = I18N.t('status.export-done');
      }).catch(function(e) {
        console.error(I18N.t('status.export-fail'), e);
        q('#status-text').textContent = I18N.t('status.export-fail') + ': ' + e.message;
      });

    }).catch(function(e) {
      console.error(e);
      q('#status-text').textContent = I18N.t('status.init-fail') + ': ' + e.message;
    });
  }

  // === MIDI 导入 ===
  function bindMidiImport() {
    var dialog    = q('#midi-dialog');
    var input     = q('#midi-file-input');
    var dropZone  = q('#midi-drop-zone');
    var closeBtn  = q('.dialog-close');
    var copyBtn   = q('#btn-copy-prompt');

    // 打开浮层
    q('#btn-midi-import').addEventListener('click', function() {
      dialog.classList.remove('hidden');
    });

    // 关闭浮层
    closeBtn.addEventListener('click', function() {
      dialog.classList.add('hidden');
    });
    dialog.addEventListener('click', function(e) {
      if (e.target === dialog) dialog.classList.add('hidden');
    });

    // 复制提示词
    copyBtn.addEventListener('click', function() {
      var text = q('#prompt-text').textContent;
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.textContent = I18N.t('midi.copied');
        copyBtn.classList.add('copied');
        setTimeout(function() {
          copyBtn.textContent = I18N.t('midi.copy');
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });

    // 拖拽导入
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) processMidiFile(file);
    });
    dropZone.addEventListener('click', function() {
      input.click();
    });

    // 文件选择导入
    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) processMidiFile(file);
      input.value = '';
    });

    function processMidiFile(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var notes = MidiImport.parse(ev.target.result);
          pianoRoll.autoResize(notes);
          pianoRoll.setNotes(notes);
          tracks[currentTrackIndex].notes = notes.slice();
          q('#status-text').textContent = I18N.t('status.imported', { n: notes.length });
          dialog.classList.add('hidden');
          scheduleSave();
        } catch(err) {
          alert(I18N.t('alert.midi-parse') + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // 钢琴窗区域拖拽导入 MIDI
    var pianoWrap = q('#piano-roll-wrap');
    pianoWrap.addEventListener('dragover', function(e) {
      var hasMidi = e.dataTransfer.types.indexOf('Files') !== -1;
      if (!hasMidi) return;
      e.preventDefault();
      e.stopPropagation();
      pianoWrap.classList.add('midi-drag-over');
    });
    pianoWrap.addEventListener('dragleave', function(e) {
      pianoWrap.classList.remove('midi-drag-over');
    });
    pianoWrap.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      pianoWrap.classList.remove('midi-drag-over');
      var file = e.dataTransfer.files[0];
      if (file && /\.midi?$/i.test(file.name)) processMidiFile(file);
    });
  }

  // === 轨道管理 ===
  function bindTrackControls() {
    q('#btn-add-track').addEventListener('click', function() {
      var colors = ['#e94560','#2196f3','#4caf50','#ff9800','#9c27b0','#00bcd4','#ffeb3b','#795548'];
      var idx = tracks.length;
      tracks.push({ name: 'Track ' + (idx+1), color: colors[idx % colors.length], notes: [] });
      refreshTrackSelect();
      switchTrack(idx);
      scheduleSave();
    });
    q('#btn-del-track').addEventListener('click', function() {
      if (tracks.length <= 1) return;
      tracks.splice(currentTrackIndex, 1);
      refreshTrackSelect();
      switchTrack(Math.min(currentTrackIndex, tracks.length - 1));
      scheduleSave();
    });
    q('#track-select').addEventListener('click', function(e) {
      var container = this;
      if (e.target.closest('.track-option')) return; // 选项点击由 refreshTrackSelect 中的事件处理
      e.stopPropagation();
      container.classList.toggle('open');
    });
    // 轨道颜色已整合到 bindTheme() 中使用色块选择器
  }

  function bindReset() {
    var btn = q('#btn-reset');
    var menu = q('.reset-dropdown');

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', function() {
      menu.classList.remove('open');
    });

    menu.querySelectorAll('.reset-option').forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        menu.classList.remove('open');
        var action = this.dataset.action;
        var msg = action === 'all'
          ? I18N.t('confirm.reset-all', { n: tracks.length })
          : I18N.t('confirm.reset-current', { name: tracks[currentTrackIndex].name });
        if (confirm(msg)) {
          if (action === 'all') resetAllTracks();
          else resetCurrentTrack();
        }
      });
    });
  }

  function resetCurrentTrack() {
    pianoRoll.reset();
    q('#zoom-label').textContent = '1x';
    tracks[currentTrackIndex].notes = [];
    scheduleSave();
  }

  function resetAllTracks() {
    tracks = [{ name: 'Track 1', color: '#e94560', notes: [] }];
    pianoRoll.reset();
    q('#zoom-label').textContent = '1x';
    refreshTrackSelect();
    switchTrack(0);
    scheduleSave();
  }

  // === 语言切换 ===
  function bindLangToggle() {
    q('#btn-lang').addEventListener('click', function() {
      var next = I18N.current === 'zh-CN' ? 'en' : 'zh-CN';
      I18N.setLang(next);
      // 更新动态元素
      updateDynamicI18n();
    });
    // 监听 i18n 切换事件（从其他入口触发时同步）
    document.addEventListener('i18n-changed', function() {
      updateDynamicI18n();
    });
  }

  function updateDynamicI18n() {
    // 状态栏
    q('#status-text').textContent = I18N.t('status.ready');
    // 共振峰模式按钮
    var modeBtn = q('#btn-formant-mode');
    modeBtn.textContent = I18N.t(q('#formant-advanced').classList.contains('active') ? 'formant.simple' : 'formant.advanced');
    // 复制按钮重置
    var copyBtn = q('#btn-copy-prompt');
    if (!copyBtn.classList.contains('copied')) copyBtn.textContent = I18N.t('midi.copy');
    // 主题 header
    q('#theme-header-text').textContent = I18N.t('theme.header');
    // 主题自定义标签
    q('#theme-custom-picker').previousElementSibling.textContent = I18N.t('theme.custom');
  }

  function refreshTrackSelect() {
    var container = q('#track-select');
    var trigger = container.querySelector('.track-select-trigger');
    var menu = container.querySelector('.track-select-menu');
    var dot = trigger.querySelector('.track-color-dot');
    var nameSpan = trigger.querySelector('.track-name');
    // 更新触发器显示当前轨道
    var cur = tracks[currentTrackIndex];
    dot.style.background = cur.color;
    nameSpan.textContent = cur.name;
    // 清空并重建菜单
    menu.innerHTML = '';
    tracks.forEach(function(t, i) {
      var btn = document.createElement('button');
      btn.className = 'track-option' + (i === currentTrackIndex ? ' active' : '');
      btn.dataset.index = i;
      btn.innerHTML = '<span class="dot" style="background:' + t.color + '"></span>' + t.name;
      btn.addEventListener('click', function() {
        switchTrack(i);
        container.classList.remove('open');
      });
      menu.appendChild(btn);
    });
  }

  function switchTrack(idx) {
    currentTrackIndex = idx;
    var t = tracks[idx];
    if (!t) return;
    var container = q('#track-select');
    container.querySelector('.track-color-dot').style.background = t.color;
    container.querySelector('.track-name').textContent = t.name;
    container.querySelectorAll('.track-option').forEach(function(btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.index) === idx);
    });
    pianoRoll.setNotes(t.notes.slice());
    pianoRoll.setTrackColor(t.color);
    q('#btn-track-color').style.background = t.color;
  }

  // === 键盘快捷键 ===
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('#track-select')) return;
    if (e.code === 'Space') { e.preventDefault(); handlePlay(); }
    else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleRecord(); }
    else if (e.code === 'KeyD') { e.preventDefault(); setTool('draw'); }
    else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTool('select'); }
    else if (e.code === 'KeyE') { e.preventDefault(); setTool('eraser'); }
    else if (e.code === 'KeyQ') { e.preventDefault(); pianoRoll.quantize(); }
    else if (e.code === 'Delete' || e.code === 'Backspace') { pianoRoll.deleteSelected(); }
    else if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); saveProject(); }
    else if (e.ctrlKey && e.code === 'KeyN') { e.preventDefault(); newProject(); }
    else if (e.code === 'KeyM') { e.preventDefault(); handleMetronome(); }
  });

  // === 快捷键面板 ===
  (function() {
    var btn = document.getElementById('btn-shortcuts');
    var panel = document.getElementById('shortcuts-panel');
    if (!btn || !panel) return;

    btn.classList.add('active');

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      btn.classList.toggle('active', !panel.classList.contains('hidden'));
    });
  })();

  // === 教程系统 ===
  // === 启动引导：强制点击钢琴窗初始化音频引擎 ===
  function showStartupOverlay() {
    if (engine._initialized) return;

    var container = q('#piano-roll-container');
    if (document.getElementById('startup-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'startup-overlay';
    overlay.innerHTML =
      '<div class="startup-glass">' +
        '<div class="startup-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
          '</svg>' +
        '</div>' +
        '<div class="startup-title">启动音频引擎</div>' +
        '<div class="startup-hint">点击钢琴窗任意位置开始</div>' +
        '<div class="startup-pulse-ring"></div>' +
      '</div>';
    container.appendChild(overlay);

    overlay.addEventListener('click', async function handler(e) {
      e.stopPropagation();
      e.preventDefault();
      overlay.removeEventListener('click', handler);

      try {
        await engine.init();
        console.log('[Tutorial] engine init done, _initialized:', engine._initialized);
        if (engine._initialized) {
          q('#status-text').textContent = '就绪';
          hideStartupOverlay();
          if (!localStorage.getItem('talkbox_tutorial_seen')) {
            console.log('[Tutorial] scheduling showTutorial in 500ms');
            setTimeout(function() { showTutorial(); }, 500);
          }
        } else {
          showStartupError('音频引擎初始化异常，请刷新页面重试');
        }
      } catch (err) {
        console.error('[Tutorial] engine init failed:', err);
        showStartupError('音频引擎启动失败: ' + (err.message || '未知错误') + '，请刷新页面重试');
      }
    });
  }

  function hideStartupOverlay() {
    var overlay = document.getElementById('startup-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 400);
    }
  }

  function showStartupError(msg) {
    var overlay = document.getElementById('startup-overlay');
    if (!overlay) return;
    var glass = overlay.querySelector('.startup-glass');
    if (glass) {
      glass.classList.add('error');
      glass.innerHTML =
        '<div class="startup-icon" style="color:#e94560">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' +
          '</svg>' +
        '</div>' +
        '<div class="startup-title" style="color:#e94560">启动失败</div>' +
        '<div class="startup-hint" style="font-size:12px;max-width:280px;white-space:normal">' + msg + '</div>';
      // 点击可重试
      overlay.addEventListener('click', function retry() {
        location.reload();
      }, { once: true });
    }
    q('#status-text').textContent = '初始化失败';
  }

  // === 教程引导 ===
  var tutorialActive = false;
  var tutorialStep = 0;
  var tutorialSteps = [
    {
      selector: '#left-panel',
      title: '① 选择元音与精细调节',
      text: '点击元音按钮改变音色。每个参数旁的 ? 图标可查看说明，滑块支持一键 ↺ 重置为默认值，数值框可直接键入。',
      position: 'right'
    },
    {
      selector: '#btn-play',
      title: '② 播放试听',
      text: '点击播放按钮试听你的创作。可以随时按 Space 键播放/暂停。',
      position: 'bottom'
    },
    {
      selector: '#btn-theme',
      title: '③ 自定义主题色',
      text: '点击工具栏圆形色块按钮，可选择 8 种预设主题色或使用拾色器自定义界面配色，设置自动保存。',
      position: 'bottom'
    },
    {
      selector: '#btn-midi-import',
      title: '④ 导入 MIDI 文件',
      text: '拖拽 .mid 文件或点击按钮导入。浮层内附 AI 提示词，可复制到 ChatGPT/Claude 中生成 Talkbox 适配的 MIDI。',
      position: 'bottom'
    },
    {
      selector: '#bpm-input',
      title: '⑤ 调整速度',
      text: '修改 BPM 值来改变整体节奏速度。默认 120 BPM，适合大多数风格。',
      position: 'bottom'
    },
    {
      selector: '#btn-export-audio',
      title: '⑥ 导出音频',
      text: '完成后点击导出按钮，将作品保存为 WAV 音频文件，分享给朋友或导入其他软件。',
      position: 'bottom'
    }
  ];

  function createTutorialDOM() {
    if (document.getElementById('tutorial-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML =
      '<div id="tutorial-backdrop"></div>' +
      '<div id="tutorial-spotlight"></div>' +
      '<div id="tutorial-tooltip">' +
        '<h3></h3>' +
        '<p></p>' +
        '<div id="tutorial-dots"></div>' +
        '<div id="tutorial-buttons">' +
          '<button class="tutorial-btn skip" id="tutorial-skip">跳过教程</button>' +
          '<button class="tutorial-btn primary" id="tutorial-next">下一步</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('tutorial-skip').addEventListener('click', hideTutorial);
    document.getElementById('tutorial-next').addEventListener('click', nextTutorialStep);

    // 生成步骤指示点
    var dotsEl = document.getElementById('tutorial-dots');
    for (var i = 0; i < tutorialSteps.length; i++) {
      var dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === 0 ? ' active' : '');
      dot.dataset.index = i;
      dotsEl.appendChild(dot);
    }
  }

  function showTutorial() {
    console.log('[Tutorial] showTutorial called, active:', tutorialActive);
    if (tutorialActive) return;
    try {
      createTutorialDOM();
      console.log('[Tutorial] DOM created, overlay in DOM:', !!document.getElementById('tutorial-overlay'));
      tutorialStep = 0;
      tutorialActive = true;
      document.getElementById('tutorial-overlay').classList.add('active');
      console.log('[Tutorial] active class added');
      updateTutorialStep();
      console.log('[Tutorial] step updated, step:', tutorialStep);
      localStorage.setItem('talkbox_tutorial_seen', '1');
    } catch (e) {
      console.error('[Tutorial] showTutorial error:', e);
      tutorialActive = false;
    }
  }

  function hideTutorial() {
    tutorialActive = false;
    var overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function nextTutorialStep() {
    tutorialStep++;
    if (tutorialStep >= tutorialSteps.length) {
      hideTutorial();
      return;
    }
    updateTutorialStep();
  }

  function updateTutorialStep() {
    var step = tutorialSteps[tutorialStep];
    var target = document.querySelector(step.selector);
    if (!target) {
      console.warn('[Tutorial] target not found:', step.selector);
      hideTutorial();
      return;
    }
    console.log('[Tutorial] target found:', step.selector, 'rect:', target.getBoundingClientRect());

    var tooltip = document.getElementById('tutorial-tooltip');
    var spotlight = document.getElementById('tutorial-spotlight');

    // 更新指示点
    var dots = document.querySelectorAll('#tutorial-dots .tutorial-dot');
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === tutorialStep);
    });

    // 更新文字
    tooltip.querySelector('h3').textContent = step.title;
    tooltip.querySelector('p').textContent = step.text;

    // 更新按钮文字
    var nextBtn = document.getElementById('tutorial-next');
    if (tutorialStep === tutorialSteps.length - 1) {
      nextBtn.textContent = '完成';
    } else {
      nextBtn.textContent = '下一步';
    }

    // 先将 tooltip 移到屏幕外以触发重排、获取准确尺寸
    tooltip.style.left = '-9999px';
    tooltip.style.top = '-9999px';

    // 更新聚光灯位置
    var rect = target.getBoundingClientRect();
    var pad = 6;
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    // 使用 requestAnimationFrame 等待浏览器完成重排后再定位
    requestAnimationFrame(function() {
      var tooltipRect = tooltip.getBoundingClientRect();
      var tLeft, tTop;
      var gap = 18;

      switch (step.position) {
        case 'center':
          tLeft = (window.innerWidth - tooltipRect.width) / 2;
          tTop = rect.bottom + gap;
          if (tTop + tooltipRect.height > window.innerHeight) {
            tTop = rect.top - tooltipRect.height - gap;
          }
          break;
        case 'right':
          tLeft = rect.right + gap;
          tTop = rect.top + (rect.height - tooltipRect.height) / 2;
          if (tLeft + tooltipRect.width > window.innerWidth) {
            tLeft = rect.left - tooltipRect.width - gap;
          }
          tTop = Math.max(gap, Math.min(tTop, window.innerHeight - tooltipRect.height - gap));
          break;
        case 'bottom':
        default:
          tLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
          tTop = rect.bottom + gap;
          if (tTop + tooltipRect.height > window.innerHeight) {
            tTop = rect.top - tooltipRect.height - gap;
          }
          tLeft = Math.max(gap, Math.min(tLeft, window.innerWidth - tooltipRect.width - gap));
          break;
      }

      tooltip.style.left = tLeft + 'px';
      tooltip.style.top = tTop + 'px';
    });
  }

  // 监听窗口 resize 更新教程位置
  window.addEventListener('resize', function() {
    if (tutorialActive) updateTutorialStep();
  });

  function newProject() {
    tracks = [{ name: 'Track 1', color: '#e94560', notes: [] }];
    currentProjectId = null;
    pianoRoll.clear();
    refreshTrackSelect();
    switchTrack(0);
    q('#status-text').textContent = '新项目';
    try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
  }

  /* ============================================================
     Help Tooltips – JS‑driven position:fixed to avoid overflow clipping
     ============================================================ */
  function bindHelpTooltips() {
    var tip = document.createElement('div');
    tip.className = 'help-tooltip';
    document.body.appendChild(tip);

    var currentIcon = null;
    var hideTimer = null;

    function show(e) {
      currentIcon = e.currentTarget;
      clearTimeout(hideTimer);
      var text = currentIcon.getAttribute('data-tip');
      if (!text) return;
      tip.textContent = text;
      tip.classList.add('visible');

      // Force layout then read dimensions
      var tipW = tip.offsetWidth;
      var tipH = tip.offsetHeight;

      var iconRect = currentIcon.getBoundingClientRect();
      var spaceAbove = iconRect.top - 8;
      var spaceBelow = window.innerHeight - iconRect.bottom - 8;

      var top;
      if (spaceAbove >= tipH + 4 || spaceAbove >= spaceBelow) {
        top = iconRect.top - tipH - 6;
      } else {
        top = iconRect.bottom + 6;
      }

      var left = iconRect.left + iconRect.width / 2 - tipW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
    }

    function hide() {
      hideTimer = setTimeout(function() {
        tip.classList.remove('visible');
        currentIcon = null;
      }, 120);
    }

    function keep() {
      clearTimeout(hideTimer);
    }

    document.addEventListener('mouseover', function(e) {
      var icon = e.target.closest('.help-icon');
      if (icon) show({ currentTarget: icon });
    }, true);

    document.addEventListener('mouseout', function(e) {
      var icon = e.target.closest('.help-icon');
      if (icon) hide();
    }, true);

    tip.addEventListener('mouseenter', keep);
    tip.addEventListener('mouseleave', hide);
  }

  /* ============================================================
     Theme – accent color switcher
     ============================================================ */
  function bindTheme() {
    var btnTheme = q('#btn-theme');
    var btnTrackColor = q('#btn-track-color');
    var popover = q('#theme-popover');
    var swatchesBox = q('#theme-swatches');
    var customPicker = q('#theme-custom-picker');
    var root = document.documentElement;
    var STORAGE_KEY = 'talkbox-accent';
    var target = 'accent';

    function applyAccent(hex) {
      root.style.setProperty('--accent', hex);
      localStorage.setItem(STORAGE_KEY, hex);
      customPicker.value = hex;
      updateSwatchActive(hex);
      btnTheme.style.background = hex;
    }

    function applyTrackColor(hex) {
      tracks[currentTrackIndex].color = hex;
      pianoRoll.setTrackColor(hex);
      btnTrackColor.style.background = hex;
      scheduleSave();
    }

    function updateSwatchActive(hex) {
      var swatches = swatchesBox.querySelectorAll('.theme-swatch');
      swatches.forEach(function(s) {
        s.classList.toggle('active', s.dataset.color === hex);
      });
    }

    function showPopover(triggerBtn, mode) {
      target = mode;
      var rect = triggerBtn.getBoundingClientRect();
      popover.style.top = (rect.bottom + 6) + 'px';
      popover.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
      popover.style.right = 'auto';

      var headerText = q('#theme-header-text');
      var dot = q('#theme-dot-indicator');
      if (mode === 'track') {
        headerText.textContent = '轨道颜色';
        dot.style.background = tracks[currentTrackIndex].color;
        dot.style.display = 'inline-block';
        customPicker.value = tracks[currentTrackIndex].color;
        updateSwatchActive(tracks[currentTrackIndex].color);
      } else {
        headerText.textContent = '主题色';
        dot.style.background = getComputedStyle(root).getPropertyValue('--accent').trim();
        dot.style.display = 'inline-block';
      }
      popover.classList.remove('hidden');
    }

    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyAccent(saved);

    btnTheme.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!popover.classList.contains('hidden') && target === 'accent') {
        popover.classList.add('hidden');
      } else {
        showPopover(btnTheme, 'accent');
      }
    });

    btnTrackColor.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!popover.classList.contains('hidden') && target === 'track') {
        popover.classList.add('hidden');
      } else {
        showPopover(btnTrackColor, 'track');
      }
    });

    document.addEventListener('click', function(e) {
      if (!popover.classList.contains('hidden') && !popover.contains(e.target) && e.target !== btnTheme && e.target !== btnTrackColor) {
        popover.classList.add('hidden');
      }
    });

    swatchesBox.addEventListener('click', function(e) {
      var sw = e.target.closest('.theme-swatch');
      if (!sw) return;
      if (target === 'track') {
        applyTrackColor(sw.dataset.color);
      } else {
        applyAccent(sw.dataset.color);
      }
    });

    customPicker.addEventListener('input', function() {
      if (target === 'track') {
        applyTrackColor(customPicker.value);
      } else {
        applyAccent(customPicker.value);
      }
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* 将 AudioBuffer 转换为 WAV ArrayBuffer */
function audioBufferToWav(buffer) {
  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = 1; // PCM
  var bitDepth = 16;
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;
  var data = buffer.getChannelData(0);
  var dataLength = data.length * bytesPerSample;
  var headerLength = 44;
  var totalLength = headerLength + dataLength;
  var arrayBuffer = new ArrayBuffer(totalLength);
  var view = new DataView(arrayBuffer);

  function writeString(view, offset, str) {
    for (var i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  var offset = 44;
  for (var i = 0; i < data.length; i++) {
    var sample = Math.max(-1, Math.min(1, data[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return arrayBuffer;
}