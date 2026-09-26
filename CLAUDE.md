# Project: MkStudy

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
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`), hand-tuned design tokens in
  `src/app.css` (see Design System below) rather than a component library — keeps the UI lean
  and exactly on-brand. Fonts are bundled locally via `@fontsource-variable/*` so the app
  never needs the network.
- **Security:** a strict CSP in `tauri.conf.json` (only bundled code, plus Tauri IPC).
  Tauri permissions are least-privilege: `core:default` + `dialog:allow-open` only. File
  access goes through our own Rust commands, not the fs plugin.
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
  settings.json                  # synced preferences (created once there are any)
```

- The **location of the data folder** is remembered outside it, in `config.json` in the OS
  app-config dir (`%APPDATA%\com.mkstudy.desktop\` on Windows), since it can't live inside
  the folder it points to. This file is per-device and not synced.
- On first launch (or if the remembered folder no longer exists) the app shows an onboarding
  screen asking the user to pick a folder. Picking one creates `formulas/` and `calculator/`
  inside it, which also confirms the folder is writable.

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
- Choose/change the data-root folder (changing it does not move existing files).
- (Optional) Obsidian vault name, used only for the "Open in Obsidian" deep link.
- No theme setting: dark is the only theme (see Design System).

## Design system

- **Aesthetic:** dark, focused, IDE-like — deliberately chosen over a light or dual-theme
  approach. Think a code editor / terminal, not a document app.
- **Layout:** minimal chrome, no decorative elements. A 208px left sidebar (app name, the
  three modules, Settings pinned to the bottom) + content area. Each module has a one-glyph
  marker: `=` Calculator, `∑` Formulas, `Ω` EE Toolbox. Generous whitespace within panels —
  minimalism means *few, well-chosen elements*, not cramped density.
- **Typography:** Inter for UI text; JetBrains Mono for anything code-like or numeric (paths,
  values, units, the app name); KaTeX's own font for math. Math and code-like content should
  always be visually distinct from prose.
- **Color tokens** (defined in `src/app.css` under `@theme`, used as Tailwind utilities like
  `bg-surface`, `text-muted`):
  `base #0e1014` (window background), `surface #14171d` (sidebar/panels),
  `raised #1b1f27` (active/hover items, buttons), `line #252a34` (borders),
  `fg #e3e6ed` (text), `muted #858c9c` (secondary text), `accent #7aa2f7` (the single
  accent colour), `danger #f7768e` (errors).
- **Buttons:** `.btn` (neutral, accent border on hover) and `.btn-primary` (filled accent),
  defined in `src/app.css`.
- **Window:** 1100×720 default, 760×520 minimum, dark native title bar, and a window
  background colour matching `base` so there's no white flash on startup.
- **Motion:** fast, subtle transitions only (~100ms colour changes, no decorative
  animation) — speed is a feature.

## Current status

- **Built:** the app shell — window, sidebar navigation, first-launch data-folder picker,
  Settings page to change the folder, and the Rust commands behind it (`get_data_root`,
  `set_data_root` in `src-tauri/src/lib.rs`, with unit tests).
- **Placeholders only:** Calculator, Formulas, and EE Toolbox pages show a title and summary.
- **Not started:** Obsidian integration and every module's actual functionality.

## Development

```
npm install            # once
npm run tauri dev      # run the app with hot reload
npm run check          # Svelte/TypeScript type check
cd src-tauri && cargo test   # Rust unit tests
npm run tauri build    # release build + Windows installer
```

Code layout: `src/routes/<module>/+page.svelte` is one page per module (`/` redirects to
`/calculator`); `src/lib/` holds shared components and `dataRoot.svelte.ts` (data-folder
state); `src/routes/+layout.svelte` is the shell and first-launch gate; `src-tauri/` is the
Rust side.

**Machine note:** Windows Defender's Controlled Folder Access blocked `node`, `git`, `cp` and
PowerShell from writing inside `Documents\`, where this repo lives. The user turned it off on
2026-09-26. If builds or git suddenly fail with "No such file or directory" inside the
repo, check whether it has been re-enabled.

## Deferred ideas (not in scope now, but worth revisiting)

- **Lab data & error analysis toolkit** (2D dataset plotting, linear/curve fitting,
  uncertainty/error propagation calculators). Appealed during scoping alongside Obsidian
  integration, but the user chose to keep the app to 3 core modules for now rather than add
  a 4th. Revisit if the calculator + EE toolbox prove insufficient for lab report work.

## Open questions

- **App icon:** still the Tauri default. Needs a design (or at least a decision on style).

Log new open questions here as they come up, and remove them once resolved (move the
resolution into the relevant section above).

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
- 2026-09-26: Named the app **MkStudy** (identifier `com.mkstudy.desktop`). Built the app
  shell first, as its own PR, before any module, to confirm the stack is fast before adding
  features. The data-folder path is stored in the OS app-config dir rather than in
  `settings.json`, because the data folder can't hold its own location.
