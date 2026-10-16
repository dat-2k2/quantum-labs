// Tiny state-vector simulator. Qubit 0 is the least-significant bit (Qiskit convention),
// and bitstrings are printed most-significant first, so they read the same as Qiskit's counts.

const S2 = Math.SQRT1_2;

// 2x2 complex matrices, row-major: [m00, m01, m10, m11], each entry [re, im]
export const GATES = {
  I: [[1, 0], [0, 0], [0, 0], [1, 0]],
  H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
  X: [[0, 0], [1, 0], [1, 0], [0, 0]],
  Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
  Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
  S: [[1, 0], [0, 0], [0, 0], [0, 1]],
  SDG: [[1, 0], [0, 0], [0, 0], [0, -1]],
  T: [[1, 0], [0, 0], [0, 0], [S2, S2]],
  TDG: [[1, 0], [0, 0], [0, 0], [S2, -S2]],
};
export const phaseGate = (theta) => [[1, 0], [0, 0], [0, 0], [Math.cos(theta), Math.sin(theta)]];
export const ryGate = (theta) => {
  const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
  return [[c, 0], [-s, 0], [s, 0], [c, 0]];
};

const maskOf = (qs = []) => qs.reduce((m, q) => m | (1 << q), 0);

export class State {
  constructor(n) {
    this.n = n;
    this.N = 1 << n;
    this.re = new Float64Array(this.N);
    this.im = new Float64Array(this.N);
    this.re[0] = 1;
  }

  clone() {
    const s = new State(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }

  // Apply a 2x2 matrix to qubit q, optionally controlled on all qubits in `controls` being |1>.
  apply1(q, m, controls = []) {
    const bit = 1 << q, cm = maskOf(controls);
    const [[ar, ai], [br, bi], [cr, ci], [dr, di]] = m;
    const { re, im, N } = this;
    for (let i = 0; i < N; i++) {
      if (i & bit || (i & cm) !== cm) continue;
      const j = i | bit;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = ar * xr - ai * xi + br * yr - bi * yi;
      im[i] = ar * xi + ai * xr + br * yi + bi * yr;
      re[j] = cr * xr - ci * xi + dr * yr - di * yi;
      im[j] = cr * xi + ci * xr + dr * yi + di * yr;
    }
  }

  swap(a, b, controls = []) {
    const ba = 1 << a, bb = 1 << b, cm = maskOf(controls);
    const { re, im, N } = this;
    for (let i = 0; i < N; i++) {
      if (!(i & ba) || i & bb || (i & cm) !== cm) continue;
      const j = (i & ~ba) | bb;
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Permute the sub-register `targets` (LSB first) by y -> fn(y) when all controls are set.
  permute(targets, fn, controls = []) {
    const cm = maskOf(controls), tm = maskOf(targets);
    const re = new Float64Array(this.N), im = new Float64Array(this.N);
    for (let i = 0; i < this.N; i++) {
      let j = i;
      if ((i & cm) === cm) {
        let y = 0;
        targets.forEach((t, k) => { if (i & (1 << t)) y |= 1 << k; });
        const fy = fn(y);
        j = i & ~tm;
        targets.forEach((t, k) => { if (fy & (1 << k)) j |= 1 << t; });
      }
      re[j] = this.re[i];
      im[j] = this.im[i];
    }
    this.re = re;
    this.im = im;
  }

  // Multiply each basis amplitude by -1 where pred(index) is true.
  flipPhase(pred) {
    for (let i = 0; i < this.N; i++) if (pred(i)) { this.re[i] = -this.re[i]; this.im[i] = -this.im[i]; }
  }

  prob(i) { return this.re[i] * this.re[i] + this.im[i] * this.im[i]; }
  probs() { return Array.from({ length: this.N }, (_, i) => this.prob(i)); }

  // Projective measurement of qubit q; collapses the state and returns 0 or 1.
  measure(q, rng = Math.random) {
    const bit = 1 << q;
    let p1 = 0;
    for (let i = 0; i < this.N; i++) if (i & bit) p1 += this.prob(i);
    const out = rng() < p1 ? 1 : 0;
    const norm = Math.sqrt(out ? p1 : 1 - p1) || 1;
    for (let i = 0; i < this.N; i++) {
      if (((i & bit) ? 1 : 0) !== out) { this.re[i] = 0; this.im[i] = 0; }
      else { this.re[i] /= norm; this.im[i] /= norm; }
    }
    return out;
  }

  // Marginal distribution over `qubits`; key is a bitstring with qubits[last] first (like Qiskit clbits).
  marginal(qubits) {
    const dist = new Map();
    for (let i = 0; i < this.N; i++) {
      const p = this.prob(i);
      if (p < 1e-12) continue;
      let key = '';
      for (let k = qubits.length - 1; k >= 0; k--) key += (i >> qubits[k]) & 1;
      dist.set(key, (dist.get(key) || 0) + p);
    }
    return dist;
  }

  sample(qubits, shots, rng = Math.random) {
    return sampleDist(this.marginal(qubits), shots, rng);
  }

  // 2x2 reduced density matrix of qubit q: [[r00, r01], [r10, r11]] as [re, im] pairs.
  reduced(q) {
    const bit = 1 << q;
    let r00 = 0, r11 = 0, r01r = 0, r01i = 0;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      r00 += this.prob(i);
      r11 += this.prob(j);
      // a_i * conj(a_j)
      r01r += this.re[i] * this.re[j] + this.im[i] * this.im[j];
      r01i += this.im[i] * this.re[j] - this.re[i] * this.im[j];
    }
    return { r00, r11, r01r, r01i };
  }

  // Bloch vector of qubit q (works for mixed reduced states too).
  bloch(q) {
    const { r00, r11, r01r, r01i } = this.reduced(q);
    return { x: 2 * r01r, y: -2 * r01i, z: r00 - r11 };
  }
}

export function sampleDist(dist, shots, rng = Math.random) {
  const entries = [...dist.entries()];
  const counts = new Map();
  for (let s = 0; s < shots; s++) {
    let r = rng(), acc = 0, pick = entries[entries.length - 1][0];
    for (const [k, p] of entries) { acc += p; if (r < acc) { pick = k; break; } }
    counts.set(pick, (counts.get(pick) || 0) + 1);
  }
  return counts;
}

// ---------- Circuit ops ----------
// { g: 'H'|'X'|'Y'|'Z'|'S'|'T'|'SDG'|'TDG', t: [q], c?: [controls] }
// { g: 'P', p: theta, t: [q], c?: [...] }      phase gate / controlled phase
// { g: 'RY', p: theta, t: [q] }
// { g: 'SWAP', t: [a, b] }
// { g: 'PERM', t: [...], fn, c?: [...], label }  basis permutation on a sub-register
// { g: 'ORACLE', t: [...], pred, label }         phase oracle: flips sign where pred(i)
// { g: 'BLOCK', t: [...], ops: [...], label }    grouped sub-circuit
// { g: 'INIT', t: [q], m: matrix, label }        state preparation from |0>
// { g: 'M', t: [q] }, { g: 'BARRIER' }           drawing only

export function applyOp(state, op) {
  switch (op.g) {
    case 'M': case 'BARRIER': return;
    case 'SWAP': return state.swap(op.t[0], op.t[1], op.c);
    case 'P': return state.apply1(op.t[0], phaseGate(op.p), op.c);
    case 'RY': return state.apply1(op.t[0], ryGate(op.p), op.c);
    case 'PERM': return state.permute(op.t, op.fn, op.c);
    case 'ORACLE': return state.flipPhase(op.pred);
    case 'INIT': case 'U': return state.apply1(op.t[0], op.m, op.c);
    case 'BLOCK': for (const o of op.ops) applyOp(state, o); return;
    default: {
      const m = GATES[op.g];
      if (!m) throw new Error('Unknown gate ' + op.g);
      return state.apply1(op.t[0], m, op.c);
    }
  }
}

export function run(n, ops, state = new State(n)) {
  for (const op of ops) applyOp(state, op);
  return state;
}

// Inverse of an op list (reverse order, adjoint gates).
export function inverse(ops) {
  const adj = { S: 'SDG', SDG: 'S', T: 'TDG', TDG: 'T' };
  return ops.slice().reverse().map((op) => {
    if (op.g === 'P' || op.g === 'RY') return { ...op, p: -op.p };
    if (adj[op.g]) return { ...op, g: adj[op.g] };
    if (op.g === 'BLOCK') return { ...op, ops: inverse(op.ops) };
    return op;
  });
}

// QFT on qubits[0..n-1] matching the coursework notebook (equals the orthonormal inverse DFT).
export function qftOps(qubits) {
  const n = qubits.length, ops = [];
  for (let i = n - 1; i >= 0; i--) {
    ops.push({ g: 'H', t: [qubits[i]] });
    for (let j = 0; j < i; j++) ops.push({ g: 'P', p: Math.PI / 2 ** (i - j), c: [qubits[j]], t: [qubits[i]], label: `π/${2 ** (i - j)}` });
  }
  for (let i = 0; i < Math.floor(n / 2); i++) ops.push({ g: 'SWAP', t: [qubits[i], qubits[n - 1 - i]] });
  return ops;
}

// ---------- small math helpers ----------
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => (a && b ? (a / gcd(a, b)) * b : Math.max(a, b));
export const modpow = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
export const toBits = (x, n) => x.toString(2).padStart(n, '0');
export const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

// Python's Fraction(x).limit_denominator(maxDen), via continued fractions.
export function limitDenominator(x, maxDen) {
  let p0 = 0, q0 = 1, p1 = 1, q1 = 0, v = x;
  for (let k = 0; k < 64; k++) {
    const a = Math.floor(v);
    const q2 = q0 + a * q1;
    if (q2 > maxDen) break;
    [p0, q0, p1, q1] = [p1, q1, p0 + a * p1, q2];
    if (Math.abs(v - a) < 1e-12) break;
    v = 1 / (v - a);
  }
  if (q1 === 0) return [Math.round(x), 1];
  const k = Math.floor((maxDen - q0) / q1);
  const b1 = [p0 + k * p1, q0 + k * q1], b2 = [p1, q1];
  const best = Math.abs(b2[0] / b2[1] - x) <= Math.abs(b1[0] / b1[1] - x) ? b2 : b1;
  const g = gcd(best[0], best[1]);
  return [best[0] / g, best[1] / g];
}
