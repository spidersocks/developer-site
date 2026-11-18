# System inspector — thorough visual + popup audit

Date: 2026-11-18 (pass 2)  
Build: `BrightNestBotDemo-CENGm5S8` · `?v=CENGm5S8`  
Method: Reset → Existing parent → probe; FIT + zoom + drag canvas; open every lit node modal; CDP edge geometry.

---

## A. Canvas / geometry

| ID | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| G1 | P0 | **Live + Dense both terminate on Pack left** — two arrowheads stacked on the same port (`end 200,740` / `tip 211,740`). Looks like lines colliding into Pack. | CDP on open-now enrich: dense→fuse and live→fuse share left port | Route **live → Pack top** via corridor (not across chroma); Dense left / Sparse right |
| G1b | P0 | First live→top attempt went `… → (285,840) → pack` and **cut through Ranked/chroma** | Path shared chroma Y | Elbow at `FSM_LLM_X` up to pack-top Y, then right into tip |
| G2 | P1 | Arrow stroke ends at base (`tipDist` ≈ 11, `linecap: butt`) — math OK — but lit stroke width 2.35 still **anti-aliases past the base** as a faint nub | tipDist min 8.5 / max 11 across 34 edges | Pull stroke an extra ~half stroke-width into the triangle; keep butt |
| G3 | P1 | Edge labels still feel tip-adjacent on short diagonals (e.g. router→FSM “FSM”) | Labels at 34% path / skip &lt; 96px | Place at ~28%, nudge 20; skip paths &lt; 110px |
| G4 | P2 | Duplicate edge labels “5 hits” on both Dense→Pack and Sparse→Pack | Both channels label pool size | Prefer distinct labels (dense pool / BM25 pool) or omit when identical noise |
| G5 | OK | Live node on-screen after enrich; Fit frames lit path | `live.visible`, all nodes on-screen after FIT | Keep fitLitPath |

---

## B. Popup clarity (open-now enrich turn)

| Node | Issue | Fix |
| --- | --- | --- |
| **Pack · 3+2** | How-blurb + stats + **Packed keep order** + **identical Kept for pass 1** list + Request + **5k+ hybrid JSON Payload** (dense_top dump) | One keep list; drop pass-1 duplicate; StageIO closed + slim payload (counts only) |
| **Live data** | Clear facts, but **consulted** lists Chroma + BM25 (belongs on Dense/Sparse/Pack). Payload **5474 chars**: full `declared`+`consulted`+`facts`+duplicated `opening_hours.facts` | Live sources only (calendar + HKO); slim/closed StageIO; no opening_hours echo |
| **Router** | Good cascade + match summary, then **Pulled from** repeats same 4 sources as Live; Request/Payload re-dumps scores already on Rules | Drop “Pulled from” (pointer: Live / Pack); StageIO closed or remove |
| **Language** | Detected + KB language filter are the **same value** twice; StageIO repeats again | One language row; StageIO closed |
| **RAG / FSM / etc.** | StageIO open by default with JSON that mirrors the fact list | `defaultOpen={false}` globally for StageIO |
| **Rules** | Scores + ledger (collapsed) + match evidence — dense but mostly appropriate | Leave; ledger stays collapsed |
| **Dense / Sparse / Ranked** | Channel panels OK; avoid restating Pack keep list | No change unless dumps appear |

Cross-section duplicate map (open-now):

```
data_sources consulted  →  Router "Pulled from"  AND  Live "Data sources"  AND  Live Payload
facts / opening_hours   →  Live facts list  AND  Live Payload (×2 via opening_hours)
pack keep rows          →  Pack "Packed keep order"  AND  Pack "Kept for pass 1"  AND  Pack Payload hybrid
scores                  →  Rules  AND  Router StageIO request
```

---

## C. Route lighting checklist (isolated Reset)

| Probe | Expected | Notes |
| --- | --- | --- |
| Is the centre open now? | FSM + Live + enrich RAG arm + Pack + Grade + LLM + Answer | Live visible; Pack inbound: L/R + live top after fix |
| Typhoon / signal 8 | FSM + Live (+ enrich if applicable) | HKO status in Live |
| Seats Saturday phonics | FSM + Live (booking_tool / seats) | |
| Book a class for Jason | booking_dialogue · DST | Reset first |
| Allergic reaction ASAP | staff_escalation · gate · staffmail · sheets | |
| How much is phonics? | pure RAG arm | Live skipped |
| How do fish breathe? | RAG + refuse | FSM skipped |

---

## D. Implementation status

- [x] Audit written (this doc)
- [x] G1 live→Pack top (Dense left / Sparse right / Live top)
- [x] G2 arrow stroke inset past base (~1.4px)
- [x] G3 label ~28% / nudge 20 / skip &lt; 110px
- [x] Edge labels `dense N` / `BM25 N` (not twin “5 hits”)
- [x] Pack: one keep list; no StageIO dump
- [x] Live: calendar+HKO only; no 5k JSON dump
- [x] Router: pointer instead of “Pulled from” dump; no StageIO
- [x] Lang / FSM / RAG / sheets: drop redundant dumps; StageIO default closed
- [x] Rebuild (`BrightNestBotDemo-D-BF8kqN`) + local preview retest (drag/zoom + popups + all routes)

### E. Retest matrix (local preview → SAE API)

| Probe | Meta | Lighting OK | Popups / geometry |
| --- | --- | --- | --- |
| open now | `deterministic_opening_hours` · live | FSM+Live+enrich pack | Live=calendar+HKO; Pack=one keep list; ports L/R/top |
| phonics fees | `rag` | RAG arm; Live/FSM skipped | labels dense/BM25 |
| book Jason | `booking_dialogue` | FSM+DST | |
| allergic ASAP | `staff_escalation` | FSM+staffmail+sheets | |
| fish breathe | `rag` refuse | RAG arm; FSM skipped | |
| seats Saturday | `booking_tool` · live | FSM+Live+enrich | live→pack corridor path clean |

CDP pack ends after fix: dense `(198.6,740)`, sparse `(371.4,740)`, live `(-140…→272.6,717)` tip on Pack top.
