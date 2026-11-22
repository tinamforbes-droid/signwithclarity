import { realExample } from "./realExample.js";
import { t } from "../shared/messages.js";

export default function ExampleSection({ lang }) {
  const copy = realExample[lang] || realExample.en;
  return (
    <section className="example" id="example" aria-labelledby="example-title">
      <h2 className="example-title" id="example-title">{t(lang, "exampleTitle")}</h2>
      {realExample.placeholder && (
        <p className="example-placeholder" role="note">{t(lang, "examplePlaceholder")}</p>
      )}
      <div className="example-grid">
        <article className="example-card">
          <h3>{t(lang, "exampleBefore")}</h3>
          <p>{copy.document}</p>
        </article>
        <article className="example-card">
          <h3>{t(lang, "exampleAfter")}</h3>
          <p>{copy.summary}</p>
          <p className="example-extra">{copy.flags}</p>
          <p className="example-extra">{copy.questions}</p>
        </article>
      </div>
    </section>
  );
}
