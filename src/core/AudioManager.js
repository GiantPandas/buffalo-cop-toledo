// AudioManager: 100% procedural Web Audio. No audio files needed.
// - SFX synthesized on demand (noise buffers, oscillators, envelopes)
// - Music via a lookahead step sequencer with original patterns per intensity level.

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- ORIGINAL MUSIC PATTERNS (E minor / blues-rock energy) ----------------
// 16-step patterns. null = rest.
const K_STD =   [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0];
const K_HOOL =  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0];
const K_FOUR =  [1,0,0,0, 1,0,0,1, 1,0,0,0, 1,0,1,0];
const K_LOW =   [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
const K_NONE =  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
const S_STD =   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const S_SPARSE =[0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0];
const S_BOSS =  [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1];
const S_NONE =  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
const H_8 =     [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0];
const H_16 =    [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];
const H_MENU =  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0];
const H_SWING = [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1];
const R16 = [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null];

// 4-bar arrangements per track: chord progression + distinct bar variations,
// fills on the last bar, ghost-note hats. Bars cycle instead of one loop bar.
const TRACKS = {
  menu: { bpm: 92, chords: [[52,55,59],[48,52,55],[47,50,55],[52,55,59]], bars: [
    { b:[40,null,40,null, 40,null,40,null, 40,null,40,null, null,null,null,null],
      l:[null,null,64,null, null,null,67,null, null,null,71,null, null,67,null,null],
      k:K_NONE, sn:S_NONE, h:H_MENU },
    { b:[36,null,36,null, 36,null,36,null, 36,null,null,36, null,null,null,null],
      l:[60,null,null,64, null,67,null,null, 64,null,null,null, null,null,null,null],
      k:K_NONE, sn:S_NONE, h:H_MENU },
    { b:[43,null,43,null, 43,null,43,null, 43,null,47,null, null,null,null,null],
      l:[null,null,null,null, 62,null,null,67, null,null,71,null, null,null,67,null],
      k:K_NONE, sn:S_NONE, h:H_MENU },
    { b:[40,null,40,null, 40,null,40,null, 40,null,null,null, 43,null,40,null],
      l:[null,null,64,null, null,67,null,71, null,67,null,64, null,null,null,null],
      k:[0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], sn:S_NONE, h:H_MENU }
  ]},
  explore: { bpm: 118, chords: [[52,55,59],[52,55,59],[48,52,55],[47,50,55]], bars: [
    { b:[40,null,40,null, 40,null,40,null, 40,null,40,null, null,null,40,null],
      l:R16, k:K_STD, sn:S_STD, h:H_8 },
    { b:[40,null,40,null, 40,null,null,40, 45,null,45,null, 40,null,40,null],
      l:[null,null,null,64, null,null,67,null, null,null,null,null, null,62,null,null],
      k:K_STD, sn:S_STD, h:H_8 },
    { b:[48,null,48,null, 48,null,48,null, 52,null,null,48, null,null,48,null],
      l:[null,null,null,null, null,null,71,null, null,null,69,null, null,null,67,null],
      k:K_STD, sn:S_STD, h:H_SWING },
    { b:[43,null,43,null, 43,null,43,null, 47,null,43,null, null,40,null,null],
      l:[null,null,62,null, null,null,null,null, 64,null,null,67, null,null,67,null],
      k:K_STD, sn:S_STD, h:H_8 }
  ]},
  encounter: { bpm: 134, openHat: true, chords: [[52,55,59],[48,52,55],[47,50,55],[50,54,57]], bars: [
    { b:[40,null,40,null, 40,null,40,null, 40,null,43,null, 40,null,43,null],
      l:[null,null,64,null, null,67,null,64, null,null,null,69, null,null,67,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { b:[48,null,48,null, 48,null,48,null, 52,null,48,null, null,48,null,48,null],
      l:[null,null,72,null, null,69,null,null, 67,null,69,null, null,null,64,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { b:[43,null,43,null, 43,43,null,43, 47,null,43,null, 43,null,50,null],
      l:[null,67,null,null, 71,null,null,74, null,71,null,null, 69,null,null,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { b:[40,null,40,null, 40,null,40,43, 45,null,43,40, null,38,null,40,null],
      l:[null,null,64,null, 67,null,71,null, 74,71,67,64, null,null,null,null],
      k:K_STD, sn:S_STD, h:H_16 }
  ]},
  herd: { bpm: 150, openHat: true, chords: [[52,55,59],[52,55,59],[48,52,55],[50,54,57]], bars: [
    { b:[40,40,40,null, 40,40,43,null, 45,45,null,45, 43,null,40,null],
      l:R16, k:K_HOOL, sn:S_STD, h:H_16 },
    { b:[40,40,null,40, 40,40,null,38, 40,40,40,null, 43,40,null,40],
      l:R16, k:K_HOOL, sn:S_STD, h:H_16 },
    { b:[48,48,48,null, 48,48,52,null, 55,55,null,52, 48,null,48,null],
      l:[null,null,null,null, 67,null,null,71, null,null,null,74, null,71,null,null],
      k:K_HOOL, sn:S_STD, h:H_16 },
    { fill:true, b:[50,50,50,null, 50,50,48,null, 45,45,43,null, 40,40,null,40],
      l:R16, k:[1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0], sn:S_STD, h:H_16 }
  ]},
  boss: { bpm: 158, crash: true, openHat: true, chords: [[52,55,59],[52,55,59],[47,50,55],[45,51,57]], bars: [
    { b:[40,40,40,40, 40,null,43,40, 45,45,45,45, 43,null,40,40],
      l:[62,null,null,null, null,62,null,null, 64,null,null,null, 67,null,64,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { b:[40,40,41,42, 40,null,40,41, 42,43,null,40, 45,null,43,40],
      l:[null,null,66,null, null,70,null,null, null,70,null,null, 69,null,null,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { b:[43,43,43,43, 43,null,47,43, 50,50,50,50, 47,null,43,43],
      l:[62,null,null,66, null,null,null,70, null,null,null,74, null,null,70,null],
      k:K_STD, sn:S_STD, h:H_16 },
    { fill:true, b:[40,40,42,43, 45,null,43,42, 40,null,40,40, 40,40,40,40],
      l:[74,null,73,null, 71,null,null,69, 67,null,null,null, null,null,null,null],
      k:K_HOOL, sn:S_BOSS, h:H_16 }
  ]},
  victory: { bpm: 122, crash: true, chords: [[48,52,55],[43,50,55],[52,55,59],[50,54,57]], bars: [
    { b:[48,null,null,48, null,null,43,null, 40,null,null,43, null,null,48,null],
      l:[64,null,67,null, 71,null,null,67, null,null,null,64, null,null,null,null],
      k:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0], sn:S_STD, h:H_8 },
    { b:[43,null,null,43, null,null,50,null, 48,null,null,48, null,null,43,null],
      l:[71,null,74,null, 76,null,74,null, 71,null,null,null, null,null,null,null],
      k:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0], sn:S_STD, h:H_8 },
    { b:[40,null,null,40, null,null,43,null, 47,null,null,47, null,null,40,null],
      l:[76,null,74,null, 71,null,74,null, 76,null,null,79, null,null,null,null],
      k:K_FOUR, sn:S_STD, h:H_SWING },
    { b:[50,null,50,null, 48,null,null,47, null,43,null,43, null,40,null,null,null],
      l:[79,null,76,null, 74,null,71,null, 69,71,74,76, 79,null,null,null],
      k:K_FOUR, sn:S_STD, h:H_SWING }
  ]},
  gameover: { bpm: 70, chords: [[52,55,59],[48,52,55],[43,50,55],[47,52,55]], bars: [
    { b:[40,null,null,null, null,null,null,null, 39,null,null,null, null,null,null,null],
      l:[64,null,null,null, 62,null,null,null, null,null,null,null, null,null,null,null],
      k:K_LOW, sn:S_NONE, h:S_NONE },
    { b:[38,null,null,null, null,null,null,null, 37,null,null,null, null,null,null,null],
      l:[59,null,null,null, 58,null,null,null, null,null,null,null, null,null,null,null],
      k:K_LOW, sn:S_SPARSE, h:S_NONE },
    { b:[36,null,null,null, null,null,null,null, 35,null,null,null, null,null,null,null],
      l:[55,null,null,null, 52,null,null,null, null,null,null,null, null,null,null,null],
      k:K_LOW, sn:S_NONE, h:S_NONE },
    { b:[34,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
      l:[47,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
      k:K_LOW, sn:S_SPARSE, h:S_NONE }
  ]}
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
    this._rnd = 1337;
    this.musicDelay = null;
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

      // Echo bus for the lead voice: decaying taps feed the music mix for depth.
      this.musicDelay = this.ctx.createDelay(0.7);
      this.musicDelay.delayTime.value = 0.27;
      const fb = this.ctx.createGain(); fb.gain.value = 0.32;
      const wet = this.ctx.createGain(); wet.gain.value = 0.2;
      this.musicDelay.connect(fb); fb.connect(this.musicDelay);
      this.musicDelay.connect(wet); wet.connect(this.musicGain);

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
    const totalSteps = 16 * tr.bars.length;
    while (this._nextNoteTime < this.ctx.currentTime + 0.18) {
      this._playStep(tr, this._step % totalSteps, this._nextNoteTime, stepDur);
      this._nextNoteTime += stepDur;
      this._step++;
    }
  }

  // Small deterministic jitter so the groove doesn't feel machine-grid stiff.
  _jit() {
    this._rnd = (this._rnd * 1103515245 + 12345) % 2147483648;
    return this._rnd / 1073741824 - 1;
  }

  _playStep(tr, step, t, stepDur) {
    const s = step % 16;
    const barIdx = Math.floor(step / 16);
    const bar = tr.bars[barIdx];
    // Drums, humanized: fills on the last bar, ghost hats, velocity variation.
    if (bar.fill && s >= 12) {
      this._tom(t + 0.003 * this._jit(), 200 - (s - 12) * 30);
      if (bar.sn[s]) this._drumSnare(t, 0.18);
    } else {
      if (bar.k[s]) this._drumKick(t + 0.004 * this._jit(), s === 0 ? 0.9 : 0.75);
      if (bar.sn[s]) this._drumSnare(t + 0.005 * this._jit(), s === 4 ? 0.52 : 0.4);
    }
    if (bar.h[s]) {
      const vel = s % 4 === 0 ? 0.115 : 0.05 + (s % 2 === 0 ? 0.02 : 0);
      this._drumHat(t + 0.003 * this._jit(), vel * (0.85 + 0.3 * Math.abs(this._jit())));
    }
    if (s === 15 && tr.openHat) this._openHat(t);
    if (s === 0 && barIdx === 0 && tr.crash) this._crash(t);
    // Chord pad on every bar — the progression the bass & lead walk over.
    if (s === 0 && tr.chords) this._pad(tr.chords[barIdx % tr.chords.length], t, stepDur * 16 * 0.9);
    // Bass
    const b = bar.b[s];
    if (b != null) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = midiToFreq(b);
      f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
      this._env(g, t, 0.5 * (0.9 + 0.14 * this._jit()), stepDur * 2.6);
      o.connect(f).connect(g).connect(this.musicGain);
      o.start(t); o.stop(t + stepDur * 3);
    }
    // Lead, with echo send for depth.
    const l = bar.l[s];
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
      this._env(g, t, type === 'sawtooth' ? 0.28 : 0.32, stepDur * 2.2);
      o.connect(g);
      g.connect(this.musicGain);
      if (this.musicDelay) g.connect(this.musicDelay);
      o.start(t); o.stop(t + stepDur * 3);
    }
  }

  _pad(chord, t, dur) {
    for (let i = 0; i < chord.length; i++) {
      const tt = t + i * 0.05;
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = midiToFreq(chord[i]);
      o2.type = 'triangle'; o2.frequency.value = midiToFreq(chord[i]) * 1.004;
      f.type = 'lowpass'; f.frequency.value = 950; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.07, tt + 0.4);
      g.gain.setValueAtTime(0.07, tt + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(tt); o.stop(tt + dur + 0.05);
      o2.start(tt); o2.stop(tt + dur + 0.05);
    }
  }

  _tom(t, freq) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.16);
    this._env(g, t, 0.34, 0.2);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.3);
  }

  _openHat(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain();
    this._env(g, t, 0.14, 0.28);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.35);
  }

  _crash(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3600;
    const g = this.ctx.createGain();
    this._env(g, t, 0.28, 0.6);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.7);
  }

  _drumKick(t, peak = 0.9) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this._env(g, t, peak, 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.25);
  }

  _drumSnare(t, peak = 0.5) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    this._env(g, t, peak, 0.14);
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
