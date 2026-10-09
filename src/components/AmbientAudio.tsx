import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";

// Original, sample-free arrangements. Audio starts only after a user click.
type Chord = { bass: number; keys: readonly number[]; melody: readonly number[] };
type Style = "swing" | "rain" | "bossa" | "waltz";
type Track = { id: string; name: string; mood: string; bpm: number; style: Style; chords: readonly Chord[] };
const VOLUME_KEY = "hpclab-cafe-volume";
const TRACK_KEY = "hpclab-cafe-track";
// The synthesized notes peak far below full scale; lift the mix before compression.
const MASTER_LEVEL = 4;
const TRACKS: readonly Track[] = [
  { id: "cafe-session", name: "Café Session", mood: "柔和爵士", bpm: 76, style: "swing", chords: [
    { bass: 36, keys: [60, 64, 67, 71, 74], melody: [76, 79, 74, 71] },
    { bass: 45, keys: [60, 64, 67, 71, 76], melody: [76, 72, 79, 74] },
    { bass: 38, keys: [60, 64, 65, 69, 72], melody: [77, 76, 72, 69] },
    { bass: 43, keys: [59, 62, 65, 69, 76], melody: [74, 76, 71, 69] },
    { bass: 40, keys: [59, 62, 64, 67, 71], melody: [74, 71, 76, 67] },
    { bass: 45, keys: [61, 64, 67, 69, 73], melody: [76, 73, 69, 67] },
    { bass: 38, keys: [60, 64, 65, 69, 72], melody: [72, 76, 77, 69] },
    { bass: 43, keys: [59, 62, 65, 69, 76], melody: [71, 74, 76, 69] },
  ] },
  { id: "rainy-window", name: "Rainy Window", mood: "雨窗慢拍", bpm: 68, style: "rain", chords: [
    { bass: 38, keys: [57, 60, 64, 65, 69], melody: [72, 76, 69, 65] },
    { bass: 43, keys: [58, 62, 65, 69, 72], melody: [74, 69, 77, 72] },
    { bass: 48, keys: [58, 62, 64, 67, 72], melody: [76, 74, 72, 67] },
    { bass: 41, keys: [57, 60, 64, 67, 72], melody: [72, 76, 79, 76] },
    { bass: 46, keys: [57, 60, 62, 65, 69], melody: [72, 69, 65, 74] },
    { bass: 40, keys: [55, 59, 62, 65, 69], melody: [71, 74, 69, 65] },
    { bass: 45, keys: [55, 59, 60, 64, 67], melody: [72, 71, 67, 76] },
    { bass: 38, keys: [57, 60, 64, 65, 69], melody: [69, 72, 76, 72] },
  ] },
  { id: "bossa-afternoon", name: "Bossa Afternoon", mood: "午後巴薩", bpm: 94, style: "bossa", chords: [
    { bass: 41, keys: [57, 60, 64, 67, 72], melody: [72, 76, 79, 76] },
    { bass: 43, keys: [58, 62, 65, 69, 72], melody: [74, 77, 81, 77] },
    { bass: 48, keys: [58, 62, 64, 67, 72], melody: [76, 79, 74, 72] },
    { bass: 41, keys: [57, 60, 64, 67, 72], melody: [69, 72, 76, 79] },
    { bass: 38, keys: [57, 60, 64, 65, 69], melody: [72, 76, 77, 76] },
    { bass: 43, keys: [58, 62, 65, 69, 72], melody: [74, 77, 72, 69] },
    { bass: 48, keys: [58, 62, 64, 67, 72], melody: [76, 79, 74, 72] },
    { bass: 41, keys: [57, 60, 64, 67, 72], melody: [72, 76, 79, 84] },
  ] },
  { id: "midnight-waltz", name: "Midnight Waltz", mood: "夜色圓舞曲", bpm: 72, style: "waltz", chords: [
    { bass: 39, keys: [58, 62, 63, 67, 70], melody: [75, 79, 82, 79] },
    { bass: 46, keys: [57, 60, 62, 65, 69], melody: [74, 77, 81, 77] },
    { bass: 43, keys: [58, 62, 65, 69, 72], melody: [77, 74, 72, 69] },
    { bass: 48, keys: [58, 62, 63, 67, 70], melody: [75, 79, 82, 79] },
    { bass: 41, keys: [57, 60, 63, 67, 69], melody: [72, 75, 79, 75] },
    { bass: 46, keys: [57, 60, 62, 65, 69], melody: [74, 77, 81, 77] },
    { bass: 39, keys: [58, 62, 63, 67, 70], melody: [75, 79, 82, 87] },
    { bass: 46, keys: [57, 60, 62, 65, 69], melody: [81, 77, 74, 70] },
  ] },
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function playKey(ctx: AudioContext, destination: AudioNode, midi: number, at: number, length: number, strength: number) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(strength, at + 0.018);
  envelope.gain.exponentialRampToValueAtTime(strength * 0.38, at + 0.17);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  envelope.connect(destination);
  const fundamental = ctx.createOscillator();
  fundamental.type = "sine";
  fundamental.frequency.value = hz(midi);
  fundamental.connect(envelope);
  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.value = hz(midi) * 2.01;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.13;
  shimmer.connect(shimmerGain);
  shimmerGain.connect(envelope);
  fundamental.start(at);
  shimmer.start(at);
  fundamental.stop(at + length + 0.02);
  shimmer.stop(at + length + 0.02);
  fundamental.onended = () => { fundamental.disconnect(); shimmer.disconnect(); shimmerGain.disconnect(); envelope.disconnect(); };
}

function playBass(ctx: AudioContext, destination: AudioNode, midi: number, at: number) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(hz(midi) * 1.012, at);
  osc.frequency.exponentialRampToValueAtTime(hz(midi), at + 0.045);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(0.075, at + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.48);
  osc.connect(envelope);
  envelope.connect(destination);
  osc.start(at);
  osc.stop(at + 0.5);
  osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
}

function createBrushBuffer(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.09), ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
  return buffer;
}

function playBrush(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer, at: number, strength: number) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 4600;
  const gain = ctx.createGain();
  gain.gain.value = strength;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(at);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

function arrange(ctx: AudioContext, master: GainNode, track: Track): () => void {
  const eighth = 30 / track.bpm;
  const stepsPerBar = track.style === "waltz" ? 6 : 8;
  const startedAt = ctx.currentTime;
  const trackGain = ctx.createGain();
  trackGain.gain.setValueAtTime(0.0001, startedAt);
  trackGain.gain.linearRampToValueAtTime(1, startedAt + 0.35);
  trackGain.connect(master);
  const bus = ctx.createGain();
  bus.connect(trackGain);
  const delay = ctx.createDelay(0.6);
  delay.delayTime.value = eighth * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = track.style === "rain" ? 0.23 : 0.16;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = track.style === "rain" ? 1100 : 1800;
  const wet = ctx.createGain();
  wet.gain.value = track.style === "rain" ? 0.22 : 0.16;
  bus.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(wet);
  wet.connect(trackGain);

  const brush = createBrushBuffer(ctx);
  let step = 0;
  let nextAt = ctx.currentTime + 0.08;
  const schedule = () => {
    while (nextAt < ctx.currentTime + 0.32) {
      const inBar = step % stepsPerBar;
      const bar = Math.floor(step / stepsPerBar);
      const chord = track.chords[bar % track.chords.length];
      if (track.style === "swing") {
        if (inBar === 0) {
          chord.keys.forEach((note, index) => playKey(ctx, bus, note, nextAt + index * 0.022, eighth * 6, 0.031));
          playBass(ctx, bus, chord.bass, nextAt);
        }
        if (inBar === 4) {
          playKey(ctx, bus, chord.keys[1], nextAt, eighth * 2.8, 0.024);
          playKey(ctx, bus, chord.keys[3], nextAt + 0.02, eighth * 2.8, 0.022);
          playBass(ctx, bus, chord.bass + 7, nextAt);
        }
        if (inBar === 2 || inBar === 5 || (inBar === 7 && bar % 2 === 0)) {
          playKey(ctx, bus, chord.melody[(bar + inBar) % chord.melody.length], nextAt + (inBar === 5 ? 0.04 : 0), eighth * 1.5, 0.042);
        }
        if (inBar % 2 === 1) playBrush(ctx, bus, brush, nextAt + 0.045, 0.012);
        if (inBar === 0 || inBar === 4) playBrush(ctx, bus, brush, nextAt, 0.008);
      } else if (track.style === "rain") {
        if (inBar === 0) {
          chord.keys.forEach((note, index) => playKey(ctx, bus, note, nextAt + index * 0.06, eighth * 7.5, 0.021));
          playBass(ctx, bus, chord.bass, nextAt);
        }
        if (inBar === 4) playBass(ctx, bus, chord.bass + 7, nextAt);
        if (inBar === 3 || (inBar === 6 && bar % 2 === 0)) {
          playKey(ctx, bus, chord.melody[(bar + inBar) % chord.melody.length], nextAt, eighth * 2.4, 0.028);
        }
        if (inBar === 3 || inBar === 7) playBrush(ctx, bus, brush, nextAt, 0.006);
      } else if (track.style === "bossa") {
        if (inBar === 0 || inBar === 4) playBass(ctx, bus, chord.bass + (inBar === 4 ? 7 : 0), nextAt);
        if (inBar === 0 || inBar === 3 || inBar === 6) {
          chord.keys.slice(1).forEach((note, index) => playKey(ctx, bus, note, nextAt + index * 0.013, eighth * 2.2, 0.018));
        }
        if (inBar === 2 || inBar === 5 || (inBar === 7 && bar % 2 === 1)) {
          playKey(ctx, bus, chord.melody[(bar + inBar) % chord.melody.length], nextAt, eighth * 1.4, 0.034);
        }
        if (inBar === 2 || inBar === 6) playBrush(ctx, bus, brush, nextAt, 0.01);
      } else {
        if (inBar === 0) playBass(ctx, bus, chord.bass, nextAt);
        if (inBar === 0 || inBar === 2 || inBar === 4) {
          chord.keys.slice(inBar === 0 ? 0 : 1).forEach((note, index) => playKey(ctx, bus, note, nextAt + index * 0.025, eighth * (inBar === 0 ? 5 : 1.7), inBar === 0 ? 0.019 : 0.013));
        }
        if (inBar === 3 || (inBar === 5 && bar % 2 === 0)) {
          playKey(ctx, bus, chord.melody[(bar + inBar) % chord.melody.length], nextAt, eighth * 2, 0.032);
        }
        if (inBar === 2 || inBar === 4) playBrush(ctx, bus, brush, nextAt, 0.006);
      }
      step++;
      nextAt += eighth;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 80);
  return () => {
    window.clearInterval(timer);
    trackGain.gain.cancelScheduledValues(ctx.currentTime);
    trackGain.gain.setValueAtTime(Math.min(1, Math.max(0.0001, (ctx.currentTime - startedAt) / 0.35)), ctx.currentTime);
    trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    window.setTimeout(() => {
      bus.disconnect(); delay.disconnect(); tone.disconnect(); feedback.disconnect(); wet.disconnect(); trackGain.disconnect();
    }, 700);
  };
}

export function AmbientAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const changingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trackIndex, setTrackIndex] = useState(() => Math.max(0, TRACKS.findIndex(track => track.id === localStorage.getItem(TRACK_KEY))));
  const trackIndexRef = useRef(trackIndex);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    const stored = saved === null ? NaN : Number(saved);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.9;
  });

  useEffect(() => () => { stopRef.current(); void ctxRef.current?.close(); }, []);

  const toggle = async () => {
    if (changingRef.current) return;
    changingRef.current = true;
    setBusy(true);
    setError("");
    if (ctxRef.current) {
      const ctx = ctxRef.current;
      const master = masterRef.current;
      ctxRef.current = null;
      masterRef.current = null;
      stopRef.current();
      setPlaying(false);
      if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      await new Promise(resolve => window.setTimeout(resolve, 120));
      await ctx.close().catch(() => {});
      setBusy(false);
      changingRef.current = false;
      return;
    }
    let pendingContext: AudioContext | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("此瀏覽器不支援背景音樂。");
      const ctx = new AudioContextClass();
      pendingContext = ctx;
      await ctx.resume();
      if (ctx.state !== "running") { await ctx.close(); throw new Error("音訊尚未啟用，請再按一次播放。"); }
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 2.5;
      compressor.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = MASTER_LEVEL * volume;
      master.connect(compressor);
      stopRef.current = arrange(ctx, master, TRACKS[trackIndexRef.current]);
      ctxRef.current = ctx;
      masterRef.current = master;
      pendingContext = null;
      setPlaying(true);
    } catch (cause) {
      await pendingContext?.close().catch(() => {});
      setError(cause instanceof Error ? cause.message : "播放失敗，請再試一次。");
    }
    setBusy(false);
    changingRef.current = false;
  };

  const selectTrack = (index: number) => {
    if (index === trackIndexRef.current) return;
    trackIndexRef.current = index;
    setTrackIndex(index);
    localStorage.setItem(TRACK_KEY, TRACKS[index].id);
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      stopRef.current();
      stopRef.current = arrange(ctx, master, TRACKS[index]);
    }
  };

  const changeVolume = (next: number) => {
    const value = Math.max(0, Math.min(1, next));
    setVolume(value);
    localStorage.setItem(VOLUME_KEY, String(value));
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) master.gain.setTargetAtTime(MASTER_LEVEL * value, ctx.currentTime, 0.04);
  };

  const selectedTrack = TRACKS[trackIndex];
  return createPortal(
    <div className="ambient-audio-root cafe-audio" aria-label="背景音樂控制器">
      {panelOpen && <div id="cafe-volume-panel" className="cafe-audio-panel">
        <div className="cafe-audio-heading"><span className={`cafe-audio-indicator${playing ? "" : " is-paused"}`} /><div><strong>{selectedTrack.name}</strong><small>{selectedTrack.mood} · 無人聲{playing ? "" : " · 已暫停"}</small></div></div>
        <div className="cafe-audio-track-label">選擇曲目</div>
        <div className="cafe-audio-tracks" aria-label="選擇背景音樂">
          {TRACKS.map((track, index) => <button key={track.id} type="button" className="cafe-audio-track" aria-pressed={index === trackIndex} onClick={() => selectTrack(index)}>
            <strong>{track.name}</strong><small>{track.mood}</small>
          </button>)}
        </div>
        <label className="cafe-audio-volume"><VolumeX size={15} aria-hidden="true" /><input type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={event => changeVolume(Number(event.target.value) / 100)} aria-label="背景音樂音量" /><Volume2 size={15} aria-hidden="true" /><output>{Math.round(volume * 100)}%</output></label>
      </div>}
      <div className="cafe-audio-controls">
        <button type="button" className="cafe-audio-toggle" onClick={toggle} disabled={busy} aria-pressed={playing} aria-label={playing ? "關閉背景音樂" : "開啟背景音樂"}>
          <span className="cafe-audio-icon">{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</span>
          <Music2 size={15} aria-hidden="true" />
          <span>背景音樂</span>
        </button>
        <button type="button" className="cafe-audio-volume-toggle" onClick={() => setPanelOpen(open => !open)} aria-expanded={panelOpen} aria-controls="cafe-volume-panel" aria-label={panelOpen ? "收合音樂控制" : "選擇曲目與調整音量"} title="選擇曲目與調整音量"><Volume2 size={18} /></button>
      </div>
      {error && <p className="cafe-audio-error" role="alert">{error}</p>}
    </div>,
    document.body,
  );
}
