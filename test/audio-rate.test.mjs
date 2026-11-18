// The race's sound is computed at the rate the sound card runs at unless told otherwise, and at 192 kHz that is four
// times the work for nothing anyone can hear: a Windows PC set to 192 kHz lost half of it to underruns, and heard none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openAudio } from '../public/game/sfx.js';

// a browser whose sound card runs at `device` Hz
const browser = (device) => {
  const made = [];
  class AC {
    constructor(o = {}) { this.sampleRate = o.sampleRate ?? device; this.closed = false; made.push(this); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  return { AC, made };
};

for (const device of [96000, 176400, 192000]) {
  test(`a sound card at ${device} Hz: the race's sound is computed at 48 kHz, and the first context is let go`, () => {
    const { AC, made } = browser(device);
    const ctx = openAudio(AC);
    assert.equal(ctx.sampleRate, 48000);
    assert.equal(made.length, 2);
    assert.equal(made[0].closed, true);
    assert.equal(ctx.closed, false);
  });
}

for (const device of [44100, 48000]) {
  test(`a sound card at ${device} Hz: left at its own rate, with one context`, () => {
    const { AC, made } = browser(device);
    const ctx = openAudio(AC);
    assert.equal(ctx.sampleRate, device);
    assert.equal(made.length, 1);
  });
}

test('a browser whose context has no close() still gets the capped one', () => {
  const { AC } = browser(192000);
  AC.prototype.close = undefined;
  assert.equal(openAudio(AC).sampleRate, 48000);
});
