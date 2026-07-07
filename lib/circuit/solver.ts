// Deterministic DC circuit solver — Modified Nodal Analysis (MNA) with
// Newton-Raphson for nonlinear devices (diodes/LEDs). This is the correctness
// core of the free-form Electrical Engineering lab: given a netlist of
// components joined at numbered nodes (node 0 = ground), it returns every node
// voltage and every component current. No AI, no guessing — real numerics.
//
// Validated against golden circuits (see scratchpad/circuit-test):
//   • Ohm's law & voltage dividers  → exact
//   • LED + 470Ω from 9V            → Vf ≈ 1.93 V, I ≈ 15 mA
//   • reverse-biased LED            → ≈ 0 mA
//
// Supported now: resistor (R), DC voltage source (V), current source (I),
// diode/LED (D, Shockley), switch (SW). Capacitors/inductors (transient) and
// transistors come next as separate stamping + a time-stepping wrapper.

const VT = 0.025852;      // thermal voltage @ ~300 K
const GMIN = 1e-12;       // tiny leak to ground per node — keeps the matrix non-singular
const SW_ON = 1e-3;       // closed switch resistance (Ω)
const SW_OFF = 1e12;      // open switch resistance (Ω)

export type CompType = 'R' | 'V' | 'I' | 'D' | 'SW';

export interface Comp {
  id: string;
  type: CompType;
  a: number;              // first terminal node (D: anode, V: + terminal)
  b: number;              // second terminal node (D: cathode, V: − terminal)
  value?: number;         // R: ohms, V: volts, I: amps
  is?: number;            // D: saturation current (default 1e-14; red LED ≈ 1e-18)
  n?: number;             // D: emission coefficient (default 1; red LED ≈ 2)
  closed?: boolean;       // SW: true = closed
}

export interface DCResult {
  converged: boolean;
  iters: number;
  nodeVoltages: number[];              // index by node id; [0] = 0 (ground)
  currents: Record<string, number>;    // component id → current (A), a→b positive
}

// Gaussian elimination with partial pivoting.
function linsolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-20) continue;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = Math.abs(M[i][i]) < 1e-20 ? 0 : M[i][n] / M[i][i];
  return x;
}

// SPICE junction limiting — stops exp() overflow and keeps Newton stable.
function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vnew > 0 ? vt * Math.log(vnew / vt) : vcrit;
    }
  }
  return vnew;
}

function resistanceOf(c: Comp): number {
  if (c.type === 'R') return Math.max(c.value ?? 1e-9, 1e-9);
  if (c.type === 'SW') return c.closed ? SW_ON : SW_OFF;
  return 0;
}

/**
 * Solve the DC operating point of a netlist.
 * Nodes are non-negative integers; node 0 is ground. Nonlinear devices are
 * resolved by Newton-Raphson (up to `maxIters`), each iteration re-solving the
 * linearized MNA system.
 */
export function solveDC(components: Comp[], maxIters = 200): DCResult {
  let numNodes = 0;
  for (const c of components) numNodes = Math.max(numNodes, c.a, c.b);

  const vsrc = components.filter((c) => c.type === 'V');
  const size = numNodes + vsrc.length;
  if (size === 0) {
    return { converged: true, iters: 0, nodeVoltages: [0], currents: {} };
  }

  const diodes = components.filter((c) => c.type === 'D');
  const vdPrev = new Map<Comp, number>(diodes.map((d) => [d, 0.6]));
  let V = new Array(numNodes + 1).fill(0);
  let vBranch: number[] = new Array(vsrc.length).fill(0); // V-source branch currents
  let converged = false;
  let usedIters = maxIters;

  for (let iter = 0; iter < maxIters; iter++) {
    const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const z = new Array(size).fill(0);
    let maxVdDelta = 0;

    const addG = (a: number, b: number, g: number) => {
      if (a) A[a - 1][a - 1] += g;
      if (b) A[b - 1][b - 1] += g;
      if (a && b) { A[a - 1][b - 1] -= g; A[b - 1][a - 1] -= g; }
    };
    for (let i = 1; i <= numNodes; i++) A[i - 1][i - 1] += GMIN;

    for (const c of components) {
      if (c.type === 'R' || c.type === 'SW') {
        addG(c.a, c.b, 1 / resistanceOf(c));
      } else if (c.type === 'I') {
        if (c.a) z[c.a - 1] -= c.value ?? 0;
        if (c.b) z[c.b - 1] += c.value ?? 0;
      } else if (c.type === 'D') {
        const is = c.is ?? 1e-14;
        const vtn = (c.n ?? 1) * VT;
        const vcrit = vtn * Math.log(vtn / (Math.SQRT2 * is));
        const vdOld = vdPrev.get(c) ?? 0.6;
        let vd = V[c.a] - V[c.b];
        vd = pnjlim(vd, vdOld, vtn, vcrit);
        maxVdDelta = Math.max(maxVdDelta, Math.abs(vd - vdOld));
        vdPrev.set(c, vd);
        const ex = Math.exp(Math.min(vd / vtn, 100));
        const id = is * (ex - 1);
        const geq = (is / vtn) * ex + GMIN;
        const ieq = id - geq * vd;
        addG(c.a, c.b, geq);
        if (c.a) z[c.a - 1] -= ieq;
        if (c.b) z[c.b - 1] += ieq;
      }
    }
    vsrc.forEach((c, k) => {
      const br = numNodes + k;
      if (c.a) { A[c.a - 1][br] += 1; A[br][c.a - 1] += 1; }
      if (c.b) { A[c.b - 1][br] -= 1; A[br][c.b - 1] -= 1; }
      z[br] = c.value ?? 0;
    });

    const x = linsolve(A, z);
    const Vnew = new Array(numNodes + 1).fill(0);
    for (let i = 1; i <= numNodes; i++) Vnew[i] = x[i - 1];
    vBranch = vsrc.map((_, k) => x[numNodes + k]);

    let maxd = 0;
    for (let i = 1; i <= numNodes; i++) maxd = Math.max(maxd, Math.abs(Vnew[i] - V[i]));
    V = Vnew;

    // Converge only when node voltages AND every diode operating point settle.
    if (maxd < 1e-7 && maxVdDelta < 1e-7 && iter > 0) {
      converged = true; usedIters = iter; break;
    }
  }

  // Component currents (a→b positive) from the converged node voltages.
  const currents: Record<string, number> = {};
  for (const c of components) {
    if (c.type === 'R' || c.type === 'SW') {
      currents[c.id] = (V[c.a] - V[c.b]) / resistanceOf(c);
    } else if (c.type === 'I') {
      currents[c.id] = c.value ?? 0;
    } else if (c.type === 'D') {
      const is = c.is ?? 1e-14;
      const vtn = (c.n ?? 1) * VT;
      const vd = V[c.a] - V[c.b];
      currents[c.id] = is * (Math.exp(Math.min(vd / vtn, 100)) - 1);
    }
  }
  // Voltage-source currents are solved MNA branch unknowns (exact).
  vsrc.forEach((c, k) => { currents[c.id] = vBranch[k]; });

  return { converged, iters: usedIters, nodeVoltages: V, currents };
}
