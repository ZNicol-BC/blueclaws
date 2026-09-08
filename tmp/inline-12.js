var IQ_ASSISTANT_NAME = "Captain";
/* ============================================================================
   index231 — BUILD_NOTES: the single source of truth for what shipped when.
   Add a build here and the front page "What's new" box, the full patch-notes dialog and Captain
   all pick it up. Newest first. Keep entries short and user-facing — what changed for the person
   using the app, not the implementation.
   ========================================================================= */
var BUILD_NOTES = [
  { build: 257, date: "2026-08-08", title: "Full audit pass — data-loss paths closed, contrast fixed, seating chart back", items: [
    "The seating chart is the base artwork again. Build 256 replaced it with a drawn schematic because the photo chart is the app's one green surface; the chart supplied by BlueClaws management is what the map is supposed to be, so it is back by default and the schematic is a toggle beside the zoom controls.",
    "Need to Get Photos went from 470 rows to 347 and now reads as two answers instead of one long list. Out: 118 entitlement lines (gift cards, facility and BECC rentals, suite and party-deck outings, luxury suites, parking, season and group tickets, ballpark usage, catering and F&B credit, friends-and-family packages) and 76 delivered off-site (web ads, e-newsletters, social posts, LinkedIn announcements, email blasts, radio and podcast reads, PA reads). All of it stays in the annual report — none of it is something a camera can close out.",
    "Shared fixtures got their own section, sorted so the biggest win is first. A photo of the Fan Zone, a table display, Buster at an appearance or a season-long program is the same photo no matter whose account it was filed under, so they collapse to one ask that names every partner it closes — 29 duplicate rows gone. And once any photo of a shared fixture exists in the library, under ANY sponsor, the row disappears for everyone.",
    "Lines that name real signage stay on the list: Suite Sign, Luxury Suite Table Top Signage, 1B Party Deck Naming Rights, Ticket Back Advertising, and every in-park screen — the marquee, the display network, rotators and scoreboard takeovers are photographable surfaces even though the word 'digital' is in the name.",
    "Eight ways your data could disappear are closed. The biggest: a server that had never seen a store used to delete that store from every browser at once — a first write is now pushed up instead. Logo pulls no longer drop a logo the server did not mention; a logo saved during startup no longer wipes the rest; one unreadable displays payload can no longer destroy the whole ballpark board; 'Free up space' records what it drops instead of deleting it silently; and a restore now actually replaces sponsors instead of being quietly undone by the next poll.",
    "'Revert edits to original' does something again. Creating a sponsor was writing every field into two stores, and revert only cleared one, so it restored the edited values it was supposed to undo.",
    "A payment schedule no longer multiplies itself by 100. Split a contract into three and the lines carried cents; every money field in the app strips the decimal point, so one keystroke turned $1,166.68 into $116,668.",
    "641 measured contrast failures down to a handful. Most of them were one mistake made three times — using opacity to mean 'inactive'. On this palette no opacity value both reads as dimmed and stays readable, so lapsed sponsor cards, empty language tags and off-month calendar days now dim their chrome and leave the text alone.",
    "Keyboard users can get out of a dialog. Tab used to walk straight out of it onto the page behind, and Escape stopped working the moment it did.",
    "Asset Allocation no longer breaks the Scoreboard, Marquee and E-News boards for the rest of the session by re-using their ids.",
    "An apostrophe in an agreement file name no longer breaks its View button.",
    "The app admits what it does not know. 'Avg Asset Fulfillment' shows an em dash instead of 0% when no statuses have been marked; the Signed-vs-Budget figure says it is a frozen Budget Build snapshot rather than a live number; the Upper Tier tab count and the marquee slot counts are derived; and the self-audit stopped comparing a constant to itself.",
    "Three Digideck filenames were being counted as sponsor accounts — 'Paragon 2.0', 'Gill & Chamas 2.0', and the club itself as its own prospect. Removed, and the seeder now strips version suffixes so new ones cannot appear.",
    "A handoff section was added to the connection map: how to ship a change, where the data really is, and what to check before touching anything.",
    "Design system enforced: two typefaces instead of four (about 92KB of embedded font removed), no green, one gradient device, pill radius back to badges only, and hover timing inside the 100-160ms band."
  ] },
  { build: 253, date: "2026-08-07", title: "Patch-queue sweep, plus the real reason photos bounced off Digideck", items: [
    "Found it: Digideck does not accept WebP — its uploader lists .jpg, .jpeg, .png, .gif, .svg — and this app was exporting .webp files anyway. They saved fine and Digideck silently refused them, which looked like every other failure in this workflow. Anything Digideck won't take is now converted to JPEG on the way out, and the filename matches the bytes that were actually written.",
    "The save instructions named a button that doesn't exist. They said to click “Select or Drop Image File”; the widget actually reads “Browse Your Computer.” Quoted correctly now — that link is the OS picker, and its multi-select is what uploads all of them at once.",
    "Dropdowns inside pop-ups no longer get cut off. On the Tag photo box the asset list opened past the bottom edge with no way to scroll to it — the pop-up was clipping anything that reached beyond its own border. Menus now measure the space around them, open upward when there is more room above, and cap their height so the list always ends on screen and scrolls inside itself. Fixes every dropdown in every pop-up, not just that one.",
    "Rows now hold more than five photos. A sixth used to collapse into a \"+3\" badge — counted but not shown, so it could not be dragged, selected, or saved. Every photo on file gets a real tile now, the row keeps one open slot on the end, and it wraps to a second line instead of squeezing the asset name. Those extra photos were also being left out of the folder saves; they are included now.",
    "Rebuilt how photos leave the app, in one place instead of five. The real blocker: a drag was handing over a download link, which is what Windows and the Mac Finder read — a website upload box reads an actual attached file, and there never was one. Drags now carry a real image file, so Digideck receives it exactly as if it came off your computer. Photos are also resized on the way out to fit a 1920x1080 slide, keeping their proportions and never cropping, so no signage gets cut off and nothing arrives oversized. Format, size, file name and the file itself are now decided by one piece of code that the drag, the row saves and the bulk save all share.",
    "Fixed the last thing stopping the drop: our file names. A photo from a sponsor whose name ends in .com produced something like \"3rdBaseRealEstate.com - 3B Picnic Area Naming Rights.jpg\" — two dots. Digideck reads the file type as everything after the FIRST dot, so it saw \"com - 3B Picnic Area Naming Rights\" instead of \"jpg\" and refused the image while its own panel listed .jpg as supported. That is why dragging through an empty browser tab worked: the browser renamed the file on the way. Names now carry exactly one dot, plain characters only, so they pass on the first try — for dragged photos and for the files written to a folder, which go through the same check.",
    "Every photo in the app is now draggable into Digideck, wherever it appears. Drag support used to be added surface by surface, so the big preview in the Tag photo box — the most obvious thing to grab — was never wired and fell back to a plain browser drag that carries only a link. That is why it worked on a photo you had just added and stopped once that photo synced. One handler now covers every photo image on every screen, including ones added in future, and converts them on the way out.",
    "Found why some drags worked and some didn't: Digideck was answering the dropped file with \"Image must be a JPG, JPEG, PNG, GIF, or SVG.\" The drop was arriving fine — the WebP ones were being refused on format. Dragged photos are now converted to JPEG on the way out, with a matching file name, so the ones that used to bounce go through.",
    "Photos with no asset finally show up. A photo tagged to a sponsor but to no asset matched no row, so it appeared nowhere when you opened that sponsor — while still being counted in the \"14 photos\" on the header, so the count and the rows disagreed. Same for a photo whose asset was renamed out from under it. They now sit in a \"No asset assigned\" row at the bottom of the sponsor, where clicking one opens the tag box, and they are included in the folder saves they were previously being left out of.",
    "Tagging a photo now suggests where it goes. It reads the file name against sponsor and asset names, notices when a sponsor's deal has only one asset it could be, carries over from photos uploaded in the same batch, and follows the one you tagged just before. The suggestion is filled in but labelled with the reason it was made and is not saved until you press Save tags — and when there is no real signal it stays quiet rather than guessing. It does not look at the picture itself; that needs a vision model with a key that cannot live in this file, which is FRAME AI's job.",
    "Fixed the drag that stopped working overnight. A photo holds real image data only until it syncs — after that its stored address is the server path /.netlify/functions/media?id=…, written without a domain in front of it. Dragged into Digideck, that address got read against Digideck's own site instead of ours, so it pointed at nothing and the photo never appeared. Fresh photos worked, synced ones didn't, which is why it looked like it broke on its own. Drags now carry the picture itself whenever possible, and a full web address otherwise — never the bare path.",
    "Same root cause would have broken the new Save buttons on any photo already synced to the server, so saving now reads from the server when it needs to. If a photo genuinely can't be fetched it is skipped and counted in the message rather than quietly missing from the folder.",
    "Dragging a photo into Digideck still cannot be made to work: a drag from one browser tab into another tab's page cannot carry a file, so Digideck's drop area lights up and receives nothing. It used to fail in total silence. Now, when a photo drag leaves the window, the app says so and points at the ⤓ save. It stops after three showings, and for good once you've saved to a folder.",
    "Each sponsor row in the Photo Checklist gained a ⤓ button next to its photo count — one click saves that sponsor's whole set to a folder, instead of expanding the row and pressing ⤓ once per asset line.",
    "And above the list: “Save all N for Digideck” writes every photo currently shown into one folder in a single press — loose image files, never a zip. The count is re-measured on each render and follows whatever you have filtered, so searching one sponsor makes the button offer exactly that sponsor's photos. This is the Media Library load: do it once per batch and all 84 decks can pull from the same library instead of re-uploading per deck.",
    "Fixed a name collision where two different functions were both called renderPhotoSelectBar; the second silently replaced the first, leaving the photo library's selection bar dead and pointed at the wrong element.",
    "Upper Tier boards now enforce what the department actually sells: Doubles (2 panels), 4-Panels and 6-Panels, at most three partners per board. The old tool taught a 1-panel default nobody can buy — an unsized contract now reads \"Size TBD\" and lands on the smallest sellable span instead.",
    "A sponsor can no longer be saved without a name, and saving a new or renamed sponsor under a name already in the book asks first — accidental duplicates were splitting totals, placements and photos across two records.",
    "Hiding a sponsor now deals with their ballpark signage instead of stranding it: choose to release the space (it reads Available again, with a note saying why) or keep it flagged \"Hidden sponsor\" for review.",
    "Refreshing or closing the tab mid-edit now warns you, and whatever you had typed is offered back on the next visit — the drawer keeps a local draft while it's dirty.",
    "Backup grew a Full option that includes photo bytes and contract PDFs, so a snapshot can rebuild a machine that has never talked to the server. The standard backup stays small (manifest only). Restores are additive — they never overwrite what a browser already holds.",
    "The Overview gained the ten Upper Tier boards drawn panel-by-panel from live data, and the Stadium Map's photographic seating chart was redrawn as a flat schematic in club colors — the app's last non-palette surface is gone.",
    "The typefaces now ship inside the file itself: opening a copy from a desktop with no internet shows the real fonts, and the deployed site makes zero font requests. Also: a favicon, screen-reader labels on every search box, and board controls that show on keyboard focus and touch.",
    "The Settings tab-visibility panel now says plainly that hiding a tab hides it for everyone — the old copy claimed it was per-person, which stopped being true in build 236."
  ]},
  { build: 246, date: "2026-08-07", title: "Data-safety hardening + PatchLog (v2026.08.07)", items: [
    "The big one: a fresh browser opening the app used to quietly overwrite teammates' edited sponsor records on the shared server about 40 seconds after load — the boot contacts-migration was broadcasting a whole-record replace for every sponsor before it had even read the server. That broadcast is gone. The migration still fills in contacts locally; it no longer touches the shared book. Your and Zack's and Jim's edits are safe from a new laptop or a cleared browser now.",
    "The shared-data pull is now additive: an empty or half-answered response from the server can never delete a local sponsor edit again. A real deletion from the server is still honoured, but the old value is copied aside first (never destroyed) and written to the issue log.",
    "Opened from a double-clicked or emailed copy (no server), the app no longer floods the console or shows a stuck \"Saving 0 of 96…\" pill — it just works offline and saves to this computer.",
    "New: a hidden issue log. Press Ctrl+Shift+L to see anything the app has quietly recorded — a failed save, a data mismatch, a recovered value — with an Export button to send it along for the next fix. A self-audit compares the numbers on the Overview to the underlying records every time it paints and logs any disagreement here.",
    "Fixes: the top bar no longer pushes the page sideways on a phone or tablet; dark mode is readable on the Sponsor Ledger; and the pace-to-budget figure is now the one big number on the Overview."
  ]},
  { build: 245, date: "2026-08-06", title: "Deploy recovery", items: [
    "The site returned Page Not Found for a while. Nothing was wrong with the app — the repository had no index.html in it, which is the file the web server hands out for the home page, so every address on the site had nothing to answer with.",
    "It happened because index.html was deleted by hand and the job that rebuilds it from the newest numbered file failed twice without anyone being told.",
    "That job now refuses to finish if index.html is missing, and says so on the commit that caused it, instead of letting a silent 404 go live.",
    "It also no longer mistakes a browser-duplicated download such as \"index (1).html\" for version 1, and it clears out the old version stamps instead of piling a new one on top every release — the app had been reporting build 241 while actually running 244."
  ]},
  { build: 244, date: "2026-08-06", title: "Need to get photos, counted not curated", items: [
    "The Need to Get list now shows every sponsor asset on the report checklist with no photo on file. It used to show only what somebody had remembered to tick as needed, so an asset nobody had thought about looked exactly like one that was finished.",
    "Adding a photo removes its row on the spot — there is nothing to un-tick. Clearing one puts it back. The count on the tiles and the rows in the list are the same measurement, so they cannot disagree.",
    "Each row is now one line: the sponsor and the asset, aligned in columns so you read down rather than across. The rep, the report name and \"0/5 photos on file\" came off — the first two repeat the filters above the list and the last one was true of every row.",
    "Anything only up on certain dates is marked: theme nights, weekly promotions, giveaways, per-game table displays and anything with fixed game dates. Permanent signage is left unmarked because it can be shot at any home game.",
    "Tickets, suites, parking and vouchers are marked as having nothing to photograph, and are left out of the headline count.",
    "Where the asset library has no category or frequency on file, the row says so instead of implying the asset is up all season. That is about 30% of them and it points at real gaps in the library."
  ]},
  { build: 243, date: "2026-08-06", title: "The buttons at the bottom of the sidebar", items: [
    "Fixed the five app-tool buttons wrapping onto two lines and becoming unclickable. Two separate faults: the row was hard-set to four columns, and adding the renewals bell made five. It now counts its own buttons, so adding another can never break it again.",
    "The real reason they wouldn't click was a pop-up. Long messages had no width limit, so an error stretched across the whole bottom of the screen and covered them — and hovering it, which you do on the way to those buttons, paused its dismiss timer indefinitely. Messages are now capped in width, wrap properly, and can't be held open forever.",
    "\"The server said no file body\" was wrong. Nothing had been sent to the server — the file had come back empty on this computer. It now says which side actually failed.",
    "Fixed the cause of that error: an agreement whose file came back empty was still recorded as an agreement. The ledger showed a contract, nothing could open it, and every sync retried it forever. Empty files are now refused at the point of upload, with a message saying the likely reason — a OneDrive or iCloud file that is stored online-only rather than on the machine.",
    "Any existing records stuck in that state are now named in the console during a sync sweep instead of failing silently."
  ]},
  { build: 242, date: "2026-08-06", title: "Nothing says it saved unless it did", items: [
    "Went through the whole build-241 audit. The theme running through it was the app telling you something had worked without ever checking: eight of the things it promised never to lose were written inside empty catch blocks, so a full browser quietly did nothing and you still got a green tick.",
    "Sponsor edits, the sync retry queue, the failed-change log, chat messages, daily notes and agreement records now write durably — and if this browser is out of room they say so instead of pretending.",
    "A change the server permanently refuses now speaks up the moment it happens. Until now the only way to find out was to notice the sync badge and click it.",
    "Uploading an agreement no longer promises the file is \"kept safely\" without checking that it is. If neither the server nor this browser took it, it says exactly that and tells you not to close the tab.",
    "Restoring a backup reports what actually restored. It used to say \"Data restored\" even when it had dropped your chat history or request queue on the floor.",
    "Every remaining hard-typed \"2026\" is gone. Current-partner filtering, the season dropdown, the drawer's future-standing tags and the Upper Tier boards all follow the live season now, so next season doesn't start with the app quietly misfiling everyone.",
    "The renewals bell is back in the top bar — the alert logic and its styling had been there the whole time, just with no button to hang off, so an at-risk renewal never surfaced anywhere.",
    "The staffing schedule is now on the Sponsorship Schedule page. It was fully built and already syncing between everyone's browsers, with nothing on screen to show it.",
    "Added: \"Search this logo\" in the sponsor drawer, \"+ Add photos\" on the report checklist, \"Clear uploaded logos\" in the storage panel, and the clause library on the Asset Ledger. All four were finished features missing only the button that opens them.",
    "Cut 27 pop-ups that told you about something you had just watched happen, and fixed seven that claimed a copy, an upload or a notification had gone through without checking. Removed 19 leftover functions nothing called.",
    "The sidebar carries the full-colour club mark."
  ]},
  { build: 241, date: "2026-08-05", title: "Numbers that can't be stale", items: [
    "The sidebar sponsor count was typed into the page as 128 when the real figure is 195 — it now shows nothing until it's counted, then the true number.",
    "Three season badges were hard-typed as 2026 and would have stayed 2026 all through next season. They now read the season the rest of the app runs on.",
    "The sync badge no longer says \"Synced\" when a shared bucket is being rejected — it names the bucket that isn't saving.",
    "Backup / Restore now reports, per bucket, whether the server is accepting saves."
  ]},
  { build: 239, date: "2026-08-05", title: "Finding out why shared saves fail", items: [
    "Backup / Restore now checks each shared bucket directly and tells you which ones are accepting saves and which are being rejected.",
    "If a bucket is rejected, no amount of retrying will help — it has to be added to VALID_BUCKETS in the site's sync function. The panel now says so plainly instead of leaving people to guess.",
    "This turns \"it sometimes doesn't save for everyone\" into a specific, fixable answer."
  ]},
  { build: 238, date: "2026-08-05", title: "Agreement uploads retry themselves", items: [
    "Fixed \"Server upload failed\" on agreement PDFs. Uploads had no retry at all — one blip, cold start or slow chunk marked the file failed permanently, with no reason shown and nothing scheduled to try again.",
    "Each upload now retries three times on a backoff, and on a large multi-part PDF a failed chunk retries on its own instead of abandoning the whole file part-written.",
    "The message now tells you what the server actually said, and that the file is safe — it's stored on your computer and uploads itself. No need to re-add it.",
    "Agreements are now swept up the same way photos are: anything on your machine the server doesn't have is uploaded automatically on load and on reconnect."
  ]},
  { build: 237, date: "2026-08-05", title: "Gathering up stranded photos", items: [
    "Every browser now checks, shortly after opening, whether it's holding photos the shared library never received — and uploads them. Photos stuck on one person's laptop from the earlier sync faults will collect themselves as each person opens the app.",
    "It only ever adds. It never deletes, skips anything the server already has, and won't re-upload something a teammate deliberately removed.",
    "There's a manual \"Upload my stranded photos\" button in Backup / Restore for anyone who knows they added photos while offline.",
    "It also runs again whenever a machine comes back online, which is when a backlog is most likely."
  ]},
  { build: 236, date: "2026-08-05", title: "Photo sync warnings and shared tab visibility", items: [
    "Fixed the false \"saved on this computer, but shared sync did not finish\" warning. Uploads were being judged after a single flush, so photos still queued — which is normal when several go up at once — were reported as failures even though they synced fine moments later.",
    "Hiding a tab now saves for the whole team and follows you between browsers, instead of only applying on the machine you set it on.",
    "Mid-Season Report Assets is hidden by default. Un-tick it in Settings if it's ever needed again.",
    "A teammate hiding or showing a tab now reaches your nav on the next sync, without a reload."
  ]},
  { build: 235, date: "2026-08-05", title: "Storage, photos and the front page", items: [
    "Fixed photos disappearing and coming back — a sync pull could wipe local photos when the server returned an empty or partial read. Pulls can no longer delete anything the server didn't explicitly mark deleted.",
    "The storage bar now measures the real shared store bucket by bucket — agreements, photos, logos, ballpark displays, sponsor edits — and updates itself whenever anything is saved.",
    "Patch notes lead the front page, with Needs attention and Recently updated beneath, and Daily Notes as a shared sticky note anyone can edit.",
    "Activity history now says who made each change, which fields changed, and links to the page that owns them.",
    "Multi-date assets, the expanded gameday allocation board, and a hideable sync badge."
  ]},
  { build: 231, date: "2026-08-05", title: "Captain, the sidebar, and patch notes", items: [
    "Captain replaces the old assistant — ask him questions about the book in plain English and he answers off the live records.",
    "Sidebar rebuilt: Jersey Shore mark now sits beside the app name, the four app buttons moved to the foot of the nav, and Favourite Actions shrank to the bottom.",
    "Settings now lists every page and sub-tab in the workspace so you can hide the ones this team doesn't use.",
    "Edits now record who made them, so Recently Updated and Activity History can name the person.",
    "This box — patch notes for every build."
  ]},
  { build: 230, date: "2026-08-05", title: "Tab visibility and control swap", items: [
    "Show and hide any tab from Settings, grouped by workspace.",
    "Tasks-to-complete moved up to the top bar; the four utility buttons moved out of it.",
    "Sidebar header aligned — everything now starts on the same edge.",
    "Confirmed the Signed vs. Budget figure was always correct; the earlier warning was a measurement error on our side."
  ]},
  { build: 227, date: "2026-08-05", title: "Fit and craft pass", items: [
    "Fixed text overlapping and content being cut off across the app, found by measuring every page at both screen sizes.",
    "The app now uses the full width of a 16-inch screen instead of leaving empty margins.",
    "Site map now builds itself from the live navigation, and lists pages that aren't in the nav.",
    "Activity history refreshes on its own instead of going stale while open."
  ]},
  { build: 226, date: "2026-08-05", title: "Allocation fix and pace to budget", items: [
    "Dragging a partner onto a ballpark slot no longer adds that sign to their asset list — placement and contracted assets are separate again.",
    "Schedule strip cut from two weeks to one: two days back, today, four ahead.",
    "New pace-to-budget panel showing how much is left to close."
  ]}
];

