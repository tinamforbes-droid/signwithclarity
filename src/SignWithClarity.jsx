import { useState, useRef, useEffect, useMemo, useId } from "react";
import { runComparison } from "../shared/compareRun.js";
import { DecodeError, postDecode, runDecode } from "../shared/decodeRun.js";
import { canCompareAccount, isYearlyActive, isoDate, visibleChecks } from "../shared/entitlement.js";
import { longDocumentNote, planDocument, tooLongMessage } from "../shared/limits.js";
import {
  LANGUAGE_CHOICES,
  htmlLang,
  loadingCopy,
  pageTitle,
  resolveLanguage,
  storeLanguage,
  t,
} from "../shared/messages.js";
import {
  commitRegion,
  filterRegionOptions,
  foldRegion,
  normalizeRegionQuery,
  regionOptions,
} from "../shared/regions.js";
import { YEARLY_FAIR_USE_LIMIT } from "../shared/plans.js";
import { formatResetDate, usageStatusMessage } from "../shared/usageCopy.js";
import AccountBar from "./AccountBar.jsx";
import ComparePanel from "./ComparePanel.jsx";
import { devCompareSample, emptyPolicy } from "./policyDraft.js";
import ComparisonResult from "./ComparisonResult.jsx";
import { loadOwnPlan } from "./accountRow.js";
import { readDocumentFile } from "./readDocumentFile.js";
import Pricing from "./Pricing.jsx";
import { currentAccessToken } from "./authClient.js";
import LegalPage from "./LegalPage.jsx";
import { storageNote } from "./legalCopy.js";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: #1a2744;
    --navy-light: #243259;
    --gold: #c9a96e;
    --gold-light: #e8d5b0;
    --cream: #faf7f2;
    --cream-dark: #f0ebe0;
    --text: #2c2c2c;
    --text-light: #6b6560;
    --white: #ffffff;
    --red-flag: #c0392b;
    --green-ok: #27ae60;
    --blue-info: #2471a3;
  }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--cream);
    color: var(--text);
    min-height: 100vh;
  }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* HEADER */
  .header {
    background: var(--navy);
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  }
  .logo {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
  }
  .logo-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 600;
    color: var(--gold);
    letter-spacing: 0.5px;
    line-height: 1;
  }
  .logo-tagline {
    font-size: 10px;
    color: var(--gold-light);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-weight: 300;
    margin-top: 3px;
  }
  .header-badge {
    background: rgba(201,169,110,0.15);
    border: 1px solid rgba(201,169,110,0.3);
    color: var(--gold-light);
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .lang-switch {
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(201,169,110,0.35);
    border-radius: 999px;
    padding: 2px;
  }
  .lang-switch button {
    border: none;
    background: transparent;
    color: var(--gold-light);
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.2px;
    padding: 5px 9px;
    border-radius: 999px;
    cursor: pointer;
  }
  .lang-switch button[aria-pressed="true"] {
    background: var(--gold);
    color: var(--navy);
    font-weight: 500;
  }
  .lang-switch button:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .account-bar {
    background: var(--cream);
    border-bottom: 1px solid rgba(201, 169, 110, 0.45);
    padding: 16px 20px 18px;
  }
  .account-inner {
    max-width: 560px;
    margin: 0 auto;
    text-align: center;
  }
  .account-lead,
  .account-hint,
  .account-status {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-light);
  }
  .account-status { color: var(--navy); }
  .account-form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
  }
  .account-label {
    font-size: 13px;
    color: var(--text);
  }
  .account-input {
    flex: 1 1 200px;
    max-width: 280px;
    border: 1px solid var(--gold-light);
    background: var(--white);
    border-radius: 8px;
    padding: 9px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: var(--text);
  }
  .account-input:focus {
    outline: 2px solid var(--gold);
    border-color: var(--gold);
  }
  .account-btn {
    border: 1px solid var(--navy);
    background: var(--white);
    color: var(--navy);
    border-radius: 8px;
    padding: 9px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    cursor: pointer;
  }
  .account-btn:hover { background: var(--cream-dark); }
  .account-btn:disabled { opacity: 0.65; cursor: default; }
  .account-btn:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
  .account-form .account-hint,
  .account-status,
  .account-signed .account-hint {
    flex: 1 1 100%;
    margin-top: 4px;
  }
  .account-signed {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    justify-content: center;
  }
  .account-error {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--red-flag);
  }

  /* HERO */
  .hero {
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-light) 60%, #2d4a7a 100%);
    padding: 48px 24px 56px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at 60% 40%, rgba(201,169,110,0.08) 0%, transparent 60%);
    pointer-events: none;
  }
  .hero-eyebrow {
    font-size: 11px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 16px;
    font-weight: 400;
  }
  .hero-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px;
    font-weight: 300;
    color: var(--white);
    line-height: 1.2;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }
  .hero-title em {
    font-style: italic;
    color: var(--gold);
  }
  .hero-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    line-height: 1.6;
    max-width: 320px;
    margin: 0 auto 28px;
    font-weight: 300;
  }
  .hero-trust {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  .trust-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--gold-light);
    font-size: 12px;
    font-weight: 300;
  }
  .trust-dot {
    width: 5px;
    height: 5px;
    background: var(--gold);
    border-radius: 50%;
  }

  /* MAIN CONTENT */
  .main { flex: 1; padding: 0 16px 48px; max-width: 600px; margin: 0 auto; width: 100%; }
  .main-wide { max-width: 980px; }

  /* UPLOAD CARD */
  .upload-card {
    background: var(--white);
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(26,39,68,0.12);
    margin-top: -24px;
    position: relative;
    z-index: 10;
    overflow: hidden;
  }
  .upload-card-header {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .upload-card-header-icon {
    font-size: 20px;
  }
  .upload-card-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    color: var(--white);
    font-weight: 400;
  }
  .upload-card-body { padding: 20px; }

  /* TABS */
  .tabs {
    display: flex;
    background: var(--cream-dark);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 16px;
  }
  .tab {
    flex: 1;
    padding: 9px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--text-light);
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 400;
  }
  .tab.active {
    background: var(--navy);
    color: var(--white);
    font-weight: 500;
  }

  /* TEXTAREA */
  .doc-textarea {
    width: 100%;
    height: 160px;
    border: 1.5px solid var(--cream-dark);
    border-radius: 10px;
    padding: 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--text);
    resize: none;
    outline: none;
    background: var(--cream);
    line-height: 1.6;
    transition: border-color 0.2s;
  }
  .doc-textarea:focus { border-color: var(--gold); }
  .doc-textarea::placeholder { color: #b0a898; }

  /* FILE DROP */
  .file-drop {
    border: 2px dashed var(--gold-light);
    border-radius: 10px;
    padding: 32px 20px;
    text-align: center;
    background: var(--cream);
    cursor: pointer;
    transition: all 0.2s;
  }
  .file-drop:hover, .file-drop.dragover {
    border-color: var(--gold);
    background: rgba(201,169,110,0.05);
  }
  .file-drop-icon { font-size: 32px; margin-bottom: 8px; }
  .file-drop-text { font-size: 14px; color: var(--text-light); line-height: 1.5; }
  .file-drop-text strong { color: var(--navy); }
  .file-name {
    margin-top: 10px;
    font-size: 12px;
    color: var(--green-ok);
    font-weight: 500;
  }

  /* LOCATION SELECTORS */
  .province-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }
  .province-label {
    font-size: 12px;
    color: var(--text-light);
    white-space: nowrap;
    font-weight: 400;
  }
  .province-select {
    flex: 1;
    border: 1.5px solid var(--cream-dark);
    border-radius: 8px;
    padding: 8px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--text);
    background: var(--cream);
    outline: none;
    cursor: pointer;
  }
  .province-select:focus { border-color: var(--gold); }

  .region-block { margin-top: 14px; }
  .region-block .province-label {
    display: block;
    margin-bottom: 6px;
  }
  .region-input-wrap { position: relative; }
  .region-input {
    width: 100%;
    border: 1.5px solid var(--cream-dark);
    border-radius: 8px;
    padding: 8px 32px 8px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--text);
    background: var(--cream);
    outline: none;
  }
  .region-input::placeholder { color: #b0a898; }
  .region-input:focus { border-color: var(--gold); }
  .region-input.needs-choice {
    border-color: var(--gold);
    background: rgba(201,169,110,0.14);
  }
  .region-chevron {
    position: absolute;
    right: 14px;
    top: 50%;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid var(--text-light);
    border-bottom: 1.5px solid var(--text-light);
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
  }
  .region-list {
    list-style: none;
    margin-top: 6px;
    padding: 4px;
    max-height: 196px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--white);
    border: 1.5px solid var(--cream-dark);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(26,39,68,0.08);
  }
  .region-option {
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text);
    cursor: pointer;
    border-radius: 6px;
  }
  .region-option.active {
    background: rgba(201,169,110,0.2);
    color: var(--navy);
  }
  .region-option.selected { font-weight: 500; }
  .region-empty {
    padding: 9px 12px;
    font-size: 12px;
    color: var(--text-light);
  }
  .region-hint {
    margin-top: 10px;
    background: rgba(201,169,110,0.1);
    border: 1px solid var(--gold-light);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--navy);
  }

  /* DECODE BUTTON */
  .decode-btn {
    width: 100%;
    margin-top: 16px;
    padding: 16px;
    background: linear-gradient(135deg, var(--navy) 0%, #2d4a7a 100%);
    color: var(--white);
    border: none;
    border-radius: 10px;
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 400;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .decode-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(26,39,68,0.35);
  }
  .decode-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .decode-btn-sub {
    display: block;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    text-align: center;
    margin-top: 8px;
    letter-spacing: 0.5px;
  }

  /* LOADING */
  .loading-card {
    background: var(--white);
    border-radius: 16px;
    padding: 40px 24px;
    text-align: center;
    margin-top: 20px;
    box-shadow: 0 4px 20px rgba(26,39,68,0.08);
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--cream-dark);
    border-top-color: var(--navy);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    color: var(--navy);
    margin-bottom: 8px;
  }
  .loading-sub { font-size: 13px; color: var(--text-light); line-height: 1.5; }
  .progress-track {
    margin: 18px auto 0;
    max-width: 220px;
    height: 4px;
    background: var(--cream-dark);
    border-radius: 99px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--gold);
    border-radius: 99px;
    transition: width 0.4s ease;
  }
  .length-note {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-light);
  }

  /* RESULTS */
  .results { margin-top: 20px; }
  .results-header {
    text-align: center;
    margin-bottom: 20px;
  }
  .results-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    color: var(--navy);
    font-weight: 400;
    margin-bottom: 6px;
  }
  .results-sub { font-size: 13px; color: var(--text-light); }

  .result-section {
    background: var(--white);
    border-radius: 14px;
    margin-bottom: 14px;
    overflow: hidden;
    box-shadow: 0 2px 16px rgba(26,39,68,0.07);
  }
  .result-section-header {
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-summary .result-section-header { background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%); }
  .section-flags .result-section-header { background: linear-gradient(135deg, #922b21 0%, #c0392b 100%); }
  .section-questions .result-section-header { background: linear-gradient(135deg, #1a5276 0%, #2471a3 100%); }
  .section-terms .result-section-header { background: linear-gradient(135deg, #1e8449 0%, #27ae60 100%); }

  .result-section-icon { font-size: 20px; }
  .result-section-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    color: var(--white);
    font-weight: 400;
  }
  .result-section-body {
    padding: 18px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text);
    white-space: pre-wrap;
  }

  /* DISCLAIMER */
  .disclaimer {
    background: rgba(201,169,110,0.1);
    border: 1px solid var(--gold-light);
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 16px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .disclaimer-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .disclaimer-text { font-size: 12px; color: var(--text-light); line-height: 1.5; }

  /* NEW DECODE BTN */
  .new-decode-btn {
    width: 100%;
    margin-top: 16px;
    padding: 14px;
    background: transparent;
    color: var(--navy);
    border: 2px solid var(--navy);
    border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .new-decode-btn:hover {
    background: var(--navy);
    color: var(--white);
  }

  /* HOW IT WORKS */
  .how-section {
    margin-top: 32px;
    text-align: center;
    background: #d6eaf8;
    border-radius: 16px;
    padding: 24px 16px;
  }
  .how-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    color: var(--navy);
    margin-bottom: 6px;
  }
  .how-sub { font-size: 13px; color: var(--text-light); margin-bottom: 20px; }
  .how-steps { display: flex; flex-direction: column; gap: 12px; }
  .how-step {
    background: #e8f4fd;
    border: 1.5px solid #b8d9f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 2px 12px rgba(26,39,68,0.06);
    text-align: left;
  }
  .step-num {
    width: 36px;
    height: 36px;
    background: #2471a3;
    color: var(--white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    flex-shrink: 0;
  }
  .step-text { font-size: 14px; line-height: 1.5; }
  .step-text strong { color: #1a5276; display: block; margin-bottom: 2px; }

  /* FOOTER */
  .footer {
    background: var(--navy);
    padding: 24px;
    text-align: center;
    margin-top: 40px;
  }
  .footer-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    color: var(--gold);
    margin-bottom: 4px;
  }
  .footer-text { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.5px; }
  .footer-links {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin-top: 14px;
  }
  .footer-links a {
    color: var(--gold-light);
    font-size: 12px;
    letter-spacing: 0.4px;
    text-decoration: none;
  }
  .footer-links a:hover { text-decoration: underline; }
  .logo:focus-visible,
  .footer-links a:focus-visible,
  .legal-back:focus-visible,
  .legal-mail:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
  }

  .storage-note {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-light);
  }

  .legal-main {
    flex: 1;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    padding: 32px 16px 48px;
  }
  .legal-card {
    background: var(--white);
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(26,39,68,0.12);
    padding: 32px 26px 28px;
  }
  .legal-kicker {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 8px;
  }
  .legal-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px;
    font-weight: 400;
    color: var(--navy);
    line-height: 1.15;
    margin-bottom: 8px;
  }
  .legal-date {
    font-size: 13px;
    color: var(--text-light);
    margin-bottom: 8px;
  }
  .legal-card h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
    font-weight: 500;
    color: var(--navy);
    margin: 24px 0 8px;
  }
  .legal-card p {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text);
    margin-top: 10px;
  }
  .legal-card ul {
    margin: 8px 0 0 1.15em;
  }
  .legal-card li {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text);
    margin-top: 6px;
  }
  .legal-mail {
    color: var(--navy);
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .legal-mail:hover { color: var(--navy-light); }
  .legal-back {
    display: inline-block;
    margin-top: 28px;
    color: var(--navy);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
  }
  .legal-back:hover { text-decoration: underline; }
  @media (max-width: 640px) {
    .legal-card { padding: 24px 18px 22px; }
    .legal-title { font-size: 32px; }
    .header { gap: 10px; }
    .header-badge { font-size: 9px; }
    .lang-switch button { padding: 5px 7px; }
  }

  .error-msg {
    background: #fdf2f2;
    border: 1px solid #f5c6c6;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--red-flag);
    margin-top: 12px;
  }
  .limit-msg {
    margin-top: 12px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid var(--gold-light);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--navy);
  }
  .usage-note {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-light);
    text-align: center;
  }
  .usage-note a,
  .header-link {
    color: var(--gold-light);
    text-decoration: none;
  }
  .usage-note a { color: var(--navy); text-decoration: underline; text-underline-offset: 2px; }
  .header-link { font-size: 12px; letter-spacing: 0.3px; }
  .header-link:hover { text-decoration: underline; }

  .pricing {
    width: 100%;
    max-width: 960px;
    margin: 8px auto 12px;
    padding: 8px 20px 4px;
  }
  .pricing-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px;
    font-weight: 500;
    color: var(--navy);
    text-align: center;
  }
  .pricing-lead,
  .pricing-tax,
  .pricing-note {
    text-align: center;
    color: var(--text-light);
    font-size: 14px;
    line-height: 1.5;
    margin-top: 8px;
  }
  .pricing-note { color: var(--navy); }
  .pricing-error {
    margin: 12px auto 0;
    max-width: 560px;
    background: #fdf2f2;
    border: 1px solid #f5c6c6;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--red-flag);
    text-align: center;
  }
  .currency-switch { display: flex; justify-content: center; margin-top: 14px; }
  .currency-switch div {
    display: flex;
    border: 1px solid var(--gold);
    border-radius: 999px;
    padding: 2px;
    background: var(--white);
  }
  .currency-switch button {
    border: none;
    background: transparent;
    color: var(--navy);
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    letter-spacing: 0.4px;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
  }
  .currency-switch button[aria-pressed="true"] {
    background: var(--navy);
    color: var(--gold-light);
  }
  .currency-switch button:focus-visible,
  .plan-btn:focus-visible,
  .header-link:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 18px;
  }
  .plan-card {
    background: var(--white);
    border: 1px solid var(--gold-light);
    border-radius: 16px;
    padding: 18px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .plan-name { font-size: 15px; color: var(--navy); font-weight: 500; }
  .plan-price {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px;
    color: var(--navy);
    line-height: 1;
  }
  .plan-interval { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text-light); }
  .plan-detail { font-size: 14px; line-height: 1.5; color: var(--text); flex: 1; }
  .plan-current { font-size: 13px; line-height: 1.4; color: var(--text-light); }
  .plan-btn {
    border: 1px solid var(--navy);
    background: var(--white);
    color: var(--navy);
    border-radius: 8px;
    padding: 9px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    cursor: pointer;
  }
  .plan-btn:hover { background: var(--cream-dark); }
  .plan-btn:disabled { opacity: 0.65; cursor: default; }
  @media (max-width: 800px) {
    .pricing-grid { grid-template-columns: 1fr; }
  }

  .mode-switch {
    display: flex;
    background: var(--cream-dark);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 16px;
  }
  .compare-lead {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text);
    margin-bottom: 14px;
  }
  .compare-policy {
    border: 1px solid var(--gold-light);
    border-radius: 12px;
    padding: 12px;
    margin: 0 0 12px;
  }
  .compare-policy-legend {
    font-size: 13px;
    color: var(--navy);
    font-weight: 500;
    padding: 0 4px;
  }
  .compare-policy-head {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-bottom: 10px;
  }
  .compare-name { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-light); }
  .compare-name-input, .compare-remove, .compare-add {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
  }
  .compare-name-input {
    border: 1px solid var(--gold-light);
    background: var(--white);
    border-radius: 8px;
    padding: 8px 10px;
    color: var(--text);
  }
  .compare-name-input:focus { outline: 2px solid var(--gold); border-color: var(--gold); }
  .compare-remove, .compare-add {
    border: 1px solid var(--navy);
    background: var(--white);
    color: var(--navy);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .compare-add { width: 100%; margin-bottom: 4px; }
  .compare-remove:hover, .compare-add:hover { background: var(--cream-dark); }
  .compare-textarea { height: 110px; }
  .compare-note {
    margin-top: 12px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid var(--gold-light);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--navy);
  }
  .compare-note a { color: var(--navy); }
  .section-table .result-section-header,
  .section-gaps .result-section-header { background: var(--navy); }
  .section-overlaps .result-section-header { background: #6e5b3e; }
  .compare-summary { margin-bottom: 14px; }
  .compare-summary:last-child { margin-bottom: 0; }
  .compare-summary-name {
    font-size: 15px;
    color: var(--navy);
    margin-bottom: 4px;
  }
  .compare-kicker {
    font-size: 13px;
    color: var(--text-light);
    margin-bottom: 8px;
  }
  .compare-table-wrap { overflow-x: auto; }
  .compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    line-height: 1.45;
    min-width: 520px;
  }
  .compare-caption {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .compare-table th, .compare-table td {
    border-bottom: 1px solid var(--cream-dark);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
  }
  .compare-table thead th { color: var(--navy); font-weight: 500; }
  .compare-table tbody th { color: var(--text-light); font-weight: 500; white-space: nowrap; }
`;

function progressPercent(progress) {
  if (!progress || progress.total <= 1) return 0;
  if (progress.phase === "combining") return 92;
  const done = Math.max(progress.current - 1, 0);
  return Math.max(8, Math.round((done / progress.total) * 85));
}

function pageFromPath(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  return "home";
}

function useSitePage(lang) {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));

  useEffect(() => {
    const sync = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    document.title = pageTitle(lang, page);
  }, [page, lang]);

  function openPage(event, path) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setPage(pageFromPath(path));
    window.scrollTo(0, 0);
  }

  return { page, openPage };
}

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || "";
}

function RegionCombobox({ id, options, value, onChange, hint, placeholder, listLabel, emptyMessage }) {
  const listId = `${useId()}-list`;
  const [query, setQuery] = useState(() => labelFor(options, value));
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState(true);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const wasInvalid = useRef(false);
  const closeTimer = useRef(null);
  const invalid = Boolean(hint);

  const selectedLabel = labelFor(options, value);
  const showAll = browsing && foldRegion(query) === foldRegion(selectedLabel);
  const visible = showAll ? options : filterRegionOptions(options, query);
  const safeActive = active >= 0 && active < visible.length ? active : -1;

  useEffect(() => {
    if (!open || safeActive < 0) return;
    document.getElementById(`${listId}-opt-${safeActive}`)?.scrollIntoView({ block: "nearest" });
  }, [open, safeActive, listId]);

  useEffect(() => {
    function onDocPointerDown(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        clearTimeout(closeTimer.current);
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (invalid && !wasInvalid.current) {
      inputRef.current?.focus();
    }
    wasInvalid.current = invalid;
  }, [invalid]);

  function choose(option) {
    clearTimeout(closeTimer.current);
    setQuery(option.label);
    setBrowsing(true);
    setOpen(false);
    onChange(option.value);
  }

  function onInput(event) {
    const next = event.target.value;
    const chosen = commitRegion(options, next);
    setBrowsing(false);
    setQuery(next);
    setOpen(true);
    if (!normalizeRegionQuery(next)) {
      setActive(-1);
    } else {
      const matches = filterRegionOptions(options, next);
      setActive(matches.length ? 0 : -1);
    }
    onChange(chosen);
  }

  function onBlur() {
    const chosen = commitRegion(options, query);
    if (chosen) setQuery(labelFor(options, chosen));
    // Close after the option's pointerdown so a tap can still register.
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (visible.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const index = current >= 0 && current < visible.length ? current : -1;
        if (index < 0) return direction === 1 ? 0 : visible.length - 1;
        return (index + direction + visible.length) % visible.length;
      });
      return;
    }
    if (event.key === "Enter" && open && safeActive >= 0) {
      event.preventDefault();
      choose(visible[safeActive]);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="region-field" ref={boxRef}>
      <div className="region-input-wrap">
        <input
          ref={inputRef}
          id={id}
          className={`region-input${invalid ? " needs-choice" : ""}`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={open && safeActive >= 0 ? `${listId}-opt-${safeActive}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "region-hint" : undefined}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={onInput}
          onBlur={onBlur}
          onFocus={() => {
            setBrowsing(true);
            setOpen(true);
            setActive(value ? options.findIndex((option) => option.value === value) : -1);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="region-chevron" aria-hidden="true"></span>
      </div>
      {hint && (
        <p className="region-hint" id="region-hint" role="status">{hint}</p>
      )}
      {open && (
        <ul className="region-list" id={listId} role="listbox" aria-label={listLabel}>
          {visible.length === 0 ? (
            <li className="region-empty">{emptyMessage}</li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`region-option${index === safeActive ? " active" : ""}${option.value === value ? " selected" : ""}`}
                onMouseEnter={() => setActive(index)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function readInitialLanguage() {
  try {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    const initial = resolveLanguage({ storage: window.localStorage, tags });
    document.documentElement.lang = htmlLang(initial);
    return initial;
  } catch {
    return "en";
  }
}

export default function SignWithClarity() {
  const [lang, setLang] = useState(readInitialLanguage);
  const { page, openPage } = useSitePage(lang);
  const [tab, setTab] = useState("paste");
  const [workMode, setWorkMode] = useState(() => (devCompareSample() ? "compare" : "single"));
  const [policies, setPolicies] = useState(() => devCompareSample()?.policies || [emptyPolicy(), emptyPolicy()]);
  const [comparison, setComparison] = useState(null);
  const [compareParts, setCompareParts] = useState(1);
  const [account, setAccount] = useState(null);
  const comparisonIdRef = useRef("");
  const [docText, setDocText] = useState("");
  const [fileName, setFileName] = useState("");
  const [country, setCountry] = useState(() => devCompareSample()?.country || "Canada");
  const [region, setRegion] = useState(() => devCompareSample()?.region || "");
  const [needsRegion, setNeedsRegion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [partsRead, setPartsRead] = useState(1);
  const [results, setResults] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [errorText, setErrorText] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [usage, setUsage] = useState(null);
  const fileRef = useRef();
  const plan = useMemo(() => (docText.trim() ? planDocument(docText) : null), [docText]);
  const tooLong = Boolean(plan && !plan.ok && plan.reason === "too_long");
  const error = errorKey ? t(lang, errorKey) : errorText;
  const atLimit = errorCode === "monthly_limit"
    || errorCode === "fair_use"
    || (usage?.limited && usage.plan !== "household" && (usage.remaining ?? 0) <= 0);
  const usageMessage = usageStatusMessage(lang, atLimit && usage ? { ...usage, remaining: 0 } : usage);
  const regionHint = needsRegion
    ? t(lang, country === "Canada" ? "regionHintCanada" : "regionHintUS")
    : "";

  useEffect(() => {
    document.documentElement.lang = htmlLang(lang);
  }, [lang]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadOwnPlan().then((row) => {
        if (!active) return;
        setAccount(row?.account || null);
      }).catch(() => {
        if (active) setAccount(null);
      });
    };
    refresh();
    window.addEventListener("swc-account-refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("swc-account-refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function selectLanguage(next) {
    setLang(next);
    storeLanguage(window.localStorage, next);
  }

  function openPricing(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    openPage(event, "/");
    window.setTimeout(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function clearError() {
    setErrorKey("");
    setErrorText("");
    setErrorCode((code) => (code === "monthly_limit" || code === "fair_use" ? code : ""));
  }

  // Dev-only samples for local checks. Vite removes this block from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const sample = new URLSearchParams(window.location.search).get("sample");
    if (sample !== "long" && sample !== "toolong" && sample !== "error") return undefined;
    let cancelled = false;
    const pages = sample === "toolong" ? 90 : 18;
    fetch(`/__swc_sample?kind=${sample}&pages=${pages}`)
      .then((response) => response.text())
      .then((text) => {
        if (cancelled || !text.trim()) return;
        setDocText(text);
        setTab("paste");
        setErrorKey("");
        setErrorText("");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(script);
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    clearError();
    const result = await readDocumentFile(file);
    setFileName(result.fileName || file.name || "");
    if (result.errorKey) {
      setErrorKey(result.errorKey);
      setErrorText("");
      return;
    }
    setDocText(result.text || "");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const places = regionOptions(country, lang);
  const comparePreview = import.meta.env.DEV && (() => {
    try {
      return new URLSearchParams(window.location.search).get("sample") === "compare";
    } catch {
      return false;
    }
  })();
  const allowedToCompare = comparePreview || canCompareAccount(account);
  const yearlyCompareBlocked = !comparePreview
    && isYearlyActive(account)
    && (account?.yearly_used || 0) >= YEARLY_FAIR_USE_LIMIT
    && visibleChecks(account) === 0;
  const compareNote = yearlyCompareBlocked
    ? t(lang, "fairUseReached", { date: formatResetDate(isoDate(account?.period_end), lang) })
    : t(lang, "compareNeedsPlan");
  const filledPolicies = policies.filter((policy) => policy.text.trim());
  const compareTooLong = policies.some((policy) => {
    if (!policy.text.trim()) return false;
    const planned = planDocument(policy.text);
    return !planned.ok && planned.reason === "too_long";
  });
  const regionLabel = t(lang, country === "Canada" ? "regionLabelCanada" : "regionLabelUS");
  const regionListLabel = t(lang, country === "Canada" ? "regionListCanada" : "regionListUS");
  const copy = loadingCopy(lang, progress);

  const decode = async () => {
    if (!docText.trim()) {
      setErrorKey("errorEmpty");
      setErrorText("");
      return;
    }
    if (!places.some((option) => option.value === region)) {
      clearError();
      setNeedsRegion(true);
      return;
    }
    setNeedsRegion(false);
    if (tooLong || atLimit) return;

    clearError();
    setLoading(true);
    setResults(null);
    setPartsRead(1);

    try {
      const outcome = await runDecode({
        text: docText,
        country,
        region,
        language: lang,
        onProgress: setProgress,
        request: (payload) => postDecode(payload, {
          onUsage: setUsage,
          accessToken: currentAccessToken,
        }),
      });
      setComparison(null);
      setResults(outcome.results);
      setPartsRead(outcome.parts);
      window.dispatchEvent(new Event("swc-account-refresh"));
    } catch (err) {
      if (err instanceof DecodeError && err.usage) setUsage(err.usage);
      if (err instanceof DecodeError && (err.code === "monthly_limit" || err.code === "fair_use")) {
        setErrorCode("monthly_limit");
        setErrorKey("");
        setErrorText("");
      } else {
        setErrorCode("");
        const message = err instanceof DecodeError ? err.message : t(lang, "errorGeneric");
        setErrorKey("");
        setErrorText(message);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const compare = async () => {
    if (filledPolicies.length < 2) {
      setErrorKey(filledPolicies.length === 0 ? "compareNeedText" : "compareCount");
      setErrorText("");
      setErrorCode("");
      return;
    }
    if (!places.some((option) => option.value === region)) {
      clearError();
      setNeedsRegion(true);
      return;
    }
    setNeedsRegion(false);
    if (compareTooLong || !allowedToCompare) return;

    clearError();
    setLoading(true);
    setResults(null);
    setComparison(null);
    if (!comparisonIdRef.current) comparisonIdRef.current = globalThis.crypto.randomUUID();

    try {
      const outcome = await runComparison({
        policies: policies.filter((policy) => policy.text.trim()),
        country,
        region,
        language: lang,
        comparisonId: comparisonIdRef.current,
        onProgress: setProgress,
        request: (payload) => postDecode(payload, {
          onUsage: setUsage,
          accessToken: currentAccessToken,
        }),
      });
      comparisonIdRef.current = "";
      setComparison(outcome.comparison);
      setCompareParts(outcome.parts);
      window.dispatchEvent(new Event("swc-account-refresh"));
    } catch (err) {
      if (err instanceof DecodeError && err.usage) setUsage(err.usage);
      if (err instanceof DecodeError && (err.code === "compare_needs_plan" || err.code === "fair_use" || err.code === "monthly_limit")) {
        setErrorCode(err.code === "fair_use" ? "fair_use" : err.code);
        setErrorKey("");
        setErrorText("");
      } else {
        setErrorCode("");
        const message = err instanceof DecodeError ? err.message : t(lang, "errorGeneric");
        setErrorKey("");
        setErrorText(message);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const showForm = !results && !comparison && !loading;

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <a className="logo" href="/" onClick={(event) => openPage(event, "/")}>
            <span className="logo-name">Sign With Clarity</span>
            <span className="logo-tagline">{t(lang, "tagline")}</span>
          </a>
          <div className="header-tools">
            <a className="header-link" href="/#pricing" onClick={openPricing}>{t(lang, "pricingLink")}</a>
            <div className="lang-switch" role="group" aria-label={t(lang, "languageSwitcher")}>
              {LANGUAGE_CHOICES.map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  lang={choice.code}
                  aria-pressed={lang === choice.code}
                  onClick={() => selectLanguage(choice.code)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <span className="header-badge">{t(lang, "badge")}</span>
          </div>
        </header>

        <AccountBar lang={lang} />

        {page === "home" ? (
        <>
        {/* HERO */}
        <div className="hero">
          <p className="hero-eyebrow">{t(lang, "heroEyebrow")}</p>
          <h1 className="hero-title">{t(lang, "heroTitleLead")}<br /><em>{t(lang, "heroTitleEm")}</em></h1>
          <p className="hero-sub">{t(lang, "heroSub")}</p>
          <div className="hero-trust">
            <span className="trust-item"><span className="trust-dot"></span>{t(lang, "trustNotAdvice")}</span>
            <span className="trust-item"><span className="trust-dot"></span>{t(lang, "trustPlain")}</span>
            <span className="trust-item"><span className="trust-dot"></span>{t(lang, "trustPlaces")}</span>
          </div>
        </div>

        <main className={workMode === "compare" || comparison ? "main main-wide" : "main"}>
          {/* UPLOAD CARD */}
          {showForm && (
            <div className="upload-card">
              <div className="upload-card-header">
                <span className="upload-card-header-icon">📄</span>
                <span className="upload-card-title">{t(lang, workMode === "compare" ? "compareUploadTitle" : "uploadTitle")}</span>
              </div>
              <div className="upload-card-body">
                <div className="mode-switch" role="group" aria-label={t(lang, "workModeLabel")}>
                  <button type="button" className={`tab ${workMode === "single" ? "active" : ""}`} onClick={() => { setWorkMode("single"); clearError(); }}>
                    {t(lang, "modeSingle")}
                  </button>
                  <button type="button" className={`tab ${workMode === "compare" ? "active" : ""}`} onClick={() => { setWorkMode("compare"); clearError(); }}>
                    {t(lang, "modeCompare")}
                  </button>
                </div>

                {workMode === "compare" ? (
                  <ComparePanel
                    lang={lang}
                    policies={policies}
                    onChange={(next) => { setPolicies(next); clearError(); }}
                    onError={(key) => {
                      setErrorKey(key || "");
                      setErrorText("");
                      setErrorCode("");
                    }}
                  />
                ) : (
                <>
                <div className="tabs">
                  <button type="button" className={`tab ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>✏️ {t(lang, "tabPaste")}</button>
                  <button type="button" className={`tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>📎 {t(lang, "tabUpload")}</button>
                </div>

                {tab === "paste" ? (
                  <textarea
                    className="doc-textarea"
                    placeholder={t(lang, "pastePlaceholder")}
                    value={docText}
                    onChange={e => { setDocText(e.target.value); clearError(); }}
                  />
                ) : (
                  <div
                    className={`file-drop ${fileName ? "dragover" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current.click()}
                  >
                    <div className="file-drop-icon">📁</div>
                    <p className="file-drop-text">
                      <strong>{t(lang, "fileChoose")}</strong><br />
                      {t(lang, "fileDrop")}<br />
                      <span style={{fontSize: "11px", marginTop: "4px", display: "block"}}>{t(lang, "fileTypes")}</span>
                    </p>
                    {fileName && <p className="file-name">✅ {fileName}</p>}
                    <input ref={fileRef} type="file" accept=".txt,.pdf" style={{display:"none"}} onChange={e => handleFile(e.target.files[0])} />
                  </div>
                )}
                </>
                )}

                <p className="storage-note">{storageNote(lang)}</p>

                {/* COUNTRY + REGION SELECTORS */}
                <div className="province-row">
                  <span className="province-label">{t(lang, "countryLabel")}</span>
                  <select
                    className="province-select"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setRegion("");
                      setNeedsRegion(false);
                    }}
                  >
                    <option value="Canada">{t(lang, "countryCanada")}</option>
                    <option value="United States">{t(lang, "countryUS")}</option>
                  </select>
                </div>

                <div className="region-block">
                  <label className="province-label" htmlFor="region-input">{regionLabel}</label>
                  <RegionCombobox
                    key={`${country}-${lang}`}
                    id="region-input"
                    options={places}
                    value={region}
                    hint={regionHint}
                    placeholder={t(lang, "regionPlaceholder")}
                    listLabel={regionListLabel}
                    emptyMessage={t(lang, "regionEmpty")}
                    onChange={(next) => {
                      setRegion(next);
                      if (next) setNeedsRegion(false);
                    }}
                  />
                </div>

                {workMode === "single" && plan?.ok && plan.chunks.length > 1 && (
                  <p className="length-note">{longDocumentNote(plan, lang)}</p>
                )}

                {workMode === "single" && tooLong && (
                  <div className="error-msg" role="alert">⚠️ {tooLongMessage(plan, lang)}</div>
                )}
                {workMode === "single" && !tooLong && atLimit && usageMessage && (
                  <div className="limit-msg" role="status">
                    {usageMessage}
                    {errorCode !== "fair_use" && (
                      <p className="usage-note"><a href="/#pricing" onClick={openPricing}>{t(lang, "pricingSeePlans")}</a></p>
                    )}
                  </div>
                )}
                {workMode === "compare" && (!allowedToCompare || errorCode === "compare_needs_plan" || errorCode === "fair_use") && (
                  <div className="compare-note" role="status">
                    {errorCode === "fair_use" && usageMessage ? usageMessage : compareNote}
                    {errorCode !== "fair_use" && !yearlyCompareBlocked && (
                      <p className="usage-note"><a href="/#pricing" onClick={openPricing}>{t(lang, "pricingSeePlans")}</a></p>
                    )}
                  </div>
                )}
                {error && ((workMode === "single" && !tooLong && !atLimit) || (workMode === "compare" && allowedToCompare && errorCode !== "compare_needs_plan")) && (
                  <div className="error-msg" role="alert">⚠️ {error}</div>
                )}

                {workMode === "single" ? (
                  <>
                    <button className="decode-btn" onClick={decode} disabled={!docText.trim() || tooLong || atLimit}>
                      ✨ {t(lang, "decodeButton")}
                    </button>
                    <span className="decode-btn-sub">{t(lang, "decodeSub")}</span>
                    {!atLimit && usageMessage && (
                      <p className="usage-note">{usageMessage}</p>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      className="decode-btn"
                      onClick={compare}
                      disabled={filledPolicies.length < 2 || compareTooLong || !allowedToCompare}
                    >
                      {t(lang, "compareButton")}
                    </button>
                    <span className="decode-btn-sub">{t(lang, "compareSub")}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="loading-card" role="status" aria-live="polite" aria-busy="true">
              <div className="spinner"></div>
              <h2 className="loading-title">{copy.title}</h2>
              <p className="loading-sub">{copy.sub}</p>
              {progress?.total > 1 && (
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${progressPercent(progress)}%` }}></div>
                </div>
              )}
            </div>
          )}

          {/* RESULTS */}
          {results && (
            <div className="results">
              <div className="results-header">
                <h2 className="results-title">{t(lang, "resultsTitle")}</h2>
                <p className="results-sub">{t(lang, "resultsSub")}</p>
                {partsRead > 1 && (
                  <p className="results-sub">{t(lang, "resultsWhole")}</p>
                )}
                {usageMessage && (
                  <p className="usage-note">{usageMessage}</p>
                )}
              </div>

              <div className="result-section section-summary">
                <div className="result-section-header">
                  <span className="result-section-icon">📋</span>
                  <span className="result-section-title">{t(lang, "sectionSummary")}</span>
                </div>
                <div className="result-section-body">{results.summary}</div>
              </div>

              <div className="result-section section-flags">
                <div className="result-section-header">
                  <span className="result-section-icon">⚠️</span>
                  <span className="result-section-title">{t(lang, "sectionFlags")}</span>
                </div>
                <div className="result-section-body">{results.flags}</div>
              </div>

              <div className="result-section section-questions">
                <div className="result-section-header">
                  <span className="result-section-icon">❓</span>
                  <span className="result-section-title">{t(lang, "sectionQuestions")}</span>
                </div>
                <div className="result-section-body">{results.questions}</div>
              </div>

              <div className="result-section section-terms">
                <div className="result-section-header">
                  <span className="result-section-icon">📖</span>
                  <span className="result-section-title">{t(lang, "sectionTerms")}</span>
                </div>
                <div className="result-section-body">{results.terms}</div>
              </div>

              <div className="disclaimer">
                <span className="disclaimer-icon">⚖️</span>
                <p className="disclaimer-text">
                  <strong>{t(lang, "disclaimerStrong")}</strong> {t(lang, "disclaimerRest")}
                </p>
              </div>

              <button className="new-decode-btn" onClick={() => { setResults(null); setDocText(""); setFileName(""); }}>
                {t(lang, "newDecode")}
              </button>
            </div>
          )}

          {comparison && !loading && (
            <ComparisonResult
              lang={lang}
              comparison={comparison}
              parts={compareParts}
              usageMessage={usageMessage}
              onAgain={() => {
                setComparison(null);
                setPolicies([emptyPolicy(), emptyPolicy()]);
              }}
            />
          )}

          {/* HOW IT WORKS */}
          {showForm && workMode === "single" && (
            <div className="how-section">
              <h2 className="how-title">{t(lang, "howTitle")}</h2>
              <p className="how-sub">{t(lang, "howSub")}</p>
              <div className="how-steps">
                {[
                  { n: "1", title: t(lang, "step1Title"), desc: t(lang, "step1Desc") },
                  { n: "2", title: t(lang, "step2Title"), desc: t(lang, "step2Desc") },
                  { n: "3", title: t(lang, "step3Title"), desc: t(lang, "step3Desc") },
                ].map(s => (
                  <div className="how-step" key={s.n}>
                    <div className="step-num">{s.n}</div>
                    <div className="step-text">
                      <strong>{s.title}</strong>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Pricing lang={lang} country={country} />
        </main>
        </>
        ) : (
          <LegalPage kind={page} lang={lang} onNavigate={openPage} />
        )}

        <footer className="footer">
          <p className="footer-name">Sign With Clarity</p>
          <p className="footer-text">{t(lang, "footerText")}</p>
          <nav className="footer-links" aria-label={t(lang, "footerNav")}>
            <a href="/#pricing" onClick={openPricing}>{t(lang, "pricingLink")}</a>
            <a href="/privacy" onClick={(event) => openPage(event, "/privacy")}>{t(lang, "privacyLink")}</a>
            <a href="/terms" onClick={(event) => openPage(event, "/terms")}>{t(lang, "termsLink")}</a>
          </nav>
        </footer>
      </div>
    </>
  );
}
