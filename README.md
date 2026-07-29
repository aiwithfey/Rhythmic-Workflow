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
- **Rest days can fill themselves.** Below the monthly minimum, **מלאי עבורי**
  picks the missing days: weekend first, then whichever day sits furthest from
  the rest days already chosen, so they spread instead of clumping. Days that
  already carry work are a last resort, and days that have passed are never
  chosen — so late in a month it fills what it can and says you are still short
  rather than pretending otherwise.
- **Days carry their tasks.** Drag a day to a new date in your calendar and its
  tasks travel with it.
- **Team load, in rhythm terms.** The board shows each person's open ticket count
  next to their rest days that month, so "who can take this" is answerable.
- **WIP guard.** More than three tickets in בעבודה prompts a nudge, not a badge.
- **Unclaimed tickets** show *מחפשת מישהי* and an "אני לוקחת את זה" button.
- **Updates on a ticket** are the lightweight "what I'm working on" the team reads
  without a standup. Separate from **פרטים**, the ticket's own notes: an update
  says what changed, a note says what the work is. Detail lives there so the
  title can stay a name and the board stays readable.
- **Finished work is kept, not displayed.** The done column shows the ten most
  recent and sends the rest to **כל מה שהושלם** — the same filters as the board
  plus a completion date range, as a flat list rather than columns, since a
  finished ticket has nowhere left to move.

## Two modes, one component

`src/RhythmCalendar.tsx` runs on seed data by default — no account, no network —
so the design can be worked on freely. Pass it a `backend` and the same screens
run on Postgres. Which one you get is decided at build time by whether
credentials are present:

```bash
npm install
cp .env.example .env
npm start          # build against the database + serve on http://localhost:3000 — sign in here

npm run build      # mock data — this is what the artifact publishes
npm run dev        # mock, with rebuild on save, on :5173
```

Port 3000 is deliberate: it is Supabase's default Site URL, so magic links come
back to the running app without configuring anything first. Deploy somewhere
else and that URL has to be added under Authentication → URL Configuration, or
links will bounce to localhost.

The published artifact is the **mockup** and cannot be the live app — artifacts
run under a CSP that blocks requests to any external host, so the page could
never reach Supabase.

## Deploying

`.github/workflows/deploy.yml` builds against the database and publishes to
GitHub Pages on every push to `main`, landing at:

**https://aiwithfey.github.io/Rhythmic-Workflow/**

Two things have to be switched on once, by hand:

1. **Repository → Settings → Pages → Source: GitHub Actions.** Until this is
   set, the workflow runs and the deploy step fails.
2. **Supabase → Authentication → URL Configuration.** Add the Pages URL above as
   the Site URL, or as an additional redirect URL. Magic links are refused if
   they point somewhere that is not on that list.

The app is served from a repository subpath, not the domain root, so sign-in
sends `origin + pathname` as the return address rather than `origin` alone —
otherwise every magic link would come back to the top of `aiwithfey.github.io`
and miss the app entirely. `dist/index.html` is also published as `404.html`, so
a link returning on an unexpected path still boots the app.

The page is public; the data is not. A stranger who finds the URL can request a
link and get an account, and will then see the "you are not on a team yet"
screen and nothing else.

## Accounts and the database

Supabase project **FeyApps** (`puijleicxiiumkbbeect`, eu-west-1). Schema lives in
`supabase/migrations/` and is already applied.

Sign-in offers a **password** or a **six-digit code by email**, and it is
invite-only:
`invites` holds addresses, and the first time one of them signs in a trigger
creates their profile and joins them to the team. Invite from the collapsed
panel below the account bar — adding someone happens rarely, so it does not sit
inside a view used daily.

An **owner** can also open a teammate's account directly — set an email and a
temporary password, hand it to them, and they are in immediately with no email
at all. That needs the service-role key, which can never sit in a public
bundle, so it runs as a Supabase edge function
(`supabase/functions/admin-create-user`) that re-checks the caller's role
itself rather than trusting the client. Deploy it with
`supabase functions deploy admin-create-user` and it needs no secrets set by
hand — Supabase provides the service-role key to the function automatically.
`0006_owner_role.sql` makes `feypelleg@gmail.com` the first owner.

A one-time **invite link** is the other way in, for anyone who is not an
owner, or when handing someone a password directly is not how you want to do
it. The token is minted server-side,
is good for a single person, expires in a week, and is redeemed by a function
rather than by reading the table, so the link cannot be guessed or enumerated.
Redemption claims the row and the membership in one update, so a shared link
cannot admit two people however fast they both click. Someone already on a team
who opens a link does not spend it — otherwise testing your own link would hand
the newcomer a dead one.

That trigger names you after your email address, so the account bar under the
calendar lets you fix it. Initials follow the name rather than being set
separately — they exist only to fill an avatar.

Password is the default, because it costs no email at all — the built-in sender
allows two an hour, which is not enough to onboard a team. An account made with
a code has no password until the account bar gives it one.

The code replaced a magic link deliberately. A link is single-use, so it dies
when a mail scanner prefetches it, when a newer one supersedes it, or when the
page is reloaded — all of which read to the person signing in as "expired". A
code has no URL to prefetch and no redirect to keep in an allow-list, which is
also why renaming the repository can no longer break sign-in.

**Onboarding costs zero emails**: send an invite link, they set a password, they
are in. Without the link that would be two — an invite and a login code — and
the hourly cap makes two people at once impossible.

Google sign-in is written and one flag away, but genuinely needs setup nobody
else can do: create an OAuth client in the Google Cloud console, paste its ID
and secret into the Supabase dashboard, then flip `GOOGLE_ENABLED` in
`src/SignIn.tsx`.

### The privacy rule is enforced in the database

`ticket` is the difference between a note only you can see and a card the team
works from, so it is not left to the client:

- Your private tasks are invisible to everyone else, published tickets are not.
- Teammates can move, claim and comment on a published card, but only the owner
  can take one private again — the `with check` on `tasks_update` is what stops
  it.
- The team can read which **energy** a day holds, and never the note written in
  it. Row level security cannot hide one column, so `day_marks` and `day_notes`
  are separate tables.
- A private task with no day cannot exist; the check constraint refuses it.
- Deleting a member takes their private notes with them and leaves their
  tickets behind as unassigned work.

Each of those is covered by an impersonation test — see the RLS suite in the
commit history, which runs as one user and asserts what another cannot reach.

## Where the mock data lives

`MEMBERS` is the team, `ME` is whose calendar you're editing, `seedMonth` seeds an
example rhythm, and `seedTasks` seeds the board relative to today's date. None of
it is used when a `backend` is passed.
