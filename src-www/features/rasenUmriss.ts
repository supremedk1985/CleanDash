/**
 * rasenUmriss.ts
 * --------------
 * Der Umriss des Rasens aus der gefahrenen Spur — für die Mähkarte im Stil der Navimow-App.
 *
 * WARUM AUS DER SPUR: Der Adapter (TA2k/ioBroker.navimow) gibt keine Grenzlinie heraus, nur ein fertig gezeichnetes PNG
 * und `mapTrack` (die Punkte der Fahrten, 0,25-m-Raster). Die Randfahrt läuft aber einmal ganz um den Rasen — also ist
 * alles, was die Spur umschließt, Rasen:
 *   1. Spur auf ein 25-cm-Raster legen (Schritte bis 5 m: in einer echten Spur lag mitten in der Randfahrt an der Station ein
 *      Sprung von 3,8 m — mit 3 m blieb der Ring offen und die Flut lief hinein, 36 statt ~360 m²)
 *   2. um ½ m verbreitern, damit kleine Lücken in der Randfahrt schließen
 *   3. von außen fluten — was die Flut nicht erreicht, ist innen
 *   4. wieder um ½ m schmälern (zurück auf die Spur), größte zusammenhängende Fläche behalten
 *   5. Umriss nachfahren (Marching Squares), vereinfachen und weich runden wie in der App
 * Eine Ausbuchtung mit offenem Zugang (der Baumkreis unten im Garten) bleibt dabei draußen, wie in der App.
 */

export type Punkt2 = [number, number];

export interface UmrissOptionen {
  zelle?: number;
  verbreitern?: number;
  maxSprung?: number;
}

/** Spurpunkte aus `mapTrack` („{points: [[x, y, θ], …]}", als Text oder Objekt) — null, wenn unbrauchbar */
export function spurLesen(roh: unknown): Punkt2[] | null {
  try {
    const o = typeof roh === "string" ? JSON.parse(roh) : roh;
    const p = (o as { points?: unknown })?.points;
    if (!Array.isArray(p)) return null;
    const aus: Punkt2[] = [];
    for (const q of p) if (Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1])) aus.push([q[0], q[1]]);
    return aus.length >= 20 ? aus : null;
  } catch {
    return null;
  }
}

/** Der äußere Umriss (Weltkoordinaten in m, geschlossen) oder null, wenn die Spur keinen Rasen umschließt */
export function rasenUmriss(spur: Punkt2[], opt: UmrissOptionen = {}): Punkt2[] | null {
  const Z = opt.zelle ?? 0.25, R = Math.max(1, Math.round((opt.verbreitern ?? 0.5) / Z)), MAX = opt.maxSprung ?? 5;
  if (spur.length < 20) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of spur) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const rand = R + 3;
  const B = Math.ceil((maxX - minX) / Z) + 1 + 2 * rand, H = Math.ceil((maxY - minY) / Z) + 1 + 2 * rand;
  if (B * H > 4_000_000) return null; // unsinnig groß: lieber das Bild des Adapters zeigen
  const sp = (x: number) => Math.round((x - minX) / Z) + rand, ze = (y: number) => Math.round((y - minY) / Z) + rand;
  const feld = new Uint8Array(B * H);

  // 1. Spur aufs Raster
  const setze = (x: number, y: number) => { feld[ze(y) * B + sp(x)] = 1; };
  for (let i = 0; i < spur.length; i++) {
    const [x, y] = spur[i];
    setze(x, y);
    if (i === 0) continue;
    const [vx, vy] = spur[i - 1];
    const d = Math.hypot(x - vx, y - vy);
    if (d > MAX) continue;
    const n = Math.ceil(d / (Z / 2));
    for (let k = 1; k < n; k++) setze(vx + ((x - vx) * k) / n, vy + ((y - vy) * k) / n);
  }

  // 2. verbreitern (Scheibe mit Radius R)
  const scheibe: [number, number][] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) scheibe.push([dx, dy]);
  const breit = new Uint8Array(B * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) if (feld[y * B + x])
    for (const [dx, dy] of scheibe) breit[(y + dy) * B + (x + dx)] = 1;

  // 3. von außen fluten
  const aussen = new Uint8Array(B * H);
  const stapel = [0];
  aussen[0] = 1;
  while (stapel.length) {
    const i = stapel.pop()!;
    const x = i % B, y = (i - x) / B;
    for (const j of [x > 0 ? i - 1 : -1, x < B - 1 ? i + 1 : -1, y > 0 ? i - B : -1, y < H - 1 ? i + B : -1])
      if (j >= 0 && !aussen[j] && !breit[j]) { aussen[j] = 1; stapel.push(j); }
  }

  // 4. schmälern: innen bleibt nur, was eine ganze Scheibe innen hat
  const innen = new Uint8Array(B * H);
  for (let y = R; y < H - R; y++) for (let x = R; x < B - R; x++) {
    if (aussen[y * B + x]) continue;
    let voll = true;
    for (const [dx, dy] of scheibe) if (aussen[(y + dy) * B + (x + dx)]) { voll = false; break; }
    if (voll) innen[y * B + x] = 1;
  }
  // Öffnen um eine Zelle: was nur eine Zelle breit ist (eine einzelne Bahn ohne Randfahrt), fällt weg
  const kern = new Uint8Array(B * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < B - 1; x++) {
    const i = y * B + x;
    if (innen[i] && innen[i - 1] && innen[i + 1] && innen[i - B] && innen[i + B]) kern[i] = 1;
  }
  innen.fill(0);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < B - 1; x++) {
    const i = y * B + x;
    if (kern[i]) { innen[i] = innen[i - 1] = innen[i + 1] = innen[i - B] = innen[i + B] = 1; }
  }
  // größte zusammenhängende Fläche
  const marke = new Int32Array(B * H);
  let beste = 0, besteGroesse = 0, nr = 0;
  for (let s = 0; s < B * H; s++) {
    if (!innen[s] || marke[s]) continue;
    nr++; let groesse = 0; const st = [s]; marke[s] = nr;
    while (st.length) {
      const i = st.pop()!; groesse++;
      const x = i % B;
      for (const j of [x > 0 ? i - 1 : -1, x < B - 1 ? i + 1 : -1, i - B, i + B])
        if (j >= 0 && j < B * H && innen[j] && !marke[j]) { marke[j] = nr; st.push(j); }
    }
    if (groesse > besteGroesse) { besteGroesse = groesse; beste = nr; }
  }
  if (besteGroesse * Z * Z < 4) return null; // unter 4 m²: kein Rasen, nur Spurgekritzel
  const drin = (x: number, y: number) => x >= 0 && y >= 0 && x < B && y < H && marke[y * B + x] === beste;

  // 5. Umriss: Marching Squares auf den Zellmitten, Kanten zu einer Schleife verketten
  const kanten = new Map<string, string[]>();
  const schluessel = (x: number, y: number) => `${x},${y}`;
  const kante = (a: [number, number], b: [number, number]) => {
    const ka = schluessel(...a), kb = schluessel(...b);
    (kanten.get(ka) ?? kanten.set(ka, []).get(ka)!).push(kb);
    (kanten.get(kb) ?? kanten.set(kb, []).get(kb)!).push(ka);
  };
  // Zellränder zwischen innen und außen sind die Grenze (Kantenpunkte doppelt skaliert: ganzzahlig)
  for (let y = -1; y < H; y++) for (let x = -1; x < B; x++) {
    const a = drin(x, y), r = drin(x + 1, y), u = drin(x, y + 1);
    if (a !== r) kante([2 * x + 1, 2 * y - 1], [2 * x + 1, 2 * y + 1]);
    if (a !== u) kante([2 * x - 1, 2 * y + 1], [2 * x + 1, 2 * y + 1]);
  }
  const schleifen: Punkt2[][] = [];
  const besucht = new Set<string>();
  for (const start of kanten.keys()) {
    if (besucht.has(start)) continue;
    const ring: string[] = [start]; besucht.add(start);
    let vor = start, jetzt = kanten.get(start)![0];
    while (jetzt && jetzt !== start) {
      ring.push(jetzt); besucht.add(jetzt);
      const weiter = kanten.get(jetzt)!.find((k) => k !== vor && !besucht.has(k)) ?? kanten.get(jetzt)!.find((k) => k === start && ring.length > 2);
      vor = jetzt; jetzt = weiter as string;
    }
    schleifen.push(ring.map((k) => { const [gx, gy] = k.split(",").map(Number); return [minX + ((gx / 2) - rand) * Z, minY + ((gy / 2) - rand) * Z]; }));
  }
  if (!schleifen.length) return null;
  const aussenring = schleifen.reduce((a, b) => (b.length > a.length ? b : a));
  return glaetten(vereinfachen(aussenring, Z * 0.9), 2);
}

/** Douglas-Peucker auf einem geschlossenen Ring */
export function vereinfachen(ring: Punkt2[], eps: number): Punkt2[] {
  if (ring.length < 4) return ring;
  const dp = (pts: Punkt2[]): Punkt2[] => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const l = Math.hypot(bx - ax, by - ay) || 1e-9;
    let weit = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / l;
      if (d > weit) { weit = d; idx = i; }
    }
    if (weit <= eps) return [pts[0], pts[pts.length - 1]];
    return [...dp(pts.slice(0, idx + 1)).slice(0, -1), ...dp(pts.slice(idx))];
  };
  const mitte = Math.floor(ring.length / 2);
  return [...dp(ring.slice(0, mitte + 1)).slice(0, -1), ...dp([...ring.slice(mitte), ring[0]]).slice(0, -1)];
}

/** Chaikin: Ecken weich abrunden wie die gezeichnete Grenze der App */
export function glaetten(ring: Punkt2[], runden: number): Punkt2[] {
  let r = ring;
  for (let k = 0; k < runden; k++) {
    const n: Punkt2[] = [];
    for (let i = 0; i < r.length; i++) {
      const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length];
      n.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    r = n;
  }
  return r;
}

/** Fläche eines Rings in m² (Gaußsche Trapezformel) — für Tests und Plausibilität */
export function flaeche(ring: Punkt2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) { const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]; s += ax * by - bx * ay; }
  return Math.abs(s) / 2;
}
