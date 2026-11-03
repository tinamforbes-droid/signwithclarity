// netlify/functions/decode.js
//
// This is a Netlify Function — a small piece of server code that runs on
// Netlify's servers, not in the browser. Its whole job is to hold your real
// Anthropic API key safely and pass requests through to Claude on behalf of
// your app. The key NEVER reaches the browser.
//
// Before this works, you need to:
// 1. Get an API key at https://console.anthropic.com (Settings > API Keys)
// 2. In Netlify: Site settings > Environment variables > add a new variable
//    named ANTHROPIC_API_KEY with that key as the value
// 3. Redeploy the site (env vars only take effect on the next deploy)
//
// A short document is one model call (mode "single"). A long document is read
// in parts: the browser sends one part at a time ("extract"), merges those
// notes if needed ("reduce"), then asks for the usual four sections
// ("synthesize"). One model call per request keeps us inside the synchronous
// function time limit. This function does not cut a document down to the
// first few thousand characters.
//
// A free connection may start three explanations per calendar month. The
// count is kept in Netlify Blobs under a salted hash of the IP address.
// If the request includes a Supabase session, this function checks that
// session with the secret key and counts the three on that account instead.
// The document itself is not stored. A paid account is read from Supabase
// in shared/access.js. One Household Check pays for one comparison of up
// to 4 policies. Clarity Yearly counts that comparison as one explanation.
// A comparison is not free. A flag in the request body cannot turn this on.

import { cleanComparisonPolicies } from "../../shared/comparePolicy.js";
import { cleanImage, photoInstruction } from "../../shared/images.js";
import {
  CHUNK_SIZE,
  MAX_SERVER_NOTES,
  normalizeDocument,
  pieceTooLongMessage,
} from "../../shared/limits.js";
import { asLanguage, t } from "../../shared/messages.js";
import { locationBlock, systemFor } from "../../shared/prompts.js";
import { enforceUsageLimit, resolveUsageStore } from "../../shared/usageGate.js";

function serverEnv(context) {
  if (context?.env && typeof context.env === "object") {
    return { ...process.env, ...context.env };
  }
  return process.env;
}

const MODEL = "claude-sonnet-4-6";

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function cleanLabel(value, fallback) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  return (text || fallback).slice(0, 80);
}

function failureForStatus(status, language) {
  if (status === 429 || status === 529) {
    return { statusCode: 429, error: t(language, "errorBusy") };
  }
  if (status === 401 || status === 403) {
    return { statusCode: 500, error: t(language, "errorAuth") };
  }
  if (status === 408 || status === 504) {
    return { statusCode: 504, error: t(language, "errorPartTimeout") };
  }
  if (status === 413) {
    return { statusCode: 413, error: t(language, "errorPageTooLarge") };
  }
  if (status === 400) {
    return { statusCode: 400, error: t(language, "errorCantReadPart") };
  }
  return { statusCode: 502, error: t(language, "errorUnexpected") };
}

function messageContent(user, images) {
  if (!images?.length) return user;
  return [
    ...images.map((image) => ({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    })),
    { type: "text", text: user },
  ];
}

async function askModel({ system, user, images, maxTokens, language }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: messageContent(user, images) }],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("Anthropic API error:", response.status);
    const failure = failureForStatus(response.status, language);
    return { ok: false, ...failure };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, statusCode: 502, error: t(language, "errorUnexpected") };
  }

  const text = data?.content?.[0]?.text || "";
  if (!text.trim()) {
    return { ok: false, statusCode: 502, error: t(language, "errorEmptyAnswer") };
  }
  return { ok: true, text };
}

export async function handler(event, context) {
  let language = "en";
  if (event.httpMethod !== "POST") {
    return reply(405, { error: t(language, "errorMethod") });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: t(language, "errorBadRequest") });
  }

  language = asLanguage(payload.language) || "en";
  const mode = payload.mode || "single";
  const country = cleanLabel(payload.country, "Canada");
  const region = cleanLabel(payload.region || payload.province, "Not specified");

  if (!["single", "extract", "reduce", "synthesize", "compare", "release"].includes(mode)) {
    return reply(400, { error: t(language, "errorBadMode") });
  }

  if (mode === "release") {
    const gate = await enforceUsageLimit({
      headers: event.headers,
      payload,
      store: await resolveUsageStore(context),
      env: serverEnv(context),
      now: context?.now instanceof Date ? context.now : new Date(),
      hasUnlimitedAccess: context?.hasUnlimitedAccess,
      verifySession: context?.verifySession,
      accountStore: context?.accountStore,
      fetchImpl: context?.fetchImpl,
      language,
    });
    return reply(gate.allowed ? 200 : gate.statusCode, gate.allowed
      ? { released: Boolean(gate.released) }
      : gate.body);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return reply(500, { error: t(language, "errorMissingKey") });
  }

  try {
    let model;
    if (mode === "reduce" || mode === "synthesize") {
      const notes = normalizeDocument(payload.notes);
      if (!notes) {
        return reply(400, { error: t(language, "errorMissingNotes") });
      }
      if (notes.length > MAX_SERVER_NOTES) {
        return reply(400, { error: t(language, "errorTooManyNotes") });
      }
      const where = locationBlock(country, region, language);
      if (mode === "reduce") {
        model = {
          system: systemFor("reduce", language),
          maxTokens: 900,
          language,
          user: `${where}\n\nNotes from several parts of one document, in order:\n${notes}`,
        };
      } else {
        model = {
          system: systemFor("synthesize", language),
          maxTokens: 1200,
          language,
          user: `${where}\n\nThe notes below were taken from every part of one insurance document, in order from the first page through the last. Later parts were not skipped. Give exclusions, conditions, and endorsements from the end the same attention as the opening.\n\nUse all of the notes when you write the four-part explanation.\n\nNotes:\n${notes}`,
        };
      }
    } else if (mode === "compare") {
      const cleaned = cleanComparisonPolicies(payload.policies, language);
      if (!cleaned.ok) {
        const key = cleaned.reason === "notes"
          ? "errorTooManyNotes"
          : cleaned.reason === "count"
            ? "compareCount"
            : "compareNeedText";
        return reply(400, { error: t(language, key), code: cleaned.reason });
      }
      const blocks = cleaned.policies.map((policy, index) => (
        `Policy ${index + 1} — ${policy.label}\n${policy.notes}`
      ));
      model = {
        system: systemFor("compare", language),
        maxTokens: 2200,
        language,
        user: `${locationBlock(country, region, language)}\n\nCompare these ${cleaned.policies.length} policies. Keep the labels unchanged and in this order. Use only the notes below. Later notes matter as much as earlier ones.\n\n${blocks.join("\n\n")}`,
      };
    } else {
      const image = payload.image ? cleanImage(payload.image) : null;
      if (payload.image && !image) {
        return reply(400, { error: t(language, "photoUnreadable"), code: "bad_image" });
      }
      const where = locationBlock(country, region, language);
      const chunkIndex = Number.isInteger(payload.chunkIndex) ? payload.chunkIndex : 1;
      const chunkCount = Number.isInteger(payload.chunkCount) ? payload.chunkCount : 1;
      if (image) {
        const looking = mode === "extract" ? "extract" : "single";
        model = {
          system: systemFor(looking, language),
          maxTokens: looking === "extract" ? 800 : 1000,
          language,
          images: [image],
          user: `${where}\n\n${photoInstruction(chunkIndex, chunkCount)}`,
        };
      } else {
        const docText = normalizeDocument(payload.docText);
        if (!docText) {
          return reply(400, { error: t(language, "errorNoText") });
        }
        if (docText.length > CHUNK_SIZE) {
          return reply(400, { error: pieceTooLongMessage(language) });
        }
        if (mode === "extract") {
          model = {
            system: systemFor("extract", language),
            maxTokens: 800,
            language,
            user: `${where}\n\nThis is part ${chunkIndex} of ${chunkCount}, in order. Read this part carefully. Exclusions in this part matter even if they feel like fine print.\n\nInsurance Document:\n${docText}`,
          };
        } else {
          model = {
            system: systemFor("single", language),
            maxTokens: 1000,
            language,
            user: `${where}\n\nInsurance Document:\n${docText}`,
          };
        }
      }
    }

    const gate = await enforceUsageLimit({
      headers: event.headers,
      payload,
      store: await resolveUsageStore(context),
      env: serverEnv(context),
      now: context?.now instanceof Date ? context.now : new Date(),
      hasUnlimitedAccess: context?.hasUnlimitedAccess,
      verifySession: context?.verifySession,
      accountStore: context?.accountStore,
      fetchImpl: context?.fetchImpl,
      language,
    });
    if (!gate.allowed) return reply(gate.statusCode, gate.body);

    let result;
    try {
      result = await askModel(model);
    } catch (err) {
      await gate.release?.();
      throw err;
    }
    if (!result.ok) {
      await gate.release?.();
      return reply(result.statusCode, { error: result.error });
    }
    if (mode === "compare") await gate.complete?.();
    const body = { text: result.text };
    if (gate.usage) body.usage = gate.usage;
    return reply(200, body);
  } catch (err) {
    console.error("decode function error:", err);
    return reply(500, { error: t(language, "errorReadFailed") });
  }
}
