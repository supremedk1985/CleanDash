/**
 * energieVerlauf.ts
 * -----------------
 * Daten fürs Popup der Energiezentrale (Tag / Woche / Monat / Jahr wie in der Anker-App).
 *
 * Die Kurven kommen NICHT aus ioBroker: der Adapter ankersolix2 fragt bei Anker nur Wochensummen ab.
 * Ein Skript holt die 20-Minuten-Kurven und Tageswerte (zum Beispiel aus der Anker-Cloud) und legt sie als Dateien
 * in einen Ordner (<art>/<schlüssel>.json + index.json); dessen Adresse steht in der Konfiguration (energyHistoryUrl).
 * Das Format steht in docs/energy-history.md.
 *
 * Alles, was rechnet oder beschriftet, steht hier als reine Funktion — getestet in energieVerlauf.test.ts.
 */

export type Art = "tag" | "woche" | "monat" | "jahr";
export type Groesse = "solar" | "haus" | "akku" | "netz";

export interface EnergieIndex {
  tag: string[];
  woche: string[];
  monat: string[];
  jahr: string[];
  stand?: string;
}

export interface EnergieZeitraum {
  art: Art;
  schluessel: string;
  von: string;
  bis: string;
  stand: string;
  /** "W" bei einem Tag (mittlere Leistung je 20 min), sonst "kWh" je Tag bzw. Monat */
  einheit: "W" | "kWh";
  punkte: string[];
  haus: { werte: number[]; summe: number; herkunft: { speicher: number; solar: number; netz: number } };
  solar: { werte: number[]; summe: number; verbleib: { haus: number; speicher: number; netz: number } };
  akku: { werte: number[]; laden: number[] | null; geladen: number; entladen: number; herkunft: { solar: number; netz: number }; insHaus: number };
  netz: { werte: number[]; einspeisung: number[]; bezug: number; eingespeist: number; verbleib: { haus: number; speicher: number } };
}

// Der Ordner kommt aus der Konfiguration (energyHistoryUrl), zum Beispiel http://192.168.1.20/energie
export async function energieIndexLaden(BASIS: string): Promise<EnergieIndex> {
  const a = await fetch(`${BASIS}/index.json`, { cache: "no-store" });
  if (!a.ok) throw new Error(`index.json: HTTP ${a.status}`);
  return a.json();
}

/** null, wenn es die Datei (noch) nicht gibt — sie wird vom Erzeuger nach und nach nachgeladen */
export async function zeitraumLaden(BASIS: string, art: Art, schluessel: string): Promise<EnergieZeitraum | null> {
  const a = await fetch(`${BASIS}/${art}/${schluessel}.json`, { cache: "no-store" });
  if (a.status === 404) return null;
  if (!a.ok) throw new Error(`${art}/${schluessel}: HTTP ${a.status}`);
  return a.json();
}

// --- Schlüssel, Blättern, Beschriftung ------------------------------------------------------------

const zwei = (n: number) => String(n).padStart(2, "0");
export const isoTag = (d: Date) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;

/** Schlüssel des Zeitraums, in dem `d` liegt (Woche = ihr Montag) */
export function schluesselFuer(art: Art, d: Date): string {
  if (art === "tag") return isoTag(d);
  if (art === "monat") return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}`;
  if (art === "jahr") return String(d.getFullYear());
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return isoTag(m);
}

/** Der Zeitraum davor (-1) oder danach (+1) */
export function verschieben(art: Art, schluessel: string, um: -1 | 1): string {
  if (art === "jahr") return String(Number(schluessel) + um);
  if (art === "monat") {
    const [j, m] = schluessel.split("-").map(Number);
    return schluesselFuer("monat", new Date(j, m - 1 + um, 1, 12));
  }
  const d = new Date(`${schluessel}T12:00:00`);
  d.setDate(d.getDate() + (art === "woche" ? 7 * um : um));
  return isoTag(d);
}

/** Weiter nach hinten geht es, solange es dort noch Daten gibt; nach vorn nicht über heute hinaus */
export function blaettern(art: Art, schluessel: string, index: EnergieIndex | null, heute: Date) {
  const vorhanden = index?.[art] ?? [];
  const aeltester = vorhanden[0];
  const zurueck = verschieben(art, schluessel, -1);
  const vor = verschieben(art, schluessel, 1);
  return {
    zurueck: aeltester !== undefined && zurueck >= aeltester ? zurueck : null,
    vor: vor <= schluesselFuer(art, heute) ? vor : null,
  };
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WOCHENTAGE = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
const kurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** „Do., 01.10.2026" · „28.09. – 04.10.2026" · „Oktober 2026" · „2026" */
export function zeitraumText(art: Art, schluessel: string): string {
  if (art === "jahr") return schluessel;
  if (art === "monat") { const [j, m] = schluessel.split("-").map(Number); return `${MONATE[m - 1]} ${j}`; }
  const d = new Date(`${schluessel}T12:00:00`);
  if (art === "tag") return `${WOCHENTAGE[d.getDay()]}, ${kurz(schluessel)}${schluessel.slice(0, 4)}`;
  const ende = isoTag(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6, 12));
  return `${kurz(schluessel)} – ${kurz(ende)}${ende.slice(0, 4)}`;
}

/** Achsenbeschriftung eines Punkts: „02:20" · „Mo." · „14." · „Okt" */
export function punktText(art: Art, punkt: string): string {
  if (art === "tag") return punkt;
  if (art === "jahr") return MONATE[Number(punkt.slice(5, 7)) - 1].slice(0, 3);
  if (art === "woche") return WOCHENTAGE[new Date(`${punkt}T12:00:00`).getDay()];
  return `${Number(punkt.slice(8, 10))}.`;
}

// --- Zahlen ---------------------------------------------------------------------------------------

/** „5,42 kWh" — zwei Nachkommastellen unter 100, darüber eine, ab 1000 keine */
export function kwhText(kwh: number): string {
  const s = kwh >= 1000 ? 0 : kwh >= 100 ? 1 : 2;
  return `${kwh.toLocaleString("de-DE", { minimumFractionDigits: s, maximumFractionDigits: s })} kWh`;
}

/** „434,5 W" bzw. „1,88 kW" */
export function leistungText(w: number): string {
  if (Math.abs(w) >= 1000) return `${(w / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} kW`;
  return `${w.toLocaleString("de-DE", { maximumFractionDigits: 1 })} W`;
}

export interface Anteil {
  schluessel: string;
  titel: string;
  kwh: number;
  /** auf eine Nachkommastelle, zusammen genau 100 (größter Rest bekommt die Rundung) */
  prozent: number;
}

/** Anteile eines Ganzen in Prozent — Summe genau 100,0, auch nach dem Runden; leeres Ganzes → alles 0 */
export function anteile(teile: { schluessel: string; titel: string; kwh: number }[]): Anteil[] {
  const ganz = teile.reduce((s, t) => s + Math.max(0, t.kwh), 0);
  if (ganz <= 0) return teile.map((t) => ({ ...t, prozent: 0 }));
  const roh = teile.map((t) => (Math.max(0, t.kwh) / ganz) * 1000);
  const ab = roh.map(Math.floor);
  let rest = 1000 - ab.reduce((s, v) => s + v, 0);
  const reihenfolge = roh.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of reihenfolge) { if (rest-- <= 0) break; ab[i] += 1; }
  return teile.map((t, i) => ({ ...t, prozent: ab[i] / 10 }));
}

export interface Ansicht {
  /** Überschrift über der großen Zahl, z. B. „Einsatz zu Hause" */
  titel: string;
  summe: number;
  /** Zweitzeile neben der Summe, z. B. „entladen 2,79 kWh" */
  neben?: string;
  analyseTitel: string;
  teile: Anteil[];
  /** Hinweis unter der Analyse, z. B. eingespeiste Menge beim Netz */
  zusatz?: string;
}

/** Was das Popup zu einer Größe zeigt: Titel, Summe und die Aufteilung nach Herkunft bzw. Verbleib */
export function ansicht(z: EnergieZeitraum, g: Groesse): Ansicht {
  switch (g) {
    case "haus":
      return {
        titel: "Einsatz zu Hause", summe: z.haus.summe, analyseTitel: "Woher kam der Strom?",
        teile: anteile([
          { schluessel: "speicher", titel: "Vom Speicher", kwh: z.haus.herkunft.speicher },
          { schluessel: "solar", titel: "Aus Solar", kwh: z.haus.herkunft.solar },
          { schluessel: "netz", titel: "Aus dem Netz", kwh: z.haus.herkunft.netz },
        ]),
      };
    case "solar":
      return {
        titel: "Solarertrag", summe: z.solar.summe, analyseTitel: "Wohin ging der Solarstrom?",
        teile: anteile([
          { schluessel: "haus", titel: "Ins Haus", kwh: z.solar.verbleib.haus },
          { schluessel: "speicher", titel: "In den Speicher", kwh: z.solar.verbleib.speicher },
          { schluessel: "netz", titel: "Ins Netz", kwh: z.solar.verbleib.netz },
        ]),
      };
    case "akku":
      return {
        titel: "Speicher geladen", summe: z.akku.geladen, neben: `entladen ${kwhText(z.akku.entladen)}`,
        analyseTitel: "Woher kam die Ladung?",
        teile: anteile([
          { schluessel: "solar", titel: "Aus Solar", kwh: z.akku.herkunft.solar },
          { schluessel: "netz", titel: "Aus dem Netz", kwh: z.akku.herkunft.netz },
        ]),
        zusatz: `Ans Haus abgegeben: ${kwhText(z.akku.insHaus)}`,
      };
    case "netz":
      return {
        titel: "Netzbezug", summe: z.netz.bezug, neben: `eingespeist ${kwhText(z.netz.eingespeist)}`,
        analyseTitel: "Wohin ging der Netzstrom?",
        teile: anteile([
          { schluessel: "haus", titel: "Ins Haus", kwh: z.netz.verbleib.haus },
          { schluessel: "speicher", titel: "In den Speicher", kwh: z.netz.verbleib.speicher },
        ]),
      };
  }
}

/**
 * Am Tag sind die Felder nach dem Abruf noch leer (die Cloud liefert 0) — gezeichnet würde eine Kurve, die um
 * 10:40 auf null fällt. Deshalb endet die Kurve des HEUTIGEN Tages beim letzten Feld, das beim Abruf (`stand`)
 * schon begonnen hatte, und nie nach „jetzt".
 */
export function sichtbareFelder(z: EnergieZeitraum, jetzt: Date): number {
  if (z.art !== "tag" || z.schluessel !== isoTag(jetzt)) return z.punkte.length;
  const minuten = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const stand = z.stand ? new Date(z.stand) : jetzt;
  const bis = isoTag(stand) === z.schluessel ? Math.min(minuten(stand), minuten(jetzt)) : minuten(jetzt);
  return Math.min(z.punkte.length, Math.floor(bis / 20) + 1);
}
