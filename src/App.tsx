import React, { useEffect, useState } from "react";
import RhythmCalendar from "./RhythmCalendar";
import SignIn from "./SignIn";
import AccountBar from "./AccountBar";
import InviteBar from "./InviteBar";
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

  if (backend.loading) return <Centered>טוענת את הקצב שלך…</Centered>;

  if (backend.error === "no-team") {
    return (
      <Centered>
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          את מחוברת, אבל עוד לא בצוות
        </div>
        <div style={{ color: C.inkSoft }}>
          הכניסה בהזמנה. בקשי ממישהי בצוות להוסיף את <b>{session.user.email}</b>, ואז היכנסי שוב.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={signOutBtn}>יציאה</button>
      </Centered>
    );
  }

  const profile = backend.members.find((m) => m.id === backend.me) || null;

  return (
    <>
      <RhythmCalendar backend={backend} />
      <AccountBar
        profile={profile}
        email={session.user.email}
        onRename={backend.actions.setMyName}
        onSignOut={() => supabase.auth.signOut()}
      />
      <InviteBar
        invites={backend.invites}
        onInvite={backend.actions.invite}
        onRevoke={backend.actions.revokeInvite}
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
