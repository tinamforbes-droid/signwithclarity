import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  OWNER_LEGAL_NAME,
  STORAGE_NOTE,
  documentPlainText,
  effectiveDateLine,
  legalDocument,
  privacyPolicy,
  splitLegalText,
  storageNote,
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
  assert.equal(EFFECTIVE_DATE, "November 2, 2026");
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
  assert.match(privacy, /localStorage to remember the language/);
  assert.equal(privacy.includes("does not use localStorage"), false);
  assert.match(privacy, /does not store your document in localStorage/);
  assert.match(privacy, /Sign-in is optional/);
  assert.match(privacy, /email address/);
  assert.match(privacy, /ldhkqqhlztsaljccazti\.supabase\.co/);
  assert.match(privacy, /row level security/i);
  assert.match(privacy, /SUPABASE_SECRET_KEY/);
  assert.match(privacy, /paid flag stays false/);
  assert.match(privacy, /swc-auth/);
  assert.match(privacy, /There is no password/);
  assert.equal(privacy.includes("There is no account to attach"), false);
  assert.match(privacy, /salted hash/);
  assert.match(privacy, /calendar month/);
  assert.match(privacy, /Netlify Blobs/);
  assert.match(privacy, /not the address/);
  assert.match(privacy, /Clearing the browser does not start the count over/);
  assert.equal(privacy.includes("does not read or save your IP address"), false);
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

function sectionShape(doc) {
  return doc.sections.map((section) => section.blocks.map((block) => block.type).join(","));
}

test("French and Spanish legal pages match the English shape and describe the language choice", () => {
  for (const lang of ["fr", "es"]) {
    const privacyDoc = legalDocument("privacy", lang);
    const termsDoc = legalDocument("terms", lang);
    assert.deepEqual(sectionShape(privacyDoc), sectionShape(privacyPolicy));
    assert.deepEqual(sectionShape(termsDoc), sectionShape(termsOfUse));
    const privacyText = documentPlainText(privacyDoc);
    const termsText = documentPlainText(termsDoc);
    assert.equal(privacyText.includes(OWNER_LEGAL_NAME), true);
    assert.equal(privacyText.includes(CONTACT_EMAIL), true);
    assert.equal(termsText.includes(CONTACT_EMAIL), true);
    assert.match(privacyText, /localStorage/);
    assert.match(privacyText, /Netlify Blobs/);
    assert.match(privacyText, /PIPEDA/);
    assert.match(privacyText, /PIPA/);
    assert.match(privacyText, /pdf\.js/);
    assert.match(privacyText, /\/\.netlify\/functions\/decode/);
    assert.match(privacyText, /claude-sonnet-4-6/);
    assert.match(privacyText, /ANTHROPIC_API_KEY/);
    assert.equal(privacyText.includes("does not use localStorage"), false);
    assert.equal(termsText.includes(storageNote(lang)), true);
    assert.equal(privacyText.includes(STORAGE_NOTE), false);
  }

  assert.match(documentPlainText(legalDocument("privacy", "fr")), /pour retenir la langue/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /session de connexion/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /adresse courriel/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /SUPABASE_SECRET_KEY/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /indicateur payé/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /para recordar el idioma/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /sesión de acceso/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /correo electrónico/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /SUPABASE_SECRET_KEY/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /indicador de pago/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /hachage salé/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /mois civil/);
  assert.match(documentPlainText(legalDocument("privacy", "fr")), /ne remet pas le compte à zéro/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /hash con sal/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /mes calendario/);
  assert.match(documentPlainText(legalDocument("privacy", "es")), /no vuelve a poner la cuenta en cero/);
  assert.equal(documentPlainText(legalDocument("privacy", "fr")).includes("ne lit pas et ne sauvegarde pas votre adresse IP"), false);
  assert.equal(documentPlainText(legalDocument("privacy", "es")).includes("no lee ni guarda su dirección IP"), false);
  assert.equal(effectiveDateLine("en"), "Effective date: November 2, 2026");
  assert.match(effectiveDateLine("fr"), /2 novembre 2026/);
  assert.match(effectiveDateLine("es"), /2 de noviembre de 2026/);
  assert.match(storageNote("fr"), /ne sont pas conservés/);
  assert.match(storageNote("es"), /no se guardan/);
  assert.equal(storageNote("en"), STORAGE_NOTE);
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
