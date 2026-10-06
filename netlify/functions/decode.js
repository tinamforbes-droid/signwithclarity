// netlify/functions/decode.js
//
// This is a Netlify Function — a small piece of server code that runs on
// Netlify's servers, not in the browser. Its whole job is to hold your real
// Anthropic API key safely and pass requests through to Claude on behalf of
// your app. The key NEVER reaches the browser.
//
// Before this works, you need to:
// 1. Get an API key at https://console.anthropic.com (Settings > API Keys)
// 2. In Netlify: Site settings > Environment variables > add a new variable
//    named ANTHROPIC_API_KEY with that key as the value
// 3. Redeploy the site (env vars only take effect on the next deploy)

const SYSTEM_PROMPT = `You are Sign With Clarity, a warm and helpful AI assistant that decodes insurance documents for everyday people in Canada and the United States. You are NOT a lawyer and do NOT give legal advice. Your job is to translate confusing insurance language into plain, simple English that anyone can understand.

You are familiar with insurance rules and norms across all Canadian provinces and territories, and all 50 US states. When a country and province or state is provided, tailor your explanation to that specific jurisdiction — including relevant local rules, common regional policy differences, and anything a person in that location should especially watch for.

When given an insurance document or excerpt, respond ONLY with a JSON object in this exact format (no markdown, no backticks, no extra text):
{
  "summary": "A warm, plain-language summary of what this document actually says. 3-5 sentences. Write as if explaining to a friend.",
  "flags": "2-4 specific things the person should pay close attention to. Each point on a new line starting with •. Focus on unusual clauses, exclusions, or things that could surprise them. Where relevant, note if something is unusual for their province or state.",
  "questions": "3-4 smart questions they should ask their insurance company before signing or renewing. Each on a new line starting with •. Make questions specific and actionable.",
  "terms": "Define 3-5 confusing insurance terms found in the document, in plain English. Format each as TERM: definition, each on a new line."
}

Always be warm, clear, and reassuring. Never use legal jargon. Always remind the reader this is for understanding only, not legal advice.`;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let country, region, docText;
  try {
    const body = JSON.parse(event.body || "{}");
    country = body.country || "Canada";
    region = body.region || body.province || "Not specified";
    docText = body.docText;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request." }) };
  }

  if (!docText || !docText.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please include some document text." }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is missing its API key. Add ANTHROPIC_API_KEY in Netlify's environment variables." })
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Country: ${country}\n${country === "Canada" ? "Province" : "State"}: ${region}\n\nInsurance Document:\n${docText}`
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return { statusCode: 502, body: JSON.stringify({ error: "The AI service didn't respond as expected." }) };
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    console.error("decode function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Something went wrong decoding the document." }) };
  }
}
