// frontend/src/lib/api/audio.ts
//
// Tour Guide momentum audio briefing — ai-router /api/v1/tour-guide/audio-briefing.

import { apiPost, withFallback } from "./client";

export interface AudioBriefing {
  audio_url: string;
  duration_seconds: number;
  text_preview: string;
}

/** POST /api/v1/tour-guide/audio-briefing — TTS momentum briefing. */
export function fetchAudioBriefing(text: string): Promise<AudioBriefing | null> {
  return withFallback(
    () => apiPost<AudioBriefing>("/tour-guide/audio-briefing", { text }),
    () => null,
    "audio briefing",
  );
}
