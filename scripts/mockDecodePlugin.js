// Local stand-in for /.netlify/functions/decode.
// Loaded only when SWC_MOCK=1, and only for the Vite dev server.
// Production builds do not include it.

import { buildSamplePolicy } from "../shared/samplePolicy.js";

const END_PHRASE = "volcanic glass shed collapse is excluded unless building 7 is listed on the declarations";

function sections({ sawEnd }) {
  return {
    summary: sawEnd
      ? "This sample policy covers Rowan Hale's home in Calgary for sudden and accidental loss, with a deductible. The wording keeps going all the way to a closing exclusion about a shed."
      : "This document describes home coverage for sudden and accidental loss, with a deductible and duties after a loss.",
    flags: sawEnd
      ? "• Volcanic glass shed collapse is excluded unless building 7 is listed on the declarations.\n• Water backup is covered only when the endorsement is listed, and only up to the sublimit on the declarations."
      : "• A deductible applies to each occurrence.\n• Payment may be actual cash value until repairs are done.",
    questions: "• Is building 7 listed on my declarations?\n• What is my deductible for a typical claim?\n• Does my policy include the water backup endorsement?",
    terms: "Deductible: the amount you pay yourself before the policy pays.\nActual cash value: the value of an item after age and wear are taken into account.\nEndorsement: an extra page that adds or changes coverage.",
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
  return { status: 200, body: { text: JSON.stringify(sections({ sawEnd })) } };
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
