/**
 * audio-engine.js - Talkbox 音频引擎 (基于 Tone.js)
 */
window.TalkboxStudio = window.TalkboxStudio || {};

// 元音共振峰预设 (F1, F2, F3 频率 Hz)
TalkboxStudio.VOWEL_PRESETS = {
  a:  { f1: 730,  f2: 1090, f3: 2440 },
  e:  { f1: 390,  f2: 2300, f3: 3010 },
  i:  { f1: 270,  f2: 2290, f3: 3010 },
  o:  { f1: 470,  f2: 840,  f3: 2610 },
  u:  { f1: 300,  f2: 870,  f3: 2240 },
  ae: { f1: 660,  f2: 1720, f3: 2410 },
  oo: { f1: 360,  f2: 880,  f3: 2630 },
  er: { f1: 490,  f2: 1350, f3: 1690 },
  bypass: { f1: 0, f2: 0, f3: 0 }
};

// 音色预设
TalkboxStudio.TIMBRE_PRESETS = {
  classic: { wave:'sawtooth', porta:0.05, attack:0.01, release:0.15, volume:-6 },
  bright:  { wave:'square',   porta:0.03, attack:0.01, release:0.08, volume:-8 },
  deep:    { wave:'triangle', porta:0.08, attack:0.02, release:0.25, volume:-4 },
  nasal:   { wave:'sawtooth', porta:0.02, attack:0.005, release:0.05, volume:-10 },
  robot:   { wave:'square',   porta:0,    attack:0.001, release:0.02, volume:-5 },
  warm:    { wave:'sawtooth', porta:0.06, attack:0.03, release:0.35, volume:-3 }
};

(function() {
  const VOWEL_PRESETS = TalkboxStudio.VOWEL_PRESETS;
  const TIMBRE_PRESETS = TalkboxStudio.TIMBRE_PRESETS;

  TalkboxStudio.AudioEngine = class {
    constructor() {
      this.synth = null;
      this.formantFilters = [];
      this.channel = null;
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.bpm = 120;
      this.currentVowel = 'bypass';
      this.carrierWave = 'sawtooth';
      this.portamento = 0.05;
      this.attack = 0.01;
      this.release = 0.2;
      this.volume = -6;
      this.isPlaying = false;
      this.isRecording = false;
      this.metronomeOn = false;
      this.currentQ = 2;
      this.defaultIntensity = 0.75;       // 0~1
      this._initialized = false;
      this._metronomeTick = null;
      this._callbacks = { onPlayStateChange: null, onRecordStateChange: null, onTimeUpdate: null };
    }

    async init() {
      if (this._initialized) return;
      await Tone.start();
      this._initialized = true;
      Tone.Transport.bpm.value = this.bpm;

      this.synth = new Tone.PolySynth(Tone.MonoSynth, {
        maxPolyphony: 8,
        voice: Tone.MonoSynth,
        options: {
          oscillator: { type: this.carrierWave },
          envelope: { attack: this.attack, release: this.release },
          portamento: this.portamento
        }
      });

      this.formantFilters = [
        new Tone.BiquadFilter({ type:'bandpass', frequency:500, Q:2 }),
        new Tone.BiquadFilter({ type:'bandpass', frequency:1500, Q:2 }),
        new Tone.BiquadFilter({ type:'bandpass', frequency:2500, Q:2 })
      ];

      this.dryGain = new Tone.Gain(0).toDestination();
      this.wetGain = new Tone.Gain(1).connect(this.formantFilters[0]);
      this.formantFilters[0].connect(this.formantFilters[1]);
      this.formantFilters[1].connect(this.formantFilters[2]);
      this.intensityGain = new Tone.Gain(this.defaultIntensity);
      this.formantFilters[2].connect(this.intensityGain);
      this.intensityGain.toDestination();

      this.channel = new Tone.Channel(this.volume).fan(this.dryGain, this.wetGain);
      this.synth.connect(this.channel);

      this.setVowel('bypass');

      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch(e) {
        console.warn('麦克风不可用:', e);
        this.micStream = null;
      }
    }

    setVowel(vowel) {
      this.currentVowel = vowel;
      const p = VOWEL_PRESETS[vowel];
      if (!p) return;
      if (vowel === 'bypass') {
        this.wetGain.gain.rampTo(0, 0.05);
        this.dryGain.gain.rampTo(1, 0.05);
      } else {
        this.wetGain.gain.rampTo(1, 0.05);
        this.dryGain.gain.rampTo(0, 0.05);
        this.formantFilters[0].frequency.rampTo(p.f1, 0.05);
        this.formantFilters[1].frequency.rampTo(p.f2, 0.05);
        this.formantFilters[2].frequency.rampTo(p.f3, 0.05);
      }
    }

    setFormantAdvanced(f1, f2, f3, q, mix) {
      this.currentQ = q;
      this.formantFilters[0].frequency.rampTo(f1, 0.05);
      this.formantFilters[1].frequency.rampTo(f2, 0.05);
      this.formantFilters[2].frequency.rampTo(f3, 0.05);
      this.formantFilters.forEach(function(f) { f.Q.rampTo(q, 0.05); });
      var wet = mix / 100;
      this.wetGain.gain.rampTo(wet, 0.05);
      this.dryGain.gain.rampTo(1 - wet, 0.05);
    }

    setCarrierWave(wave) {
      this.carrierWave = wave;
      this.synth.set({ oscillator: { type: wave } });
    }

    setPortamento(val) {
      this.portamento = val;
      this.synth.set({ portamento: val });
    }

    setEnvelope(attack, release) {
      this.attack = attack;
      this.release = release;
      this.synth.set({ envelope: { attack: attack, release: release } });
    }

    setVolume(db) {
      this.volume = db;
      this.channel.volume.rampTo(db, 0.05);
    }

    setDefaultIntensity(val) {
      this.defaultIntensity = val;
      if (this.intensityGain) this.intensityGain.gain.rampTo(val, 0.05);
    }

    setBPM(bpm) {
      this.bpm = bpm;
      Tone.Transport.bpm.value = bpm;
    }

    applyPreset(name) {
      var p = TIMBRE_PRESETS[name];
      if (!p) return;
      this.setCarrierWave(p.wave);
      this.setPortamento(p.porta);
      this.setEnvelope(p.attack, p.release);
      this.setVolume(p.volume);
    }

    play() {
      this.isPlaying = true;
      if (Tone.Transport.state === 'started') {
        // already running (should not happen), ignore
      } else if (Tone.Transport.state === 'paused') {
        Tone.Transport.start();
      } else {
        Tone.Transport.start();
      }
      if (this._callbacks.onPlayStateChange) this._callbacks.onPlayStateChange(true);
      this._startTimeTicker();
      if (this.metronomeOn) this._startMetronome();
    }

    stop() {
      this.isPlaying = false;
      Tone.Transport.stop();
      this.synth.releaseAll();
      if (this._callbacks.onPlayStateChange) this._callbacks.onPlayStateChange(false);
      this._stopTimeTicker();
      this._stopMetronome();
    }

    pause() {
      this.isPlaying = false;
      Tone.Transport.pause();
      if (this._callbacks.onPlayStateChange) this._callbacks.onPlayStateChange(false);
      this._stopTimeTicker();
      this._stopMetronome();
    }

    async startRecording() {
      if (!this.micStream) throw new Error('麦克风不可用');
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.micStream, { mimeType: 'audio/webm' });
      var self = this;
      this.mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) self.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      if (this._callbacks.onRecordStateChange) this._callbacks.onRecordStateChange(true);
      if (!this.isPlaying) this.play();
    }

    stopRecording() {
      var self = this;
      return new Promise(function(resolve) {
        if (!self.mediaRecorder) return resolve(null);
        self.mediaRecorder.onstop = function() {
          var blob = new Blob(self.recordedChunks, { type: 'audio/webm' });
          self.isRecording = false;
          if (self._callbacks.onRecordStateChange) self._callbacks.onRecordStateChange(false);
          resolve(blob);
        };
        self.mediaRecorder.stop();
        self.stop();
      });
    }

    previewNote(midi, duration) {
      duration = duration || '8n';
      var freq = Tone.Frequency(midi, 'midi').toFrequency();
      this.synth.triggerAttackRelease(freq, duration);
    }

    toggleMetronome() {
      this.metronomeOn = !this.metronomeOn;
      if (this.metronomeOn && this.isPlaying) this._startMetronome();
      else this._stopMetronome();
      return this.metronomeOn;
    }

    _startMetronome() {
      this._stopMetronome();
      var self = this;
      this._metronomeTick = Tone.Transport.scheduleRepeat(function(time) {
        new Tone.Oscillator(1000, 'sine').toDestination().start(time).stop(time + 0.02);
      }, '4n');
    }

    _stopMetronome() {
      if (this._metronomeTick) {
        Tone.Transport.clear(this._metronomeTick);
        this._metronomeTick = null;
      }
    }

    _startTimeTicker() {
      this._stopTimeTicker();
      var self = this;
      this._tickerId = setInterval(function() {
        if (self._callbacks.onTimeUpdate) self._callbacks.onTimeUpdate(Tone.Transport.seconds);
      }, 50);
    }

    _stopTimeTicker() {
      if (this._tickerId) { clearInterval(this._tickerId); this._tickerId = null; }
    }

    on(event, cb) {
      switch(event) {
        case 'playState': this._callbacks.onPlayStateChange = cb; break;
        case 'recordState': this._callbacks.onRecordStateChange = cb; break;
        case 'timeUpdate': this._callbacks.onTimeUpdate = cb; break;
      }
    }

    dispose() {
      this._stopTimeTicker();
      this._stopMetronome();
      if (this.synth) this.synth.dispose();
      this.formantFilters.forEach(function(f) { if (f) f.dispose(); });
      if (this.channel) this.channel.dispose();
      if (this.dryGain) this.dryGain.dispose();
      if (this.wetGain) this.wetGain.dispose();
    }
  };
})();