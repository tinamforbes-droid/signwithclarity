// Local stand-in for /.netlify/functions/decode.
// Loaded only when SWC_MOCK=1, and only for the Vite dev server.
// Production builds do not include it.

import { isComparisonRequest } from "../shared/comparePolicy.js";
import { asLanguage } from "../shared/messages.js";
import { buildSamplePolicy } from "../shared/samplePolicy.js";
import { createMemoryUsageStore, enforceUsageLimit } from "../shared/usageGate.js";

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

  if (payload.mode === "compare") {
    const lang = asLanguage(payload.language) || "en";
    const policies = Array.isArray(payload.policies) ? payload.policies : [];
    const labels = policies.map((policy, index) => String(policy?.label || `Policy ${index + 1}`));
    const place = String(payload.region || "Ontario");
    const copy = {
      en: {
        car: "This auto policy covers a 2019 Honda Civic for Sam Lee. Liability is $1,000,000. Collision and comprehensive each have a $500 deductible. Using the car for deliveries is excluded. The renewal date in the wording is March 1, 2027.",
        home: "This home policy covers a dwelling in Toronto for Sam Lee. The building limit is $600,000 and the deductible is $1,000. Personal liability is $1,000,000. Fire and theft are covered. Water backup needs an endorsement, and flood is not included. The renewal date in the wording is March 1, 2027.",
        other: "A short explanation of what this policy says, based only on the wording that was read.",
        gaps: `• Flood is not mentioned as covered. In ${place}, overland flood is often separate. This is something to ask about.`,
        overlaps: "• Both policies show a $1,000,000 liability limit. It is worth asking whether they would pay the same kind of claim.",
        questions: "• Does the home policy's liability cover the same kind of claim as the auto policy?\n• Is water backup listed as an endorsement?\n• Are both set to renew on March 1, 2027?",
      },
      fr: {
        car: "Cette police auto couvre une Honda Civic 2019 pour Sam Lee. La responsabilité est de 1 000 000 $. La collision et les accidents sans collision ont chacun une franchise de 500 $. L'usage pour des livraisons est exclu. La date de renouvellement indiquée est le 1er mars 2027.",
        home: "Cette police habitation couvre un logement à Toronto pour Sam Lee. Le plafond du bâtiment est de 600 000 $ et la franchise est de 1 000 $. La responsabilité civile est de 1 000 000 $. L'incendie et le vol sont couverts. Le refoulement d'eau exige un avenant, et l'inondation n'est pas incluse. La date de renouvellement indiquée est le 1er mars 2027.",
        other: "Une courte explication de ce que dit cette police, à partir seulement du texte qui a été lu.",
        gaps: `• L'inondation n'est pas indiquée comme couverte. En ${place}, l'inondation de surface est souvent à part. C'est une question à poser.`,
        overlaps: "• Les deux polices indiquent un plafond de responsabilité de 1 000 000 $. Il vaut la peine de demander si elles paieraient le même genre de réclamation.",
        questions: "• La responsabilité de la police habitation couvre-t-elle le même genre de réclamation que la police auto?\n• Le refoulement d'eau est-il inscrit comme avenant?\n• Les deux se renouvellent-elles le 1er mars 2027?",
      },
      es: {
        car: "Esta póliza de auto cubre un Honda Civic 2019 de Sam Lee. La responsabilidad es de $1,000,000. La colisión y la cobertura amplia tienen un deducible de $500 cada una. El uso para entregas está excluido. La fecha de renovación que aparece es el 1 de marzo de 2027.",
        home: "Esta póliza de hogar cubre una vivienda en Toronto de Sam Lee. El límite del edificio es de $600,000 y el deducible es de $1,000. La responsabilidad personal es de $1,000,000. Cubre incendio y robo. El respaldo de agua necesita un endoso, y la inundación no está incluida. La fecha de renovación que aparece es el 1 de marzo de 2027.",
        other: "Una explicación breve de lo que dice esta póliza, solo a partir del texto que se leyó.",
        gaps: `• La inundación no aparece como cubierta. En ${place}, la inundación suele contratarse aparte. Es algo para preguntar.`,
        overlaps: "• Las dos pólizas muestran un límite de responsabilidad de $1,000,000. Vale la pena preguntar si pagarían el mismo tipo de reclamo.",
        questions: "• ¿La responsabilidad de la póliza de hogar cubre el mismo tipo de reclamo que la del auto?\n• ¿El respaldo de agua está anotado como endoso?\n• ¿Las dos se renuevan el 1 de marzo de 2027?",
      },
    };
    const chosen = copy[lang] || copy.en;
    return {
      status: 200,
      body: {
        text: JSON.stringify({
          policies: labels.map((label) => ({
            label,
            summary: label === "Car" || label === "Auto" ? chosen.car : label === "Home" || label === "Habitation" || label === "Hogar" ? chosen.home : chosen.other,
          })),
          table: labels.map((label) => ({
            label,
            covered: label === "Home" || label === "Habitation" || label === "Hogar" ? (lang === "fr" ? "Incendie et vol" : lang === "es" ? "Incendio y robo" : "Fire and theft") : (lang === "fr" ? "Responsabilité, collision" : lang === "es" ? "Responsabilidad, colisión" : "Liability, collision"),
            limits: label === "Home" || label === "Habitation" || label === "Hogar" ? "$600,000" : "$1,000,000",
            deductible: label === "Home" || label === "Habitation" || label === "Hogar" ? "$1,000" : "$500",
            exclusions: label === "Home" || label === "Habitation" || label === "Hogar"
              ? (lang === "fr" ? "Inondation; refoulement d'eau sans avenant" : lang === "es" ? "Inundación; respaldo de agua sin endoso" : "Flood; water backup unless endorsed")
              : (lang === "fr" ? "Livraisons" : lang === "es" ? "Entregas" : "Delivery business"),
            renewal: lang === "fr" ? "1er mars 2027" : lang === "es" ? "1 de marzo de 2027" : "March 1, 2027",
          })),
          gaps: chosen.gaps,
          overlaps: chosen.overlaps,
          questions: chosen.questions,
        }),
      },
    };
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

const usageStore = createMemoryUsageStore();

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

        const headers = { ...req.headers };
        if (!headers["x-nf-client-connection-ip"]) {
          headers["x-nf-client-connection-ip"] = req.socket?.remoteAddress || "local";
        }
        let gate = { allowed: true, usage: null, release: null };
        if (!isComparisonRequest(payload)) {
          gate = await enforceUsageLimit({
            headers,
            payload,
            store: usageStore,
            language: payload.language,
          });
          if (!gate.allowed) {
            res.statusCode = gate.statusCode;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(gate.body));
            return;
          }
        }

        const { status, body } = mockResult(payload);
        if (status !== 200) await gate.release?.();
        else if (gate.usage) body.usage = gate.usage;
        setTimeout(() => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        }, delayFor(payload));
      });
    },
  };
}
