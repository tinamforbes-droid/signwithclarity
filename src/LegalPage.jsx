import {
  CONTACT_EMAIL_PLACEHOLDER,
  EFFECTIVE_DATE,
  OWNER_NAME_PLACEHOLDER,
  privacyPolicy,
  splitLegalText,
  termsOfUse,
} from "./legalCopy.js";

function LegalText({ text, id }) {
  const parts = splitLegalText(text);
  return parts.map((part, index) => {
    if (part !== OWNER_NAME_PLACEHOLDER && part !== CONTACT_EMAIL_PLACEHOLDER) {
      return part;
    }
    const label = part === OWNER_NAME_PLACEHOLDER ? "Owner legal name placeholder" : "Contact email placeholder";
    return (
      <span className="legal-placeholder" key={`${id}-${index}`} title={label}>
        {part}
      </span>
    );
  });
}

export default function LegalPage({ kind, onNavigate }) {
  const doc = kind === "terms" ? termsOfUse : privacyPolicy;

  return (
    <main className="legal-main">
      <article className="legal-card">
        <p className="legal-kicker">Sign With Clarity</p>
        <h1 className="legal-title">{doc.title}</h1>
        <p className="legal-date">Effective date: {EFFECTIVE_DATE}</p>
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.blocks.map((block, index) => {
              if (block.type === "ul") {
                return (
                  <ul key={`${section.heading}-${index}`}>
                    {block.items.map((item) => (
                      <li key={item}>
                        <LegalText text={item} id={`${section.heading}-${index}`} />
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={`${section.heading}-${index}`}>
                  <LegalText text={block.text} id={`${section.heading}-${index}`} />
                </p>
              );
            })}
          </section>
        ))}
        <a className="legal-back" href="/" onClick={(event) => onNavigate(event, "/")}>
          ← Back to the decoder
        </a>
      </article>
    </main>
  );
}
