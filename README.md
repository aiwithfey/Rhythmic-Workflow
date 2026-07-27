# לוח הקצב שלנו · Rhythmic Workflow

A rhythm calendar that doubles as the team's task board.

The calendar half is the original idea: every day is marked with an energy type —
גמיש (flexible), אנרגיה גבוהה (deep focus), חיבור (connection), מנוחה מוגנת
(protected rest) — for yourself and, in team mode, for everyone at once.

The task half is what makes people open it daily. Tasks live inside the days.
Some stay private notes; some are **opened as a ticket** and become cards on a
shared kanban board. Same object, one toggle apart.

## The three views

| View | What it is |
| --- | --- |
| **האזור שלי** | Your month. Set each day's energy, write a note, keep the day's tasks. Toggle **כל המשימות שלי** for everything of yours in one list, by week or by month. |
| **לוח הצוות** | Everyone's energy on a calendar, filterable by person and by energy. Tapping a day shows who is on what — energy plus their open tickets for that day. |
| **משימות הצוות** | The kanban board: מאגר · מתוכנן · בעבודה · הושלם. Same filters as the calendar, plus mine/team scope and search. |

## Private note vs. team ticket

Inside a day, each task carries a badge:

- 🔒 **פתחי כרטיס** — the task is yours alone. Press it to publish.
- 🎫 **status** — the task is a public ticket; the badge shows its column and
  opens the ticket.

New tasks have a toggle right under the input, so you decide when you write it.

Publishing is reversible: **החזירי לפרטי** takes a ticket back off the board. A
private task has to live on a day — there is no dateless private list — so an
undated ticket comes back to today, and the app opens that day so you can see
where it landed. Only your own tickets offer this; you cannot turn someone
else's ticket into your private note.

## Everything of mine, in one list

The calendar answers "what is this day", not "what do I owe". **כל המשימות שלי**
in your zone lists your tasks grouped by day, for the current week or the whole
month, with a count of tasks, tickets and completed at the top. The arrows walk
weeks instead of months while the week range is on. Undated backlog tickets get
their own group at the bottom, so nothing of yours is only reachable by
remembering it. Tap any date to open that day; the publish control works from
the list too.

Color means one thing here: a tinted row is a ticket, and its tint is the
energy that ticket needs. Private notes stay on paper and carry the day's mood
in their shape — the radius, the weight, a rest day's italics — instead of its
color, because a list crosses days and two color systems in one column read as
noise.

## What ties the two halves together

Anyone can build a kanban. What this one knows is *the energy each day holds*.

- **Tickets carry the energy they need** — עומק / אנשים / גמיש.
- **Mismatches surface on the card.** A deep-focus ticket parked on a connection
  day gets a soft ⚠️; anything scheduled onto a protected rest day gets 🌙
  *מתוזמן ליום מנוחה מוגן*.
- **Rest days are not bookable.** A ticket opened from a rest day goes to the
  backlog without a date instead of eating the day.
- **Days carry their tasks.** Drag a day to a new date in your calendar and its
  tasks travel with it.
- **Team load, in rhythm terms.** The board shows each person's open ticket count
  next to their rest days that month, so "who can take this" is answerable.
- **WIP guard.** More than three tickets in בעבודה prompts a nudge, not a badge.
- **Unclaimed tickets** show *מחפשת מישהי* and an "אני לוקחת את זה" button.
- **Updates on a ticket** are the lightweight "what I'm working on" the team reads
  without a standup.

## Running it

```bash
npm install
npm run dev      # esbuild dev server on :5173
npm run build    # dist/index.html (standalone) + dist/artifact.html (fragment)
npm run typecheck
```

`src/RhythmCalendar.tsx` is deliberately one self-contained file with inline
styles and mock data — paste it anywhere React runs. State is in-memory; there is
no backend yet.

## Where the mock data lives

`MEMBERS` is the team, `ME` is whose calendar you're editing, `seedMonth` seeds an
example rhythm, and `seedTasks` seeds the board relative to today's date.
