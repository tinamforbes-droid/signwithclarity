import { useEffect, useState } from "react";

import { isPlausibleEmail, magicLinkRequest } from "../shared/session.js";
import { t } from "../shared/messages.js";
import { loadOwnPlan } from "./accountRow.js";
import { authConfigured, getAuthClient } from "./authClient.js";

function sessionEmail(session) {
  const email = session?.user?.email;
  return typeof email === "string" ? email : "";
}

export default function AccountBar({ lang }) {
  const [phase, setPhase] = useState(() => (authConfigured() ? "loading" : "unavailable"));
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [planHint, setPlanHint] = useState("");

  useEffect(() => {
    const client = getAuthClient();
    if (!client) return undefined;

    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const found = sessionEmail(data.session);
      if (found) {
        setSignedInEmail(found);
        setPhase("signedIn");
      } else {
        setPhase((current) => (current === "loading" ? "signedOut" : current));
      }
    }).catch(() => {
      if (active) setPhase((current) => (current === "loading" ? "signedOut" : current));
    });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      const found = sessionEmail(session);
      if (found) {
        setSignedInEmail(found);
        setPendingEmail("");
        setErrorKey("");
        setPhase("signedIn");
        return;
      }
      if (event === "SIGNED_OUT") {
        setSignedInEmail("");
        setPlanHint("");
        setPhase("signedOut");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (phase !== "signedIn") return undefined;
    let active = true;
    const refresh = () => {
      loadOwnPlan().then((row) => {
        if (!active) return;
        const account = row?.account;
        if (account?.plan === "yearly" && account.paid) {
          setPlanHint(t(lang, "signedInYearly"));
          return;
        }
        const credits = account?.plan === "household" && account.paid ? account.credits_remaining : 0;
        if (credits > 0) {
          setPlanHint(t(lang, "signedInHousehold", { count: credits }));
          return;
        }
        setPlanHint("");
      }).catch(() => {
        if (active) setPlanHint("");
      });
    };
    refresh();
    window.addEventListener("swc-account-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("swc-account-refresh", refresh);
    };
  }, [phase, lang]);

  async function onSubmit(event) {
    event.preventDefault();
    const client = getAuthClient();
    if (!client) {
      setPhase("unavailable");
      return;
    }
    if (!isPlausibleEmail(email)) {
      setErrorKey("signInInvalidEmail");
      return;
    }
    setErrorKey("");
    setPhase("sending");
    const request = magicLinkRequest(email, window.location.origin);
    try {
      const { error } = await client.auth.signInWithOtp(request);
      if (error) {
        setPhase("signedOut");
        setErrorKey("signInFailed");
        return;
      }
      setPendingEmail(request.email);
      setPhase("checkEmail");
    } catch {
      setPhase("signedOut");
      setErrorKey("signInFailed");
    }
  }

  async function onSignOut() {
    const client = getAuthClient();
    setErrorKey("");
    try {
      if (client) await client.auth.signOut();
      setSignedInEmail("");
      setPhase("signedOut");
    } catch {
      setErrorKey("signOutFailed");
    }
  }

  const showForm = phase === "signedOut" || phase === "sending";

  return (
    <section className="account-bar" aria-label={t(lang, "signInEmailLabel")}>
      <div className="account-inner">
        {phase !== "signedIn" && phase !== "checkEmail" && (
          <p className="account-lead">{t(lang, "signInOptional")}</p>
        )}

        {phase === "unavailable" && (
          <p className="account-hint">{t(lang, "signInUnavailable")}</p>
        )}

        {showForm && (
          <form className="account-form" noValidate onSubmit={onSubmit}>
            <label className="account-label" htmlFor="sign-in-email">{t(lang, "signInEmailLabel")}</label>
            <input
              id="sign-in-email"
              className="account-input"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              disabled={phase === "sending"}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorKey("");
              }}
            />
            <button className="account-btn" type="submit" disabled={phase === "sending"}>
              {phase === "sending" ? t(lang, "signInSending") : t(lang, "signInButton")}
            </button>
            <p className="account-hint">{t(lang, "signInHint")}</p>
          </form>
        )}

        {phase === "checkEmail" && (
          <div className="account-status" role="status">
            <p>{t(lang, "signInCheckEmail", { email: pendingEmail })}</p>
            <button
              className="account-btn"
              type="button"
              onClick={() => {
                setPhase("signedOut");
                setErrorKey("");
              }}
            >
              {t(lang, "signInChange")}
            </button>
          </div>
        )}

        {phase === "signedIn" && (
          <div className="account-signed">
            <p className="account-status" role="status">{t(lang, "signedInAs", { email: signedInEmail })}</p>
            <button className="account-btn" type="button" onClick={onSignOut}>
              {t(lang, "signOutButton")}
            </button>
            <p className="account-hint">{phase === "signedIn" ? (planHint || t(lang, "signedInCount")) : ""}</p>
          </div>
        )}

        {errorKey && (
          <p className="account-error" role="alert">{t(lang, errorKey)}</p>
        )}
      </div>
    </section>
  );
}
