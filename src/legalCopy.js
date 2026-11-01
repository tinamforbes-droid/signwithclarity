// Privacy Policy and Terms of Use for Sign With Clarity.
//
// Describe only what the code does. A lawyer should review both pages
// before they are relied on.

export const EFFECTIVE_DATE = "November 1, 2026";
export const OWNER_LEGAL_NAME = "Tina Forbes, operating as Quiet Clarity Within";
export const CONTACT_EMAIL = "hello@quietclaritywithin.com";

export const STORAGE_NOTE =
  "Documents aren't stored. The text stays in this browser until you leave or start over.";

const name = OWNER_LEGAL_NAME;
const email = CONTACT_EMAIL;

export const privacyPolicy = {
  title: "Privacy Policy",
  sections: [
    {
      heading: "Who runs this site",
      blocks: [
        {
          type: "p",
          text: `Sign With Clarity is a free website at signwithclarity.ca. It explains insurance documents in plain language for people in Canada and the United States. It is run by ${name}.`,
        },
        {
          type: "p",
          text: "This policy describes what the site's code does with information. It is written for people in Canada under the Personal Information Protection and Electronic Documents Act (PIPEDA) and British Columbia's Personal Information Protection Act (PIPA). It also describes, in general terms, the same practices for people in the United States.",
        },
        {
          type: "p",
          text: "In Canada, PIPEDA covers personal information that an organization collects in the course of commercial activity, unless a province's own law applies instead. In British Columbia, that law is PIPA. This policy is written so someone in any province can see what the site does, and so it meets the general duties in both laws: to say what is collected and why, to use it only for that purpose, to be careful with it, to say when it may leave Canada, and to let you ask about it.",
        },
      ],
    },
    {
      heading: "What you can send",
      blocks: [
        {
          type: "p",
          text: "You can paste text, or you can choose a .txt or .pdf file. A document may contain personal information, such as a name, an address, a policy number, or details about a claim. Whatever text is on the page is what the site uses.",
        },
        {
          type: "p",
          text: "If you choose a PDF, your browser reads it on your device with pdf.js. The site uses the words it finds. It does not send the PDF file itself. If the PDF has no text layer, the page asks you to paste the text instead, and nothing from that file is sent.",
        },
        {
          type: "p",
          text: "You also choose a country, Canada or the United States, and a province, territory, or state. The page sends that choice with the document text.",
        },
        {
          type: "p",
          text: "The name of a file you choose is shown on the page. The file name stays in the browser. It is not included in the decode request.",
        },
        {
          type: "p",
          text: "The site does not ask you to create an account. It does not ask for your name, email address, phone number, or payment details.",
        },
      ],
    },
    {
      heading: "How an explanation is made",
      blocks: [
        {
          type: "p",
          text: "The text you paste or extract stays in the browser's memory while the page is open.",
        },
        {
          type: "p",
          text: "When you choose Decode My Document, the browser sends a request to this site's Netlify function at /.netlify/functions/decode. The request includes the document text, the country you chose, and the province, territory, or state you chose.",
        },
        {
          type: "p",
          text: "A short document is sent once. A longer document is split into parts, with a short overlap so a sentence on a boundary is included with both neighbouring parts. Each part is sent on its own. The function returns notes on that part. Your browser may send those notes back so they can be combined, and then send the combined notes once more so the explanation can be written. The notes are about the document you submitted.",
        },
        {
          type: "p",
          text: "The function passes that text, together with your country and your province or state, to Anthropic's API at https://api.anthropic.com/v1/messages. The model named in the server code is claude-sonnet-4-6. The request also includes instructions that tell the model how to explain an insurance document. Anthropic returns the explanation. The function sends that reply back to your browser, and the page shows it.",
        },
        {
          type: "p",
          text: "The key that calls Anthropic is kept in a server setting named ANTHROPIC_API_KEY. It is not included in the page your browser loads.",
        },
      ],
    },
    {
      heading: "What we store",
      blocks: [
        {
          type: "p",
          text: "The function does not save your document, the notes, your location, or the explanation in a database or a file. There is no account to attach them to.",
        },
        {
          type: "p",
          text: "The page holds the text and the explanation in memory while you are using it. If you choose Decode Another Document, the page clears the text and the file name. Closing the page clears them as well.",
        },
        {
          type: "p",
          text: "Documents aren't stored.",
        },
      ],
    },
    {
      heading: "What the server writes down",
      blocks: [
        {
          type: "p",
          text: "If Anthropic returns an error, the function writes Anthropic's HTTP status code to the server log. It does not write your document, and it does not write Anthropic's reply, into that line.",
        },
        {
          type: "p",
          text: "If the function fails in an unexpected way, it writes that error to the server log. The code does not add your document, your notes, or your location to that message.",
        },
        {
          type: "p",
          text: "The function code does not read or save your IP address. Nothing in the site's code writes it down.",
        },
      ],
    },
    {
      heading: "Other services the page contacts",
      blocks: [
        {
          type: "p",
          text: "The page loads two typefaces, Cormorant Garamond and DM Sans, from Google Fonts at fonts.googleapis.com. Your browser contacts Google to download them. That request does not include your document.",
        },
        {
          type: "p",
          text: "The page loads pdf.js, and the worker script it needs, from cdnjs.cloudflare.com, a Cloudflare service. Your browser contacts Cloudflare to download those files. That request does not include your document. A PDF is read on your device after the library has loaded.",
        },
        {
          type: "p",
          text: "The site and the decode function are hosted by Netlify. The decode request goes to Netlify because that is where the function runs. The function code does not save the body of the request.",
        },
        {
          type: "p",
          text: "The code does not include an analytics tool, an advertising pixel, or another tracker. It does not set cookies. It does not use localStorage or sessionStorage. We do not control whether Google or Cloudflare sets a cookie when your browser loads a font or the pdf.js file from them.",
        },
      ],
    },
    {
      heading: "Why we use this information",
      blocks: [
        {
          type: "p",
          text: "We use the document text and the location you chose for one purpose: to write the plain-language explanation you asked for, and to show it to you.",
        },
        {
          type: "p",
          text: "The site has no feature that sells or rents personal information. It does not show ads, and the code does not send your document to an advertising network or use it to build an advertising profile. It does not use the text to decide whether to offer you insurance.",
        },
        {
          type: "p",
          text: "Submitting a document is how you ask for the explanation. We treat that as your consent to use the text for that purpose, including sending it to Anthropic as this policy describes. We will not use it for a new purpose without updating this page. You can stop by leaving the page.",
        },
      ],
    },
    {
      heading: "Information leaving your province or Canada",
      blocks: [
        {
          type: "p",
          text: "Netlify hosts the site. Anthropic receives the document text so it can write the explanation. The request goes to api.anthropic.com. Anthropic is a company in the United States. The text may be processed outside your province and outside Canada, including in the United States.",
        },
        {
          type: "p",
          text: "We are telling you this because PIPEDA asks organizations to be open about this kind of transfer, and because BC PIPA asks an organization to give notice when personal information may be accessed from outside Canada. While the information is outside Canada, the laws of the place where it is processed can apply to it, including lawful orders in the United States.",
        },
        {
          type: "p",
          text: "This site does not send Anthropic an instruction about how long to keep an API request. We do not keep our own copy, and the site has no way to look up or delete a past request at Anthropic. Anthropic's privacy policy describes what Anthropic does with API inputs: https://www.anthropic.com/legal/privacy",
        },
      ],
    },
    {
      heading: "How long it stays",
      blocks: [
        {
          type: "p",
          text: "We do not keep the document, the notes, the location, or the explanation after the function has replied. Your browser keeps them only until you leave the page or clear them.",
        },
      ],
    },
    {
      heading: "Asking about your information",
      blocks: [
        {
          type: "p",
          text: "PIPEDA and BC PIPA give you the right to ask whether an organization holds personal information about you, to ask for access, and to ask for a correction if something is wrong. You can also withdraw consent to further use, and you can make a complaint.",
        },
        {
          type: "p",
          text: `Because we do not keep a copy, we usually have nothing from your document to show you or correct. If you write to ${email}, we will tell you what we hold and respond within the time those laws allow. We cannot pull a past document back from this site. We also cannot delete it from Anthropic for you, because we do not keep a record that would let us find that request.`,
        },
        {
          type: "p",
          text: "If you are in Canada and you are not satisfied with the reply, you can contact the Office of the Privacy Commissioner of Canada. If your concern is about an organization in British Columbia, you can contact the Office of the Information and Privacy Commissioner for British Columbia.",
        },
      ],
    },
    {
      heading: "People in the United States",
      blocks: [
        {
          type: "p",
          text: "If you use the site from the United States, we handle information the same way. We do not sell personal information. We do not share it for advertising. We do not build an advertising profile. The information the site handles is the text you submit, the location you select, and the requests your browser makes to load the page, the fonts, pdf.js, and the explanation.",
        },
        {
          type: "p",
          text: `State privacy laws differ. This page does not try to list them. If a law where you live gives you a right to ask about personal information, you can email ${email}. We will respond in line with that law, to the extent it applies. Nothing here waives a right you have where you live.`,
        },
      ],
    },
    {
      heading: "Children",
      blocks: [
        {
          type: "p",
          text: "The site is written for adults who are reading insurance documents. It does not ask for a date of birth, and it is not directed at children.",
        },
      ],
    },
    {
      heading: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "If the site starts collecting, storing, or sharing information in a different way, we will update this page and change the effective date at the top.",
        },
      ],
    },
    {
      heading: "How to reach us",
      blocks: [
        {
          type: "p",
          text: `${name} runs Sign With Clarity at signwithclarity.ca. For a privacy question, or to ask what information we hold, write to ${email}.`,
        },
      ],
    },
  ],
};

export const termsOfUse = {
  title: "Terms of Use",
  sections: [
    {
      heading: "These terms",
      blocks: [
        {
          type: "p",
          text: `These terms are between you and ${name} for your use of Sign With Clarity at signwithclarity.ca. The site is free. There is no account.`,
        },
        {
          type: "p",
          text: "The privacy policy describes what happens to a document you submit. It is part of these terms.",
        },
      ],
    },
    {
      heading: "What the site is for",
      blocks: [
        {
          type: "p",
          text: "Sign With Clarity explains insurance documents in plain language so you can understand the wording more easily. It is for education and general information. It is offered to people in Canada and the United States.",
        },
        {
          type: "p",
          text: "An explanation is not insurance advice. It is not legal advice. It is not financial advice.",
        },
        {
          type: "p",
          text: "The site does not recommend coverage. It does not recommend a policy, a limit, a deductible, an endorsement, or any other product. It does not tell you to buy, renew, change, or cancel insurance.",
        },
        {
          type: "p",
          text: `Sign With Clarity is not a licensed insurance professional. It is not your insurer, your broker, or your agent. Using the site does not make ${name} your lawyer, your insurance advisor, or your financial advisor, and it does not create a professional relationship.`,
        },
        {
          type: "p",
          text: "Questions the site suggests are examples you might raise with your own insurer or broker. They are not instructions.",
        },
      ],
    },
    {
      heading: "The explanation can be wrong",
      blocks: [
        {
          type: "p",
          text: "An AI model writes the explanation. AI can make mistakes. It can miss a sentence, misunderstand a term, or say something that does not match your document or the rules where you live.",
        },
        {
          type: "p",
          text: "Read your own document. Before you sign, renew, cancel, or rely on anything important, confirm it with your insurer or broker, or with another person who is qualified to advise you.",
        },
      ],
    },
    {
      heading: "Your document",
      blocks: [
        {
          type: "p",
          text: "Only submit text you are allowed to share. Documents aren't stored. The text stays in this browser until you leave or start over. When you ask for an explanation, the text is sent to the decode function described in the privacy policy.",
        },
        {
          type: "p",
          text: "If a document is too long to read all the way through, the site says so. It does not quietly use only the beginning.",
        },
      ],
    },
    {
      heading: "Using the site",
      blocks: [
        {
          type: "p",
          text: "Use the site to understand a document you are allowed to share. Do not try to disrupt the site or the decode function, and do not use the site to harm someone else.",
        },
      ],
    },
    {
      heading: "No promise of a perfect or always-available answer",
      blocks: [
        {
          type: "p",
          text: "The site is provided as it is, free of charge. An explanation may be incomplete or wrong. The site may be slow or unavailable. We do not promise that an explanation is accurate, current, or suitable for a decision you need to make.",
        },
      ],
    },
    {
      heading: "Responsibility",
      blocks: [
        {
          type: "p",
          text: `You are responsible for how you use an explanation. To the extent the law allows, ${name} is not liable for a decision you make from an explanation, or for loss that comes from relying on the site instead of checking with your insurer or broker.`,
        },
        {
          type: "p",
          text: "Some laws do not allow certain limits on liability. That includes consumer protections in Canadian provinces and territories and in US states. Those protections still apply to you.",
        },
      ],
    },
    {
      heading: "The law where you live",
      blocks: [
        {
          type: "p",
          text: "These terms are for a free educational site used in Canada and the United States. They do not choose a court for you. Rights you have under the law of your province, territory, or state stay in place.",
        },
      ],
    },
    {
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "We may update these terms. When we do, we will change the effective date at the top of this page. If you keep using the site after that date, these updated terms apply.",
        },
      ],
    },
    {
      heading: "Contact",
      blocks: [
        {
          type: "p",
          text: `Questions about these terms can be sent to ${email}.`,
        },
      ],
    },
  ],
};

const EMAIL_MARK = new RegExp(
  `(${CONTACT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
  "g",
);

export function splitLegalText(text) {
  return String(text).split(EMAIL_MARK);
}

export function documentPlainText(doc) {
  const parts = [doc.title, EFFECTIVE_DATE];
  for (const section of doc.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.type === "p") parts.push(block.text);
      if (block.type === "ul") parts.push(...block.items);
    }
  }
  return parts.join("\n");
}
