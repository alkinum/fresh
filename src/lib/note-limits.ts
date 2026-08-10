export const MAX_NOTE_CONTENT_CHARACTERS = 1_000_000;

// JSON.stringify can represent control and lone-surrogate code units as six-byte escapes.
export const MAX_NOTE_JSON_BODY_BYTES = MAX_NOTE_CONTENT_CHARACTERS * 6 + 4096;
