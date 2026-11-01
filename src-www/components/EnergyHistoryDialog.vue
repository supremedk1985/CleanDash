<script setup lang="ts">
/**
 * Popup der Energiezentrale — aufgebaut wie die Anker-App (Daniel, 01.10.2026: „so wie im Screenshot"):
 * oben Tag / Woche / Monat / Jahr, darunter die gewählte Größe (Haus, Solar, Speicher, Netz) mit Summe,
 * die Kurve bzw. die Balken, Blättern nach Datum und unten die „Analyse der Energiequellen" als
 * geteilter Balken mit Anteilen. Daten: lib/energyHistory.ts (Dateien aus dem Ordner energyHistoryUrl).
 */
import { computed, ref, watch } from "vue";
import Modal from "./ui/Modal.vue";
import ChartCanvas from "./ui/ChartCanvas.vue";
import {
  ansicht, blaettern, energieIndexLaden, kwhText, leistungText, punktText, schluesselFuer, sichtbareFelder, zeitraumLaden, zeitraumText,
  type Art, type EnergieIndex, type EnergieZeitraum, type Groesse,
} from "../lib/energyHistory";
import { energyChartColors, mitDeckkraft } from "../lib/energyChartColors";
import { config, values } from "../lib/store";
import { num } from "../lib/values";

const BASIS = computed(() => config.value?.energy?.historyUrl ?? "");
const savings = computed(() => num(config.value?.energy?.savings ? values[config.value.energy.savings] : null));
const produced = computed(() => num(config.value?.energy?.total ? values[config.value.energy.total] : null));

const visible = defineModel<boolean>("visible", { default: false });

const ARTEN: { art: Art; titel: string }[] = [
  { art: "tag", titel: "Tag" }, { art: "woche", titel: "Woche" }, { art: "monat", titel: "Monat" }, { art: "jahr", titel: "Jahr" },
];
const GROESSEN: { g: Groesse; titel: string; icon: string }[] = [
  { g: "solar", titel: "Solar", icon: "mdi mdi-white-balance-sunny" },
  { g: "haus", titel: "Haus", icon: "mdi mdi-home-lightning-bolt-outline" },
  { g: "akku", titel: "Speicher", icon: "mdi mdi-battery-medium" },
  { g: "netz", titel: "Netz", icon: "mdi mdi-transmission-tower" },
];
/** Symbol und Farbe je Teil der Analyse */
const TEIL: Record<string, { icon: string; farbe: "speicher" | "solar" | "netz" | "haus" }> = {
  speicher: { icon: "mdi mdi-battery-medium", farbe: "speicher" },
  solar: { icon: "mdi mdi-white-balance-sunny", farbe: "solar" },
  netz: { icon: "mdi mdi-transmission-tower", farbe: "netz" },
  haus: { icon: "mdi mdi-home-outline", farbe: "haus" },
};
const GROESSE_FARBE: Record<Groesse, "haus" | "solar" | "speicher" | "netz"> = { haus: "haus", solar: "solar", akku: "speicher", netz: "netz" };

const art = ref<Art>("tag");
const groesse = ref<Groesse>("haus");
const schluessel = ref(schluesselFuer("tag", new Date()));
const index = ref<EnergieIndex | null>(null);
const zeitraum = ref<EnergieZeitraum | null>(null);
const laedt = ref(false);
const fehler = ref(false);
const zwischenspeicher = new Map<string, EnergieZeitraum | null>();

async function laden() {
  const a = art.value, k = schluessel.value, merk = `${a}/${k}`;
  if (zwischenspeicher.has(merk)) { zeitraum.value = zwischenspeicher.get(merk)!; return; }
  laedt.value = true; fehler.value = false;
  try {
    const z = await zeitraumLaden(BASIS.value, a, k);
    zwischenspeicher.set(merk, z);
    if (art.value === a && schluessel.value === k) zeitraum.value = z;
  } catch {
    fehler.value = true; zeitraum.value = null;
  } finally { laedt.value = false; }
}

/** Beim Öffnen und beim Wechsel der Art: der aktuelle Zeitraum — fehlt er (cerebro gerade erst an), der neueste vorhandene */
function aufAktuell() {
  const jetzt = schluesselFuer(art.value, new Date());
  const vorhanden = index.value?.[art.value] ?? [];
  schluessel.value = vorhanden.includes(jetzt) || vorhanden.length === 0 ? jetzt : vorhanden[vorhanden.length - 1];
}

watch(visible, async (offen) => {
  if (!offen) return;
  zwischenspeicher.clear();
  try { index.value = await energieIndexLaden(BASIS.value); } catch { index.value = null; }
  aufAktuell();
  await laden();
});
watch(art, () => { aufAktuell(); laden(); });

const nachbarn = computed(() => blaettern(art.value, schluessel.value, index.value, new Date()));
function geheZu(k: string | null) { if (k) { schluessel.value = k; laden(); } }

const v = computed(() => (zeitraum.value ? ansicht(zeitraum.value, groesse.value) : null));
const farben = energyChartColors;
const hauptfarbe = computed(() => farben.value[GROESSE_FARBE[groesse.value]]);

/** Kurve (Tag) oder Balken (Woche, Monat, Jahr) der gewählten Größe */
const diagramm = computed(() => {
  const z = zeitraum.value;
  if (!z) return null;
  const c = farben.value, g = groesse.value, tag = z.art === "tag";
  const n = sichtbareFelder(z, new Date());
  const labels = z.punkte.slice(0, n).map((p) => punktText(z.art, p));
  const prozent = tag && g === "akku";
  const einheit = prozent ? "%" : z.einheit;
  const linie = (label: string, werte: number[], farbe: string) => ({
    label, data: werte.slice(0, n), borderColor: farbe, backgroundColor: mitDeckkraft(farbe, 0.28), fill: "origin",
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35,
  });
  const balken = (label: string, werte: number[], farbe: string) => ({
    label, data: werte.slice(0, n), backgroundColor: farbe, borderRadius: 4, maxBarThickness: 26, stack: "a",
  });
  const satz = tag ? linie : balken;
  const datensaetze =
    g === "haus" ? [satz("Haus", z.haus.werte, c.haus)]
    : g === "solar" ? [satz("Solar", z.solar.werte, c.solar)]
    : g === "akku" ? [satz(tag ? "Ladestand" : "Entladen", z.akku.werte, c.speicher)]
    // Netz: Bezug nach oben, Einspeisung nach unten
    : [satz(tag ? "Netz → Haus" : "Bezug", z.netz.werte, c.netz), satz("Einspeisung", z.netz.einspeisung.map((w) => -w), c.solar)];
  const wert = (x: number) => (einheit === "W" ? leistungText(Math.abs(x)) : einheit === "%" ? `${Math.round(x)} %` : kwhText(Math.abs(x)));
  // Achse knapper als der Tooltip und MIT Vorzeichen (unter null liegt beim Netz die Einspeisung)
  const achse = (x: number) => {
    if (einheit === "%") return `${Math.round(x)} %`;
    const minus = x < 0 ? "−" : "";
    if (einheit === "W") return minus + leistungText(Math.abs(x));
    const a = Math.abs(x);
    return `${minus}${a.toLocaleString("de-DE", { maximumFractionDigits: a >= 10 || a === 0 ? 0 : 1 })} kWh`;
  };
  return {
    type: (tag ? "line" : "bar") as "line" | "bar",
    data: { labels, datasets: datensaetze },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: g === "netz", position: "bottom" as const, labels: { color: c.textSecondary, usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          backgroundColor: hauptfarbe.value, titleColor: "#fff", bodyColor: "#fff", displayColors: g === "netz",
          padding: 10, cornerRadius: 8, titleFont: { size: 13 }, bodyFont: { size: 16, weight: "bold" as const },
          callbacks: { label: (ctx: any) => `${g === "netz" ? ctx.dataset.label + ": " : ""}${wert(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { stacked: !tag, grid: { display: false }, ticks: { color: c.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: tag ? 5 : 8 } },
        y: {
          position: "right" as const, stacked: !tag, beginAtZero: true, ...(prozent ? { max: 100 } : {}),
          grid: { color: c.gridline, borderDash: [4, 4] }, border: { display: false },
          ticks: { color: c.muted, maxTicksLimit: 4, callback: (x: any) => achse(Number(x)) },
        },
      },
    },
  };
});

const standText = computed(() => {
  const s = zeitraum.value?.stand;
  if (!s) return "";
  const d = new Date(s);
  return `Stand ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
});
</script>

<template>
  <Modal v-model:visible="visible" title="Energie" width="34rem" data-pruef="energie-popup">
    <!-- Tag / Woche / Monat / Jahr -->
    <div class="flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1 mb-4" role="tablist">
      <button v-for="a in ARTEN" :key="a.art" type="button" role="tab" :aria-selected="art === a.art" :data-pruef="`art-${a.art}`"
        class="flex-1 py-2 rounded-xl text-base transition-colors"
        :class="art === a.art ? 'bg-white dark:bg-gray-700 font-semibold shadow-sm' : 'text-gray-500 dark:text-gray-400'"
        @click="art = a.art">{{ a.titel }}</button>
    </div>

    <!-- Größe: Titel + Summe links, Symbole rechts -->
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm text-gray-500 dark:text-gray-400" data-pruef="titel">{{ v?.titel ?? "Energie" }}</div>
        <div class="text-3xl font-semibold leading-tight" data-pruef="summe">{{ v ? kwhText(v.summe) : "–" }}</div>
        <div v-if="v?.neben" class="text-sm text-gray-500 dark:text-gray-400">{{ v.neben }}</div>
      </div>
      <div class="flex gap-1 shrink-0" role="radiogroup" aria-label="Größe">
        <button v-for="x in GROESSEN" :key="x.g" type="button" role="radio" :aria-checked="groesse === x.g" :aria-label="x.titel"
          :title="x.titel" :data-pruef="`groesse-${x.g}`" class="w-11 h-11 rounded-full flex items-center justify-center text-2xl transition-colors"
          :style="groesse === x.g ? { color: farben[GROESSE_FARBE[x.g]], backgroundColor: mitDeckkraft(farben[GROESSE_FARBE[x.g]], 0.12) } : {}"
          :class="groesse === x.g ? '' : 'text-gray-400 dark:text-gray-500'" @click="groesse = x.g">
          <i :class="x.icon" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Kurve bzw. Balken -->
    <div class="relative mt-3" style="height: 230px" data-pruef="diagramm">
      <ChartCanvas v-if="diagramm" :key="`${diagramm.type}-${groesse}`" :config="diagramm" />
      <div v-else-if="laedt" class="absolute inset-0 flex items-center justify-center font-light">Lade Daten…</div>
      <div v-else class="absolute inset-0 flex items-center justify-center text-center px-6 font-light text-gray-500 dark:text-gray-400" data-pruef="leer">
        {{ fehler ? "Die Daten ließen sich nicht laden." : "Für diesen Zeitraum liegen noch keine Daten vor." }}
      </div>
    </div>

    <!-- Blättern -->
    <div class="flex items-center justify-between mt-2">
      <button type="button" class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 disabled:opacity-30"
        :disabled="!nachbarn.zurueck" aria-label="Zeitraum davor" data-pruef="zurueck" @click="geheZu(nachbarn.zurueck)">
        <i class="mdi mdi-chevron-left text-2xl" aria-hidden="true"></i>
      </button>
      <div class="text-base text-gray-600 dark:text-gray-300" data-pruef="zeitraum">{{ zeitraumText(art, schluessel) }}</div>
      <button type="button" class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 disabled:opacity-30"
        :disabled="!nachbarn.vor" aria-label="Zeitraum danach" data-pruef="vor" @click="geheZu(nachbarn.vor)">
        <i class="mdi mdi-chevron-right text-2xl" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Analyse der Energiequellen -->
    <template v-if="v">
      <div class="border-t border-dashed border-gray-300 dark:border-gray-600 my-4"></div>
      <div class="text-xl font-semibold">Analyse der Energiequellen</div>
      <div class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ v.analyseTitel }} · {{ kwhText(v.teile.reduce((s, t) => s + t.kwh, 0)) }}</div>
      <div class="flex h-3 rounded-full overflow-hidden gap-0.5 mt-3 bg-gray-100 dark:bg-gray-800" data-pruef="anteilsbalken">
        <div v-for="t in v.teile.filter((t) => t.prozent > 0)" :key="t.schluessel" :style="{ width: `${t.prozent}%`, backgroundColor: farben[TEIL[t.schluessel].farbe] }"></div>
      </div>
      <div class="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="t in v.teile" :key="t.schluessel" class="flex items-center gap-3 py-2.5" :data-pruef="`teil-${t.schluessel}`">
          <div class="w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0"
            :style="{ color: farben[TEIL[t.schluessel].farbe], backgroundColor: mitDeckkraft(farben[TEIL[t.schluessel].farbe], 0.14) }">
            <i :class="TEIL[t.schluessel].icon" aria-hidden="true"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-gray-500 dark:text-gray-400">{{ t.titel }}</div>
            <div class="text-xl font-semibold">{{ kwhText(t.kwh) }}</div>
          </div>
          <div class="text-xl font-semibold" data-pruef="prozent">{{ t.prozent.toLocaleString("de-DE", { maximumFractionDigits: 1 }) }} %</div>
        </div>
      </div>
      <div v-if="v.zusatz" class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ v.zusatz }}</div>
    </template>

    <div class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500 mt-4">
      <span v-if="savings !== null || produced !== null">Seit Inbetriebnahme
        <template v-if="savings !== null">{{ savings.toLocaleString("de-DE", { maximumFractionDigits: 0 }) }} € gespart</template>
        <template v-if="savings !== null && produced !== null"> · </template>
        <template v-if="produced !== null">{{ produced.toLocaleString("de-DE", { maximumFractionDigits: 0 }) }} kWh erzeugt</template></span>
      <span v-if="standText">{{ standText }}</span>
    </div>
  </Modal>
</template>
