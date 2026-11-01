import {
  MAX_NOTES_CHARS,
  MAX_SERVER_NOTES,
  planDocument,
  tooLongMessage,
} from "./limits.js";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DecodeError extends Error {
  constructor(message, { retryable = false, code = "" } = {}) {
    super(message);
    this.name = "DecodeError";
    this.retryable = retryable;
    this.code = code;
  }
}

function asDecodeError(err) {
  if (err instanceof DecodeError) return err;
  return new DecodeError(
    "Something went wrong on our side. Please try again in a moment. Your document is still here.",
    { retryable: true, code: "unknown" }
  );
}

async function withRetry(fn, { sleep, part, total }) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = asDecodeError(err);
      if (!last.retryable || attempt === 1) break;
      await sleep(1200);
    }
  }
  if (part && last.retryable) {
    throw new DecodeError(
      `We couldn't finish part ${part} of ${total}, so we stopped. Nothing after that was skipped on purpose — this reading isn't complete. Please try again in a moment.`,
      { code: "part_failed" }
    );
  }
  throw last;
}

export function parseModelJson(text) {
  const raw = String(text || "").trim();
  const candidates = [raw, raw.replace(/```json|```/gi, "").trim()];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(raw.slice(start, end + 1));

  let lastError;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("empty");
}

export function normalizeSections(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("not an object");
  }
  const out = {};
  for (const key of ["summary", "flags", "questions", "terms"]) {
    const value = parsed[key];
    if (typeof value === "string") out[key] = value.trim();
    else if (Array.isArray(value)) out[key] = value.map(String).join("\n").trim();
    else throw new Error(`missing ${key}`);
  }
  return out;
}

function modelSections(text) {
  try {
    return normalizeSections(parseModelJson(text));
  } catch {
    throw new DecodeError(
      "We read your document, but the answer didn't come back in a form we could show. Please try again.",
      { retryable: true, code: "bad_json" }
    );
  }
}

export function joinNotes(notes) {
  return notes.join("\n\n");
}

export function groupNotes(notes, maxChars) {
  const groups = [];
  let current = [];
  let size = 0;
  for (const note of notes) {
    const extra = note.length + 2;
    if (current.length && size + extra > maxChars) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(note);
    size += extra;
  }
  if (current.length) groups.push(current);
  return groups;
}

export function plainServerMessage(error, status) {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed && trimmed.length <= 400 && !trimmed.includes("<") && !trimmed.includes("{")) {
      return trimmed;
    }
  }
  if (status === 429) return "We're a little busy right now. Please wait a moment and try again.";
  if (status === 504 || status === 502 || status === 503) {
    return "This part took too long to read. Please try again in a moment.";
  }
  return "Something went wrong on our side. Please try again in a moment. Your document is still here.";
}

export async function postDecode(payload, { fetchImpl = fetch, timeoutMs = 50000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl("/.netlify/functions/decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new DecodeError(
        "This is taking longer than expected. Please try again in a moment.",
        { retryable: true, code: "timeout" }
      );
    }
    throw new DecodeError(
      "We couldn't reach the decoder just now. Please check your connection and try again.",
      { retryable: true, code: "network" }
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const retryable = [429, 502, 503, 504].includes(response.status);
      throw new DecodeError(
        retryable
          ? "This part took too long to read. Please try again in a moment."
          : "We got an unexpected reply from the decoder. Please try again in a moment.",
        { retryable, code: "bad_response" }
      );
    }
  }

  if (!response.ok || data.error) {
    const retryable = [429, 502, 503, 504].includes(response.status);
    throw new DecodeError(plainServerMessage(data.error, response.status), {
      retryable,
      code: "server",
    });
  }
  return data.text || "";
}

export async function runDecode({
  text,
  country,
  region,
  onProgress,
  request,
  sleep = defaultSleep,
}) {
  const plan = planDocument(text);
  if (!plan.ok) {
    if (plan.reason === "empty") {
      throw new DecodeError("Please paste your document text or upload a file first.", { code: "empty" });
    }
    throw new DecodeError(tooLongMessage(plan), { code: "too_long" });
  }

  const total = plan.chunks.length;

  if (total === 1) {
    onProgress?.({ phase: "reading", current: 1, total: 1 });
    const results = await withRetry(
      async () => modelSections(await request({
        mode: "single",
        country,
        region,
        docText: plan.chunks[0],
      })),
      { sleep }
    );
    return { results, parts: 1 };
  }

  const notes = [];
  for (let i = 0; i < total; i++) {
    const current = i + 1;
    onProgress?.({ phase: "reading", current, total });
    const noteText = await withRetry(
      () => request({
        mode: "extract",
        country,
        region,
        docText: plan.chunks[i],
        chunkIndex: current,
        chunkCount: total,
      }),
      { sleep, part: current, total }
    );
    notes.push(`Part ${current} of ${total}:\n${noteText}`);
  }

  let pending = notes;
  for (let round = 0; round < 6 && joinNotes(pending).length > MAX_NOTES_CHARS && pending.length > 1; round++) {
    onProgress?.({ phase: "combining", current: total, total });
    const groups = groupNotes(pending, MAX_NOTES_CHARS);
    if (groups.length >= pending.length) break;
    const next = [];
    for (const group of groups) {
      const reduced = await withRetry(
        () => request({
          mode: "reduce",
          country,
          region,
          notes: group.join("\n\n"),
        }),
        { sleep }
      );
      next.push(reduced);
    }
    pending = next;
  }

  const notesText = joinNotes(pending);
  if (notesText.length > MAX_SERVER_NOTES) {
    throw new DecodeError(
      "We read the whole document, but it was too much to combine into one explanation. Please split it into two smaller parts and try each one.",
      { code: "too_long" }
    );
  }

  onProgress?.({ phase: "combining", current: total, total });
  const results = await withRetry(
    async () => modelSections(await request({
      mode: "synthesize",
      country,
      region,
      notes: notesText,
    })),
    { sleep }
  );
  return { results, parts: total };
}
