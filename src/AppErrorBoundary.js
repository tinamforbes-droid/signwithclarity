import { Component, createElement } from "react";

import { readStoredLanguage, t } from "../shared/messages.js";

const pageStyle = {
  boxSizing: "border-box",
  minHeight: "100vh",
  margin: 0,
  padding: "3rem 1.25rem",
  background: "#f7f4ef",
  color: "#1c2430",
  fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
};

const wrapStyle = {
  maxWidth: "32rem",
  margin: "0 auto",
};

const buttonStyle = {
  marginTop: "1.25rem",
  padding: "0.7rem 1.1rem",
  border: "1px solid #1c2430",
  borderRadius: "999px",
  background: "#1c2430",
  color: "#f7f4ef",
  font: "inherit",
  cursor: "pointer",
};

export function boundaryLanguage() {
  try {
    return readStoredLanguage(globalThis.localStorage) || "en";
  } catch {
    return "en";
  }
}

export function RenderProblem({ lang = "en", onReload }) {
  return createElement(
    "main",
    { style: pageStyle },
    createElement(
      "div",
      { style: wrapStyle },
      createElement("h1", null, t(lang, "renderErrorTitle")),
      createElement("p", null, t(lang, "renderErrorBody")),
      createElement(
        "button",
        { type: "button", style: buttonStyle, onClick: onReload },
        t(lang, "renderErrorReload"),
      ),
    ),
  );
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`swc render name=${error?.name || "Error"}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return createElement(RenderProblem, {
      lang: boundaryLanguage(),
      onReload: () => globalThis.location?.reload(),
    });
  }
}
