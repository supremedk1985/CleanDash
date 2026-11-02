/**
 * bring.ts
 * --------
 * Bring!-Einkaufslisten: ein Knopf öffnet ein Fenster zum schnellen Hinzufügen, mit Autovervollständigung.
 *
 * Der Weg: der bring-Adapter von ioBroker. Geschrieben wird über
 * `<liste>.saveItemTranslated` als „Name" oder „Name, Zusatz" -- der Adapter trennt am ersten Komma, übersetzt den
 * deutschen Anzeigenamen in Bring!s Schlüssel (dieselbe Kachel wie in der App) und liest die Liste eine Sekunde
 * später neu. Entfernen über `removeItemTranslated` (ganz weg -- für „Rückgängig").
 * NICHT `moveToRecentContentTranslated`: der Adapter (main.js) übersetzt dort NICHT, „Müsli" fände Bring nicht.
 *
 * Bring!-Listen sind meist geteilt: was hier landet, sehen die anderen sofort.
 */
import { ref } from "vue";
import { fetchBulk, setState } from "../compat/iobroker";
import { ABTEILUNGEN, KATALOG } from "./bringKatalog";
import type { FeatureModule } from "./registry";

export interface ShoppingItem {
  specification?: string;
  name: string;
}

export interface BringListe {
  id: string;
  name: string;
}

/** The lists from the settings (shoppingLists); the first one is the one the window suggests. `id` is the list's
 *  base in the bring adapter, e.g. bring.0.<uuid>. Filled by setBringLists() when the configuration is known. */
export const LISTEN: BringListe[] = [];

export function setBringLists(rows: { name?: string; content?: string }[] | undefined) {
  LISTEN.splice(0, LISTEN.length, ...(rows ?? [])
    .filter((r) => typeof r.content === "string" && r.content.endsWith(".content"))
    .map((r) => ({ id: r.content!.slice(0, -".content".length), name: r.name?.trim() || "Einkaufen" })));
}

/** Inhalt und „zuletzt verwendet" je Liste, wie der Adapter sie meldet. */
export const inhalt = ref<Record<string, ShoppingItem[]>>({});
export const zuletzt = ref<Record<string, ShoppingItem[]>>({});

function liesListe(roh: unknown): ShoppingItem[] {
  if (typeof roh !== "string" || !roh) return [];
  try {
    const l = JSON.parse(roh);
    return Array.isArray(l) ? l.filter((e) => e && typeof e.name === "string") : [];
  } catch {
    return [];
  }
}

async function poll() {
  const ids = LISTEN.flatMap((l) => [`${l.id}.content`, `${l.id}.recentContent`]);
  const w = await fetchBulk(ids);
  const i: Record<string, ShoppingItem[]> = {}, z: Record<string, ShoppingItem[]> = {};
  for (const l of LISTEN) {
    // Fehlt ein Wert in der Antwort (Adapter neu gestartet), bleibt der alte Stand -- keine leere Liste vortäuschen
    i[l.id] = `${l.id}.content` in w ? liesListe(w[`${l.id}.content`]) : (inhalt.value[l.id] ?? []);
    z[l.id] = `${l.id}.recentContent` in w ? liesListe(w[`${l.id}.recentContent`]) : (zuletzt.value[l.id] ?? []);
  }
  inhalt.value = i;
  zuletzt.value = z;
}

export const bringFeature: FeatureModule = { name: "bring", interval: "fast", poll };

// ------------------------------------------------------------------------------------------------ Text

/** Für Vergleiche: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern. „Müsli" = „muesli" = „Muesli". */
export function normal(t: string): string {
  // Erst die deutschen Umlaute ausschreiben, dann übrige Akzente auf den Grundbuchstaben (Crème fraîche → creme fraiche)
  return t.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

const MENGE = String.raw`(\d+(?:[.,]\d+)?|ein|eine|zwei|drei|vier|fünf|sechs|zehn|zwölf)`;
const EINHEIT = String.raw`(?:\s*(x|×|kg|g|gr|l|ml|liter|stk\.?|stück|pack(?:ung(?:en)?)?|pck\.?|dosen?|flaschen?|kisten?|tüten?|gläser|glas|becher|bund|rollen?|sack|säcke|beutel|netz))?`;

/**
 * Eingabe zerlegen in Name und Zusatz:
 *   „Milch, laktosefrei" → Milch / laktosefrei      (Komma wie in der Bring-App)
 *   „3 Äpfel"            → Äpfel / 3
 *   „2x Milch"           → Milch / 2
 *   „500 g Hack"         → Hack / 500 g
 *   „2 Kisten Wasser"    → Wasser / 2 Kisten
 * Eine Zahl HINTER dem Namen bleibt Teil davon („Milch 1,5%", „Pampers 4").
 */
export function eingabeZerlegen(text: string): { name: string; zusatz: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const komma = t.indexOf(",");
  if (komma > 0) {
    // „1,5 l Milch" ist kein Name mit Zusatz -- ein Komma zwischen Ziffern ist ein Dezimalkomma
    const dezimal = /\d/.test(t[komma - 1] ?? "") && /\d/.test(t[komma + 1] ?? "");
    if (!dezimal) return { name: t.slice(0, komma).trim(), zusatz: t.slice(komma + 1).trim() };
  }
  const m = t.match(new RegExp(`^${MENGE}${EINHEIT}\\s+(.+)$`, "i"));
  if (m) {
    const zahl = m[1]!, einheit = m[2] ?? "";
    const ohneX = /^(x|×)$/i.test(einheit) ? "" : einheit;
    const zusatz = ohneX ? `${zahl} ${ohneX}` : zahl;
    return { name: m[3]!.trim(), zusatz };
  }
  return { name: t, zusatz: "" };
}

/** Was der Adapter bekommt: „Name" oder „Name, Zusatz". Ein Komma im Namen würde ihn falsch trennen. */
export function alsWert(name: string, zusatz: string): string {
  const n = name.replace(/,/g, " ").trim();
  return zusatz.trim() ? `${n}, ${zusatz.trim()}` : n;
}

// ------------------------------------------------------------------------------------------------ Vorschläge

export interface Vorschlag {
  name: string;
  /** Bring-Schlüssel, wenn der Artikel aus dem Katalog stammt -- daraus das Bild */
  schluessel?: string;
  abteilung?: string;
  /** Zuletzt verwendeter Zusatz (aus „zuletzt verwendet") -- wird als Vorschlag angezeigt */
  zusatz?: string;
  /** Steht schon auf der gewählten Liste */
  schonDrauf: boolean;
  /** Kam in „zuletzt verwendet" vor */
  haeufig: boolean;
  /** Eigener Artikel: genau das Getippte, kein Treffer */
  eigen?: boolean;
}

/** Ein paar Wörter, die man anders sagt als Bring! sie nennt. Schlüssel normalisiert. */
const ANDERE_WOERTER: Record<string, string> = {
  klopapier: "Toilettenpapier", wcpapier: "Toilettenpapier", semmeln: "Brötchen", schrippen: "Brötchen",
  weckle: "Brötchen", muesli: "Müsli", spueli: "Spülmittel", tempos: "Taschentücher", erdaepfel: "Kartoffeln",
  zewa: "Küchenrolle", kuechentuecher: "Küchenrolle", paradeiser: "Tomaten", schlagsahne: "Sahne", rahm: "Sahne", muellbeutel: "Müllsäcke", muelltueten: "Müllsäcke",
};

interface Eintrag { name: string; schluessel?: string; abteilung?: string; n: string; woerter: string[] }

/**
 * Alltagsartikel bekommen einen kleinen Vorsprung: bei „to" soll Tomaten vor Tofu stehen, bei „bu" Butter vor
 * Bulgur. Bring! kennt keine Häufigkeiten über alle Nutzer, die eigenen stehen über „zuletzt verwendet" ohnehin vorn.
 */
const ALLTAG = new Set(["Milch", "Brot", "Brötchen", "Eier", "Butter", "Käse", "Joghurt", "Quark", "Sahne", "Tomaten",
  "Gurke", "Salat", "Äpfel", "Bananen", "Kartoffeln", "Zwiebeln", "Knoblauch", "Karotten", "Paprika", "Zitrone", "Nudeln",
  "Reis", "Mehl", "Zucker", "Salz", "Öl", "Kaffee", "Tee", "Wasser", "Apfelsaft", "Orangensaft", "Bier", "Rotwein", "Weisswein", "Toilettenpapier",
  "Spülmittel", "Waschmittel", "Müllsäcke", "Hackfleisch", "Aufschnitt", "Schinken", "Wurst", "Schokolade"].map(normal));

const katalogEintraege: Eintrag[] = KATALOG.map(([name, schluessel, a]) => ({
  name, schluessel, abteilung: ABTEILUNGEN[a], n: normal(name), woerter: name.split(/[\s-]+/).map(normal).filter(Boolean),
}));
const katalogNachName = new Map(katalogEintraege.map((e) => [e.n, e]));
/** Bring-Schlüssel auch über den Schlüssel selbst finden („Müesli" → Müsli) */
for (const [name, schluessel] of KATALOG) if (!katalogNachName.has(normal(schluessel))) {
  const e = katalogNachName.get(normal(name)); if (e) katalogNachName.set(normal(schluessel), e);
}

export function imKatalog(name: string): { name: string; schluessel?: string; abteilung?: string } | undefined {
  const n = normal(name);
  const e = katalogNachName.get(n) ?? (ANDERE_WOERTER[n] ? katalogNachName.get(normal(ANDERE_WOERTER[n]!)) : undefined);
  return e ? { name: e.name, schluessel: e.schluessel, abteilung: e.abteilung } : undefined;
}

/** Tippfehler: Levenshtein, früh abgebrochen. */
export function abstand(a: string, b: string, grenze = 2): number {
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  let vorher = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let zeilenMin = i;
    for (let j = 1; j <= b.length; j++) {
      const k = Math.min(vorher[j]! + 1, jetzt[j - 1]! + 1, vorher[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      jetzt.push(k); zeilenMin = Math.min(zeilenMin, k);
    }
    if (zeilenMin > grenze) return grenze + 1;
    vorher = jetzt;
  }
  return vorher[b.length]!;
}

function punkte(q: string, e: Eintrag): number {
  if (!q) return 0;
  if (e.n === q) return 1000;
  if (e.n.startsWith(q)) return 700 - Math.min(e.n.length - q.length, 50);
  if (e.woerter.some((w) => w.startsWith(q))) return 500;
  if (q.length >= 3 && e.n.includes(q)) return 350;
  if (q.length >= 4) {
    const grenze = q.length >= 7 ? 2 : 1;
    // Tippfehler im ganzen Wort („Tomaen") oder im Anfang („Bannan" für Bananen)
    if (abstand(q, e.n, grenze) <= grenze) return 300;
    if (e.n.length > q.length && abstand(q, e.n.slice(0, q.length), grenze) <= grenze) return 250;
    if (e.woerter.some((w) => abstand(q, w, grenze) <= grenze)) return 200;
  }
  return 0;
}

/**
 * Vorschläge zum Getippten: Katalog, „zuletzt verwendet" aller Listen und eigene Artikel. Häufige zuerst, dann wie gut
 * das Wort passt. Am Ende, wenn nichts genau passt, das Getippte selbst als eigener Artikel.
 */
export function vorschlaege(eingabe: string, listeId: string, max = 8): Vorschlag[] {
  const { name } = eingabeZerlegen(eingabe);
  const q0 = normal(name);
  if (!q0) return [];
  const q = ANDERE_WOERTER[q0] ? normal(ANDERE_WOERTER[q0]!) : q0;
  const drauf = new Set((inhalt.value[listeId] ?? []).map((e) => normal(e.name)));

  // „zuletzt verwendet": zuerst die gewählte Liste, dann die anderen; der Zusatz von damals wird mitgemerkt
  const haeufig = new Map<string, ShoppingItem>();
  for (const l of [listeId, ...LISTEN.map((x) => x.id).filter((x) => x !== listeId)])
    for (const e of zuletzt.value[l] ?? []) if (!haeufig.has(normal(e.name))) haeufig.set(normal(e.name), e);

  const kandidaten = new Map<string, Eintrag>();
  for (const e of katalogEintraege) kandidaten.set(e.n, e);
  const eigene = [...haeufig.values(), ...Object.values(inhalt.value).flat()];
  for (const e of eigene) {
    const n = normal(e.name);
    if (!n || kandidaten.has(n)) continue;
    const k = imKatalog(e.name);
    kandidaten.set(n, { name: e.name, schluessel: k?.schluessel, abteilung: k?.abteilung, n, woerter: e.name.split(/[\s-]+/).map(normal).filter(Boolean) });
  }

  const bewertet: { e: Eintrag; p: number }[] = [];
  for (const e of kandidaten.values()) {
    let p = Math.max(punkte(q, e), q !== q0 ? punkte(q0, e) : 0);
    if (!p) continue;
    if (haeufig.has(e.n)) p += 150;
    if (ALLTAG.has(e.n)) p += 30;
    if (drauf.has(e.n)) p -= 40;               // steht schon drauf: zeigen, aber nicht ganz vorne
    bewertet.push({ e, p });
  }
  bewertet.sort((a, b) => b.p - a.p || a.e.name.localeCompare(b.e.name, "de"));

  const aus: Vorschlag[] = bewertet.slice(0, max).map(({ e }) => ({
    name: e.name, schluessel: e.schluessel, abteilung: e.abteilung,
    zusatz: haeufig.get(e.n)?.specification?.trim() || undefined,
    schonDrauf: drauf.has(e.n), haeufig: haeufig.has(e.n),
  }));
  if (!aus.some((v) => normal(v.name) === q0)) {
    const k = imKatalog(name);
    aus.push({ name: k?.name ?? name.trim(), schluessel: k?.schluessel, abteilung: k?.abteilung,
      schonDrauf: drauf.has(q0), haeufig: false, eigen: !k });
  }
  return aus;
}

/** Ohne Eingabe: was zuletzt gekauft wurde (gewählte Liste zuerst), ohne das, was schon drauf steht. */
export function haeufige(listeId: string, max = 12): Vorschlag[] {
  const drauf = new Set((inhalt.value[listeId] ?? []).map((e) => normal(e.name)));
  const gesehen = new Set<string>();
  const aus: Vorschlag[] = [];
  for (const l of [listeId, ...LISTEN.map((x) => x.id).filter((x) => x !== listeId)])
    for (const e of zuletzt.value[l] ?? []) {
      const n = normal(e.name);
      // „0,5" stand wirklich in der Liste -- eine reine Zahl ist kein Artikel
      if (!n || /^\d+$/.test(n) || gesehen.has(n) || drauf.has(n)) continue;
      gesehen.add(n);
      const k = imKatalog(e.name);
      aus.push({ name: e.name, schluessel: k?.schluessel, abteilung: k?.abteilung, zusatz: e.specification?.trim() || undefined,
        schonDrauf: false, haeufig: true });
      if (aus.length >= max) return aus;
    }
  return aus;
}

/**
 * Bild eines Katalogartikels bei Bring! (354 von 360 so gefunden: klein, Umlaute ausgeschrieben,
 * alles andere zu „_"). Fehlt eins, zeigt die Oberfläche ein Ersatzzeichen.
 */
export function bildUrl(schluessel?: string): string | undefined {
  if (!schluessel) return undefined;
  const k = schluessel.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `https://web.getbring.com/assets/images/items/${k}.png`;
}

// ------------------------------------------------------------------------------------------------ Schreiben

/** Auf die Liste. Erscheint sofort (die nächste Abfrage bestätigt oder korrigiert es). */
export async function hinzufuegen(listeId: string, name: string, zusatz = ""): Promise<boolean> {
  const wert = alsWert(name, zusatz);
  const ok = await setState(`${listeId}.saveItemTranslated`, wert);
  if (ok) {
    const n = normal(name);
    const alt = (inhalt.value[listeId] ?? []).filter((e) => normal(e.name) !== n);
    inhalt.value = { ...inhalt.value, [listeId]: [...alt, { name: wert.split(",")[0]!.trim(), specification: zusatz.trim() }] };
  }
  return ok;
}

/** Ganz von der Liste (für „Rückgängig" und das ✕ an einem Eintrag). */
export async function entfernen(listeId: string, name: string): Promise<boolean> {
  const ok = await setState(`${listeId}.removeItemTranslated`, name);
  if (ok) {
    const n = normal(name);
    inhalt.value = { ...inhalt.value, [listeId]: (inhalt.value[listeId] ?? []).filter((e) => normal(e.name) !== n) };
  }
  return ok;
}
