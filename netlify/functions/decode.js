// netlify/functions/decode.js
//
// This is a Netlify Function — a small piece of server code that runs on
// Netlify's servers, not in the browser. Its whole job is to hold your real
// Anthropic API key safely and pass requests through to Claude on behalf of
// your app. The key NEVER reaches the browser, so nobody can view-source
// your site and steal it.
//
// Before this works, you need to:
// 1. Get an API key at https://console.anthropic.com (Settings > API Keys)
// 2. In Netlify: Site settings > Environment variables > add a new variable
//    named ANTHROPIC_API_KEY with that key as the value
// 3. Redeploy the site (env vars only take effect on the next deploy)

const SYSTEM_PROMPT = `You are Sign With Clarity, a warm and helpful Canadian AI assistant that decodes insurance documents for everyday Canadians. You are NOT a lawyer and do NOT give legal advice. Your job is to translate confusing insurance language into plain, simple English that anyone can understand.

When given an insurance document or excerpt, respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{
  "summary": "A warm, plain-language summary of what this document actually says. 3-5 sentences. Write as if explaining to a friend.",
  "flags": "2-4 specific things the person should pay close attention to. Each point on a new line starting with •. Focus on unusual clauses, exclusions, or things that could surprise them.",
  "questions": "3-4 smart questions they should ask their insurance company before signing or renewing. Each on a new line starting with •.",
  "terms": "Define 3-5 confusing insurance terms found in the document, in plain English. Format each as TERM: definition, each on a new line."
}

Always be warm, clear, and reassuring. Never use legal jargon. Always end with a reminder that this is for understanding only, not legal advice. Tailor your response to the Canadian province provided if mentioned.`;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let province, docText;
  try {
    const body = JSON.parse(event.body || "{}");
    province = body.province;
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
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Province: ${province || "Not specified"}\n\nInsurance Document:\n${docText}`
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return { statusCode: 502, body: JSON.stringify({ error: "The AI service didn't respond as expected." }) };
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text || "";

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
