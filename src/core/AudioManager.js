// AudioManager: 100% procedural Web Audio. No audio files needed.
// - SFX synthesized on demand (noise buffers, oscillators, envelopes)
// - Music via a lookahead step sequencer with original patterns per intensity level.

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- ORIGINAL MUSIC PATTERNS (E minor / blues-rock energy) ----------------
// 16-step patterns. null = rest.
const TRACKS = {
  menu: {
    bpm: 92,
    bass: [40, null, 40, null, null, null, 43, null, 45, null, 45, null, 43, null, 40, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
  },
  explore: {
    bpm: 120,
    bass: [40, null, 40, null, 40, null, 40, null, 45, null, 45, null, 43, null, 40, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1]
  },
  encounter: {
    bpm: 134,
    bass: [40, null, 40, null, 40, null, 40, null, 45, null, 45, null, 43, null, 40, null],
    lead: [null, null, 64, null, 67, null, 64, null, null, null, 69, null, 67, 64, 62, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  herd: {
    bpm: 148,
    bass: [40, 40, 40, null, 40, 40, 43, null, 45, 45, 45, null, 43, 43, 40, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    kick:   [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  boss: {
    bpm: 156,
    bass: [40, 40, 40, 40, 40, 40, 43, 40, 45, 45, 45, 45, 43, 43, 47, 40],
    lead: [62, null, null, null, null, null, 59, null, 64, null, null, null, null, null, 62, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  victory: {
    bpm: 122,
    bass: [40, null, 48, null, 45, null, 43, null, 40, null, 48, null, 43, null, 47, null],
    lead: [64, null, 67, null, 69, null, 71, null, 74, null, 71, null, 69, 67, 64, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat:    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1]
  },
  gameover: {
    bpm: 74,
    bass: [40, null, null, null, null, null, 38, null, null, null, 36, null, null, null, 34, null],
    lead: [64, null, null, null, 62, null, null, null, 59, null, null, null, 55, null, null, null],
    kick:   [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    snare:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hat:    [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
  }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.options = { masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.9 };

    this.currentTrack = null;
    this._step = 0;
    this._nextNoteTime = 0;
    this._timer = null;
  }

  // Must be called from a user gesture (click/keydown) to satisfy autoplay policies.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return; // No audio support: game runs silently.
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 1 second of white noise for percussive SFX.
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.applyVolumes();
    } catch (e) {
      this.ctx = null; // graceful: no audio
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.options.masterVolume, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.options.musicVolume * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.options.sfxVolume, t, 0.05);
  }

  setOptions(opts) {
    Object.assign(this.options, opts);
    this.applyVolumes();
  }

  // ================= SFX HELPERS =================
  _env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  _osc(type, freq, t, dur, peak, dest, slideTo = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    this._env(g, t, peak, dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noise(t, dur, peak, filterType, freq, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, peak, dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.05);
  }

  _ready() { return !!this.ctx; }

  // ================= SFX =================
  shoot() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.14, 0.5, 'lowpass', 2600);
    this._osc('square', 190, t, 0.1, 0.35, null, 55);
    this._osc('sine', 90, t, 0.16, 0.5, null, 38);
  }

  dryFire() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.04, 0.25, 'highpass', 3000);
  }

  reloadStart() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.05, 0.3, 'bandpass', 1800, 4);
    this._osc('square', 220, t + 0.09, 0.05, 0.2);
  }

  reloadEnd() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.06, 0.35, 'bandpass', 2400, 5);
    this._osc('square', 330, t + 0.1, 0.06, 0.25);
    this._osc('square', 495, t + 0.18, 0.07, 0.2);
  }

  hit(head = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.09, 0.4, 'lowpass', head ? 1800 : 900);
    this._osc('sine', head ? 320 : 180, t, 0.1, 0.4, null, 60);
    if (head) this._osc('triangle', 720, t, 0.08, 0.25, null, 900);
  }

  kill() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.3, 0.45, 'lowpass', 700);
    this._osc('sawtooth', 160, t, 0.28, 0.3, null, 40);
    this._osc('square', 90, t + 0.05, 0.25, 0.3, null, 30);
  }

  grunt(intensity = 1) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const f = 70 + Math.random() * 40;
    this._osc('sawtooth', f, t, 0.28, 0.3 * intensity, null, f * 0.6);
    this._noise(t, 0.2, 0.15 * intensity, 'lowpass', 400);
  }

  chargeRoar() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 60, t, 0.7, 0.5, null, 130);
    this._osc('square', 45, t + 0.08, 0.6, 0.4, null, 90);
    this._noise(t, 0.6, 0.3, 'lowpass', 500);
  }

  hooves() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 110 + Math.random() * 40, t, 0.08, 0.35, null, 45);
    this._noise(t, 0.05, 0.2, 'lowpass', 300);
  }

  horn() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('square', 392, t, 0.28, 0.16);
    this._osc('square', 494, t, 0.28, 0.16);
  }

  explosion() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.7, 0.6, 'lowpass', 900);
    this._osc('sine', 120, t, 0.5, 0.6, null, 30);
  }

  obstacleBreak() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.25, 0.4, 'bandpass', 1200, 2);
    this._osc('triangle', 240, t, 0.18, 0.3, null, 90);
  }

  uiMove() {
    if (!this._ready()) return;
    this._osc('square', 660, this.ctx.currentTime, 0.05, 0.12);
  }

  uiSelect() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('square', 520, t, 0.07, 0.16);
    this._osc('square', 780, t + 0.07, 0.09, 0.16);
  }

  comboUp(mult) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const base = 440 * Math.pow(2, (mult - 1) / 6);
    this._osc('triangle', base, t, 0.08, 0.25);
    this._osc('triangle', base * 1.5, t + 0.07, 0.1, 0.25);
  }

  warning() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this._osc('square', 880, t + i * 0.16, 0.12, 0.2);
      this._osc('square', 587, t + i * 0.16 + 0.08, 0.12, 0.2);
    }
  }

  levelStart() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this._osc('triangle', f, t + i * 0.09, 0.14, 0.22));
  }

  victory() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, t + i * 0.12, 0.22, 0.25));
  }

  gameover() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [392, 349, 311, 262].forEach((f, i) => this._osc('sawtooth', f, t + i * 0.18, 0.24, 0.2));
  }

  civilian() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('square', 700, t, 0.1, 0.3);
    this._osc('square', 500, t + 0.12, 0.16, 0.3);
  }

  bossHit() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.12, 0.45, 'lowpass', 1400);
    this._osc('sawtooth', 100, t, 0.16, 0.35, null, 40);
  }

  // Lucky round: a bright "ting" for a crit shot.
  crit() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('triangle', 1320, t, 0.09, 0.28);
    this._osc('triangle', 1980, t + 0.05, 0.12, 0.22);
  }

  // Bullet time: a time-stretch whoosh (falling sweep + sub drop + slow shimmer).
  focus() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 880, t, 0.8, 0.3, null, 110);
    this._osc('triangle', 220, t, 1.1, 0.22, null, 55);
    this._osc('sine', 1760, t + 0.06, 0.5, 0.08, null, 1320);
    this._noise(t, 0.5, 0.12, 'bandpass', 600, 1.5);
  }

  // Soft low thud when a buffalo arrives on the road.
  spawnPop() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 150, t, 0.13, 0.11, null, 70);
    this._noise(t, 0.08, 0.05, 'lowpass', 420);
  }

  playerHurt() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.2, 0.4, 'lowpass', 800);
    this._osc('sawtooth', 140, t, 0.25, 0.35, null, 50);
  }

  // ================= MUSIC SEQUENCER =================
  playMusic(trackName) {
    if (!this._ready()) return;
    if (trackName === this.currentTrack) return;
    this.stopMusic();
    this.currentTrack = trackName;
    const tr = TRACKS[trackName];
    if (!tr) return;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.currentTrack = null;
  }

  _schedule() {
    const tr = TRACKS[this.currentTrack];
    if (!tr || !this.ctx) return;
    const stepDur = 60 / tr.bpm / 4; // 16th notes
    while (this._nextNoteTime < this.ctx.currentTime + 0.18) {
      this._playStep(tr, this._step % 16, this._nextNoteTime, stepDur);
      this._nextNoteTime += stepDur;
      this._step++;
    }
  }

  _playStep(tr, s, t, stepDur) {
    // Drums
    if (tr.kick[s]) this._drumKick(t);
    if (tr.snare[s]) this._drumSnare(t);
    if (tr.hat[s]) this._drumHat(t, s % 4 === 0 ? 0.12 : 0.06);
    // Bass
    const b = tr.bass[s];
    if (b != null) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = midiToFreq(b);
      f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
      this._env(g, t, 0.5, stepDur * 2.6);
      o.connect(f).connect(g).connect(this.musicGain);
      o.start(t); o.stop(t + stepDur * 3);
    }
    // Lead
    const l = tr.lead[s];
    if (l != null) {
      const type = this.currentTrack === 'boss' ? 'sawtooth' : 'triangle';
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = midiToFreq(l);
      if (type === 'sawtooth') {
        const o2 = this.ctx.createOscillator();
        o2.type = 'sawtooth';
        o2.frequency.value = midiToFreq(l) * 1.005; // detune for growl
        o2.connect(g);
        o2.start(t); o2.stop(t + stepDur * 3);
      }
      this._env(g, t, type === 'sawtooth' ? 0.28 : 0.34, stepDur * 2.2);
      o.connect(g).connect(this.musicGain);
      o.start(t); o.stop(t + stepDur * 3);
    }
  }

  _drumKick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this._env(g, t, 0.9, 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.25);
  }

  _drumSnare(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    this._env(g, t, 0.5, 0.14);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.2);
  }

  _drumHat(t, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    this._env(g, t, peak, 0.04);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.08);
  }
}
