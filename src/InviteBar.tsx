import React, { useState } from "react";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", magentaSoft: "#F1D6E5", mute: "#BDB2AE",
  sage: "#5E8B5A", sageSoft: "#E2EBDE",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

const linkFor = (token) =>
  `${window.location.origin}${window.location.pathname}?invite=${token}`;

function daysLeft(iso) {
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  return d <= 1 ? "יום אחרון" : `עוד ${d} ימים`;
}

/**
 * Adding someone to the team happens a handful of times ever, so it sits below
 * the account rather than inside a view people use daily — collapsed until
 * asked for.
 *
 * Two ways in. The link is the one to reach for: send it over WhatsApp and the
 * only email involved is their login code, which matters because the built-in
 * sender allows two an hour.
 */
export default function InviteBar({
  invites, links = [], isOwner = false,
  onInvite, onRevoke, onCreateLink, onRevokeLink, onCreateUser,
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [minting, setMinting] = useState(false);
  const [copied, setCopied] = useState("");
  const [failed, setFailed] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", password: "" });
  const [nuState, setNuState] = useState("idle"); // idle | saving | done
  const [nuError, setNuError] = useState("");

  async function createUser() {
    if (!nu.email || nu.password.length < 6) {
      setNuError("צריך אימייל וסיסמה של 6 תווים לפחות."); return;
    }
    setNuState("saving"); setNuError("");
    const problem = await onCreateUser(nu);
    setNuState(problem ? "idle" : "done");
    if (problem) { setNuError(problem); return; }
    setNu({ name: "", email: "", password: "" });
  }

  const pending = invites.length + links.length;

  function send() {
    const address = email.trim();
    if (!address) return;
    onInvite(address);
    setEmail("");
  }

  async function mint() {
    setMinting(true);
    setFailed(false);
    const token = await onCreateLink(label);
    setMinting(false);
    // A silent no-op is the worst outcome here: say it failed and let the
    // banner above carry the reason.
    if (!token) { setFailed(true); return; }
    setLabel("");
    copy(token);
  }

  async function copy(token) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // the clipboard can be refused; the link is still listed to copy by hand
    }
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
            הוספת חברת צוות{pending > 0 ? ` · ${pending} ממתינות` : ""}
          </button>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 14, padding: 12,
            boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>הוספת חברת צוות</div>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: C.inkSoft, fontSize: 14, cursor: "pointer",
              }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") mint(); }}
                placeholder="למי הקישור? (לא חובה)"
                style={inputStyle}
              />
              <button onClick={mint} disabled={minting} style={{
                background: C.ink, color: "#fff", border: "none", borderRadius: 10,
                padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                fontFamily: DISPLAY, whiteSpace: "nowrap", opacity: minting ? 0.6 : 1,
              }}>{minting ? "יוצרת..." : "צרי קישור"}</button>
            </div>
            <div style={{ fontSize: 11, color: C.mute, marginTop: 6, lineHeight: 1.6 }}>
              קישור לשימוש חד־פעמי, תקף שבוע. שלחי בוואטסאפ — היא תיצור סיסמה ותצטרף לצוות אוטומטית.
            </div>
            {failed && (
              <div style={{
                marginTop: 8, background: "#F7E3E0", color: "#C0574F", borderRadius: 10,
                padding: "8px 10px", fontSize: 11.5, lineHeight: 1.6,
              }}>
                לא הצלחנו ליצור קישור. הסיבה מופיעה בהודעה שלמעלה.
              </div>
            )}

            {links.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {links.map((l) => (
                  <div key={l.token} style={{
                    background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10,
                    padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                        {l.label || "קישור הזמנה"}
                      </div>
                      <div style={{ fontSize: 10.5, color: C.mute }}>{daysLeft(l.expires_at)} · לא נוצל</div>
                    </div>
                    <button onClick={() => copy(l.token)} style={{
                      background: copied === l.token ? C.sageSoft : "#fff",
                      border: `1px solid ${copied === l.token ? C.sage : C.line}`,
                      color: copied === l.token ? C.sage : C.ink,
                      borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap", fontFamily: BODY,
                    }}>{copied === l.token ? "✓ הועתק" : "העתקי"}</button>
                    <button onClick={() => onRevokeLink(l.token)} title="ביטול הקישור" style={{
                      background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 13,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {isOwner && (
              <>
                <div style={dividerRow}>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                  <span>או פתחי לה חשבון עכשיו</span>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })}
                    placeholder="שם (לא חובה)" style={inputStyle} />
                  <input type="email" value={nu.email} autoComplete="off"
                    onChange={(e) => setNu({ ...nu, email: e.target.value })}
                    placeholder="אימייל" style={{ ...inputStyle, direction: "ltr", textAlign: "right" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" value={nu.password} autoComplete="off"
                      onChange={(e) => setNu({ ...nu, password: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") createUser(); }}
                      placeholder="סיסמה זמנית (6 תווים לפחות)"
                      style={{ ...inputStyle, direction: "ltr", textAlign: "right" }} />
                    <button onClick={createUser} disabled={nuState === "saving"} style={{
                      background: C.ink, color: "#fff", border: "none", borderRadius: 10,
                      padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      fontFamily: DISPLAY, whiteSpace: "nowrap", opacity: nuState === "saving" ? 0.6 : 1,
                    }}>{nuState === "saving" ? "פותחת..." : "פתחי חשבון"}</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.mute, marginTop: 6, lineHeight: 1.6 }}>
                  היא נכנסת מיד עם האימייל והסיסמה האלה, בלי שום מייל. מסרי לה אותם, והיא תחליף סיסמה
                  בעצמה מהאזור האישי.
                </div>
                {nuState === "done" && (
                  <div style={{
                    marginTop: 8, background: C.sageSoft, color: C.sage, borderRadius: 10,
                    padding: "8px 10px", fontSize: 11.5, fontWeight: 700,
                  }}>✓ החשבון נפתח והיא כבר בצוות</div>
                )}
                {nuError && (
                  <div style={{
                    marginTop: 8, background: "#F7E3E0", color: "#C0574F", borderRadius: 10,
                    padding: "8px 10px", fontSize: 11.5, lineHeight: 1.6,
                  }}>{nuError}</div>
                )}
              </>
            )}

            <div style={dividerRow}>
              <span style={{ flex: 1, height: 1, background: C.line }} />
              <span>או הזמנה לפי כתובת מייל</span>
              <span style={{ flex: 1, height: 1, background: C.line }} />
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="אימייל להזמנה..."
                style={{ ...inputStyle, direction: "ltr", textAlign: "right" }}
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
          </div>
        )}
      </div>
    </div>
  );
}

const dividerRow = {
  display: "flex", alignItems: "center", gap: 8,
  margin: "14px 0 10px", color: C.mute, fontSize: 11,
};
const inputStyle = {
  flex: 1, minWidth: 0, borderRadius: 10, border: `1px solid ${C.line}`,
  padding: "8px 10px", fontSize: 13, fontFamily: BODY,
  direction: "rtl", boxSizing: "border-box", background: C.cream, color: C.ink,
};
