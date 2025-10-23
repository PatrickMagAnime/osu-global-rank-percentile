# osu! Rank Percentile & Playerbase Estimator

A tiny, local-only browser extension that:
- Reads medal tooltips like “X players (Y%)” on osu! pages.
- Estimates the total playerbase per ruleset from those tooltips (Total ≈ X / (Y/100)).
- Shows your “Top X% worldwide” right next to your Global Ranking on your profile.
- Stores everything locally (no API calls, no external requests).

Works on: Chrome, Microsoft Edge, Opera, Opera GX (Manifest V3) and Firefox/Zen (WebExtension MV3).

---

## Quick start

1) Download this folder (must include `manifest.json` and the `content/` files).
2) Install the extension in your browser (see per‑browser instructions below).
3) Open any osu! page where medal tooltips appear and hover a medal so you see a tooltip like “1,234,567 players (12.34%)”.
4) Go to your profile page. Next to “Global Ranking #…”, you’ll see “Top X% worldwide”. Hover it to see the estimated total and sample count.

---

## Install per browser

### Google Chrome
- Open `chrome://extensions`
- Enable “Developer mode”
- Click “Load unpacked”
- Select the folder containing `manifest.json`
- Ensure site access/permissions allow https://osu.ppy.sh

### Microsoft Edge
- Open `edge://extensions`
- Toggle “Developer mode”
- Click “Load unpacked”
- Select the folder with `manifest.json`
- Ensure site access/permissions allow https://osu.ppy.sh

### Opera and Opera GX
- Open `opera://extensions` (Opera GX: the same)
- Enable “Developer mode”
- Click “Load unpacked”
- Select the folder with `manifest.json`
- Ensure site access/permissions allow https://osu.ppy.sh

### Firefox (and Zen Browser)
Temporary (quick test; disappears after restart):
- Open `about:debugging#/runtime/this-firefox`
- Click “Load Temporary Add-on…”
- Select the `manifest.json` in the folder

Permanent (signed XPI):
- Zip the extension files (place `manifest.json` at ZIP root)
- Upload as “Unlisted” to [addons.mozilla.org](https://addons.mozilla.org) to get a signed `.xpi`
- Install via `about:addons` → gear menu → “Install Add-on From File…”

Zen Browser follows the Firefox steps above.

---

## Configuration

- Decimal places for “Top X%”: open `content/shared.js` and set:
+ this will be more user friendly in later versions
```js
  const PERCENT_DECIMALS = 2; // change to 3, 4, ...
  ```
- Data storage: estimates are kept in `storage.local` under key `osu_estimates_v1` per ruleset (osu/taiko/fruits/mania).

Reset data (optional):
- Chrome/Edge/Opera console:
  ```js
  chrome.storage.local.remove('osu_estimates_v1')
  ```
- Firefox/Zen console:
  ```js
  await browser.storage.local.remove('osu_estimates_v1')
  ```

---

## How it works (short)

- The extension watches for medal tooltips containing “X players (Y%)”.
- Each sighting yields a sample Total ≈ X / (Y/100).
- It keeps a weighted average (weight = X) to reduce rounding noise.
- On your profile, it computes percentile = rank / estimatedTotal × 100 and shows “Top X% worldwide”.

No network requests. Everything is computed client-side and stored locally.

---

## Troubleshooting

- Stuck at “Estimating playerbase…”:
  - Hover at least one medal to reveal a tooltip with “players (percent)”.
  - Refresh your profile after that.
  - Make sure the extension is enabled and allowed on https://osu.ppy.sh
- Check if samples were captured:
  - Chrome/Edge/Opera DevTools Console:
    ```js
    chrome.storage.local.get('osu_estimates_v1', console.log)
    ```
  - Firefox/Zen DevTools Console:
    ```js
    await browser.storage.local.get('osu_estimates_v1')
    ```
  You should see totals and sample counts per ruleset.

---

## Notes and limitations

- The estimated total depends on what osu! displays in medal tooltips; mixing different medal types or modes may vary the number.
- The extension uses a best-available estimate per ruleset and updates as more tooltips are seen.
- No user data leaves your browser.

---
Folder structure (reference)
```
/your-folder
  manifest.json
  /content
    shared.js
    medalCollector.js
    rankPercentile.js
```
