import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, VolumeX } from "lucide-react";

/* Equalizer bars — reads as "audio is playing" more clearly than a static
   speaker icon, and is reused as the track-selector affordance (each track
   is its own little waveform). `heights` seeds the resting shape / static
   fallback; `animate` bounces them. Frozen under prefers-reduced-motion. */
function AudioWaveform({
  animate,
  heights = [0.5, 0.85, 0.6, 0.9],
  barWidth = 3,
  gap = 3,
  height = 16,
}: {
  animate: boolean;
  heights?: number[];
  barWidth?: number;
  gap?: number;
  height?: number;
}) {
  return (
    <div className="flex items-end" style={{ height, gap }}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={animate ? "eq-bar" : ""}
          style={{
            width: barWidth,
            height: "100%",
            borderRadius: 1,
            background: "currentColor",
            transform: animate ? undefined : `scaleY(${h})`,
            transformOrigin: "bottom",
            animationDelay: animate ? `${i * 0.13}s` : undefined,
            animationDuration: animate ? `${0.75 + (i % 4) * 0.14}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/* Five generative tracks, synthesized entirely in the browser via Web
   Audio API — deliberately not external audio files, so there's no
   license/attribution question and no network request. No lyrics, no
   real percussion (only filtered noise ticks used as a "data pulse", not
   a drum kit). The original single pad (kept here as "Drift") read as
   dull background music rather than "tech" — Pulse Grid and Circuit
   trade the slow open pad for a driving 16th-note sequencer instead. */

// Mutable, not React state: read every scheduler tick without forcing a
// re-render or rebuilding the audio graph. 1 = baseline tempo; set from a
// real /api/gpus poll (see AmbientAudio's effect below) — 0% busy -> 0.85x,
// 100% busy -> 1.45x. Not decoration: the tempo is actually the GPU fleet's
// current load.
type SpeedRef = { current: number };
type Track = { id: string; name: string; build: (ctx: AudioContext, master: GainNode, speed: SpeedRef) => () => void };

function makeNoiseBuffer(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/* A short filtered noise burst — reads as a "data tick" / clock pulse
   rather than a drum hit, keeping the "no percussion" character while
   giving the driving tracks a rhythmic anchor. */
function playTick(ctx: AudioContext, dest: AudioNode, noiseBuffer: AudioBuffer, time: number, gainAmt: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 4000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(gainAmt, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + 0.06);
}

function buildPulseGrid(ctx: AudioContext, master: GainNode, speed: SpeedRef): () => void {
  const ROOT = 98; // G2 — driving, a fourth up from the old pad's C
  const ARP = [1, 1.5, 1.7818, 2, 2.379, 2, 1.7818, 1.5]; // G minor-ish, 8-step loop
  const bpm = 112;
  const baseStepMs = (60 / bpm / 2) * 1000; // 8th notes

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  filter.Q.value = 1.2;
  filter.connect(master);

  // Sustained detuned-saw pad + sub drone under the sequence — gives the
  // track body so it doesn't read as a thin bleepy arp (user: "too quiet,
  // only Drift feels present").
  const padGain = ctx.createGain();
  padGain.gain.value = 0.06;
  padGain.connect(filter);
  const padOscs: OscillatorNode[] = [];
  [ROOT, ROOT * 1.5, ROOT / 2].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 2 ? "sine" : "sawtooth";
    osc.frequency.value = f;
    osc.detune.value = (i - 1) * 8;
    osc.connect(padGain);
    osc.start();
    padOscs.push(osc);
  });

  const noiseBuffer = makeNoiseBuffer(ctx, 0.08);
  let step = 0;
  let timer: number | undefined;
  // Self-rescheduling instead of setInterval so the delay can react to
  // `speed` changing between ticks (busier GPU fleet -> shorter delay ->
  // faster tempo), without tearing down and rebuilding the whole graph.
  const tick = () => {
    const now = ctx.currentTime;
    if (step % 4 === 0) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = ROOT / 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.32, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      osc.stop(now + 0.4);
    }
    const ratio = ARP[step % ARP.length];
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = ROOT * 2 * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g);
    g.connect(filter);
    osc.start(now);
    osc.stop(now + 0.25);
    if (step % 2 === 1) playTick(ctx, master, noiseBuffer, now, 0.07);
    step++;
    timer = window.setTimeout(tick, baseStepMs / speed.current);
  };
  timer = window.setTimeout(tick, baseStepMs / speed.current);

  return () => {
    window.clearTimeout(timer);
    padOscs.forEach((o) => o.stop());
  };
}

function buildDrift(ctx: AudioContext, master: GainNode, speed: SpeedRef): () => void {
  const ROOT = 164; // E3 — brighter than the original C3
  const PAD_RATIOS = [1, 1.5, 2];
  const ARP_RATIOS = [1, 1.1892, 1.3348, 1.4983, 1.7818, 2, 2.3784];

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1000;
  filter.Q.value = 0.7;
  filter.connect(master);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15; // was 0.05 — faster movement, less static/dull
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 420;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  const padOscs: OscillatorNode[] = [];
  PAD_RATIOS.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = ROOT * ratio;
    osc.detune.value = (i - 1) * 6;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.5 : 0.28;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    padOscs.push(osc);
  });

  let arpTimer: number | undefined;
  let stepIdx = 0;
  const playArpNote = () => {
    const now = ctx.currentTime;
    const ratio = ARP_RATIOS[stepIdx % ARP_RATIOS.length];
    stepIdx += Math.random() > 0.5 ? 1 : 2;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = ROOT * 2 * ratio;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.08, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    osc.connect(g);
    g.connect(filter);
    osc.start(now);
    osc.stop(now + 1.4);
    arpTimer = window.setTimeout(playArpNote, (500 + Math.random() * 700) / speed.current);
  };
  arpTimer = window.setTimeout(playArpNote, 1200 / speed.current);

  return () => {
    window.clearTimeout(arpTimer);
    lfo.stop();
    padOscs.forEach((o) => o.stop());
  };
}

function buildCircuit(ctx: AudioContext, master: GainNode, speed: SpeedRef): () => void {
  const ROOT = 220; // A3
  // Lydian-ish, brighter/more "optimistic tech" than a minor scale
  const MELODY = [1, 1.25, 1.5, 1.6818, 2, 1.6818, 1.5, 1.25, 1, 1.5, 2, 2.5];
  const bpm = 126;
  const baseStepMs = (60 / bpm / 4) * 1000; // 16th notes

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.connect(master);

  // Feedback delay — gives the pluck sequence its "circuit board" echo trail
  const delay = ctx.createDelay(1);
  delay.delayTime.value = (60 / bpm) * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0.6;
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(master);

  // Sustained warm pad an octave down for body under the bright plucks.
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  padGain.connect(master);
  const padOscs: OscillatorNode[] = [];
  [ROOT / 2, ROOT / 2 * 1.5].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.detune.value = (i - 0.5) * 10;
    osc.connect(padGain);
    osc.start();
    padOscs.push(osc);
  });

  const noiseBuffer = makeNoiseBuffer(ctx, 0.08);
  let step = 0;
  let timer: number | undefined;
  const tick = () => {
    const now = ctx.currentTime;
    if (step % 16 === 0) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = ROOT / 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.26, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.65);
    }
    if (step % 2 === 0) {
      const ratio = MELODY[(step / 2) % MELODY.length];
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = ROOT * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      osc.stop(now + 0.14);
    }
    if (step % 4 === 3) playTick(ctx, master, noiseBuffer, now, 0.055);
    step++;
    timer = window.setTimeout(tick, baseStepMs / speed.current);
  };
  timer = window.setTimeout(tick, baseStepMs / speed.current);

  return () => {
    window.clearTimeout(timer);
    padOscs.forEach((o) => o.stop());
  };
}

function buildNebula(ctx: AudioContext, master: GainNode, speed: SpeedRef): () => void {
  const root = 110;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 760;
  filter.Q.value = 1.8;
  filter.connect(master);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 320;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  const oscillators: OscillatorNode[] = [];
  [1, 1.4983, 2, 2.2449].forEach((ratio, i) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = i < 2 ? "sine" : "triangle";
    oscillator.frequency.value = root * ratio;
    oscillator.detune.value = (i - 1.5) * 7;
    gain.gain.value = i === 0 ? 0.26 : 0.1;
    oscillator.connect(gain).connect(filter);
    oscillator.start();
    oscillators.push(oscillator);
  });

  let timer: number | undefined;
  let step = 0;
  const notes = [2, 2.2449, 2.9966, 3.3636, 2.6667, 2.2449];
  const shimmer = () => {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = root * notes[step++ % notes.length];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
    oscillator.connect(gain).connect(filter);
    oscillator.start(now);
    oscillator.stop(now + 2.4);
    timer = window.setTimeout(shimmer, 1500 / speed.current);
  };
  timer = window.setTimeout(shimmer, 700);

  return () => {
    window.clearTimeout(timer);
    lfo.stop();
    oscillators.forEach((oscillator) => oscillator.stop());
  };
}

function buildDeepOrbit(ctx: AudioContext, master: GainNode, speed: SpeedRef): () => void {
  const root = 73.42;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1250;
  filter.Q.value = 0.9;
  filter.connect(master);

  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  delay.delayTime.value = 0.58;
  feedback.gain.value = 0.42;
  wet.gain.value = 0.38;
  filter.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const drone: OscillatorNode[] = [];
  [root, root * 1.5, root * 2].forEach((frequency, i) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = i === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = i === 0 ? 0.28 : 0.075;
    oscillator.connect(gain).connect(filter);
    oscillator.start();
    drone.push(oscillator);
  });

  const sequence = [2, 2.3784, 3, 3.5636, 4, 3, 2.6667, 2.3784];
  let step = 0;
  let timer: number | undefined;
  const pulse = () => {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = root * sequence[step % sequence.length];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(step % 4 === 0 ? 0.15 : 0.07, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    oscillator.connect(gain).connect(filter);
    oscillator.start(now);
    oscillator.stop(now + 0.9);
    step++;
    timer = window.setTimeout(pulse, 620 / speed.current);
  };
  timer = window.setTimeout(pulse, 350);

  return () => {
    window.clearTimeout(timer);
    drone.forEach((oscillator) => oscillator.stop());
  };
}

type BrightSequence = {
  root: number;
  bpm: number;
  notes: number[];
  rhythm: number[];
  wave: OscillatorType;
  cutoff: number;
  delay: number;
  feedback: number;
  noteGain: number;
  release: number;
  tickEvery: number;
  pad: number[];
};

/* A brighter family of arrangements: major/pentatonic note sets, short
   plucks, glassy echoes and quiet upper-register pads. Each preset still
   has its own rhythm and tone, but none relies on the low drones that made
   the previous collection feel heavy. */
function buildBrightSequence(
  ctx: AudioContext,
  master: GainNode,
  speed: SpeedRef,
  config: BrightSequence,
): () => void {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = config.cutoff;
  filter.Q.value = 0.55;
  filter.connect(master);

  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  delay.delayTime.value = config.delay;
  feedback.gain.value = config.feedback;
  wet.gain.value = 0.25;
  filter.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const padGain = ctx.createGain();
  padGain.gain.value = 0.022;
  padGain.connect(filter);
  const padOscillators = config.pad.map((ratio, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = config.root * ratio;
    oscillator.detune.value = (index - 1) * 4;
    oscillator.connect(padGain);
    oscillator.start();
    return oscillator;
  });

  const noise = makeNoiseBuffer(ctx, 0.08);
  const stepMs = (60 / config.bpm / 4) * 1000;
  let step = 0;
  let timer: number | undefined;

  const schedule = () => {
    const now = ctx.currentTime;
    const gate = config.rhythm[step % config.rhythm.length];
    if (gate) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = config.wave;
      oscillator.frequency.value = config.root * config.notes[step % config.notes.length];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(config.noteGain * gate, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + config.release);
      oscillator.connect(gain).connect(filter);
      oscillator.start(now);
      oscillator.stop(now + config.release + 0.04);
    }

    // A short tonal pulse supplies motion without turning into a heavy kick.
    if (step % 8 === 0) {
      const pulse = ctx.createOscillator();
      const gain = ctx.createGain();
      pulse.type = "sine";
      pulse.frequency.setValueAtTime(config.root, now);
      pulse.frequency.exponentialRampToValueAtTime(config.root * 0.72, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      pulse.connect(gain).connect(master);
      pulse.start(now);
      pulse.stop(now + 0.2);
    }

    if (config.tickEvery > 0 && step % config.tickEvery === config.tickEvery - 1) {
      playTick(ctx, master, noise, now, 0.025);
    }
    step++;
    timer = window.setTimeout(schedule, stepMs / speed.current);
  };
  timer = window.setTimeout(schedule, 80);

  return () => {
    window.clearTimeout(timer);
    padOscillators.forEach((oscillator) => oscillator.stop());
  };
}

function buildSolarSprint(ctx: AudioContext, master: GainNode, speed: SpeedRef) {
  return buildBrightSequence(ctx, master, speed, {
    root: 261.63, bpm: 118,
    notes: [1, 1.25, 1.5, 2, 1.6818, 1.5, 1.25, 2],
    rhythm: [1, 0, .72, 1, 0, .62, 1, .78],
    wave: "triangle", cutoff: 5200, delay: 0.24, feedback: 0.22,
    noteGain: 0.075, release: 0.24, tickEvery: 4, pad: [0.5, 0.625, 0.75],
  });
}

function buildPixelBreeze(ctx: AudioContext, master: GainNode, speed: SpeedRef) {
  return buildBrightSequence(ctx, master, speed, {
    root: 174.61, bpm: 106,
    notes: [2, 2.25, 2.5, 3, 3.375, 3, 2.5, 2.25],
    rhythm: [1, .55, 0, .75, 1, 0, .62, 0],
    wave: "sine", cutoff: 6200, delay: 0.34, feedback: 0.3,
    noteGain: 0.09, release: 0.48, tickEvery: 8, pad: [1, 1.25, 1.5],
  });
}

function buildDaylightCircuit(ctx: AudioContext, master: GainNode, speed: SpeedRef) {
  return buildBrightSequence(ctx, master, speed, {
    root: 293.66, bpm: 124,
    notes: [1, 1.2599, 1.4983, 1.8877, 2, 1.8877, 1.4983, 1.2599],
    rhythm: [1, 0, 1, .48, 0, 1, .68, 0],
    wave: "square", cutoff: 4300, delay: 0.18, feedback: 0.18,
    noteGain: 0.045, release: 0.16, tickEvery: 4, pad: [0.5, 0.7492, 1],
  });
}

function buildGlassGarden(ctx: AudioContext, master: GainNode, speed: SpeedRef) {
  return buildBrightSequence(ctx, master, speed, {
    root: 220, bpm: 98,
    notes: [2, 2.5, 3, 3.75, 4, 3.75, 3, 2.5],
    rhythm: [1, 0, .5, 0, .82, 0, .62, 0],
    wave: "sine", cutoff: 7000, delay: 0.42, feedback: 0.34,
    noteGain: 0.08, release: 0.72, tickEvery: 0, pad: [1, 1.25, 1.5],
  });
}

function buildNeonRun(ctx: AudioContext, master: GainNode, speed: SpeedRef) {
  return buildBrightSequence(ctx, master, speed, {
    root: 329.63, bpm: 132,
    notes: [1, 1.25, 1.5, 2, 1.5, 2.5, 2, 1.25],
    rhythm: [1, .45, 1, 0, .7, 1, .5, 0],
    wave: "sawtooth", cutoff: 4800, delay: 0.16, feedback: 0.16,
    noteGain: 0.038, release: 0.14, tickEvery: 2, pad: [0.5, 0.625, 0.75],
  });
}

const TRACKS: (Track & { wave: number[] })[] = [
  { id: "solar-sprint", name: "Solar Sprint", build: buildSolarSprint, wave: [0.45, 1, 0.7, 0.92, 0.58, 0.82] },
  { id: "pixel-breeze", name: "Pixel Breeze", build: buildPixelBreeze, wave: [0.55, 0.75, 1, 0.7, 0.9, 0.62] },
  { id: "daylight-circuit", name: "Daylight Circuit", build: buildDaylightCircuit, wave: [1, 0.55, 0.85, 0.42, 0.95, 0.68] },
  { id: "glass-garden", name: "Glass Garden", build: buildGlassGarden, wave: [0.42, 0.68, 0.92, 1, 0.78, 0.56] },
  { id: "neon-run", name: "Neon Run", build: buildNeonRun, wave: [0.95, 0.62, 1, 0.52, 0.88, 0.7] },
];

// Master gain when un-muted. Raised from the original 0.13 — the previous
// level was too quiet (only Drift felt present); the driving tracks were
// also thickened with a pad/sub layer. This is the ceiling the volume
// slider scales (0–1).
const MASTER_GAIN = 0.2;
const DEFAULT_VOLUME = 0.65;

export function AmbientAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const startedRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [trackIdx, setTrackIdx] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? Number(localStorage.getItem("hpclab-audio-track")) : 0;
    return Number.isInteger(saved) && saved >= 0 && saved < TRACKS.length ? saved : 0;
  });
  const trackIdxRef = useRef(trackIdx);
  trackIdxRef.current = trackIdx;
  const [hasChosen, setHasChosen] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("hpclab-audio") !== null
  );
  const [volume, setVolume] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? Number(localStorage.getItem("hpclab-audio-volume")) : NaN;
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : DEFAULT_VOLUME;
  });
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // 1 = baseline tempo. Read by the currently-running track's scheduler on
  // every tick — see the poll effect below for what actually sets it.
  const speedRef = useRef<{ current: number }>({ current: 1 });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || localStorage.getItem("hpclab-audio") === "off") return;

    start();
    const onFirstGesture = () => start();
    window.addEventListener("pointerdown", onFirstGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      stopRef.current();
      ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the same public endpoint the homepage's live telemetry uses.
  // 0.85x tempo at idle, up to 1.45x when the GPU fleet is fully busy —
  // real load, not a decorative random wobble. Silently keeps the 1x
  // baseline if the request fails (e.g. this sandbox can't reach the lab's
  // internal Prometheus, or a visitor is on /hero-preview where the same
  // component is mounted without any GPU infra behind it).
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/gpus");
        const j = await r.json();
        const online = j?.summary?.gpusOnline;
        const busy = j?.summary?.gpusBusy;
        if (alive && online) {
          const ratio = Math.min(1, (busy ?? 0) / online);
          speedRef.current.current = 0.85 + ratio * 0.6;
        }
      } catch {
        // stay at whatever speed we last had (1x if this never succeeds)
      }
    };
    poll();
    const interval = window.setInterval(poll, 20000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  async function start() {
    if (startedRef.current) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    try {
      await ctx.resume();
    } catch {
      return;
    }
    if (ctx.state !== "running") return;
    startedRef.current = true;
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(MASTER_GAIN * volume, ctx.currentTime + 3);
    masterRef.current = master;

    stopRef.current = TRACKS[trackIdxRef.current].build(ctx, master, speedRef.current);
    setEnabled(true);
  }

  function changeVolume(v: number) {
    setVolume(v);
    localStorage.setItem("hpclab-audio-volume", String(v));
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      master.gain.setTargetAtTime(MASTER_GAIN * v, ctx.currentTime, 0.05);
    }
  }

  function switchTrack(next: number) {
    localStorage.setItem("hpclab-audio-track", String(next));
    setTrackIdx(next);
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master || !enabled) return;
    stopRef.current();
    stopRef.current = TRACKS[next].build(ctx, master, speedRef.current);
  }

  async function toggle() {
    setHasChosen(true);
    if (!ctxRef.current) {
      localStorage.setItem("hpclab-audio", "on");
      await start();
      return;
    }
    const ctx = ctxRef.current;
    if (ctx.state === "running") {
      localStorage.setItem("hpclab-audio", "off");
      await ctx.suspend();
      setEnabled(false);
    } else {
      localStorage.setItem("hpclab-audio", "on");
      await ctx.resume();
      setEnabled(true);
    }
  }

  return createPortal(
    <div className="ambient-audio-root fixed bottom-4 left-4 z-[9998] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 sm:bottom-5 sm:left-5">
      {enabled && (
        <div
          className="max-w-full overflow-hidden rounded-2xl border p-3 shadow-lg backdrop-blur"
          style={{ borderColor: "var(--glass-border, rgba(255,255,255,0.25))", background: "var(--glass, rgba(255,255,255,0.08))" }}
        >
          {/* Track picker — each track is its own little waveform; the
              active one animates, the others are a static dim signature. */}
          <div className="flex max-w-full items-end gap-1 overflow-x-auto pb-2 sm:gap-2">
            {TRACKS.map((t, i) => {
              const isActive = trackIdx === i;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTrack(i)}
                  data-cursor-hover
                  aria-pressed={isActive}
                  aria-label={t.name}
                  title={t.name}
                  className="flex shrink-0 flex-col items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors sm:px-3"
                  style={{
                    background: isActive ? "var(--brand, #c1832f)" : "transparent",
                    color: isActive ? "#0a0a0a" : "var(--text)",
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  <AudioWaveform animate={isActive && !reduceMotion} heights={t.wave} barWidth={2.5} gap={2.5} height={18} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em]">{t.name}</span>
                </button>
              );
            })}
          </div>

          {/* Volume slider */}
          <div className="mt-2 flex items-center gap-2 px-1">
            <VolumeX size={14} className="shrink-0 opacity-50" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="音量"
              className="hpclab-volume h-1 flex-1 cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(to right, var(--brand, #c1832f) ${volume * 100}%, var(--glass-border, rgba(255,255,255,0.2)) ${volume * 100}%)`,
              }}
            />
          </div>
        </div>
      )}
      <div className="relative">
        {!enabled && !hasChosen && (
          <span
            className="absolute inset-0 animate-ping rounded-full"
            style={{ background: "var(--brand, #c1832f)", opacity: 0.35 }}
          />
        )}
        <button
          onClick={toggle}
          aria-label={enabled ? "關閉背景音樂" : "開啟背景音樂"}
          data-cursor-hover
          className="relative flex h-12 items-center justify-center gap-2 rounded-full border px-4 shadow-lg backdrop-blur transition-transform hover:scale-105"
          style={{
            borderColor: enabled ? "var(--glass-border, rgba(255,255,255,0.25))" : "var(--brand, #c1832f)",
            background: enabled ? "var(--glass, rgba(255,255,255,0.06))" : "var(--brand, #c1832f)",
            color: enabled ? "var(--text)" : "#0a0a0a",
          }}
          title={enabled ? "背景音樂:開啟(點擊靜音)" : "點擊播放背景音樂"}
        >
          {enabled ? <AudioWaveform animate={!reduceMotion} /> : <Music2 size={19} />}
          <span className="text-xs font-bold uppercase tracking-[0.14em]">音樂</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
