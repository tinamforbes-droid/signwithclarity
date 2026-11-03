import { useRef } from "react";

import { MAX_IMAGE_PAGES, policyHasReading } from "../shared/images.js";
import { longDocumentNote, planDocument, tooLongMessage } from "../shared/limits.js";
import { MAX_COMPARE_POLICIES, MIN_COMPARE_POLICIES } from "../shared/plans.js";
import { t } from "../shared/messages.js";
import { emptyPolicy } from "./policyDraft.js";
import { FILE_ACCEPT, readDocumentFiles } from "./readDocumentFile.js";

function applyRead(policy, result, append) {
  if (result.errorKey) {
    return {
      ...policy,
      text: "",
      pages: [],
      fileName: result.fileName || policy.fileName,
      problem: result.errorKey,
      pageCount: result.pageCount || 0,
    };
  }
  if (append && policy.pages?.length && result.pages?.length && !result.text) {
    const pages = [...policy.pages, ...result.pages];
    if (pages.length > MAX_IMAGE_PAGES) {
      return {
        ...policy,
        text: "",
        problem: "tooMany",
        pageCount: pages.length,
      };
    }
    return {
      ...policy,
      text: "",
      pages,
      fileName: result.fileName || policy.fileName,
      problem: "",
      pageCount: 0,
    };
  }
  return {
    ...policy,
    text: result.text || "",
    pages: result.pages || [],
    fileName: result.fileName || "",
    problem: "",
    pageCount: 0,
  };
}

function PolicySlot({ lang, policy, index, canRemove, onChange, onRemove, onReading }) {
  const fileRef = useRef(null);
  const appendRef = useRef(false);
  const plan = policy.text?.trim() ? planDocument(policy.text) : null;
  const tooLong = Boolean(plan && !plan.ok && plan.reason === "too_long");
  const name = policy.label.trim() || t(lang, "policyLabelDefault", { count: index + 1 });
  const ready = policyHasReading(policy);

  async function onFiles(list) {
    const files = Array.from(list || []).filter(Boolean);
    if (!files.length) return;
    const append = appendRef.current;
    appendRef.current = false;
    onReading?.(true, files[0].name || name);
    try {
      const result = await readDocumentFiles(files);
      onChange(applyRead(policy, result, append));
    } finally {
      onReading?.(false);
    }
  }

  function pick(append) {
    appendRef.current = append;
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
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
          onChange={(event) => onChange({
            ...policy,
            text: event.target.value,
            pages: [],
            problem: "",
            fileName: "",
          })}
        />
      ) : (
        <div
          className={`file-drop ${ready ? "dragover" : ""}`}
          onDrop={(event) => {
            event.preventDefault();
            onFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => pick(false)}
        >
          <div className="file-drop-icon">📁</div>
          <p className="file-drop-text">
            <strong>{t(lang, "fileChoose")}</strong><br />
            {t(lang, "fileDrop")}<br />
            <span style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>{t(lang, "fileTypes")}</span>
          </p>
          {ready && policy.fileName && (
            <p className="file-name">
              ✅ {policy.pages?.length > 1
                ? t(lang, "photoPages", { count: policy.pages.length, name: policy.fileName })
                : policy.fileName}
            </p>
          )}
          {policy.fileName && !ready && <p className="file-quiet">{policy.fileName}</p>}
          <input
            ref={fileRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(event) => onFiles(event.target.files)}
          />
        </div>
      )}
      {policy.pages?.length > 0 && policy.tab === "upload" && (
        <button type="button" className="compare-add pages-add" onClick={() => pick(true)}>
          {t(lang, "addPages")}
        </button>
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

export default function ComparePanel({ lang, policies, onChange, onReading }) {
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
          onReading={onReading}
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
