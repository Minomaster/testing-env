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
- **Math/units engine:** [math.js](https://mathjs.org) does the arithmetic on numbers,
  complex numbers and units (conversion, simplification such as Ω·F → s, SI-prefix choice).
  Parsing, significant figures and display formatting are our own code in `src/lib/calc/`,
  because math.js forgets how a number was typed (can't tell `4.70` from `4.7`), strips
  trailing zeros when formatting, and doesn't accept `Ω`, `µ`, `∠` or `°`.
  Never register custom units with `math.createUnit`: they join math.js's preferred-unit
  table and hijack simplification (seconds start displaying as hours). Aliases like `mph`
  resolve to `math.unit(1, "mi/h")` instead (see `UNIT_ALIASES` in `src/lib/calc/math.ts`).
  math.js runs with `Unit.setUnitSystem("si")`: its default "auto" system globally remembers
  the last unit typed per dimension and simplifies into it, which made display depend on
  earlier input (typing `500 nm` turned later speeds into nm/s).
- **Tests:** Vitest for the TypeScript engine (`npm test`), `cargo test` for Rust.
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
    scratchpad.txt               # the calculator sheet, exactly as typed (plain text)
  settings.json                  # synced preferences, e.g. { "calculator": { "angleMode": "deg" } }
```

- File reads/writes go through the Rust commands `read_data_file` / `write_data_file`,
  which only accept plain relative paths inside the data folder (no `..`, no absolute
  paths). Writes are atomic (write to `.tmp`, then rename) so sync clients never see a
  half-written file. The scratchpad is saved 300 ms after typing stops, on blur, and when
  leaving the page.

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
**Form:** a single notepad-style **scratchpad** (decided over multiple named sheets): each
line is evaluated live as you type, with its result right-aligned in a column beside it
(like Soulver/Numi). It persists between sessions as `calculator/scratchpad.txt`. Anything
worth keeping long-term gets copied to Obsidian. Saved variables/constants are simply
assignment lines at the top of the scratchpad.

**Syntax**
- Assignment `name = expr`; later lines can use `name`. `ans` is the previous line's result.
- `# ...` is a comment (a whole-line comment works as a heading).
- Units follow numbers directly: `220 Ω` or `220 ohm`, `4.70 µF` or `4.70 uF`, `9.81 m/s^2`
  or `m/s²`, `30°`, `25 °C`. Also understands `mph`, `kph`/`kmh`.
- Convert with `to` or `->`/`→`: `120 mph to m/s`. A bare number converted to an angle unit
  is read in the current angle mode (`90 to rad` in DEG gives 1.5708 rad).
- Juxtaposition multiplies and binds tighter than `*` and `/`: `1 / 2 pi tau` = 1/(2πτ).
- Complex numbers: **`i`** is the imaginary unit (decided over j). Polar input uses `∠`,
  or `<` as an easy-to-type alternative: `5.00 V ∠ 30`.
- Functions: `sqrt cbrt abs re im conj arg exp ln log (base 10) log2 sin cos tan asin acos
  atan sinh cosh tanh`, plus the vector functions below. Constants: `pi`/`π`, `e`, `i`.
- Name lookup order: your variables → constants → units. So a variable may shadow a unit
  (`C = 2` then `3 C` is 6, not 3 coulombs). The names `pi π e i ans to` and function
  names (including `unit`, `angle`, `dot`, `cross`, `proj`) can't be assigned.

**Significant figures (automatic from inputs, as decided)**
- A number **without a unit is exact** (the 2 in `2 pi f`, and also bare decimals like a
  dimensionless `0.35`). π, e and i are exact.
- A number **written directly before a unit is a measurement, and every digit counts,
  trailing zeros included**: `220 Ω` = 3 s.f., `4.70 µF` = 3, `100 m` = 3, `0.0047 F` = 2
  (leading zeros don't count), `4.7e-6 F` = 2.
- × ÷: fewest s.f. among measured inputs. + −: least precise decimal place, compared in
  SI so mixed units work (`1.2 m + 3.45 cm` = 1.2 m). Powers with exact exponents, roots,
  trig, exp and unit conversion keep the input's s.f.; logs follow the textbook rule
  (decimal places of the result = s.f. of the input).
- Full precision is kept internally; rounding happens only for display.
- Display: exactly the s.f. count, keeping trailing zeros (`2.20`). If plain digits would
  need non-significant trailing zeros, the result **steps up one SI prefix** instead
  (50 mm at 1 s.f. → `0.05 m`, 159 Hz at 2 s.f. → `0.16 kHz`), as the user chose.
  If that isn't possible (compound units like m/s, or no prefix fits), scientific notation
  is used (`1.5 × 10² m/s`). Also scientific below 10⁻⁴. A unit fixed with `to` is
  never re-prefixed. Exact results show at most **6 significant digits** with trailing
  zeros removed (`1/3` → `0.333333`).
- **Unit display:** results of combining different units are simplified to SI
  (`220 Ω × 4.70 µF` → `1.03 ms`, N·m → J). Units the user spells out stay as typed
  (`4.70 µF`, `9.81 m/s²`, `60 mph`), including when scaled by a number
  (`3.0 km/h * 2` → `6.0 km/h`). Shown prettily: `Ω`, `µF`, `m/s²`, `kg·m`, `30°`.
- **Prefixes:** a single unit gets an automatic prefix only from the everyday set
  p n µ m k M G T (for mass: µg mg g kg). Otherwise the base unit with × 10ⁿ is used, as in
  textbooks: `9.10938 × 10⁻³¹ kg`, `1.60218 × 10⁻¹⁹ C`, not `0.91 rg` or `160 zC`.
  Compound units (`J·s`, `mol⁻¹`, `km/h`) are never given an automatic prefix.

**Complex results** show **both forms**: `3 + 4i · 5∠53.1301°`, with units
`(4.33 + 2.50i) V · 5.00∠30.0° V`. Both parts are rounded to the same decimal place (set by
the magnitude's s.f.); a part that rounds to zero is dropped (`i*i` → `-1`, `10∠90` →
`10i · 10∠90°`).

**Angles:** a **DEG/RAD toggle** in the calculator header (saved in `settings.json`). It
applies to trig inputs, inverse-trig outputs (`asin(0.5)` → `30°` in DEG), `∠` angles and
polar display. An explicit unit always wins (`sin(30 deg)` in RAD mode).

**Interaction:** click a result to copy it (the label briefly shows "Copied"). Errors show
as a short dimmed message in the result column (e.g. `Unknown name "x"`,
`Units don't match`) and don't stop later lines from evaluating.

**Physical constants (as decided)** — defined in `src/lib/calc/constants.ts`, CODATA 2018
values, all **exact** (never limit sig figs). Named with **plain symbols, and units win**:
where a symbol is already a unit, the unit keeps it and the constant uses an alternative.
Your variables can shadow any of them (`R = 220 Ω` works; before that, `R` is the gas
constant).

| Group | Names |
|---|---|
| Core | `c`/`c_0`, `h_P` (h = hour), `hbar`/`ħ`, `G`/`G_N`, `g_n` (g = gram), `k_B` (kB = kilobyte), `N_A`, `R`, `σ`/`sigma` |
| EM | `q_e` (e = Euler's number), `ε_0`/`ε0`/`eps_0`/`eps0`, `µ_0`/`µ0`/`mu_0`/`mu0`, `k_e`, `Z_0`/`Z0` |
| Particles & atomic | `m_e`, `m_p`, `m_n`, `m_u` (u is already the atomic mass unit), `a_0`/`a0`, `R_inf`, `α`/`alpha` |
| Semiconductor / EE | `V_T` (thermal voltage at 300 K), `Faraday` (F = farad); electron-volt is the unit `eV` |

`hbar` is the one exception to "units win": math.js reads it as hectobar, which nobody means.

**Vectors (as decided)**
- Written with **brackets only**: `[3, 4, 0] N` (one unit after the brackets) or
  `[0.20 m, 0, 0.50 m]` (a unit per component; a bare `0` takes the others' unit).
  2 or more components; all components must share a dimension; no complex components.
- **`dot(a, b)` and `cross(a, b)` are functions**; `*`, `·` and `×` stay plain multiplication
  (vector × vector with `*` is an error pointing to dot/cross). `cross` of two 3D vectors
  gives a vector; of two 2D vectors, the scalar z-component. Cross products with energy
  dimensions are shown in **N·m** (torque), not J; `dot` still gives J (work).
- Also `unit(a)`, `angle(a, b)` (follows DEG/RAD), `proj(a, b)` (projection of a onto b),
  `abs(a)` (magnitude), and component access **`a.x`, `a.y`, `a.z`** (works on any
  expression: `(a + b).y`). Vectors add/subtract with vectors, scale by numbers, negate, and
  convert with `to`.
- **Display:** components + magnitude, plus the direction angle for 2D:
  `[3.00, 4.00] N · 5.00 N @ 53.1°`; 3D: `[1, 2, 2] N · |3 N|`. (`@` is display-only.)
- **Sig figs:** like complex numbers, all components share one decimal place, set by the
  least precise *non-zero* component, so a written `0` never limits precision:
  `[3.00, 4.00, 0] N` → `[3.00, 4.00, 0.00] N`. The vector's s.f. count is relative to its
  magnitude; `a.x` gets the s.f. its digits have at that shared place.
- If components carry a unit fixed by `to` (or a torque), the magnitude is shown in that
  same unit.

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

- **Built:** the app shell (window, sidebar, first-launch data-folder picker, Settings page)
  and the **Calculator** including vectors and physical constants (everything in its
  section above). Rust
  commands: `get_data_root`, `set_data_root`, `read_data_file`, `write_data_file`.
- **Placeholders only:** Formulas and EE Toolbox pages show a title and summary.
- **Not started:** Obsidian integration, Formulas, EE Toolbox.

## Development

```
npm install            # once
npm run tauri dev      # run the app with hot reload
npm run check          # Svelte/TypeScript type check
npm test               # calculator engine tests (Vitest)
cd src-tauri && cargo test   # Rust unit tests
npm run tauri build    # release build + Windows installer
```

Code layout: `src/routes/<module>/+page.svelte` is one page per module (`/` redirects to
`/calculator`); `src/lib/` holds shared components, `dataRoot.svelte.ts` (data-folder
state) and `dataFiles.ts` (data-file and `settings.json` helpers); `src/lib/calc/` is the
calculator engine (`parse.ts` → `evaluate.ts` → `format.ts`, with `vector.ts` for vector
maths, `math.ts` for the math.js instance, tests in `calc.test.ts`);
`src/routes/+layout.svelte` is the shell and first-launch gate; `src-tauri/` is the Rust
side.

**Testing the real app:** launch with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`
and drive the WebView over the Chrome DevTools Protocol (evaluate JS, screenshot, send
trusted clicks). Before testing, back up `%APPDATA%\com.mkstudy.desktop\config.json` and
point it at a scratch data folder, then restore it, so the user's real data is never touched.
The user's own data folder is `C:\Users\Mehdi\Downloads\testEnv`.

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
- 2026-09-26: Built the Calculator as the first module (the EE Toolbox will reuse its engine).
  User decisions: notepad-style sheet; automatic sig figs where bare numbers are exact and
  numbers with units count every digit; a single scratchpad rather than named sheets; `i` as
  the imaginary unit; complex results in both rectangular and polar form; a DEG/RAD toggle.
  Claude's decisions (open to change): exact results show ≤ 6 significant digits; scientific
  notation rather than an SI-prefix change when trailing zeros would be ambiguous;
  variables shadow units; `<` accepted for `∠`; click-to-copy results; `history.json`
  replaced by a plain-text `scratchpad.txt`. Vectors were deferred to a follow-up.
- 2026-09-26: Added calculator vectors. User decisions: brackets-only syntax; dot()/cross()
  as functions (·/×/* stay multiplication); display components + magnitude + 2D direction
  angle; include unit(), angle(), proj() and .x/.y/.z. Also changed the ambiguous-zeros
  rule from scientific notation to **stepping up an SI prefix** (user's choice; scientific
  remains the fallback). Claude's decisions (open to change): components share one decimal
  place and written zeros don't limit precision; 2D cross gives the scalar z-component;
  cross products with energy dimensions display as N·m.
- 2026-09-26: Added built-in physical constants. User decisions: plain symbols with units
  winning clashes; all four groups (core, EM, particles & atomic, semiconductor/EE); exact
  values. Claude's decisions: alternative names `h_P`, `g_n`, `q_e`, `m_u`, `Faraday`;
  `hbar` overrides the unused hectobar unit; constants are shadowable, not reserved.
  Fixed two display bugs found along the way: math.js's global "auto" unit system (display
  depended on earlier input) replaced by the fixed SI system, with user-typed units kept as
  typed; and automatic prefixes limited to p–T (mass µg–kg), so tiny constants show as
  × 10ⁿ in the base unit instead of zC/rg/ymol⁻¹.
