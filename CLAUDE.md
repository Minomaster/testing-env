# Project: Axiom (placeholder name)

> This file is the living specification for this project. It is the single source of truth
> for *what we're building and why*. It must be kept precise and current: every time a
> decision is made, a feature is added/changed/dropped, or a problem forces a redesign,
> **update this file in the same session**, not just the code. A future session (or a fresh
> Claude instance) should be able to read only this file and understand the product exactly
> as it stands today.
>
> Style rule for this file: state decisions, not options. If something is genuinely
> undecided, put it under "Open Questions" — don't leave ambiguity buried in prose elsewhere.

## Owner & context

Student in a combined **Physics + Electrical Engineering** program (6-year track, BSc+MSc
scope). This software is a personal tool built to be useful across the *entire* degree, not
a semester project — features should stay relevant from first-year mechanics to
graduate-level EE coursework.

## Vision (one paragraph)

A single, fast, minimalist **desktop app** that acts as the student's everyday academic
toolkit: a unit-aware calculator, a growing personal formula reference library, and a set of
formula-based EE calculators — all backed by plain, human-readable files the user fully owns
and can sync/back up however they like (OneDrive, Dropbox, git). Note-taking is deliberately
**not** part of this app — the user already uses Obsidian for that, and does it well — so the
app instead integrates lightly with Obsidian (see Obsidian Integration) rather than
competing with it. No heavy computation (no 3D rendering, no circuit simulation, no CAS) —
the value is in being elegant, instant, and always at hand, not in raw power.

## Explicit non-goals

These have been deliberately ruled out. Do not add them without a new conversation that
revisits this section:

- No 3D rendering or modelling of any kind.
- No full circuit simulation (SPICE-like transient/AC sweep analysis). EE tools are
  **formula-based calculators only**, not a circuit topology solver.
- No symbolic computer-algebra system (CAS) like Mathematica/Wolfram Alpha.
- No cloud backend / user accounts. Sync is the user's own responsibility via a synced
  folder (OneDrive/Dropbox/git) pointed at the app's data directory.
- No mobile app (for now).
- No collaboration/multi-user features.
- No notes module and no drawing/diagramming tools of any kind — the user already uses
  Obsidian for notes and sketching context lives there, not in this app (see Obsidian
  Integration).

## Platform & tech stack

Decided by Claude as the domain expert, per the user's request to recommend a stack
optimized for speed, minimalism, and low computational needs.

- **Framework:** [Tauri v2](https://tauri.app) (Rust backend shell + web frontend). Chosen
  over Electron for a dramatically smaller footprint and faster startup/runtime (no bundled
  Chromium copy per app, lower idle RAM) — directly serves the "smooth and fast" requirement.
  Chosen over a pure web app because Tauri gives real, unsandboxed filesystem access to a
  user-chosen folder, which the plain-files storage model (below) depends on.
- **Frontend:** SvelteKit (static adapter) + TypeScript. Svelte compiles away to minimal
  vanilla JS with no virtual-DOM overhead — fits the "fast to run" and "minimalist" goals
  better than React for an app this size.
- **Styling:** Tailwind CSS, hand-tuned design tokens (see Design System below) rather than
  a component library — keeps the UI lean and exactly on-brand.
- **Math rendering:** [KaTeX](https://katex.org) for LaTeX rendering in the formula library.
  Chosen over MathJax for rendering speed (KaTeX is synchronous and much faster, which
  matters for a "smooth" feel).
- **Math/units engine:** [math.js](https://mathjs.org) for the unit-aware calculator —
  handles SI unit conversion, complex numbers (needed for EE phasors/impedance), matrices,
  and significant-figure-aware arithmetic in one library.
- **No backend server, no database engine.** Data lives entirely in plain files (next
  section), read/written via Tauri's filesystem APIs.

## Data & storage model

Everything is a **plain, human-readable file** inside one root folder that the user selects
on first launch (typically a folder inside their OneDrive/Dropbox/git-tracked directory, so
sync across devices is "free" and manual, as decided). No proprietary formats, no lock-in.

```
<data-root>/
  formulas/
    mechanics.json
    electromagnetism.json
    thermodynamics.json
    waves-optics.json
    circuits-dc-ac.json
    signals-systems.json
    electronics-semiconductors.json
    control-systems.json
    ... (one JSON file per top-level category, user-extensible)
  calculator/
    history.json                 # recent calculations, saved variables/constants
  settings.json                  # data-root path, last-opened state, preferences
```

- **Formula library entries** are JSON objects: `{ name, latex, variables: [{symbol, unit,
  description}], category, tags, course_ref, notes }`. Ships **pre-populated** with a
  standard baseline curriculum set across the categories above, and the user extends/edits
  freely from within the app.
- **Sync** is manual/implicit: since it's just files, the user can put `<data-root>` inside
  any synced folder. The app has no knowledge of sync and needs none.

## Feature modules

### 1. Unit-aware calculator
- Understands SI units and conversions natively (type `120 mph to m/s`, get correct result).
- Complex number support for EE phasor/impedance math (`5∠30° + 3∠-45°` style, or rectangular).
- Significant-figures-aware display (student shouldn't have to manually round).
- Vector support for mechanics (basic dot/cross product, magnitude).
- Persistent history + ability to save named variables/constants across sessions.

### 2. Formula reference library
- Browsable and full-text searchable, organized by category (see file list above).
- Pre-populated with a standard Physics + EE curriculum baseline; fully user-editable/extensible.
- Each formula renders in proper LaTeX and lists variables with units.
- Quick-insert into the calculator, and "Copy as Markdown" to paste into Obsidian (see
  Obsidian Integration below).

### 3. EE toolbox (formula-based only, no topology solver)
Dedicated calculators, each a thin UI over a known formula — explicitly **not** a general
circuit solver:
- Ohm's law / Kirchhoff's voltage & current law helpers
- Series/parallel combination for R, L, C
- RC / RL / RLC time constant and cutoff-frequency calculators
- Impedance & phasor calculator (leans on the complex-number engine above)
- Resistor color-code decoder/encoder
- dB / gain / power ratio conversions
- Voltage divider calculator

### 4. Obsidian integration (cross-cutting, not a standalone module)
The app deliberately does not have a notes feature (the user's Obsidian setup already covers
this excellently). Instead, every place in the app that produces reusable content offers a
one-click way to hand it to Obsidian rather than trying to replace it:
- **Copy as Markdown**: formula library entries, calculator results, and EE toolbox results
  can be copied as Obsidian-flavored Markdown (using `$$...$$` KaTeX-compatible math blocks)
  ready to paste directly into a vault note.
- **Open in Obsidian** (stretch goal, not required for v1): if the user configures their
  vault name, a formula/result can optionally deep-link into Obsidian via the `obsidian://`
  URI scheme to jump to a related note.
- The app never reads, writes, or indexes the Obsidian vault directly — integration is
  one-directional and clipboard/URI-based, keeping the two tools decoupled.

### 5. Settings
- Choose/change the data-root folder.
- Theme configuration (see Design System — dark is the default and, for now, the only theme).
- (Optional) Obsidian vault name, used only for the "Open in Obsidian" deep link.

## Design system

- **Aesthetic:** dark, focused, IDE-like — deliberately chosen over a light or dual-theme
  approach. Think a code editor / terminal, not a document app.
- **Layout:** minimal chrome, no decorative elements. Sidebar for module navigation +
  content area. Generous whitespace within panels despite the dark, dense aesthetic —
  minimalism means *few, well-chosen elements*, not cramped density.
- **Typography:** a clean monospace or near-monospace UI font (e.g. JetBrains Mono / Inter
  for UI text, KaTeX's own font for math). Math and code-like content (formulas, units)
  should always be visually distinct from prose.
- **Color:** dark neutral background (near-black, not pure black), a single accent color for
  interactive elements/highlights, muted secondary text. No theme toggle for now — revisit
  only if requested.
- **Motion:** fast, subtle transitions only (no decorative animation) — speed is a feature.

## Deferred ideas (not in scope now, but worth revisiting)

- **Lab data & error analysis toolkit** (2D dataset plotting, linear/curve fitting,
  uncertainty/error propagation calculators). Appealed during scoping alongside Obsidian
  integration, but the user chose to keep the app to 3 core modules for now rather than add
  a 4th. Revisit if the calculator + EE toolbox prove insufficient for lab report work.

## Open questions

Nothing blocking right now. Log new open questions here as they come up, and remove them
once resolved (move the resolution into the relevant section above).

## Decision log

- 2026-09-26: Initial scope defined via user Q&A. Core decisions: unified desktop toolkit,
  Tauri+Svelte stack, plain-file storage (Markdown+JSON) in a user-chosen folder, dark
  IDE-like design, formula-based (not topology-solving) EE tools, Semester→Course→Topic note
  structure, pre-populated+extensible formula library, lightweight diagram support in notes.
- 2026-09-26: Removed the Notes module entirely — user already uses Obsidian and doesn't want
  a competing notes feature. Replaced with a lightweight, cross-cutting "Obsidian Integration"
  feature (copy-as-Markdown, optional obsidian:// deep link) instead of a 4th module. Diagram
  support and the `notes/` data folder were removed along with it, since they existed only to
  serve the notes module. A "lab data & error analysis toolkit" idea was raised but explicitly
  deferred rather than added as a replacement module.
