import { LOUDNESS_HEADER } from '@lyra/shared';

import { parseLoudness } from '../loudness.ts';
import { analyzeSamples } from './beat-analysis.ts';
import type { TrackAnalysis } from './beat-analysis.ts';

/** A song downloaded whole and analysed, ready to be mixed in. */
export interface PreparedTrack {
  // Object URL of the downloaded file; it plays without downloading the song again.
  url: string;
  analysis: TrackAnalysis;
  loudnessDb: number | null;
}

// Low enough to keep a decoded song around 10 MB, high enough to hear hi-hats.
const ANALYSIS_SAMPLE_RATES = [11025, 22050] as const;

/** Decodes at a low sample rate, falling back for browsers that refuse the lowest one. */
async function decodeMono(data: ArrayBuffer) {
  let lastError: unknown = null;

  for (const sampleRate of ANALYSIS_SAMPLE_RATES) {
    try {
      const context = new OfflineAudioContext(1, 1, sampleRate);
      // decodeAudioData takes ownership of the buffer, so each attempt gets a copy.
      const audio = await context.decodeAudioData(data.slice(0));
      const mono = new Float32Array(audio.length);

      for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
        const samples = audio.getChannelData(channel);

        for (let index = 0; index < samples.length; index += 1) {
          mono[index] = (mono[index] ?? 0) + (samples[index] ?? 0) / audio.numberOfChannels;
        }
      }

      return { samples: mono, sampleRate: audio.sampleRate };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/** Downloads a song whole and finds its tempo and structure. Null when anything fails. */
export async function prepareTrack(
  streamUrl: string,
  signal: AbortSignal,
): Promise<PreparedTrack | null> {
  try {
    const response = await fetch(streamUrl, { credentials: 'same-origin', signal });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const { samples, sampleRate } = await decodeMono(await blob.arrayBuffer());

    if (signal.aborted) {
      return null;
    }

    return {
      url: URL.createObjectURL(blob),
      analysis: analyzeSamples(samples, sampleRate),
      loudnessDb: parseLoudness(response.headers.get(LOUDNESS_HEADER)),
    };
  } catch {
    return null;
  }
}
