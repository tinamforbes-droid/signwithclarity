import {
  MAX_NOTES_CHARS,
  MAX_SERVER_NOTES,
  planDocument,
  tooLongMessage,
} from "./limits.js";
import { asLanguage, t } from "./messages.js";
import { isAccessToken } from "./session.js";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DecodeError extends Error {
  constructor(message, { retryable = false, code = "", usage = null } = {}) {
    super(message);
    this.name = "DecodeError";
    this.retryable = retryable;
    this.code = code;
    this.usage = usage;
  }
}

function asDecodeError(err, language) {
  if (err instanceof DecodeError) return err;
  return new DecodeError(
    t(language, "errorGeneric"),
    { retryable: true, code: "unknown" }
  );
}

async function withRetry(fn, { sleep, part, total, language }) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = asDecodeError(err, language);
      if (!last.retryable || attempt === 1) break;
      await sleep(1200);
    }
  }
  if (part && last.retryable) {
    throw new DecodeError(
      t(language, "errorPartFailed", { part, total }),
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

function modelSections(text, language) {
  try {
    return normalizeSections(parseModelJson(text));
  } catch {
    throw new DecodeError(
      t(language, "errorBadJson"),
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

export function plainServerMessage(error, status, language = "en") {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed && trimmed.length <= 400 && !trimmed.includes("<") && !trimmed.includes("{")) {
      return trimmed;
    }
  }
  if (status === 429) return t(language, "errorBusy");
  if (status === 504 || status === 502 || status === 503) {
    return t(language, "errorPartTimeout");
  }
  return t(language, "errorGeneric");
}

function isUsage(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function resolveAccessToken(accessToken) {
  try {
    const value = typeof accessToken === "function" ? await accessToken() : accessToken;
    return isAccessToken(value) ? String(value).trim() : "";
  } catch {
    return "";
  }
}

export async function postDecode(payload, { fetchImpl = fetch, timeoutMs = 50000, onUsage, accessToken } = {}) {
  const language = asLanguage(payload?.language) || "en";
  const headers = { "Content-Type": "application/json" };
  const token = await resolveAccessToken(accessToken);
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl("/.netlify/functions/decode", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new DecodeError(
        t(language, "errorTimeout"),
        { retryable: true, code: "timeout" }
      );
    }
    throw new DecodeError(
      t(language, "errorNetwork"),
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
          ? t(language, "errorPartTimeout")
          : t(language, "errorBadResponse"),
        { retryable, code: "bad_response" }
      );
    }
  }

  if (!response.ok || data.error) {
    const code = typeof data.code === "string" && data.code.length <= 40 ? data.code : "server";
    const retryable = code !== "monthly_limit"
      && code !== "fair_use"
      && code !== "explanation_closed"
      && [429, 502, 503, 504].includes(response.status);
    throw new DecodeError(plainServerMessage(data.error, response.status, language), {
      retryable,
      code,
      usage: isUsage(data.usage) ? data.usage : null,
    });
  }
  if (isUsage(data.usage)) onUsage?.(data.usage);
  return data.text || "";
}

function createExplanationId() {
  return globalThis.crypto.randomUUID();
}

export async function runDecode({
  text,
  country,
  region,
  language = "en",
  explanationId,
  onProgress,
  request,
  sleep = defaultSleep,
}) {
  const lang = asLanguage(language) || "en";
  const plan = planDocument(text);
  if (!plan.ok) {
    if (plan.reason === "empty") {
      throw new DecodeError(t(lang, "errorEmpty"), { code: "empty" });
    }
    throw new DecodeError(tooLongMessage(plan, lang), { code: "too_long" });
  }

  const total = plan.chunks.length;
  const where = {
    country,
    region,
    language: lang,
    explanationId: explanationId || createExplanationId(),
  };

  if (total === 1) {
    onProgress?.({ phase: "reading", current: 1, total: 1 });
    const results = await withRetry(
      async () => modelSections(await request({
        mode: "single",
        ...where,
        docText: plan.chunks[0],
      }), lang),
      { sleep, language: lang }
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
        ...where,
        docText: plan.chunks[i],
        chunkIndex: current,
        chunkCount: total,
      }),
      { sleep, part: current, total, language: lang }
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
          ...where,
          notes: group.join("\n\n"),
        }),
        { sleep, language: lang }
      );
      next.push(reduced);
    }
    pending = next;
  }

  const notesText = joinNotes(pending);
  if (notesText.length > MAX_SERVER_NOTES) {
    throw new DecodeError(
      t(lang, "errorCombine"),
      { code: "too_long" }
    );
  }

  onProgress?.({ phase: "combining", current: total, total });
  const results = await withRetry(
    async () => modelSections(await request({
      mode: "synthesize",
      ...where,
      notes: notesText,
    }), lang),
    { sleep, language: lang }
  );
  return { results, parts: total };
}
