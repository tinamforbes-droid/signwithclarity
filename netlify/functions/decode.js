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

import {
  CHUNK_SIZE,
  MAX_SERVER_NOTES,
  normalizeDocument,
  pieceTooLongMessage,
} from "../../shared/limits.js";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are Sign With Clarity, a warm and helpful AI assistant that decodes insurance documents for everyday people in Canada and the United States. You are NOT a lawyer and do NOT give legal advice. Your job is to translate confusing insurance language into plain, simple English that anyone can understand.

You are familiar with insurance rules and norms across all Canadian provinces and territories, and all 50 US states. When a country and province or state is provided, tailor your explanation to that specific jurisdiction — including relevant local rules, common regional policy differences, and anything a person in that location should especially watch for.

When given an insurance document or excerpt, respond ONLY with a JSON object in this exact format (no markdown, no backticks, no extra text):
{
  "summary": "A warm, plain-language summary of what this document actually says. 3-5 sentences. Write as if explaining to a friend.",
  "flags": "2-4 specific things the person should pay close attention to. Each point on a new line starting with •. Focus on unusual clauses, exclusions, or things that could surprise them. Where relevant, note if something is unusual for their province or state.",
  "questions": "3-4 smart questions they should ask their insurance company before signing or renewing. Each on a new line starting with •. Make questions specific and actionable.",
  "terms": "Define 3-5 confusing insurance terms found in the document, in plain English. Format each as TERM: definition, each on a new line."
}

Always be warm, clear, and reassuring. Never use legal jargon. Always remind the reader this is for understanding only, not legal advice.`;

const EXTRACT_SYSTEM = `You are Sign With Clarity, taking careful notes on ONE part of a longer insurance document for someone in Canada or the United States. You are NOT a lawyer and do NOT give legal advice.

Respond ONLY with a JSON object in this exact format (no markdown, no backticks, no extra text):
{
  "coverage": "One or two plain sentences about what this part is about.",
  "facts": "Key facts from this part only: who is covered, limits, deductibles, dates, and duties. Each fact on a new line starting with •.",
  "flags": "Exclusions, conditions, deadlines, or surprises in this part. Each on a new line starting with •. If there are none, write • None in this part.",
  "questions": "Questions a person should ask because of this part. Each on a new line starting with •. If there are none, write • None in this part.",
  "terms": "Confusing terms that actually appear in this part. Format each as TERM: plain definition, each on a new line. If there are none, use an empty string."
}

Be faithful to the wording you were given. Do not invent coverage. Do not drop an exclusion, limit, or deadline because it feels minor. Keep the JSON compact.`;

const REDUCE_SYSTEM = `You are Sign With Clarity, merging notes from several parts of one insurance document. You are NOT a lawyer and do NOT give legal advice.

Combine the notes into ONE JSON object in this exact format (no markdown, no backticks, no extra text):
{
  "coverage": "One or two plain sentences covering what these parts are about.",
  "facts": "Distinct facts worth keeping. Each on a new line starting with •.",
  "flags": "Every distinct exclusion, condition, deadline, or surprise. Each on a new line starting with •. Do not drop one because it appeared later.",
  "questions": "The most useful questions, without repeating the same question. Each on a new line starting with •.",
  "terms": "Distinct terms. Format each as TERM: plain definition, each on a new line."
}

Do not invent anything that is not in the notes. Keep the JSON compact.`;

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

function locationBlock(country, region) {
  const place = country === "Canada" ? "Province" : "State";
  return `Country: ${country}\n${place}: ${region}`;
}

function failureForStatus(status) {
  if (status === 429 || status === 529) {
    return { statusCode: 429, error: "We're a little busy right now. Please wait a moment and try again." };
  }
  if (status === 401 || status === 403) {
    return { statusCode: 500, error: "The reading service could not sign in. The site owner needs to check the API key." };
  }
  if (status === 408 || status === 504) {
    return { statusCode: 504, error: "This part took too long to read. Please try again in a moment." };
  }
  if (status === 400 || status === 413) {
    return { statusCode: 400, error: "We couldn't read that part of the document. Please try again, or paste a shorter section." };
  }
  return { statusCode: 502, error: "The reading service didn't respond as expected. Please try again in a moment." };
}

async function askModel({ system, user, maxTokens }) {
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
      messages: [{ role: "user", content: user }],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("Anthropic API error:", response.status);
    const failure = failureForStatus(response.status);
    return { ok: false, ...failure };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, statusCode: 502, error: "The reading service didn't respond as expected. Please try again in a moment." };
  }

  const text = data?.content?.[0]?.text || "";
  if (!text.trim()) {
    return { ok: false, statusCode: 502, error: "The reading service sent back an empty answer. Please try again in a moment." };
  }
  return { ok: true, text };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "That request wasn't accepted. Please try again from the page." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "That request didn't come through clearly. Please try again." });
  }

  const mode = payload.mode || "single";
  const country = cleanLabel(payload.country, "Canada");
  const region = cleanLabel(payload.region || payload.province, "Not specified");

  if (!["single", "extract", "reduce", "synthesize"].includes(mode)) {
    return reply(400, { error: "We didn't understand that request. Please try again from the page." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return reply(500, {
      error: "Server is missing its API key. Add ANTHROPIC_API_KEY in Netlify's environment variables.",
    });
  }

  try {
    let result;
    if (mode === "reduce" || mode === "synthesize") {
      const notes = normalizeDocument(payload.notes);
      if (!notes) {
        return reply(400, { error: "We didn't receive the notes from the earlier parts. Please try the document again." });
      }
      if (notes.length > MAX_SERVER_NOTES) {
        return reply(400, {
          error: "This document produced more notes than we can combine in one step. Please split it into two smaller parts and try each one.",
        });
      }
      const where = locationBlock(country, region);
      if (mode === "reduce") {
        result = await askModel({
          system: REDUCE_SYSTEM,
          maxTokens: 900,
          user: `${where}\n\nNotes from several parts of one document, in order:\n${notes}`,
        });
      } else {
        result = await askModel({
          system: SYSTEM_PROMPT,
          maxTokens: 1200,
          user: `${where}\n\nThe notes below were taken from every part of one insurance document, in order from the first page through the last. Later parts were not skipped. Give exclusions, conditions, and endorsements from the end the same attention as the opening.\n\nUse all of the notes when you write the four-part explanation.\n\nNotes:\n${notes}`,
        });
      }
    } else {
      const docText = normalizeDocument(payload.docText);
      if (!docText) {
        return reply(400, { error: "Please include some document text." });
      }
      if (docText.length > CHUNK_SIZE) {
        return reply(400, { error: pieceTooLongMessage() });
      }
      const where = locationBlock(country, region);
      if (mode === "extract") {
        const chunkIndex = Number.isInteger(payload.chunkIndex) ? payload.chunkIndex : 1;
        const chunkCount = Number.isInteger(payload.chunkCount) ? payload.chunkCount : 1;
        result = await askModel({
          system: EXTRACT_SYSTEM,
          maxTokens: 800,
          user: `${where}\n\nThis is part ${chunkIndex} of ${chunkCount}, in order. Read this part carefully. Exclusions in this part matter even if they feel like fine print.\n\nInsurance Document:\n${docText}`,
        });
      } else {
        result = await askModel({
          system: SYSTEM_PROMPT,
          maxTokens: 1000,
          user: `${where}\n\nInsurance Document:\n${docText}`,
        });
      }
    }

    if (!result.ok) return reply(result.statusCode, { error: result.error });
    return reply(200, { text: result.text });
  } catch (err) {
    console.error("decode function error:", err);
    return reply(500, { error: "Something went wrong while reading the document. Please try again in a moment." });
  }
}
