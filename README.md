# Quantum Labs

Coursework on quantum algorithms — Qiskit notebooks in `using_circuit/` and a NumPy simulator in `matrix_impl/`.

**Interactive site:** https://dat-2k2.github.io/quantum-labs/ — a short course through every lab (QRNG, Deutsch–Jozsa, Bernstein–Vazirani, Simon, Grover, QFT, phase estimation, Shor, BB84, teleportation, Shor 9-qubit code), re-implemented on a small state-vector simulator that runs in the browser. Each lab is a focused lesson: a short explanation, missions on the live circuit and quizzes, with XP, levels and badges tracking progress. An arena of circuit puzzles sits on top of a free-form circuit composer. Light and dark themes follow the system setting. Available in English and Vietnamese (switch in the footer or, on wide screens, the header; or link with `?lang=vi`).

The site is styled with the shared UI kit from the portfolio (`https://dat-2k2.github.io/kit/kit.css` and `kit.js`, light/dark, Geist); only the layout lives in `docs/assets/style.css`.

Design: [Figma file](https://www.figma.com/design/15VzLArJ1CFN475dHDfinY)

## Site

The site is static (no build step) and lives in `docs/`:

- `assets/sim.js` — state-vector simulator (Qiskit bit ordering)
- `assets/labs.js` — the eleven labs
- `assets/viz.js` — circuit diagrams, histograms, Bloch spheres, charts
- `assets/missions.js` — chapters, missions, quizzes, badges and arena puzzles
- `assets/game.js` — XP, levels, unlocks, toasts (progress saved in localStorage)
- `assets/app.js` — routing and views: course list, lesson flow, arena composer
- `assets/i18n.js`, `assets/i18n.vi.js`, `assets/localize.js` — translation helper, Vietnamese copy, content swap

Preview locally with `python3 -m http.server -d docs` and open http://localhost:8000.

Deployment: `.github/workflows/pages.yml` publishes `docs/` on every push to `main`. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions** once.
