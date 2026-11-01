# Energy history files

The history dialog (day / week / month / year, like a battery maker's app) reads plain JSON files from a folder
you set as **Folder with history files** in the Energy tab. CleanDash only reads; a script of yours writes them.
The folder must allow cross-origin `GET` (header `Access-Control-Allow-Origin`), because the dashboard is served
by the web adapter on another port.

- `index.json`: `{ "tag": ["2026-10-01", …], "woche": ["2026-09-28", …], "monat": ["2026-10", …], "jahr": ["2026"], "stand": "<ISO time>" }`
  (the keys that exist, oldest first; a week is named by its Monday)
- `<tag|woche|monat|jahr>/<key>.json`: one period, see `EnergieZeitraum` in `src-www/lib/energyHistory.ts`:
  `einheit` is `"W"` for a day (mean power per 20 minutes) and `"kWh"` otherwise, `punkte` the labels, and for
  `haus`, `solar`, `akku`, `netz` the values plus where the energy came from and went to.
