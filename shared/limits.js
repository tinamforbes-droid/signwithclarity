import { t } from "./messages.js";

// How much of a policy we will actually read.
//
// Each Netlify request does one model call. Synchronous functions stop at
// 60 seconds, so a whole policy cannot be read inside one request. The
// browser walks the parts instead, which also lets the page show progress.
// We stop at MAX_CHUNKS and say so. We never quietly keep only the start.

/** Characters of source text in one model call. */
export const CHUNK_SIZE = 12000;

/** Repeated tail so a sentence on a boundary is read with both parts. */
export const CHUNK_OVERLAP = 1000;

/** Most parts we will read before asking the person to split the document. */
export const MAX_CHUNKS = 24;

/** Notes aimed at the final write-up. Larger sets are merged first. */
export const MAX_NOTES_CHARS = 12000;

/** Most note text one function call will accept. */
export const MAX_SERVER_NOTES = 40000;

/** A rough plain-text page, used only to describe length kindly. */
export const CHARS_PER_PAGE = 3000;

/** Skip scanning past this so a huge paste cannot lock the browser. */
export const ABSOLUTE_MAX_CHARS = 1000000;

export function normalizeDocument(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\0")
    .join("")
    .trim();
}

export function estimatePages(chars) {
  return Math.max(1, Math.round(chars / CHARS_PER_PAGE));
}

export function maxReadablePages() {
  // A part usually ends on a paragraph, a little before the hard limit.
  // About 70 pages of ordinary policy text still fits. Promising the raw
  // window (closer to 90) would claim more than we can finish.
  const typicalAdvance = Math.round((CHUNK_SIZE - CHUNK_OVERLAP) * 0.8);
  return estimatePages(MAX_CHUNKS * typicalAdvance);
}

function chooseEnd(text, start) {
  const hardEnd = Math.min(start + CHUNK_SIZE, text.length);
  if (hardEnd >= text.length) return text.length;

  const window = text.slice(start, hardEnd);
  const min = Math.floor(CHUNK_SIZE * 0.55);
  const separators = ["\n\n", "\n", ". ", "? ", "! ", "; "];
  for (const sep of separators) {
    const idx = window.lastIndexOf(sep);
    if (idx >= min) return start + idx + sep.length;
  }
  const space = window.lastIndexOf(" ");
  if (space >= min) return start + space + 1;
  return hardEnd;
}

function nextStart(start, end) {
  let next = end - CHUNK_OVERLAP;
  const minNext = start + Math.floor(CHUNK_SIZE * 0.45);
  if (next < minNext) next = minNext;
  if (next <= start) next = start + 1;
  return next;
}

export function splitDocument(text) {
  const trimmed = normalizeDocument(text);
  const chunks = [];
  const ranges = [];
  if (!trimmed) return { trimmed, chunks, ranges, complete: true };

  let start = 0;
  let complete = true;
  while (start < trimmed.length) {
    let end = chooseEnd(trimmed, start);
    if (end <= start) end = Math.min(start + CHUNK_SIZE, trimmed.length);

    const piece = trimmed.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
      ranges.push({ start, end });
    }

    if (end >= trimmed.length) break;
    if (chunks.length >= MAX_CHUNKS) {
      complete = false;
      break;
    }

    const next = nextStart(start, end);
    if (next <= start || next >= trimmed.length) {
      complete = false;
      break;
    }
    start = next;
  }

  return { trimmed, chunks, ranges, complete };
}

export function planDocument(text) {
  const trimmed = normalizeDocument(text);
  if (!trimmed) return { ok: false, reason: "empty" };

  const pages = estimatePages(trimmed.length);
  const maxPages = maxReadablePages();
  if (trimmed.length > ABSOLUTE_MAX_CHARS) {
    return { ok: false, reason: "too_long", pages, chars: trimmed.length, maxPages };
  }

  const split = splitDocument(trimmed);
  if (!split.complete || split.chunks.length > MAX_CHUNKS) {
    return { ok: false, reason: "too_long", pages, chars: trimmed.length, maxPages };
  }

  return {
    ok: true,
    chunks: split.chunks,
    ranges: split.ranges,
    pages,
    chars: trimmed.length,
    maxPages,
  };
}

export function longDocumentNote(plan, lang = "en") {
  const pages = plan.pages === 1 ? t(lang, "aboutOnePage") : t(lang, "aboutPages", { count: plan.pages });
  return t(lang, "longNote", { pages });
}

export function tooLongMessage(plan, lang = "en") {
  const pages = plan?.pages ? t(lang, "aboutPages", { count: plan.pages }) : t(lang, "longerThanWeCanRead");
  const maxPages = plan?.maxPages || maxReadablePages();
  return t(lang, "tooLong", { pages, maxPages });
}

export function pieceTooLongMessage(lang = "en") {
  return t(lang, "pieceTooLong");
}
