# Focus Hours

A Chrome extension that blocks distracting sites on a schedule. By default it blocks Reddit and YouTube from 10:00 to 16:00, Monday to Friday. You can change the sites, days, hours and message.

![Block page](docs/screenshots/blocked-1280-light.png)

## Features

- **Scheduled blocking.** One weekly schedule (days plus a start and end time, in local time) applies to every site on your list. A site also covers its subdomains, so `reddit.com` blocks `old.reddit.com` too.
- **Open tabs are caught.** When a block starts, tabs already on a blocked site switch to the block page, which shows the title and address of the page you were on. When the block ends, those tabs go back to that page (reloaded).
- **A block page with some attitude.** It shows a random snarky headline, your own message, a count of how many times you've tried the site today, and a productivity quote.
- **A slow escape hatch.** The unblock button counts down 10 seconds before it can be clicked. The countdown only runs while the tab is visible. Unblocking lifts the block on that one site for 10 minutes, then it comes back.
- **Light and dark themes** that follow your system setting.

| Block page (dark) | Settings |
|---|---|
| ![Block page in dark mode](docs/screenshots/blocked-1280-dark.png) | ![Settings page](docs/screenshots/options-1280-light.png) |

## Install

Focus Hours isn't on the Chrome Web Store. Load it unpacked:

1. Clone or download this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
4. Click the Focus Hours toolbar icon to open the settings.

Requires Chrome 101 or later (or another Chromium browser with Manifest V3 support).

## Usage

On the settings page you can:

- **Add or remove sites.** Paste a full URL or just the domain. `https://www.Reddit.com/r/foo` becomes `reddit.com`.
- **Set the schedule:** which days, plus a start and end time. The window can't cross midnight.
- **Edit the block page message,** or reset it to the default.

Changes take effect immediately, with no reload needed.

## Privacy

- Your settings, unblock timers and daily attempt counts are stored locally in `chrome.storage.local`. Nothing is synced or sent anywhere.
- To show a quote, the block page requests a random quote from [ZenQuotes](https://zenquotes.io/) each time it loads. ZenQuotes sees an ordinary request from your browser but not which site was blocked. If the request fails or takes longer than 1.5 seconds, a bundled quote is shown instead.
- No analytics, no tracking, and no other network requests.

### Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Redirect blocked sites to the block page before they load |
| `tabs` | Find open tabs on a blocked site when a block starts, and restore them when it ends |
| `alarms` | Wake up exactly when the schedule starts or ends, or an unblock expires |
| `storage` | Save your settings |
| Host access to all sites | Needed to redirect any site you choose to block, and to fetch the quote |

## How it works

Everything runs through one function in the service worker, `sync()`. It runs whenever settings change, an alarm fires, or the browser starts. Each run it:

1. works out which sites should be blocked right now (schedule minus active unblocks),
2. replaces the `declarativeNetRequest` redirect rules to match,
3. sends open tabs on blocked sites to the block page, and returns tabs whose site is no longer blocked,
4. sets a single alarm for the next moment anything can change.

Each run is recomputed from storage and the current time, so a missed alarm (for example, while the computer was asleep) sorts itself out on the next run.

```
src/
  schedule.js      when blocking is active, and the next time that changes
  domains.js       domain cleanup and subdomain matching
  enforcement.js   what to block, which rules to write, which tabs to move
  blockedUrl.js    the block page URL format
  attempts.js      daily per-site attempt counter
  content.js       headlines and fallback quotes
  quote.js         ZenQuotes fetch with timeout and fallback
  storage.js       settings, unblocks and attempts in chrome.storage.local
  background.js    service worker: wires the above to Chrome APIs
  blocked/         block page
  options/         settings page
```

## Development

There's no build step and no dependencies. The logic modules are plain ES modules with unit tests using Node's built-in test runner (Node 20+):

```sh
npm test
```

To try the extension, load it unpacked (see [Install](#install)). After changing code, click the reload icon on the extension's card in `chrome://extensions`.

To test a block without waiting for 10 AM, set the schedule to start a minute from now.

## Limitations

- One schedule for all sites. Per-site schedules aren't supported.
- Sites that change pages without a full reload (YouTube, Reddit) are only caught on a full page load, or at the moment a block starts.
- Restored tabs reload their page, so the video position, scroll position and any form input are lost.

## License

[MIT](LICENSE)
