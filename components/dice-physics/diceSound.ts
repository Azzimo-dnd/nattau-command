export type DiceSoundEngine = {
  unlock: () => Promise<void>;
  impact: (force: number) => void;
  dispose: () => void;
};

export function createDiceSoundEngine(): DiceSoundEngine {
  let context: AudioContext | null = null;
  let lastImpactAt = 0;

  function ensureContext() {
    if (typeof window === "undefined") return null;
    if (!context) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
      if (!AudioContextConstructor) return null;
      context = new AudioContextConstructor();
    }
    return context;
  }

  async function unlock() {
    const audioContext = ensureContext();
    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }
  }

  function impact(force: number) {
    const audioContext = ensureContext();
    if (!audioContext || audioContext.state !== "running") return;

    const nowMilliseconds = performance.now();
    if (nowMilliseconds - lastImpactAt < 28 || force < 2.5) return;
    lastImpactAt = nowMilliseconds;

    const duration = 0.035 + Math.min(force / 700, 0.045);
    const sampleCount = Math.max(
      1,
      Math.floor(audioContext.sampleRate * duration)
    );
    const buffer = audioContext.createBuffer(
      1,
      sampleCount,
      audioContext.sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = Math.pow(1 - index / sampleCount, 2.8);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    const normalizedForce = Math.min(1, Math.log10(force + 1) / 2.6);

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 650 + normalizedForce * 1350;
    filter.Q.value = 1.4;
    gain.gain.value = 0.025 + normalizedForce * 0.13;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  }

  function dispose() {
    if (context) {
      void context.close();
      context = null;
    }
  }

  return { unlock, impact, dispose };
}

let sharedDiceSoundEngine: DiceSoundEngine | null = null;

export function getSharedDiceSoundEngine() {
  if (!sharedDiceSoundEngine) {
    sharedDiceSoundEngine = createDiceSoundEngine();
  }
  return sharedDiceSoundEngine;
}
