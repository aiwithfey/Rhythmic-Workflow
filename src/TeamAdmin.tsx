import React, { useState } from "react";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", mute: "#BDB2AE",
  sage: "#5E8B5A", sageSoft: "#E2EBDE", alert: "#C0574F", alertSoft: "#F7E3E0",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

/**
 * Google Console decides who can authenticate; this decides who is on the team.
 * Only the owner sees it, and only the owner's calls survive the database —
 * the functions behind these two buttons re-check the role themselves.
 */
export default function TeamAdmin({ pending, members, me, onApprove, onRemove }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null); // user id awaiting a second press
  const others = members.filter((m) => m.id !== me);

  if (!open) {
    return (
      <div style={wrap}>
        <div style={card}>
          <button onClick={() => setOpen(true)} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: C.inkSoft, fontSize: 11.5, fontWeight: 700, fontFamily: BODY,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ⚙️ ניהול הצוות
            {pending.length > 0 && (
              <span style={{
                background: C.magenta, color: "#fff", borderRadius: 999,
                fontSize: 10.5, fontWeight: 700, padding: "1px 7px",
              }}>{pending.length} ממתינות</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 700 }}>ניהול הצוות</span>
          <button onClick={() => { setOpen(false); setConfirming(null); }} style={{
            background: "none", border: "none", color: C.inkSoft,
            fontSize: 12, cursor: "pointer", fontFamily: BODY,
          }}>סגירה</button>
        </div>

        <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 700, marginBottom: 6 }}>
          ממתינות לאישור
        </div>
        {pending.length === 0 ? (
          <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 12 }}>
            אף אחת לא מחכה כרגע.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {pending.map((p) => (
              <div key={p.id} style={row}>
                <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <div style={{
                    fontSize: 11, color: C.mute, direction: "ltr", textAlign: "right",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{p.email}</div>
                </div>
                <button onClick={() => onApprove(p.id)} style={{
                  background: C.sage, color: "#fff", border: "none", borderRadius: 999,
                  padding: "5px 13px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: DISPLAY, flexShrink: 0,
                }}>אישור</button>
              </div>
            ))}
          </div>
        )}

        <div style={{
          fontSize: 11.5, color: C.inkSoft, fontWeight: 700,
          borderTop: `1px solid ${C.line}`, paddingTop: 10, marginBottom: 6,
        }}>
          חברות הצוות
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {others.map((m) => (
            <div key={m.id} style={row}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {m.name}
                  {m.role === "owner" && (
                    <span style={{ fontSize: 10.5, color: C.magenta, fontWeight: 700, marginRight: 6 }}>
                      מנהלת
                    </span>
                  )}
                </div>
              </div>
              {confirming === m.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { onRemove(m.id); setConfirming(null); }} style={{
                    background: C.alert, color: "#fff", border: "none", borderRadius: 999,
                    padding: "5px 13px", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: DISPLAY,
                  }}>להסיר</button>
                  <button onClick={() => setConfirming(null)} style={{
                    background: "none", border: "none", color: C.inkSoft,
                    fontSize: 11.5, cursor: "pointer", fontFamily: BODY,
                  }}>ביטול</button>
                </div>
              ) : (
                <button onClick={() => setConfirming(m.id)} style={{
                  background: "none", border: `1px solid ${C.line}`, borderRadius: 999,
                  color: C.inkSoft, fontSize: 11.5, padding: "5px 11px",
                  cursor: "pointer", fontFamily: BODY, flexShrink: 0,
                }}>הסרה</button>
              )}
            </div>
          ))}
          {others.length === 0 && (
            <div style={{ fontSize: 11.5, color: C.mute }}>רק את כאן בינתיים.</div>
          )}
        </div>

        {confirming && (
          <div style={{
            marginTop: 10, background: C.alertSoft, color: C.alert, borderRadius: 10,
            padding: "8px 10px", fontSize: 11.5, lineHeight: 1.6, textAlign: "right",
          }}>
            הכרטיסים שלה יישארו בלוח בלי בעלות — מחכים למישהי שתיקח אותם.
            ההערות הפרטיות שלה יימחקו.
          </div>
        )}
      </div>
    </div>
  );
}

const wrap = { direction: "rtl", fontFamily: BODY, background: C.creamDeep, padding: "0 14px 14px" };
const card = {
  maxWidth: 480, margin: "0 auto", background: "#fff", borderRadius: 16,
  padding: 12, boxShadow: "0 2px 10px rgba(46,34,48,0.06)", color: C.ink,
};
const row = {
  display: "flex", alignItems: "center", gap: 10,
  background: C.cream, borderRadius: 10, padding: "7px 10px",
};
