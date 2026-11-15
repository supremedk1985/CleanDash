<script setup lang="ts">
/**
 * Analyse-Popup des Kamins: die Temperaturkurve über mehrere Zeiträume (dieses Feuer, 24 Stunden, 7 und 30 Tage) mit der
 * Meldeschwelle und den Nachlege-Zeitpunkten, dazu Kennzahlen (Höchststand, Zahl der Feuer, Brenndauer, Ø Spitze), die
 * Feuer je Tag und eine Liste der einzelnen Feuer. Daten: der Standard-History-Adapter von ioBroker (features/kamin.ts).
 */
import { computed, ref, watch } from "vue";
import Dialog from "../../compat/primevue/Dialog.vue";
import ChartCanvas from "../ui/ChartCanvas.vue";
import { lang, t } from "../../lib/i18n";
import { isDark } from "../../lib/store";
import {
  feuerAbschnitte, feuerFenster, feuerJeTag, feuerMitNachlegen, feuerStatistik, kamin, nachlegenMarken, verlaufIds,
  verlaufLaden, type Feuer, type VPunkt,
} from "../../features/kamin";

const visible = defineModel<boolean>("visible", { default: false });

type BereichId = "feuer" | "tag" | "woche" | "monat";
const BEREICHE: { id: BereichId; label: () => string; stunden: number; step?: number }[] = [
  { id: "feuer", label: () => t("stoveRangeFire"), stunden: 48 },
  { id: "tag", label: () => t("stoveRange24"), stunden: 24 },
  { id: "woche", label: () => t("stoveRangeWeek"), stunden: 24 * 7, step: 10 * 60_000 },
  { id: "monat", label: () => t("stoveRangeMonth"), stunden: 24 * 30, step: 30 * 60_000 },
];
const bereich = ref<BereichId>("feuer");
const istFeuer = computed(() => bereich.value === "feuer");
const kurz = computed(() => bereich.value === "feuer" || bereich.value === "tag");

const laedt = ref(false);
const fehler = ref(false);
const temps = ref<VPunkt[]>([]);
const modul = ref<VPunkt[]>([]);
const schwelle = ref<VPunkt[]>([]);
const marken = ref<number[]>([]);
const feuer = ref<Feuer[]>([]);
const von = ref(0);
const bis = ref(Date.now());

async function laden() {
  const ids = verlaufIds();
  if (!ids) { fehler.value = true; return; }
  const b = BEREICHE.find((x) => x.id === bereich.value)!;
  laedt.value = true; fehler.value = false;
  const jetzt = Date.now();
  const ab = jetzt - b.stunden * 3600_000;
  try {
    const [kurven, zust] = await Promise.all([
      verlaufLaden(b.id === "feuer" ? [ids.temperatur, ids.modul, ids.schwelle] : [ids.temperatur, ids.modul], ab, jetzt, b.step),
      verlaufLaden([ids.zustand], ab, jetzt), // Zustand immer roh — daraus die Nachlege-Marken
    ]);
    if (bereich.value !== b.id) return; // zwischenzeitlich umgeschaltet
    temps.value = kurven[ids.temperatur] ?? [];
    modul.value = kurven[ids.modul] ?? [];
    schwelle.value = kurven[ids.schwelle] ?? [];
    marken.value = nachlegenMarken(zust[ids.zustand] ?? []);
    feuer.value = feuerMitNachlegen(feuerAbschnitte(temps.value, jetzt), marken.value);
    von.value = ab; bis.value = jetzt;
  } catch {
    fehler.value = true;
  } finally {
    laedt.value = false;
  }
}

watch([visible, bereich], ([offen]) => { if (offen) laden(); });

// Das Fenster der „Feuer"-Ansicht liegt um das letzte Feuer; die anderen Ansichten zeigen den ganzen Zeitraum.
const fenster = computed(() => feuerFenster(feuer.value, bis.value));
const xVon = computed(() => (istFeuer.value && fenster.value ? fenster.value.von : von.value));
const xBis = computed(() => (istFeuer.value && fenster.value ? fenster.value.bis : bis.value));
const feuerImFenster = computed(() =>
  istFeuer.value ? (fenster.value ? [fenster.value.feuer] : []) : feuer.value.filter((f) => f.bis >= von.value)
);
const stat = computed(() => feuerStatistik(feuerImFenster.value));
const proTag = computed(() => feuerJeTag(feuer.value.filter((f) => f.bis >= von.value)));

// --- Texte -------------------------------------------------------------------------------------------------------
function loc() { return lang.value === "de" ? "de-DE" : "en-GB"; }
function grad(v: number | null | undefined) { return v == null ? "–" : `${Math.round(v)} °C`; }
function dauer(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
function uhr(ts: number) { return new Date(ts).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }); }
function tagKurz(ts: number) { return new Date(ts).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" }); }
function seit(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return dauer(ms);
  return `${Math.round(min / 60 / 24)} d`;
}

// --- Kennzahlen (vier Kacheln, je nach Zeitraum) -----------------------------------------------------------------
interface Kachel { label: string; wert: string; neben?: string }
const kacheln = computed<Kachel[]>(() => {
  const k = kamin.value;
  const s = stat.value;
  const brennt = !!k && (k.zustand === "brennt" || k.zustand === "nachlegen");
  const jetztKachel: Kachel = brennt
    ? { label: t("stoveNow"), wert: grad(k?.temperatur), neben: k?.zustand === "nachlegen" ? t("stoveAddWood") : t("stoveBurning") }
    : { label: t("stoveNow"), wert: t("stoveCold") };
  const letztes = feuer.value[feuer.value.length - 1];
  if (istFeuer.value) {
    const f = fenster.value?.feuer;
    return [
      jetztKachel,
      { label: t("stovePeak"), wert: grad(f?.hoechst), neben: f ? uhr(f.hoechstZeit) : undefined },
      { label: t("stoveBurnTime"), wert: f ? dauer(f.bis - f.von) : "–", neben: f?.laeuft ? t("stoveStillBurning") : undefined },
      { label: t("stoveThreshold"), wert: grad(k?.schwelle), neben: f?.nachlegen ? t("stoveAddWood") : undefined },
    ];
  }
  const seitText = brennt
    ? { label: t("stoveBurningFor"), wert: letztes ? seit(bis.value - letztes.von) : "–" }
    : { label: t("stoveSinceFire"), wert: letztes ? seit(bis.value - letztes.bis) : "–" };
  return [
    { label: t("stovePeakRange"), wert: grad(s.maxHoechst || null) },
    { label: t("stoveFires"), wert: String(s.anzahl) },
    { label: t("stoveBurnTime"), wert: s.brenndauerMs ? dauer(s.brenndauerMs) : "–", neben: s.anzahl ? `Ø ${dauer(s.brenndauerMs / s.anzahl)}` : undefined },
    seitText,
  ];
});

// --- Diagramm ----------------------------------------------------------------------------------------------------
function dunkel() { return isDark.value; }
function reihe(p: VPunkt[], a: number, b: number) {
  return p.filter((x): x is [number, number] => typeof x[0] === "number" && x[1] >= a && x[1] <= b).sort((u, v) => u[1] - v[1]).map(([y, x]) => ({ x, y }));
}
/** Temperatur zur Zeit ts (nächstgelegener Messpunkt) — für die Marke „Holz nachlegen" auf der Kurve. */
function wertBei(p: VPunkt[], ts: number): number {
  let best = 0, abstand = Infinity;
  for (const [w, x] of p) { if (typeof w !== "number") continue; const d = Math.abs(x - ts); if (d < abstand) { abstand = d; best = w; } }
  return best;
}

const diagramm = computed(() => {
  const a = xVon.value, b = xBis.value;
  const d = dunkel();
  const raster = d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const schrift = d ? "#9ca3af" : "#6b7280";
  const tempDaten = reihe(temps.value, a, b);
  const k = kamin.value;
  // den aktuellen Wert anhängen, wenn es gerade brennt und wir kurze Zeiträume zeigen
  if (kurz.value && k && (k.zustand === "brennt" || k.zustand === "nachlegen") && typeof k.temperatur === "number" && b >= bis.value - 60_000)
    tempDaten.push({ x: bis.value, y: Math.round(k.temperatur) });

  const datasets: any[] = [
    { label: t("stoveTemperature"), data: tempDaten, borderColor: "#ea580c", backgroundColor: d ? "rgba(234,88,12,0.22)" : "rgba(234,88,12,0.16)",
      fill: "origin", pointRadius: 0, borderWidth: 2, tension: 0.3, order: 3 },
  ];
  const modDaten = reihe(modul.value, a, b);
  if (modDaten.length)
    datasets.push({ label: t("stoveSensorLine"), data: modDaten, borderColor: d ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.6)",
      borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.3, order: 4 });

  if (istFeuer.value) {
    const schwDaten = reihe(schwelle.value, a, b);
    if (schwDaten.length)
      datasets.push({ label: t("stoveThreshold"), data: schwDaten, borderColor: "#f59e0b", borderWidth: 1.5, borderDash: [5, 4],
        pointRadius: 0, fill: false, stepped: true, order: 2 });
    const markenImFenster = marken.value.filter((m) => m >= a && m <= b);
    if (markenImFenster.length)
      datasets.push({ label: t("stoveAddWood"), data: markenImFenster.map((m) => ({ x: m, y: wertBei(temps.value, m) })),
        showLine: false, pointStyle: "rectRot", pointRadius: 8, pointHoverRadius: 10, borderColor: "#dc2626",
        backgroundColor: "#dc2626", order: 1 });
    const f = fenster.value?.feuer;
    if (f)
      datasets.push({ label: t("stovePeak"), data: [{ x: f.hoechstZeit, y: f.hoechst }], showLine: false, pointStyle: "circle",
        pointRadius: 5, backgroundColor: "#fbbf24", borderColor: d ? "#1f2937" : "#fff", borderWidth: 2, order: 0 });
  }

  return {
    type: "line" as const,
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false as const, parsing: false as const,
      interaction: { mode: "nearest" as const, intersect: false },
      plugins: {
        legend: { display: true, position: "bottom" as const, labels: { color: schrift, usePointStyle: true, boxWidth: 8, padding: 14 } },
        tooltip: {
          callbacks: {
            title: (i: any[]) => (i[0] ? new Date(i[0].parsed.x).toLocaleString(loc(), kurz.value ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""),
            label: (ctx: any) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} °C`,
          },
        },
      },
      scales: {
        x: { type: "linear" as const, min: a, max: b, grid: { color: raster }, border: { display: false },
          ticks: { color: schrift, maxRotation: 0, autoSkip: true, maxTicksLimit: kurz.value ? 6 : 8,
            callback: (w: string | number) => new Date(Number(w)).toLocaleString(loc(), kurz.value ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric" }) } },
        y: { position: "right" as const, beginAtZero: true, grid: { color: raster, borderDash: [4, 4] }, border: { display: false },
          ticks: { color: schrift, maxTicksLimit: 5, callback: (w: string | number) => `${w} °C` } },
      },
    },
  };
});

const tagSpitze = computed(() => Math.max(1, ...proTag.value.map((t) => t.anzahl)));
// Bei vielen Tagen nicht jeden Tag beschriften (sonst wird es zu eng) — höchstens ~10 Beschriftungen
const labelJeden = computed(() => Math.max(1, Math.ceil(proTag.value.length / 10)));
function wochentag(tag: string) { return new Date(`${tag}T12:00`).toLocaleDateString(loc(), { weekday: "short", day: "numeric" }); }
const hatDaten = computed(() => temps.value.some((p) => typeof p[0] === "number"));
const liste = computed(() => [...feuerImFenster.value].reverse());
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="t('tileStove')" :style="{ width: '42rem', maxWidth: '96vw' }" data-test="kamin-dialog">
    <!-- Zeitraum -->
    <div class="flex flex-wrap gap-2 mb-3">
      <button v-for="b in BEREICHE" :key="b.id" type="button" class="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
        :class="bereich === b.id ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'"
        :data-test="`kamin-bereich-${b.id}`" @click="bereich = b.id">{{ b.label() }}</button>
    </div>

    <!-- Kennzahlen -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <div v-for="(k, i) in kacheln" :key="i" class="rounded-xl bg-gray-100 dark:bg-gray-800 p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ k.label }}</div>
        <div class="text-xl font-bold tabular-nums leading-tight">{{ k.wert }}</div>
        <div v-if="k.neben" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ k.neben }}</div>
      </div>
    </div>

    <!-- Temperaturkurve -->
    <div v-if="fehler" class="text-red-600 dark:text-red-400 py-8 text-center">{{ t("stoveLoadError") }}</div>
    <template v-else>
      <div class="relative h-60" data-test="kamin-diagramm">
        <ChartCanvas v-if="hatDaten && (!istFeuer || fenster)" :key="`${bereich}-${xVon}`" :config="(diagramm as any)" />
        <div v-else class="h-full flex items-center justify-center text-center px-6 text-gray-500 dark:text-gray-400">
          {{ laedt ? t("stoveLoading") : istFeuer ? t("stoveNoFire") : t("stoveNoData") }}
        </div>
      </div>

      <!-- Feuer je Tag (Woche, Monat) -->
      <div v-if="!kurz && proTag.length" class="mt-5">
        <div class="text-sm font-semibold mb-2">{{ t("stoveFiresPerDay") }}</div>
        <div class="flex items-end gap-1 h-24 min-w-0" data-test="kamin-protag">
          <div v-for="(tg, idx) in proTag" :key="tg.tag" class="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <div class="text-[11px] mb-1 tabular-nums">{{ tg.anzahl }}</div>
            <div class="w-full rounded-t bg-orange-500/70" :style="{ height: Math.max(6, (tg.anzahl / tagSpitze) * 70) + '%' }"></div>
            <div v-if="labelJeden === 1 || idx % labelJeden === 0" class="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{{ wochentag(tg.tag) }}</div>
          </div>
        </div>
      </div>

      <!-- Die einzelnen Feuer -->
      <div v-if="liste.length" class="mt-5">
        <div class="text-sm font-semibold mb-1">{{ t("stoveFireList") }}</div>
        <div class="max-h-56 overflow-y-auto" data-test="kamin-liste">
          <div v-for="(f, i) in liste" :key="i" class="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span class="mdi mdi-fireplace text-xl shrink-0" :class="f.laeuft ? 'text-orange-500' : 'text-amber-500'"></span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ tagKurz(f.von) }}, {{ uhr(f.von) }} – {{ f.laeuft ? t("stoveNow") : uhr(f.bis) }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ dauer(f.bis - f.von) }} · {{ t("stovePeak") }} {{ grad(f.hoechst) }}</div>
            </div>
            <span v-if="f.nachlegen" class="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">{{ t("stoveAddWood") }}</span>
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>
