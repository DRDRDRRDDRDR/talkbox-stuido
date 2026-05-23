/**
 * midi-import.js - SMF MIDI 文件解析器
 */
window.TalkboxStudio = window.TalkboxStudio || {};

(function() {
  TalkboxStudio.MidiImport = {
    parse: function(arrayBuffer) {
      var dv = new DataView(arrayBuffer);
      var off = 0;
      function readStr(len) { var s=''; for(var i=0;i<len;i++) s+=String.fromCharCode(dv.getUint8(off+i)); off+=len; return s; }
      function readUint8() { return dv.getUint8(off++); }
      function readUint16() { var v=dv.getUint16(off); off+=2; return v; }
      function readUint32() { var v=dv.getUint32(off); off+=4; return v; }
      function readVarLen() { var v=0; var b; do{ b=readUint8(); v=(v<<7)|(b&0x7f); }while(b&0x80); return v; }

      var headerChunk = readStr(4);
      if (headerChunk !== 'MThd') throw new Error('不是标准 MIDI 文件');
      var headerLen = readUint32();
      var format = readUint16();
      var ntrks = readUint16();
      var division = readUint16();

      var allNotes = [];
      for (var t = 0; t < ntrks; t++) {
        var trackChunk = readStr(4);
        if (trackChunk !== 'MTrk') throw new Error('轨道 ' + t + ' 无效');
        var trackLen = readUint32();
        var trackEnd = off + trackLen;
        var ticksPerBeat = division & 0x7fff;
        var tempo = 500000;
        var absTick = 0;
        var lastStatus = 0;
        var noteOns = {};

        while (off < trackEnd) {
          var delta = readVarLen();
          absTick += delta;
          var status = readUint8();
          if (status < 0x80) { off--; status = lastStatus; }
          lastStatus = status;
          var cmd = status & 0xf0;
          if (cmd === 0x90) {
            var note = readUint8();
            var vel = readUint8();
            if (vel > 0) {
              noteOns[note] = { tick: absTick, vel: vel };
            } else {
              if (noteOns[note]) {
                var tickDuration = absTick - noteOns[note].tick;
                var beatStart = noteOns[note].tick / ticksPerBeat;
                var beatDuration = tickDuration / ticksPerBeat;
                if (beatDuration >= 0.001) {
                  allNotes.push({
                    midi: note,
                    time: beatToStr(beatStart),
                    duration: beatToStr(beatDuration),
                    velocity: noteOns[note].vel
                  });
                }
                delete noteOns[note];
              }
            }
          } else if (cmd === 0x80) {
            var note2 = readUint8(); readUint8();
            if (noteOns[note2]) {
              var tickDuration = absTick - noteOns[note2].tick;
              var beatStart = noteOns[note2].tick / ticksPerBeat;
              var beatDuration = tickDuration / ticksPerBeat;
              if (beatDuration >= 0.001) {
                allNotes.push({
                  midi: note2,
                  time: beatToStr(beatStart),
                  duration: beatToStr(beatDuration),
                  velocity: noteOns[note2].vel
                });
              }
              delete noteOns[note2];
            }
          } else if (cmd === 0xc0) { readUint8(); } // program change
          else if (cmd === 0xd0) { readUint8(); } // channel pressure
          else if (cmd === 0xe0) { readUint8(); readUint8(); } // pitch bend
          else if (cmd === 0xb0) {
            var cc = readUint8(); readUint8(); // CC
          } else if (status === 0xff) {
            var metaType = readUint8();
            var metaLen = readVarLen();
            if (metaType === 0x51 && metaLen === 3) {
              tempo = (readUint8()<<16)|(readUint8()<<8)|readUint8();
            } else {
              off += metaLen;
            }
          } else if (status === 0xf0 || status === 0xf7) { // SysEx
            var sysexLen = readVarLen();
            off += sysexLen;
          } else {
            // skip unknown
          }
        }
        off = trackEnd;
      }

      function beatToStr(beat) {
        var bars = Math.floor(beat / 4);
        var beats = Math.floor(beat % 4);
        var sixteenths = Math.round(((beat % 4) - beats) * 4);
        return bars + ':' + beats + ':' + sixteenths;
      }

      return allNotes.map(function(n) {
        return { id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), midi: n.midi, time: n.time, duration: n.duration };
      });
    }
  };
})();