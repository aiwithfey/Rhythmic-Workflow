// Stands in for @supabase/supabase-js when the build has no credentials, so
// the design mockup does not ship a client it will never construct.
export function createClient() {
  throw new Error("supabase client unavailable in mock build");
}
