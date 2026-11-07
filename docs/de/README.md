# CleanDash – deutsche Kurzanleitung

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
  zweiter Roboter über ein eigenes Skript, Kamin (Pixel-Lagerfeuer, Rohrtemperatur, „Holz nachlegen“ — erscheint nur,
  solange das Feuer brennt), dazu Fundus (nur mit eigenem Server). Bleibt ein Feld leer, erscheint die
  Kachel nicht. Die Formate für Internetgeschwindigkeit, zweiten Roboter und Kamin stehen in der englischen Anleitung unter [*Data formats*](../../README.md#data-formats).

**Meldungen** liegen links über der Seite, die Kacheln verschieben sich nicht: Tonne rausstellen, Fenster offen bei
laufender Heizung, Spülmaschine fertig oder mit Fehler, Mäher festgefahren, Station des Saugers braucht Wasser oder
einen leeren Beutel. Jede lässt sich für 5 Minuten wegdrücken („Snooze 5 Min.“), Aufgaben auch als „Erledigt“
abhaken. Beim nächsten Anlass meldet sie sich wieder.

**Kacheln anordnen, je Gerät:** in der Kachel *Infos & Diagnose* auf *Verschiebemodus starten*. Kacheln am Griff in eine
andere Spalte oder Reihenfolge ziehen oder mit dem Auge ausblenden; *Fertig* speichert die Anordnung in diesem
Browser. Küchentablet und Handy können so verschieden aussehen. *Zurücksetzen* stellt die Grundordnung wieder her.
