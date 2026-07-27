import { createClient } from "@supabase/supabase-js";

// Injected at build time (see scripts/build.mjs). Absent means mock mode: the
// app runs on seed data with no network, which is how the design mockup and
// the published artifact keep working.
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

const url = typeof __SUPABASE_URL__ === "string" ? __SUPABASE_URL__ : "";
const key = typeof __SUPABASE_KEY__ === "string" ? __SUPABASE_KEY__ : "";

export const isLive = Boolean(url && key);

export const supabase = isLive
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const TEAM_SLUG = "ai-goddesses";
