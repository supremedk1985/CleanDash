<img src="admin/cleandash.svg" width="64" alt="CleanDash logo">

# CleanDash for ioBroker

**A clean, ready-made dashboard for wall tablets.** Pick your datapoints in the ioBroker admin, open the page on a
tablet, done. No widgets to draw, no CSS to write: CleanDash looks tidy out of the box, in light and dark.

> **Status: early version (0.4.0).** All tiles below work; not yet in the ioBroker repository. Feedback welcome.

![CleanDash on a tablet (demo house, made-up values)](docs/screenshot-dark.png)

## What it does

Every tile appears only when it is set up in the instance settings. Nothing about your house is written into the code:
devices, instances and addresses all come from the settings.

| Tile | Source | What you see and can do |
|---|---|---|
| **Rooms by floor** | any datapoints | Temperature, setpoint, humidity, heating, window, shutters, the room's lights with one switch. Tap a room for every lamp with dimmer, shutters with slider, setpoint in 0.5 ° steps. Lamps made of several devices switch together |
| **Energy** | any datapoints | Solar, battery, house, grid as rings in traffic-light colours, today's totals, money saved. Optional history (day/week/month/year) from files, see [docs/energy-history.md](docs/energy-history.md) |
| **Weather** | openweathermap adapter (+ optional Open-Meteo) | Today, tomorrow, the day after, a rain and temperature timeline per hour, details for the week |
| **Waste collection** | trashschedule adapter | The next two bins in the colours set up there |
| **Dishwasher** | homeconnect adapter | Time left, end time, progress |
| **Shopping lists** | bring adapter | Tap an item to take it off, add items with suggestions |
| **Robot mower** | navimow adapter | Map with dock and live position, start, pause, resume, send home |
| **Robot vacuum** | roborock adapter | State, battery, area, station (water tanks, dust bag, filter), start and dock |
| **3D printer** | octoprint adapter | Progress, time left, temperatures, optional webcam picture |
| **Fuel prices** | tankerkoenig adapter | Your stations, cheapest first |
| **Dehumidifier** | sonoff adapter (Tasmota plug) | On/off, power, energy today |
| **Call button** | any boolean datapoint | One big button that sets it to `true` (for example a doorbell for the kids' rooms) |
| **Documents in the inbox** | any number datapoint | The count, for example from a Paperless script |
| **Internet speed** | JSON file | Download, upload, ping from a measuring script of your own (fields `wann`, `runter`, `hoch`, `ping`) |
| **Second robot via script** | a folder with `hinweis`, `akku`, `lebenszeichen` | For robots the adapter cannot read: a script writes the state, CleanDash shows the reminder |
| **MachIchGleich, Fundus** | own servers (address) | Tasks and the parts box of two self-hosted companion apps by the author; useful only if you run them, otherwise leave empty |

**Notices** that need attention lie over the page on the left; the tiles do not move. Each can be snoozed for five
minutes, and those that are a task can be marked done (it comes back next time the cause appears):
bin day today or tomorrow, a window open while the heating runs, the dishwasher finished, paused or with an error,
the mower stuck or lifted, the vacuum station needing water, emptying or a filter.

**Arrange the tiles per device:** in the tile *Info & diagnostics*, *Start move mode*. Drag a tile by its handle to
another place or column, or hide it with the eye; *Done* saves the order in this browser, so the kitchen tablet and a
phone can each have their own. *Reset* brings back the default order.

Also: **asks before switching** (always or only for several devices at once), **light and dark** by sunrise and
sunset at the location from the ioBroker system settings, **English and German** for rooms, energy, weather and
waste (the other tiles are German for now), and **your login, your rights**: the page connects through the ioBroker
web adapter, so its authentication and user permissions apply. No cloud, nothing leaves your network except the
optional Open-Meteo forecast.

## Installation

Until CleanDash is in the ioBroker repository, install it from GitHub: in the admin, *Adapters* → the GitHub icon →
*Custom* → `https://github.com/supremedk1985/CleanDash`. Then add an instance.

Requirements: ioBroker with js-controller 6 or newer, admin 7, and the **web** adapter.

## Setup

Open the instance settings:

| Tab | One row per … | Notes |
|---|---|---|
| **General** | – | Title, when to ask before switching, light/dark |
| **Rooms** | room | Name, floor, and any of: temperature, setpoint, humidity, heating (valve or on/off), window. Leave out what the room does not have. Window value: contact (`true` = open), handle (`0` closed, `1` tilted, `2` open) or text (`OPEN`, `TILTED`, `CLOSED`) |
| **Lights** | device | Name, room, on/off datapoint, optionally brightness (with its maximum, for example `255` for WLED) and reachable. Rows with the same name and room become one lamp. A room that is not in the room list shows the lamp under *More lights* |
| **Shutters** | shutter | Room, name, position datapoint, value range and whether the highest value or 0 means fully closed |
| **Weather, waste, dishwasher** | – | The openweathermap and trashschedule instance, the Home Connect device |
| **Energy** | – | Any of: solar, consumption, grid import and export (W), battery level (%), charging and discharging (W), today's kWh |
| **Shopping lists** | Bring! list | Name and the list's `content` datapoint |
| **More tiles** | – | Pick the device or instance for mower, vacuum, printer, fuel, dehumidifier, call button, inbox count, speed test. Leave a field empty and the tile stays away |

Then open `http://<ioBroker>:<web port>/cleandash/index.html` (port of the web adapter, 8082 by default) (the link is also on the instance in the admin). A second
instance is opened with `?instance=1`.

## Try it without ioBroker

```sh
npm install
npm run dev        # opens the demo house with made-up values
```

`index.html?demo` shows the demo house inside ioBroker as well.

## Development

```sh
npm test           # unit tests (vitest)
npm run build      # type check and build into www/
npm pack           # adapter package for a test installation
```

The page lives in `src-www/` (Vue 3, Vite, TypeScript, no UI framework). Everything a tile shows comes from the
instance configuration; no datapoint, instance number or address is written into the code. Values from the rooms and
energy arrive live over the socket; the other tiles ask every 5 seconds (or 90 seconds for slow things like fuel prices). Raw values are interpreted in
`src-www/lib/values.ts`, which is where adapter quirks belong, each with a test.

## Roadmap

1. Rooms and lights ✔
2. Weather, energy, waste collection, dishwasher, shopping list ✔
3. Tiles for well-known adapters (robot mower, vacuum, Bring!, speed test, OctoPrint, fuel, dehumidifier) ✔
4. English texts for all tiles
5. Speed test measured by the adapter itself, rated against your own average

## License

MIT © 2026 Daniel Korte. Icons: [Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache 2.0).

---

## Deutsch

**Aufgeräumtes, fertiges Dashboard für Wandtablets.** Datenpunkte im ioBroker-Admin auswählen, Seite auf dem Tablet
öffnen, fertig. Hell und dunkel, mit Rückfrage vor dem Schalten.

**Stand 0.4.0.** Installation vorerst über GitHub (Admin → Adapter → GitHub-Symbol → *Benutzerdefiniert* →
`https://github.com/supremedk1985/CleanDash`), Voraussetzung ist der **web**-Adapter. Danach
`http://<ioBroker>:<Port des web-Adapters>/cleandash/index.html` öffnen.

Eingerichtet wird alles in den Instanzeinstellungen, im Code steht nichts über ein bestimmtes Haus:

- **Räume, Licht, Rollläden:** beliebige Datenpunkte je Raum und Lampe
- **Energie:** beliebige Datenpunkte (Solar, Akku, Haus, Netz), dazu optional der Verlauf aus Dateien
- **Wetter** (openweathermap), **Müllabfuhr** (trashschedule), **Spülmaschine** (homeconnect), **Einkaufslisten** (bring)
- **Weitere Kacheln:** Mähroboter (navimow), Saugroboter (roborock), 3D-Drucker (octoprint), Spritpreise
  (tankerkoenig), Luftentfeuchter (sonoff/Tasmota), Ruf-Knopf, Dokumente im Posteingang, Internetgeschwindigkeit,
  zweiter Roboter über ein eigenes Skript, dazu MachIchGleich und Fundus (nur mit eigenem Server). Bleibt ein Feld leer, erscheint die Kachel nicht.

**Meldungen** liegen links über der Seite, die Kacheln verschieben sich nicht: Tonne rausstellen, Fenster offen bei
laufender Heizung, Spülmaschine fertig oder mit Fehler, Mäher festgefahren, Station des Saugers braucht Wasser oder
einen leeren Beutel. Jede lässt sich für 5 Minuten wegdrücken („Snooze 5 Min.“), Aufgaben auch als „Erledigt“
abhaken. Beim nächsten Anlass meldet sie sich wieder.

**Kacheln anordnen, je Gerät:** in der Kachel *Infos & Diagnose* auf *Verschiebemodus starten*. Kacheln am Griff in eine
andere Spalte oder Reihenfolge ziehen oder mit dem Auge ausblenden; *Fertig* speichert die Anordnung in diesem
Browser. Küchentablet und Handy können so verschieden aussehen. *Zurücksetzen* stellt die Grundordnung wieder her.
