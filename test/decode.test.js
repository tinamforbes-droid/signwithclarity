import assert from "node:assert/strict";
import test from "node:test";

import { DecodeError, postDecode, runDecode } from "../shared/decodeRun.js";
import {
  CHUNK_SIZE,
  planDocument,
  tooLongMessage,
} from "../shared/limits.js";
import {
  END_EXCLUSION,
  MIDPOINT_MARKER,
  OPENING_MARKER,
  buildSamplePolicy,
} from "../shared/samplePolicy.js";
import { handler } from "../netlify/functions/decode.js";

const sleep = async () => {};

function sectionsFrom(text) {
  return JSON.stringify({
    summary: "A short summary of the document.",
    flags: text || "• Nothing surprising in this short excerpt.",
    questions: "• What is my deductible?",
    terms: "Deductible: the amount you pay first.",
  });
}

function assertCovered(trimmed, ranges) {
  assert.equal(ranges[0].start, 0);
  let cursor = 0;
  for (const range of ranges) {
    assert.ok(range.start <= cursor, `gap at ${range.start}, cursor ${cursor}`);
    assert.ok(range.end > range.start);
    cursor = range.end;
  }
  assert.equal(cursor, trimmed.length);
}

test("a document past the old 4,000 character cut is sent in full when it fits in one part", async () => {
  const text = `${"Coverage for the dwelling. ".repeat(200)}TAIL_MARKER_PAST_4000`;
  assert.ok(text.length > 4000);
  assert.ok(text.length <= CHUNK_SIZE);
  assert.equal(text.slice(0, 4000).includes("TAIL_MARKER_PAST_4000"), false);

  const calls = [];
  const outcome = await runDecode({
    text,
    country: "Canada",
    region: "Alberta",
    request: async (payload) => {
      calls.push(payload);
      return sectionsFrom(payload.docText);
    },
    sleep,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "single");
  assert.equal(calls[0].docText.includes("TAIL_MARKER_PAST_4000"), true);
  assert.equal(calls[0].docText.length, text.length);
  assert.equal(outcome.parts, 1);
  assert.match(outcome.results.summary, /short summary/);
});

test("a long sample policy is read through the closing exclusion, not only the first 4,000 characters", async () => {
  const policy = buildSamplePolicy({ pages: 55 });
  assert.ok(policy.length > 4000);
  assert.equal(policy.slice(0, 4000).includes(END_EXCLUSION), false);
  assert.equal(policy.includes(END_EXCLUSION), true);
  assert.equal(policy.includes(MIDPOINT_MARKER), true);

  const plan = planDocument(policy);
  assert.equal(plan.ok, true);
  assert.ok(plan.chunks.length > 1);
  assert.ok(plan.chunks.length <= 24);
  for (const chunk of plan.chunks) assert.ok(chunk.length <= CHUNK_SIZE);
  assertCovered(policy.trim(), plan.ranges);
  assert.equal(plan.chunks[0].includes(OPENING_MARKER), true);
  assert.equal(plan.chunks[0].includes(END_EXCLUSION), false);
  assert.equal(plan.chunks.at(-1).includes(END_EXCLUSION), true);
  assert.equal(plan.chunks.some((chunk) => chunk.includes(MIDPOINT_MARKER)), true);

  const calls = [];
  const progress = [];
  const outcome = await runDecode({
    text: policy,
    country: "Canada",
    region: "Alberta",
    onProgress: (update) => progress.push(update),
    request: async (payload) => {
      calls.push(payload);
      if (payload.mode === "extract") {
        const flag = payload.docText.includes(END_EXCLUSION)
          ? END_EXCLUSION
          : "no end exclusion in this part";
        return JSON.stringify({ flags: flag, coverage: "part", facts: "", questions: "", terms: "" });
      }
      if (payload.mode === "reduce") return payload.notes;
      return sectionsFrom(payload.notes || payload.docText);
    },
    sleep,
  });

  const extracts = calls.filter((call) => call.mode === "extract");
  assert.equal(extracts.length, plan.chunks.length);
  assert.deepEqual(
    extracts.map((call) => call.chunkIndex),
    plan.chunks.map((_, index) => index + 1)
  );
  assert.equal(extracts.at(-1).docText.includes(END_EXCLUSION), true);
  assert.equal(extracts[0].docText.includes(END_EXCLUSION), false);
  for (const call of extracts) assert.ok(call.docText.length <= CHUNK_SIZE);

  const synth = calls.find((call) => call.mode === "synthesize");
  assert.ok(synth);
  assert.equal(synth.notes.includes(END_EXCLUSION), true);
  assert.equal(outcome.results.flags.includes(END_EXCLUSION), true);
  assert.equal(outcome.parts, plan.chunks.length);
  assert.equal(progress.at(0).phase, "reading");
  assert.equal(progress.at(-1).phase, "combining");
  assert.equal(calls.some((call) => call.mode === "single"), false);
});

test("a document that is too long is refused with a clear message and no model call", async () => {
  const policy = buildSamplePolicy({ pages: 90 });
  const plan = planDocument(policy);
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, "too_long");
  const message = tooLongMessage(plan);
  assert.match(message, /too long/i);
  assert.match(message, /only the beginning/);
  assert.ok(plan.maxPages >= 60 && plan.maxPages <= 75);

  let calls = 0;
  await assert.rejects(
    () => runDecode({
      text: policy,
      country: "United States",
      region: "Ohio",
      request: async () => {
        calls += 1;
        return sectionsFrom("unused");
      },
      sleep,
    }),
    (err) => err instanceof DecodeError && /only the beginning/.test(err.message)
  );
  assert.equal(calls, 0);
});

test("a failed part is retried once, then stops without pretending the reading is complete", async () => {
  const policy = buildSamplePolicy({ pages: 18 });
  let attempts = 0;
  const calls = [];
  await assert.rejects(
    () => runDecode({
      text: policy,
      country: "Canada",
      region: "Alberta",
      request: async (payload) => {
        calls.push(payload.mode);
        if (payload.mode === "extract") {
          attempts += 1;
          throw new DecodeError("We're a little busy right now. Please wait a moment and try again.", {
            retryable: true,
          });
        }
        return sectionsFrom("nope");
      },
      sleep,
    }),
    (err) => {
      assert.match(err.message, /part 1 of/);
      assert.match(err.message, /stopped/);
      assert.match(err.message, /isn't complete/);
      return true;
    }
  );
  assert.equal(attempts, 2);
  assert.equal(calls.includes("synthesize"), false);
});

test("a setup problem is passed through instead of a generic failure", async () => {
  const setup = "Server is missing its API key. Add ANTHROPIC_API_KEY in Netlify's environment variables.";
  await assert.rejects(
    () => runDecode({
      text: "A short policy clause about hail.",
      country: "Canada",
      region: "Alberta",
      request: async () => {
        throw new DecodeError(setup, { retryable: false });
      },
      sleep,
    }),
    (err) => err.message === setup
  );
});

test("fenced model JSON still becomes the four sections", async () => {
  const outcome = await runDecode({
    text: "A one-page renewal notice.",
    country: "Canada",
    region: "Quebec",
    request: async () => `Here you go:\n\`\`\`json\n${sectionsFrom("• Watch the renewal date.")}\n\`\`\``,
    sleep,
  });
  assert.match(outcome.results.flags, /renewal date/);
  assert.equal(typeof outcome.results.terms, "string");
});

test("postDecode turns network, timeout, and plain server errors into kind messages", async () => {
  await assert.rejects(
    () => postDecode({}, {
      fetchImpl: async () => {
        throw new Error("failed to fetch");
      },
    }),
    (err) => err.retryable && /connection/.test(err.message)
  );

  await assert.rejects(
    () => postDecode({}, {
      timeoutMs: 20,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
    }),
    (err) => err.retryable && /longer than expected/.test(err.message)
  );

  await assert.rejects(
    () => postDecode({}, {
      fetchImpl: async () => ({
        ok: false,
        status: 504,
        text: async () => "<html>gateway timeout</html>",
      }),
    }),
    (err) => err.retryable && /too long to read/.test(err.message)
  );

  const busy = "We're a little busy right now. Please wait a moment and try again.";
  await assert.rejects(
    () => postDecode({}, {
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: busy }),
      }),
    }),
    (err) => err.retryable && err.message === busy
  );

  const text = await postDecode({ docText: "hi" }, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: "plain answer" }),
    }),
  });
  assert.equal(text, "plain answer");
});

test("chunk boundaries cover a long line and windows newlines without dropping the end", () => {
  const packed = `${"A".repeat(CHUNK_SIZE + 500)}END`;
  const packedPlan = planDocument(packed);
  assert.equal(packedPlan.ok, true);
  assert.ok(packedPlan.chunks.length >= 2);
  assertCovered(packed, packedPlan.ranges);
  assert.equal(packedPlan.chunks.at(-1).includes("END"), true);

  const windows = `Hello\r\n\r\n${"word ".repeat(4000)}\r\n\r\nENDMARK`;
  const windowsPlan = planDocument(windows);
  assert.equal(windowsPlan.ok, true);
  assertCovered(windowsPlan.chars ? windows.replace(/\r\n/g, "\n").trim() : "", windowsPlan.ranges);
  assert.equal(windowsPlan.chunks.at(-1).includes("ENDMARK"), true);
});

function jsonResponse(status, obj) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(obj),
  };
}

function mockAnthropic(responder) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    const result = await responder(body);
    return jsonResponse(result.status, result.body);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test("the function sends a whole short document, including text past 4,000 characters", async (t) => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  });

  const docText = `${"Named peril wording. ".repeat(250)}SERVER_TAIL_MARKER`;
  assert.ok(docText.length > 4000);
  const anthropic = mockAnthropic(async () => ({
    status: 200,
    body: { content: [{ text: sectionsFrom("• A flag.") }] },
  }));
  t.after(() => anthropic.restore());

  const response = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ docText, country: "Canada", region: "Alberta" }),
  });
  assert.equal(response.statusCode, 200);
  const sent = anthropic.calls[0].body.messages[0].content;
  assert.equal(sent.includes("SERVER_TAIL_MARKER"), true);
  assert.equal(sent.includes(docText), true);
  assert.equal(anthropic.calls[0].body.max_tokens, 1000);
  assert.equal(anthropic.calls[0].body.model, "claude-sonnet-4-6");
});

test("the function refuses an oversized piece instead of truncating it", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  let called = false;
  const anthropic = mockAnthropic(async () => {
    called = true;
    return { status: 200, body: { content: [{ text: "nope" }] } };
  });
  t.after(() => anthropic.restore());

  const response = await handler({
    httpMethod: "POST",
    body: JSON.stringify({
      mode: "single",
      docText: "X".repeat(CHUNK_SIZE + 50),
      country: "Canada",
      region: "Alberta",
    }),
  });
  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.match(body.error, /didn't use only the beginning/);
  assert.equal(called, false);
});

test("extract keeps the part text, and a busy model becomes a kind error", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic(async (body) => {
    if (body.messages[0].content.includes("PLEASE_429")) {
      return { status: 429, body: { error: { type: "rate_limit" } } };
    }
    return { status: 200, body: { content: [{ text: "{\"flags\":\"noted\"}" }] } };
  });
  t.after(() => anthropic.restore());

  const part = `Opening of this part. ${"clause ".repeat(20)} PLEASE_KEEP volcanic exclusion.`;
  const ok = await handler({
    httpMethod: "POST",
    body: JSON.stringify({
      mode: "extract",
      docText: part,
      chunkIndex: 4,
      chunkCount: 9,
      country: "United States",
      region: "Ohio",
    }),
  });
  assert.equal(ok.statusCode, 200);
  const sent = anthropic.calls[0].body.messages[0].content;
  assert.match(sent, /part 4 of 9/);
  assert.equal(sent.includes("PLEASE_KEEP volcanic exclusion."), true);
  assert.match(anthropic.calls[0].body.system, /ONE part/);

  const busy = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ mode: "extract", docText: "PLEASE_429", country: "Canada", region: "Alberta" }),
  });
  assert.equal(busy.statusCode, 429);
  assert.match(JSON.parse(busy.body).error, /a little busy/);
});

test("synthesize asks for the same four sections and keeps the later notes", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic(async () => ({
    status: 200,
    body: { content: [{ text: sectionsFrom("• Late exclusion.") }] },
  }));
  t.after(() => anthropic.restore());

  const notes = `Part 1 notes.\n\nPart 8 notes. ${END_EXCLUSION}`;
  const response = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ mode: "synthesize", notes, country: "Canada", province: "Manitoba" }),
  });
  assert.equal(response.statusCode, 200);
  const request = anthropic.calls[0].body;
  assert.match(request.system, /plain, simple English/);
  assert.match(request.messages[0].content, /Later parts were not skipped/);
  assert.equal(request.messages[0].content.includes(END_EXCLUSION), true);
  assert.match(request.messages[0].content, /Manitoba/);
  assert.equal(request.max_tokens, 1200);
});

test("missing text, a missing key, and a non-POST are plain errors", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const missingKey = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ docText: "hello" }),
  });
  assert.equal(missingKey.statusCode, 500);
  assert.match(JSON.parse(missingKey.body).error, /ANTHROPIC_API_KEY/);

  process.env.ANTHROPIC_API_KEY = "test-key";
  const empty = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ docText: "   " }),
  });
  assert.equal(empty.statusCode, 400);
  assert.match(JSON.parse(empty.body).error, /some document text/);

  const method = await handler({ httpMethod: "GET", body: "" });
  assert.equal(method.statusCode, 405);

  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousKey;
});
