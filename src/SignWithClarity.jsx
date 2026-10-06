import { useState, useRef, useEffect } from "react";

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
  .loading-sub { font-size: 13px; color: var(--text-light); }

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

  .error-msg {
    background: #fdf2f2;
    border: 1px solid #f5c6c6;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--red-flag);
    margin-top: 12px;
  }
`;

const CANADIAN_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
  "Northwest Territories", "Nunavut", "Yukon"
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
];

export default function SignWithClarity() {
  const [tab, setTab] = useState("paste");
  const [docText, setDocText] = useState("");
  const [fileName, setFileName] = useState("");
  const [country, setCountry] = useState("Canada");
  const [region, setRegion] = useState("Alberta");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();

  // When country changes, reset region to first option for that country
  useEffect(() => {
    if (country === "Canada") {
      setRegion("Alberta");
    } else {
      setRegion("Alabama");
    }
  }, [country]);

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
    setFileName(file.name);
    setError("");

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");
          fullText += pageText + "\n";
        }
        if (fullText.trim()) {
          setDocText(fullText);
        } else {
          setError("This PDF appears to be scanned or image-based. Please copy and paste the text instead.");
        }
      } catch (err) {
        setError("Couldn't read this PDF. Please try copying and pasting the text instead.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setDocText(e.target.result);
      reader.readAsText(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const decode = async () => {
    if (!docText.trim()) {
      setError("Please paste your document text or upload a file first.");
      return;
    }
    setError("");
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch("/.netlify/functions/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          region,
          docText: docText.slice(0, 4000)
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const text = data.text || "";

      try {
        const parsed = JSON.parse(text);
        setResults(parsed);
      } catch {
        const clean = text.replace(/```json|```/g, "").trim();
        setResults(JSON.parse(clean));
      }
    } catch (err) {
      setError("Something went wrong. Please try again in a moment.");
    }
    setLoading(false);
  };

  const regionOptions = country === "Canada" ? CANADIAN_PROVINCES : US_STATES;
  const regionLabel = country === "Canada" ? "Your province:" : "Your state:";

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <span className="logo-name">Sign With Clarity</span>
            <span className="logo-tagline">Understand before you sign</span>
          </div>
          <span className="header-badge">🇨🇦🇺🇸 CA & US</span>
        </header>

        {/* HERO */}
        <div className="hero">
          <p className="hero-eyebrow">Insurance Document Decoder</p>
          <h1 className="hero-title">Your policy,<br /><em>in plain English</em></h1>
          <p className="hero-sub">Paste or upload any insurance document and we'll tell you exactly what it means — no legal training required.</p>
          <div className="hero-trust">
            <span className="trust-item"><span className="trust-dot"></span>Not legal advice</span>
            <span className="trust-item"><span className="trust-dot"></span>Plain language</span>
            <span className="trust-item"><span className="trust-dot"></span>All provinces & states</span>
          </div>
        </div>

        <main className="main">
          {/* UPLOAD CARD */}
          {!results && !loading && (
            <div className="upload-card">
              <div className="upload-card-header">
                <span className="upload-card-header-icon">📄</span>
                <span className="upload-card-title">Paste or upload your document</span>
              </div>
              <div className="upload-card-body">
                <div className="tabs">
                  <button className={`tab ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>✏️ Paste Text</button>
                  <button className={`tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>📎 Upload File</button>
                </div>

                {tab === "paste" ? (
                  <textarea
                    className="doc-textarea"
                    placeholder="Paste your insurance document text here... (policy wording, renewal notice, claim letter, etc.)"
                    value={docText}
                    onChange={e => setDocText(e.target.value)}
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
                      <strong>Tap to choose a file</strong><br />
                      or drag and drop here<br />
                      <span style={{fontSize: "11px", marginTop: "4px", display: "block"}}>Supports .txt and .pdf text files</span>
                    </p>
                    {fileName && <p className="file-name">✅ {fileName}</p>}
                    <input ref={fileRef} type="file" accept=".txt,.pdf" style={{display:"none"}} onChange={e => handleFile(e.target.files[0])} />
                  </div>
                )}

                {/* COUNTRY + REGION SELECTORS */}
                <div className="province-row">
                  <span className="province-label">Country:</span>
                  <select className="province-select" value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="Canada">🇨🇦 Canada</option>
                    <option value="United States">🇺🇸 United States</option>
                  </select>
                </div>

                <div className="province-row">
                  <span className="province-label">{regionLabel}</span>
                  <select className="province-select" value={region} onChange={e => setRegion(e.target.value)}>
                    {regionOptions.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                {error && <div className="error-msg">⚠️ {error}</div>}

                <button className="decode-btn" onClick={decode} disabled={!docText.trim()}>
                  ✨ Decode My Document
                </button>
                <span className="decode-btn-sub">Free • Private • Canada & US</span>
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="loading-card">
              <div className="spinner"></div>
              <h2 className="loading-title">Reading your document...</h2>
              <p className="loading-sub">We're translating the fine print into plain language for you.</p>
            </div>
          )}

          {/* RESULTS */}
          {results && (
            <div className="results">
              <div className="results-header">
                <h2 className="results-title">Your Document Decoded ✨</h2>
                <p className="results-sub">Here's what your insurance document actually says</p>
              </div>

              <div className="result-section section-summary">
                <div className="result-section-header">
                  <span className="result-section-icon">📋</span>
                  <span className="result-section-title">Plain Language Summary</span>
                </div>
                <div className="result-section-body">{results.summary}</div>
              </div>

              <div className="result-section section-flags">
                <div className="result-section-header">
                  <span className="result-section-icon">⚠️</span>
                  <span className="result-section-title">Watch Out For</span>
                </div>
                <div className="result-section-body">{results.flags}</div>
              </div>

              <div className="result-section section-questions">
                <div className="result-section-header">
                  <span className="result-section-icon">❓</span>
                  <span className="result-section-title">Questions To Ask Your Insurer</span>
                </div>
                <div className="result-section-body">{results.questions}</div>
              </div>

              <div className="result-section section-terms">
                <div className="result-section-header">
                  <span className="result-section-icon">📖</span>
                  <span className="result-section-title">Key Terms Explained</span>
                </div>
                <div className="result-section-body">{results.terms}</div>
              </div>

              <div className="disclaimer">
                <span className="disclaimer-icon">⚖️</span>
                <p className="disclaimer-text">
                  <strong>Not legal advice.</strong> Sign With Clarity helps you understand documents — it does not provide legal, financial, or insurance advice. For important decisions, always speak with a licensed professional.
                </p>
              </div>

              <button className="new-decode-btn" onClick={() => { setResults(null); setDocText(""); setFileName(""); }}>
                ← Decode Another Document
              </button>
            </div>
          )}

          {/* HOW IT WORKS */}
          {!results && !loading && (
            <div className="how-section">
              <h2 className="how-title">How It Works</h2>
              <p className="how-sub">Three steps to understanding your document</p>
              <div className="how-steps">
                {[
                  { n: "1", title: "Paste or upload", desc: "Copy text from your insurance document or upload a text file." },
                  { n: "2", title: "Select your location", desc: "We tailor the explanation to your province or state's insurance rules." },
                  { n: "3", title: "Read plain English", desc: "Get a clear summary, red flags, questions to ask, and key terms defined." }
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
        </main>

        <footer className="footer">
          <p className="footer-name">Sign With Clarity</p>
          <p className="footer-text">signwithclarity.ca • Helping Canadians and Americans understand what they sign • Not legal advice</p>
        </footer>
      </div>
    </>
  );
}
