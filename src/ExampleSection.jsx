import { useEffect, useRef, useState } from "react";

import { realExample } from "./realExample.js";
import { t } from "../shared/messages.js";

const SHOTS = [
  { src: "/example/summary.webp", alt: "exampleShotAltSummary" },
  { src: "/example/watch-out.webp", alt: "exampleShotAltFlags" },
  { src: "/example/questions.webp", alt: "exampleShotAltQuestions" },
  { src: "/example/key-terms.webp", alt: "exampleShotAltTerms" },
];

function ShotDialog({ src, label, closeLabel, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    const handle = () => onClose();
    dialog.addEventListener("close", handle);
    return () => dialog.removeEventListener("close", handle);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="example-lightbox"
      aria-label={label}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      <button type="button" className="example-lightbox-close" onClick={() => ref.current?.close()}>
        {closeLabel}
      </button>
      <img src={src} alt={label} />
    </dialog>
  );
}

export default function ExampleSection({ lang }) {
  const copy = realExample[lang] || realExample.en;
  const [open, setOpen] = useState(null);
  const shot = open == null ? null : SHOTS[open];
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
      <figure className="example-shots">
        <figcaption className="example-shots-caption">{t(lang, "exampleShotsCaption")}</figcaption>
        <p className="example-shots-hint">{t(lang, "exampleShotsHint")}</p>
        {lang !== "en" && <p className="example-shots-note">{t(lang, "exampleShotsEnglishNote")}</p>}
        <div className="example-shots-grid">
          {SHOTS.map((item, index) => (
            <button
              key={item.src}
              type="button"
              className="example-shot"
              onClick={() => setOpen(index)}
            >
              <img src={item.src} alt={t(lang, item.alt)} />
            </button>
          ))}
        </div>
      </figure>
      {shot && (
        <ShotDialog
          src={shot.src}
          label={t(lang, shot.alt)}
          closeLabel={t(lang, "exampleShotClose")}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
