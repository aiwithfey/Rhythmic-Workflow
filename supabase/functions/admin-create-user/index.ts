// Creating an account with a password requires the service-role key, which
// bypasses row level security entirely. It therefore cannot live in the browser
// bundle — that bundle is public. This function is the only thing that holds
// it, and it checks the caller before using it.
//
// Deploy:  supabase functions deploy admin-create-user
// The service-role key is provided to the function automatically; there is no
// secret to set by hand.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Who is asking? The JWT is the only thing we trust here — the client saying
  // "I am an owner" means nothing.
  const { data: caller, error: whoErr } = await admin.auth.getUser(jwt);
  if (whoErr || !caller.user) return json({ error: "unauthenticated" }, 401);

  const { data: membership } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", caller.user.id)
    .maybeSingle();

  if (!membership) return json({ error: "not_on_a_team" }, 403);
  if (membership.role !== "owner") return json({ error: "not_an_owner" }, 403);

  let body: { email?: string; password?: string; name?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = (body.name || "").trim();

  if (!email.includes("@")) return json({ error: "bad_email" }, 400);
  if (password.length < 6) return json({ error: "weak_password" }, 400);

  // email_confirm marks the address verified without sending anything, which is
  // the point: this path exists so onboarding costs no email at all.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { full_name: name } : {},
  });

  if (createErr) {
    const already = /already|exists|registered/i.test(createErr.message);
    return json({ error: already ? "email_taken" : createErr.message }, 400);
  }

  // The on-signup trigger has already made their profile; put them on the
  // caller's team. Their own invite, if any, is now redundant.
  const { error: joinErr } = await admin
    .from("team_members")
    .insert({ team_id: membership.team_id, user_id: created.user!.id, role: "member" });

  if (joinErr) return json({ error: joinErr.message }, 400);

  await admin.from("invites").delete().eq("email", email);

  return json({ ok: true, id: created.user!.id });
});
