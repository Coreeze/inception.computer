# Free-Will Neuroscience-Inspired Architecture for Being Actions

## Thesis
> Over 10 years, small actions die out and just one daily decision matters.

Inception.computer is a high-level simulator of the most important actions in a day. This document proposes an architecture that aligns with neuroscience of free will and the thesis above.

---

## Current State

- **1 heartbeat = 1 day**
- **Player**: `player_action_queue` + signals → `generateChoices` (2 options when thresholds shift)
- **NPCs**: `ai_action_queue` (7 actions/week from planner), refilled every 7 heartbeats. Each heartbeat pops 1 action.
- **Actions**: move, discover_place, discover_person, buy, event
- **life_md**: Unbounded append of `Day X: action at place` — no compression

---

## Neuroscience Anchors

| Concept | Implication for Sim |
|---------|----------------------|
| **Dual-process** (Kahneman) | System 1 = habitual, automatic. System 2 = deliberate, effortful. Most days run on habits. |
| **Predictive processing** | Brain predicts, corrects errors. "Free will" = top-down predictions overriding bottom-up noise. |
| **Habit hierarchy** | Low-level decisions chunk into routines. "Go to gym" becomes one unit, not 20 micro-actions. |
| **Autobiographical memory** | We remember peaks, turning points, and violations of expectation — not every commute. |
| **Libet / readiness potential** | (Contested) Conscious "decision" may follow pre-conscious preparation. For sim: some actions are pre-committed. |

---

## Design Principles

1. **Action significance decays with routine** — repeated patterns become implicit, not simulated.
2. **One daily decision slot** — one action per day has narrative/mechanical weight; the rest are inferred.
3. **Years compress representation** — after N years, `life_md` and context favor turning points over granular logs.
4. **Habit vs. deliberate** — NPCs (and eventually player) have a habit layer that executes without AI; AI only for "deliberate" moments.

---

## Proposed Architecture

### 1. Hierarchical Action Model

```
┌─────────────────────────────────────────────────────────────────┐
│  MACRO (years)     │ One daily commitment / identity             │
│                    │ "I show up" vs "I withdraw"                │
├─────────────────────────────────────────────────────────────────┤
│  MESO (weeks)      │ Routines: work pattern, weekend pattern     │
│                    │ Stored as templates, not per-action         │
├─────────────────────────────────────────────────────────────────┤
│  MICRO (days)      │ One deliberate action per day (or none)     │
│                    │ Rest inferred from routine                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Action Significance & Routine Detection

**Per action type:**
- `move` (routine): Low significance. After N occurrences of same pattern (e.g. home→work→home), treat as habit.
- `discover_place`, `discover_person`, `buy`, `event`: High significance. Always deliberate.

**Per being:**
- `routine_template`: e.g. `{ weekday: [home, work, home], weekend: [home, cafe, home] }`
- `years_simulated`: `current_year - birth_year`
- `habit_threshold`: e.g. 3 years — after this, routine moves are auto-resolved

**Logic:**
- If `action_type === "move"` AND matches `routine_template` AND `years_simulated >= habit_threshold` → execute without AI, don't append to `life_md` (or append compressed: "routine day").
- Otherwise → full AI treatment, append to `life_md`.

### 3. One Daily Decision Slot

**Current:** 7 actions/week, 1 popped per heartbeat. All treated equally.

**Proposed:**
- Each day has **one decision slot**.
- Slot can be:
  - **Routine**: Inferred from `routine_template` (no AI call).
  - **Deliberate**: AI-generated (planner or choice).
- Planner output changes: instead of 7 generic actions, produce:
  - 1–2 **deliberate** actions per week (discover, buy, event, or meaningful move)
  - 5–6 **routine** placeholders (e.g. `{ routine: "weekday" }`)

**Implementation sketch:**
```ts
interface IPlannedAction {
  // ... existing fields
  is_routine?: boolean;  // if true, infer from routine_template
  routine_key?: "weekday" | "weekend" | "idle";
}
```

### 4. Temporal Compression of life_md

**Problem:** `life_md` grows unbounded. After 10 years = 3650 lines. Context windows truncate to last 300–500 chars.

**Proposed:**
- **Rolling summary**: Every 365 days (1 sim year), summarize the year into 3–5 sentences. Replace granular entries with summary.
- **Peak retention**: Always keep entries for: discover_place, discover_person, buy, event, and days when signals fired (choice moments).
- **Structure:**
  ```
  [Year 1 summary]
  [Year 2 summary]
  ...
  [Year 9 summary]
  [Recent 30 days — granular]
  ```

### 5. Dual-Process for NPCs

| Trigger | Mode | Behavior |
|---------|------|----------|
| Routine day, no novelty | System 1 | Use `routine_template` → update location, no AI |
| New place, new person, purchase, event | System 2 | Full planner/execution |
| Signal (crisis, burnout, mission shift) | System 2 | Regenerate plan, possibly override routine |
| `years_simulated < 2` | System 2 | All days deliberate (learning phase) |

### 6. Player Alignment

Player already has signal-driven choices. To align:
- **Routine days**: If no signal, player action can be "idle" or "routine" — no choice prompt. Day advances with inferred routine.
- **Signal days**: Current behavior — generate 2 options.
- Over time: fewer choice prompts per year (as signals become rarer or as we add "QUIET_LIFE" throttling).

---

## Implementation Phases

### Phase 1: Foundation
- Add `years_simulated` (derived) and `routine_template` to Being.
- Add `is_routine` / `routine_key` to `IPlannedAction`.
- Planner: emit 1–2 deliberate + 5–6 routine actions per week.

### Phase 2: Routine Execution
- In `processHeartbeat`, if action has `is_routine`, resolve from `routine_template` instead of using action fields.
- Don't append routine moves to `life_md` (or append compressed).

### Phase 3: life_md Compression
- Annual summarization job or on-heartbeat when `day === 1 && month === 1`.
- Retain peaks + last 30 days granular.

### Phase 4: Habit Threshold
- After `years_simulated >= habit_threshold`, auto-fill routine days without planner call when queue is low.
- Planner only generates deliberate actions.

---

## Constants to Introduce

```ts
HABIT_THRESHOLD_YEARS = 3;      // After this, routine is implicit
ROUTINE_LEARNING_YEARS = 2;     // Before this, all days deliberate
LIFE_MD_PEAK_RETENTION_DAYS = 30;
LIFE_MD_SUMMARY_INTERVAL_DAYS = 365;
```

---

## Open Questions

1. **Routine template learning**: Should routine be learned from history (cluster common place sequences) or defined at spawn?
2. **Player routine**: Does player get a routine_template, or is every non-signal day "idle"?
3. **One daily decision for player**: Should we explicitly surface "today's one decision" vs many small actions in the UI?
