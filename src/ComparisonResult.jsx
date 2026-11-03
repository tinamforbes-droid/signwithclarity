import { t } from "../shared/messages.js";

const FIELDS = [
  ["covered", "compareCovered"],
  ["limits", "compareLimits"],
  ["deductible", "compareDeductible"],
  ["exclusions", "compareExclusions"],
  ["renewal", "compareRenewal"],
];

export default function ComparisonResult({ lang, comparison, parts, usageMessage, onAgain }) {
  if (!comparison) return null;
  return (
    <div className="results compare-results">
      <div className="results-header">
        <h2 className="results-title">{t(lang, "compareResultsTitle")}</h2>
        <p className="results-sub">{t(lang, "compareResultsSub")}</p>
        {parts > 1 && <p className="results-sub">{t(lang, "compareResultsWhole")}</p>}
        {usageMessage && <p className="usage-note">{usageMessage}</p>}
      </div>

      <section className="result-section section-summary">
        <div className="result-section-header">
          <span className="result-section-title">{t(lang, "compareSummariesTitle")}</span>
        </div>
        <div className="result-section-body">
          {comparison.policies.map((policy, index) => (
            <div className="compare-summary" key={`summary-${index}`}>
              <h3 className="compare-summary-name">{policy.label}</h3>
              <p>{policy.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="result-section section-table">
        <div className="result-section-header">
          <span className="result-section-title">{t(lang, "compareTableTitle")}</span>
        </div>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <caption className="compare-caption">{t(lang, "compareTableTitle")}</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                {comparison.rows.map((row, index) => (
                  <th scope="col" key={`col-${index}`}>{row.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(([field, key]) => (
                <tr key={field}>
                  <th scope="row">{t(lang, key)}</th>
                  {comparison.rows.map((row, index) => (
                    <td key={`${field}-${index}`}>{row[field]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="result-section section-gaps">
        <div className="result-section-header">
          <span className="result-section-title">{t(lang, "compareGapsTitle")}</span>
        </div>
        <div className="result-section-body">
          <p className="compare-kicker">{t(lang, "compareGapsSub")}</p>
          {comparison.gaps}
        </div>
      </section>

      <section className="result-section section-overlaps">
        <div className="result-section-header">
          <span className="result-section-title">{t(lang, "compareOverlapsTitle")}</span>
        </div>
        <div className="result-section-body">
          <p className="compare-kicker">{t(lang, "compareOverlapsSub")}</p>
          {comparison.overlaps}
        </div>
      </section>

      <section className="result-section section-questions">
        <div className="result-section-header">
          <span className="result-section-title">{t(lang, "compareQuestionsTitle")}</span>
        </div>
        <div className="result-section-body">
          <p className="compare-kicker">{t(lang, "compareQuestionsSub")}</p>
          {comparison.questions}
        </div>
      </section>

      <div className="disclaimer">
        <span className="disclaimer-icon">⚖️</span>
        <p className="disclaimer-text">
          <strong>{t(lang, "disclaimerStrong")}</strong> {t(lang, "disclaimerRest")}
        </p>
      </div>

      <button type="button" className="new-decode-btn" onClick={onAgain}>
        {t(lang, "compareAgain")}
      </button>
    </div>
  );
}
