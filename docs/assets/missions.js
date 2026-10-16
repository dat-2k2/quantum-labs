// Tutorial content: chapters, per-lab missions and quizzes, and sandbox arena challenges.
// A mission either has `check(facts, st)` (an action to perform) or `quiz` (a predict/recall question).

export const CHAPTERS = [
  { name: 'First qubits', labs: ['qrng'] },
  { name: 'Oracles', labs: ['dj', 'bv', 'simon'] },
  { name: 'Amplitude', labs: ['grover'] },
  { name: 'Fourier tricks', labs: ['qft', 'qpe', 'shor'] },
  { name: 'Quantum communication', labs: ['bb84', 'teleport'] },
  { name: 'Error correction', labs: ['shor9'] },
];

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

export const MISSIONS = {
  qrng: [
    { id: 'n1', text: 'Flip a single quantum coin: run with n = 1.', xp: 10, hint: 'Drag the Qubits slider all the way to the left.', check: (f) => f.n === 1 },
    { id: 'big', text: 'Roll a number of 200 or more.', xp: 20, hint: 'You need 8 qubits to reach 255 — then keep pressing Roll again.', check: (f) => f.number >= 200 },
    { id: 'q-count', xp: 15, quiz: { q: 'With n = 3 qubits, how many different numbers can the QRNG produce?', options: ['3', '6', '8', '9'], answer: 2, explain: '2³ = 8 outcomes: 0 to 7.' } },
    { id: 'q-why', xp: 15, quiz: { q: 'What makes a quantum RNG truly random?', options: ['A well-chosen seed', 'Measuring |+⟩ has no hidden cause deciding 0 or 1', 'H gates add noise', 'Nothing — it is pseudo-random'], answer: 1, explain: 'On hardware the outcome is fundamentally probabilistic. (This browser simulation imitates it with Math.random.)' } },
  ],
  dj: [
    { id: 'const', text: 'Run a constant oracle (f = 0 or f = 1) and see |0…0⟩ every shot.', xp: 15, hint: 'Pick “f = 0” or “f = 1” under Oracle f.', check: (f) => (f.kind === 'const0' || f.kind === 'const1') && f.constant },
    { id: 'all', text: 'Build a balanced oracle with an all-ones mask on 4 input qubits.', xp: 20, hint: 'Set n = 4, choose Balanced, then switch on every bit of the mask.', check: (f) => f.n === 4 && f.kind === 'balanced' && f.mask === 15 },
    { id: 'mystery', text: 'Crack a mystery oracle: read the verdict, then reveal it.', xp: 20, hint: 'Choose “?” as the oracle, look at the verdict, then press Reveal the oracle.', check: (f) => f.kind === 'mystery' && f.reveal },
    { id: 'q-const', xp: 15, quiz: { q: 'If f is constant, what does the input register measure?', options: ['All zeros', 'A random string', 'All ones', 'The mask'], answer: 0, explain: 'Interference cancels every other outcome — only |0…0⟩ survives.' } },
  ],
  bv: [
    { id: '1011', text: 'Set the secret to 1011 with n = 4 and recover it.', xp: 15, hint: 'Slide n to 4, then click bits until they read 1011.', check: (f) => f.n === 4 && f.s === 0b1011 && f.recovered },
    { id: 'max', text: 'Go big: 9 qubits with an all-ones secret.', xp: 20, hint: 'n = 9, then turn every bit on.', check: (f) => f.n === 9 && f.s === 511 && f.recovered },
    { id: 'blackbox', text: 'Hide the oracle’s insides and still recover s.', xp: 10, hint: 'Switch off “Show inside the oracle”.', check: (f) => !f.expand && f.recovered },
    { id: 'q-classical', xp: 15, quiz: { q: 'Classically, how many queries of f(x) = s·x do you need to learn an n-bit secret?', options: ['1', 'n', '2ⁿ', 'n²'], answer: 1, explain: 'Query each unit vector eᵢ to read one bit at a time: n queries. Quantum needs just 1.' } },
  ],
  simon: [
    { id: 'b11', text: 'Solve for b = 11 with n = 2.', xp: 15, hint: 'Slide n to 2 and set both bits of b.', check: (f) => f.n === 2 && f.b === 3 && f.solved },
    { id: 'ten', text: 'Solve a non-zero b on n = 4 with only 10 shots.', xp: 25, hint: 'Pick n = 4, a non-zero b and 10 shots. If it says “candidates”, run again.', check: (f) => f.n === 4 && f.shots === 10 && f.solved && f.b !== 0 },
    { id: 'zero', text: 'What if b = 0…0? Run it and read the verdict.', xp: 15, hint: 'Turn every bit of b off.', check: (f) => f.zeroCase },
    { id: 'q-dot', xp: 15, quiz: { q: 'Every y you measure satisfies…', options: ['y · b = 0 (mod 2)', 'y = b', 'y · b = 1 (mod 2)', 'y = 0'], answer: 0, explain: 'Outcomes with y·b = 1 interfere destructively, so each shot gives one linear equation on b.' } },
  ],
  grover: [
    { id: 'opt', text: 'Find the best iteration count for 1 marked item in 16 (P > 90%).', xp: 15, hint: 'n = 4 with a single marked cell — try k = 3.', check: (f) => f.n === 4 && f.M === 1 && f.pSucc > 0.9 },
    { id: 'over', text: 'Overshoot! Go past the optimum until P(success) drops below 50%.', xp: 20, hint: 'Keep increasing k beyond the “optimal” label.', badge: 'overshoot', check: (f) => f.k > f.kOpt && f.pSucc < 0.5 },
    { id: 'four', text: 'Mark 4 of 16 items and hit P(success) = 100%.', xp: 20, hint: 'With M = 4 of N = 16, one single iteration is exactly enough.', check: (f) => f.n === 4 && f.M === 4 && f.pSucc > 0.999 },
    { id: 'q-iter', xp: 15, quiz: { q: 'Roughly how many iterations for 1 marked item among N = 64?', options: ['3', '6', '32', '64'], answer: 1, explain: 'π/4 · √64 ≈ 6.3 → 6. That √N speed-up is the whole point.' } },
  ],
  qft: [
    { id: 'zero', text: 'Transform |0…0⟩ — every output phase lines up.', xp: 10, hint: 'Choose “Basis |x⟩” and clear every bit of x.', check: (f) => f.mode === 'basis' && f.x === 0 },
    { id: 'half', text: 'Find the input whose output phase flips by 180° every step.', xp: 20, hint: 'The phase advances by x·2π/N per step. You want π, so x = N/2 — only the top bit set.', check: (f) => f.mode === 'basis' && f.n >= 2 && f.x === 2 ** (f.n - 1) },
    { id: 'random', text: 'Feed a random state and confirm it still matches the classical DFT.', xp: 10, hint: 'Switch Input to “Random |ψ⟩”.', check: (f) => f.mode === 'random' && f.err < 1e-9 },
    { id: 'q-mag', xp: 15, quiz: { q: 'The QFT of a basis state |x⟩ has…', options: ['equal magnitudes on every output', 'all its weight on one output', 'zero everywhere except |0⟩', 'random magnitudes'], answer: 0, explain: 'Every output has magnitude 1/√N; x only sets how fast the phase turns.' } },
  ],
  qpe: [
    { id: 't', text: 'Estimate the T gate’s phase (φ = 1/8) exactly.', xp: 15, hint: 'Use the T preset — 3 or more counting qubits give an exact answer.', check: (f) => near(f.phi, 1 / 8) && f.err < 1e-9 },
    { id: 'third', text: 'Pin down φ = 1/3 to within 0.01.', xp: 20, hint: '1/3 is not a finite binary fraction — use the 1/3 preset and t ≥ 6 counting qubits.', check: (f) => near(f.phi, 1 / 3) && f.err < 0.01 },
    { id: 'max', text: 'Max out precision with 8 counting qubits.', xp: 10, hint: 'Slide Counting qubits to 8.', check: (f) => f.t === 8 },
    { id: 'q-res', xp: 15, quiz: { q: 'With t counting qubits, the phase resolution is…', options: ['1/2ᵗ', '1/t', 't/2', '2ᵗ'], answer: 0, explain: 'Each extra counting qubit doubles the number of bins.' } },
  ],
  shor: [
    { id: 'seven', text: 'Factor 15 with a = 7.', xp: 20, hint: 'Pick a = 7 and press Run. If the period comes out wrong, run again.', check: (f) => f.a === 7 && f.success },
    { id: 'r2', text: 'Find a base whose period is r = 2.', xp: 20, hint: 'Try a = 4 or a = 11: 4² = 16 ≡ 1 (mod 15).', check: (f) => f.r === 2 && f.success },
    { id: 'three', text: 'Factor 15 with only 3 counting qubits.', xp: 15, hint: 'Slide Counting qubits to 3 — period 4 still fits exactly.', check: (f) => f.nc === 3 && f.success },
    { id: 'q-even', xp: 15, quiz: { q: 'Why does Shor’s algorithm want an even period r?', options: ['So (a^(r/2) − 1)(a^(r/2) + 1) ≡ 0 mod N splits N', 'Because 15 is odd', 'The QFT only handles even numbers', 'It doesn’t matter'], answer: 0, explain: 'N then divides a product of two numbers, and gcd pulls the factors out.' } },
  ],
  bb84: [
    { id: 'clean', text: 'Exchange a key with nobody listening — 0% errors.', xp: 10, hint: 'Leave Eve off and press Randomize everything.', check: (f) => !f.eve && f.kept > 0 && f.errs === 0 },
    { id: 'eve', text: 'Catch Eve: turn her on and spot errors in the sifted key.', xp: 20, badge: 'eve', hint: 'Switch on Eve. If QBER is still 0%, randomize or send more qubits.', check: (f) => f.eve && f.errs > 0 },
    { id: 'mirror', text: 'Make Eve invisible: set her bases to match Alice’s everywhere.', xp: 25, hint: 'Click Eve’s basis cells until each equals Alice’s basis above it. Real Eves can’t know Alice’s bases!', check: (f) => f.eveMirrors && f.n >= 8 },
    { id: 'q-qber', xp: 15, quiz: { q: 'On average, what error rate does an intercept-resend Eve leave in the sifted key?', options: ['0%', '25%', '50%', '100%'], answer: 1, explain: 'She picks the wrong basis half the time, and then Bob is wrong half the time: ½ × ½ = 25%.' } },
  ],
  teleport: [
    { id: 'one', text: 'Teleport |1⟩ with 100% fidelity.', xp: 15, hint: 'Use the |1⟩ preset.', check: (f) => Math.abs(f.theta - Math.PI) < 0.02 && f.corr && f.fid > 0.999 },
    { id: 'break', text: 'Switch corrections off and get an outcome other than 00 — watch it break.', xp: 20, hint: 'Turn off “Bob applies corrections”, then Teleport again until m0 m1 ≠ 00.', check: (f) => !f.corr && (f.m0 || f.m1) && f.fid < 0.99 },
    { id: 'five', text: 'Teleport five times.', xp: 10, hint: 'Press Teleport again five times.', check: (f) => f.runs >= 5 },
    { id: 'q-bits', xp: 15, quiz: { q: 'How many classical bits must Alice send to Bob?', options: ['0', '1', '2', '3'], answer: 2, explain: 'Two measurement results pick one of four corrections — so no faster-than-light signalling.' } },
  ],
  shor9: [
    { id: 'x2', text: 'Inject a bit-flip X on qubit 2 and recover the logical qubit.', xp: 15, hint: 'Error = X, then click qubit 2.', check: (f) => f.err === 'X' && f.q === 2 && f.F > 0.999 },
    { id: 'y', text: 'Inject a Y error — bit and phase flip at once — and recover.', xp: 15, hint: 'Error = Y on any qubit.', check: (f) => f.err === 'Y' && f.F > 0.999 },
    { id: 'sweep', text: 'Run the noise sweep and find where the code stops helping.', xp: 25, hint: 'Press Run sweep in the panel below the workbench.', check: (f) => f.sweepDone },
    { id: 'q-dist', xp: 15, quiz: { q: 'How many arbitrary single-qubit errors can the Shor code always correct?', options: ['1', '2', '3', '9'], answer: 0, explain: 'It has distance 3: any one error is fixed; two errors can fool the majority vote.' } },
  ],
};

export const LAB_BADGES = {
  qrng: ['🎲', 'Coin flipper'], dj: ['🔮', 'Oracle reader'], bv: ['🔑', 'Secret keeper'], simon: ['🧮', 'Period hunter'],
  grover: ['🔍', 'Needle finder'], qft: ['🌊', 'Wave maker'], qpe: ['🧭', 'Phase finder'], shor: ['🧩', 'Factorizer'],
  bb84: ['🔐', 'Key master'], teleport: ['🛸', 'Teleporter'], shor9: ['🛡️', 'Error slayer'],
};
export const SPECIAL_BADGES = {
  first: ['⚡', 'First mission'], overshoot: ['🎢', 'Overshot'], eve: ['👁', 'Eve caught'],
  sharp: ['🧠', 'Sharp mind'], arena: ['🏆', 'Arena champion'],
};

// Sandbox puzzles. `target` lists [basisIndex, re, im]; the state must match up to a global phase.
const R = Math.SQRT1_2;
export const CHALLENGES = [
  { id: 'plus', title: 'Fair coin', goal: 'Make |+⟩ = (|0⟩ + |1⟩)/√2', n: 1, xp: 20, target: [[0, R, 0], [1, R, 0]] },
  { id: 'hzh', title: 'No X allowed', goal: 'Make |1⟩ using only H and Z', n: 1, xp: 30, allowed: ['H', 'Z'], target: [[1, 1, 0]] },
  { id: 'minus', title: 'Minus sign', goal: 'Make |−⟩ = (|0⟩ − |1⟩)/√2', n: 1, xp: 20, target: [[0, R, 0], [1, -R, 0]] },
  { id: 'iplus', title: 'Point to +i', goal: 'Make (|0⟩ + i|1⟩)/√2', n: 1, xp: 25, target: [[0, R, 0], [1, 0, R]] },
  { id: 'bell', title: 'Bell pair', goal: 'Make (|00⟩ + |11⟩)/√2', n: 2, xp: 30, target: [[0, R, 0], [3, R, 0]] },
  { id: 'singlet', title: 'Singlet', goal: 'Make (|01⟩ − |10⟩)/√2', n: 2, xp: 40, target: [[1, R, 0], [2, -R, 0]] },
  { id: 'ghz', title: 'GHZ', goal: 'Make (|000⟩ + |111⟩)/√2', n: 3, xp: 40, target: [[0, R, 0], [7, R, 0]] },
];

export const LEVELS = [
  [0, 'Classical Bit'], [60, 'Qubit Apprentice'], [150, 'Superposer'], [280, 'Entangler'], [440, 'Interferer'],
  [620, 'Oracle Whisperer'], [820, 'Phase Master'], [1050, 'Error Corrector'], [1400, 'Quantum Wizard'],
];
