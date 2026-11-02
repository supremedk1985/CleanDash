/**
 * fundus.ts
 * ---------
 * Der Fundus auf dem Dashboard: ein Knopf öffnet eine Vollbildseite zum Suchen, nicht zum Hinzufügen.
 *
 * Wie bei den Aufgaben holt das Dashboard die Daten DIREKT vom Server (Port 8095), nicht über ioBroker. Der
 * Server liefert dafür eigene, rein lesende Endpunkte ohne Anmeldung (/api/kachel/fundus*), die nur aus
 * dem Heimnetz antworten -- von außen stempelt Caddy die Anfrage, und der Server antwortet 403.
 *
 * Geladen wird NUR beim Öffnen der Seite, nicht im Takt der anderen Kacheln: Es gibt nichts, das sich in der
 * Küche im Sekundentakt ändert, und so bleibt das Dashboard ohne Fundus-Server genauso schnell.
 */
import { rawConfig } from "../lib/store";
import { ref } from "vue";

export interface FuKiste {
  code: string;
  /** Raum; leer = keinem Raum zugeordnet. Ein Stapel ist Raum + Name. */
  raum?: string;
  stapel: string;
  position: number;
  darueber: number;
  laenge?: number | null;
  breite?: number | null;
  hoehe?: number | null;
  art?: string;
  notiz?: string;
  anzahl?: number;
}

export interface FuSache {
  id: number;
  name: string;
  beschreibung: string;
  bereich: string;
  menge: string;
  notiz: string;
  foto: string | null;
  fotos: string[];
  raus_seit: string | null;
  raus_anzahl: number | null;
  kiste: FuKiste | null;
  /** Aufgebraucht (Menge 0): liegt nicht mehr in der Kiste, steht auf der Nachkaufliste. */
  leer?: boolean;
}

export interface FuStand {
  sachen: FuSache[];
  kisten: FuKiste[];
  bereiche: string[];
  /** Raumnamen in der Reihenfolge, die in der App festgelegt ist. */
  raeume: string[];
  laedt: boolean;
  fehler: string | null;
}

/** Wo der Fundus-Server steht -- leerer Wert aus dem Build zählt als „nicht gesetzt" (Lehre vom 13.09., `??`). */
export function serverAdresse(konfiguriert?: string | null): string {
  const wert = (konfiguriert ?? "").trim();
  return wert.length > 0 ? wert.replace(/\/+$/, "") : "";
}

/** The Fundus server from the settings (fundusUrl); empty means: no tile. */
export const fundusServer = () => serverAdresse(rawConfig.value.fundusUrl);

export const fundus = ref<FuStand>({ sachen: [], kisten: [], bereiche: [], raeume: [], laedt: false, fehler: null });

export async function laden(): Promise<void> {
  fundus.value = { ...fundus.value, laedt: true, fehler: null };
  try {
    const a = await fetch(`${fundusServer()}/api/kachel/fundus`, { cache: "no-store" });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    const d = await a.json();
    fundus.value = { sachen: d.sachen ?? [], kisten: d.kisten ?? [], bereiche: d.bereiche ?? [], raeume: d.raeume ?? [],
      laedt: false, fehler: null };
  } catch {
    // Der letzte Stand bleibt sichtbar -- lieber alt als leer.
    fundus.value = { ...fundus.value, laedt: false, fehler: "Der Fundus ist gerade nicht erreichbar." };
  }
}

/** Dieselbe Suche wie in der App: Tippfehler und Verwendungszweck („Ding zum Abisolieren") findet der Server. */
export async function suchen(q: string): Promise<FuSache[] | null> {
  if (!q.trim()) return [];
  try {
    const a = await fetch(`${fundusServer()}/api/kachel/fundus/suche?q=${encodeURIComponent(q.trim())}`,
      { cache: "no-store" });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    return (await a.json()).treffer ?? [];
  } catch {
    return null;
  }
}

/** Die erste Zahl im Mengentext („50 Stück" → 50), null ohne Zahl -- wie Menge.zahl in der App. */
export function mengeZahl(menge: string | null | undefined): number | null {
  const m = /\d+/.exec(menge ?? "");
  return m ? Number(m[0]) : null;
}

export type Entnahme = "raus" | "zurueck" | "verbraucht";

/**
 * Aufgebraucht? Der Server sagt es (`leer`); ältere Server nicht, dann zählt die erste Zahl im Mengentext.
 * „0 ×" in einer Kiste ergibt keinen Sinn: Eine Sache mit Menge 0
 * liegt nicht in der Kiste -- sie gehört auf die Nachkaufliste oder ganz weg, und das fragt die Kachel bei Null.
 */
export function istLeer(s: Pick<FuSache, "menge" | "leer">): boolean {
  return s.leer ?? mengeZahl(s.menge) === 0;
}

/** Die Nachkaufliste: alles Aufgebrauchte, mit Kiste, damit man weiß, wo es wieder hingehört. */
export function nachkaufliste(sachen: FuSache[]): FuSache[] {
  return sachen.filter(istLeer);
}

/** „Weg damit" am Tablet: entfernt eine AUFGEBRAUCHTE Sache (der Server lässt nur die zu). Name bei Erfolg, sonst null. */
export async function entfernen(id: number): Promise<string | null> {
  try {
    const a = await fetch(`${fundusServer()}/api/kachel/fundus/sachen/${id}/entfernen`, { method: "POST", cache: "no-store" });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    const d = await a.json();
    fundus.value = { ...fundus.value, sachen: fundus.value.sachen.filter((s) => s.id !== id) };
    return String(d.name ?? "");
  } catch {
    return null;
  }
}

/**
 * Entnehmen am Tablet: dieselben drei Handgriffe wie in der App. Gibt die geänderte Sache
 * zurück und ersetzt sie in der geladenen Liste, damit Liste und Einzelansicht sofort stimmen; null bei Fehler.
 */
export async function entnehmen(id: number, aktion: Entnahme, anzahl?: number): Promise<FuSache | null> {
  try {
    const a = await fetch(`${fundusServer()}/api/kachel/fundus/sachen/${id}/entnahme`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify(anzahl === undefined ? { aktion } : { aktion, anzahl }),
    });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    const neu: FuSache = await a.json();
    fundus.value = { ...fundus.value, sachen: fundus.value.sachen.map((s) => (s.id === neu.id ? neu : s)) };
    return neu;
  } catch {
    return null;
  }
}

export function fotoUrl(id: string | null | undefined, gross = false): string | null {
  return id ? `${fundusServer()}/api/kachel/fundus/foto/${encodeURIComponent(id)}${gross ? "?gross=1" : ""}` : null;
}

/** Wo steht die Kiste, und wie viel liegt obendrauf? Wortgleich mit der App (Kistenmass.ort). */
export function ortText(k: FuKiste | null | undefined): string {
  if (!k) return "";
  const vorn = k.raum ? `${k.raum} · ` : "";
  if (!k.stapel) return `${vorn}ohne Stapel`;
  if (k.darueber === 0) return `${vorn}Stapel ${k.stapel} · ganz oben`;
  if (k.darueber === 1) return `${vorn}Stapel ${k.stapel} · ${k.position}. von oben – eine Kiste obendrauf`;
  return `${vorn}Stapel ${k.stapel} · ${k.position}. von oben – ${k.darueber} Kisten obendrauf`;
}

function cm(mm: number): string {
  return mm % 10 === 0 ? String(mm / 10) : (mm / 10).toFixed(1).replace(".", ",");
}

/** „IKEA UPPSNOFSAD · 35 × 25 × 14 cm" -- wie in der App. */
export function kistenText(k: FuKiste | null | undefined): string {
  if (!k) return "";
  const { laenge: l, breite: b, hoehe: h } = k;
  const masse = l && b ? (h ? `${cm(l)} × ${cm(b)} × ${cm(h)} cm` : `${cm(l)} × ${cm(b)} cm`) : (h ? `${cm(h)} cm hoch` : "");
  return [k.art ?? "", masse].filter((t) => t).join(" · ");
}

/** „3 ×" bei einer nackten Zahl, sonst der Text der App („50 Stück"). */
export function mengeText(menge: string | null | undefined): string {
  const m = (menge ?? "").trim();
  if (!m) return "";
  return /^\d+$/.test(m) ? `${m} ×` : m;
}

/** Ist sie gerade draußen? Mit Anzahl, wenn bekannt. */
export function rausText(s: FuSache): string | null {
  if (!s.raus_seit) return null;
  return s.raus_anzahl ? `${s.raus_anzahl} rausgenommen` : "gerade rausgenommen";
}

/**
 * Sachen eines Bereichs bzw. einer Kiste; null = alle. Aufgebrauchtes bleibt draußen -- es liegt ja nicht mehr in
 * der Kiste --, außer man will genau das sehen ([nurLeere], die Nachkaufliste).
 */
export function filtern(sachen: FuSache[], bereich: string | null, kiste: string | null, nurLeere = false): FuSache[] {
  return sachen.filter((s) => istLeer(s) === nurLeere
    && (bereich === null || s.bereich === bereich) && (kiste === null || s.kiste?.code === kiste));
}

/**
 * Kisten nach Raum und Stapel gruppiert: Räume in der Reihenfolge der App ([raeume]), „ohne Raum" zuletzt; darin Stapel
 * alphabetisch, „ohne Stapel" zuletzt; im Stapel von oben nach unten.
 */
export function nachStapel(kisten: FuKiste[], raeume: string[] = []): Array<{ raum: string; stapel: string; kisten: FuKiste[] }> {
  const gruppen = new Map<string, { raum: string; stapel: string; kisten: FuKiste[] }>();
  for (const k of kisten) {
    const raum = k.raum || "", stapel = k.stapel || "";
    const schluessel = `${raum}\u0000${stapel}`;
    const g = gruppen.get(schluessel) ?? { raum, stapel, kisten: [] };
    g.kisten.push(k);
    gruppen.set(schluessel, g);
  }
  const raumRang = (r: string) => (r === "" ? Number.MAX_SAFE_INTEGER : raeume.indexOf(r) < 0 ? raeume.length : raeume.indexOf(r));
  return [...gruppen.values()]
    .sort((a, b) => raumRang(a.raum) - raumRang(b.raum) || a.raum.localeCompare(b.raum, "de")
      || (a.stapel === "" ? 1 : b.stapel === "" ? -1 : a.stapel.localeCompare(b.stapel, "de")))
    .map((g) => ({ ...g, kisten: [...g.kisten].sort((x, y) => x.position - y.position || x.code.localeCompare(y.code)) }));
}

/** Wie die Kiste im Regal aussieht -- wie in der App: UPPSNOFSAD schwarz, SAMLA milchig-durchsichtig, sonst neutral. */
export function kistenAussehen(k: FuKiste | null | undefined): "dunkel" | "milchig" | "neutral" {
  const art = (k?.art ?? "").toUpperCase();
  if (art.includes("UPPSNOFSAD")) return "dunkel";
  if (art.includes("SAMLA")) return "milchig";
  return "neutral";
}

export interface FuRaumGruppe {
  raum: string;
  /** Stapel von links nach rechts (alphabetisch), Kisten darin von oben nach unten. */
  stapel: Array<{ stapel: string; kisten: FuKiste[] }>;
  /** Kisten ohne Stapel -- stehen einzeln. */
  lose: FuKiste[];
  kisten: number;
  sachen: number;
}

/**
 * Für die Ansicht „Räume": je Raum seine Stapel und die losen Kisten, Räume in der Reihenfolge der App, „ohne Raum" zuletzt.
 */
export function nachRaum(kisten: FuKiste[], raeume: string[] = []): FuRaumGruppe[] {
  const gruppen: FuRaumGruppe[] = [];
  for (const g of nachStapel(kisten, raeume)) {
    let r = gruppen.find((x) => x.raum === g.raum);
    if (!r) { r = { raum: g.raum, stapel: [], lose: [], kisten: 0, sachen: 0 }; gruppen.push(r); }
    if (g.stapel) r.stapel.push({ stapel: g.stapel, kisten: g.kisten }); else r.lose.push(...g.kisten);
    r.kisten += g.kisten.length;
    r.sachen += g.kisten.reduce((n, k) => n + (k.anzahl ?? 0), 0);
  }
  return gruppen;
}

/** Nächster freier Stapelbuchstabe in einem Raum (A, B, …) -- wie Kistenmass.naechsterStapel in der App. */
export function naechsterStapel(kisten: FuKiste[], raum: string): string {
  const belegt = new Set(kisten.filter((k) => (k.raum ?? "") === raum).map((k) => k.stapel));
  for (let c = 65; c <= 90; c++) if (!belegt.has(String.fromCharCode(c))) return String.fromCharCode(c);
  return "Z";
}

export interface Verschiebung { raum: string; stapel: string; position: number }

/** Kiste umstellen am Tablet (nur nach Entsperren). Lädt danach neu; gibt eine Fehlermeldung oder null zurück. */
export async function verschieben(code: string, ziel: Verschiebung): Promise<string | null> {
  try {
    const a = await fetch(`${fundusServer()}/api/kachel/fundus/kisten/${encodeURIComponent(code)}/verschieben`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(ziel),
    });
    if (!a.ok) {
      const d = await a.json().catch(() => null);
      return d?.detail ? String(d.detail) : `Hat nicht geklappt (HTTP ${a.status})`;
    }
    await laden();
    return null;
  } catch {
    return "Hat nicht geklappt – ist der Server erreichbar?";
  }
}
