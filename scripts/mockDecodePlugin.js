// Local stand-in for /.netlify/functions/decode.
// Loaded only when SWC_MOCK=1, and only for the Vite dev server.
// Production builds do not include it.

import { asLanguage } from "../shared/messages.js";
import { buildSamplePolicy } from "../shared/samplePolicy.js";

const END_PHRASE = "volcanic glass shed collapse is excluded unless building 7 is listed on the declarations";

const SAMPLE_SECTIONS = {
  en: {
    summary: "This document describes home coverage for sudden and accidental loss, with a deductible and duties after a loss.",
    summaryEnd: "This sample policy covers Rowan Hale's home in Calgary for sudden and accidental loss, with a deductible. The wording keeps going all the way to a closing exclusion about a shed.",
    flags: "• A deductible applies to each occurrence.\n• Payment may be actual cash value until repairs are done.",
    flagsEnd: "• Volcanic glass shed collapse is excluded unless building 7 is listed on the declarations.\n• Water backup is covered only when the endorsement is listed, and only up to the sublimit on the declarations.",
    questions: "• Is building 7 listed on my declarations?\n• What is my deductible for a typical claim?\n• Does my policy include the water backup endorsement?",
    terms: "Deductible: the amount you pay yourself before the policy pays.\nActual cash value: the value of an item after age and wear are taken into account.\nEndorsement: an extra page that adds or changes coverage.",
  },
  fr: {
    summary: "Ce document décrit une protection pour la maison en cas de perte soudaine et accidentelle, avec une franchise et des devoirs après un sinistre.",
    summaryEnd: "Cette police d'exemple couvre la maison de Rowan Hale à Calgary pour une perte soudaine et accidentelle, avec une franchise. Le texte va jusqu'à une exclusion à la fin, au sujet d'un cabanon.",
    flags: "• Une franchise s'applique à chaque événement.\n• Le paiement peut être à la valeur au jour jusqu'à ce que les réparations soient faites.",
    flagsEnd: "• L'effondrement d'un cabanon à cause de verre volcanique est exclu, sauf si le bâtiment 7 est inscrit sur les déclarations.\n• Le refoulement d'eau est couvert seulement si l'avenant est inscrit, et seulement jusqu'au sous-plafond des déclarations.",
    questions: "• Le bâtiment 7 est-il inscrit sur mes déclarations?\n• Quelle est ma franchise pour une réclamation courante?\n• Ma police comprend-elle l'avenant pour le refoulement d'eau?",
    terms: "Franchise : le montant que vous payez vous-même avant que la police paie.\nValeur au jour : la valeur d'un bien après l'âge et l'usure.\nAvenant : une page ajoutée qui ajoute ou modifie une garantie.",
  },
  es: {
    summary: "Este documento describe la cobertura de la vivienda para una pérdida súbita y accidental, con un deducible y deberes después de un reclamo.",
    summaryEnd: "Esta póliza de ejemplo cubre la casa de Rowan Hale en Calgary por una pérdida súbita y accidental, con un deducible. El texto llega hasta una exclusión final sobre un cobertizo.",
    flags: "• El deducible se aplica a cada evento.\n• El pago puede ser a valor real hasta que se hagan las reparaciones.",
    flagsEnd: "• El colapso de un cobertizo por vidrio volcánico está excluido, salvo que el edificio 7 figure en las declaraciones.\n• El respaldo de agua está cubierto solo si el endoso está indicado, y solo hasta el sublímite de las declaraciones.",
    questions: "• ¿El edificio 7 figura en mis declaraciones?\n• ¿Cuál es mi deducible para un reclamo habitual?\n• ¿Mi póliza incluye el endoso de respaldo de agua?",
    terms: "Deducible: la cantidad que usted paga antes de que la póliza pague.\nValor real: el valor de un bien después de tener en cuenta la edad y el desgaste.\nEndoso: una página extra que agrega o cambia la cobertura.",
  },
};

function sections({ sawEnd, language }) {
  const copy = SAMPLE_SECTIONS[language] || SAMPLE_SECTIONS.en;
  return {
    summary: sawEnd ? copy.summaryEnd : copy.summary,
    flags: sawEnd ? copy.flagsEnd : copy.flags,
    questions: copy.questions,
    terms: copy.terms,
  };
}

function mockResult(payload) {
  const doc = String(payload.docText || "");
  const notes = String(payload.notes || "");
  const combined = `${doc}\n${notes}`;

  if (combined.includes("FORCE_DECODER_ERROR")) {
    return {
      status: 502,
      body: { error: "The reading service didn't respond as expected. Please try again in a moment." },
    };
  }

  if (payload.mode === "extract") {
    const flags = [];
    const match = doc.match(/[^.]*exclud[^.]*\./i);
    if (match) flags.push(match[0].trim());
    if (!flags.length) flags.push("None in this part.");
    return {
      status: 200,
      body: {
        text: JSON.stringify({
          coverage: `Notes for part ${payload.chunkIndex || 1} of ${payload.chunkCount || 1}.`,
          facts: doc.slice(0, 180),
          flags: flags.map((flag) => `• ${flag}`).join("\n"),
          questions: "• None in this part.",
          terms: "",
        }),
      },
    };
  }

  if (payload.mode === "reduce") {
    return { status: 200, body: { text: notes.slice(0, 8000) } };
  }

  const sawEnd = combined.toLowerCase().includes(END_PHRASE);
  const language = asLanguage(payload.language) || "en";
  return { status: 200, body: { text: JSON.stringify(sections({ sawEnd, language })) } };
}

function delayFor(payload) {
  const base = Number(process.env.SWC_MOCK_DELAY_MS || 450);
  if (payload.mode === "extract" && payload.chunkIndex === 3) return Math.max(base, 2500);
  return base;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function mockDecodePlugin() {
  return {
    name: "swc-mock-decode",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (url.pathname === "/__swc_sample" && req.method === "GET") {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          if (url.searchParams.get("kind") === "error") {
            res.end("FORCE_DECODER_ERROR");
            return;
          }
          const pages = Number(url.searchParams.get("pages") || 18);
          res.end(buildSamplePolicy({ pages }));
          return;
        }
        if (url.pathname !== "/.netlify/functions/decode") {
          next();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "That request wasn't accepted. Please try again from the page." }));
          return;
        }

        let payload = {};
        try {
          payload = JSON.parse((await readBody(req)) || "{}");
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "That request didn't come through clearly. Please try again." }));
          return;
        }

        const { status, body } = mockResult(payload);
        setTimeout(() => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        }, delayFor(payload));
      });
    },
  };
}
