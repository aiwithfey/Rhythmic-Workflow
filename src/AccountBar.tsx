import React, { useState } from "react";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", mute: "#BDB2AE",
  sage: "#5E8B5A", alert: "#C0574F",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

/**
 * Signing up gives you a name derived from your email address, which is nobody's
 * name. This is where you fix it — and it is the name your teammates see on
 * every card, so it belongs next to the account, not buried in a settings page.
 */
export default function AccountBar({ profile, email, onRename, onSignOut, onSetPassword }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile?.name || "");
  // An account created with a login code has no password until it is given one.
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwState, setPwState] = useState("idle"); // idle | saving | done | error
  const [pwError, setPwError] = useState("");

  async function savePassword() {
    if (pw.length < 6) { setPwState("error"); setPwError("לפחות 6 תווים."); return; }
    setPwState("saving"); setPwError("");
    const err = await onSetPassword(pw);
    if (err) { setPwState("error"); setPwError(err); return; }
    setPw(""); setPwState("done"); setPwOpen(false);
  }

  function start() {
    setDraft(profile?.name || "");
    setEditing(true);
  }
  function save() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== profile?.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div style={{
      direction: "rtl", fontFamily: BODY, background: C.creamDeep,
      padding: "0 14px 28px",
    }}>
      <div style={{
        maxWidth: 480, margin: "0 auto", background: "#fff", borderRadius: 16,
        padding: 12, boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: C.ink, color: "#fff", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{profile?.initials || "?"}</span>

        {editing ? (
          <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="השם שלך"
              style={{
                flex: 1, minWidth: 0, borderRadius: 10, border: `1px solid ${C.line}`,
                padding: "7px 10px", fontSize: 13.5, fontFamily: BODY,
                direction: "rtl", boxSizing: "border-box", background: C.cream, color: C.ink,
              }}
            />
            <button onClick={save} style={{
              background: C.magenta, color: "#fff", border: "none", borderRadius: 10,
              padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: DISPLAY,
            }}>שמרי</button>
            <button onClick={() => setEditing(false)} style={{
              background: "none", border: "none", color: C.inkSoft,
              fontSize: 12, cursor: "pointer", fontFamily: BODY,
            }}>ביטול</button>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
            <button onClick={start} title="שינוי השם" style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: BODY,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                {profile?.name || "בלי שם"}
              </span>
              <span style={{ fontSize: 11, color: C.magenta, fontWeight: 700 }}>שינוי</span>
            </button>
            <div style={{
              fontSize: 11, color: C.mute, direction: "ltr", textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{email}</div>
          </div>
        )}

        <button onClick={onSignOut} style={{
          background: "none", border: `1px solid ${C.line}`, borderRadius: 999,
          color: C.inkSoft, fontSize: 11.5, padding: "5px 11px", cursor: "pointer",
          flexShrink: 0, fontFamily: BODY,
        }}>יציאה</button>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10 }}>
        {!pwOpen ? (
          <button onClick={() => { setPwOpen(true); setPwState("idle"); }} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: pwState === "done" ? C.sage : C.inkSoft, fontSize: 11.5,
            fontWeight: 700, fontFamily: BODY,
          }}>
            {pwState === "done" ? "✓ הסיסמה נשמרה" : "🔑 הגדרת סיסמה לכניסה"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              type="password" value={pw} autoComplete="new-password"
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") savePassword(); }}
              placeholder="סיסמה חדשה"
              style={{
                flex: 1, minWidth: 120, borderRadius: 10, border: `1px solid ${C.line}`,
                padding: "7px 10px", fontSize: 13, fontFamily: BODY,
                direction: "ltr", textAlign: "right", boxSizing: "border-box",
                background: C.cream, color: C.ink,
              }}
            />
            <button onClick={savePassword} disabled={pwState === "saving"} style={{
              background: C.ink, color: "#fff", border: "none", borderRadius: 10,
              padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              fontFamily: DISPLAY, opacity: pwState === "saving" ? 0.6 : 1,
            }}>{pwState === "saving" ? "שומרת..." : "שמרי"}</button>
            <button onClick={() => { setPwOpen(false); setPw(""); setPwError(""); }} style={{
              background: "none", border: "none", color: C.inkSoft,
              fontSize: 12, cursor: "pointer", fontFamily: BODY,
            }}>ביטול</button>
          </div>
        )}
        {pwError && (
          <div style={{ fontSize: 11.5, color: C.alert, marginTop: 6 }}>{pwError}</div>
        )}
        {!pwOpen && pwState !== "done" && (
          <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>
            כדי להיכנס בלי לחכות לקוד במייל
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
