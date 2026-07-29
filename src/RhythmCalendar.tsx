import React, { useState, useMemo, useEffect } from "react";

// ---- Brand palette (AI Goddesses) ----
const C = {
  cream: "#F6F1E9",
  creamDeep: "#EFE7D8",
  ink: "#2E2230",
  inkSoft: "#6E5C6B",
  line: "#E2D7C6",
  gold: "#D89A2E",
  goldSoft: "#F4E2BE",
  magenta: "#B23A7E",
  magentaSoft: "#F1D6E5",
  lilac: "#B98FB4",
  lilacSoft: "#EBDDEA",
  open: "#ECE4D6",
  sage: "#5E8B5A",
  sageSoft: "#E2EBDE",
  alert: "#C0574F",
  alertSoft: "#F7E3E0",
  mute: "#BDB2AE",
};

// ---- Block types ----
const BLOCKS = {
  open: { key: "open", label: "גמיש", icon: "", fill: C.open, text: C.inkSoft, chip: C.open },
  surge: { key: "surge", label: "אנרגיה גבוהה", icon: "🔥", fill: C.gold, text: "#fff", chip: C.goldSoft },
  connection: { key: "connection", label: "חיבור", icon: "🤝", fill: C.magenta, text: "#fff", chip: C.magentaSoft },
  rest: { key: "rest", label: "מנוחה מוגנת", icon: "🌙", fill: C.lilac, text: "#fff", chip: C.lilacSoft, locked: true },
};
const ORDER = ["open", "surge", "connection", "rest"];

// ---- Ticket statuses (simple kanban) ----
const STATUS = {
  backlog: { key: "backlog", label: "מאגר", icon: "🌱", accent: C.inkSoft, chip: "#EDE7DB" },
  planned: { key: "planned", label: "מתוכנן", icon: "📌", accent: C.magenta, chip: C.magentaSoft },
  doing: { key: "doing", label: "בעבודה", icon: "🔥", accent: C.gold, chip: C.goldSoft },
  done: { key: "done", label: "הושלם", icon: "✓", accent: C.sage, chip: C.sageSoft },
};
const STATUS_ORDER = ["backlog", "planned", "doing", "done"];

// the energy a ticket *needs*. rest is never a work requirement.
const NEEDS = ["open", "surge", "connection"];
const NEED_LABEL = { open: "גמיש", surge: "עומק", connection: "אנשים" };

// Card surfaces: the chip colors are too loud to sit under text, so these are
// the same hues pulled almost all the way to paper. A card should read as
// off-white first and as its energy second.
// gold has to carry further than the other two: it is the hue closest to the
// cream ground, so a light wash of it reads as "no color" rather than as energy.
const NEED_TINT = {
  open: { fill: "#FAF8F4", edge: "#E9E3D7" },
  surge: { fill: "#FBEAC6", edge: "#E5CB94" },
  connection: { fill: "#FAE4F0", edge: "#E9C4DD" },
};
// gold at full strength is too light to set small text in
const NEED_TEXT = { open: C.inkSoft, surge: "#8A6210", connection: C.magenta };

// how many tickets one person can hold in "בעבודה" before we say something
const WIP_LIMIT = 3;

const DISPLAY = "'Rubik','Assistant','Segoe UI',system-ui,-apple-system,sans-serif";
const BODY = "'Assistant','Segoe UI',system-ui,-apple-system,sans-serif";

const MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const DOW = ["א","ב","ג","ד","ה","ו","ש"];

const keyOf = (y, m, d) => `${y}-${m}-${d}`;
function parseKey(k) {
  if (!k) return null;
  const [y, m, d] = k.split("-").map(Number);
  return { y, m, d };
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y, m) { return new Date(y, m, 1).getDay(); }

// dateKey <-> <input type="date"> value
function keyToISO(k) {
  const p = parseKey(k);
  if (!p) return "";
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
function isoToKey(iso) {
  if (!iso) return null;
  const [yy, mm, dd] = iso.split("-").map(Number);
  return keyOf(yy, mm - 1, dd);
}
function todayKey() {
  const n = new Date();
  return keyOf(n.getFullYear(), n.getMonth(), n.getDate());
}
function sundayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}
function prettyDate(k) {
  const p = parseKey(k);
  if (!p) return "ללא תאריך";
  return `${p.d} ב${MONTHS[p.m]}`;
}

// Seed a personal example rhythm
function seedMonth(y, m) {
  const total = daysInMonth(y, m);
  const seed = {};
  const restDays = [3, 4, 11, 17, 18, 25];
  const surgeDays = [6, 7, 8, 13, 20, 21, 27];
  const connDays = [2, 10, 15, 23, 28];
  for (let d = 1; d <= total; d++) {
    let type = "open";
    if (restDays.includes(d)) type = "rest";
    else if (surgeDays.includes(d)) type = "surge";
    else if (connDays.includes(d)) type = "connection";
    seed[keyOf(y, m, d)] = { type, note: "" };
  }
  return seed;
}

const NOTE_PLACEHOLDERS = {
  open: "יום גמיש, לא מוגדר מראש...",
  surge: "פרויקט ממוקד, יעד ברור...",
  connection: "פגישה, שיחה, קהילה...",
  rest: "מוגן. לא לתזמן כאן.",
};

// task-row styling per energy type — mood should shape how tasks feel, not just what color they are
const TASK_STYLE = {
  open: { rowBg: "#F6F1E9", accent: C.inkSoft, radius: 8, weight: 500, boxRadius: 6, border: `1px dashed ${C.inkSoft}`, italic: false },
  surge: { rowBg: C.goldSoft, accent: C.gold, radius: 6, weight: 800, boxRadius: 4, border: `2px solid ${C.gold}`, italic: false },
  connection: { rowBg: C.magentaSoft, accent: C.magenta, radius: 10, weight: 600, boxRadius: 7, border: `2px solid ${C.magenta}`, italic: false },
  rest: { rowBg: C.lilacSoft, accent: C.lilac, radius: 18, weight: 400, boxRadius: 999, border: `1.5px solid ${C.lilac}`, italic: true },
};

// ---- Mock team ----
const MEMBERS = [
  { id: "m1", name: "פיי", initials: "פי" },
  { id: "m2", name: "קרן", initials: "קר" },
  { id: "m3", name: "אוריאן", initials: "אר" },
  { id: "m4", name: "דנה", initials: "דנ" },
  { id: "m5", name: "יוסף", initials: "יו" },
];
const ME = "m1";
const memberById = (id) => MEMBERS.find((x) => x.id === id) || null;

// pick the dominant energy of a day from a set of member marks
function dominantType(marks) {
  if (!marks.length) return null;
  const counts = {};
  marks.forEach((x) => { counts[x.type] = (counts[x.type] || 0) + 1; });
  const priority = ["rest", "surge", "connection", "open"];
  let best = null, bestCount = -1;
  priority.forEach((t) => {
    const c = counts[t] || 0;
    if (c > bestCount) { bestCount = c; best = t; }
  });
  return best;
}

// deterministic pseudo-random 0..1 from date + member index
function hash(y, m, d, i) {
  const v = Math.sin(y * 31 + (m + 1) * 17 + d * 13 + i * 7.3) * 10000;
  return Math.abs(v - Math.floor(v));
}
function memberTypeFor(y, m, d, idx) {
  const h = hash(y, m, d, idx);
  if (h < 0.28) return "open";
  if (h < 0.55) return "surge";
  if (h < 0.75) return "connection";
  return "rest";
}

// ---- Tasks ----
// One shape for both: a private note inside a day, and a public ticket on the board.
// ticket:false -> only the owner sees it, only inside the day.
// ticket:true  -> a card on the team board, still anchored to the day it was planned for.
let uid = 0;
const nid = () => `t${++uid}`;

function seedTasks(y, m) {
  const total = daysInMonth(y, m);
  const now = new Date();
  const isThisMonth = now.getFullYear() === y && now.getMonth() === m;
  const base = isThisMonth ? now.getDate() : 12;
  const D = (off) => keyOf(y, m, Math.max(1, Math.min(total, base + off)));

  const t = (o) => ({
    id: nid(), text: "", done: false, ticket: true, status: "backlog",
    ownerId: null, dateKey: null, energy: "open", blocked: false, blockedNote: "",
    updates: [], ...o,
  });

  return [
    // mine, shared with the team
    t({ text: "לסגור את מערך הפעילות של יולי", ownerId: ME, status: "doing", energy: "surge", dateKey: D(0),
        updates: [{ id: nid(), who: ME, text: "שני מסלולים מוכנים, נשאר השלישי", when: "היום" }] }),
    t({ text: "לכתוב את מדריך הוואטסאפ לשבוע הבא", ownerId: ME, status: "planned", energy: "open", dateKey: D(2) }),
    t({ text: "לבחור את הנושא של החודש הבא", ownerId: ME, status: "planned", energy: "connection", dateKey: D(4) }),
    t({ text: "לחשוב על מודל תמחור לסדנאות", ownerId: ME, status: "backlog", energy: "surge" }),
    t({ text: "לעדכן את לוח הקצב של הצוות", ownerId: ME, status: "done", done: true, energy: "open", dateKey: D(-3) }),

    // mine, private
    t({ text: "להזמין מתנה ליום ההולדת של אמא", ticket: false, ownerId: ME, dateKey: D(1), status: "planned" }),
    t({ text: "לקרוא את המאמר שקרן שלחה", ticket: false, ownerId: ME, dateKey: D(0), status: "planned" }),

    // the team
    t({ text: "לבנות את מצגת הדיון החודשי", ownerId: "m2", status: "doing", energy: "surge", dateKey: D(1),
        updates: [{ id: nid(), who: "m2", text: "מחכה לתמונות מאוריאן", when: "אתמול" }] }),
    t({ text: "לענות לפניות שיתופי פעולה", ownerId: "m2", status: "planned", energy: "connection", dateKey: D(3),
        blocked: true, blockedNote: "מחכה לאישור תקציב מפיי" }),
    t({ text: "לשלוח את הניוזלטר החודשי", ownerId: "m2", status: "done", done: true, energy: "open", dateKey: D(-4) }),
    t({ text: "לתאם עם המרצה האורחת", ownerId: "m3", status: "planned", energy: "connection", dateKey: D(2) }),
    t({ text: "לצלם שלושה רילסים לקהילה", ownerId: "m3", status: "backlog", energy: "surge" }),
    t({ text: "לסכם את המשוב מהמפגש האחרון", ownerId: "m4", status: "done", done: true, energy: "open", dateKey: D(-2) }),
    t({ text: "לסדר את מאגר הפרומפטים המשותף", ownerId: "m4", status: "doing", energy: "open", dateKey: D(1) }),
    t({ text: "לתקן את טופס ההרשמה באתר", ownerId: "m5", status: "doing", energy: "surge", dateKey: D(0) }),
    t({ text: "לעדכן את דף הנחיתה", ownerId: "m5", status: "backlog", energy: "open" }),

    // unclaimed — anyone can pick these up
    t({ text: "לתרגם את המדריך לאנגלית", ownerId: null, status: "backlog", energy: "open" }),
    t({ text: "לארגן את קבצי המצגות בדרייב", ownerId: null, status: "backlog", energy: "open" }),
  ];
}

// ============================================================
// Small shared pieces
// ============================================================

// Who the team is depends on the backend, so it travels by context rather than
// being read off a module constant.
const MembersContext = React.createContext(MEMBERS);
const useMembers = () => React.useContext(MembersContext);

function Avatar({ id, size = 22 }) {
  const mem = useMembers().find((x) => x.id === id) || null;
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: mem ? C.ink : "transparent",
      border: mem ? "none" : `1.5px dashed ${C.mute}`,
      color: mem ? "#fff" : C.mute,
      fontSize: size * 0.42, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} title={mem ? mem.name : "לא משויך"}>{mem ? mem.initials : "?"}</span>
  );
}

function Chip({ bg, color, children, border, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg, color, border: border || "1px solid transparent",
      padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      whiteSpace: "nowrap", ...style,
    }}>{children}</span>
  );
}

function TicketCard({ t, warn, onOpen, onDragStart, dragging }) {
  const st = STATUS[t.status];
  const need = BLOCKS[t.energy];
  const tint = NEED_TINT[t.energy];
  return (
    <div
      draggable
      onDragStart={() => onDragStart(t.id)}
      onClick={() => onOpen(t.id)}
      style={{
        // fill = the energy the ticket needs, right edge = where it is on the board
        background: t.done ? "#FBFAF8" : tint.fill,
        borderRadius: 12, padding: "9px 10px",
        border: `1px solid ${t.done ? C.line : tint.edge}`,
        borderRight: `3px solid ${st.accent}`,
        boxShadow: "0 1px 4px rgba(46,34,48,0.06)",
        cursor: "grab", opacity: dragging ? 0.4 : t.done ? 0.7 : 1,
        display: "flex", flexDirection: "column", gap: 7,
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 600, lineHeight: 1.4, textAlign: "right",
        color: t.done ? C.mute : C.ink,
        textDecoration: t.done ? "line-through" : "none",
      }}>{t.text}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <Avatar id={t.ownerId} size={20} />
        {!t.ownerId && (
          <Chip bg="#fff" color={C.magenta} border={`1px dashed ${C.magenta}`}>מחפשת מישהי</Chip>
        )}
        {/* the card is already the right color — the chip only names it */}
        <Chip bg="rgba(255,255,255,0.75)" color={NEED_TEXT[t.energy]} border={`1px solid ${tint.edge}`}>
          {need.icon || "○"} {NEED_LABEL[t.energy]}
        </Chip>
        {t.dateKey && (
          <Chip bg="rgba(255,255,255,0.75)" color={C.inkSoft} border={`1px solid ${tint.edge}`}>
            {prettyDate(t.dateKey)}
          </Chip>
        )}
      </div>

      {(t.blocked || warn) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t.blocked && (
            <Chip bg={C.alertSoft} color={C.alert} style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
              ⛔ {t.blockedNote || "תקוע"}
            </Chip>
          )}
          {warn && (
            <Chip
              bg={warn.level === "block" ? C.lilacSoft : C.goldSoft}
              color={warn.level === "block" ? C.ink : "#8A6210"}
              style={{ alignSelf: "flex-start" }}
            >{warn.level === "block" ? "🌙" : "⚠️"} {warn.text}</Chip>
          )}
        </div>
      )}

      {t.updates.length > 0 && (
        <div style={{ fontSize: 11, color: C.inkSoft, borderTop: `1px dashed ${C.line}`, paddingTop: 6, textAlign: "right" }}>
          💬 {t.updates[t.updates.length - 1].text}
        </div>
      )}
    </div>
  );
}

function TicketModal({ task, warn, me, onPatch, onDelete, onClose, onShowInCalendar, onUnpublish, onAddUpdate }) {
  const [draft, setDraft] = useState("");
  const members = useMembers();
  if (!task) return null;
  const owner = members.find((x) => x.id === task.ownerId) || null;
  const tint = NEED_TINT[task.energy];

  function addUpdate() {
    const text = draft.trim();
    if (!text) return;
    onAddUpdate(task.id, text);
    setDraft("");
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={popupStyle}>
        <div style={popupHeaderStyle}>
          <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: C.inkSoft }}>
            כרטיס צוות
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <textarea
          value={task.text}
          onChange={(e) => onPatch(task.id, { text: e.target.value })}
          style={{
            width: "100%", minHeight: 54, borderRadius: 10, border: `1px solid ${tint.edge}`,
            padding: 10, fontSize: 14.5, fontWeight: 600, fontFamily: BODY, resize: "vertical",
            boxSizing: "border-box", direction: "rtl", background: tint.fill, color: C.ink,
          }}
        />

        {warn && (
          <div style={{
            marginTop: 8, padding: "8px 10px", borderRadius: 10, fontSize: 12,
            background: warn.level === "block" ? C.lilacSoft : C.goldSoft,
            color: warn.level === "block" ? C.ink : "#7A5609",
          }}>
            {warn.level === "block" ? "🌙" : "⚠️"} {warn.text}
            {warn.level === "block" && " — אפשר להזיז את הכרטיס ליום אחר, המנוחה נשארת מוגנת."}
          </div>
        )}

        <Section title="סטטוס">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_ORDER.map((s) => {
              const st = STATUS[s];
              const active = task.status === s;
              return (
                <button key={s} onClick={() => onPatch(task.id, { status: s, done: s === "done" })}
                  style={{
                    ...pillBtn,
                    background: active ? st.accent : st.chip,
                    color: active ? "#fff" : C.ink,
                    border: active ? `1px solid ${st.accent}` : `1px solid ${C.line}`,
                  }}>{st.icon} {st.label}</button>
              );
            })}
          </div>
        </Section>

        <Section title="אחראית">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => onPatch(task.id, { ownerId: null })}
              style={{ ...pillBtn, background: !owner ? C.ink : "#F2EDE3", color: !owner ? "#fff" : C.inkSoft, border: `1px solid ${C.line}` }}>
              לא משויך
            </button>
            {members.map((mem) => {
              const active = task.ownerId === mem.id;
              return (
                <button key={mem.id} onClick={() => onPatch(task.id, { ownerId: mem.id })}
                  style={{ ...pillBtn, background: active ? C.magentaSoft : "#F2EDE3", color: active ? C.ink : C.inkSoft,
                    border: active ? `1px solid ${C.magenta}` : `1px solid ${C.line}` }}>
                  {mem.name}{mem.id === me ? " (את)" : ""}
                </button>
              );
            })}
          </div>
          {!owner && (
            <button onClick={() => onPatch(task.id, { ownerId: me })}
              style={{ ...primaryBtn, marginTop: 8, background: C.magenta }}>אני לוקחת את זה</button>
          )}
        </Section>

        <Section title="איזו אנרגיה זה דורש">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {NEEDS.map((k) => {
              const b = BLOCKS[k];
              const active = task.energy === k;
              return (
                <button key={k} onClick={() => onPatch(task.id, { energy: k })}
                  style={{ ...pillBtn, background: active ? b.fill : b.chip,
                    color: active ? (k === "open" ? C.inkSoft : b.text) : C.ink,
                    border: active ? `2px solid ${C.ink}` : `1px solid ${C.line}` }}>
                  {b.icon || "○"} {NEED_LABEL[k]}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="מתי">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={keyToISO(task.dateKey)}
              onChange={(e) => onPatch(task.id, { dateKey: isoToKey(e.target.value) })}
              style={{ borderRadius: 10, border: `1px solid ${C.line}`, padding: "7px 10px",
                fontSize: 13, fontFamily: BODY, background: "#fff", color: C.ink }}
            />
            <button onClick={() => onPatch(task.id, { dateKey: null })}
              style={{ ...pillBtn, background: "#F2EDE3", color: C.inkSoft, border: `1px solid ${C.line}` }}>
              ללא תאריך
            </button>
            {task.dateKey && (
              <button onClick={() => onShowInCalendar(task)}
                style={{ ...pillBtn, background: C.lilacSoft, color: C.ink, border: `1px solid ${C.lilac}` }}>
                הצגי ביומן
              </button>
            )}
          </div>
        </Section>

        <Section title="חסימה">
          <button onClick={() => onPatch(task.id, { blocked: !task.blocked })}
            style={{ ...pillBtn, background: task.blocked ? C.alertSoft : "#F2EDE3",
              color: task.blocked ? C.alert : C.inkSoft,
              border: task.blocked ? `1px solid ${C.alert}` : `1px solid ${C.line}` }}>
            {task.blocked ? "⛔ תקוע" : "לא תקוע"}
          </button>
          {task.blocked && (
            <input
              value={task.blockedNote}
              onChange={(e) => onPatch(task.id, { blockedNote: e.target.value })}
              placeholder="על מה מחכים?"
              style={{ ...textInput, marginTop: 8 }}
            />
          )}
        </Section>

        <Section title="עדכונים לצוות">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {task.updates.length === 0 && (
              <div style={{ fontSize: 12, color: C.mute }}>אין עדיין עדכונים</div>
            )}
            {task.updates.map((u) => (
              <div key={u.id} style={{ display: "flex", gap: 7, alignItems: "flex-start",
                background: C.cream, borderRadius: 10, padding: "7px 9px" }}>
                <Avatar id={u.who} size={20} />
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, color: C.ink }}>{u.text}</div>
                  <div style={{ fontSize: 10.5, color: C.mute, marginTop: 2 }}>{u.when}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addUpdate(); }}
              placeholder="מה קורה עם זה?"
              style={textInput}
            />
            <button onClick={addUpdate} style={primaryBtn}>עדכני</button>
          </div>
        </Section>

        <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {/* only your own ticket can become your private note */}
            {task.ownerId === me && (
              <button onClick={() => onUnpublish(task)}
                style={{ ...pillBtn, background: "#F2EDE3", color: C.inkSoft, border: `1px solid ${C.line}` }}>
                🔒 החזירי לפרטי
              </button>
            )}
            <button onClick={() => { onDelete(task.id); onClose(); }}
              style={{ ...pillBtn, background: "transparent", color: C.alert, border: `1px solid ${C.alertSoft}` }}>
              מחקי
            </button>
          </div>
          {task.ownerId === me && (
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              יורדת מלוח הצוות וחוזרת אלייך ל<b>{prettyDate(task.dateKey || todayKey())}</b> באזור שלי.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// One of my tasks, outside the day it belongs to. A ticket keeps the board's
// language — energy as fill, status as edge — so a scan of the list tells me
// which of my notes the team can see.
//
// Inside a day, every row takes that day's mood, because they all share it.
// A list crosses days, so color here has to mean one thing only: the energy a
// ticket needs. Private notes stay on paper and keep the day's mood in their
// shape — radius, weight, the italics of a rest day — rather than its color.
function NoteRow({ t, dayType, onToggle, onOpenTicket, onPublish, onRemove }) {
  const ts = TASK_STYLE[dayType || "open"];
  const st = STATUS[t.status];
  const tint = NEED_TINT[t.energy];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
      borderRadius: t.ticket ? 12 : ts.radius,
      background: t.ticket ? tint.fill : C.cream,
      border: `1px solid ${t.ticket ? tint.edge : C.line}`,
      borderRight: t.ticket ? `3px solid ${st.accent}` : undefined,
      opacity: t.done ? 0.65 : 1,
    }}>
      <button
        onClick={() => onToggle(t.id)}
        style={{
          width: 19, height: 19, borderRadius: t.ticket ? 6 : ts.boxRadius, flexShrink: 0,
          border: t.ticket ? `1.5px solid ${st.accent}` : ts.border,
          background: t.done ? (t.ticket ? st.accent : ts.accent) : "transparent",
          color: "#fff", fontSize: 12, display: "flex",
          alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
        }}
      >{t.done ? "✓" : ""}</button>

      <span style={{
        flex: 1, fontSize: 13, textAlign: "right",
        fontWeight: t.done ? 400 : t.ticket ? 600 : ts.weight,
        fontStyle: ts.italic && !t.done && !t.ticket ? "italic" : "normal",
        color: t.done ? C.mute : C.ink,
        textDecoration: t.done ? "line-through" : "none",
      }}>{t.text}</span>

      {t.ticket ? (
        <button onClick={() => onOpenTicket(t.id)} title="כרטיס פתוח בלוח הצוות"
          style={{
            display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
            background: "rgba(255,255,255,0.75)", color: st.accent, border: `1px solid ${st.accent}`,
            borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
          }}>🎫 {st.label}</button>
      ) : (
        <button onClick={() => onPublish(t)} title="פתחי כרטיס — המשימה תופיע בלוח הצוות"
          style={{
            display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
            background: "transparent", color: C.inkSoft, border: `1px dashed ${C.mute}`,
            borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
          }}>🔒 פתחי כרטיס</button>
      )}

      <button onClick={() => onRemove(t.id)}
        style={{ background: "none", border: "none", color: C.mute, fontSize: 13, cursor: "pointer" }}>✕</button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkSoft, marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

// ============================================================
// Main
// ============================================================

/**
 * Runs on seed data by default, so the design can be worked on with no network
 * and no account. Pass `backend` (see useBackend) and the same screens run on
 * Postgres instead — every read and write routes through `live` below.
 */
export default function RhythmCalendar({ backend = null }) {
  const live = backend;
  const today = new Date();
  const [mode, setMode] = useState("personal"); // 'personal' | 'team' | 'board'
  const [y, setY] = useState(today.getFullYear());
  const [m, setM] = useState(today.getMonth());
  const [mockDays, setDays] = useState(() => (backend ? {} : seedMonth(today.getFullYear(), today.getMonth())));
  const [mockTasks, setTasks] = useState(() => (backend ? [] : seedTasks(today.getFullYear(), today.getMonth())));

  const days = live ? live.days : mockDays;
  const tasks = live ? live.tasks : mockTasks;
  const members = live ? live.members : MEMBERS;
  const me = live ? live.me : ME;
  const [selected, setSelected] = useState(null);
  const [teamSelected, setTeamSelected] = useState(null);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskShared, setNewTaskShared] = useState(false);
  const [newCardText, setNewCardText] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [dragKey, setDragKey] = useState(null);
  const [dragTicketId, setDragTicketId] = useState(null);
  const [minRest, setMinRest] = useState(6);

  const [energyFilter, setEnergyFilter] = useState(() => new Set(ORDER));
  const [memberFilter, setMemberFilter] = useState(() => new Set(members.map((x) => x.id)));
  const [scope, setScope] = useState("team"); // board: 'mine' | 'team'
  const [q, setQ] = useState("");
  const [personalView, setPersonalView] = useState("calendar"); // 'calendar' | 'list'
  const [listRange, setListRange] = useState("week"); // 'week' | 'month'
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));

  // Escape closes the topmost popup — the ticket sits above the day it came from
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (openTicketId) setOpenTicketId(null);
      else if (selected) setSelected(null);
      else if (teamSelected) setTeamSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTicketId, selected, teamSelected]);

  const memberIds = members.map((x) => x.id).join(",");
  useEffect(() => {
    setMemberFilter(new Set(memberIds ? memberIds.split(",") : []));
  }, [memberIds]);

  const total = daysInMonth(y, m);
  const lead = firstDow(y, m);
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [lead, total]);

  // only this month counts toward the protected minimum
  const restCount = useMemo(
    () => Object.entries(days).filter(([k, v]) => k.startsWith(`${y}-${m}-`) && v && v.type === "rest").length,
    [days, y, m]
  );

  function ensureMonth(ny, nm) {
    if (live) return; // stored days are whatever was actually marked
    setDays((prev) => {
      const hasAny = Object.keys(prev).some((k) => k.startsWith(`${ny}-${nm}-`));
      if (hasAny) return prev;
      return { ...prev, ...seedMonth(ny, nm) };
    });
  }

  function goMonth(delta) {
    let nm = m + delta;
    let ny = y;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    ensureMonth(ny, nm);
    setM(nm);
    setY(ny);
    setSelected(null);
    setTeamSelected(null);
  }

  // A week can straddle two months, so seed both before showing it.
  function goWeek(delta) {
    const next = addDays(weekStart, delta * 7);
    const end = addDays(next, 6);
    ensureMonth(next.getFullYear(), next.getMonth());
    ensureMonth(end.getFullYear(), end.getMonth());
    setWeekStart(next);
    // carry the month along, so switching back to החודש lands where you walked to
    setY(next.getFullYear());
    setM(next.getMonth());
  }

  // open a day from anywhere, even one outside the month on screen
  function openDay(k) {
    const p = parseKey(k);
    if (!p) return;
    ensureMonth(p.y, p.m);
    setY(p.y); setM(p.m);
    setSelected(p.d); // the day opens over whichever view you were in
  }

  function setDayType(d, type) {
    const k = keyOf(y, m, d);
    if (live) return live.actions.setDayType(k, type);
    const cur = days[k] || { type: "open", note: "" };
    setDays((prev) => ({ ...prev, [k]: { ...cur, type } }));
  }

  function setDayNote(d, note) {
    const k = keyOf(y, m, d);
    if (live) return live.actions.setDayNote(k, note);
    const cur = days[k] || { type: "open", note: "" };
    setDays((prev) => ({ ...prev, [k]: { ...cur, note } }));
  }

  // ---- task helpers ----
  function patchTask(id, patch) {
    if (live) return live.actions.patchTask(id, patch);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      if (patch.status && patch.done === undefined) next.done = patch.status === "done";
      if (patch.done !== undefined && !patch.status) next.status = patch.done ? "done" : (next.dateKey ? "planned" : "backlog");
      return next;
    }));
  }
  function removeTask(id) {
    if (live) return live.actions.removeTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addUpdate(taskId, text) {
    if (live) return live.actions.addUpdate(taskId, text);
    setTasks((prev) => prev.map((t) => t.id !== taskId ? t : {
      ...t, updates: [...t.updates, { id: nid(), who: me, text, when: "עכשיו" }],
    }));
  }

  function addDayTask(d, text, shared) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const k = keyOf(y, m, d);
    const dayType = (days[k] || { type: "open" }).type;
    const restDay = dayType === "rest";
    const fields = {
      text: trimmed, done: false,
      ticket: shared,
      // a ticket born on a protected rest day goes to the backlog instead of booking the day
      status: shared ? (restDay ? "backlog" : "planned") : "planned",
      ownerId: me,
      dateKey: shared && restDay ? null : k,
      energy: dayType === "rest" ? "open" : dayType,
    };
    if (live) return live.actions.createTask(fields);
    setTasks((prev) => [...prev, { id: nid(), blocked: false, blockedNote: "", updates: [], ...fields }]);
  }

  function addBoardCard(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const fields = {
      text: trimmed, done: false, ticket: true, status: "backlog",
      ownerId: scope === "mine" ? me : null, dateKey: null, energy: "open",
    };
    setNewCardText("");
    if (live) return live.actions.createTask(fields);
    setTasks((prev) => [...prev, { id: nid(), blocked: false, blockedNote: "", updates: [], ...fields }]);
  }

  // publish a private note as a team ticket
  function publishTask(t) {
    const k = t.dateKey;
    const dayType = k && days[k] ? days[k].type : "open";
    const restDay = dayType === "rest";
    patchTask(t.id, {
      ticket: true,
      status: t.done ? "done" : restDay ? "backlog" : "planned",
      dateKey: restDay ? null : k,
      energy: dayType === "rest" ? "open" : dayType,
    });
    setOpenTicketId(t.id);
  }

  /**
   * Fill the month up to the protected minimum without asking you to pick days.
   *
   * Weekend first, because that is where rest already lives. After that, spread:
   * each further day is the one furthest from every rest day already chosen, so
   * you get gaps between them rather than a block at the end of the month.
   * Days that already carry work are avoided while there is any alternative,
   * and days that have passed are never chosen.
   */
  function autofillRest() {
    const missing = minRest - restCount;
    if (missing <= 0) return;

    const isThisMonth = y === today.getFullYear() && m === today.getMonth();
    const firstOpen = isThisMonth ? today.getDate() : 1;

    const chosen = [];
    const rest = [];
    const free = [];
    for (let d = 1; d <= total; d++) {
      const k = keyOf(y, m, d);
      if ((days[k] || { type: "open" }).type === "rest") { rest.push(d); continue; }
      if (d < firstOpen) continue;
      free.push({ d, k, dow: new Date(y, m, d).getDay(), busy: (dayIndex[k] || []).length > 0 });
    }

    const take = (day) => {
      chosen.push(day);
      rest.push(day.d);
      free.splice(free.indexOf(day), 1);
    };

    // ש׳ then ו׳ — the days a week already leaves free
    for (const dow of [6, 5]) {
      for (const day of free.filter((x) => x.dow === dow && !x.busy)) {
        if (chosen.length >= missing) break;
        take(day);
      }
    }

    // then whatever sits furthest from the rest days so far
    while (chosen.length < missing && free.length) {
      const gapOf = (day) => rest.length
        ? Math.min(...rest.map((r) => Math.abs(r - day.d)))
        : total;
      let best = null, bestScore = -Infinity;
      for (const day of free) {
        // a busy day is a last resort, never a preference
        const score = gapOf(day) - (day.busy ? 100 : 0);
        if (score > bestScore) { bestScore = score; best = day; }
      }
      take(best);
    }

    if (!chosen.length) return;
    const keys = chosen.map((x) => x.k);
    if (live) return live.actions.setManyDayTypes(keys, "rest");
    setDays((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = { type: "rest", note: next[k]?.note || "" };
      return next;
    });
  }

  // Coming off the board, a task has to land on a day — a private task with no
  // date belongs to no view at all. Undated tickets come back to today, and we
  // open that day so it is never a question where the task went.
  function unpublishTask(t) {
    const target = t.dateKey || todayKey();
    const p = parseKey(target);
    patchTask(t.id, { ticket: false, ownerId: me, dateKey: target });
    ensureMonth(p.y, p.m);
    setY(p.y); setM(p.m);
    setOpenTicketId(null);
    setMode("personal");
    setSelected(p.d);
  }

  function handleDrop(targetD) {
    if (dragKey == null || dragKey === targetD) { setDragKey(null); return; }
    const kFrom = keyOf(y, m, dragKey);
    const kTo = keyOf(y, m, targetD);
    if (live) { live.actions.swapDays(kFrom, kTo); setDragKey(null); return; }
    setDays((prev) => {
      const a = prev[kFrom] || { type: "open", note: "" };
      const b = prev[kTo] || { type: "open", note: "" };
      return { ...prev, [kFrom]: b, [kTo]: a };
    });
    // the tasks travel with the day
    setTasks((prev) => prev.map((t) => {
      if (t.ownerId !== me) return t;
      if (t.dateKey === kFrom) return { ...t, dateKey: kTo };
      if (t.dateKey === kTo) return { ...t, dateKey: kFrom };
      return t;
    }));
    setDragKey(null);
  }

  function toggleSet(setter, value) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  // ---- energy lookups ----
  function energyOn(memberId, dateKey) {
    const p = parseKey(dateKey);
    if (!p || !memberId) return null;
    if (memberId === me) {
      const rec = days[dateKey];
      return rec ? rec.type : live ? "open" : null;
    }
    // live: whatever they actually marked, and an unmarked day is flexible.
    // mock: a deterministic stand-in so the team view has something to show.
    if (live) return live.teamDays?.[memberId]?.[dateKey] || "open";
    const idx = MEMBERS.findIndex((x) => x.id === memberId);
    if (idx < 0) return null;
    return memberTypeFor(p.y, p.m, p.d, idx);
  }

  // does this ticket sit on a day that can actually hold it?
  function mismatchOf(t) {
    if (!t.dateKey || !t.ownerId || t.status === "done") return null;
    const e = energyOn(t.ownerId, t.dateKey);
    if (!e) return null;
    if (e === "rest") return { level: "block", text: "מתוזמן ליום מנוחה מוגן" };
    if (t.energy === "surge" && e === "connection") return { level: "warn", text: "משימת עומק ביום חיבור" };
    if (t.energy === "connection" && e === "surge") return { level: "warn", text: "משימת אנשים ביום עומק" };
    return null;
  }

  const selKey = selected ? keyOf(y, m, selected) : null;
  const selData = selKey ? days[selKey] || { type: "open", note: "" } : null;
  const selTasks = useMemo(
    () => (selKey ? tasks.filter((t) => t.ownerId === me && t.dateKey === selKey) : []),
    [tasks, selKey]
  );

  // tasks per day for the personal grid badges
  const dayIndex = useMemo(() => {
    const idx = {};
    tasks.forEach((t) => {
      if (t.ownerId !== me || !t.dateKey || t.done) return;
      (idx[t.dateKey] = idx[t.dateKey] || []).push(t);
    });
    return idx;
  }, [tasks]);

  const weekKeys = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      arr.push(keyOf(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return arr;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const a = parseKey(weekKeys[0]);
    const b = parseKey(weekKeys[6]);
    return a.m === b.m
      ? `${a.d}–${b.d} ב${MONTHS[a.m]}`
      : `${a.d} ב${MONTHS[a.m]} – ${b.d} ב${MONTHS[b.m]}`;
  }, [weekKeys]);

  // everything of mine in the chosen range, grouped by the day it sits on.
  // undated tickets get their own group so nothing of mine is unreachable.
  const myList = useMemo(() => {
    const keys = listRange === "week"
      ? weekKeys
      : Array.from({ length: total }, (_, i) => keyOf(y, m, i + 1));
    const mine = tasks.filter((t) => t.ownerId === me);
    const groups = keys
      .map((k) => ({ k, items: mine.filter((t) => t.dateKey === k) }))
      .filter((g) => g.items.length > 0);
    const undated = mine.filter((t) => !t.dateKey);
    const shown = groups.reduce((n, g) => n + g.items.length, 0) + undated.length;
    const all = [...groups.flatMap((g) => g.items), ...undated];
    return {
      groups, undated, shown,
      tickets: all.filter((t) => t.ticket).length,
      done: all.filter((t) => t.done).length,
    };
  }, [tasks, listRange, weekKeys, y, m, total]);

  // team marks for a given day, filtered. my own row comes from my real calendar.
  function teamMarksFor(d) {
    const k = keyOf(y, m, d);
    return members
      .map((mem) => ({ mem, type: energyOn(mem.id, k) || "open" }))
      .filter((x) => memberFilter.has(x.mem.id) && energyFilter.has(x.type));
  }

  function ticketsOn(memberId, dateKey) {
    return tasks.filter((t) => t.ticket && t.ownerId === memberId && t.dateKey === dateKey);
  }

  // ---- board data ----
  const boardTickets = useMemo(() => {
    const needle = q.trim();
    return tasks.filter((t) => {
      if (!t.ticket) return false;
      if (scope === "mine" && t.ownerId !== me) return false;
      if (scope === "team" && t.ownerId && !memberFilter.has(t.ownerId)) return false;
      if (!energyFilter.has(t.energy)) return false;
      if (needle && !t.text.includes(needle)) return false;
      return true;
    });
  }, [tasks, scope, memberFilter, energyFilter, q]);

  const myDoing = useMemo(
    () => tasks.filter((t) => t.ticket && t.ownerId === me && t.status === "doing").length,
    [tasks]
  );

  const teamLoad = useMemo(() => members.filter((mem) => memberFilter.has(mem.id)).map((mem) => {
    const open = tasks.filter((t) => t.ticket && t.ownerId === mem.id && t.status !== "done").length;
    let rest = 0;
    for (let d = 1; d <= total; d++) {
      if (energyOn(mem.id, keyOf(y, m, d)) === "rest") rest++;
    }
    return { mem, open, rest };
  }), [tasks, members, memberFilter, days, live && live.teamDays, y, m, total]);

  const openTicket = openTicketId ? tasks.find((t) => t.id === openTicketId) || null : null;

  function showInCalendar(t) {
    const p = parseKey(t.dateKey);
    if (!p) return;
    ensureMonth(p.y, p.m);
    setY(p.y); setM(p.m);
    setOpenTicketId(null);
    if (t.ownerId === me) { setMode("personal"); setSelected(p.d); }
    else { setMode("team"); setTeamSelected(p.d); }
  }

  function dropOnColumn(status) {
    if (!dragTicketId) return;
    patchTask(dragTicketId, { status, done: status === "done" });
    setDragTicketId(null);
  }

  const wide = mode === "board";
  const listMode = mode === "personal" && personalView === "list";
  const weekMode = listMode && listRange === "week";

  return (
    <MembersContext.Provider value={members}>
    <div style={{
      direction: "rtl",
      fontFamily: BODY,
      background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep})`,
      minHeight: "100vh",
      padding: "20px 14px 40px",
      color: C.ink,
      boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: wide ? 960 : 480, margin: "0 auto", transition: "max-width .2s" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: C.ink, letterSpacing: 0.2 }}>
            לוח הקצב שלנו
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>
            גל של תפוקה, חיבור ומנוחה — לא רשימת חובות
          </div>
        </div>

        {/* Mode switch */}
        <div style={{
          display: "flex", background: "#fff", borderRadius: 999, padding: 4,
          marginBottom: 14, boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
        }}>
          {[
            { key: "personal", label: "האזור שלי" },
            { key: "team", label: "לוח הצוות" },
            { key: "board", label: "משימות הצוות" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              style={{
                flex: 1, border: "none", cursor: "pointer",
                padding: "9px 0", borderRadius: 999, fontSize: 13, fontWeight: 700,
                fontFamily: DISPLAY,
                background: mode === opt.key ? C.ink : "transparent",
                color: mode === opt.key ? "#fff" : C.inkSoft,
                transition: "all .15s",
              }}
            >{opt.label}</button>
          ))}
        </div>

        {/* Month nav — the board is not month-bound */}
        {mode !== "board" && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fff", borderRadius: 16, padding: "10px 14px",
            marginBottom: 14, boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
          }}>
            <button onClick={() => weekMode ? goWeek(-1) : goMonth(-1)} style={navBtn}>▶</button>
            <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600 }}>
              {weekMode ? weekLabel : `${MONTHS[m]} ${y}`}
            </div>
            <button onClick={() => weekMode ? goWeek(1) : goMonth(1)} style={navBtn}>◀</button>
          </div>
        )}

        {mode === "personal" && (
          <>
            {/* Calendar or flat list of everything of mine */}
            <div style={{
              display: "flex", gap: 8, alignItems: "center", justifyContent: "center",
              flexWrap: "wrap", marginBottom: 14,
            }}>
              <div style={{ display: "flex", background: "#fff", borderRadius: 999, padding: 3, boxShadow: "0 2px 8px rgba(46,34,48,0.06)" }}>
                {[{ key: "calendar", label: "לוח" }, { key: "list", label: "כל המשימות שלי" }].map((o) => (
                  <button key={o.key} onClick={() => setPersonalView(o.key)}
                    style={{
                      border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 999,
                      fontSize: 12.5, fontWeight: 700, fontFamily: DISPLAY,
                      background: personalView === o.key ? C.ink : "transparent",
                      color: personalView === o.key ? "#fff" : C.inkSoft,
                    }}>{o.label}</button>
                ))}
              </div>
              {listMode && (
                <div style={{ display: "flex", background: "#F2EDE3", borderRadius: 999, padding: 3 }}>
                  {[{ key: "week", label: "השבוע" }, { key: "month", label: "החודש" }].map((o) => (
                    <button key={o.key} onClick={() => setListRange(o.key)}
                      style={{
                        border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 999,
                        fontSize: 12.5, fontWeight: 700, fontFamily: DISPLAY,
                        background: listRange === o.key ? C.lilac : "transparent",
                        color: listRange === o.key ? "#fff" : C.inkSoft,
                      }}>{o.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            {!listMode && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, justifyContent: "center" }}>
              {ORDER.map((k) => {
                const b = BLOCKS[k];
                return (
                  <div key={k} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: b.chip, color: b.key === "open" ? C.inkSoft : C.ink,
                    padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${C.line}`,
                  }}>
                    <span>{b.icon}</span><span>{b.label}</span>
                  </div>
                );
              })}
            </div>
            )}

            {/* Rest counter — a monthly instrument, so not over a single week */}
            {!weekMode && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: restCount < minRest ? "#FBEAEA" : C.lilacSoft,
              border: restCount < minRest ? "1px solid #E0A0A0" : "1px solid transparent",
              borderRadius: 12, padding: "8px 12px",
              marginBottom: 14, fontSize: 12.5, color: C.ink,
            }}>
              <span>
                {restCount < minRest && <span style={{ marginLeft: 5 }}>⚠️</span>}
                {restCount < minRest
                  ? <>את מתחת למינימום המומלץ — <b>{restCount}</b> מתוך <b>{minRest}</b>. בחרי עוד יום מנוחה לשמירה על האיזון.</>
                  : <>ימי מנוחה החודש: <b>{restCount}</b> · מינימום מוגן: <b>{minRest}</b></>}
              </span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                {restCount < minRest && (
                  <button
                    onClick={autofillRest}
                    title="בוחרת עבורך ימי מנוחה פנויים, סופ״ש קודם"
                    style={{
                      background: C.lilac, color: "#fff", border: "none", borderRadius: 999,
                      padding: "5px 11px", fontSize: 11.5, fontWeight: 700,
                      cursor: "pointer", fontFamily: DISPLAY, whiteSpace: "nowrap",
                    }}
                  >מלאי עבורי</button>
                )}
                <button onClick={() => setMinRest((v) => Math.max(1, v - 1))} style={miniBtn}>−</button>
                <button onClick={() => setMinRest((v) => Math.min(20, v + 1))} style={miniBtn}>+</button>
              </div>
            </div>
            )}

            {listMode && (
              <div style={{
                background: "#fff", borderRadius: 18, padding: 12,
                boxShadow: "0 4px 16px rgba(46,34,48,0.08)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.line}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
                    {myList.shown} משימות · {myList.tickets} כרטיסים · {myList.done} הושלמו
                  </div>
                  <div style={{ fontSize: 11, color: C.mute }}>🔒 פרטי · 🎫 כרטיס צוות</div>
                </div>

                {myList.groups.length === 0 && myList.undated.length === 0 && (
                  <div style={{ fontSize: 13, color: C.mute, textAlign: "center", padding: "22px 0" }}>
                    {listRange === "week" ? "אין משימות בשבוע הזה" : "אין משימות בחודש הזה"}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {myList.groups.map(({ k, items }) => {
                    const p = parseKey(k);
                    const rec = days[k] || { type: "open" };
                    const b = BLOCKS[rec.type];
                    const isToday = k === todayKey();
                    return (
                      <div key={k}>
                        <button
                          onClick={() => openDay(k)}
                          title="פתחי את היום"
                          style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%",
                            background: "transparent", border: "none", cursor: "pointer",
                            padding: "0 2px 7px", textAlign: "right",
                          }}
                        >
                          <span style={{
                            fontFamily: DISPLAY, fontSize: 13.5, fontWeight: 700,
                            color: isToday ? C.ink : C.inkSoft,
                          }}>
                            {DOW[new Date(p.y, p.m, p.d).getDay()]}׳ · {p.d} ב{MONTHS[p.m]}
                            {isToday && " · היום"}
                          </span>
                          <Chip bg={b.chip} color={b.key === "open" ? C.inkSoft : C.ink} border={`1px solid ${C.line}`}>
                            {b.icon || "○"} {b.label}
                          </Chip>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, color: C.mute }}>{items.length}</span>
                        </button>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map((t) => (
                            <NoteRow
                              key={t.id}
                              t={t}
                              dayType={rec.type}
                              onToggle={(id) => patchTask(id, { done: !t.done })}
                              onOpenTicket={setOpenTicketId}
                              onPublish={publishTask}
                              onRemove={removeTask}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {myList.undated.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 7px" }}>
                        <span style={{ fontFamily: DISPLAY, fontSize: 13.5, fontWeight: 700, color: C.inkSoft }}>
                          ללא תאריך
                        </span>
                        <span style={{ fontSize: 11, color: C.mute }}>· ממתינות במאגר</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {myList.undated.map((t) => (
                          <NoteRow
                            key={t.id}
                            t={t}
                            dayType="open"
                            onToggle={(id) => patchTask(id, { done: !t.done })}
                            onOpenTicket={setOpenTicketId}
                            onPublish={publishTask}
                            onRemove={removeTask}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {mode === "team" && (
          <div style={{
            background: "#fff", borderRadius: 16, padding: 12,
            marginBottom: 14, boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>סינון לפי סוג אנרגיה</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {ORDER.map((k) => {
                const b = BLOCKS[k];
                const active = energyFilter.has(k);
                const isOpen = k === "open";
                return (
                  <button
                    key={k}
                    onClick={() => toggleSet(setEnergyFilter, k)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 11px", borderRadius: 999, fontSize: 12,
                      fontWeight: 700, cursor: "pointer",
                      background: active ? b.fill : "#F2EDE3",
                      color: active ? (isOpen ? C.inkSoft : b.text) : C.mute,
                      border: active ? `1px solid ${isOpen ? C.inkSoft : b.fill}` : "1px solid transparent",
                      boxShadow: active && !isOpen ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
                    }}
                  >
                    <span>{b.icon || "○"}</span><span>{b.label}</span>
                  </button>
                );
              })}
            </div>

            {live && (
              <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>
                  הזמנת חברת צוות
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { live.actions.invite(inviteEmail); setInviteEmail(""); }
                    }}
                    placeholder="אימייל להזמנה..."
                    style={{ ...textInput, direction: "ltr", textAlign: "right" }}
                  />
                  <button
                    onClick={() => { live.actions.invite(inviteEmail); setInviteEmail(""); }}
                    style={{ ...primaryBtn, background: C.magenta }}
                  >הזמיני</button>
                </div>
                {live.invites.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {live.invites.map((email) => (
                      <span key={email} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: C.cream, border: `1px dashed ${C.mute}`, borderRadius: 999,
                        padding: "4px 9px", fontSize: 11.5, color: C.inkSoft, direction: "ltr",
                      }}>
                        {email}
                        <button onClick={() => live.actions.revokeInvite(email)}
                          style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.mute, marginTop: 8 }}>
                  היא תצטרף לצוות אוטומטית בכניסה הראשונה שלה.
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>סינון לפי חברת צוות</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {members.map((mem) => {
                const active = memberFilter.has(mem.id);
                return (
                  <button
                    key={mem.id}
                    onClick={() => toggleSet(setMemberFilter, mem.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 10px 5px 12px", borderRadius: 999, fontSize: 12.5,
                      fontWeight: 700, cursor: "pointer",
                      background: active ? C.magentaSoft : "#F2EDE3",
                      color: active ? C.ink : C.mute,
                      border: active ? `1px solid ${C.line}` : "1px solid transparent",
                      opacity: active ? 1 : 0.7,
                    }}
                  >
                    <span>{mem.name}</span>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: active ? C.ink : C.mute, color: "#fff",
                      fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{mem.initials}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- Board ---------------- */}
        {mode === "board" && (
          <>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 12,
              marginBottom: 12, boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "#F2EDE3", borderRadius: 999, padding: 3 }}>
                  {[{ key: "mine", label: "שלי" }, { key: "team", label: "כל הצוות" }].map((o) => (
                    <button key={o.key} onClick={() => setScope(o.key)}
                      style={{
                        border: "none", cursor: "pointer", padding: "6px 16px", borderRadius: 999,
                        fontSize: 12.5, fontWeight: 700, fontFamily: DISPLAY,
                        background: scope === o.key ? C.ink : "transparent",
                        color: scope === o.key ? "#fff" : C.inkSoft,
                      }}>{o.label}</button>
                  ))}
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="חיפוש בכרטיסים..."
                  style={{ ...textInput, flex: 1, minWidth: 140 }}
                />
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: scope === "team" ? 10 : 0 }}>
                {NEEDS.map((k) => {
                  const b = BLOCKS[k];
                  const active = energyFilter.has(k);
                  const isOpen = k === "open";
                  return (
                    <button key={k} onClick={() => toggleSet(setEnergyFilter, k)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                        background: active ? b.fill : "#F2EDE3",
                        color: active ? (isOpen ? C.inkSoft : b.text) : C.mute,
                        border: active ? `1px solid ${isOpen ? C.inkSoft : b.fill}` : "1px solid transparent",
                      }}>
                      <span>{b.icon || "○"}</span><span>{NEED_LABEL[k]}</span>
                    </button>
                  );
                })}
              </div>

              {scope === "team" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {members.map((mem) => {
                    const active = memberFilter.has(mem.id);
                    return (
                      <button key={mem.id} onClick={() => toggleSet(setMemberFilter, mem.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "4px 9px 4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          background: active ? C.magentaSoft : "#F2EDE3",
                          color: active ? C.ink : C.mute,
                          border: active ? `1px solid ${C.line}` : "1px solid transparent",
                          opacity: active ? 1 : 0.7,
                        }}>
                        <span>{mem.name}</span>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: active ? C.ink : C.mute, color: "#fff", fontSize: 9,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{mem.initials}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* who is carrying what */}
            {scope === "team" && (
              <div style={{
                background: "#fff", borderRadius: 16, padding: 12, marginBottom: 12,
                boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 10 }}>
                  העומס של הצוות החודש
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {teamLoad.map(({ mem, open, rest }) => {
                    const heavy = open >= 4;
                    return (
                      <div key={mem.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: heavy ? C.goldSoft : C.cream,
                        border: `1px solid ${heavy ? C.gold : C.line}`,
                        borderRadius: 12, padding: "7px 10px", minWidth: 132, flex: "1 1 132px",
                      }}>
                        <Avatar id={mem.id} size={26} />
                        <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{mem.name}</div>
                          <div style={{ fontSize: 11, color: C.inkSoft }}>
                            {open} פתוחים · {rest} ימי מנוחה
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {myDoing > WIP_LIMIT && (
              <div style={{
                background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 12,
                padding: "9px 12px", marginBottom: 12, fontSize: 12.5, color: "#7A5609",
              }}>
                ⚠️ יש לך <b>{myDoing}</b> כרטיסים בעבודה במקביל. המלצה: לא יותר מ־{WIP_LIMIT}. מה אפשר להחזיר למאגר?
              </div>
            )}

            <div style={{
              display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10,
              alignItems: "flex-start", scrollSnapType: "x proximity",
            }}>
              {STATUS_ORDER.map((s) => {
                const st = STATUS[s];
                const list = boardTickets.filter((t) => t.status === s);
                return (
                  <div
                    key={s}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOnColumn(s)}
                    style={{
                      flex: "1 0 224px", minWidth: 224, maxWidth: 320, scrollSnapAlign: "start",
                      background: "#fff", borderRadius: 16, padding: 10,
                      boxShadow: "0 2px 10px rgba(46,34,48,0.06)",
                      border: dragTicketId ? `1px dashed ${st.accent}` : "1px solid transparent",
                    }}
                  >
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${st.chip}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: DISPLAY, fontSize: 13.5, fontWeight: 700 }}>
                        <span>{st.icon}</span><span>{st.label}</span>
                      </div>
                      <span style={{
                        background: st.chip, color: st.accent, borderRadius: 999,
                        padding: "2px 8px", fontSize: 11, fontWeight: 700,
                      }}>{list.length}</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
                      {list.length === 0 && (
                        <div style={{ fontSize: 11.5, color: C.mute, textAlign: "center", padding: "14px 0" }}>
                          {dragTicketId ? "שחררי כאן" : "ריק"}
                        </div>
                      )}
                      {list.map((t) => (
                        <TicketCard
                          key={t.id}
                          t={t}
                          warn={mismatchOf(t)}
                          dragging={dragTicketId === t.id}
                          onDragStart={setDragTicketId}
                          onOpen={setOpenTicketId}
                        />
                      ))}
                    </div>

                    {s === "backlog" && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <input
                          value={newCardText}
                          onChange={(e) => setNewCardText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addBoardCard(newCardText); }}
                          placeholder="כרטיס חדש..."
                          style={{ ...textInput, fontSize: 12 }}
                        />
                        <button onClick={() => addBoardCard(newCardText)} style={{ ...primaryBtn, padding: "0 12px" }}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: "center", marginTop: 6 }}>
              גררי כרטיס בין העמודות · הקישי על כרטיס לפרטים ולעדכון לצוות
            </div>
          </>
        )}

        {/* ---------------- Calendar grid ---------------- */}
        {mode !== "board" && !listMode && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 12, boxShadow: "0 4px 16px rgba(46,34,48,0.08)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
              {DOW.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 11.5, color: C.inkSoft, fontWeight: 700, padding: "4px 0" }}>{d}</div>
              ))}
            </div>

            {mode === "personal" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} />;
                  const k = keyOf(y, m, d);
                  const data = days[k] || { type: "open", note: "" };
                  const b = BLOCKS[data.type];
                  const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
                  const dayTasks = dayIndex[k] || [];
                  return (
                    <button
                      key={k}
                      draggable
                      onDragStart={() => setDragKey(d)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(d)}
                      onClick={() => setSelected(d)}
                      style={{
                        aspectRatio: "1 / 1", borderRadius: 10,
                        border: isToday ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                        background: b.fill, color: b.text,
                        fontFamily: BODY, fontWeight: 700, fontSize: 13,
                        cursor: "grab", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 1, padding: 0,
                        outline: dragKey === d ? `2px dashed ${C.ink}` : "none",
                        opacity: dragKey === d ? 0.5 : 1,
                      }}
                      title={b.label}
                    >
                      <span>{d}</span>
                      {b.icon && <span style={{ fontSize: 10 }}>{b.icon}</span>}
                      {dayTasks.length > 0 && (
                        <span style={{ display: "flex", gap: 2, marginTop: 1 }}>
                          {dayTasks.slice(0, 3).map((t) => (
                            <span key={t.id} style={{
                              width: 5, height: 5, borderRadius: "50%",
                              background: t.ticket ? STATUS[t.status].accent : "transparent",
                              border: t.ticket ? "none" : `1px solid ${data.type === "open" ? C.inkSoft : "rgba(255,255,255,.85)"}`,
                            }} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} />;
                  const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
                  const marks = teamMarksFor(d);
                  const mood = dominantType(marks);
                  const moodBlock = mood ? BLOCKS[mood] : null;
                  const k = keyOf(y, m, d);
                  const dayTickets = marks.reduce((n, x) => n + ticketsOn(x.mem.id, k).length, 0);
                  return (
                    <button
                      key={`t${d}`}
                      onClick={() => setTeamSelected(d)}
                      style={{
                        minHeight: 66, borderRadius: 10,
                        border: isToday ? `2px solid ${C.ink}`
                          : moodBlock ? `1px solid ${moodBlock.fill}` : `1px solid ${C.line}`,
                        background: moodBlock ? moodBlock.chip : "#FBF8F2",
                        cursor: "pointer", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "flex-start", gap: 3, padding: "6px 2px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: BODY }}>{d}</span>
                        {moodBlock && moodBlock.icon && <span style={{ fontSize: 11 }}>{moodBlock.icon}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap", maxWidth: 44 }}>
                        {marks.map((x, idx) => (
                          <span key={idx} style={{
                            width: 13, height: 13, borderRadius: "50%",
                            background: BLOCKS[x.type].fill,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
                          }} title={`${x.mem.name} · ${BLOCKS[x.type].label}`} />
                        ))}
                      </div>
                      {dayTickets > 0 && (
                        <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700 }} title={`${dayTickets} כרטיסים`}>
                          🎫{dayTickets}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode !== "board" && (
          <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: "center", marginTop: 10 }}>
            {mode === "team"
              ? "הקישי על יום כדי לראות מי מהצוות סימנה מה ועל מה היא עובדת"
              : listMode
                ? "הקישי על תאריך כדי לפתוח את היום · 🔒 הופכת לכרטיס בלחיצה"
                : "גררי יום כדי להזיז אותו למקום אחר · הקישי על יום כדי לערוך"}
          </div>
        )}

        {/* ---------------- Personal edit popup ---------------- */}
        {mode === "personal" && selected && selData && (
          <div onClick={() => setSelected(null)} style={overlayStyle}>
            <div onClick={(e) => e.stopPropagation()} style={popupStyle}>
              <div style={popupHeaderStyle}>
                <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700 }}>{selected} ב{MONTHS[m]}</div>
                <button onClick={() => setSelected(null)} style={closeBtn}>✕</button>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {ORDER.map((k) => {
                  const b = BLOCKS[k];
                  const active = selData.type === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setDayType(selected, k)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "7px 12px", borderRadius: 999, fontSize: 12.5,
                        fontWeight: 700, cursor: "pointer",
                        background: active ? b.fill : b.chip,
                        color: active ? b.text : (k === "open" ? C.inkSoft : C.ink),
                        border: active ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                      }}
                    >
                      <span>{b.icon}</span><span>{b.label}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                value={selData.note}
                onChange={(e) => setDayNote(selected, e.target.value)}
                placeholder={NOTE_PLACEHOLDERS[selData.type]}
                style={{
                  width: "100%", minHeight: 70, borderRadius: 10,
                  border: `1px solid ${C.line}`, padding: 10, fontSize: 13.5,
                  fontFamily: BODY, resize: "vertical", boxSizing: "border-box",
                  direction: "rtl", background: C.cream,
                }}
              />

              {selData.type === "rest" && (
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8 }}>
                  🌙 יום מנוחה מוגן. אפשר להזיז אותו, אבל אי אפשר לרדת מתחת למינימום החודשי בלי לבחור יום חלופי.
                </div>
              )}

              <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>משימות היום</div>
                  <div style={{ fontSize: 10.5, color: C.mute }}>🔒 פרטי · 🎫 כרטיס צוות</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {selTasks.length === 0 && (
                    <div style={{ fontSize: 12.5, color: C.mute, fontStyle: TASK_STYLE[selData.type].italic ? "italic" : "normal" }}>
                      {selData.type === "rest" ? "מרחב פנוי. אין חובה להוסיף כלום." : "אין עדיין משימות ליום הזה"}
                    </div>
                  )}
                  {selTasks.map((t) => {
                    const ts = TASK_STYLE[selData.type];
                    const st = STATUS[t.status];
                    return (
                      <div key={t.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: ts.rowBg, borderRadius: ts.radius, padding: "7px 9px",
                        border: `1px solid ${C.line}`,
                      }}>
                        <button
                          onClick={() => patchTask(t.id, { done: !t.done })}
                          style={{
                            width: 19, height: 19, borderRadius: ts.boxRadius, flexShrink: 0,
                            border: ts.border,
                            background: t.done ? ts.accent : "transparent",
                            color: "#fff", fontSize: 12, display: "flex",
                            alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                          }}
                        >{t.done ? "✓" : ""}</button>

                        <span style={{
                          flex: 1, fontSize: 13, textAlign: "right",
                          fontWeight: t.done ? 400 : ts.weight,
                          fontStyle: ts.italic && !t.done ? "italic" : "normal",
                          color: t.done ? C.mute : C.ink,
                          textDecoration: t.done ? "line-through" : "none",
                        }}>{t.text}</span>

                        {t.ticket ? (
                          <button
                            onClick={() => setOpenTicketId(t.id)}
                            title="כרטיס פתוח בלוח הצוות"
                            style={{
                              display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                              background: st.chip, color: st.accent, border: `1px solid ${st.accent}`,
                              borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 700,
                            }}
                          >🎫 {st.label}</button>
                        ) : (
                          <button
                            onClick={() => publishTask(t)}
                            title="פתחי כרטיס — המשימה תופיע בלוח הצוות"
                            style={{
                              display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                              background: "transparent", color: C.inkSoft, border: `1px dashed ${C.mute}`,
                              borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 700,
                            }}
                          >🔒 פתחי כרטיס</button>
                        )}

                        <button
                          onClick={() => removeTask(t.id)}
                          style={{ background: "none", border: "none", color: C.mute, fontSize: 13, cursor: "pointer" }}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>

                {/* add a task, privately or as a team ticket */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { addDayTask(selected, newTaskText, newTaskShared); setNewTaskText(""); }
                    }}
                    placeholder={selData.type === "rest" ? "רק אם ממש צריך..." : "הוסיפי משימה..."}
                    style={{
                      flex: 1, borderRadius: TASK_STYLE[selData.type].radius, border: `1px solid ${C.line}`,
                      padding: "7px 10px", fontSize: 13, fontFamily: BODY,
                      direction: "rtl", boxSizing: "border-box",
                      background: selData.type === "rest" ? C.lilacSoft : "#fff",
                    }}
                  />
                  <button
                    onClick={() => { addDayTask(selected, newTaskText, newTaskShared); setNewTaskText(""); }}
                    style={{
                      background: TASK_STYLE[selData.type].accent, color: "#fff", border: "none",
                      borderRadius: TASK_STYLE[selData.type].radius,
                      padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >הוסיפי</button>
                </div>

                <button
                  onClick={() => setNewTaskShared((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                    background: newTaskShared ? C.magentaSoft : "transparent",
                    border: `1px ${newTaskShared ? "solid" : "dashed"} ${newTaskShared ? C.magenta : C.mute}`,
                    borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 700,
                    color: newTaskShared ? C.ink : C.inkSoft,
                  }}
                >
                  <span style={{
                    width: 28, height: 16, borderRadius: 999, position: "relative",
                    background: newTaskShared ? C.magenta : C.line, transition: "background .15s",
                  }}>
                    <span style={{
                      position: "absolute", top: 2, right: newTaskShared ? 14 : 2,
                      width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "right .15s",
                    }} />
                  </span>
                  {newTaskShared ? "🎫 נפתח ככרטיס לצוות" : "🔒 פרטי — רק לי"}
                </button>

                {newTaskShared && selData.type === "rest" && (
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8, background: C.lilacSoft, padding: "7px 9px", borderRadius: 10 }}>
                    🌙 זה יום מנוחה מוגן. הכרטיס ייפתח במאגר בלי תאריך, כדי לא לקחת לך את היום.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Team day popup ---------------- */}
        {mode === "team" && teamSelected && (
          <div onClick={() => setTeamSelected(null)} style={overlayStyle}>
            <div onClick={(e) => e.stopPropagation()} style={popupStyle}>
              <div style={popupHeaderStyle}>
                <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700 }}>{teamSelected} ב{MONTHS[m]} · הצוות</div>
                <button onClick={() => setTeamSelected(null)} style={closeBtn}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {teamMarksFor(teamSelected).length === 0 && (
                  <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "10px 0" }}>
                    אין תוצאות תואמות לסינון הנוכחי
                  </div>
                )}
                {teamMarksFor(teamSelected).map((x) => {
                  const b = BLOCKS[x.type];
                  const k = keyOf(y, m, teamSelected);
                  const list = ticketsOn(x.mem.id, k);
                  return (
                    <div key={x.mem.id} style={{ background: C.cream, borderRadius: 12, padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar id={x.mem.id} size={26} />
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.mem.name}</span>
                        </div>
                        <Chip bg={b.chip} color={b.key === "open" ? C.inkSoft : C.ink} style={{ fontSize: 12, padding: "4px 9px" }}>
                          {b.icon || "◦"} {b.label}
                        </Chip>
                      </div>

                      {list.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                          {list.map((t) => {
                            const st = STATUS[t.status];
                            const tint = NEED_TINT[t.energy];
                            return (
                              <button key={t.id} onClick={() => setOpenTicketId(t.id)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                                  background: t.done ? "#FBFAF8" : tint.fill,
                                  border: `1px solid ${t.done ? C.line : tint.edge}`,
                                  borderRight: `3px solid ${st.accent}`,
                                  borderRadius: 10, padding: "6px 9px", textAlign: "right",
                                }}>
                                <span style={{ flex: 1, fontSize: 12.5, color: t.done ? C.mute : C.ink,
                                  textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                                <Chip bg={st.chip} color={st.accent}>{st.icon} {st.label}</Chip>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {list.length === 0 && x.type !== "rest" && (
                        <div style={{ fontSize: 11.5, color: C.mute, marginTop: 6 }}>אין כרטיסים ליום הזה</div>
                      )}
                      {x.type === "rest" && (
                        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 6 }}>🌙 במנוחה — לא לתזמן</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Ticket popup ---------------- */}
        <TicketModal
          task={openTicket}
          warn={openTicket ? mismatchOf(openTicket) : null}
          me={me}
          onPatch={patchTask}
          onAddUpdate={addUpdate}
          onDelete={removeTask}
          onClose={() => setOpenTicketId(null)}
          onShowInCalendar={showInCalendar}
          onUnpublish={unpublishTask}
        />
      </div>
    </div>
    </MembersContext.Provider>
  );
}

const navBtn = { background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#2E2230", padding: "4px 10px", borderRadius: 8 };
const miniBtn = { width: 22, height: 22, borderRadius: "50%", border: "1px solid #B98FB4", background: "#fff", color: "#2E2230", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 };
const closeBtn = { background: "none", border: "none", fontSize: 15, cursor: "pointer", color: "#6E5C6B" };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(46,34,48,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50, boxSizing: "border-box" };
const popupStyle = { background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 12px 40px rgba(46,34,48,0.25)", width: "100%", maxWidth: 400, direction: "rtl", maxHeight: "84vh", overflowY: "auto" };
const popupHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const pillBtn = { padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Assistant','Segoe UI',system-ui,sans-serif" };
const textInput = { flex: 1, width: "100%", borderRadius: 10, border: "1px solid #E2D7C6", padding: "7px 10px", fontSize: 12.5, fontFamily: "'Assistant','Segoe UI',system-ui,sans-serif", direction: "rtl", boxSizing: "border-box", background: "#fff", color: "#2E2230" };
const primaryBtn = { background: "#2E2230", color: "#fff", border: "none", borderRadius: 10, padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Assistant','Segoe UI',system-ui,sans-serif" };
