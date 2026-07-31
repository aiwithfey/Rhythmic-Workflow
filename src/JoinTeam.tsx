import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const C = {
  cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B",
  line: "#E2D7C6", magenta: "#B23A7E", mute: "#BDB2AE",
  sage: "#5E8B5A", sageSoft: "#E2EBDE", alert: "#C0574F", alertSoft: "#F7E3E0",
};
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

/**
 * What a signed-in stranger sees. It used to say "ask someone on the team" and
 * offer nothing to press, which left the person stuck and the owner with no
 * sign that anyone was waiting. Now the asking happens here.
 *
 * This fetches for itself rather than going through useBackend, because that
 * hook stops at the membership lookup — being teamless is the one state it
 * refuses to load anything for, and it is exactly the state of this screen.
 */
export default function JoinTeam({ email, onSignOut }) {
  const [teams, setTeams] = useState([]);
  const [chosen, setChosen] = useState("");
  const [note, setNote] = useState("");
  const [mine, setMine] = useState(null);   // an existing request, if any
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [list, own] = await Promise.all([
      supabase.rpc("joinable_teams"),
      supabase.rpc("my_join_request"),
    ]);
    // Before the migration lands these do not exist yet; say so plainly rather
    // than showing an empty screen with no explanation.
    if (list.error) {
      setError(
        /not find|does not exist|PGRST202/i.test(list.error.message || "")
          ? "המערכת עוד לא עודכנה במסד הנתונים — צריך להריץ את המיגרציה האחרונה."
          : list.error.message
      );
      setLoading(false);
      return;
    }
    const rows = list.data || [];
    setTeams(rows);
    setChosen((c) => c || rows[0]?.id || "");
    const active = (own.data || []).find((r) => r.status === "pending") || null;
    setMine(active);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function send() {
    if (!chosen) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("request_to_join", {
      p_team: chosen, p_note: note.trim(),
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    refresh();
  }

  const team = teams.find((t) => t.id === chosen) || teams[0] || null;

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700 }}>לוח הקצב שלנו</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 6, marginBottom: 18 }}>
          נכנסת בתור <b style={{ direction: "ltr", display: "inline-block" }}>{email}</b>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>רגע…</div>
        ) : mine ? (
          <>
            <div style={{
              background: C.sageSoft, border: `1px solid ${C.sage}`, borderRadius: 12,
              padding: "12px 14px", fontSize: 13, lineHeight: 1.7, textAlign: "right",
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>הבקשה נשלחה ✓</div>
              ביקשת להצטרף ל<b>{mine.team_name}</b>. ברגע שהבקשה תאושר הלוח ייפתח כאן.
            </div>
            <button onClick={refresh} style={{ ...ghost, marginTop: 14 }}>
              בדיקה אם אושרה
            </button>
          </>
        ) : teams.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>
            אין כרגע צוות פתוח לבקשות. פנייה למי שמנהלת את המערכת.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7, marginBottom: 14 }}>
              עוד לא צורפת לצוות. אפשר לבקש להצטרף, והבקשה תופיע אצל המנהלת לאישור.
            </div>

            {teams.length === 1 ? (
              <div style={{
                background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12,
                padding: "11px 13px", fontSize: 14, fontWeight: 700, marginBottom: 10,
              }}>{team?.name}</div>
            ) : (
              <select
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                style={{ ...field, marginBottom: 10, fontWeight: 700 }}
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="מי את, בשורה אחת — כדי שיידעו שזו את (לא חובה)"
              style={{ ...field, minHeight: 68, resize: "vertical", marginBottom: 10 }}
            />

            <button onClick={send} disabled={busy || !chosen} style={{
              ...primary, opacity: busy || !chosen ? 0.6 : 1,
            }}>{busy ? "שולחת…" : "בקשה להצטרף לצוות"}</button>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 12, background: C.alertSoft, color: C.alert, borderRadius: 12,
            padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, textAlign: "right",
          }}>{error}</div>
        )}

        <button onClick={onSignOut} style={{ ...ghost, marginTop: 16 }}>יציאה</button>
      </div>
    </div>
  );
}

const page = {
  direction: "rtl", fontFamily: BODY, color: C.ink, minHeight: "100vh",
  background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep})`,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const card = {
  background: "#fff", borderRadius: 20, padding: 26, width: "100%", maxWidth: 380,
  boxShadow: "0 10px 34px rgba(46,34,48,0.12)", textAlign: "center",
};
const field = {
  width: "100%", borderRadius: 12, border: `1px solid ${C.line}`,
  padding: "11px 13px", fontSize: 13.5, fontFamily: BODY,
  direction: "rtl", boxSizing: "border-box", background: C.cream, color: C.ink,
};
const primary = {
  width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 12,
  padding: "12px 0", fontSize: 14, fontWeight: 700, fontFamily: DISPLAY, cursor: "pointer",
};
const ghost = {
  background: "none", border: "none", color: C.inkSoft,
  fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: BODY,
};
