import assert from "node:assert/strict";
import test from "node:test";

import { longDocumentNote, tooLongMessage } from "../shared/limits.js";
import {
  LANG_STORAGE_KEY,
  LANGUAGE_CHOICES,
  MESSAGES,
  htmlLang,
  languageFromTags,
  loadingCopy,
  pageTitle,
  resolveLanguage,
  storeLanguage,
  t,
} from "../shared/messages.js";
import { systemFor } from "../shared/prompts.js";
import {
  commitRegion,
  filterRegionOptions,
  regionOptions,
} from "../shared/regions.js";

test("browser language picks French or Spanish, and a saved choice wins", () => {
  assert.equal(languageFromTags(["fr-CA", "en-US"]), "fr");
  assert.equal(languageFromTags(["es-MX"]), "es");
  assert.equal(languageFromTags(["es-419", "en"]), "es");
  assert.equal(languageFromTags(["de-DE", "en"]), "en");
  assert.equal(languageFromTags([]), "en");
  assert.equal(htmlLang("fr"), "fr-CA");
  assert.equal(htmlLang("es"), "es-419");
  assert.equal(htmlLang("en"), "en");

  const storage = {
    value: "",
    getItem(key) {
      assert.equal(key, LANG_STORAGE_KEY);
      return this.value;
    },
    setItem(key, next) {
      assert.equal(key, LANG_STORAGE_KEY);
      this.value = next;
    },
  };
  assert.equal(resolveLanguage({ storage, tags: ["fr-CA"] }), "fr");
  storeLanguage(storage, "es");
  assert.equal(storage.value, "es");
  assert.equal(resolveLanguage({ storage, tags: ["en-CA"] }), "es");

  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(resolveLanguage({ storage: blocked, tags: ["fr"] }), "fr");
});

test("every short string exists in French and Spanish, with the same placeholders", () => {
  const keys = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(Object.keys(MESSAGES.fr).sort(), keys);
  assert.deepEqual(Object.keys(MESSAGES.es).sort(), keys);
  for (const key of keys) {
    assert.ok(MESSAGES.fr[key].trim(), key);
    assert.ok(MESSAGES.es[key].trim(), key);
    const placeholders = (MESSAGES.en[key].match(/\{[a-z]+\}/g) || []).sort();
    assert.deepEqual((MESSAGES.fr[key].match(/\{[a-z]+\}/g) || []).sort(), placeholders, key);
    assert.deepEqual((MESSAGES.es[key].match(/\{[a-z]+\}/g) || []).sort(), placeholders, key);
  }

  assert.equal(t("en", "decodeButton"), "Explain my document");
  assert.equal(t("fr", "decodeButton"), "Expliquer mon document");
  assert.equal(t("es", "decodeButton"), "Explicar mi documento");
  assert.notEqual(t("fr", "sectionSummary"), t("en", "sectionSummary"));
  assert.notEqual(t("es", "sectionFlags"), t("en", "sectionFlags"));
  assert.equal(t("en", "errorBusy"), "We're a little busy right now. Please wait a moment and try again.");
  assert.match(t("fr", "loadingPart", { current: 2, total: 5 }), /Partie 2 de 5/);
  assert.match(t("es", "loadingPart", { current: 2, total: 5 }), /Parte 2 de 5/);
  assert.equal(pageTitle("fr", "privacy"), MESSAGES.fr.pageTitlePrivacy);
  assert.match(t("en", "signInCheckEmail", { email: "ada@example.com" }), /^Check your email/);
  assert.match(t("en", "signInCheckEmail", { email: "ada@example.com" }), /ada@example.com/);
  assert.match(t("fr", "signInCheckEmail", { email: "ada@example.com" }), /courriel/i);
  assert.match(t("es", "signInCheckEmail", { email: "ada@example.com" }), /correo/);
  assert.match(t("en", "signInOptional"), /optional/i);
  assert.match(t("fr", "signOutButton"), /déconnecter/);
  assert.match(t("es", "signOutButton"), /Cerrar sesión/);
  assert.equal(LANGUAGE_CHOICES.map((choice) => choice.label).join(","), "English,Français,Español");
});

test("length notes and the required-region hints are translated, and English stays the same", () => {
  const plan = { pages: 4, maxPages: 70 };
  const english = tooLongMessage(plan);
  assert.match(english, /too long/i);
  assert.match(english, /only the beginning/);
  assert.match(longDocumentNote({ pages: 1 }), /about a page/);
  assert.match(longDocumentNote({ pages: 3 }), /about 3 pages/);

  const french = tooLongMessage(plan, "fr");
  assert.match(french, /trop long/);
  assert.match(french, /sans vous le dire/);
  assert.equal(french.includes("only the beginning"), false);
  const spanish = tooLongMessage(plan, "es");
  assert.match(spanish, /demasiado largo/);
  assert.match(spanish, /sin decírselo/);

  const progress = loadingCopy("fr", { phase: "reading", current: 3, total: 8 });
  assert.match(progress.sub, /Partie 3 de 8/);
  assert.match(progress.sub, /exclusions/);
  const combining = loadingCopy("es", { phase: "combining", current: 8, total: 8 });
  assert.match(combining.title, /Juntando/);
});

test("French and Spanish prompts keep the same sections and do not ask for English", () => {
  for (const mode of ["single", "extract", "reduce", "synthesize"]) {
    const kind = mode === "extract" || mode === "reduce" ? mode : "single";
    for (const lang of ["en", "fr", "es"]) {
      const system = systemFor(kind, lang);
      if (kind === "single") {
        for (const key of ["summary", "flags", "questions", "terms"]) {
          assert.match(system, new RegExp(`"${key}"`));
        }
      } else {
        for (const key of ["coverage", "facts", "flags", "questions", "terms"]) {
          assert.match(system, new RegExp(`"${key}"`));
        }
      }
    }
  }
  assert.match(systemFor("single", "en"), /plain, simple English/);
  assert.match(systemFor("extract", "en"), /ONE part/);
  assert.match(systemFor("single", "fr"), /Canadian French/);
  assert.match(systemFor("extract", "fr"), /Canadian French/);
  assert.match(systemFor("reduce", "es"), /Latin American Spanish/);
  assert.match(systemFor("single", "es"), /Latin American Spanish/);
  assert.equal(systemFor("single", "fr").includes("plain, simple English"), false);

  for (const lang of ["en", "fr", "es"]) {
    const system = systemFor("compare", lang);
    for (const key of ["policies", "table", "gaps", "overlaps", "questions"]) {
      assert.match(system, new RegExp(`"${key}"`));
    }
    assert.match(system, /scare words/);
    assert.match(system, /do not tell the person which policy/i);
  }
  assert.match(systemFor("compare", "fr"), /Canadian French/);
  assert.match(systemFor("compare", "es"), /Latin American Spanish/);
  const comparing = loadingCopy("fr", { phase: "reading", policy: 2, policies: 4, current: 3, total: 8 });
  assert.match(comparing.title, /police 2 de 4/);
  assert.match(loadingCopy("es", { phase: "comparing", policies: 2 }).title, /Comparando/);
});

test("province names are shown in French and Spanish, and the blank picker still needs an exact choice", () => {
  const english = regionOptions("Canada", "en");
  for (const option of english) assert.equal(option.label, option.value);
  for (const option of regionOptions("United States", "en")) assert.equal(option.label, option.value);

  const french = regionOptions("Canada", "fr");
  assert.equal(french.find((option) => option.value === "British Columbia").label, "Colombie-Britannique");
  assert.equal(french.find((option) => option.value === "Quebec").label, "Québec");
  assert.equal(french.find((option) => option.value === "Nova Scotia").label, "Nouvelle-Écosse");
  assert.equal(french.find((option) => option.value === "Prince Edward Island").label, "Île-du-Prince-Édouard");
  assert.equal(french.find((option) => option.value === "Newfoundland and Labrador").label, "Terre-Neuve-et-Labrador");
  assert.equal(french.find((option) => option.value === "New Brunswick").label, "Nouveau-Brunswick");
  assert.equal(french.find((option) => option.value === "Northwest Territories").label, "Territoires du Nord-Ouest");

  const spanish = regionOptions("Canada", "es");
  assert.equal(spanish.find((option) => option.value === "British Columbia").label, "Columbia Británica");
  assert.equal(spanish.find((option) => option.value === "Newfoundland and Labrador").label, "Terranova y Labrador");

  assert.equal(commitRegion(french, ""), "");
  assert.equal(filterRegionOptions(french, "").length, french.length);
  assert.equal(commitRegion(french, "colombie-britannique"), "British Columbia");
  assert.equal(commitRegion(french, "British Columbia"), "British Columbia");
  assert.equal(commitRegion(french, "quebec"), "Quebec");
  assert.equal(commitRegion(french, "Québec"), "Quebec");
  assert.deepEqual(
    filterRegionOptions(french, "terre neuve").map((option) => option.value),
    ["Newfoundland and Labrador"],
  );
  assert.equal(commitRegion(french, "col"), "");

  const states = regionOptions("United States", "fr");
  assert.equal(commitRegion(states, "washington"), "Washington");
  assert.equal(commitRegion(states, "washington dc"), "District of Columbia");
  assert.equal(commitRegion(states, "d.c."), "District of Columbia");
  assert.equal(commitRegion(states, "district de columbia"), "District of Columbia");
  assert.equal(filterRegionOptions(states, "ohio").map((option) => option.value).join(","), "Ohio");
});
