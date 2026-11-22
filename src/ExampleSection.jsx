import { realExample } from "./realExample.js";
import { t } from "../shared/messages.js";

export default function ExampleSection({ lang }) {
  const copy = realExample[lang] || realExample.en;
  return (
    <section className="example" id="example" aria-labelledby="example-title">
      <h2 className="example-title" id="example-title">{t(lang, "exampleTitle")}</h2>
      {realExample.placeholder ? (
        <p className="example-placeholder" role="note">{t(lang, "examplePlaceholder")}</p>
      ) : (
        <p className="example-note">{t(lang, "exampleRealNote")}</p>
      )}
      <div className="example-grid">
        <article className="example-card">
          <h3>{t(lang, "exampleBefore")}</h3>
          <p>{copy.document}</p>
        </article>
        <article className="example-card">
          <h3>{t(lang, "exampleAfter")}</h3>
          <h4>{t(lang, "sectionSummary")}</h4>
          <p>{copy.summary}</p>
          <h4>{t(lang, "sectionFlags")}</h4>
          <p className="example-extra">{copy.flags}</p>
          <h4>{t(lang, "sectionQuestions")}</h4>
          <p className="example-extra">{copy.questions}</p>
          <h4>{t(lang, "sectionTerms")}</h4>
          <p className="example-extra">{copy.terms}</p>
          <p className="example-disclaimer"><strong>{t(lang, "disclaimerStrong")}</strong> {t(lang, "disclaimerRest")}</p>
        </article>
      </div>
    </section>
  );
}
