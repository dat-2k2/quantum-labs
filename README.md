# Quantum Labs

Coursework on quantum algorithms — Qiskit notebooks in `using_circuit/` and a NumPy simulator in `matrix_impl/`.

**Interactive site:** https://dat-2k2.github.io/quantum-labs/ — a gamified tutorial through every lab (QRNG, Deutsch–Jozsa, Bernstein–Vazirani, Simon, Grover, QFT, phase estimation, Shor, BB84, teleportation, Shor 9-qubit code), re-implemented on a small state-vector simulator that runs in the browser. Each lab has a short lesson, missions on the live circuit and quizzes; XP, levels, stars and badges track progress, and an arena of circuit puzzles sits on top of a free-form circuit composer.

Design: [Figma file](https://www.figma.com/design/15VzLArJ1CFN475dHDfinY)

## Site

The site is static (no build step) and lives in `docs/`:

- `assets/sim.js` — state-vector simulator (Qiskit bit ordering)
- `assets/labs.js` — the eleven labs
- `assets/viz.js` — circuit diagrams, histograms, Bloch spheres, charts
- `assets/missions.js` — chapters, missions, quizzes, badges and arena puzzles
- `assets/game.js` — XP, levels, unlocks, toasts (progress saved in localStorage)
- `assets/app.js` — page wiring: quest map, tutorial panel, arena composer

Preview locally with `python3 -m http.server -d docs` and open http://localhost:8000.

Deployment: `.github/workflows/pages.yml` publishes `docs/` on every push to `main`. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions** once.
