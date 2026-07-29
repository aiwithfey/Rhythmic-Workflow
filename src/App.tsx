import React, { useEffect, useState } from "react";
import RhythmCalendar from "./RhythmCalendar";
import SignIn from "./SignIn";
import AccountBar from "./AccountBar";
import { supabase, isLive } from "./supabase";
import { useBackend } from "./backend";

const C = { cream: "#F6F1E9", creamDeep: "#EFE7D8", ink: "#2E2230", inkSoft: "#6E5C6B", line: "#E2D7C6" };
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

function Centered({ children }) {
  return (
    <div style={{
      direction: "rtl", fontFamily: BODY, color: C.ink, minHeight: "100vh",
      background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep})`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      textAlign: "center", fontSize: 14, lineHeight: 1.7,
    }}>
      <div style={{ maxWidth: 340 }}>{children}</div>
    </div>
  );
}

function LiveApp({ session }) {
  const backend = useBackend(session);

  if (backend.loading) {
    return <Centered>טוענת את הקצב שלך…</Centered>;
  }

  if (backend.error === "no-team") {
    return (
      <Centered>
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          את מחוברת, אבל עוד לא בצוות
        </div>
        <div style={{ color: C.inkSoft }}>
          פנייה למישהי בצוות כדי להצטרף.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={signOutBtn}>יציאה</button>
      </Centered>
    );
  }

  const profile = backend.members.find((m) => m.id === backend.me) || null;

  return (
    <>
      {/* Anything the database refuses has to reach the screen. Without this a
          failed write looks exactly like a button that does nothing. */}
      {backend.error && backend.error !== "no-team" && (
        <div style={{
          direction: "rtl", fontFamily: BODY, background: "#F7E3E0", color: "#C0574F",
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          justifyContent: "center", fontSize: 12.5, lineHeight: 1.5,
        }}>
          <span style={{ maxWidth: 620 }}>{backend.error}</span>
          <button onClick={backend.clearError} style={{
            background: "none", border: "none", color: "#C0574F",
            fontSize: 14, cursor: "pointer", flexShrink: 0,
          }}>✕</button>
        </div>
      )}
      <RhythmCalendar backend={backend} />
      <AccountBar
        profile={profile}
        email={session.user.email}
        onRename={backend.actions.setMyName}
        onSetPassword={async (password) => {
          const { error } = await supabase.auth.updateUser({ password });
          return error ? error.message : null;
        }}
        onSignOut={() => supabase.auth.signOut()}
      />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(isLive);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // No credentials in the build: the mockup runs on seed data, no network.
  if (!isLive) return <RhythmCalendar />;
  if (checking) return <Centered>רגע…</Centered>;
  if (!session) return <SignIn />;
  return <LiveApp session={session} />;
}

const signOutBtn = {
  display: "block", margin: "14px auto 0", background: "none", border: "none",
  color: C.inkSoft, fontSize: 12, cursor: "pointer", textDecoration: "underline",
  fontFamily: BODY,
};
