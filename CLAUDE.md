> Added in November 2026, after the initial build (September–October 2026), to guide coding agents working in this repo. It was not part of the original design process.

# Focus Hours

A Manifest V3 Chrome extension that blocks distracting sites on a weekly schedule. It redirects blocked sites to a block page, lets links from search results through (scoped to one section of the site), offers a slow 10-minute unblock, and charts attempts on the settings page. No build step, no runtime or dev dependencies.

## Commands

```sh
npm test          # node --test, Node 20+; runs everything in tests/
```

To run it in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → select the repo root (the folder with `manifest.json`). After changing code, click the reload icon on the extension's card. To test a block without waiting, set the schedule to start a minute from now.

Reloading the extension closes every tab showing the block page; that's Chrome, not a bug (see "Lost pages" below).

## Module map

Logic lives in plain ES modules that don't touch `chrome.*`, so Node can test them directly. Only `background.js`, `storage.js` and the page scripts (`blocked.js`, `options.js`) call Chrome APIs; `quote.js` makes the one network request, with an injectable fetch for tests.

```
src/
  schedule.js      when blocking is active, and the next time that changes
  domains.js       domain cleanup, subdomain matching, never-blocked hosts
  enforcement.js   what to block, which DNR rules to write, which tabs to move
  blockedUrl.js    the block page URL format
  history.js       day-by-day attempts and unblocks, and stats drawn from them
  searchPass.js    default search sources, and the section a search-opened page covers
  lostPages.js     pages left behind when Chrome closes a blocked tab
  content.js       headlines and fallback quotes
  quote.js         ZenQuotes fetch with timeout and fallback
  storage.js       settings, unblocks, passes, history in chrome.storage.local
  background.js    service worker: wires the above to Chrome APIs
  blocked/         block page
  options/         settings page, including the attempts chart (chart.js is pure)
tests/             one *.test.js per pure module
```

When adding behaviour, put the decision in a pure module with a test, and keep `background.js` to wiring.

## The sync() design

`background.js` has one entry point for state: `sync()`. It runs on install, browser startup, every alarm, and any change to `settings` or `unblocks` in storage. Each run recomputes everything from storage and the current time:

1. drop expired unblocks; compute the blocked set (schedule minus active unblocks),
2. revoke every search pass,
3. replace all dynamic `declarativeNetRequest` rules (redirects + search allow rules),
4. sweep open tabs: blocked ones go to the block page, freed ones go back to their page,
5. arm a single `sync` alarm for the next moment anything can change. This happens in a `finally`, so a failed run still re-arms.

Because each run is computed from scratch, a missed alarm (machine asleep) fixes itself on the next run. Don't add incremental state that a run depends on.

All syncs and navigation handlers go through `enqueue()`, a single promise chain, so they never interleave. Keep new handlers on that queue. Writes to shared storage records (blocked tabs, history) also go through the worker for the same reason: the block page sends a message rather than writing history itself.

## Search-pass rules

DNR rule priorities, lowest to highest:

- **1**: redirect a blocked domain to the block page (dynamic rule). Hosts in `NEVER_BLOCKED_HOSTS` (`accounts.youtube.com`, used by Google sign-in) are excluded.
- **2**: allow a page load whose initiator is a search source, for sites with "from search" on (dynamic rule). The blocked site is excluded as its own initiator, so a link on a passed page can't hand out a fresh pass.
- **3**: per-tab pass rule (session rule, id `1_000_000 + tabId`) allowing loads inside the granted section.

A pass's scope comes from `sectionScope(url)`: the first two path segments (`/r/programming`), or the exact page plus non-volatile query params when there's no section (`/watch?v=abc`). Exact-page scopes get no DNR rule, so a reload blocks again (documented limitation).

Enforcement in the worker:

- `webNavigation.onCommitted`: a page on a blocked site either holds a pass for its scope, or gets one if the site allows search passes and the load is fresh (top frame, active, not back/forward, not typed in the address bar), or is blocked. Anything that never met the DNR rules (restored from history, reopened at startup) is caught here.
- `webNavigation.onHistoryStateUpdated`: single-page sites (Reddit, YouTube) change URL without a page load, so the scope is checked here and the tab is blocked the moment it leaves the section.
- A pass ends when the tab leaves the section, closes, or `sync()` runs for any reason (settings change, window start or end).

## Lost pages

Chrome closes every tab showing an extension page when the extension reloads or updates. Each blocked tab is therefore recorded in storage. Records are matched back to tabs by the page they hold, not the tab id, which Chrome reuses. Once per extension session (not per worker restart), records with no tab become lost pages: the toolbar badge shows the count and the settings page offers to reopen them.

## Conventions

- Plain ES modules, no dependencies, no build step. Don't add any without asking.
- Tests use `node:test` and `node:assert/strict`. Every pure module has a test file; run `npm test` before committing.
- Commit subjects use a conventional prefix (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`, `ci:`) with a body explaining why. No AI attribution trailers in commits.
- Comments explain why, not what. User-facing copy is plain and a little dry.
- Keep the README's Features, Permissions and "How it works" sections in step with behaviour changes, and add a CHANGELOG.md entry when the version in `manifest.json` changes (keep `package.json` in step).
- Don't commit machine-local agent files (`.claude/`, `settings.local.json`, `.superpowers/`).
