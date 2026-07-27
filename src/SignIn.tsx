import React, { useState } from "react";
import { supabase } from "./supabase";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", magentaSoft: "#F1D6E5", lilacSoft: "#EBDDEA",
  alert: "#C0574F", alertSoft: "#F7E3E0", sage: "#5E8B5A", sageSoft: "#E2EBDE",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

// Google appears only once it is configured in the Supabase dashboard; until
// then the button would just fail, so it stays off rather than lying.
const GOOGLE_ENABLED = false;

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  async function sendLink(e) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setStatus("error"); setMessage(error.message); }
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
          גל של תפוקה, חיבור ומנוחה — לא רשימת חובות
        </div>

        {status === "sent" ? (
          <div style={{
            background: C.sageSoft, border: `1px solid ${C.sage}`, borderRadius: 14,
            padding: "16px 14px", fontSize: 13.5, lineHeight: 1.6,
          }}>
            שלחנו קישור כניסה ל־<b>{email}</b>.<br />
            פתחי אותו מהמכשיר הזה ותיכנסי ישר פנימה.
            <button
              onClick={() => { setStatus("idle"); setMessage(""); }}
              style={{
                display: "block", margin: "12px auto 0", background: "none", border: "none",
                color: C.inkSoft, fontSize: 12, cursor: "pointer", textDecoration: "underline",
              }}
            >כתובת אחרת</button>
          </div>
        ) : (
          <form onSubmit={sendLink} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="האימייל שלך"
              autoComplete="email"
              style={{
                width: "100%", borderRadius: 12, border: `1px solid ${C.line}`,
                padding: "11px 13px", fontSize: 14, fontFamily: BODY,
                direction: "rtl", boxSizing: "border-box", background: C.cream, color: C.ink,
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                background: C.ink, color: "#fff", border: "none", borderRadius: 12,
                padding: "11px 0", fontSize: 14, fontWeight: 700, fontFamily: DISPLAY,
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.6 : 1,
              }}
            >{status === "sending" ? "שולחת..." : "שלחי לי קישור כניסה"}</button>

            {GOOGLE_ENABLED && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.inkSoft, fontSize: 11.5 }}>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                  <span>או</span>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                </div>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  style={{
                    background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: "11px 0", fontSize: 14, fontWeight: 700, fontFamily: DISPLAY, cursor: "pointer",
                  }}
                >המשיכי עם Google</button>
              </>
            )}
          </form>
        )}

        {status === "error" && (
          <div style={{
            marginTop: 12, background: C.alertSoft, color: C.alert, borderRadius: 12,
            padding: "10px 12px", fontSize: 12.5,
          }}>{message}</div>
        )}

        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 18, lineHeight: 1.6 }}>
          הכניסה בהזמנה בלבד. אם הכתובת שלך לא הוזמנה לצוות, תיכנסי אבל הלוח יהיה ריק.
        </div>
      </div>
    </div>
  );
}
