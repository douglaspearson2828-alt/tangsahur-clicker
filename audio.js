/**
 * Procedural Web Audio synthesizer for Tangsahur Clicker.
 * Zero external audio assets; handles missing AudioContext and autoplay suspension safely.
 */

const BEAT_RATIOS = [1.0, 1.125, 1.26]; // 3-beat "tung-tung-tung" pentatonic cadence

export class SoundEngine {
  constructor() {
    this._enabled = true;
    this._volume = 0.6;
    this._ctx = null;
    this._masterGain = null;
    this._compressor = null;
    this._noiseBuffer = null;
    this._beatIndex = 0;
    this._lastClickTime = 0;
  }

  /**
   * Enable or disable all audio playback.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = Boolean(enabled);
    this._syncMasterGain();
  }

  /**
   * @returns {boolean} Whether sound effects are currently enabled.
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Set master output volume in [0, 1].
   * @param {number} vol
   */
  setVolume(vol) {
    const n = Number(vol);
    if (!Number.isFinite(n)) return;
    this._volume = Math.max(0, Math.min(1, n));
    this._syncMasterGain();
  }

  /**
   * @returns {number} Current master volume in [0, 1].
   */
  getVolume() {
    return this._volume;
  }

  /**
   * Lazily initialize AudioContext & master output chain if supported.
   * @returns {AudioContext | null}
   */
  _ensureContext() {
    if (!this._enabled || this._volume <= 0) return null;
    try {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx) return null;

      if (!this._ctx) {
        this._ctx = new AudioCtx();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this._enabled ? this._volume : 0;

        if (typeof this._ctx.createDynamicsCompressor === 'function') {
          this._compressor = this._ctx.createDynamicsCompressor();
          this._compressor.threshold.value = -12;
          this._compressor.knee.value = 18;
          this._compressor.ratio.value = 4;
          this._compressor.attack.value = 0.003;
          this._compressor.release.value = 0.12;
          this._masterGain.connect(this._compressor);
          this._compressor.connect(this._ctx.destination);
        } else {
          this._masterGain.connect(this._ctx.destination);
        }
      }

      if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
        const p = this._ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }

      return this._ctx;
    } catch (_) {
      return null;
    }
  }

  _syncMasterGain() {
    try {
      if (!this._ctx || !this._masterGain) return;
      const target = this._enabled ? this._volume : 0;
      const t = this._ctx.currentTime || 0;
      if (typeof this._masterGain.gain.setTargetAtTime === 'function') {
        this._masterGain.gain.setTargetAtTime(target, t, 0.015);
      } else {
        this._masterGain.gain.value = target;
      }
    } catch (_) {
      // Ignore audio state errors in restricted environments
    }
  }

  _getNoiseBuffer(ctx) {
    if (this._noiseBuffer && this._noiseBuffer.sampleRate === ctx.sampleRate) {
      return this._noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Schedule a single oscillator tone with exponential decay envelope.
   */
  _tone(ctx, {
    type = 'sine',
    freq = 440,
    endFreq = null,
    start = 0,
    attack = 0.004,
    duration = 0.15,
    gain = 0.25,
    pitchRampTime = null,
  }) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq !== null) {
      const rampEnd = t0 + (pitchRampTime ?? duration);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), rampEnd);
    }

    const peak = Math.max(0.0001, gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.001, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, duration));

    osc.connect(g);
    g.connect(this._masterGain);

    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  /**
   * Schedule a short filtered noise burst (mallet impact / cosmic shimmer).
   */
  _noiseBurst(ctx, {
    start = 0,
    duration = 0.04,
    filterType = 'bandpass',
    freq = 1600,
    endFreq = null,
    q = 2.0,
    gain = 0.14,
    attack = 0.002,
  }) {
    const t0 = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this._getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, freq), t0);
    if (endFreq !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + duration);
    }
    filter.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this._masterGain);

    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /**
   * Hollow resonant wooden kentongan/drum "TUNG!" with 3-beat pitch cadence.
   * @param {number} [comboCount]
   */
  playClick(comboCount) {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const hasCombo = typeof comboCount === 'number' && Number.isFinite(comboCount);
      const beat = hasCombo
        ? ((Math.floor(comboCount) % 3) + 3) % 3
        : this._beatIndex++ % 3;

      const now = ctx.currentTime;
      const rapid = now - this._lastClickTime < 0.075;
      this._lastClickTime = now;

      const comboBoost = hasCombo ? Math.min(Math.max(0, comboCount), 30) * 0.003 : 0;
      const jitter = 1 + (Math.random() - 0.5) * 0.024;
      const baseFreq = 185 * BEAT_RATIOS[beat] * (1 + comboBoost) * jitter;
      const accent = beat === 2 ? 1.08 : 1.0;
      const levelScale = rapid ? 0.72 : 1.0;

      // Hollow cylindrical body resonance
      this._tone(ctx, {
        type: 'sine',
        freq: baseFreq * 1.24,
        endFreq: baseFreq,
        pitchRampTime: 0.018,
        attack: 0.003,
        duration: 0.145,
        gain: 0.42 * accent * levelScale,
      });

      // Characteristic wood slit-drum overtone (~2.28x fundamental)
      this._tone(ctx, {
        type: 'triangle',
        freq: baseFreq * 2.28,
        endFreq: baseFreq * 2.22,
        pitchRampTime: 0.04,
        attack: 0.002,
        duration: 0.06,
        gain: 0.16 * accent * levelScale,
      });

      // Soft wooden mallet transient clack
      this._noiseBurst(ctx, {
        duration: 0.022,
        filterType: 'bandpass',
        freq: 1750,
        q: 2.6,
        gain: 0.13 * levelScale,
        attack: 0.001,
      });
    } catch (_) {
      // Safe no-op on Web Audio failure
    }
  }

  /**
   * Crisp wooden clack + warm confirm tone for purchasing buildings.
   */
  playBuy() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      // Crisp wooden clack
      this._tone(ctx, {
        type: 'triangle',
        freq: 290,
        endFreq: 210,
        pitchRampTime: 0.025,
        attack: 0.002,
        duration: 0.06,
        gain: 0.25,
      });
      this._noiseBurst(ctx, {
        duration: 0.018,
        filterType: 'bandpass',
        freq: 2100,
        q: 2.8,
        gain: 0.09,
      });

      // Warm ascending confirm interval
      this._tone(ctx, {
        type: 'sine',
        freq: 523.25,
        start: 0.015,
        attack: 0.004,
        duration: 0.095,
        gain: 0.22,
      });
      this._tone(ctx, {
        type: 'sine',
        freq: 783.99,
        start: 0.06,
        attack: 0.005,
        duration: 0.14,
        gain: 0.24,
      });
    } catch (_) {}
  }

  /**
   * Soft descending wood tap for selling buildings.
   */
  playSell() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      this._tone(ctx, {
        type: 'triangle',
        freq: 420,
        endFreq: 280,
        pitchRampTime: 0.08,
        attack: 0.003,
        duration: 0.11,
        gain: 0.22,
      });
      this._tone(ctx, {
        type: 'sine',
        freq: 260,
        endFreq: 165,
        start: 0.035,
        pitchRampTime: 0.08,
        attack: 0.003,
        duration: 0.12,
        gain: 0.18,
      });
    } catch (_) {}
  }

  /**
   * Bright ascending harmonic chime for purchasing upgrades.
   */
  playUpgrade() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const start = i * 0.048;
        this._tone(ctx, {
          type: 'sine',
          freq,
          start,
          attack: 0.005,
          duration: 0.22 + i * 0.04,
          gain: 0.19,
        });
        this._tone(ctx, {
          type: 'triangle',
          freq: freq * 2,
          start,
          attack: 0.004,
          duration: 0.12,
          gain: 0.06,
        });
      });
    } catch (_) {}
  }

  /**
   * Sparkling bell glissando when a Golden Tangsahur appears.
   */
  playGoldenAppear() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const notes = [1174.66, 1396.91, 1760.0, 2093.0, 2637.02];
      notes.forEach((freq, i) => {
        const start = i * 0.055;
        this._tone(ctx, {
          type: 'sine',
          freq,
          start,
          attack: 0.004,
          duration: 0.42,
          gain: 0.15,
        });
        // Bell-like metallic partial
        this._tone(ctx, {
          type: 'sine',
          freq: freq * 2.756,
          start,
          attack: 0.002,
          duration: 0.16,
          gain: 0.045,
        });
      });
    } catch (_) {}
  }

  /**
   * Rich celebratory chord + resonant drum hit on Golden Tangsahur click.
   */
  playGoldenClick() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      // Deep resonant kentongan drum hit
      this._tone(ctx, {
        type: 'sine',
        freq: 155,
        endFreq: 108,
        pitchRampTime: 0.06,
        attack: 0.003,
        duration: 0.28,
        gain: 0.42,
      });
      this._noiseBurst(ctx, {
        duration: 0.025,
        filterType: 'bandpass',
        freq: 1900,
        q: 2.2,
        gain: 0.14,
      });

      // Rich warm celebratory Cmaj9 chord
      const chord = [523.25, 659.25, 783.99, 987.77, 1174.66];
      chord.forEach((freq, i) => {
        this._tone(ctx, {
          type: i < 2 ? 'triangle' : 'sine',
          freq,
          start: i * 0.024,
          attack: 0.006,
          duration: 0.48,
          gain: 0.14,
        });
      });
    } catch (_) {}
  }

  /**
   * Warm triumphant 3-note fanfare for achievement unlocks.
   */
  playAchievement() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const fanfare = [
        { freq: 523.25, start: 0.0, duration: 0.16, gain: 0.22 },
        { freq: 659.25, start: 0.11, duration: 0.16, gain: 0.22 },
        { freq: 783.99, start: 0.22, duration: 0.44, gain: 0.26 },
      ];
      fanfare.forEach((n) => {
        this._tone(ctx, {
          type: 'triangle',
          freq: n.freq,
          start: n.start,
          attack: 0.006,
          duration: n.duration,
          gain: n.gain,
        });
        this._tone(ctx, {
          type: 'sine',
          freq: n.freq * 0.5,
          start: n.start,
          attack: 0.006,
          duration: n.duration,
          gain: n.gain * 0.55,
        });
      });
      // Final octave sparkle on the 3rd fanfare note
      this._tone(ctx, {
        type: 'sine',
        freq: 1567.98,
        start: 0.22,
        attack: 0.01,
        duration: 0.46,
        gain: 0.12,
      });
    } catch (_) {}
  }

  /**
   * Deep cosmic gong + ethereal shimmer for Ascending / Reincarnating.
   */
  playAscend() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      // Inharmonic bronze gong partials
      const partials = [
        { freq: 65.41, dur: 1.5, gain: 0.38 },
        { freq: 98.0, dur: 1.3, gain: 0.24 },
        { freq: 146.83, dur: 1.1, gain: 0.16 },
        { freq: 231.0, dur: 0.9, gain: 0.11 },
        { freq: 349.23, dur: 0.8, gain: 0.08 },
      ];
      partials.forEach((p) => {
        this._tone(ctx, {
          type: 'sine',
          freq: p.freq * 1.03,
          endFreq: p.freq,
          pitchRampTime: 0.35,
          attack: 0.025,
          duration: p.dur,
          gain: p.gain,
        });
      });

      // Rising cosmic shimmer sweep
      this._noiseBurst(ctx, {
        start: 0.04,
        duration: 1.1,
        filterType: 'bandpass',
        freq: 450,
        endFreq: 2600,
        q: 3.5,
        gain: 0.12,
        attack: 0.18,
      });
      this._tone(ctx, {
        type: 'sine',
        freq: 783.99,
        endFreq: 1567.98,
        start: 0.12,
        pitchRampTime: 0.9,
        attack: 0.12,
        duration: 1.05,
        gain: 0.1,
      });
    } catch (_) {}
  }

  /**
   * Crystalline harvest pop for harvesting Sahur Lumps.
   */
  playLump() {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;

      // Crisp crystal bubble pop
      this._tone(ctx, {
        type: 'sine',
        freq: 360,
        endFreq: 960,
        pitchRampTime: 0.048,
        attack: 0.002,
        duration: 0.075,
        gain: 0.28,
      });
      // Sparkling crystal overtones
      this._tone(ctx, {
        type: 'sine',
        freq: 1480,
        start: 0.035,
        attack: 0.003,
        duration: 0.22,
        gain: 0.18,
      });
      this._tone(ctx, {
        type: 'sine',
        freq: 2217.46,
        start: 0.075,
        attack: 0.003,
        duration: 0.28,
        gain: 0.14,
      });
    } catch (_) {}
  }
}

export const sound = new SoundEngine();
