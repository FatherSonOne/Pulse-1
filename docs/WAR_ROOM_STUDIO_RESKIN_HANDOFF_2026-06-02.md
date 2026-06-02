# War Room Studio — Modal Reskin Handoff (2026-06-02)

Source: `/impeccable critique` of the Studio rail + its 6 generator modals (this session).
Scope chosen: **All 6 modals — visual reskin + UX fixes** · shared button = **see correction D0** · **plan-first, build wave-by-wave with sign-off**.

> Planning doc. No functional code changed by writing it. Each modal is reskinned
> on the live Notebook path only; the engine underneath is untouched and the
> dormant legacy StudioLayout path is not in scope.

---

## 0. Wiring confirmation (the prerequisite question)

**All six Studio features are fully wired — zero stubs.** Verified by reading the real imports + call sites:

| Item | Real call | Site |
|---|---|---|
| Study Guide | `processWithModel(prompt)` | StudyGuideGenerator.tsx:127 |
| FAQ | `processWithModel(prompt)` | FAQGenerator.tsx:102 |
| Timeline | `processWithModel(prompt)` | TimelineGenerator.tsx:108 |
| Podcast | `processWithModel` + ElevenLabs `generateSpeech` | PodcastGenerator.tsx:156, :211 |
| Comparative Analysis | `compareDocuments` (advancedAIService) | ComparativeAnalysis.tsx:13 |
| Knowledge Graph | `buildKnowledgeGraph` (advancedAIService) | KnowledgeGraphViewer.tsx:16 |

`processWithModel` routes server-side via the `ai-router` edge function (Pulse Gemini convention). This is a **reskin, not a rebuild**. The "Analyzing documents…" / "Select 2+ documents" states the user saw are real behavior (live call on 1 doc; correct 2-doc gating).

---

## 1. Critique result (combined)

- **Design Health: 22/40** (below average). The single 0/4 is **Consistency** — two design languages in one feature.
- **Rail (`GeneratorRail.tsx`): on-brand, do NOT touch.** Correct `--pulse-*` tokens, Lucide, coral budget (icon tile + `ADV` mono chip only), mono label. It is the **north star** for the reskin.
- **The 6 modals: textbook AI-slop skin** over a real engine. Deterministic detector flagged **16 `ai-color-palette` hits** (purple gradients + `text-purple-400`) in Podcast (×8), Timeline (×5), Comparative, KnowledgeGraph; **0 in the rail**. The LLM review additionally caught FontAwesome residue, gray-on-gray stacking, the vendor brag, and missing provenance — which the color-only detector can't see.

---

## 2. Decisions taken (+ one correction)

| # | Decision | Resolution |
|---|----------|-----------|
| **D0** | **Shared `war-room-btn-primary` gradient** | **CORRECTION — pending user re-confirm.** You chose "fix the shared class once" on the premise it "leaks gradient." On investigation it is **on-spec**: `WarRoomStyles.css:468` is `linear-gradient(135deg,#f43f5e,#ec4899)` + white text, which is exactly DESIGN.md §5's documented brand **primary CTA**. Converting it to solid coral would diverge *from* the system. It's also consumed by live non-Studio surfaces (Decisions `DecisionMission`/`MissionShell`, `DocumentViewer`, `SessionExport`). **Recommendation: LEAVE `war-room-btn-primary` as-is.** (Optional minor: the dark-mode `0 0 60px` glow at :484/:488 is heavier than the system's coral-halo; can soften, low priority.) Re-confirm before any change. |
| D1 | Scope | All 6 modals, **visual + UX** (full P0-P2 sweep). |
| D2 | Execution | Plan-first (this doc), then build one modal per commit with sign-off. |

**The gradient rule for the reskin (from DESIGN.md):**
- Rose→pink (`#f43f5e→#ec4899`) is allowed **only** on the primary CTA (`war-room-btn-primary`). Keep it there.
- Rose→pink used as **decoration** (progress bars, hero tiles, timeline spines) → **off-spec**, replace with neutral/coral-tinted solid.
- **Purple / blue** gradients anywhere → off-spec (the generic-AI anti-reference), replace.

---

## 3. Token mapping (the core translation)

The modals live in a bespoke `--wr-*` + raw-Tailwind world; migrate to canonical `--pulse-*` (what the rail uses). Reference the rail + `SourcesUsedPanel`/`CitationChip` for canonical usage.

| Current (modal) | Replace with |
|---|---|
| `bg-gray-950` / `bg-gray-900` / `bg-gray-800` opaque stacks · `.war-room-panel` (`--wr-*`) | `--pulse-surface` (canvas) / `--pulse-surface-raised` or `--pulse-bg-elev` (raised) — match notebook surfaces |
| `bg-black/80 backdrop-blur-sm` overlay | the notebook modal overlay treatment (neutral scrim; blur only on the modal panel, which is the one sanctioned glass use) |
| `text-white` | `--pulse-ink` (primary) / `--pulse-ink-2` / `--pulse-ink-3` |
| `border-gray-700/800` | `--pulse-border` |
| `from-purple-* / from-blue-* / via-purple` gradients (hero tiles, progress, spine) | neutral surface OR `--pulse-coral-bg-12` tile with coral-tinted Lucide (mirror the rail's 30×30 icon tile) |
| `from-rose-500 to-pink-500` **decorative** (progress bars) | solid `--pulse-coral` fill or neutral track + coral indicator |
| active tab `bg-blue-500/20 text-blue-400`, `bg-emerald-500/20`, `bg-purple-500/20` | `--pulse-coral-bg-12` + `--pulse-coral-fg` (coral = active/AI signal) |
| `<i className="fa fa-…">` (real FA) + `className="fa"/"fas"` on Lucide | import the matching **Lucide** icon; strip all `fa`/`fas` class tokens |
| section labels in Inter | JetBrains Mono uppercase tracked 0.1em (`--pulse-font-mono`) — the signature |
| emoji in exports (🔴🟡🟢🏆) | text/Lucide markers |
| 4-6 color stat/doc "confetti" | neutral + a single coral emphasis; pair color dots with a label/initial |

**Provenance:** every result header gets `<ProvenanceTag model="GEMINI" kind="STUDY GUIDE" />` ([ProvenanceTag.tsx](../src/components/WarRoom/ProvenanceTag.tsx), props `{model, kind, showDot, className}`, renders `ps-provenance`). **Verify** the `ps-provenance` CSS is globally loaded for components outside `notebook/` before relying on it (it's used in `notebook/MessageList`); if scoped, import/move the rule. This is the legitimate home for coral and replaces the "Powered by Gemini AI ⚡" vendor brag.

---

## 4. Work items (one modal per commit)

Each: reskin to §3 mapping + the UX fix noted. Verify: `tsc` (no NEW errors) per file; visual QA needs a running app.

### Wave A — Advanced AI (the harshest jump; `AdvancedAIPanel` doesn't even use `war-room-*`)
- **WA-1 `AdvancedAIPanel.tsx`** — kill `bg-gray-950→900→800` stacks → `--pulse-*` surfaces; delete `from-blue via-purple to-pink` Brain hero (L47) → neutral coral-tinted tile; active tabs `bg-blue-500`/`bg-purple-500` → coral; **remove "Powered by Gemini AI ⚡" (L179-181)** → per-artifact ProvenanceTag; doc-pill 6-color palette → neutral + label; strip `fas` on Lucide.
- **WA-2 `ComparativeAnalysis.tsx`** — gray stacks → tokens; `from-blue to-purple` tiles + SVG ring `#3b82f6→#8b5cf6` → neutral/coral; 4-color stat confetti → neutral+coral; real `<i className="fa …">` → Lucide; add provenance. **UX: gate the auto-run** (useEffect :37 fires `compareDocuments` on mount) behind an explicit Generate CTA (mirror the content-generator empty→generate pattern).
- **WA-3 `KnowledgeGraphViewer.tsx`** — gray stacks → tokens; `from-purple to-pink` header (L416) + SVG `#8b5cf6→#ec4899` → neutral/coral; canvas hardcoded hex (`#0f1115`, `#fff`, `#e2e8f0`) → read CSS vars; canvas labels `'10px Inter'` → JetBrains Mono; `focus:border-purple-500` → coral; `fas` + real `<i>` (L655) → Lucide; add provenance. **UX: gate the auto-run** (useEffect :55 fires `buildKnowledgeGraph` on mount) behind a CTA + show progress/ETA.

### Wave B — Content generators (share the `war-room-btn-primary`/`.war-room-panel` shell)
- **WB-1 `StudyGuideGenerator.tsx`** — `bg-black/80` overlay; emerald accents (`getDifficultyColor`, active tabs) → neutral + status-vocab where it's genuinely status, else coral; `from-emerald to-teal` progress → solid; strip 12× `className="fa"` on Lucide; add provenance.
- **WB-2 `FAQGenerator.tsx`** — blue accents; **`from-rose-500 to-pink-500` progress bar (L262)** → solid coral (decorative brand-gradient misuse); `getCategoryColor` purple+rose array → neutral; real `<i className="fa fa-chevron-right">` (L382) → Lucide `ChevronRight`; strip `fa` on Lucide; add provenance.
- **WB-3 `TimelineGenerator.tsx`** — purple hero icon (L226); `from-purple to-pink` progress (L253), **timeline spine (L364)**, connector (L409) → neutral/coral; active state purple → coral; raw dot colors → status vocab; real `<i className="fa …">` (L379/418: trophy/calendar/circle-dot) → Lucide; emoji export → markers; add provenance.
- **WB-4 `PodcastGenerator.tsx`** — `from-purple-500 to-pink-500` hero tile + `text-white` (L410), hero circle (L449), 3× progress gradients → neutral/coral; speaker colors pink/blue → neutral; `ring-purple-500` selection → coral; real `<i className="fa fa-play/pause">` (L612), emphasis icons (L690) → Lucide; **UX: move ElevenLabs TTS/API-key/voice config out of the pre-generation view** (progressive disclosure — show it after a script exists, or behind an "Advanced voice" toggle); **rename modal title "Audio Overview" → "Podcast"** to match the rail label; add provenance.

### Cross-cutting (fold into each commit, not separate)
- FA→Lucide, provenance chips, purple/blue→neutral, decorative-rose→solid, mono labels — applied per file as above.

---

## 5. Out of scope / not touching
- **The rail (`GeneratorRail.tsx`)** — already on-brand.
- **The engine** — `advancedAIService`, `geminiService.processWithModel`, `elevenLabsService`, the force-directed canvas sim, JSON parsing. Reskin only.
- **`war-room-btn-primary`** — on-spec per DESIGN.md (D0); leave unless user re-confirms otherwise.
- **Dormant legacy StudioLayout path** — Phase 11 owns it.
- **Non-Studio consumers of `war-room-*`** (Decisions missions, DocumentViewer, SessionExport) — not in this pass.

---

## 6. Verification strategy
- Type-check: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, gate on **no NEW errors** (repo carries ~1234 pre-existing).
- Re-run `npx impeccable --json <file>` per modal after reskin → expect `ai-color-palette` count to drop to 0.
- Re-run `/impeccable critique` on the Studio feature after the sweep → expect Consistency 0→3+ and total well above 22/40.
- Visual QA (both light + dark) needs a running app — flagged per commit as manual.
- FA glyphs: confirm the swapped Lucide icons render (the real `<i className="fa …">` were likely invisible).
```
