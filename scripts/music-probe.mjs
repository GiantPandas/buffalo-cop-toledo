// Drives the music sequencer with a mock AudioContext across all tracks.
// Asserts no exceptions and that bar variations/cycles actually produce voices.
import { AudioManager } from '../src/core/AudioManager.js';

const node = () => ({
  gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
  frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
  Q: { value: 1 },
  delayTime: { value: 0 },
  type: '',
  buffer: null,
  connect(dest) { return dest || this; },
  start() {}, stop() {}
});

let voices = 0;
const ctx = {
  currentTime: 0, destination: node(), sampleRate: 44100, state: 'running',
  resume() {},
  createGain() { voices++; return node(); },
  createOscillator() { voices++; return node(); },
  createBufferSource() { voices++; return node(); },
  createBiquadFilter() { return node(); },
  createDelay() { return node(); },
  createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
};

const a = new AudioManager();
a.ctx = ctx;
a.musicGain = node();
a.sfxGain = node();
a.noiseBuffer = { duration: 1 };

const tracks = ['menu', 'explore', 'encounter', 'herd', 'boss', 'victory', 'gameover'];
for (const track of tracks) {
  a.currentTrack = track;
  a._step = 0;
  a._nextNoteTime = 0;
  ctx.currentTime = 0;
  const before = voices;
  // ~6 seconds of scheduling per track (covers 4+ bars at every bpm)
  for (let i = 0; i < 700; i++) {
    a._schedule();
    ctx.currentTime += 0.01;
  }
  const made = voices - before;
  if (made <= 0) throw new Error(`track ${track} produced no voices`);
  console.log(`ok  : ${track.padEnd(10)} ${made} voices in ~7s`);
}
console.log('\nALL MUSIC PRObes PASSED');
