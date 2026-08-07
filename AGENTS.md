# AGENTS.md — rules for any AI assistant editing this project

**Read this first, every time, before changing anything.** It works the same
whether you're ChatGPT, Claude, or any other coding assistant. These are the
guardrails that keep BlueClaws IQ working. Follow them and you can't do much harm;
ignore them and you'll break things that are annoying to fix.

---

## What this project is (in one breath)

BlueClaws IQ is a sponsorship-management web app for the Jersey Shore BlueClaws.
The **entire front-end is ONE file: `BlueClawsIQ.html`** (all HTML, CSS, and JavaScript
inlined together). The **back-end is three small Netlify Functions** in
`netlify/functions/` that save data on the server. It's hosted on Netlify and the
code lives on GitHub. That's the whole system.

---

## The golden rules (do not break these)

0. **`BlueClawsIQ.html` is the app's name now; `index.html` is a backup, not a
   second app.** Static hosting (Netlify included) resolves the bare site URL
   to `index.html`, so it has to keep existing and keep matching
   `BlueClawsIQ.html` byte-for-byte — `promoteindex.sh` keeps them in sync
   automatically on every deploy. Never edit them separately by hand; there is
   only ever one real version of the file, under two names.

1. **`BlueClawsIQ.html` stays a single self-contained file.** Do NOT split the
   CSS or JavaScript into separate files, and do NOT add relative links to
   other local files for the app's own code. It has broken in hosting every
   time someone tried. One file. Everything inlined.

2. **All real data saves to the SERVER, never the browser.** Sponsor edits, logos,
   photos, board displays, and contracts must go to the Netlify Functions
   (`/.netlify/functions/data`, `/media`, `/contracts`). The browser may only keep
   small *local UI settings* (like which tab is open). It must NOT be the home for
   real data. If you see data being saved only to `localStorage` or `IndexedDB`,
   that's a bug to fix, not a pattern to copy.

3. **Don't merge the four data buckets.** `data.js` keeps sponsor edits, logos,
   photos, and displays in separate buckets on purpose — merging them made the app
   slow and caused timeout ("502") errors before. Keep them separate.

4. **Images are embedded as base64 directly inside `BlueClawsIQ.html`, not
   loaded from files.** Logos, branding photos, and board art live in
   constants like `LOGO_SEED` and `BOARD_ART_SEED` inside the file itself —
   there's no `assets/` folder to keep paths in sync with.

5. **A new front-end build is any `.html` file that isn't `BlueClawsIQ.html`
   or `index.html`, and it always wins.** When you produce a new version of
   the front-end, save it under any other name (e.g. `index193.html`,
   `newbuild.html`). Only have **one** such file in the repo root at a time —
   pushing it to GitHub automatically promotes it to `BlueClawsIQ.html`,
   mirrors it to `index.html`, and deletes the upload (see README → "How
   deploying works").

---

## How to make a change safely

1. Make your edit (usually inside `BlueClawsIQ.html`).
2. Save it as the next numbered file (`indexNN.html`).
3. Upload it to the GitHub repo (drag-and-drop in the GitHub website is fine).
4. Wait ~2 minutes for Netlify to rebuild.
5. **Test:** open the live site, make a small change to a sponsor, then open the
   site on a phone or another browser — if the change shows up there, server
   saving works. That round-trip is the real proof it's fine.

If a Netlify build ever fails, Netlify keeps the last good version live — so the
site won't go down. Read the red error, fix the named file, push again.

---

## Design basics (so new UI matches)

- **Colors:** navy `#0d1d41`, blue `#0971ce`, gold `#facd01`, red `#c20f2f`, on a
  warm paper background `#f5f3ee` (never pure white). **No green.**
- **Fonts:** Manrope (bold, for titles and big numbers), DM Sans (everything else).
- **Style:** flat — borders, not drop shadows. Cards have small rounded corners
  (about 4–6px) and a colored top border. Full pill shapes only for little status
  badges.

Keep new pieces looking like the existing ones. Copy the style of a nearby card
rather than inventing a new look.

---

## Things that look like bugs but aren't

- A few bits of JavaScript reference on-screen elements that don't exist
  (leftovers from features never built). They're all safely guarded and never
  cause errors. Don't invent new UI to "fix" them.
- The app falls back to browser storage silently if the server is unreachable.
  That's an intentional safety net (though the goal is server-first — see rule 2).
