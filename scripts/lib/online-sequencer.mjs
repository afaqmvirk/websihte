// Read the public sequence format used by Online Sequencer's MIDI export.
// Schema: proto.Sequence, proto.SequenceSettings and proto.Note in its published app JS.
// This reader is used only for pinned build-time imports, never on a Discord request.
function fields(input) {
  const bytes = Buffer.from(input), result = new Map();
  let offset = 0;
  const varint = () => {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (offset >= bytes.length) throw new Error("Truncated sequence field");
      const byte = bytes[offset++]; value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) return Number(value);
    }
    throw new Error("Invalid sequence varint");
  };
  while (offset < bytes.length) {
    const tag = varint(), field = Math.floor(tag / 8), wire = tag % 8;
    let value;
    if (!field) throw new Error("Invalid sequence field");
    if (wire === 0) value = varint();
    else if (wire === 2) {
      const length = varint();
      if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length) throw new Error("Invalid sequence length");
      value = bytes.subarray(offset, offset + length); offset += length;
    } else if (wire === 5) { value = bytes.readFloatLE(offset); offset += 4; }
    else if (wire === 1) { value = bytes.readDoubleLE(offset); offset += 8; }
    else throw new Error("Unsupported sequence wire type");
    const values = result.get(field) ?? []; values.push(value); result.set(field, values);
  }
  return result;
}

export function decodeOnlineSequence(bytes) {
  if (bytes.length > 5_000_000) throw new Error("Sequence too large");
  const root = fields(bytes), settings = fields(root.get(1)?.[0] ?? []);
  const tempo = settings.get(1)?.[0] ?? 120;
  const notes = (root.get(2) ?? []).map((bytes) => {
    const note = fields(bytes);
    // Export writes 96 ticks per sequence step into a 384-tick quarter note.
    return { pitch: note.get(1)?.[0] ?? 0, time: (note.get(2)?.[0] ?? 0) / 4,
      beats: (note.get(3)?.[0] ?? 0) / 4, instrument: note.get(4)?.[0] ?? 0,
      volume: note.get(5)?.[0] ?? 0, annotation: note.has(7) };
  }).filter((note) => !note.annotation && note.volume > 0 && Number.isInteger(note.pitch)
    && note.pitch >= 0 && note.pitch <= 107 && Number.isFinite(note.time) && note.time >= 0
    && Number.isFinite(note.beats) && note.beats > 0);
  if (!Number.isFinite(tempo) || tempo <= 0 || !notes.length) throw new Error("Empty or invalid sequence");
  return { tempo, notes };
}
