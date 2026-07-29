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

// An invite link lands as ?invite=<token>. Stash it and clean the URL before
// anything else runs, so a refresh or a shared screenshot does not carry the
// token around, and so it survives the sign-in round trip.
const PENDING_INVITE = "rhythm.pendingInvite";
if (typeof window !== "undefined") {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("invite");
  if (token) {
    try { localStorage.setItem(PENDING_INVITE, token); } catch {}
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.toString());
  }
}

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
  const [linkState, setLinkState] = useState("idle"); // idle | redeeming | invalid

  // Redeem only for someone who is not on a team yet. A member who opens the
  // link — Fey testing her own, say — would otherwise spend it on themselves
  // and hand the newcomer a dead link.
  useEffect(() => {
    if (backend.loading || linkState === "redeeming") return;
    let token = null;
    try { token = localStorage.getItem(PENDING_INVITE); } catch {}
    if (!token) return;

    if (backend.error !== "no-team") {
      try { localStorage.removeItem(PENDING_INVITE); } catch {}
      return;
    }

    setLinkState("redeeming");
    supabase.rpc("redeem_invite_link", { p_token: token }).then(({ data, error }) => {
      try { localStorage.removeItem(PENDING_INVITE); } catch {}
      if (!error && data === "joined") { setLinkState("idle"); backend.reload(); }
      else setLinkState("invalid");
    });
  }, [backend.loading, backend.error]);

  if (backend.loading || linkState === "redeeming") {
    return <Centered>{linkState === "redeeming" ? "מצרפת אותך לצוות…" : "טוענת את הקצב שלך…"}</Centered>;
  }

  if (backend.error === "no-team") {
    return (
      <Centered>
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          את מחוברת, אבל עוד לא בצוות
        </div>
        <div style={{ color: C.inkSoft }}>
          הכניסה בהזמנה. בקשי ממישהי בצוות להוסיף את <b>{session.user.email}</b>, ואז היכנסי שוב.
        </div>
        {linkState === "invalid" && (
          <div style={{
            marginTop: 12, background: "#F7E3E0", color: "#C0574F", borderRadius: 12,
            padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6,
          }}>
            קישור ההזמנה כבר נוצל או שפג תוקפו. בקשי קישור חדש.
          </div>
        )}
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
        onSetPassword={async (password) => {
          const { error } = await supabase.auth.updateUser({ password });
          return error ? error.message : null;
        }}
        onSignOut={() => supabase.auth.signOut()}
      />
      <InviteBar
        invites={backend.invites}
        links={backend.inviteLinks}
        onInvite={backend.actions.invite}
        onRevoke={backend.actions.revokeInvite}
        onCreateLink={backend.actions.createInviteLink}
        onRevokeLink={backend.actions.revokeInviteLink}
        isOwner={backend.isOwner}
        onCreateUser={backend.actions.adminCreateUser}
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
