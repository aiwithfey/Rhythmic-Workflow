import React, { useState } from "react";
import { supabase } from "./supabase";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", magentaSoft: "#F1D6E5", lilacSoft: "#EBDDEA",
  alert: "#C0574F", alertSoft: "#F7E3E0", sage: "#5E8B5A", sageSoft: "#E2EBDE",
  mute: "#BDB2AE",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

// The OAuth client and its redirect URI live in Google Cloud Console; the
// client ID/secret pair is pasted into the Supabase dashboard. Flip this once
// that is done — before it, the button would just fail.
const GOOGLE_ENABLED = true;

// Supabase speaks English to developers. These are the ones a person signing in
// can actually hit, said in a way that tells them what to do next.
function readable(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "האימייל או הסיסמה לא נכונים.";
  if (m.includes("signups not allowed") || m.includes("user not found"))
    return "עוד אין לך חשבון. חשבונות נפתחים ידנית — פנייה למי שמנהלת את המערכת כדי להצטרף.";
  if (m.includes("email not confirmed"))
    return "צריך לאשר את כתובת המייל לפני הכניסה — חפשי את מייל האישור.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "נשלחו יותר מדי קודים. אפשר לנסות שוב בעוד כשעה — או להשתמש בקוד האחרון שקיבלת, אם הוא עדיין במייל.";
  if (m.includes("for security purposes") || m.includes("seconds"))
    return "רגע אחד — אפשר לבקש קוד חדש רק אחרי דקה.";
  if (m.includes("expired") || m.includes("invalid"))
    return "הקוד לא תקף. ייתכן שפג תוקפו או שכבר נשלח קוד חדש יותר — בקשי קוד חדש ונסי שוב.";
  if (m.includes("email") && m.includes("valid"))
    return "כתובת המייל לא נראית תקינה.";
  return message || "משהו השתבש. נסי שוב.";
}

export default function SignIn() {
  const [method, setMethod] = useState("password"); // 'password' | 'code'
  const [step, setStep] = useState("email");        // code flow: 'email' | 'code'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function withPassword(e) {
    e?.preventDefault();
    const address = email.trim();
    if (!address || !password) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (err) setError(readable(err.message));
  }

  async function sendCode(e) {
    e?.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError("");
    // No emailRedirectTo: there is no link to come back from, which is the
    // point — nothing to prefetch, expire, or keep in a redirect allow-list.
    // shouldCreateUser: false — accounts are added manually, not by requesting a code.
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address, options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (err) { setError(readable(err.message)); return; }
    setStep("code");
  }

  async function verify(e) {
    e?.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) { setError("הקוד הוא שש ספרות."); return; }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(), token, type: "email",
    });
    setBusy(false);
    if (err) { setError(readable(err.message)); return; }
    // onAuthStateChange in App takes it from here
  }

  async function signInWithGoogle() {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (err) setError(readable(err.message));
  }

  return (
    <div style={{
      direction: "rtl", fontFamily: BODY, color: C.ink, minHeight: "100vh",
      background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep})`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 26, width: "100%", maxWidth: 380,
        boxShadow: "0 10px 34px rgba(46,34,48,0.12)", textAlign: "center",
      }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700 }}>לוח הקצב שלנו</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6, marginBottom: 22 }}>
          גל של תפוקה, חיבור ומנוחה
        </div>

        {/* Google first: it's the preferred sign-in method. */}
        {GOOGLE_ENABLED && step === "email" && (
          <>
            <button type="button" onClick={signInWithGoogle} style={{
              width: "100%", background: "#ece4d6", color: C.ink, border: "none", borderRadius: 12,
              padding: "11px 0", fontSize: 14, fontWeight: 700, fontFamily: DISPLAY, cursor: "pointer",
              boxSizing: "border-box",
            }}>המשיכי עם Google</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.inkSoft, fontSize: 11.5, margin: "14px 0" }}>
              <span style={{ flex: 1, height: 1, background: C.line }} />
              <span>או</span>
              <span style={{ flex: 1, height: 1, background: C.line }} />
            </div>
          </>
        )}

        {step === "email" && (
          <div style={{
            display: "flex", background: "#F2EDE3", borderRadius: 999, padding: 3, marginBottom: 14,
          }}>
            {[{ k: "password", label: "סיסמה" }, { k: "code", label: "קוד למייל" }].map((o) => (
              <button key={o.k} type="button"
                onClick={() => { setMethod(o.k); setError(""); }}
                style={{
                  flex: 1, border: "none", cursor: "pointer", padding: "7px 0", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 700, fontFamily: DISPLAY,
                  background: method === o.k ? C.ink : "transparent",
                  color: method === o.k ? "#fff" : C.inkSoft,
                }}>{o.label}</button>
            ))}
          </div>
        )}

        {step === "email" && method === "password" ? (
          <form onSubmit={withPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="האימייל שלך" style={inputStyle}
            />
            <input
              type="password" required value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="סיסמה"
              style={{ ...inputStyle, direction: "ltr", textAlign: "right" }}
            />
            <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
              {busy ? "רגע..." : "כניסה"}
            </button>
          </form>
        ) : step === "email" ? (
          <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="האימייל שלך" style={inputStyle}
            />
            <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
              {busy ? "שולחת..." : "שלחי לי קוד כניסה"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              background: C.sageSoft, border: `1px solid ${C.sage}`, borderRadius: 12,
              padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6,
            }}>
              שלחנו קוד בן שש ספרות ל־<b style={{ direction: "ltr", display: "inline-block" }}>{email}</b>
            </div>

            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="־ ־ ־ ־ ־ ־"
              style={{
                ...inputStyle,
                direction: "ltr", textAlign: "center",
                fontSize: 26, fontWeight: 700, letterSpacing: 8, padding: "12px 10px",
                fontVariantNumeric: "tabular-nums",
              }}
            />

            <button type="submit" disabled={busy || code.length < 6}
              style={{ ...primary, opacity: busy || code.length < 6 ? 0.55 : 1 }}>
              {busy ? "בודקת..." : "כניסה"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}
                style={linkBtn}>כתובת אחרת</button>
              <button type="button" onClick={sendCode} disabled={busy}
                style={linkBtn}>שליחת קוד חדש</button>
            </div>
          </form>
        )}

        {error && (
          <div style={{
            marginTop: 12, background: C.alertSoft, color: C.alert, borderRadius: 12,
            padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, textAlign: "right",
          }}>{error}</div>
        )}

        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 18, lineHeight: 1.6 }}>
          הכניסה למי שכבר בצוות בלבד. חברה חדשה מתווספת ידנית — פנייה למי שמנהלת את המערכת כדי להצטרף.
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", borderRadius: 12, border: "1px solid #E2D7C6",
  padding: "11px 13px", fontSize: 14, fontFamily: BODY,
  direction: "rtl", boxSizing: "border-box", background: "#F6F1E9", color: "#2E2230",
};
const primary = {
  background: "#2E2230", color: "#fff", border: "none", borderRadius: 12,
  padding: "11px 0", fontSize: 14, fontWeight: 700, fontFamily: DISPLAY, cursor: "pointer",
};
const linkBtn = {
  background: "none", border: "none", color: "#6E5C6B",
  fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: BODY,
};
