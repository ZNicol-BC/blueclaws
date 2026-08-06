# BlueClaws IQ

A sponsorship-management web app for the Jersey Shore BlueClaws partnerships team.
It tracks sponsors, their agreements and values, logos, photos, ballpark signage,
contracts, and fulfillment — all in one place, shared live across everyone's
browsers.

- **Live site:** https://blueclaws26.netlify.app
- **Hosting:** Netlify (auto-deploys from this GitHub repo)
- **If you're an AI assistant (ChatGPT/Claude) about to edit this, read
  [`AGENTS.md`](AGENTS.md) first.**

---

## The 30-second mental model

There are really only two moving parts:

1. **The app itself is ONE file: `index.html`.** All the screens, styling, and
   logic are inside it. Open it, and you're looking at the whole front-end.
2. **The saving/syncing is done by three small server files** in
   `netlify/functions/`. They store data on the server so every browser sees the
   same thing.

Everything else in the repo is images, settings, and a small deploy helper.

---

## What every file and folder is

| File / folder | What it is |
|---|---|
| `index.html` | **The entire app.** HTML + CSS + JavaScript, all in one file. This is what you edit to change how the app looks or works. |
| `netlify/functions/data.js` | Server: saves small text data (sponsor edits, and info about logos/photos/displays). |
| `netlify/functions/media.js` | Server: saves the actual image files (photo & logo bytes). |
| `netlify/functions/contracts.mjs` | Server: saves sponsor contract PDFs. |
| `netlify.toml` | Netlify's settings (how to build and serve the site). |
| `package.json` | Lists the one code library the server functions need. |
| `promoteindex.sh` | The deploy helper — turns whatever new `.html` file you uploaded into the live `index.html` (see below). Runs automatically as part of the Netlify build (`netlify.toml`); `.github/workflows/promoteindex.yml` is a backup that runs the same script via GitHub Actions, but GitHub's hosted runners haven't been able to pick up jobs for this repo, so Netlify is what actually does the promotion right now. |

Logos, branding photos, and board art are embedded directly as base64 inside `index.html` (see `LOGO_SEED`, `BOARD_ART_SEED`, and the branding constants near the bottom of the file) — there's no separate `assets/` folder to keep in sync.

---

## Where the data is stored

**On the server, not in your browser.** The three functions save everything into
**Netlify Blobs** (Netlify's built-in storage — there's no separate database to
manage). Because it's on the server, when one person edits a sponsor, everyone
else's browser picks it up within a few seconds.

The data is split into a few "buckets" on purpose (sponsor edits, logos, photos,
displays, contracts) so each stays small and fast. **Don't combine them** — keeping
them separate is what prevents slow-downs.

**Three settings must exist on the Netlify site** (Site configuration →
Environment variables):

- `BLOBS_SITE_ID`
- `BLOBS_TOKEN`
- `BCIQ_SHARED_PASSWORD` — the one passphrase everyone types into the login gate
  on first visit to a browser (see "Who can get in" below). Not hardcoded
  anywhere in the code on purpose — change it here and every browser will be
  prompted again next time its stored copy fails to verify.

These are already set on the live site. If saving ever stops working after moving
the site, check these first.

---

## Who can get in

The app is gated behind a single shared passphrase (`BCIQ_SHARED_PASSWORD` above),
not individual logins — whoever knows the passphrase gets full access, same as
everyone else. A browser only needs to enter it once; it's remembered after that
until the browser's storage is cleared or the passphrase is changed on Netlify.

This app previously used Netlify Identity (real per-person login) for a few hours,
but the ballpark's own wifi silently blocks `identity.netlify.com`, which that
widget's login modal depends on — so nobody on-site could actually log in. If you
ever want real per-person accounts again, that network restriction is the first
thing to solve (e.g. asking whoever manages ballpark wifi to allow that domain).

---

## How deploying works (upload a new HTML file)

You never hand-edit the live `index.html` directly. Instead:

1. You make a new version of the app and save it as an HTML file with **any
   name other than `index.html`** — e.g. `index193.html`, `newbuild.html`,
   whatever your tool happens to save it as.
2. You upload that one file to GitHub (drag-and-drop on the GitHub website is
   fine). Only upload **one** new HTML file at a time — the promotion always
   treats whichever one is on disk as the newest.
3. Netlify's build step automatically **promotes that file** to become the
   live `index.html`, deletes the upload, and redeploys the site.

So the rule is simply: **the new file you just uploaded is what goes live.**
That's what `promoteindex.sh` and the workflow file handle for you.

---

## Making common changes

- **Change how the app looks or works:** edit `index.html`, save it under a
  different name (anything but `index.html`), upload it. Wait ~2 minutes,
  then check the live site.
- **Add or change an image:** convert it to base64 and add it to the matching
  seed constant in `index.html` (`LOGO_SEED`, `BOARD_ART_SEED`, etc.).
- **Add a brand-new kind of saved data:** add its name to the `VALID_BUCKETS` list
  in `data.js` (that's the only server change needed), then have the app save to
  that bucket.

After any change, **test the round-trip:** edit a sponsor on the live site, then
open it on your phone — if the edit shows up, saving is healthy.

---

## Troubleshooting

- **A Netlify build failed (red errors).** Good news: Netlify keeps the last
  working version live, so the site doesn't go down. Read the error — it names the
  file and line — fix it, and upload again.
- **Edits aren't syncing between browsers.** Confirm you're testing the *live*
  Netlify site, not a downloaded copy of the file. Then check the two environment
  variables above still exist.
- **Something looks broken only on certain screen sizes.** It's usually a layout/
  CSS issue in `index.html`, not a data problem.

---

## Want to understand it faster?

Paste `AGENTS.md` (and this README) into ChatGPT or Claude along with `index.html`
and ask "explain what this file does and how to change X safely." The rules file is
written specifically so an AI assistant gives you safe answers.
