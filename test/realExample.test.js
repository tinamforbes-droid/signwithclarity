import assert from "node:assert/strict";
import test from "node:test";

import { realExample } from "../src/realExample.js";

const FORBIDDEN = [
  /free explanations left/i,
  /explications gratuites restantes/i,
  /explicaciones gratuitas restantes/i,
  /example person/i,
  /personne exemple/i,
  /persona ejemplo/i,
  /\b\d{1,5}\s+[A-Z][a-z]+ (Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd)\b/,
  /policy number/i,
  /numéro de police/i,
  /número de póliza/i,
];

test("the homepage example is the real tenants result, with personal details hidden", () => {
  assert.equal(realExample.placeholder, false);
  assert.equal(
    realExample.en.document,
    "Tenants insurance application, British Columbia (personal details hidden)",
  );
  assert.match(realExample.fr.document, /Colombie-Britannique/);
  assert.match(realExample.fr.document, /cachés/);
  assert.match(realExample.es.document, /Columbia Británica/);
  assert.match(realExample.es.document, /ocultos/);

  for (const lang of ["en", "fr", "es"]) {
    const text = Object.values(realExample[lang]).join("\n");
    for (const pattern of FORBIDDEN) {
      assert.equal(pattern.test(text), false, `${lang} matched ${pattern}`);
    }
    assert.match(text, /1969/);
    assert.match(text, /30/);
    for (const key of ["document", "summary", "flags", "questions", "terms"]) {
      assert.equal(typeof realExample[lang][key], "string");
    }
    assert.equal(realExample[lang].terms.length > 80, true);
  }

  assert.match(realExample.en.summary, /Comprehensive/);
  assert.match(realExample.en.summary, /2 dogs/);
  assert.match(realExample.en.flags, /\$350,000/);
  assert.match(realExample.en.questions, /\$525,000/);
  assert.match(realExample.en.terms, /VOID/);
  assert.match(realExample.fr.flags, /350 000/);
  assert.match(realExample.fr.questions, /525 000/);
  assert.match(realExample.es.flags, /\$350,000/);
  assert.match(realExample.es.questions, /\$525,000/);
});
