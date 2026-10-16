// The eleven labs. Each lab has static metadata plus:
//   init()                -> initial state object
//   controls(st, set)     -> DOM nodes for the controls panel
//   compute(st, set)      -> { n, ops, wireLabels?, expand?, results: Node[], extra?: Node[] }
// `set(patch)` merges into the state and re-renders the lab.

import { State, run, applyOp, qftOps, inverse, sampleDist, ryGate, phaseGate, gcd, lcm, modpow, toBits, limitDenominator } from './sim.js';
import { histogram, ampBars, phaseWheels, bloch, lineChart } from './viz.js';
import { el, slider, bits, segmented, toggle, button, shotsControl, verdict } from './ui.js';

const range = (n, from = 0) => Array.from({ length: n }, (_, i) => i + from);
const Hs = (qs) => qs.map((q) => ({ g: 'H', t: [q] }));
const Ms = (qs) => qs.map((q) => ({ g: 'M', t: [q] }));
const BAR = { g: 'BARRIER' };
const html = (s) => el('div', { html: s });
const note = (s) => el('p', { class: 'note', html: s });
const randInt = (n) => Math.floor(Math.random() * n);
const REPO = 'https://github.com/dat-2k2/quantum-labs/blob/main/';

// ----------------------------------------------------------------------------
const qrng = {
  id: 'qrng', title: 'Quantum RNG', cat: 'Randomness',
  desc: 'Superposition + measurement = true random bits. Generate numbers and watch the histogram flatten.',
  source: 'using_circuit/qrng.ipynb',
  steps: [
    ['Prepare', 'Every qubit starts in |0⟩.'],
    ['Superpose', 'H puts each qubit in (|0⟩ + |1⟩)/√2 — a perfect coin.'],
    ['Measure', 'Each measurement returns 0 or 1 with probability ½, independently.'],
  ],
  init: () => ({ n: 4, shots: 1000 }),
  controls: (st, set) => [
    slider('Qubits n', { min: 1, max: 8, value: st.n, onInput: (n) => set({ n }) }),
    shotsControl(st.shots, (shots) => set({ shots })),
    button('▶  Roll again', () => set({})),
  ],
  compute(st) {
    const qs = range(st.n);
    const ops = [...Hs(qs), ...Ms(qs)];
    const state = run(st.n, ops);
    const counts = state.sample(qs, st.shots);
    const one = [...state.sample(qs, 1).keys()][0];
    return {
      n: st.n, ops,
      results: [
        verdict('Your random number', `${parseInt(one, 2)}`, `binary ${one} · range 0 – ${2 ** st.n - 1}`),
        html(histogram(counts, { sort: 'key', limit: 16, label: (k) => `${k}  (${parseInt(k, 2)})` })),
        note(`Ideal: each of the ${2 ** st.n} outcomes appears ≈ ${(st.shots / 2 ** st.n).toFixed(1)} times.`),
      ],
      facts: { n: st.n, number: parseInt(one, 2) },
    };
  },
};

// ----------------------------------------------------------------------------
function djOracle(n, kind, mask) {
  if (kind === 'const1') return [{ g: 'X', t: [n] }];
  if (kind === 'balanced') return range(n).filter((i) => mask & (1 << i)).map((i) => ({ g: 'X', c: [i], t: [n] }));
  return [];
}
const randomDJ = (n) => {
  const kind = ['const0', 'const1', 'balanced'][randInt(3)];
  return { kind, mask: 1 + randInt(2 ** n - 1) };
};
const deutschJozsa = {
  id: 'dj', title: 'Deutsch–Jozsa', cat: 'Oracles',
  desc: 'Decide if a hidden function is constant or balanced with a single query.',
  source: 'using_circuit/deustsch_josza.ipynb',
  steps: [
    ['Superpose', 'H on the inputs; the ancilla is prepared in |−⟩ = H X |0⟩.'],
    ['Phase kickback', 'U_f writes f(x) into the phase: (−1)^f(x) |x⟩.'],
    ['Interfere', 'After H again, |0…0⟩ has amplitude 1 if f is constant and 0 if balanced.'],
  ],
  init: () => ({ n: 3, kind: 'balanced', mask: 0b101, shots: 1000, expand: true, mystery: null, reveal: false }),
  controls(st, set) {
    const nodes = [
      slider('Input qubits n', { min: 1, max: 6, value: st.n, onInput: (n) => set({ n, mask: Math.min(st.mask, 2 ** n - 1) || 1, mystery: st.mystery && randomDJ(n), reveal: false }) }),
      segmented('Oracle f', {
        options: [['const0', 'f = 0'], ['const1', 'f = 1'], ['balanced', 'Balanced'], ['mystery', '?']],
        value: st.kind, onChange: (kind) => set({ kind, mystery: kind === 'mystery' ? randomDJ(st.n) : null, reveal: false }),
      }),
    ];
    if (st.kind === 'balanced') nodes.push(bits('Balanced mask  f(x) = mask·x', { n: st.n, value: st.mask, onChange: (m) => m && set({ mask: m }) }));
    if (st.kind === 'mystery') nodes.push(button('↻  New mystery oracle', () => set({ mystery: randomDJ(st.n), reveal: false }), 'ghost'));
    nodes.push(shotsControl(st.shots, (shots) => set({ shots })));
    if (st.kind !== 'mystery' || st.reveal) nodes.push(toggle('Show inside the oracle', { value: st.expand, onChange: (expand) => set({ expand }) }));
    nodes.push(button('▶  Run circuit', () => set({})));
    return nodes;
  },
  compute(st, set) {
    const n = st.n, qs = range(n);
    const o = st.kind === 'mystery' ? st.mystery : { kind: st.kind, mask: st.mask };
    const hidden = st.kind === 'mystery' && !st.reveal;
    const ops = [{ g: 'X', t: [n] }, ...Hs(range(n + 1)), BAR,
      { g: 'BLOCK', t: range(n + 1), ops: djOracle(n, o.kind, o.mask), label: hidden ? 'U_f = ?' : 'U_f' }, BAR, ...Hs(qs), ...Ms(qs)];
    const counts = run(n + 1, ops).sample(qs, st.shots);
    const zero = '0'.repeat(n);
    const constant = (counts.get(zero) || 0) === st.shots;
    const name = { const0: 'f(x) = 0', const1: 'f(x) = 1', balanced: `balanced, mask ${toBits(o.mask, n)}` }[o.kind];
    const results = [
      html(histogram(counts, { highlight: (k) => k === zero })),
      verdict('Verdict after 1 query', constant ? 'CONSTANT' : 'BALANCED',
        `P(|${zero}⟩) = ${((counts.get(zero) || 0) / st.shots).toFixed(2)} · a classical computer may need ${2 ** (n - 1) + 1} queries`),
    ];
    if (st.kind === 'mystery') results.push(st.reveal ? note(`The oracle was <b>${name}</b>.`) : button('Reveal the oracle', () => set({ reveal: true }), 'ghost'));
    return { n: n + 1, ops, expand: st.expand && !hidden, wireLabels: [...qs.map((q) => `q${q}`), 'anc'], results,
      facts: { n, kind: st.kind, mask: st.mask, constant, reveal: st.reveal } };
  },
};

// ----------------------------------------------------------------------------
const bernsteinVazirani = {
  id: 'bv', title: 'Bernstein–Vazirani', cat: 'Oracles',
  desc: 'Recover a secret bitstring s from f(x) = s·x in one shot.',
  source: 'using_circuit/bernstein_vazirani.ipynb',
  steps: [
    ['Superpose', 'H on every input qubit; ancilla prepared in |−⟩.'],
    ['Query', 'The oracle kicks back the phase (−1)^(s·x).'],
    ['Interfere', 'H again maps the phase pattern straight onto |s⟩.'],
  ],
  init: () => ({ n: 6, s: 0b011010, shots: 1000, expand: true }),
  controls: (st, set) => [
    slider('Qubits n', { min: 1, max: 9, value: st.n, onInput: (n) => set({ n, s: st.s & (2 ** n - 1) }) }),
    bits('Secret s', { n: st.n, value: st.s, onChange: (s) => set({ s }) }),
    shotsControl(st.shots, (shots) => set({ shots })),
    toggle('Show inside the oracle', { value: st.expand, onChange: (expand) => set({ expand }) }),
    button('▶  Run circuit', () => set({})),
  ],
  compute(st) {
    const n = st.n, qs = range(n);
    const oracle = qs.filter((i) => st.s & (1 << i)).map((i) => ({ g: 'X', c: [i], t: [n] }));
    const ops = [{ g: 'X', t: [n] }, ...Hs(range(n + 1)), BAR, { g: 'BLOCK', t: range(n + 1), ops: oracle, label: 'U_f' }, BAR, ...Hs(qs), ...Ms(qs)];
    const counts = run(n + 1, ops).sample(qs, st.shots);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const secret = toBits(st.s, n);
    return {
      n: n + 1, ops, expand: st.expand, wireLabels: [...qs.map((q) => `q${q}`), 'anc'],
      results: [
        html(histogram(counts, { highlight: (k) => k === secret })),
        verdict('Recovered secret', `s = ${best}  ${best === secret ? '✓' : '✗'}`, `1 oracle query vs ${n} classically`),
      ],
      facts: { n, s: st.s, recovered: best === secret, expand: st.expand },
    };
  },
};

// ----------------------------------------------------------------------------
function simonOracle(n, b) {
  const ops = range(n).map((q) => ({ g: 'X', c: [q], t: [q + n] }));
  if (!b) return ops;
  const i = range(n).find((q) => b & (1 << q));
  for (let q = 0; q < n; q++) if (b & (1 << q)) ops.push({ g: 'X', c: [i], t: [q + n] });
  return ops;
}
const dot2 = (a, b) => { let x = a & b, p = 0; while (x) { p ^= x & 1; x >>= 1; } return p; };
const simon = {
  id: 'simon', title: 'Simon’s Algorithm', cat: 'Oracles',
  desc: 'Find the hidden period b where f(x) = f(x⊕b) using linear algebra over GF(2).',
  source: 'using_circuit/simon.ipynb',
  steps: [
    ['Query in superposition', 'H on the first register, then U_f copies f(x) into the second.'],
    ['Interfere', 'H on the first register: only outcomes y with y·b = 0 (mod 2) survive.'],
    ['Solve', 'Collect n−1 independent y’s and solve the linear system for b.'],
  ],
  init: () => ({ n: 3, b: 0b110, shots: 100, expand: true }),
  controls: (st, set) => [
    slider('Qubits per register n', { min: 2, max: 5, value: st.n, onInput: (n) => set({ n, b: st.b & (2 ** n - 1) }) }),
    bits('Hidden period b', { n: st.n, value: st.b, onChange: (b) => set({ b }) }),
    segmented('Shots', { options: [[10, '10'], [100, '100'], [1000, '1 000']], value: st.shots, onChange: (shots) => set({ shots }) }),
    toggle('Show inside the oracle', { value: st.expand, onChange: (expand) => set({ expand }) }),
    button('▶  Run circuit', () => set({})),
  ],
  compute(st) {
    const n = st.n, qs = range(n);
    const ops = [...Hs(qs), BAR, { g: 'BLOCK', t: range(2 * n), ops: simonOracle(n, st.b), label: 'U_f' }, BAR, ...Hs(qs), ...Ms(qs)];
    const counts = run(2 * n, ops).sample(qs, st.shots);
    const ys = [...counts.keys()].map((k) => parseInt(k, 2)).filter((y) => y);
    const cands = range(2 ** n - 1, 1).filter((c) => ys.every((y) => !dot2(y, c)));
    const eqs = ys.sort((a, b) => a - b).map((y) => `${toBits(y, n)} · b = 0`).join('<br>') || '(only y = 0 measured)';
    let main, sub;
    if (cands.length === 1) { main = `b = ${toBits(cands[0], n)}  ${cands[0] === st.b ? '✓' : '✗'}`; sub = 'unique non-zero solution of the system'; }
    else if (cands.length === 0) { main = `b = ${'0'.repeat(n)}`; sub = 'only b = 0 satisfies every equation → f is one-to-one'; }
    else { main = `${cands.length} candidates`; sub = 'not enough independent equations yet — run again or add shots'; }
    return {
      n: 2 * n, ops, expand: st.expand, wireLabels: [...qs.map((q) => `x${q}`), ...qs.map((q) => `f${q}`)],
      results: [
        html(histogram(counts, { sort: 'key', highlight: (k) => !dot2(parseInt(k, 2), st.b) })),
        el('div', { class: 'eqs' }, el('div', { class: 'field-label' }, 'Equations over GF(2)'), html(`<code>${eqs}</code>`)),
        verdict('Solved period', main, sub, cands.length > 1 ? 'warn' : 'ok'),
      ],
      facts: { n, b: st.b, shots: st.shots, solved: cands.length === 1 && cands[0] === st.b, zeroCase: st.b === 0 && cands.length === 0 },
    };
  },
};

// ----------------------------------------------------------------------------
function groverOps(n, marked, k) {
  const qs = range(n), set = new Set(marked);
  const diff = [...Hs(qs), ...qs.map((q) => ({ g: 'X', t: [q] })), { g: 'H', t: [0] },
    { g: 'X', c: range(n - 1, 1), t: [0] }, { g: 'H', t: [0] }, ...qs.map((q) => ({ g: 'X', t: [q] })), ...Hs(qs)];
  const ops = [...Hs(qs)];
  for (let i = 0; i < k; i++) {
    ops.push(BAR, { g: 'ORACLE', t: qs, pred: (x) => set.has(x), label: 'U_ω' });
    ops.push({ g: 'BLOCK', t: qs, ops: diff, label: 'U_s' });
  }
  return ops;
}
const optimalK = (N, M) => Math.max(0, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
const grover = {
  id: 'grover', title: 'Grover Search', cat: 'Amplitude',
  desc: 'Amplify the marked item. Step through iterations and watch amplitudes grow.',
  source: 'using_circuit/grover.ipynb',
  steps: [
    ['Uniform start', 'H on every qubit gives all N items amplitude 1/√N.'],
    ['Mark', 'The oracle U_ω flips the sign of the marked items.'],
    ['Diffuse', 'U_s reflects about the mean — marked amplitudes grow by ~2/√N each round.'],
  ],
  init: () => ({ n: 4, marked: [5], k: 1, shots: 1000 }),
  controls(st, set) {
    const N = 2 ** st.n, kOpt = optimalK(N, st.marked.length), k = st.k ?? kOpt;
    const grid = el('div', { class: 'cells', style: `--cols:${Math.min(N, 8)}` });
    for (let i = 0; i < N; i++) {
      const on = st.marked.includes(i);
      grid.append(el('button', {
        type: 'button', class: 'cell' + (on ? ' on' : ''), title: `|${toBits(i, st.n)}⟩`,
        onclick: () => {
          const m = on ? st.marked.filter((x) => x !== i) : [...st.marked, i];
          if (m.length && m.length < N) set({ marked: m, k: null });
        },
      }, String(i)));
    }
    return [
      slider('Qubits n', { min: 2, max: 6, value: st.n, onInput: (n) => set({ n, marked: st.marked.filter((x) => x < 2 ** n).length ? st.marked.filter((x) => x < 2 ** n) : [2 ** n - 1], k: null }) }),
      el('div', { class: 'field' }, el('div', { class: 'field-label' }, 'Marked items ω  (click to toggle)'), grid),
      slider('Iterations k', { min: 0, max: Math.max(2 * kOpt + 2, 3), value: k, format: (v) => `${v}${v === kOpt ? '  (optimal)' : ''}`, onInput: (v) => set({ k: v }) }),
      shotsControl(st.shots, (shots) => set({ shots })),
      button('▶  Run circuit', () => set({})),
    ];
  },
  compute(st) {
    const n = st.n, N = 2 ** n, qs = range(n), kOpt = optimalK(N, st.marked.length), k = st.k ?? kOpt;
    const ops = groverOps(n, st.marked, k);
    const state = run(n, ops);
    const marked = new Set(st.marked);
    const sign = Math.sign(state.re[st.marked[0]]) || 1; // fix the global phase for display
    const pSucc = st.marked.reduce((a, i) => a + state.prob(i), 0);
    const curve = range(Math.max(2 * kOpt + 2, 3) + 1).map((kk) => {
      const s = run(n, groverOps(n, st.marked, kk));
      return [kk, st.marked.reduce((a, i) => a + s.prob(i), 0)];
    });
    const counts = state.sample(qs, st.shots);
    return {
      n, ops: [...ops, ...Ms(qs)],
      results: [
        verdict(`After k = ${k} iteration${k === 1 ? '' : 's'}`, `P(success) = ${(pSucc * 100).toFixed(1)}%`,
          `${st.marked.length} of ${N} marked · classical search needs ~${Math.ceil(N / (2 * st.marked.length))} tries on average`, pSucc > 0.5 ? 'ok' : 'warn'),
        el('div', { class: 'field-label' }, 'Amplitudes (marked in cyan)'),
        html(ampBars(range(N).map((i) => ({ label: `|${toBits(i, n)}⟩`, value: sign * state.re[i], marked: marked.has(i) })), { yMax: 1 })),
        html(histogram(counts, { highlight: (key) => marked.has(parseInt(key, 2)), limit: 6 })),
      ],
      extra: [
        el('h3', {}, 'Success probability vs. iterations'),
        html(lineChart([
          { name: 'P(success)', color: 'var(--cyan)', pts: curve },
          { name: 'current', color: 'var(--violet)', pts: [[k, 0], [k, 1]], dash: true },
        ], { xLabel: 'iterations k', yLabel: 'P(success)', yMax: 1, xMax: curve.length - 1, width: 900, height: 260 })),
        note('Grover’s algorithm overshoots: past the optimal k the amplitude rotates away from the marked state again.'),
      ],
      facts: { n, M: st.marked.length, k, kOpt, pSucc },
    };
  },
};

// ----------------------------------------------------------------------------
function randomState(n) {
  const N = 2 ** n, re = new Float64Array(N), im = new Float64Array(N);
  let s = 0;
  for (let i = 0; i < N; i++) { re[i] = Math.random() - 0.5; im[i] = Math.random() - 0.5; s += re[i] ** 2 + im[i] ** 2; }
  s = Math.sqrt(s);
  for (let i = 0; i < N; i++) { re[i] /= s; im[i] /= s; }
  return { re, im };
}
const qft = {
  id: 'qft', title: 'Quantum Fourier', cat: 'Fourier',
  desc: 'Apply the QFT to any basis state and compare with the classical DFT.',
  source: 'using_circuit/kft.ipynb',
  steps: [
    ['Hadamard', 'Each qubit gets an H — it now holds one “digit” of the frequency.'],
    ['Controlled phases', 'CP(π/2^k) gates rotate by finer and finer angles.'],
    ['Swap', 'Reverse the qubit order. Result: QFT|x⟩ = Σ e^{2πi xy/N}|y⟩/√N.'],
  ],
  init: () => ({ n: 3, mode: 'basis', x: 5, input: null }),
  controls(st, set) {
    const nodes = [
      slider('Qubits n', { min: 1, max: 6, value: st.n, onInput: (n) => set({ n, x: Math.min(st.x, 2 ** n - 1), input: st.mode === 'random' ? randomState(n) : null }) }),
      segmented('Input', { options: [['basis', 'Basis |x⟩'], ['random', 'Random |ψ⟩']], value: st.mode, onChange: (mode) => set({ mode, input: mode === 'random' ? randomState(st.n) : null }) }),
    ];
    if (st.mode === 'basis') nodes.push(bits('x', { n: st.n, value: st.x, onChange: (x) => set({ x }) }));
    else nodes.push(button('↻  New random state', () => set({ input: randomState(st.n) }), 'ghost'));
    return nodes;
  },
  compute(st) {
    const n = st.n, N = 2 ** n, qs = range(n);
    const s = new State(n);
    let prep;
    if (st.mode === 'basis') {
      prep = qs.filter((q) => st.x & (1 << q)).map((q) => ({ g: 'X', t: [q] }));
      run(n, prep, s);
    } else {
      s.re.set(st.input.re); s.im.set(st.input.im);
      prep = [{ g: 'BLOCK', t: qs, ops: [], label: 'init |ψ⟩' }];
    }
    const inAmps = range(N).map((i) => [s.re[i], s.im[i]]);
    const q = qftOps(qs);
    run(n, q, s);
    let err = 0;
    for (let k = 0; k < N; k++) {
      let r = 0, im = 0;
      for (let j = 0; j < N; j++) {
        const a = (2 * Math.PI * j * k) / N;
        r += inAmps[j][0] * Math.cos(a) - inAmps[j][1] * Math.sin(a);
        im += inAmps[j][0] * Math.sin(a) + inAmps[j][1] * Math.cos(a);
      }
      err = Math.max(err, Math.hypot(r / Math.sqrt(N) - s.re[k], im / Math.sqrt(N) - s.im[k]));
    }
    return {
      n, ops: [...prep, BAR, ...q],
      results: [
        el('div', { class: 'field-label' }, 'Input amplitudes'), html(phaseWheels(inAmps, n)),
        el('div', { class: 'field-label' }, 'After QFT'), html(phaseWheels(range(N).map((i) => [s.re[i], s.im[i]]), n)),
        verdict('Matches classical DFT', `max error ${err.toExponential(1)}  ${err < 1e-9 ? '✓' : '✗'}`, 'numpy: np.fft.ifft(ψ, norm="ortho")'),
        note('Circle size = magnitude, hand + colour = phase. For a basis input every output has equal size and the phase advances by x·2π/N per step.'),
      ],
      facts: { n, mode: st.mode, x: st.x, err },
    };
  },
};

// ----------------------------------------------------------------------------
const phaseEstimation = {
  id: 'qpe', title: 'Phase Estimation', cat: 'Fourier',
  desc: 'Estimate the eigenphase of a unitary with t counting qubits.',
  source: 'using_circuit/phase-eval.ipynb',
  steps: [
    ['Eigenstate', 'The target holds |1⟩, an eigenvector of U = P(2πφ) with eigenvalue e^{2πiφ}.'],
    ['Kickback', 'Counting qubit j applies U^(2^j), kicking back phase 2πφ·2^j.'],
    ['Inverse QFT', 'QFT† turns those phases into the binary digits of φ.'],
  ],
  init: () => ({ t: 4, phi: 0.3, shots: 1000, expand: false }),
  controls: (st, set) => [
    slider('Counting qubits t', { min: 1, max: 8, value: st.t, onInput: (t) => set({ t }) }),
    slider('True phase φ', { min: 0, max: 0.999, step: 0.001, value: st.phi, format: (v) => v.toFixed(3), onInput: (phi) => set({ phi }) }),
    segmented('Presets', { options: [[1 / 8, 'T  (1/8)'], [1 / 4, 'S  (1/4)'], [1 / 3, '1/3']], value: st.phi, onChange: (phi) => set({ phi }) }),
    shotsControl(st.shots, (shots) => set({ shots })),
    toggle('Expand QFT†', { value: st.expand, onChange: (expand) => set({ expand }) }),
    button('▶  Run circuit', () => set({})),
  ],
  compute(st) {
    const t = st.t, cs = range(t), T = 2 ** t;
    const ops = [{ g: 'X', t: [t] }, ...Hs(cs), BAR,
      ...cs.map((i) => ({ g: 'P', p: 2 * Math.PI * st.phi * 2 ** i, c: [i], t: [t], label: `U^${2 ** i}` })), BAR,
      { g: 'BLOCK', t: cs, ops: inverse(qftOps(cs)), label: 'QFT†' }, ...Ms(cs)];
    const counts = run(t + 1, ops).sample(cs, st.shots);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const est = parseInt(best, 2) / T;
    const err = Math.min(Math.abs(est - st.phi), 1 - Math.abs(est - st.phi));
    return {
      n: t + 1, ops, expand: st.expand, wireLabels: [...cs.map((i) => `c${i}`), '|1⟩'],
      results: [
        html(histogram(counts, { highlight: (k) => k === best, limit: 10, label: (k) => `${k} → ${(parseInt(k, 2) / T).toFixed(4)}` })),
        verdict('Estimated phase', `φ̃ = ${parseInt(best, 2)}/${T} = ${est.toFixed(4)}`, `true φ = ${st.phi.toFixed(4)} · error ${err.toFixed(4)} (resolution 1/${T})`, err <= 1 / T ? 'ok' : 'warn'),
        note('If φ·2^t is an integer the answer is exact; otherwise the peak spreads over neighbouring bins.'),
      ],
      facts: { t, phi: st.phi, est, err },
    };
  },
};

// ----------------------------------------------------------------------------
const shorFactor = {
  id: 'shor', title: 'Shor: factor 15', cat: 'Fourier',
  desc: 'Period finding for a^x mod 15, then continued fractions to recover factors.',
  source: 'using_circuit/shor.ipynb',
  steps: [
    ['Modular exponentiation', 'Controlled-U^(2^j) multiplies the work register by a^(2^j) mod 15.'],
    ['Read the period', 'QFT† gives phases s/r; continued fractions recover the period r.'],
    ['Classical finish', 'If r is even, gcd(a^(r/2) ± 1, 15) are the factors.'],
  ],
  init: () => ({ nc: 4, a: 7, shots: 100, expand: false }),
  controls: (st, set) => [
    segmented('Base a (coprime to 15)', { options: [2, 4, 7, 8, 11, 13], value: st.a, onChange: (a) => set({ a }) }),
    slider('Counting qubits', { min: 3, max: 8, value: st.nc, onInput: (nc) => set({ nc }) }),
    segmented('Shots', { options: [[20, '20'], [100, '100'], [1000, '1 000']], value: st.shots, onChange: (shots) => set({ shots }) }),
    toggle('Expand QFT†', { value: st.expand, onChange: (expand) => set({ expand }) }),
    button('▶  Run circuit', () => set({})),
  ],
  compute(st) {
    const nc = st.nc, a = st.a, cs = range(nc), work = range(4, nc);
    const ops = [...Hs(cs), { g: 'X', t: [nc] }, BAR,
      ...cs.map((q) => {
        const m = modpow(a, 2 ** q, 15);
        return { g: 'PERM', t: work, c: [q], fn: (y) => (y < 15 ? (y * m) % 15 : y), label: `${a}^${2 ** q} mod 15` };
      }), BAR,
      { g: 'BLOCK', t: cs, ops: inverse(qftOps(cs)), label: 'QFT†' }, ...Ms(cs)];
    const counts = run(nc + 4, ops).sample(cs, st.shots);
    const rows = [...counts.keys()].sort().map((k) => {
      const phase = parseInt(k, 2) / 2 ** nc;
      const [num, den] = limitDenominator(phase, 15);
      return { k, phase, frac: `${num}/${den}`, r: den };
    });
    const r = rows.reduce((acc, row) => lcm(acc, row.r), 1);
    const ok = r % 2 === 0 && modpow(a, r, 15) === 1;
    const x = modpow(a, r / 2, 15);
    const p = ok ? gcd(x + 1, 15) : 1, q = ok ? gcd(x - 1, 15) : 1;
    const success = ok && p * q === 15 && p !== 1 && q !== 1;
    const table = `<table class="tbl"><thead><tr><th>Bits</th><th>Phase</th><th>Fraction</th><th>Guess r</th></tr></thead><tbody>${
      rows.map((row) => `<tr><td>${row.k}</td><td>${row.phase.toFixed(4)}</td><td>${row.frac}</td><td>${row.r}</td></tr>`).join('')}</tbody></table>`;
    return {
      n: nc + 4, ops, expand: st.expand, wireLabels: [...cs.map((i) => `c${i}`), ...range(4).map((i) => `w${i}`)],
      results: [
        html(histogram(counts, { sort: 'key', label: (k) => `${k} → ${(parseInt(k, 2) / 2 ** nc).toFixed(3)}` })),
        verdict(`Period r = lcm(…) = ${r}`, success ? `15 = ${Math.min(p, q)} × ${Math.max(p, q)}  ✓` : 'No factors this time',
          success ? `${a}^${r / 2} mod 15 = ${x}  →  gcd(${x}±1, 15)` : 'r odd or trivial — pick another a or run again', success ? 'ok' : 'warn'),
      ],
      extra: [el('h3', {}, 'Continued-fraction table'), html(table),
        note('Each measured phase ≈ s/r. <code>Fraction(phase).limit_denominator(15)</code> guesses r; the least common multiple of the guesses is the period.')],
      facts: { a, nc, r, success },
    };
  },
};

// ----------------------------------------------------------------------------
function bb84Arrays(n) {
  const r = () => Array.from({ length: n }, () => randInt(2));
  const u = () => Array.from({ length: n }, () => Math.random());
  return { aBits: r(), aBases: r(), bBases: r(), eBases: r(), rEve: u(), rBob: u(), sel: 0 };
}
const KET = [['|0⟩', '|1⟩'], ['|+⟩', '|−⟩']];
const bb84 = {
  id: 'bb84', title: 'BB84 Key Exchange', cat: 'Protocols',
  desc: 'Alice, Bob and (maybe) Eve. Sift a key and detect the eavesdropper.',
  source: 'using_circuit/bb84.ipynb',
  steps: [
    ['Encode', 'Alice sends each random bit in a random basis: Z (|0⟩,|1⟩) or X (|+⟩,|−⟩).'],
    ['Measure', 'Bob measures in his own random basis; a wrong basis gives a coin flip.'],
    ['Sift & check', 'They keep bits where bases agree. Eve’s guesses leave ~25% errors behind.'],
  ],
  init: () => ({ n: 12, eve: false, ...bb84Arrays(12) }),
  controls: (st, set) => [
    slider('Qubits sent', { min: 6, max: 24, value: st.n, onInput: (n) => set({ n, ...bb84Arrays(n) }) }),
    toggle('Eve intercepts & resends', { value: st.eve, onChange: (eve) => set({ eve }) }),
    button('↻  Randomize everything', () => set(bb84Arrays(st.n)), 'ghost'),
    note('Click cells in the table below to flip Alice’s bits or anyone’s basis. Click a column number to see that qubit’s circuit.'),
  ],
  compute(st, set) {
    const n = st.n, eveBits = [], bobBits = [];
    for (let i = 0; i < n; i++) {
      const s = new State(1);
      if (st.aBits[i]) s.apply1(0, [[0, 0], [1, 0], [1, 0], [0, 0]]);
      const H = () => applyOp(s, { g: 'H', t: [0] });
      if (st.aBases[i]) H();
      if (st.eve) {
        if (st.eBases[i]) H();
        eveBits.push(s.measure(0, () => st.rEve[i]));
        if (st.eBases[i]) H();
      }
      if (st.bBases[i]) H();
      bobBits.push(s.measure(0, () => st.rBob[i]));
    }
    const keep = range(n).filter((i) => st.aBases[i] === st.bBases[i]);
    const aKey = keep.map((i) => st.aBits[i]), bKey = keep.map((i) => bobBits[i]);
    const errs = keep.filter((i) => st.aBits[i] !== bobBits[i]).length;
    const qber = keep.length ? errs / keep.length : 0;

    const i = st.sel;
    const ops = [];
    if (st.aBits[i]) ops.push({ g: 'X', t: [0], label: 'X' });
    if (st.aBases[i]) ops.push({ g: 'H', t: [0] });
    ops.push(BAR);
    if (st.eve) {
      if (st.eBases[i]) ops.push({ g: 'H', t: [0], err: true });
      ops.push({ g: 'M', t: [0] });
      if (st.eBases[i]) ops.push({ g: 'H', t: [0], err: true });
      ops.push(BAR);
    }
    if (st.bBases[i]) ops.push({ g: 'H', t: [0] });
    ops.push({ g: 'M', t: [0] });

    const flip = (key, j) => () => set({ [key]: st[key].map((v, k) => (k === j ? 1 - v : v)) });
    const cell = (v, onclick, cls = '') => el('td', { class: 'click ' + cls, onclick }, v);
    const rowsDef = [
      ['#', (j) => el('td', { class: 'click idx' + (j === i ? ' sel' : ''), onclick: () => set({ sel: j }) }, String(j))],
      ['Alice bit', (j) => cell(String(st.aBits[j]), flip('aBits', j))],
      ['Alice basis', (j) => cell(st.aBases[j] ? 'X' : 'Z', flip('aBases', j), 'basis')],
      ['Sent', (j) => el('td', { class: 'ket' }, KET[st.aBases[j]][st.aBits[j]])],
      ...(st.eve ? [
        ['Eve basis', (j) => cell(st.eBases[j] ? 'X' : 'Z', flip('eBases', j), 'basis eve')],
        ['Eve reads', (j) => el('td', { class: 'eve' }, String(eveBits[j]))],
      ] : []),
      ['Bob basis', (j) => cell(st.bBases[j] ? 'X' : 'Z', flip('bBases', j), 'basis')],
      ['Bob reads', (j) => el('td', {}, String(bobBits[j]))],
      ['Keep?', (j) => {
        const k = st.aBases[j] === st.bBases[j], bad = k && st.aBits[j] !== bobBits[j];
        return el('td', { class: k ? (bad ? 'bad' : 'good') : 'drop' }, k ? (bad ? '✗' : '✓') : '–');
      }],
    ];
    const table = el('table', { class: 'tbl bb84' }, el('tbody', {}, ...rowsDef.map(([name, f]) => el('tr', {}, el('th', {}, name), ...range(n).map(f)))));

    return {
      n: 1, ops, wireLabels: [`#${i}`],
      results: [
        el('div', { class: 'keys' },
          el('div', { class: 'field-label' }, 'Alice’s sifted key'), el('code', {}, aKey.join('') || '—'),
          el('div', { class: 'field-label' }, 'Bob’s sifted key'), el('code', {}, bKey.map((b, k) => (b !== aKey[k] ? `[${b}]` : b)).join('') || '—')),
        verdict(`QBER over ${keep.length} sifted bits`, `${(qber * 100).toFixed(0)}% errors`,
          errs ? 'Mismatches found → someone is listening. Abort!' : st.eve ? 'Eve got lucky this time — send more qubits.' : 'Keys agree — the channel looks clean.',
          errs ? 'bad' : 'ok'),
      ],
      extra: [el('h3', {}, 'Transmission log'), el('div', { class: 'scroll-x' }, table)],
      facts: { n, eve: st.eve, errs, kept: keep.length, eveMirrors: st.eve && st.eBases.every((v, j) => v === st.aBases[j]) },
    };
  },
};

// ----------------------------------------------------------------------------
const prepOps = (q, theta, phi) => [{ g: 'RY', p: theta, t: [q] }, { g: 'P', p: phi, t: [q] }];
const blochOf = (theta, phi) => ({ x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta) });
const teleport = {
  id: 'teleport', title: 'Teleportation', cat: 'Protocols',
  desc: 'Move an unknown qubit state using one Bell pair and two classical bits.',
  source: 'using_circuit/teleport.ipynb',
  steps: [
    ['Share a Bell pair', 'H and CNOT entangle q1 (Alice) with q2 (Bob).'],
    ['Bell measurement', 'Alice entangles |ψ⟩ with her half and measures both qubits.'],
    ['Correct', 'Bob applies X^m1 Z^m0 and now holds |ψ⟩ — without it ever travelling.'],
  ],
  init: () => ({ theta: 1.1, phi: 0.8, corr: true, r: [Math.random(), Math.random()], runs: 0 }),
  controls: (st, set) => [
    slider('θ (polar)', { min: 0, max: 3.1416, step: 0.01, value: st.theta, format: (v) => `${((v * 180) / Math.PI).toFixed(0)}°`, onInput: (theta) => set({ theta }) }),
    slider('φ (azimuth)', { min: 0, max: 6.2832, step: 0.01, value: st.phi, format: (v) => `${((v * 180) / Math.PI).toFixed(0)}°`, onInput: (phi) => set({ phi }) }),
    segmented('Presets', { options: [['0', '|0⟩'], ['1', '|1⟩'], ['+', '|+⟩'], ['i', '|i⟩']], value: null,
      onChange: (v) => set({ theta: { 0: 0, 1: Math.PI, '+': Math.PI / 2, i: Math.PI / 2 }[v], phi: v === 'i' ? Math.PI / 2 : 0 }) }),
    toggle('Bob applies corrections', { value: st.corr, onChange: (corr) => set({ corr }) }),
    button('▶  Teleport again', () => set({ r: [Math.random(), Math.random()], runs: st.runs + 1 })),
  ],
  compute(st) {
    const pre = [{ g: 'BLOCK', t: [0], ops: prepOps(0, st.theta, st.phi), label: '|ψ⟩' }, { g: 'H', t: [1] }, { g: 'X', c: [1], t: [2] }, BAR,
      { g: 'X', c: [0], t: [1] }, { g: 'H', t: [0] }, BAR];
    const s = run(3, pre);
    const m0 = s.measure(0, () => st.r[0]), m1 = s.measure(1, () => st.r[1]);
    if (st.corr) {
      if (m1) applyOp(s, { g: 'X', t: [2] });
      if (m0) applyOp(s, { g: 'Z', t: [2] });
    }
    const vin = blochOf(st.theta, st.phi), vout = s.bloch(2);
    const fid = (1 + vin.x * vout.x + vin.y * vout.y + vin.z * vout.z) / 2;
    const ops = [...pre, { g: 'M', t: [0] }, { g: 'M', t: [1] }, BAR,
      ...(st.corr ? [{ g: 'X', c: [1], t: [2] }, { g: 'Z', c: [0], t: [2] }] : [])];
    const fix = [m1 ? 'X' : '', m0 ? 'Z' : ''].filter(Boolean).join(' then ') || 'nothing';
    return {
      n: 3, ops, wireLabels: ['q0 ψ', 'q1 A', 'q2 B'],
      results: [
        el('div', { class: 'blochs' },
          el('figure', {}, html(bloch(vin, { label: 'ψ', size: 150 })), el('figcaption', {}, 'Alice’s input')),
          el('figure', {}, html(bloch(vout, { label: 'B', size: 150, accent: 'var(--violet)' })), el('figcaption', {}, 'Bob’s qubit'))),
        verdict(`Alice measured m0 m1 = ${m0}${m1}`, `Fidelity ${(fid * 100).toFixed(1)}%`,
          st.corr ? `Bob applied ${fix}.` : `Without corrections Bob holds a scrambled copy (needed: ${fix}).`, fid > 0.999 ? 'ok' : 'warn'),
        note('Each of the four outcomes 00, 01, 10, 11 occurs with probability 25%, regardless of |ψ⟩ — the measurement reveals nothing about the state.'),
      ],
      facts: { theta: st.theta, corr: st.corr, fid, m0, m1, runs: st.runs },
    };
  },
};

// ----------------------------------------------------------------------------
function shor9Encode() {
  const ops = [{ g: 'X', c: [0], t: [3] }, { g: 'X', c: [0], t: [6] }, ...Hs([0, 3, 6])];
  for (const j of [0, 3, 6]) ops.push({ g: 'X', c: [j], t: [j + 1] }, { g: 'X', c: [j], t: [j + 2] });
  return ops;
}
function shor9Decode() {
  const ops = [];
  for (const j of [0, 3, 6]) ops.push({ g: 'X', c: [j], t: [j + 1] }, { g: 'X', c: [j], t: [j + 2] }, { g: 'X', c: [j + 1, j + 2], t: [j] }, { g: 'H', t: [j] });
  ops.push({ g: 'X', c: [0], t: [3] }, { g: 'X', c: [0], t: [6] }, { g: 'X', c: [3, 6], t: [0] });
  return ops;
}
const ENC = shor9Encode(), DEC = shor9Decode();
const INPUTS = { zero: [0, 0], one: [Math.PI, 0], plus: [Math.PI / 2, 0], custom: [1.9, 2.4] };
// Fidelity of qubit q of `s` with the pure state (theta, phi).
function fidelity(s, q, theta, phi) {
  const v = s.bloch(q), w = blochOf(theta, phi);
  return (1 + v.x * w.x + v.y * w.y + v.z * w.z) / 2;
}
const PAULI = ['X', 'Y', 'Z'];
function noiseTrial(p, kind, protectedCode) {
  const theta = Math.acos(1 - 2 * Math.random()), phi = 2 * Math.PI * Math.random();
  const pick = () => (kind === 'depol' ? PAULI[randInt(3)] : kind);
  if (!protectedCode) {
    const s = run(1, prepOps(0, theta, phi));
    if (Math.random() < p) applyOp(s, { g: pick(), t: [0] });
    return 1 - fidelity(s, 0, theta, phi);
  }
  const s = run(9, [...prepOps(0, theta, phi), ...ENC]);
  for (let q = 0; q < 9; q++) if (Math.random() < p) applyOp(s, { g: pick(), t: [q] });
  run(9, DEC, s);
  return 1 - fidelity(s, 0, theta, phi);
}
const shor9 = {
  id: 'shor9', title: 'Shor 9‑Qubit Code', cat: 'Error correction',
  desc: 'Inject X / Y / Z errors and see the code protect the logical qubit.',
  source: 'using_circuit/shor9.py',
  steps: [
    ['Encode', 'Three-qubit phase-flip code of three-qubit bit-flip codes: 1 logical qubit → 9 physical.'],
    ['Error', 'Any single-qubit Pauli error (X, Y or Z) on any of the 9 qubits.'],
    ['Decode & correct', 'Majority votes via CNOT + Toffoli undo the error; ancillas hold the syndrome.'],
  ],
  init: () => ({ input: 'custom', err: 'none', q: 4, expand: false, kind: 'depol', sweep: null, running: false }),
  controls: (st, set) => [
    segmented('Logical input', { options: [['zero', '|0⟩'], ['one', '|1⟩'], ['plus', '|+⟩'], ['custom', 'custom']], value: st.input, onChange: (input) => set({ input }) }),
    segmented('Error', { options: [['none', 'none'], ['X', 'X'], ['Y', 'Y'], ['Z', 'Z']], value: st.err, onChange: (err) => set({ err }) }),
    el('div', { class: 'field' }, el('div', { class: 'field-label' }, 'Error on qubit'),
      el('div', { class: 'bits' }, ...range(9).map((q) => el('button', { type: 'button', class: 'bit' + (q === st.q ? ' on err' : ''), onclick: () => set({ q }) }, String(q))))),
    toggle('Expand encoder / decoder', { value: st.expand, onChange: (expand) => set({ expand }) }),
  ],
  compute(st, set) {
    const [theta, phi] = INPUTS[st.input];
    const errOps = st.err === 'none' ? [] : [{ g: st.err, t: [st.q], err: true }];
    const ops = [{ g: 'BLOCK', t: [0], ops: prepOps(0, theta, phi), label: '|ψ⟩' }, BAR,
      { g: 'BLOCK', t: range(9), ops: ENC, label: 'enc9' }, BAR, ...errOps, BAR, { g: 'BLOCK', t: range(9), ops: DEC, label: 'dec9' }];
    const s = run(9, ops);
    const F = fidelity(s, 0, theta, phi);
    const bare = run(1, [...prepOps(0, theta, phi), ...(st.err === 'none' ? [] : [{ g: st.err, t: [0] }])]);
    const Fb = fidelity(bare, 0, theta, phi);
    const syn = [...s.marginal(range(8, 1)).entries()].sort((a, b) => b[1] - a[1])[0][0];

    const runSweep = async () => {
      set({ running: true, sweep: null });
      const ps = range(11).map((i) => i * 0.01), trials = 1500, code = [], bareS = [];
      for (const p of ps) {
        let a = 0, b = 0;
        for (let k = 0; k < trials; k++) { a += noiseTrial(p, st.kind, true); b += noiseTrial(p, st.kind, false); }
        code.push([p, a / trials]); bareS.push([p, b / trials]);
        await new Promise((r) => setTimeout(r, 0));
      }
      set({ running: false, sweep: { code, bare: bareS, kind: st.kind } });
    };
    const kindName = { depol: 'equal X, Y, Z', X: 'bit-flip X only', Z: 'phase-flip Z only' };
    const extra = [
      el('h3', {}, 'Noise sweep: every physical qubit fails with probability p'),
      el('div', { class: 'row-controls' },
        segmented(null, { options: [['depol', 'Equal X,Y,Z'], ['X', 'Bit-flip X'], ['Z', 'Phase-flip Z']], value: st.kind, onChange: (kind) => set({ kind }) }),
        button(st.running ? 'Simulating…' : '▶  Run sweep (33 000 trials)', st.running ? () => {} : runSweep)),
    ];
    if (st.sweep) {
      extra.push(html(lineChart([
        { name: 'Shor code', color: 'var(--cyan)', pts: st.sweep.code },
        { name: 'No correction', color: 'var(--muted)', pts: st.sweep.bare },
      ], { xLabel: 'physical error probability p', yLabel: 'logical infidelity', xMax: 0.1, width: 900, height: 320 })));
      extra.push(el('div', { class: 'legend' }, el('span', { class: 'lg lg-cyan' }, 'Shor 9-qubit code'), el('span', { class: 'lg lg-muted' }, `Unprotected qubit · noise: ${kindName[st.sweep.kind]}`)));
      extra.push(note('For small p the code wins: it only fails when two or more of its 9 qubits err (∝ p²), while a bare qubit fails ∝ p. Past the crossover (a few percent) the extra qubits add more errors than the code can fix — which is why real devices need error rates well below threshold.'));
    }
    return {
      n: 9, ops, expand: st.expand,
      results: [
        el('div', { class: 'blochs' },
          el('figure', {}, html(bloch(blochOf(theta, phi), { label: 'ψ', size: 150 })), el('figcaption', {}, 'Logical input')),
          el('figure', {}, html(bloch(s.bloch(0), { label: 'out', size: 150, accent: 'var(--violet)' })), el('figcaption', {}, 'After decoding'))),
        verdict('Recovered logical qubit', `Fidelity ${(F * 100).toFixed(1)}%  ${F > 0.999 ? '✓' : '✗'}`,
          `Unprotected qubit with the same error: ${(Fb * 100).toFixed(1)}%`, F > 0.999 ? 'ok' : 'bad'),
        el('div', { class: 'keys' }, el('div', { class: 'field-label' }, 'Syndrome left in ancillas q8…q1'), el('code', {}, syn)),
      ],
      extra,
      facts: { err: st.err, q: st.q, F, sweepDone: !!st.sweep },
    };
  },
};

export const LABS = [qrng, deutschJozsa, bernsteinVazirani, simon, grover, qft, phaseEstimation, shorFactor, bb84, teleport, shor9]
  .map((lab, i) => ({ ...lab, num: String(i + 1).padStart(2, '0'), url: REPO + lab.source }));
