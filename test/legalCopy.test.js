import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  OWNER_LEGAL_NAME,
  STORAGE_NOTE,
  documentPlainText,
  privacyPolicy,
  splitLegalText,
  termsOfUse,
} from "../src/legalCopy.js";

const privacy = documentPlainText(privacyPolicy);
const terms = documentPlainText(termsOfUse);

test("both pages name the operator, the contact email, and the effective date", () => {
  for (const text of [privacy, terms]) {
    assert.match(text, new RegExp(EFFECTIVE_DATE));
    assert.equal(text.includes(OWNER_LEGAL_NAME), true);
    assert.equal(text.includes(CONTACT_EMAIL), true);
    assert.equal(text.includes("[OWNER LEGAL NAME]"), false);
    assert.equal(text.includes("[CONTACT EMAIL]"), false);
  }
  assert.equal(OWNER_LEGAL_NAME, "Tina Forbes, operating as Quiet Clarity Within");
  assert.equal(CONTACT_EMAIL, "hello@quietclaritywithin.com");
  assert.equal(EFFECTIVE_DATE, "November 1, 2026");
});

test("the privacy policy describes only the collection the code performs", () => {
  assert.match(privacy, /PIPEDA/);
  assert.match(privacy, /Personal Information Protection Act \(PIPA\)/);
  assert.match(privacy, /British Columbia/);
  assert.match(privacy, /United States/);
  assert.match(privacy, /pdf\.js/);
  assert.match(privacy, /cdnjs\.cloudflare\.com/);
  assert.match(privacy, /fonts\.googleapis\.com/);
  assert.match(privacy, /\/\.netlify\/functions\/decode/);
  assert.match(privacy, /api\.anthropic\.com/);
  assert.match(privacy, /claude-sonnet-4-6/);
  assert.match(privacy, /ANTHROPIC_API_KEY/);
  assert.match(privacy, /does not set cookies/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /analytics/);
  assert.match(privacy, /HTTP status code/);
  assert.match(privacy, /do not sell personal information/i);
  assert.match(privacy, /Documents aren't stored/);
  assert.match(privacy, /file name stays in the browser/i);
  assert.equal(privacy.includes("Google Analytics"), false);
  assert.equal(privacy.includes("we encrypt"), false);
});

test("the contact email splits out so the page can link it", () => {
  const parts = splitLegalText(`Write to ${CONTACT_EMAIL} about a question.`);
  assert.deepEqual(parts, ["Write to ", CONTACT_EMAIL, " about a question."]);
});

test("the terms limit the site to education and say the model can be wrong", () => {
  assert.match(terms, /education and general information/);
  assert.match(terms, /not insurance advice/);
  assert.match(terms, /not legal advice/);
  assert.match(terms, /not financial advice/);
  assert.match(terms, /does not recommend coverage/);
  assert.match(terms, /not a licensed insurance professional/);
  assert.match(terms, /AI can make mistakes/);
  assert.match(terms, /insurer or broker/);
  assert.match(terms, /Documents aren't stored/);
  assert.match(STORAGE_NOTE, /Documents aren't stored/);
});
