/**
 * Pixel campfire for the fireplace tile — a line-by-line port of the Kaminwacht firmware/app
 * (`kamin::Lagerfeuer`, 32 × 32 cells). Each cell carries a layer: 1 log edge, 2 log, 3 bark, 4 flame outer,
 * 5 middle, 6 core, 7 ember, 8 spark, 9 log end. `test/kamin.test.ts` compares it with reference frames
 * written by the firmware's host test. Computed in float32 like the C++ original so the same cells come out.
 */
const N = 32;
const f = Math.fround;
const Z = [[0, 1, 1, 0], [-0.42, 0.7, 0.62, 1.7], [0.4, 0.74, 0.62, 3.1], [-0.74, 0.42, 0.42, 4.4], [0.72, 0.46, 0.42, 5.6]].map((r) => r.map(f));
const LAGE = [[4, 1, 1], [5, 0.7, 0.62], [6, 0.42, 0.3]].map((r) => r.map(f));

/** colours per layer (ARGB strings), embers flicker between two reds */
const FARBE = ["", "#5c2c12", "#8b4a1f", "#6c3616", "#e24a2a", "#f08d33", "#fbf3c1", "#ff5c20", "#e24a2a", "#f3d6a8"];
const GLUT_DUNKEL = "#be2814";

export class Lagerfeuer {
  static readonly N = N;
  readonly e = new Uint8Array(N * N);
  private funken = Array.from({ length: 8 }, () => ({ x: 0, y: 0, dx: 0, l: 0 }));
  private zufall = 12345;

  /** same linear random as in C++ (uint32: ×1664525 + 1013904223) so sparks fly the same */
  private zuf(): number {
    this.zufall = (Math.imul(this.zufall, 1664525) + 1013904223) >>> 0;
    return f((this.zufall >>> 8) / 16777216);
  }

  private static lround(x: number): number { return x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5); }

  private setz(x: number, y: number, v: number) {
    const ix = Lagerfeuer.lround(x), iy = Lagerfeuer.lround(y);
    if (ix >= 0 && ix < N && iy >= 0 && iy < N) this.e[iy * N + ix] = v;
  }

  private scheit(x1: number, y1: number, x2: number, y2: number, d: number) {
    const dx = f(x2 - x1), dy = f(y2 - y1), l2 = f(f(dx * dx) + f(dy * dy)), l = f(Math.sqrt(l2));
    for (let y = Math.floor(Math.min(y1, y2) - d - 1); y <= Math.ceil(Math.max(y1, y2) + d + 1); y++)
      for (let x = Math.floor(Math.min(x1, x2) - d - 1); x <= Math.ceil(Math.max(x1, x2) + d + 1); x++) {
        const t = f(Math.max(0, Math.min(1, f(f(f(f(x - x1) * dx) + f(f(y - y1) * dy)) / l2))));
        const a = f(Math.hypot(f(x - f(x1 + f(t * dx))), f(y - f(y1 + f(t * dy)))));
        if (a > d) continue;
        let v = a > f(d - 1.1) ? 1 : 2;
        const ende = f(Math.hypot(f(x - x1), f(y - y1)));
        if (t <= 0 && ende <= d) v = ende > f(d - 1.1) ? 1 : 9;
        else if (v === 2 && Math.abs(f(a - f(d * 0.35))) < 0.5 && Lagerfeuer.lround(f(t * l)) % 7 < 2) v = 3;
        this.setz(x, y, v);
      }
  }

  private zunge(cx: number, basis: number, h: number, w: number, ebene: number, zeit: number, phase: number) {
    if (h < 2 || w < 1) return;
    for (let y = Math.floor(basis - h); y <= Math.trunc(basis); y++) {
      const t = f(f(basis - y) / h);
      const bogen = f(Math.pow(f(Math.sin(f(3.14159 * f(0.2 + f(0.8 * t))))), 0.75));
      const b = f(f(w * bogen) * f(1 - f(0.35 * t)));
      const welle = f(Math.sin(f(f(f(zeit * 5.5) + phase) + f(t * 2.6))));
      const m = f(cx + f(f(f(f(welle * w) * 0.45) * t) * t));
      for (let x = Math.floor(m - b); x <= Math.ceil(m + b); x++) if (Math.abs(x - m) <= b) this.setz(x, y, ebene);
    }
  }

  /** k = fire strength 0–1 (from the Kaminwacht), zeit in seconds */
  malen(k: number, zeit: number, cx = 16, basis = 25, gr = 25) {
    k = f(k); zeit = f(zeit);
    this.e.fill(0);
    const sb = f(gr * 0.95), d = f(Math.max(2.5, f(gr * 0.09)));
    this.scheit(f(cx - f(sb * 0.55)), f(basis + f(d * 2.2)), f(cx + f(sb * 0.5)), f(basis - f(d * 0.2)), d);
    // below 0.18 only embers, no flame
    const n = k < 0.18 ? 0 : k < 0.3 ? 1 : k < 0.45 ? 2 : k < 0.7 ? 3 : 5;
    const hoch = f(gr * f(0.3 + f(0.7 * k))), breit = f(gr * f(0.17 + f(0.13 * k)));
    const z = f(Math.floor(zeit * 8) / 8);
    for (const lage of LAGE)
      for (let i = 0; i < (n === 2 ? 3 : n); i++) {
        if (n === 2 && i === 0) continue;
        const zz = Z[i];
        const fl = f(1 + f(0.1 * f(Math.sin(f(f(z * 9) + f(zz[3] * 2))))) + f(0.06 * f(Math.sin(f(f(z * 23) + zz[3])))));
        this.zunge(f(cx + f(f(zz[0] * breit) * 2.1)), f(basis + f(d * 0.6)), f(f(f(hoch * zz[1]) * lage[1]) * fl),
          f(f(breit * zz[2]) * lage[2]), lage[0], z, zz[3]);
      }
    this.scheit(f(cx + f(sb * 0.55)), f(basis + f(d * 2.2)), f(cx - f(sb * 0.5)), f(basis - f(d * 0.2)), d);
    if (k < 0.3) {
      const anz = k === 0 ? 3 : 7;
      for (let i = 0; i < anz; i++) {
        const s = f(f(Math.sin(f(f(i * 12.9898) + f(Math.floor(zeit * 3) * 78.233)))) * 43758.5453);
        if (s - Math.floor(s) < 0.55) this.setz(f(cx + f(f(i - anz / 2) * f(sb * 0.14))), f(basis + f(d * f(0.4 + (i % 2)))), 7);
      }
    }
    if (this.zuf() < f(f(k * k) * 0.8))
      for (const s of this.funken) if (s.l <= 0) {
        s.x = f(cx + f(f(this.zuf() - 0.5) * breit) * 2);
        s.y = f(basis - f(hoch * 0.8));
        s.dx = f(f(this.zuf() - 0.5) * 0.6);
        s.l = Math.trunc(f(8 + f(this.zuf() * 14)));
        break;
      }
    for (const s of this.funken) if (s.l > 0) { s.y = f(s.y - 1); s.x = f(s.x + s.dx); s.l--; this.setz(s.x, s.y, 8); }
  }

  /** colour of a cell; empty cells get the background that warms up at the bottom with the strength */
  static farbe(ebene: number, feld: number, k: number, zeit: number): string {
    if (ebene === 7) return (Math.floor(zeit * 3) + feld) % 3 !== 0 ? FARBE[7] : GLUT_DUNKEL;
    if (ebene >= 1 && ebene <= 9) return FARBE[ebene];
    const y = feld >> 5;
    const g = Math.max(0, 1 - Math.abs(y - 22) / 18) * k;
    return `rgb(${Math.trunc(20 + 40 * g)},${Math.trunc(13 + 14 * g)},10)`;
  }
}
