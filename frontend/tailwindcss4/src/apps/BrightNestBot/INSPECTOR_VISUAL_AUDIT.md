# System inspector visual audit

Date: 2026-11-18  
Method: live browser probes + screenshot + getBoundingClientRect visibility checks.

## Issues found

### P0 — Live data “line to nowhere”
- **Symptom:** Lit edge toward Live; Live node not in the viewport.
- **Cause:** Live sat far left (`x: -470`) then later below the Fit focus; Fit framed only the top spine.
- **Fix:** Live on FSM column under Staff email; auto-`fitLitPath` after each turn; Fit button frames lit nodes when a trace exists; tighter vertical spacing.

### P0 — Arrowhead nub
- **Symptom:** Stroke sticks out past the triangle tip.
- **Cause:** `stroke-linecap: round` + stroke ended at the tip.
- **Fix:** Stroke ends at arrow **base**; tip on port; `stroke-linecap: butt`.

### P1 — Labels glued to tips
- **Symptom:** “FSM” / pack labels sit on the arrowhead.
- **Cause:** Label at midpoint of point list (often last elbow).
- **Fix:** Place at ~34% path length with perpendicular nudge; omit labels on short edges (&lt;96px).

### P1 — Dense/Sparse → Pack 3+2
- **Symptom:** Both edges ran along Pack’s top edge and pointed at each other.
- **Cause:** Both targeted `fuse` top center then horizontal.
- **Fix:** Dense → Pack **left** port; Sparse → Pack **right** port.

### P1 — Enrich looked like RAG skipped
- **Symptom:** Pack lit while RAG/Dense/Sparse showed skipped.
- **Fix:** Enrich lights full retrieve arm (earlier commit).

## Route retest matrix

| # | Probe | Expect route | Expect lit | Visual |
| --- | --- | --- | --- | --- |
| 1 | Is the centre open now? | opening_hours | FSM, Live, RAG+Dense+Sparse+Pack, LLM | Live on-screen |
| 2 | Typhoon signal 8? | severe_weather | FSM, Live, enrich retrieve | Live on-screen |
| 3 | Seats left Saturday phonics? | booking_tool | FSM, Live | Live on-screen |
| 4 | Book a class for Jason | booking_dialogue | FSM, DST | No Live required |
| 5 | Call me ASAP allergic reaction | staff_escalation | FSM, gate, staffmail, sheets | — |
| 6 | How much is phonics? | rag | RAG dual-channel → Pack sides | No FSM tools |
| 7 | How do fish breathe? | rag refuse | RAG arm | No Live |

## Retest log

_(filled during browser pass)_
