# System inspector visual audit

Date: 2026-11-18  
Method: isolated Reset → Demo Parent → probe; CDP visibility + route meta; screenshots.

## Issues found → fixed

| ID | Issue | Root cause | Fix |
| --- | --- | --- | --- |
| P0 | Live “line to nowhere” | Live outside Fit / below viewport | Live on FSM column; `fitLitPath` after turn; Fit frames lit nodes; tighter layout |
| P0 | Arrowhead nub | Round linecap + stroke to tip | Stroke ends at arrow **base**; tip on port; `stroke-linecap: butt` |
| P1 | Labels on tips | Midpoint of point list | ~34% path length + nudge; omit if path &lt; 96px |
| P1 | Dense/Sparse → Pack collide | Both aimed at Pack top-center | Dense → Pack **left**; Sparse → Pack **right** |
| P1 | Enrich looked like RAG skipped | Status only `path===rag` | Enrich lights full retrieve arm |
| P2 | Live panel “HKO not run” | Used `weather_applied` only | Use `weather_checked` / checks row |

## Isolated route retest (pass)

| Probe | Meta route | Lighting | Live visible |
| --- | --- | --- | --- |
| Is the centre open now? | `deterministic_opening_hours` · live | FSM + Live + RAG/Dense/Sparse/Pack + LLM | yes |
| Typhoon signal 8 | `severe_weather` · live | FSM + Live + enrich retrieve | yes |
| Seats Saturday phonics | `booking_tool` · live | FSM + Live | yes |
| Book a class for Jason | `booking_dialogue` | FSM + DST | n/a (skipped) |
| Allergic reaction ASAP | `staff_escalation` | FSM + staffmail + sheets | n/a |
| How much is phonics? | `rag` | RAG + Dense + Sparse + Pack | n/a |
| How do fish breathe? | `rag` + refuse | RAG arm; FSM skipped | n/a |

## Geometry checks (CDP)

- `stroke-linecap === "butt"`
- Lit edges: stroke end ≈ 11px before triangle tip (base), tip on node port
- Dense→Pack path ends at Pack left; Sparse→Pack at Pack right (no shared top rail)
- After enrich turns: `live.visible === true`, `fuse.visible === true`

## Note on sticky FSM

Probes in one WhatsApp session without Reset stay in `booking_dialogue` after a book starts. Route matrix above uses **Reset between probes**.
