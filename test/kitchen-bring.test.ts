import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src-www/compat/iobroker", () => ({ fetchBulk: vi.fn(), setState: vi.fn(async () => true) }));
import { setState } from "../src-www/compat/iobroker";
import {
  abstand, alsWert, bildUrl, eingabeZerlegen, entfernen, haeufige, hinzufuegen, imKatalog, inhalt, LISTEN, normal, setBringLists,
  vorschlaege, zuletzt,
} from "../src-www/features/bring";

setBringLists([{ name: "Einkaufen", content: "bring.0.list-a.content" }, { name: "Camping", content: "bring.0.list-b.content" }]);
const EINKAUFEN = LISTEN[0]!.id, CAMPING = LISTEN[1]!.id;

beforeEach(() => {
  vi.mocked(setState).mockClear();
  // Wie am 04.10.2026 wirklich: Einkaufen hat Fiebersaft drauf, „zuletzt" mit Glacé (Zusatz Veltins) und einer Zahl
  inhalt.value = { [EINKAUFEN]: [{ name: "Fiebersaft", specification: "" }, { name: "Milch", specification: "2" }] };
  zuletzt.value = {
    [EINKAUFEN]: [{ name: "Bier", specification: "" }, { name: "Glacé", specification: "Veltins " }, { name: "0,5", specification: "" },
      { name: "Farbfangtücher", specification: "" }],
    [CAMPING]: [{ name: "Grillkohle", specification: "" }],
  };
});

describe("Eingabe zerlegen", () => {
  it.each([
    ["Milch", "Milch", ""],
    ["Milch, laktosefrei", "Milch", "laktosefrei"],
    ["3 Äpfel", "Äpfel", "3"],
    ["2x Milch", "Milch", "2"],
    ["2 x Milch", "Milch", "2"],
    ["500 g Hackfleisch", "Hackfleisch", "500 g"],
    ["500g Hackfleisch", "Hackfleisch", "500 g"],
    ["1,5 l Milch", "Milch", "1,5 l"],
    ["2 Kisten Wasser", "Wasser", "2 Kisten"],
    ["Milch 1,5%", "Milch 1,5%", ""],
    ["  Brot  ", "Brot", ""],
  ])("„%s“ → %s / %s", (ein, name, zusatz) => {
    expect(eingabeZerlegen(ein)).toEqual({ name, zusatz });
  });

  it("schreibt Name und Zusatz so, wie der Adapter trennt (erstes Komma)", () => {
    expect(alsWert("Milch", "2")).toBe("Milch, 2");
    expect(alsWert("Milch", "")).toBe("Milch");
    expect(alsWert("Salz, grob", "")).toBe("Salz  grob");
  });
});

describe("Vorschläge", () => {
  it("findet ab dem ersten Buchstaben, Katalog mit Bild", () => {
    const v = vorschlaege("mil", EINKAUFEN);
    expect(v[0]!.name).toBe("Milch");
    expect(v[0]!.schonDrauf).toBe(true);
    expect(bildUrl(v[0]!.schluessel)).toBe("https://web.getbring.com/assets/images/items/milch.png");
  });

  it("Häufiges zuerst, mit dem Zusatz von damals", () => {
    const v = vorschlaege("gl", EINKAUFEN);
    expect(v[0]).toMatchObject({ name: "Glacé", haeufig: true, zusatz: "Veltins" });
  });

  it("verzeiht Tippfehler und kennt andere Wörter", () => {
    expect(vorschlaege("Tomaen", EINKAUFEN)[0]!.name).toBe("Tomaten");
    expect(vorschlaege("Banenen", EINKAUFEN)[0]!.name).toBe("Bananen");
    expect(vorschlaege("Broccoli", EINKAUFEN)[0]!.name).toBe("Brokkoli");
    expect(vorschlaege("Klopapier", EINKAUFEN)[0]!.name).toBe("Toilettenpapier");
    expect(vorschlaege("muesli", EINKAUFEN)[0]!.name).toBe("Müsli");
  });

  it("Alltagsartikel vor seltenen bei kurzer Eingabe", () => {
    expect(vorschlaege("to", EINKAUFEN)[0]!.name).toBe("Tomaten");
  });

  it("eine Menge vorne stört die Suche nicht", () => {
    expect(vorschlaege("3 äpf", EINKAUFEN)[0]!.name).toBe("Äpfel");
  });

  it("ohne Treffer bleibt das Getippte als eigener Artikel", () => {
    const v = vorschlaege("Kerzen für den Adventskranz", EINKAUFEN);
    expect(v[v.length - 1]).toMatchObject({ name: "Kerzen für den Adventskranz", eigen: true });
  });

  it("eigene Artikel aus „zuletzt“ werden vorgeschlagen", () => {
    expect(vorschlaege("farb", EINKAUFEN)[0]!.name).toBe("Farbfangtücher");
  });

  it("„Häufig“ ohne Zahlen und ohne das, was schon drauf steht; andere Listen dahinter", () => {
    expect(haeufige(EINKAUFEN).map((v) => v.name)).toEqual(["Bier", "Glacé", "Farbfangtücher", "Grillkohle"]);
  });
});

describe("Schreiben", () => {
  it("hinzufügen schreibt saveItemTranslated und zeigt es sofort", async () => {
    await hinzufuegen(EINKAUFEN, "Äpfel", "3");
    expect(setState).toHaveBeenCalledWith(`${EINKAUFEN}.saveItemTranslated`, "Äpfel, 3");
    const l = inhalt.value[EINKAUFEN]!;
    expect(l[l.length - 1]).toEqual({ name: "Äpfel", specification: "3" });
  });

  it("ein Artikel, der schon drauf steht, wird ersetzt, nicht verdoppelt", async () => {
    await hinzufuegen(EINKAUFEN, "Milch", "3");
    expect(inhalt.value[EINKAUFEN]!.filter((e) => e.name === "Milch")).toEqual([{ name: "Milch", specification: "3" }]);
  });

  it("entfernen schreibt removeItemTranslated", async () => {
    await entfernen(EINKAUFEN, "Fiebersaft");
    expect(setState).toHaveBeenCalledWith(`${EINKAUFEN}.removeItemTranslated`, "Fiebersaft");
    expect(inhalt.value[EINKAUFEN]!.map((e) => e.name)).toEqual(["Milch"]);
  });
});

describe("Hilfen", () => {
  it("normal und abstand", () => {
    expect(normal("Müsli")).toBe("muesli");
    expect(normal("Crème fraîche")).toBe("cremefraiche");
    expect(abstand("tomaen", "tomaten")).toBe(1);
    expect(abstand("abc", "xyzuvw")).toBe(3);
  });
  it("findet Katalogeinträge auch über Bring-Schlüssel", () => {
    expect(imKatalog("Müesli")?.name).toBe("Müsli");
  });
});
