import tunes from "./discord-bot-clarinet-tunes.json";

export type ClarinetScore = { tempo_bpm: number; notes: { pitch: number | null; beats: number }[] };
export const MAX_CLARINET_SCORE_NOTES = 128;
export const MAX_CLARINET_SECONDS = 15;
export const MAX_CLARINET_PITCH = 82;
export const CLARINET_SCORE_PROPERTIES = {
  tempo_bpm: { type: "integer", minimum: 120, maximum: 200 },
  notes: { type: "array", minItems: 4, maxItems: MAX_CLARINET_SCORE_NOTES, items: {
    type: "object", additionalProperties: false, required: ["pitch", "beats"], properties: {
      pitch: { type: ["integer", "null"], minimum: 55, maximum: MAX_CLARINET_PITCH, description: "Concert MIDI pitch in a comfortable clarinet register; null is a rest." },
      beats: { type: "number", minimum: 0.125, maximum: 2, description: "Quarter-note beats; keep the whole phrase under fifteen seconds." },
    },
  } },
} as const;
export const CLARINET_MELODY_REFERENCES = JSON.stringify(tunes);

export function parseClarinetScore(value: unknown): ClarinetScore {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid clarinet score");
  const score = value as Record<string, unknown>;
  if (Object.keys(score).length !== 2 || !Number.isInteger(score.tempo_bpm) || Number(score.tempo_bpm) < 120 || Number(score.tempo_bpm) > 200
    || !Array.isArray(score.notes) || score.notes.length < 4 || score.notes.length > MAX_CLARINET_SCORE_NOTES) throw new Error("Invalid clarinet score");
  let beats = 0, sounding = 0;
  const notes = score.notes.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid clarinet note");
    const note = value as Record<string, unknown>;
    if (Object.keys(note).length !== 2 || (note.pitch !== null && (!Number.isInteger(note.pitch) || Number(note.pitch) < 55 || Number(note.pitch) > MAX_CLARINET_PITCH))
      || typeof note.beats !== "number" || !Number.isFinite(note.beats) || note.beats < 0.125 || note.beats > 2) throw new Error("Invalid clarinet note");
    beats += note.beats;
    if (note.pitch !== null) sounding++;
    return { pitch: note.pitch as number | null, beats: note.beats };
  });
  const seconds = beats * 60 / Number(score.tempo_bpm);
  if (sounding < 3 || seconds < 0.75 || seconds > MAX_CLARINET_SECONDS) throw new Error("Clarinet phrase is too long or silent");
  return { tempo_bpm: Number(score.tempo_bpm), notes };
}
