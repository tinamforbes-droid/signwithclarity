import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { runComparison } from "../shared/compareRun.js";
import { runDecode } from "../shared/decodeRun.js";
import { cleanImage, fittedSize, textIsEnough, MAX_IMAGE_DATA_CHARS } from "../shared/images.js";
import { decideComplete, decideRelease } from "../shared/entitlement.js";
import { compareDisabledReason, explainDisabledReason, showRunError } from "../shared/readiness.js";
import { handler as decode } from "../netlify/functions/decode.js";
import { isHeicFile, isPdfFile, readDocumentFiles } from "../src/readDocumentFile.js";

const USER = "11111111-1111-4111-8111-111111111111";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature";
const PHOTO = `PHOTOTESTMARKER${"A".repeat(40)}`;
const NOW = new Date("2026-11-02T15:00:00Z");

function sections() {
  return JSON.stringify({
    summary: "A short summary from the photo.",
    flags: "• A deductible is visible.",
    questions: "• What is the renewal date?",
    terms: "Deductible: the amount you pay first.",
  });
}

test("a scan with no text layer is not treated as a finished document", () => {
  assert.equal(textIsEnough("", 3), false);
  assert.equal(textIsEnough("Page 1", 4), false);
  assert.equal(textIsEnough("Named insured Sam Lee. Liability limit one million. Deductible five hundred.", 1), true);
  assert.deepEqual(fittedSize(4000, 2000), { width: 1568, height: 784 });
  assert.equal(cleanImage({ mediaType: "image/jpeg", data: PHOTO })?.data, PHOTO);
  assert.equal(cleanImage({ mediaType: "image/heic", data: PHOTO }), null);
  assert.equal(cleanImage({ mediaType: "image/jpeg", data: "short" }), null);
  assert.equal(cleanImage({ mediaType: "image/jpeg", data: "A".repeat(MAX_IMAGE_DATA_CHARS + 1) }), null);
  assert.equal(showRunError("compare", "This part took too long to read.", "Paste the wording, or add a photo of the pages."), true);
  assert.equal(showRunError("single", "Something went wrong.", "Paste the wording, or add a photo of the pages."), false);
  assert.equal(showRunError("compare", "", "Paste the wording, or add a photo of the pages."), false);
});

test("an image-only PDF becomes page photos, and a text PDF stays text", async () => {
  let rendered = 0;
  const scanned = await readDocumentFiles([{
    name: "Car Insurance.pdf",
    type: "application/pdf",
  }], {
    readPdf: async () => ({ text: " ", pageCount: 3 }),
    renderPdf: async () => {
      rendered += 1;
      return [
        { mediaType: "image/jpeg", data: PHOTO },
        { mediaType: "image/jpeg", data: `${PHOTO}BB` },
      ];
    },
  });
  assert.equal(rendered, 1);
  assert.equal(scanned.text, "");
  assert.equal(scanned.pages.length, 2);
  assert.equal(scanned.fileName, "Car Insurance.pdf");
  assert.equal(scanned.errorKey, "");

  const wording = "This is a real text policy with a named insured, a limit, and a deductible of five hundred dollars.";
  const textPdf = await readDocumentFiles([{ name: "Westland_Application.pdf", type: "application/pdf" }], {
    readPdf: async () => ({ text: wording, pageCount: 2 }),
    renderPdf: async () => {
      throw new Error("a text PDF should not be rendered");
    },
  });
  assert.equal(textPdf.text, wording);
  assert.equal(textPdf.pages.length, 0);

  const heic = await readDocumentFiles([{ name: "page.HEIC", type: "" }], {
    convertHeic: async () => [{ kind: "jpeg-blob" }],
    encodeImage: async () => ({ mediaType: "image/jpeg", data: PHOTO }),
  });
  assert.equal(isHeicFile({ name: "page.HEIC", type: "" }), true);
  assert.equal(isPdfFile({ name: "Car Insurance.pdf", type: "" }), true);
  assert.equal(heic.pages.length, 1);
  assert.equal(heic.errorKey, "");
});

test("a disabled compare button names the file that had no text", () => {
  const reason = compareDisabledReason("en", {
    allowed: true,
    policies: [
      { text: "A full auto policy with liability and a deductible of five hundred dollars.", fileName: "Westland_Application.pdf" },
      { text: "", pages: [], fileName: "Car Insurance.pdf", problem: "noText" },
    ],
  });
  assert.equal(reason, "We couldn't find any text in Car Insurance.pdf.");

  const french = compareDisabledReason("fr", {
    allowed: true,
    policies: [{ text: "", fileName: "Car Insurance.pdf", problem: "noText" }],
  });
  assert.match(french, /Car Insurance\.pdf/);
  assert.match(french, /texte/);

  assert.equal(compareDisabledReason("en", {
    allowed: true,
    policies: [
      { text: "Policy one has enough words to be a real document for this test case." },
      { text: "Policy two has enough words to be a real document for this test case." },
    ],
  }), "");

  assert.match(compareDisabledReason("en", {
    allowed: false,
    policies: [{ text: "", pages: [] }, { text: "", pages: [] }],
  }), /Household Check/);

  assert.match(explainDisabledReason("es", {
    text: "",
    pages: [],
    fileName: "Car Insurance.pdf",
    problem: "noText",
  }), /Car Insurance\.pdf/);
});

test("a photo is sent to the model and is not stored on the account", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ text: sections() }] }),
    };
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 4, checks_remaining: 1 },
  });
  const response = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.9" },
    body: JSON.stringify({
      mode: "single",
      image: { mediaType: "image/jpeg", data: PHOTO },
      language: "en",
      country: "Canada",
      region: "British Columbia",
      explanationId: randomUUID(),
    }),
  }, {
    accountStore: accounts,
    usageStore: { async get() { return { value: null, etag: null }; }, async compareAndSet() { return true; } },
    now: NOW,
    verifySession: async () => ({ id: USER, email: "ada@example.com" }),
  });
  assert.equal(response.statusCode, 200);
  const blocks = sent.messages[0].content;
  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[0].source.media_type, "image/jpeg");
  assert.equal(blocks[0].source.data, PHOTO);
  assert.match(blocks[1].text, /photo or scan/);
  assert.match(blocks[1].text, /British Columbia/);
  assert.equal(JSON.stringify(accounts.snapshot()).includes("PHOTOTESTMARKER"), false);

  sent = null;
  const rejected = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      mode: "extract",
      image: { mediaType: "image/heic", data: PHOTO },
      language: "fr",
      country: "Canada",
      region: "British Columbia",
      explanationId: randomUUID(),
    }),
  }, {
    accountStore: accounts,
    now: NOW,
    verifySession: async () => ({ id: USER, email: "ada@example.com" }),
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(sent, null);
});

test("several photos are one explanation, and a comparison of photos spends one check", async () => {
  const calls = [];
  const request = async (payload) => {
    calls.push(payload);
    if (payload.mode === "compare") {
      return JSON.stringify({
        policies: payload.policies.map((policy) => ({ label: policy.label, summary: `Read ${policy.label}.` })),
        table: payload.policies.map((policy) => ({
          label: policy.label,
          covered: "Fire",
          limits: "$1,000",
          deductible: "$500",
          exclusions: "Flood",
          renewal: "March 1",
        })),
        gaps: "• Flood.",
        overlaps: "• Liability.",
        questions: "• What is the deductible?",
      });
    }
    if (payload.mode === "synthesize" || payload.mode === "single") return sections();
    assert.ok(payload.image);
    assert.equal(payload.image.data.includes("PHOTOTESTMARKER"), true);
    return JSON.stringify({
      coverage: "A page.",
      facts: "• Deductible $500",
      flags: "• None in this part.",
      questions: "• None in this part.",
      terms: "",
    });
  };
  const image = { mediaType: "image/jpeg", data: PHOTO };
  const explained = await runDecode({
    pages: [image, { ...image, data: `${PHOTO}CC` }],
    country: "Canada",
    region: "British Columbia",
    language: "en",
    explanationId: "11111111-1111-4111-8111-111111111111",
    request,
    sleep: async () => {},
  });
  assert.equal(explained.parts, 2);
  assert.equal(calls.filter((call) => call.mode === "extract").length, 2);
  assert.equal(calls.filter((call) => call.mode === "synthesize").length, 1);
  assert.ok(calls.every((call) => call.explanationId === "11111111-1111-4111-8111-111111111111"));

  calls.length = 0;
  const compared = await runComparison({
    policies: [
      { label: "Car", pages: [image] },
      { label: "Home", pages: [image, image] },
    ],
    country: "Canada",
    region: "British Columbia",
    language: "fr",
    comparisonId: "22222222-2222-4222-8222-222222222222",
    request,
    sleep: async () => {},
  });
  assert.equal(compared.comparison.policies[0].label, "Car");
  const ids = new Set(calls.map((call) => call.explanationId));
  assert.deepEqual([...ids], ["22222222-2222-4222-8222-222222222222"]);
  assert.equal(calls.filter((call) => call.image).length, 3);
  assert.equal(calls.filter((call) => call.mode === "compare").length, 1);
  assert.equal(calls.filter((call) => call.mode === "compare")[0].language, "fr");
});

test("a comparison that fails on a later page gives the Household Check back", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ content: [{ text: sections() }] }),
      };
    }
    return { ok: false, status: 504, text: async () => "<html>timeout</html>" };
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 4, checks_remaining: 1 },
  });
  const context = {
    accountStore: accounts,
    now: NOW,
    verifySession: async () => ({ id: USER, email: "ada@example.com" }),
  };
  const id = randomUUID();
  const headers = { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.15" };
  const first = await decode({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({
      mode: "extract",
      purpose: "compare",
      docText: "Tenant insurance wording with a deductible of five hundred dollars.",
      language: "en",
      country: "Canada",
      region: "British Columbia",
      explanationId: id,
      comparisonId: id,
    }),
  }, context);
  assert.equal(first.statusCode, 200);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 0);
  assert.equal(accounts.snapshot()[USER].explanation_claims[id].open, true);

  const failed = await decode({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({
      mode: "extract",
      purpose: "compare",
      image: { mediaType: "image/jpeg", data: PHOTO },
      chunkIndex: 2,
      chunkCount: 3,
      language: "en",
      country: "Canada",
      region: "British Columbia",
      explanationId: id,
      comparisonId: id,
    }),
  }, context);
  assert.equal(failed.statusCode, 504);
  assert.match(JSON.parse(failed.body).error, /too long|trop de temps|demasiado/i);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 1);
  assert.equal(accounts.snapshot()[USER].explanation_claims[id], undefined);

  const again = await decode({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({
      mode: "release",
      comparisonId: id,
      explanationId: id,
      language: "en",
    }),
  }, context);
  assert.equal(again.statusCode, 200);
  assert.equal(JSON.parse(again.body).released, false);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 1);
});

test("a finished comparison is not refunded", () => {
  const id = randomUUID();
  const open = {
    paid: true,
    plan: "household",
    credits_remaining: 0,
    checks_remaining: 0,
    explanation_claims: { [id]: { n: 4, plan: "check", open: true } },
  };
  const finished = decideComplete(open, id).account;
  assert.equal(finished.explanation_claims[id].open, false);
  const refund = decideRelease(finished, id);
  assert.equal(refund.restore, false);
  assert.equal(refund.account.checks_remaining, 0);
  const unfinished = decideRelease(open, id);
  assert.equal(unfinished.restore, true);
  assert.equal(unfinished.account.checks_remaining, 1);
});
