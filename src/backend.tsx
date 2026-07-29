import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

// The calendar keys days as `${year}-${monthIndex}-${day}` (month 0-based).
// Postgres wants a real date. Convert at the edge and nowhere else.
export const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
export const dateToKey = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${y}-${m - 1}-${d}`;
};

function whenLabel(iso) {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0 && then.getDate() === now.getDate()) return "היום";
  if (days <= 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  return `${then.getDate()}.${then.getMonth() + 1}`;
}

const rowToTask = (row, updates) => ({
  id: row.id,
  text: row.text,
  done: row.done,
  ticket: row.ticket,
  status: row.status,
  ownerId: row.owner_id,
  dateKey: row.day ? dateToKey(row.day) : null,
  energy: row.energy,
  notes: row.notes || "",
  completedAt: row.completed_at || null,
  blocked: row.blocked,
  blockedNote: row.blocked_note || "",
  updates: updates || [],
});

// camelCase patch from the UI -> column names
const PATCH_COLUMNS = {
  text: "text", done: "done", ticket: "ticket", status: "status",
  energy: "energy", notes: "notes", blocked: "blocked", blockedNote: "blocked_note",
  ownerId: "owner_id",
};
function patchToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "dateKey") row.day = v ? keyToDate(v) : null;
    else if (PATCH_COLUMNS[k]) row[PATCH_COLUMNS[k]] = v;
  }
  return row;
}

/**
 * Everything the calendar needs, backed by Postgres.
 *
 * Writes apply locally first and then go out, because dragging a card across a
 * board should not wait for a round trip. A failed write reloads from the
 * server rather than leaving the screen quietly lying.
 */
export function useBackend(session) {
  const userId = session?.user?.id || null;
  const [state, setState] = useState({
    loading: true,
    error: null,
    teamId: null,
    members: [],
    invites: [],
    inviteLinks: [],
    days: {},      // my own: { [dateKey]: { type, note } }
    teamDays: {},  // everyone's energy: { [userId]: { [dateKey]: type } }
    tasks: [],
  });
  const reloadTimer = useRef(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      const { data: membership, error: mErr } = await supabase
        .from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
      if (mErr) throw mErr;
      if (!membership) {
        setState((s) => ({ ...s, loading: false, error: "no-team" }));
        return;
      }
      const teamId = membership.team_id;

      const [members, marks, notes, tasks, updates, invites, links] = await Promise.all([
        supabase.from("team_members").select("user_id, role, profiles(id, name, initials)").eq("team_id", teamId),
        supabase.from("day_marks").select("user_id, day, type"),
        supabase.from("day_notes").select("day, note").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("team_id", teamId),
        supabase.from("task_updates").select("*").order("created_at", { ascending: true }),
        supabase.from("invites").select("email, created_at").eq("team_id", teamId),
        supabase.from("invite_links")
          .select("token, label, expires_at, used_at")
          .eq("team_id", teamId).is("used_at", null)
          .order("created_at", { ascending: false }),
      ]);
      // invite_links arrives with a later migration; a missing table must not
      // take the whole board down with it
      for (const r of [members, marks, notes, tasks, updates, invites]) if (r.error) throw r.error;

      const teamDays = {};
      const days = {};
      for (const row of marks.data) {
        const k = dateToKey(row.day);
        (teamDays[row.user_id] = teamDays[row.user_id] || {})[k] = row.type;
        if (row.user_id === userId) days[k] = { type: row.type, note: "" };
      }
      for (const row of notes.data) {
        const k = dateToKey(row.day);
        days[k] = { type: days[k]?.type || "open", note: row.note || "" };
      }

      const byTask = {};
      for (const u of updates.data) {
        (byTask[u.task_id] = byTask[u.task_id] || []).push({
          id: u.id, who: u.author_id, text: u.text, when: whenLabel(u.created_at),
        });
      }

      setState({
        loading: false,
        error: null,
        teamId,
        members: members.data
          .filter((r) => r.profiles)
          .map((r) => ({ id: r.profiles.id, name: r.profiles.name, initials: r.profiles.initials, role: r.role })),
        invites: invites.data.map((r) => r.email),
        inviteLinks: (links.error ? [] : links.data).filter((r) => new Date(r.expires_at) > new Date()),
        days,
        teamDays,
        tasks: tasks.data.map((row) => rowToTask(row, byTask[row.id])),
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message || String(err) }));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Someone else moved a card. Coalesce bursts into one reload.
  useEffect(() => {
    if (!supabase || !userId) return;
    const scheduleReload = () => {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 250);
    };
    const channel = supabase
      .channel("rhythm")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_updates" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_marks" }, scheduleReload)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const fail = useCallback((err) => {
    if (!err) return;
    setState((s) => ({ ...s, error: err.message || String(err) }));
    load();
  }, [load]);

  const actions = useMemo(() => ({
    async patchTask(id, patch) {
      const current = state.tasks.find((t) => t.id === id);
      if (!current) return;
      // done and status are two views of one thing; derive once, send both
      const next = { ...current, ...patch };
      if (patch.status && patch.done === undefined) next.done = patch.status === "done";
      if (patch.done !== undefined && !patch.status) {
        next.status = patch.done ? "done" : next.dateKey ? "planned" : "backlog";
      }
      // the trigger stamps this server-side; mirror it so the archive sorts
      // correctly before the write comes back
      if (next.done !== current.done) next.completedAt = next.done ? new Date().toISOString() : null;
      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? next : t)) }));
      const row = { ...patchToRow(patch), done: next.done, status: next.status };
      const { error } = await supabase.from("tasks").update(row).eq("id", id);
      fail(error);
    },

    async createTask(fields) {
      const { data, error } = await supabase.from("tasks").insert({
        team_id: state.teamId,
        created_by: userId,
        owner_id: fields.ownerId ?? null,
        text: fields.text,
        done: !!fields.done,
        ticket: !!fields.ticket,
        status: fields.status || "backlog",
        day: fields.dateKey ? keyToDate(fields.dateKey) : null,
        energy: fields.energy || "open",
        notes: fields.notes || "",
      }).select().single();
      if (error) return fail(error);
      setState((s) => ({ ...s, tasks: [...s.tasks, rowToTask(data, [])] }));
      return data.id;
    },

    async removeTask(id) {
      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      fail(error);
    },

    async addUpdate(taskId, text) {
      const { data, error } = await supabase.from("task_updates")
        .insert({ task_id: taskId, author_id: userId, text }).select().single();
      if (error) return fail(error);
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => t.id !== taskId ? t : {
          ...t,
          updates: [...t.updates, { id: data.id, who: userId, text, when: "עכשיו" }],
        }),
      }));
    },

    async setDayType(dateKey, type) {
      setState((s) => ({
        ...s,
        days: { ...s.days, [dateKey]: { type, note: s.days[dateKey]?.note || "" } },
        teamDays: { ...s.teamDays, [userId]: { ...(s.teamDays[userId] || {}), [dateKey]: type } },
      }));
      const { error } = await supabase.from("day_marks")
        .upsert({ user_id: userId, day: keyToDate(dateKey), type }, { onConflict: "user_id,day" });
      fail(error);
    },

    // Filling a month's rest days is one intent, so it is one write.
    async setManyDayTypes(dateKeys, type) {
      if (!dateKeys.length) return;
      setState((s) => {
        const days = { ...s.days };
        const mine = { ...(s.teamDays[userId] || {}) };
        for (const k of dateKeys) {
          days[k] = { type, note: days[k]?.note || "" };
          mine[k] = type;
        }
        return { ...s, days, teamDays: { ...s.teamDays, [userId]: mine } };
      });
      const { error } = await supabase.from("day_marks").upsert(
        dateKeys.map((k) => ({ user_id: userId, day: keyToDate(k), type })),
        { onConflict: "user_id,day" }
      );
      fail(error);
    },

    async setDayNote(dateKey, note) {
      setState((s) => ({
        ...s,
        days: { ...s.days, [dateKey]: { type: s.days[dateKey]?.type || "open", note } },
      }));
      const { error } = await supabase.from("day_notes")
        .upsert({ user_id: userId, day: keyToDate(dateKey), note }, { onConflict: "user_id,day" });
      fail(error);
    },

    // Sign-up derives a name from the email local part, which is nobody's
    // actual name. Initials follow the name rather than being set separately —
    // they only exist to fill an avatar.
    async setMyName(name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const initials = [...trimmed][0] + ([...trimmed][1] || "");
      setState((s) => ({
        ...s,
        members: s.members.map((m) => (m.id === userId ? { ...m, name: trimmed, initials } : m)),
      }));
      const { error } = await supabase.from("profiles")
        .update({ name: trimmed, initials }).eq("id", userId);
      fail(error);
    },

    // A link anyone can be sent, good for one person, then spent.
    async createInviteLink(label) {
      const { data, error } = await supabase.rpc("create_invite_link", {
        p_label: (label || "").trim(), p_days: 7,
      });
      if (error) { fail(error); return null; }
      await load();
      return data;
    },

    async revokeInviteLink(token) {
      setState((s) => ({ ...s, inviteLinks: s.inviteLinks.filter((l) => l.token !== token) }));
      const { error } = await supabase.from("invite_links").delete().eq("token", token);
      fail(error);
    },

    // An address left here becomes a membership the moment that person signs in.
    async invite(email) {
      const address = email.trim().toLowerCase();
      if (!address) return;
      const { error } = await supabase.from("invites")
        .insert({ email: address, team_id: state.teamId, invited_by: userId });
      if (error) return fail(error);
      setState((s) => ({ ...s, invites: [...s.invites, address] }));
    },

    async revokeInvite(email) {
      setState((s) => ({ ...s, invites: s.invites.filter((e) => e !== email) }));
      const { error } = await supabase.from("invites").delete().eq("email", email);
      fail(error);
    },

    // swapping two days takes their tasks with them
    async swapDays(fromKey, toKey) {
      const a = state.days[fromKey] || { type: "open", note: "" };
      const b = state.days[toKey] || { type: "open", note: "" };
      const moved = state.tasks.filter((t) => t.ownerId === userId && (t.dateKey === fromKey || t.dateKey === toKey));
      setState((s) => ({
        ...s,
        days: { ...s.days, [fromKey]: b, [toKey]: a },
        tasks: s.tasks.map((t) => {
          if (t.ownerId !== userId) return t;
          if (t.dateKey === fromKey) return { ...t, dateKey: toKey };
          if (t.dateKey === toKey) return { ...t, dateKey: fromKey };
          return t;
        }),
      }));
      const results = await Promise.all([
        supabase.from("day_marks").upsert([
          { user_id: userId, day: keyToDate(fromKey), type: b.type },
          { user_id: userId, day: keyToDate(toKey), type: a.type },
        ], { onConflict: "user_id,day" }),
        supabase.from("day_notes").upsert([
          { user_id: userId, day: keyToDate(fromKey), note: b.note || "" },
          { user_id: userId, day: keyToDate(toKey), note: a.note || "" },
        ], { onConflict: "user_id,day" }),
        ...moved.map((t) => supabase.from("tasks")
          .update({ day: keyToDate(t.dateKey === fromKey ? toKey : fromKey) }).eq("id", t.id)),
      ]);
      fail(results.find((r) => r.error)?.error);
    },
  }), [state.teamId, state.days, state.tasks, userId, fail]);

  return { ...state, me: userId, actions, reload: load };
}
