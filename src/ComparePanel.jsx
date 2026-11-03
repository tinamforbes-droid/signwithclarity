import { useRef } from "react";

import { longDocumentNote, planDocument, tooLongMessage } from "../shared/limits.js";
import { MAX_COMPARE_POLICIES, MIN_COMPARE_POLICIES } from "../shared/plans.js";
import { t } from "../shared/messages.js";
import { emptyPolicy } from "./policyDraft.js";
import { readDocumentFile } from "./readDocumentFile.js";

function PolicySlot({ lang, policy, index, canRemove, onChange, onRemove, onError }) {
  const fileRef = useRef(null);
  const plan = policy.text.trim() ? planDocument(policy.text) : null;
  const tooLong = Boolean(plan && !plan.ok && plan.reason === "too_long");
  const name = policy.label.trim() || t(lang, "policyLabelDefault", { count: index + 1 });

  async function onFile(file) {
    const result = await readDocumentFile(file);
    if (result.errorKey) {
      onError(result.errorKey);
      onChange({ ...policy, fileName: result.fileName || policy.fileName, text: "" });
      return;
    }
    onError("");
    onChange({ ...policy, fileName: result.fileName || "", text: result.text || "" });
  }

  return (
    <fieldset className="compare-policy">
      <legend className="compare-policy-legend">{t(lang, "policyLabelDefault", { count: index + 1 })}</legend>
      <div className="compare-policy-head">
        <label className="compare-name" htmlFor={`policy-name-${policy.id}`}>
          <span>{t(lang, "compareNameLabel")}</span>
          <input
            id={`policy-name-${policy.id}`}
            className="compare-name-input"
            type="text"
            maxLength={40}
            placeholder={t(lang, "compareLabelPlaceholder")}
            value={policy.label}
            onChange={(event) => onChange({ ...policy, label: event.target.value })}
          />
        </label>
        {canRemove && (
          <button
            type="button"
            className="compare-remove"
            onClick={onRemove}
            aria-label={t(lang, "compareRemoveNamed", { label: name })}
          >
            {t(lang, "compareRemove")}
          </button>
        )}
      </div>
      <div className="tabs">
        <button
          type="button"
          className={`tab ${policy.tab === "paste" ? "active" : ""}`}
          onClick={() => onChange({ ...policy, tab: "paste" })}
        >
          ✏️ {t(lang, "tabPaste")}
        </button>
        <button
          type="button"
          className={`tab ${policy.tab === "upload" ? "active" : ""}`}
          onClick={() => onChange({ ...policy, tab: "upload" })}
        >
          📎 {t(lang, "tabUpload")}
        </button>
      </div>
      {policy.tab === "paste" ? (
        <textarea
          className="doc-textarea compare-textarea"
          placeholder={t(lang, "pastePlaceholder")}
          value={policy.text}
          onChange={(event) => {
            onError("");
            onChange({ ...policy, text: event.target.value });
          }}
        />
      ) : (
        <div
          className={`file-drop ${policy.fileName ? "dragover" : ""}`}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <div className="file-drop-icon">📁</div>
          <p className="file-drop-text">
            <strong>{t(lang, "fileChoose")}</strong><br />
            {t(lang, "fileDrop")}<br />
            <span style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>{t(lang, "fileTypes")}</span>
          </p>
          {policy.fileName && <p className="file-name">✅ {policy.fileName}</p>}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf"
            style={{ display: "none" }}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </div>
      )}
      {plan?.ok && plan.chunks.length > 1 && (
        <p className="length-note">{longDocumentNote(plan, lang)}</p>
      )}
      {tooLong && (
        <div className="error-msg" role="alert">⚠️ {tooLongMessage(plan, lang)}</div>
      )}
    </fieldset>
  );
}

export default function ComparePanel({ lang, policies, onChange, onError }) {
  function update(index, next) {
    onChange(policies.map((policy, i) => (i === index ? next : policy)));
  }

  return (
    <div className="compare-panel">
      <p className="compare-lead">{t(lang, "compareLead")}</p>
      {policies.map((policy, index) => (
        <PolicySlot
          key={policy.id}
          lang={lang}
          policy={policy}
          index={index}
          canRemove={policies.length > MIN_COMPARE_POLICIES}
          onChange={(next) => update(index, next)}
          onRemove={() => onChange(policies.filter((_, i) => i !== index))}
          onError={onError}
        />
      ))}
      {policies.length < MAX_COMPARE_POLICIES && (
        <button type="button" className="compare-add" onClick={() => onChange([...policies, emptyPolicy()])}>
          {t(lang, "compareAdd")}
        </button>
      )}
    </div>
  );
}
