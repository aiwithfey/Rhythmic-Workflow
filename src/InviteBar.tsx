import React, { useState } from "react";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", magentaSoft: "#F1D6E5", mute: "#BDB2AE",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

/**
 * Adding someone to the team happens a handful of times ever, so it sits below
 * the account rather than inside a view people use daily — collapsed until
 * asked for.
 */
export default function InviteBar({ invites, onInvite, onRevoke }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  function send() {
    const address = email.trim();
    if (!address) return;
    onInvite(address);
    setEmail("");
  }

  return (
    <div style={{ direction: "rtl", fontFamily: BODY, background: C.creamDeep, padding: "0 14px 34px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            style={{
              width: "100%", background: "transparent", border: `1px dashed ${C.mute}`,
              borderRadius: 14, padding: "10px 0", fontSize: 12.5, fontWeight: 700,
              color: C.inkSoft, cursor: "pointer", fontFamily: DISPLAY,
            }}
          >
            הוספת חברת צוות{invites.length > 0 ? ` · ${invites.length} ממתינות` : ""}
          </button>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 14, padding: 12,
            boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>הזמנת חברת צוות</div>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: C.inkSoft, fontSize: 14, cursor: "pointer",
              }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="אימייל להזמנה..."
                style={{
                  flex: 1, minWidth: 0, borderRadius: 10, border: `1px solid ${C.line}`,
                  padding: "8px 10px", fontSize: 13, fontFamily: BODY,
                  direction: "ltr", textAlign: "right", boxSizing: "border-box",
                  background: C.cream, color: C.ink,
                }}
              />
              <button onClick={send} style={{
                background: C.magenta, color: "#fff", border: "none", borderRadius: 10,
                padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: DISPLAY,
              }}>הזמיני</button>
            </div>

            {invites.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {invites.map((address) => (
                  <span key={address} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: C.cream, border: `1px dashed ${C.mute}`, borderRadius: 999,
                    padding: "4px 9px", fontSize: 11.5, color: C.inkSoft, direction: "ltr",
                  }}>
                    {address}
                    <button onClick={() => onRevoke(address)} style={{
                      background: "none", border: "none", color: C.mute,
                      cursor: "pointer", fontSize: 12, padding: 0,
                    }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: C.mute, marginTop: 8 }}>
              היא תצטרף לצוות אוטומטית בכניסה הראשונה שלה.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
