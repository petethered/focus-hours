# Changelog

## 0.5.0 - 2026-11-17

The first tagged release. It covers everything built so far (September to October 2026).

### Blocking

- One weekly schedule (days plus a start and end time, local time) applies to every site on the list. The defaults block Reddit and YouTube from 10:00 to 16:00, Monday to Friday.
- A site covers its subdomains, and pasted URLs are cleaned down to a domain.
- `declarativeNetRequest` redirect rules send blocked sites to the block page before they load.
- When a block starts, open tabs on blocked sites switch to the block page. When it ends, they go back to the page they were on.
- A single alarm wakes the service worker at the next change. Each run is recomputed from storage, so a missed alarm (computer asleep) sorts itself out.
- Google sign-in bounces through `accounts.youtube.com`, so that host is never blocked, even when YouTube is.

### Block page

- It shows a snarky headline, your own message, today's attempt count for the site, and a quote from ZenQuotes. A bundled quote is used if the request fails or takes longer than 1.5 seconds.
- An unblock button counts down 10 seconds while the tab is visible, then lifts the block on that site for 10 minutes.

### Search passes

- Each site has a "from search" option. A link opened from a search engine loads, and the tab gets a pass for the section it landed in: the first two path segments, or the exact page when there are none.
- Reloads and links inside the section keep working. Single-page navigations on sites like Reddit and YouTube are checked against the same section.
- Pages restored from history or reopened at startup are blocked unless they hold a pass.
- The search sources are editable in settings, with add, remove and reset. Hacker News is one of the defaults.

### Stats

- Attempts and unblocks are kept per day for 90 days.
- The settings page charts the last 14 days as stacked bars split by site, with a hover readout, a table view, and tiles for today, the most-reached site, unblocks, and the busiest and quietest days.

### Lost pages

- Chrome closes every extension page when the extension reloads or updates. Blocked tabs are therefore recorded in storage. The toolbar badge counts the pages that were lost, and the settings page offers to reopen them.

### Settings and look

- The settings page manages sites, the schedule, search sources and the block message. Changes take effect immediately.
- Light and dark themes follow the system setting. On wide screens the stats sit beside the settings.
