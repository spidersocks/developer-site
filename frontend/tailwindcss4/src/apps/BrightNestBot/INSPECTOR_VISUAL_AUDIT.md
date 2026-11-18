# System inspector visual audit

Date: 2026-11-18  
Scope: every major route lit on the diagram + geometry of edges/arrowheads/labels.

## Issues found (pre-fix)

1. **Live data invisible / line-to-nowhere**  
   Live was parked at `x: -470`, outside the default Fit focus (`minX: -320`). Fit + initial view cropped the node; the FSM→Live edge looked like it ended in empty space.

2. **Arrowhead “nub”**  
   Stroke used `stroke-linecap: round` and ended at the same point as the triangle tip, so the round cap stuck out past the tip.

3. **Labels glued to arrowheads**  
   Labels used the midpoint of the *point list* (often the last elbow near the tip), not a fraction of path length.

4. **Dense/Sparse → Pack 3+2 nonsense**  
   Both edges dropped to `fuse.top` then ran horizontally along the pack’s top edge toward center, overlapping the node chrome and appearing to point at each other.

5. **FSM→Live through boxes (earlier)**  
   Vertical edge through dst/gate/staffmail (addressed by gutter elbows; Live restored onto the column under staffmail).

## Route matrix (expected lighting)

| Probe | Expect route | Must light | Must NOT look skipped incorrectly |
| --- | --- | --- | --- |
| Open now / hours | `opening_hours` / deterministic | FSM, Live, RAG+Dense+Sparse+Pack (enrich), LLM | RAG/Pack while enrich runs |
| Typhoon T8 | `severe_weather` | FSM, Live, enrich retrieve | Live visible |
| Seats left | `booking_tool` | FSM, Live | — |
| Book a class | `booking_dialogue` | FSM, DST (± gate) | — |
| Speak to person | `staff_escalation` | FSM, gate, staffmail, sheets | — |
| Phonics fees | `rag` | RAG, Dense, Sparse, Pack, … | FSM tools |
| Fish breathe | `rag` + refuse | RAG arm | Live |

## Fixes applied

- Live back on FSM column (`y: 930`); FSM→Live via left gutter.
- Arrow: stroke ends at triangle **base**; tip on port; `stroke-linecap: butt`.
- Labels at ~38% path length with perpendicular nudge.
- Dense → Pack **left**, Sparse → Pack **right** (no shared top rail).

## Retest checklist

- [ ] Hours / open now — Live visible, enrich pack lit, crisp arrows
- [ ] Typhoon — Live + enrich
- [ ] Seats — Live
- [ ] Booking — DST path
- [ ] Escalation — staffmail/sheets
- [ ] RAG fees — dual-channel into Pack from sides
- [ ] Off-topic — RAG refuse, no Live
