<script setup lang="ts">
/**
 * Verlauf des Luftentfeuchters: 24 Stunden oder 7 Tage, oben die Zahlen (heute, gestern, gesamt, Laufzeit), darunter die
 * Leistung als Kurve mit den Ein-Zeiten hinterlegt, bei 7 Tagen zusätzlich der Verbrauch je Tag, unten alle Schaltzeiten.
 * Daten: history.0 über simple-api (features/luftentfeuchter.ts). Der Verlauf beginnt am 15.10.2026.
 */
import { computed, ref, watch } from "vue";
import Dialog from "../../compat/primevue/Dialog.vue";
import ChartCanvas from "../ui/ChartCanvas.vue";
import Schalter from "./Schalter.vue";
import {
  ID, abschnitte, dauerText, kwhText, laufzeit, luftentfeuchter, schalten, tageswerte, uhr, verlaufLaden, zustand, type Punkt,
} from "../../features/luftentfeuchter";

const visible = defineModel<boolean>("visible", { default: false });
const zeitraum = ref<"tag" | "woche">("tag");
const laedt = ref(false);
const fehler = ref(false);
const v = ref<Record<string, Punkt[]>>({});
const bis = ref(Date.now());
const l = luftentfeuchter;

const ab = computed(() => bis.value - (zeitraum.value === "tag" ? 24 : 7 * 24) * 3600_000);

async function laden() {
  laedt.value = true; fehler.value = false; bis.value = Date.now();
  try {
    const [roh, mittel] = await Promise.all([
      verlaufLaden([ID.an, ID.heute], ab.value - 24 * 3600_000, bis.value),
      // Leistung: bei 24 h die Rohwerte, bei 7 Tagen Mittel je 30 Minuten (sonst tausende Punkte)
      verlaufLaden([ID.leistung], ab.value, bis.value, zeitraum.value === "woche" ? 30 * 60_000 : undefined),
    ]);
    v.value = { ...roh, ...mittel };
  } catch { fehler.value = true; } finally { laedt.value = false; }
}
watch([visible, zeitraum], ([s]) => { if (s) laden(); });

const schaltzeiten = computed(() => abschnitte(v.value[ID.an] ?? [], ab.value, bis.value));
const lief = computed(() => laufzeit(v.value[ID.leistung] ?? [], ab.value, bis.value, zeitraum.value === "woche" ? 45 * 60_000 : 15 * 60_000));
const anZeit = computed(() => schaltzeiten.value.filter((a) => a.an).reduce((s, a) => s + a.bis - a.von, 0));
const tage = computed(() => tageswerte(v.value[ID.heute] ?? []).filter((t) => new Date(`${t.tag}T12:00`).getTime() >= ab.value - 12 * 3600_000));

const diagramm = computed(() => {
  const p = (v.value[ID.leistung] ?? []).filter((x) => typeof x[0] === "number").sort((a, b) => a[1] - b[1]);
  const daten = p.map(([w, t]) => ({ x: t, y: Math.round(w as number) }));
  if (daten.length) daten.push({ x: bis.value, y: Math.round(l.value.leistung) });
  // Ein-Zeiten als blasse Fläche hinter der Kurve (100 % Höhe), damit „an, aber steht" sichtbar wird
  const spitze = Math.max(60, ...daten.map((d) => d.y)) * 1.1;
  const flaeche: { x: number; y: number | null }[] = [];
  for (const a of schaltzeiten.value) {
    if (!a.an) continue;
    flaeche.push({ x: a.von, y: spitze }, { x: a.bis, y: spitze }, { x: a.bis, y: null });
  }
  const dunkel = document.documentElement.classList.contains("dark");
  const raster = dunkel ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const schrift = dunkel ? "#9ca3af" : "#6b7280";
  return {
    type: "line" as const,
    data: {
      datasets: [
        { label: "Leistung (W)", data: daten, stepped: true, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,0.25)", fill: "origin", pointRadius: 0, borderWidth: 2 },
        { label: "eingeschaltet", data: flaeche, borderWidth: 0, pointRadius: 0, backgroundColor: dunkel ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.12)", fill: "origin", spanGaps: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false as const, parsing: false as const,
      plugins: { legend: { display: false }, tooltip: { mode: "nearest" as const, intersect: false,
        callbacks: { title: (i: any[]) => (i[0] ? new Date(i[0].parsed.x).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "") } } },
      scales: {
        x: { type: "linear" as const, min: ab.value, max: bis.value, grid: { color: raster },
          // Striche auf glatte Zeiten: alle 4 Stunden bzw. jede Mitternacht (sonst beschriftet Chart.js „06:53")
          afterBuildTicks: (achse: any) => { achse.ticks = glatteStriche(ab.value, bis.value, zeitraum.value).map((value) => ({ value })); },
          ticks: { color: schrift, autoSkip: false,
            callback: (w: string | number) => new Date(Number(w)).toLocaleString("de-DE", zeitraum.value === "tag" ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric" }) } },
        y: { min: 0, max: Math.ceil(spitze / 10) * 10, grid: { color: raster }, ticks: { color: schrift, callback: (w: string | number) => `${w} W` } },
      },
    },
  };
});

/** Glatte Zeitpunkte zwischen a und b: volle 4-Stunden-Marken (Tag) bzw. Mitternacht (Woche) */
function glatteStriche(a: number, b: number, art: "tag" | "woche"): number[] {
  const d = new Date(a); d.setMinutes(0, 0, 0);
  if (art === "woche") d.setHours(0); else d.setHours(Math.ceil(d.getHours() / 4) * 4);
  const aus: number[] = [];
  for (; d.getTime() <= b; art === "woche" ? d.setDate(d.getDate() + 1) : d.setHours(d.getHours() + 4)) if (d.getTime() >= a) aus.push(d.getTime());
  return aus;
}

const tagesSpitze = computed(() => Math.max(0.1, ...tage.value.map((t) => t.kwh)));
const wochentag = (tag: string) => new Date(`${tag}T12:00`).toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
const zeitText = (t: number) => zeitraum.value === "tag" ? uhr(t)
  : new Date(t).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Luftentfeuchter" :style="{ width: '40rem', maxWidth: '96vw' }" data-test="luftentfeuchter-dialog">
    <div class="flex items-center gap-3 mb-3">
      <div class="flex-1 text-lg font-semibold">
        {{ { 'läuft': `läuft · ${Math.round(l.leistung)} W`, 'bereit': `an, entfeuchtet gerade nicht · ${Math.round(l.leistung)} W`,
             'aus': 'aus', 'weg': 'Steckdose antwortet nicht' }[zustand(l)] }}
      </div>
      <Schalter :an="l.an" :label="l.an ? 'Luftentfeuchter ausschalten' : 'Luftentfeuchter einschalten'" gross
        :gesperrt="zustand(l) === 'weg'" @umschalten="(an: boolean) => schalten(an)" />
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
      <div class="rounded-xl bg-gray-100 dark:bg-gray-800 p-2"><div class="text-xs text-gray-500">heute</div><div class="font-semibold">{{ kwhText(l.heute) }}</div></div>
      <div class="rounded-xl bg-gray-100 dark:bg-gray-800 p-2"><div class="text-xs text-gray-500">gestern</div><div class="font-semibold">{{ kwhText(l.gestern) }}</div></div>
      <div class="rounded-xl bg-gray-100 dark:bg-gray-800 p-2"><div class="text-xs text-gray-500">{{ zeitraum === 'tag' ? '24 h' : '7 Tage' }}: lief</div><div class="font-semibold" data-test="lf-lief">{{ dauerText(lief) }}</div></div>
      <div class="rounded-xl bg-gray-100 dark:bg-gray-800 p-2"><div class="text-xs text-gray-500">gesamt seit 2022</div><div class="font-semibold">{{ kwhText(l.gesamt) }}</div></div>
    </div>

    <div class="flex gap-2 mb-2">
      <button v-for="z in (['tag', 'woche'] as const)" :key="z" type="button" class="px-4 py-1 rounded-full text-sm font-semibold"
        :class="zeitraum === z ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-800'" @click="zeitraum = z">
        {{ z === 'tag' ? '24 Stunden' : '7 Tage' }}</button>
      <div class="flex-1"></div>
      <div class="text-xs text-gray-500 self-center">grün hinterlegt: eingeschaltet · eingeschaltet {{ dauerText(anZeit) }}</div>
    </div>

    <div v-if="fehler" class="text-red-600 dark:text-red-400 py-6 text-center">Verlauf nicht abrufbar.</div>
    <div v-else class="relative h-56" data-test="lf-diagramm">
      <ChartCanvas v-if="(v[ID.leistung] ?? []).length" :key="zeitraum + bis" :config="(diagramm as any)" />
      <div v-else class="h-full flex items-center justify-center text-gray-500">{{ laedt ? 'lädt …' : 'Noch kein Verlauf in diesem Zeitraum (aufgezeichnet seit 15.10.2026).' }}</div>
    </div>

    <div v-if="zeitraum === 'woche' && tage.length" class="mt-4">
      <div class="text-sm font-semibold mb-1">Verbrauch je Tag</div>
      <div class="flex items-end gap-2 h-24" data-test="lf-tage">
        <div v-for="t in tage" :key="t.tag" class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="text-xs mb-1">{{ t.kwh.toLocaleString('de-DE', { maximumFractionDigits: 2 }) }}</div>
          <div class="w-full rounded-t bg-sky-500/70" :style="{ height: Math.max(4, (t.kwh / tagesSpitze) * 70) + '%' }"></div>
          <div class="text-xs text-gray-500 mt-1">{{ wochentag(t.tag) }}</div>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <div class="text-sm font-semibold mb-1">Schaltzeiten</div>
      <div v-if="!schaltzeiten.length" class="text-sm text-gray-500">keine im Zeitraum</div>
      <div class="max-h-48 overflow-y-auto" data-test="lf-schaltzeiten">
        <div v-for="(a, i) in [...schaltzeiten].reverse()" :key="i" class="flex items-center gap-2 py-1 text-sm border-b border-gray-100 dark:border-gray-800">
          <span class="w-2.5 h-2.5 rounded-full" :class="a.an ? 'bg-green-500' : 'bg-gray-400'"></span>
          <span class="w-10 font-semibold">{{ a.an ? 'an' : 'aus' }}</span>
          <span class="flex-1">{{ zeitText(a.von) }} – {{ i === 0 ? 'jetzt' : uhr(a.bis) }}</span>
          <span class="text-gray-500">{{ dauerText(a.bis - a.von) }}</span>
        </div>
      </div>
    </div>
  </Dialog>
</template>
