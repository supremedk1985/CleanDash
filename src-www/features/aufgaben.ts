/**
 * aufgaben.ts
 * -----------
 * Die Küchenkachel für das Aufgaben-System (Entwurf und Entscheidungen in
 * ~/Ticketsystem/NOTIZEN.md).
 *
 * Anders als alle übrigen Kacheln holt diese ihre Daten NICHT aus ioBroker,
 * sondern direkt vom Aufgaben-Server auf Port 8091. Der Grund: ioBroker wäre
 * hier nur ein Briefkasten, der die Daten weiterreicht -- und jeder Umweg ist
 * eine Stelle, an der etwas veraltet, ohne dass man es sieht.
 *
 * Entscheidung 13: Die Kachel meldet sich NICHT an. Sie zeigt alles von allen
 * und darf auch abhaken -- auch für den anderen. Der Server lässt diesen
 * Zugang nur aus dem Haus-Netz zu; von außen antwortet er mit 403.
 */
import { ref } from "vue";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

export interface KachelSchritt {
  id: string;
  text: string;
  nr: number;
  von: number;
  zustaendig: string;
}

export interface KachelAufgabe {
  id: string;
  titel: string;
  prio: "dringend" | "normal" | "kann_warten";
  beteiligte: string[];
  schritt: KachelSchritt | null;
  anhaenge: number;
  versuche: number;
  letzter_versuch: string | null;
  /** Für das Popup (Daniel, 13.09.): alle Schritte, Notiz, Takt, Herkunft. */
  schritte?: Array<{ nr: number; text: string; zustaendig: string; erledigt: boolean }>;
  notiz?: string;
  stufe?: string;
  stufe_text?: string;
  besitzer?: string;
  angelegt_von?: string;
  angelegt_am?: string;
}

/** Wie viel schon geschafft ist -- überlebt das Aufräumen in der App. */
export interface Bilanz {
  erledigt: number;
  je_person: Record<string, number>;
}

export interface KachelPerson {
  name: string;
  farbe: string;
}

export interface Aufgabenstand {
  aufgaben: KachelAufgabe[];
  /**
   * Wie viele Aufgaben gerade auf etwas warten (14.09.).
   *
   * Sie stehen bewusst NICHT in der Liste: In der Küche gehört hin, was man im
   * Vorbeigehen tun kann. Verschweigen wäre aber auch falsch -- deshalb die
   * Zahl als Zeile darunter.
   */
  wartend: number;
  personen: Record<string, KachelPerson>;
  dringend: number;
  /** Wann zuletzt eine Antwort kam -- null heißt: noch nie. */
  stand: Date | null;
  /** Erreichbar? Wie beim ioBroker-Banner gilt: lieber sichtbar alt als
   *  unsichtbar falsch. */
  erreichbar: boolean;
  bilanz: Bilanz;
}

/**
 * Wo der Aufgaben-Server steht.
 *
 * ACHTUNG, hier steckte am 13.09. ein Fehler, der die Kachel stumm machte:
 * `vite.config.ts` ersetzt `import.meta.env.VITE_AUFGABEN_SERVER` beim Bauen
 * durch den Wert aus der Shell -- und der ist im normalen Build ein LEERER
 * STRING. `??` greift aber nur bei null und undefined, nicht bei "". Die
 * Adresse war damit leer, die Kachel fragte `/api/kachel` relativ beim
 * Webserver auf Port 80 und bekam 404. Im Protokoll des Aufgaben-Servers kam
 * deshalb gar nichts an -- das war der Hinweis.
 *
 * Deshalb: eine eigene Funktion, die den leeren Fall ausdrücklich behandelt,
 * und ein Test dafür.
 */
export function serverAdresse(konfiguriert?: string | null): string {
  const wert = (konfiguriert ?? "").trim();
  return wert.length > 0 ? wert.replace(/\/+$/, "") : "";
}

/** The MachIchGleich server from the settings (aufgabenUrl); empty means: no tile. */
export const aufgabenServer = () => serverAdresse(rawConfig.value.aufgabenUrl);

export const aufgaben = ref<Aufgabenstand>({
  aufgaben: [],
  personen: {},
  dringend: 0,
  wartend: 0,
  stand: null,
  erreichbar: true,
  bilanz: { erledigt: 0, je_person: {} },
});

/** Höchstens so viele Zeilen -- die Kachel soll eine Liste sein, keine Tapete. */
export const HOECHSTENS = 6;

export async function poll(): Promise<void> {
  if (!aufgabenServer()) return;
  try {
    const antwort = await fetch(`${aufgabenServer()}/api/kachel`, { cache: "no-store" });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const d = await antwort.json();
    aufgaben.value = {
      aufgaben: d.aufgaben ?? [],
      personen: d.personen ?? {},
      dringend: d.dringend ?? 0,
      wartend: d.wartend ?? 0,
      stand: new Date(),
      erreichbar: true,
      bilanz: d.bilanz ?? { erledigt: 0, je_person: {} },
    };
  } catch {
    // Der letzte bekannte Stand bleibt stehen, aber er wird als alt markiert.
    aufgaben.value = { ...aufgaben.value, erreichbar: false };
  }
}

/**
 * Abhaken an der Kachel. Entscheidung 13: Wer in der Küche steht, hakt für den
 * ganzen Haushalt ab -- auch Aufgaben des anderen.
 *
 * Es wird immer der NÄCHSTE OFFENE Schritt abgehakt, nicht die ganze Aufgabe
 * (Entscheidung 16). Sonst wäre der Schrank mit einem Tippen fertig, obwohl
 * der Keller noch voll ist.
 */
export async function abhaken(a: KachelAufgabe): Promise<boolean> {
  try {
    const antwort = await fetch(`${aufgabenServer()}/api/kachel/haken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aufgabe_id: a.id, schritt_id: a.schritt?.id ?? null }),
    });
    if (!antwort.ok) {
      // Wer in der Küche tippt und nichts passiert, muss erfahren warum --
      // sonst hakt man dreimal ab und glaubt, es sei erledigt. Deshalb wird
      // das Band hier SOFORT gesetzt und nicht erst beim nächsten Abruf.
      aufgaben.value = { ...aufgaben.value, erreichbar: false };
      return false;
    }
    // Sofort aus der Anzeige nehmen: Wer tippt, will den Haken sehen und nicht
    // auf den nächsten Abruf warten.
    aufgaben.value = {
      ...aufgaben.value,
      aufgaben: aufgaben.value.aufgaben.filter((x) => x.id !== a.id || (a.schritt?.nr ?? 0) < (a.schritt?.von ?? 0)),
    };
    await poll();
    return true;
  } catch {
    aufgaben.value = { ...aufgaben.value, erreichbar: false };
    return false;
  }
}

/** Die Zeile unter dem Titel: Schritt, Zuständigkeit, Versuche. */
export function nebenzeile(a: KachelAufgabe, personen: Record<string, KachelPerson>): string {
  const teile: string[] = [];
  if (a.schritt && a.schritt.von > 1) {
    teile.push(`Schritt ${a.schritt.nr} von ${a.schritt.von}: ${a.schritt.text}`);
  } else if (a.schritt) {
    teile.push(a.schritt.text);
  }
  const wer = a.schritt?.zustaendig;
  if (wer === "beide") teile.push("beide");
  else if (wer && personen[wer]) teile.push(personen[wer].name);
  if (a.versuche === 1) teile.push("einmal versucht");
  else if (a.versuche > 1) teile.push(`${a.versuche}-mal versucht`);
  return teile.join(" · ");
}

export const aufgabenFeature: FeatureModule = { name: "aufgaben", interval: "slow", poll };

/**
 * Die Notiz für das Popup.
 *
 * Die App speichert Auszeichnung IM Text (`**fett**`, `_kursiv_`, `~~weg~~`,
 * `- Punkt`). Die Küche liest im Vorbeigehen und braucht keine Formatierung --
 * aber die Zeichen sollen auch nicht als Zeichensalat dastehen. Deshalb wird
 * hier nur entfernt, was auszeichnet, und die Aufzählung bleibt als solche
 * erkennbar.
 *
 * Bewusst kein HTML: Die Notiz kommt aus einem Eingabefeld, und was von dort
 * kommt, wird nicht als Auszeichnung ausgeführt.
 */
export function notizZeilen(notiz: string | undefined): Array<{ text: string; punkt: boolean }> {
  if (!notiz) return [];
  return notiz
    .split(/\r?\n/)
    .map((roh) => {
      const punkt = /^\s*[-*]\s+/.test(roh);
      const text = roh
        .replace(/^\s*[-*]\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        // Durchgestrichenes fällt WEG und wird nicht etwa entstrichen
        // dargestellt: „Schrauben ~~M4~~ M5" würde sonst zu „Schrauben M4 M5"
        // -- also genau die Verwechslung, die das Durchstreichen verhindern
        // sollte. Wer den gestrichenen Text sehen will, öffnet die App.
        .replace(/~~(.+?)~~/g, "")
        .replace(/(^|[^\w])_(.+?)_($|[^\w])/g, "$1$2$3")
        .replace(/\s{2,}/g, " ")      // wo Gestrichenes wegfiel, bleibt sonst eine Lücke
        .trim();
      return { text, punkt };
    })
    .filter((z) => z.text.length > 0);
}

/** Wie lange es her ist -- „vor 2 Tagen" statt eines Zeitstempels. */
export function vorWieLange(iso: string | null | undefined, jetzt = new Date()): string {
  if (!iso) return "";
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return "";
  const minuten = Math.round((jetzt.getTime() - dann.getTime()) / 60000);
  if (minuten < 2) return "gerade eben";
  if (minuten < 60) return `vor ${minuten} Minuten`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Stunde${stunden === 1 ? "" : "n"}`;
  const tage = Math.round(stunden / 24);
  return `vor ${tage} Tag${tage === 1 ? "" : "en"}`;
}
