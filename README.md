# Waterman Ops Deck

One place for a shift to find everything it needs — opening and closing checklists,
end of day, banking sheet, schedule, and the Saturday Workshop submission — for all
11 Waterman Group stores.

Version 1 is a **hub**: a single static page that gates on a store PIN and launches
the existing Google Forms and Sheets, plus a schedule viewer built in natively. Nothing about the current Google workflow
changes. Later versions can replace one module at a time with native forms and a
database, without moving anyone's bookmark.

## Files

Everything sits at the repo root — there is no build step and no subfolder to preserve.

- `index.html` — the whole app. One file, no dependencies.
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — make it installable on a tablet.
- `robots.txt` — keeps the deck out of search engines.
- `render.yaml` — Render blueprint. Publish directory is `.` (the repo root).
- `apps-script.gs` — the shared backend. Optional, but most of the good parts need it.
- `README.md` — this file.

The Waterman Arch Supports logo is embedded in the page as data, in two versions: the
navy lockup for light screens and a pale one for dark, swapped by the viewer's theme.
No external image request, nothing to host.

The work schedule is **not** a link — periods 8, 9 and 10 of the 2026 schedule are
embedded in the page as data, so the Schedule tile opens a real week view for the
store you're signed into, with today highlighted and that week's PTO notes underneath.
To refresh it, re-export the schedule workbook and replace the `SCHEDULE` object in
the script.

## What's wired up

All six tiles are live. The links live in the `CONFIG` block near the top of the
`<script>`.

| Tile | Source |
|---|---|
| Opening Checklist | Google Form — "Opening Daily Check List" |
| Closing Checklist | Google Form — "Closing Daily Check List" |
| End of Day Form | Google Sheet — "9 26 EOD Form" *(period-specific)* |
| Banking Sheet | Google Sheet — "August 2026 Banking Sheet" *(monthly)* |
| Work Schedule | Native — rendered from embedded data, no link needed |
| Saturday Workshop | Google Form — "26 Weekly Training Recap" |

## Daily check-off

Each daily tile carries a tick box. The day runs the way the stores actually run it:

| Task | When |
|---|---|
| Opening checklist | Morning |
| Banking — morning entry | Morning |
| End of day form | Throughout the day |
| Closing checklist | Afternoon |
| Banking — afternoon entry | Afternoon |

Ticking one stamps the time. The band at the top shows how many of the five are done
and names what's still open. State is keyed to store + calendar date, so it clears
itself overnight — a new shift opens to a clean list.

Shift hours are configurable in `CONFIG.hours` (`amEnds`, `pmStarts`, 24-hour clock).

When someone ticks their first task of the day, the deck asks who they are and offers
the initials of whoever is scheduled at that store today — pulled from the embedded
schedule. It remembers the answer for the rest of the day and stamps every tick with it.

## The shared tick log

Without it, ticks live only in the browser that made them, and the company view can
only report on the device you're holding — every other store reads empty regardless of
what they actually did. It says so on screen rather than pretending the grid is complete.

### Connecting the tick log

`apps-script.gs` ships alongside this README. Setup is about ten minutes:

1. Create a Google Sheet ("Ops Deck Tick Log" or similar).
2. Extensions > Apps Script, paste in `apps-script.gs`, save.
3. Deploy > New deployment > Web app. Execute as **Me**, access **Anyone**.
   ("Anyone" is required — store tablets aren't signed in to Google.)
4. Copy the `/exec` URL into `CONFIG.sync.url` in `index.html`, redeploy the site.

Each tick then posts store, task, initials and timestamp to that sheet, and the
district view reads the day back out of it. Ticking still works with no signal or a
bad URL — the tablet keeps its own copy either way, so a store is never blocked.

### What the grid does and doesn't prove

A dash means nobody ticked it. That is not the same as the work not being done, and
the deck doesn't pretend otherwise. For the three Google Forms, the response sheet
remains the real record of submission — the tick is a convenience, not evidence.
Banking and EOD are the two where the tick is the only signal you have.

## Signing in

One code. Each store has its own four digits in `CONFIG.storePasswords` — pick the store,
type the code, you're in. The tablet then stays signed in to that store until someone
hits "Change store", so nobody types it twice a day.

**Who ticked what** is asked at the first tick of the day, not at sign-in. The deck offers
the initials of whoever is scheduled at that store today, pulled from the embedded
schedule, and remembers the answer until midnight. "Not you?" in the top bar swaps it.

`CONFIG.managerPin` is a separate four digits for the Company View. Give it to DMs and RMs.

### Read this before you push the repo

**The codes live in the page source.** Store codes and the company code are readable by
anyone who opens the site and hits View Source. That is how a static site works — there
is no server to keep a secret behind.

`Waterman-Admin-Page` is currently a **public** GitHub repo. If you push this file as is,
the codes are on github.com for anyone to read, indexed and searchable.
**Make the repo private before the first push.**

Even private, treat these as a lock on the shop's front door, not a safe. What they buy
you: a customer can't wander into the deck, and ticks carry initials. What they don't buy
you: protection from anyone determined. The things worth protecting — the Forms and the
Sheets — keep their own Google permissions and are not weakened by any of this.

For a real gate, put the site behind Render's password protection or an IP allowlist at
the host level, and let these codes do the lighter job.

## Company and district view

The gate screen has a **Company View** box under "Managers", behind `CONFIG.managerPin`.
Two toggles:

**Scope** — Company (all eleven, grouped by district), West, or East.

**Period** —

- **Day** — each store's five tasks as filled or empty boxes, with who ticked them.
- **Week** — Monday to Saturday across the top, each day showing how many of the five
  landed, and a running total out of thirty.
- **Month** — one square per trading day, shaded for none / some / all five, with the
  store's percentage and how many days were fully complete.

Sundays are not counted anywhere — stores trade Monday to Saturday.

Prev / Next step by day, week, or month depending on which period you're in, so you can
walk back through history. Week and Month pull the whole span in a single request to the
tick log rather than one per day.

It needs the shared tick log to see more than one tablet — see below.

## Install it on the tablets

The deck is a proper installable app. On a store tablet, open the site and take the
"Add the deck to this tablet's home screen" button on the gate screen, or use the
browser's own Add to Home Screen. It then opens full-screen with the Waterman icon, and
the shell is kept on the device — a dropped connection no longer takes the checklists
down with it.

Ticks made offline stay on that tablet and are not posted to the shared log, so a store
that lost signal reads blank in the Company View until someone re-ticks. Worth knowing
before you read too much into a gap.

To force every tablet onto a new version immediately, bump `CACHE` in `sw.js`.

## The schedule updates itself

Save the Work Schedule workbook URL on the Admin page and the deck reads the schedule
straight out of it — the current period plus the one either side. Publish Period 11 in
the sheet and it appears; nobody rebuilds the site. The last-read copy is cached on each
tablet so the week still renders with no signal, and the version compiled into the page
is the final fallback.

## Sales pace

With the EOD workbook link saved, the deck reads its Dashboard tab and shows each store
its own position: sales against goal, how far through the period you are, and the daily
number needed to close the gap. It sits under the "right now" band and turns amber when
the store is behind pace.

This is a judgement call, not a neutral feature — a shift seeing "needs $4,445/day" on a
bad week may be motivated or may be demoralised, and you know your teams better than the
software does. There's an on/off switch under Options on the Admin page.

## Reminder emails

Put an address (or several, comma-separated) in **Reminder emails** on the Admin page,
then run `installNudges()` once from the Apps Script editor. You get a list at 11am and
7pm on trading days of what hasn't been ticked, per store. Sundays are skipped.
`removeNudges()` turns it off again.

## Form responses beat ticks

Opening, closing and workshop each already write a row to a Google Form response sheet.
That row is the real record; a tick is a convenience copy. Save those three response
sheet URLs on the Admin page and the Company View scores them on actual submissions —
cells sourced that way carry a small dot and the tooltip says "submitted" rather than
"ticked". Banking and EOD have no submission trail, so a tick stays the only signal there.

## Export for the compliance report

**Export CSV** in the Company View drops whatever is on screen — day, week or month,
company or one district — as a spreadsheet-ready file: date, district, store, task,
status, who, time, and whether it came from a form or a tick. Feeds the monthly report
instead of being re-keyed.

## Admin page

The gate screen has an **Admin** box next to Company View, behind `CONFIG.adminPin`.
Three sections — **Module links**, **Form responses**, and **Options** (reminder emails,
sales pace on/off) — and one Save button.

This is how you swap a workbook when a new one goes live. Paste the new URL over the
old one, save, and — with the shared log connected — **every store picks it up the next
time a tablet loads the deck.** No edit, no commit, no redeploy.

Things worth knowing:

- Links that rotate carry a badge: *New workbook each period* (EOD), *New workbook each
  month* (banking). They're a reminder of what will go stale on its own.
- A field you leave matching the built-in link is not saved as an override — the repo
  stays in charge of anything you haven't deliberately changed. **Reset to built-in**
  puts a field back and clears its override on save.
- **Open** checks a link before you commit to it. Worth doing — a wrong URL here breaks
  that tile for all eleven stores at once.
- Without the shared log, a save only changes the device you're on. The page says so
  plainly rather than implying it went out to everyone.
- At the bottom there's a **config block** you can paste over the `modules` section of
  `index.html` to bake the current links in permanently. Useful before a redeploy,
  or if you'd rather not run the shared log at all.

The Work Schedule row is a special case: the schedule renders from data built into the
page, so that link only feeds the "Master sheet" button. Refreshing the schedule itself
still means re-exporting the workbook and replacing the `SCHEDULE` object.

## Keeping links current

Two sources rotate and will go stale on their own:

- **EOD** — the workbook is per-period ("9 26" = Period 9). Period 10 starts **8/31/26**.
- **Banking** — the workbook is per-month ("August 2026"). September starts **9/1/26**.

Swap them on the Admin page when the new workbook is created — that's what it's for.
Nothing else needs to change.

**The schedule** is embedded, not linked — periods 8, 9 and 10 of the 2026 workbook.
When a new period is published, re-export and replace the `SCHEDULE` object. The
"Master sheet" button in the schedule panel opens the live workbook.

## Per-store links

If a module needs a different link per store, use `byStore` instead of `url`:

```js
banking: {
  url: "",
  byStore: { "Waco": "https://…", "Plano": "https://…" }
}
```

A store missing from `byStore` falls back to `url`. For the two workbooks, per-store
tab links need the `#gid=` from each tab's address bar. Google Forms prefill links work
here too, so the store field can fill itself.

## Deploy on Render

1. Push this repo to GitHub.
2. Render → **New** → **Static Site** → connect this repo.
3. Build command: *leave blank*. Publish directory: `site`.
4. Deploy. Add your subdomain (e.g. `ops.wcogs.com`) under Settings → Custom Domains
   and point a CNAME at the Render hostname.

## Roadmap

- v1 — hub, links out to Google (this)
- v2 — opening/closing checklists submit natively to a database
- v3 — banking entry, with the monthly sheet generated instead of hand-kept
- v4 — schedule viewer keyed to the person, not the store (done at store level in v1)
