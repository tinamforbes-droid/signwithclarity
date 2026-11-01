import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_EMAIL_PLACEHOLDER,
  EFFECTIVE_DATE,
  OWNER_NAME_PLACEHOLDER,
  STORAGE_NOTE,
  documentPlainText,
  privacyPolicy,
  splitLegalText,
  termsOfUse,
} from "../src/legalCopy.js";

const privacy = documentPlainText(privacyPolicy);
const terms = documentPlainText(termsOfUse);

test("both pages name the effective date and leave the owner placeholders", () => {
  for (const text of [privacy, terms]) {
    assert.match(text, new RegExp(EFFECTIVE_DATE));
    assert.match(text, /\[OWNER LEGAL NAME\]/);
    assert.match(text, /\[CONTACT EMAIL\]/);
    assert.equal(text.includes(OWNER_NAME_PLACEHOLDER), true);
    assert.equal(text.includes(CONTACT_EMAIL_PLACEHOLDER), true);
  }
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

test("placeholders split out of the surrounding sentence", () => {
  const parts = splitLegalText(`Run by ${OWNER_NAME_PLACEHOLDER}. Write to ${CONTACT_EMAIL_PLACEHOLDER}.`);
  assert.deepEqual(parts, ["Run by ", OWNER_NAME_PLACEHOLDER, ". Write to ", CONTACT_EMAIL_PLACEHOLDER, "."]);
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
