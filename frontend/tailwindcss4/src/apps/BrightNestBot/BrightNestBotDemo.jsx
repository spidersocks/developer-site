import React, { useEffect, useMemo, useRef, useState } from "react";
import WaMarkdown from "./WaMarkdown.jsx";
import "./brightnest.css";

// Prefer same-origin `/brightnest-api` (Vercel rewrite → SAE) so HTTPS pages
// are not blocked by mixed content when talking to the HTTP EIP.
const API_BASE = (
  import.meta.env.VITE_BRIGHTNEST_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "/brightnest-api"
).replace(/\/$/, "");

const LOGO_SRC = "/projects/brightnest/logo.png";

/** Ordered ~90s live-talk path, then deeper probes */
const DEMO_PROBES = [
  { label: "1 · Hours", text: "What are your opening hours?" },
  { label: "2 · Phonics fee", text: "How much is phonics?" },
  { label: "3 · Trial first?", text: "If my kid has not attended before, does he need to book a trial assessment first?" },
  { label: "4 · Trial slots", text: "Show trial class availability" },
  { label: "5 · Book Jason", text: "Can I book a class for Jason next week?" },
  { label: "6 · Talk to staff", text: "Can I speak to a real person please? This is urgent about my child's safety." },
  { label: "Teachers", text: "Tell me about your teachers" },
  { label: "Sibling %", text: "Do you have a sibling discount?" },
  { label: "Makeup", text: "What is your make-up class policy?" },
  { label: "Peanut allergy", text: "Peanut allergy policy?" },
  { label: "FPS pay", text: "How do I pay? What is your FPS ID?" },
  { label: "Location", text: "Where are you located?" },
  { label: "Tomorrow", text: "tomorrow?" },
  { label: "Christmas", text: "Are you open on Christmas Day?" },
  { label: "Phonics seats", text: "Show phonics availability" },
  { label: "Cancel class", text: "Can I cancel Jason's class next Tuesday?" },
  { label: "Unknown ask", text: "Does BrightNest offer scuba diving for toddlers?" },
  { label: "Private 1:1", text: "How much is private English tuition?" },
  { label: "Angry parent", text: "This is unacceptable — I'm furious about today's class!" },
];

const FACT_ROUTE_META = {
  fees: { label: "Centre facts · Fees", tone: "facts" },
  trial_info: { label: "Centre facts · Trial policy", tone: "facts" },
  teachers: { label: "Centre facts · Teachers", tone: "facts" },
  pickup: { label: "Centre facts · Pickup", tone: "facts" },
  makeup: { label: "Centre facts · Make-up", tone: "facts" },
  sibling: { label: "Centre facts · Sibling discount", tone: "facts" },
  waiting: { label: "Centre facts · Waiting list", tone: "facts" },
  location: { label: "Centre facts · Location", tone: "facts" },
  allergy: { label: "Centre facts · Allergy", tone: "facts" },
  illness: { label: "Centre facts · Illness", tone: "facts" },
  payment: { label: "Centre facts · Payment", tone: "facts" },
  pets_policy: { label: "Centre facts · Pets policy", tone: "facts" },
  severe_weather: { label: "Centre facts · Severe weather", tone: "facts" },
  unsupported_facility: { label: "Centre facts · Not offered", tone: "facts" },
  greeting: { label: "Greeting", tone: "idle" },
  thanks: { label: "Thanks", tone: "idle" },
  confused: { label: "Clarify", tone: "idle" },
  off_domain: { label: "Out of scope", tone: "idle" },
};

function getOrCreateSessionId() {
  let id = localStorage.getItem("bn_bot_session_id");
  if (!id) {
    id = "web:" + Math.random().toString(36).slice(2, 10) + Date.now();
    localStorage.setItem("bn_bot_session_id", id);
  }
  return id;
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortSessionLabel() {
  const id = localStorage.getItem("bn_bot_session_id");
  if (!id) return "web:new";
  return id.length > 20 ? `${id.slice(0, 18)}…` : id;
}

function scoreLabel(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  return Number(score).toFixed(3);
}

function routeMeta(route) {
  if (!route) return { label: "Waiting for a query", tone: "idle" };
  if (route === "deterministic_opening_hours" || route === "opening_hours") {
    return { label: "Opening-hours engine", tone: "hours" };
  }
  if (route === "booking_dialogue") return { label: "Booking dialogue", tone: "book" };
  if (route === "cancel_dialogue") return { label: "Cancel dialogue", tone: "book" };
  if (route === "booking_tool") return { label: "Booking tool", tone: "book" };
  if (route === "rag") return { label: "RAG retrieve → generate", tone: "rag" };
  if (route === "staff_escalation") {
    return { label: "Staff escalation → boss inbox", tone: "book" };
  }
  if (route === "unknown_programme") {
    return { label: "Unknown programme (quiet admin flag)", tone: "rag" };
  }
  if (FACT_ROUTE_META[route]) return FACT_ROUTE_META[route];
  return { label: route, tone: "idle" };
}

function isFactRoute(route) {
  return Boolean(FACT_ROUTE_META[route]?.tone === "facts");
}

function fingerprintQuestion(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeByQuestion(items, key = "question") {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const fp = fingerprintQuestion(item?.[key] || item?.parent_message);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    out.push(item);
  }
  return out;
}

function slotMatchKey(slot) {
  if (!slot) return "";
  const start = String(slot.slot_start || slot.slot_display || "");
  const teacher = String(slot.teacher_name || slot.teacher_id || "").toLowerCase();
  return `${start}|${teacher}`;
}

function sessionMatchesSlot(session, slot) {
  if (!session || !slot) return false;
  const slotStart = String(slot.slot_start || "");
  const sessStart = String(session.slot_start || "");
  if (slotStart && sessStart && (slotStart === sessStart || sessStart.includes(slotStart.slice(0, 16)))) {
    return true;
  }
  const tSlot = String(slot.teacher_name || "").toLowerCase();
  const tSess = String(session.teacher_name || "").toLowerCase();
  const timeHint = String(slot.slot_display || "").split(", ").pop();
  const sessTime = String(session.slot_display || "").split(", ").pop();
  if (tSlot && tSess && tSlot === tSess && timeHint && sessTime && timeHint === sessTime) {
    return true;
  }
  return false;
}

function Reveal({
  title,
  summary,
  defaultOpen = false,
  active = false,
  dimmed = false,
  children,
}) {
  return (
    <details
      className={`bn-reveal${active ? " bn-reveal-active" : ""}${dimmed ? " bn-reveal-dim" : ""}`}
      defaultOpen={defaultOpen}
    >
      <summary>
        <span className="bn-reveal-title">
          {active ? <span className="bn-active-dot" aria-hidden /> : null}
          {title}
        </span>
        {summary ? <span className="bn-reveal-summary">{summary}</span> : null}
      </summary>
      <div className="bn-reveal-body">{children}</div>
    </details>
  );
}

export default function BrightNestBotDemo() {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseKey, setCourseKey] = useState("trial");
  const [parentName, setParentName] = useState("Demo Parent");
  const [childName, setChildName] = useState("Jason Chan");
  const [phone, setPhone] = useState("+852 9000 0000");
  const [lastBooking, setLastBooking] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [lastSlots, setLastSlots] = useState([]);
  const [sessionLabel, setSessionLabel] = useState(() => shortSessionLabel());
  const [trace, setTrace] = useState(null);
  const [lastCitations, setLastCitations] = useState([]);
  const [apiOnline, setApiOnline] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [scheduleTeacherId, setScheduleTeacherId] = useState("all");
  const [adminTodos, setAdminTodos] = useState([]);
  const [staffMessages, setStaffMessages] = useState([]);
  const [adminScope, setAdminScope] = useState("session"); // session | all

  const chatWindowRef = useRef(null);
  const textAreaRef = useRef(null);
  const registerRef = useRef(null);

  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/healthz`)
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));
    fetch(`${API_BASE}/courses`)
      .then((r) => r.json())
      .then((d) => setCourses(d.courses || []))
      .catch(() => {});
    fetch(`${API_BASE}/schedule?days=7`)
      .then((r) => r.json())
      .then((d) => setSchedule(d))
      .catch(() => setSchedule(null));
    refreshAdminTodos();
    refreshStaffMessages();
  }, []);

  function refreshAdminTodos() {
    fetch(`${API_BASE}/admin/todos?status=open`)
      .then((r) => r.json())
      .then((d) => setAdminTodos(d.todos || []))
      .catch(() => setAdminTodos([]));
  }

  function refreshStaffMessages() {
    fetch(`${API_BASE}/admin/messages?status=open`)
      .then((r) => r.json())
      .then((d) => setStaffMessages(d.messages || []))
      .catch(() => setStaffMessages([]));
  }

  async function markTodoDone(id) {
    try {
      await fetch(`${API_BASE}/admin/todos/${encodeURIComponent(id)}/done`, {
        method: "POST",
      });
      refreshAdminTodos();
    } catch {
      /* ignore */
    }
  }

  async function ackStaffMessage(id) {
    try {
      await fetch(`${API_BASE}/admin/messages/${encodeURIComponent(id)}/ack`, {
        method: "POST",
      });
      refreshStaffMessages();
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 88)}px`;
  }, [inputMessage]);

  function handleReset() {
    const sid = localStorage.getItem("bn_bot_session_id");
    const finish = () => {
      setChatHistory([]);
      setError(null);
      setLastBooking(null);
      setPendingSlot(null);
      setLastSlots([]);
      setLastCitations([]);
      setTrace(null);
      setAdminTodos([]);
      setStaffMessages([]);
      localStorage.removeItem("bn_bot_session_id");
      setSessionLabel(shortSessionLabel());
      refreshAdminTodos();
      refreshStaffMessages();
    };
    if (sid) {
      fetch(`${API_BASE}/chat/history/${encodeURIComponent(sid)}`, {
        method: "DELETE",
      })
        .catch(() => {})
        .finally(finish);
    } else {
      fetch(`${API_BASE}/chat/history/${encodeURIComponent("demo-reset")}`, {
        method: "DELETE",
      })
        .catch(() => {})
        .finally(finish);
    }
  }

  async function sendMessage(raw) {
    const trimmed = (raw ?? inputMessage).trim();
    if (!trimmed || isLoading) return;

    const now = formatTime();
    setChatHistory((prev) => [...prev, { role: "user", message: trimmed, time: now }]);
    setIsLoading(true);
    setError(null);
    setInputMessage("");
    setSessionLabel(shortSessionLabel());

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          session_id: getOrCreateSessionId(),
          debug: true,
          phone,
          parent_name: parentName,
          child_name: childName,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessionLabel(shortSessionLabel());
      const nextTrace = data.trace ? { ...data.trace } : {};
      // Inspector reads provider / booking / cancel from trace — backfill from top-level
      if (!nextTrace.provider && data.provider) nextTrace.provider = data.provider;
      if (!nextTrace.answer_provider && data.provider) {
        nextTrace.answer_provider = data.provider;
      }
      if (!nextTrace.booking && data.debug?.dialogue) nextTrace.booking = data.debug.dialogue;
      if (!nextTrace.cancel && data.debug?.cancel) nextTrace.cancel = data.debug.cancel;
      setTrace(Object.keys(nextTrace).length ? nextTrace : null);
      setLastCitations(data.citations || []);
      if (data.slots?.length) setLastSlots(data.slots);
      else if (data.trace?.route !== "booking_tool" && data.trace?.route !== "booking_dialogue") {
        setLastSlots([]);
      }
      if (data.trace?.admin_todo) refreshAdminTodos();
      if (data.trace?.staff_message) refreshStaffMessages();
      // Always refresh admin lists lightly so inbox stays honest during demo
      refreshAdminTodos();
      refreshStaffMessages();
      const resolvedChild =
        data.trace?.booking?.child_name || data.trace?.cancel?.child_name;
      if (resolvedChild) setChildName(resolvedChild);
      const resolvedParent = data.trace?.booking?.parent_name;
      if (resolvedParent) setParentName(resolvedParent);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "bot",
          message: data.answer || "(no answer)",
          time: formatTime(),
          citations: data.citations || [],
          slots: data.slots || null,
          provider: data.provider,
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Backend unreachable — check SAE / CORS / mixed content.");
      setApiOnline(false);
      setChatHistory((prev) =>
        prev.length && prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function bookSlot(slot) {
    setPendingSlot(slot);
    setCourseKey(slot.course_key || courseKey);
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_key: slot.course_key || courseKey,
          slot_start: slot.slot_start,
          parent_name: parentName || "Demo Parent",
          child_name: childName || "Demo Child",
          phone: phone || "+852 9000 0000",
          notes: "Booked from COMP6708 technical demo UI",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Booking failed");
      setLastBooking(data);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "bot",
          message:
            `Booking confirmed!\n` +
            `• Ref: ${data.id}\n` +
            `• ${data.course_label}\n` +
            `• ${data.slot_display}\n` +
            `• ${data.teacher_name || "Teacher TBC"}` +
            (data.room ? ` · ${data.room}` : ""),
          time: formatTime(),
          booking: data,
        },
      ]);
      fetch(`${API_BASE}/schedule?days=7`)
        .then((r) => r.json())
        .then((d) => setSchedule(d))
        .catch(() => {});
    } catch (err) {
      setError(err.message || "Booking failed");
    } finally {
      setPendingSlot(null);
    }
  }

  const isDisabled = isLoading || !inputMessage.trim();
  const showEmpty = chatHistory.length === 0 && !isLoading;
  const route = trace?.route;
  const meta = routeMeta(route);
  const steps = trace?.pipeline_steps || [];
  const hoursFacts = trace?.opening_hours?.facts;
  const rag = trace?.rag;
  // Only real RAG hits — never fall back to fact citations
  const hits = Array.isArray(rag?.hits) ? rag.hits : [];
  const routingDebug = trace?.routing?.debug || {};
  const arbiter = routingDebug.arbiter || null;
  const arbiterOverride = routingDebug.arbiter_override || null;
  const llmMeta = trace?.llm || {};
  const answerProvider =
    trace?.answer_provider || trace?.provider || llmMeta.answer_provider || null;
  const adaptStep = steps.find((s) => s.id === "adapt");
  const arbiterStep = steps.find((s) => s.id === "intent_arbiter");
  const gapStep = steps.find((s) => s.id === "gap_polish");
  const cancelPickStep = steps.find((s) => s.id === "cancel_pick");
  const bookingParseStep = steps.find((s) => s.id === "booking_parse");
  const cheapDone = (s) => s && (s.status === "done" || s.status === "error");
  const cheapCalled = Boolean(
    llmMeta.cheap_called ||
      arbiter?.called ||
      cheapDone(arbiterStep) ||
      cheapDone(gapStep) ||
      cheapDone(cancelPickStep) ||
      cheapDone(bookingParseStep)
  );
  const mainRewriteDone = adaptStep?.status === "done";
  const llmTouched = cheapCalled || mainRewriteDone || Boolean(arbiterOverride);

  const turnKey = `${trace?.latency_ms ?? "idle"}-${route ?? "none"}-${chatHistory.length}`;
  const factOpen = isFactRoute(route);
  const hoursOpen = route === "deterministic_opening_hours" || route === "opening_hours";
  const ragOpen = route === "rag";
  const bookingOpen =
    route === "booking_tool" || route === "booking_dialogue" || route === "cancel_dialogue";
  const adminTodoOpen = route === "unknown_programme" || Boolean(trace?.admin_todo);
  const adminMsgOpen = route === "staff_escalation" || Boolean(trace?.staff_message);
  const userTurns = chatHistory.filter((m) => m.role === "user").length;
  const memoryTurns = Math.max(trace?.history?.turns_loaded ?? 0, Math.max(0, userTurns - 1));
  const memoryDisplayTurns = Math.max(memoryTurns, userTurns > 0 ? userTurns : 0);
  const memoryOpen = memoryDisplayTurns >= 1;
  const llmOpen =
    llmTouched &&
    (Boolean(arbiterOverride) ||
      mainRewriteDone ||
      gapStep?.status === "done" ||
      cancelPickStep?.status === "done" ||
      bookingParseStep?.status === "done" ||
      (arbiter?.called && (arbiter?.action === "rag" || arbiter?.action === "reroute")));

  const activePanel = factOpen
    ? "facts"
    : hoursOpen
      ? "hours"
      : ragOpen
        ? "rag"
        : bookingOpen
          ? "booking"
          : adminMsgOpen
            ? "admin_messages"
            : adminTodoOpen
              ? "admin_todo"
              : llmOpen
                ? "llm"
                : memoryOpen && !route
                  ? "memory"
                  : null;

  const dialogue = trace?.booking;
  const cancelTrace = trace?.cancel;
  const teachers = schedule?.teachers || [];
  const scheduleDays = useMemo(() => {
    const days = schedule?.days || [];
    if (scheduleTeacherId === "all") return days;
    return days.map((day) => ({
      ...day,
      sessions: (day.sessions || []).filter((s) => s.teacher_id === scheduleTeacherId),
    }));
  }, [schedule, scheduleTeacherId]);

  const highlightedSessionKeys = useMemo(() => {
    const keys = new Set();
    for (const slot of lastSlots || []) {
      keys.add(slotMatchKey(slot));
      for (const day of schedule?.days || []) {
        for (const s of day.sessions || []) {
          if (sessionMatchesSlot(s, slot)) {
            keys.add(`${s.session_id}-${s.slot_start}`);
          }
        }
      }
    }
    return keys;
  }, [lastSlots, schedule]);

  useEffect(() => {
    if (!bookingOpen || !lastSlots?.length || !registerRef.current) return;
    const hit = registerRef.current.querySelector(".bn-reg-hit");
    if (hit) hit.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [bookingOpen, lastSlots, turnKey]);

  const scheduleSummary = schedule
    ? `${teachers.length} teachers · ${scheduleDays.reduce((n, d) => n + (d.sessions?.length || 0), 0)} sessions / 7d${
        lastSlots?.length ? ` · ${lastSlots.length} slot hit${lastSlots.length === 1 ? "" : "s"}` : ""
      }`
    : "Synthetic admin register";

  const hoursSummary = useMemo(() => {
    if (!hoursFacts) return "Idle until a date/hours query";
    if (hoursFacts.weather_hint) return "Severe weather closure";
    if (hoursFacts.is_holiday) return hoursFacts.holiday_name || "Public holiday";
    if (hoursFacts.is_sunday) return "Sunday · closed";
    if (hoursFacts.open_time) return `${hoursFacts.open_time}–${hoursFacts.close_time}`;
    return "Parsed";
  }, [hoursFacts]);

  const ragSummary = useMemo(() => {
    if (route && route !== "rag") return "Skipped — not on RAG path";
    if (!rag && !hits.length) return "Idle until a KB question";
    const n = rag?.hit_count ?? hits.length;
    return `${n} chunk${n === 1 ? "" : "s"} · ${rag?.embedding_mode || "embed"}`;
  }, [rag, hits.length, route]);

  const factStep = steps.find(
    (s) => s.id === "facts" || /fee|teacher|trial|weather|pickup|makeup|sibling|allerg|payment|location|pets/i.test(s.label || "")
  );
  const factsSummary = factOpen
    ? factStep?.label || FACT_ROUTE_META[route]?.label || "Structured centre fact"
    : "Idle until a fees / policy / teachers query";

  const sid = typeof window !== "undefined" ? localStorage.getItem("bn_bot_session_id") : null;
  const visibleTodos = useMemo(() => {
    const deduped = dedupeByQuestion(adminTodos, "question");
    if (adminScope === "all" || !sid) return deduped;
    return deduped.filter((t) => !t.session_id || t.session_id === sid);
  }, [adminTodos, adminScope, sid]);

  const visibleStaff = useMemo(() => {
    const deduped = dedupeByQuestion(staffMessages, "parent_message");
    if (adminScope === "all" || !sid) return deduped;
    return deduped.filter((m) => !m.session_id || m.session_id === sid);
  }, [staffMessages, adminScope, sid]);

  const historyPreview = trace?.history?.preview || "";
  const memoryLines = historyPreview
    ? historyPreview.split("\n").filter(Boolean)
    : [];

  return (
    <div className="bn-app">
      <header className="bn-top">
        <div className="bn-brand-block">
          <img src={LOGO_SRC} alt="" className="bn-mark" />
          <div>
            <p className="bn-eyebrow">COMP6708 A3 · technical demo</p>
            <h1>
              BrightNest <span>Learning Centre</span>
            </h1>
          </div>
        </div>
        <div className="bn-top-actions">
          <span className={`bn-dot ${apiOnline ? "ok" : apiOnline === false ? "bad" : ""}`}>
            {apiOnline ? "API online" : apiOnline === false ? "API offline" : "API…"}
          </span>
          <code className="bn-sid">{sessionLabel}</code>
          <button type="button" className="bn-ghost" onClick={handleReset} disabled={isLoading}>
            Reset
          </button>
        </div>
      </header>

      <div className="bn-stage">
        <aside className="bn-phone-wrap">
          <p className="bn-col-label">Parent chat</p>
          <div className="bn-phone">
            <div className="bn-phone-bar">
              <img src={LOGO_SRC} alt="BrightNest" />
              <div>
                <strong>Parent chat</strong>
                <small>messaging surface</small>
              </div>
            </div>

            <div className="bn-messages" ref={chatWindowRef}>
              {showEmpty && (
                <div className="bn-row bn-row-bot">
                  <div className="bn-bubble bn-bubble-bot">
                    <WaMarkdown>
                      Hi! Ask about courses, fees, hours, or trial booking. Try the numbered
                      demo probes for a 90-second path.
                    </WaMarkdown>
                    <span className="bn-time">{formatTime()}</span>
                  </div>
                </div>
              )}

              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`bn-row ${msg.role === "user" ? "bn-row-user" : "bn-row-bot"}`}
                >
                  <div
                    className={`bn-bubble ${
                      msg.role === "user" ? "bn-bubble-user" : "bn-bubble-bot"
                    }`}
                  >
                    {msg.role === "bot" ? (
                      <WaMarkdown>{msg.message}</WaMarkdown>
                    ) : (
                      <p className="bn-msg-text">{msg.message}</p>
                    )}

                    {msg.slots?.length > 0 && (
                      <div className="bn-slots">
                        {msg.slots.slice(0, 4).map((slot) => (
                          <div className="bn-slot" key={slot.slot_start}>
                            <div>
                              <strong>{slot.slot_display}</strong>
                              <span>
                                {slot.course_label}
                                {slot.teacher_name ? ` · ${slot.teacher_name}` : ""}
                                {slot.room ? ` · ${slot.room}` : ""}
                                {` · ${slot.seats_left} left`}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={!!pendingSlot}
                              onClick={() => bookSlot(slot)}
                            >
                              Book
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="bn-time">{msg.time || formatTime()}</span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="bn-row bn-row-bot">
                  <div className="bn-bubble bn-bubble-bot">
                    <div className="bn-typing">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                </div>
              )}
              {error && <div className="bn-error">{error}</div>}
            </div>

            <form
              className="bn-inputbar"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                ref={textAreaRef}
                className="bn-textarea"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message as a parent…"
                disabled={isLoading}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button className="bn-send" type="submit" disabled={isDisabled} aria-label="Send">
                Send
              </button>
            </form>
          </div>
        </aside>

        <section className="bn-inspector">
          <p className="bn-col-label">System inspector</p>

          <div className="bn-route-card">
            <div className="bn-route-main">
              <span className={`bn-pill bn-pill-${meta.tone}`}>{meta.label}</span>
              {answerProvider ? (
                <span
                  className="bn-pill bn-pill-provider"
                  title="Where the parent-facing answer came from"
                >
                  {answerProvider}
                </span>
              ) : null}
              {cheapCalled ? (
                <span className="bn-pill bn-pill-llm" title="Short-prompt DashScope referee ran">
                  cheap LLM
                </span>
              ) : null}
              {mainRewriteDone ? (
                <span
                  className="bn-pill bn-pill-main-llm"
                  title="Main model rewrote a fixed fact card"
                >
                  main rewrite
                </span>
              ) : null}
              {trace?.latency_ms != null && <span className="bn-latency">{trace.latency_ms} ms</span>}
              {isLoading && <span className="bn-running">running…</span>}
            </div>
            {steps.length > 0 && (
              <ol className="bn-step-rail" aria-label="Pipeline steps">
                {steps.map((s) => {
                  const isCheap =
                    s.id === "intent_arbiter" ||
                    s.id === "gap_polish" ||
                    s.id === "cancel_pick" ||
                    s.id === "booking_parse";
                  const isMainLlm = s.id === "adapt";
                  const isActive =
                    s.status === "done" &&
                    (isCheap ||
                      isMainLlm ||
                      s.id === "facts" ||
                      (factOpen && /fee|teacher|trial|weather|pickup|makeup|sibling|allerg|payment|location|pets/i.test(s.label || "")) ||
                      (hoursOpen && /hours|date|holiday|weather/i.test(s.id + s.label)) ||
                      (ragOpen && s.id === "rag") ||
                      (bookingOpen && /book|cancel/i.test(s.id + s.label)) ||
                      (adminTodoOpen && s.id === "admin_todo") ||
                      (adminMsgOpen && /escalat|staff/i.test(s.id + s.label)));
                  return (
                    <li
                      key={s.id}
                      className={`bn-step-chip bn-step-${s.status || "idle"}${isCheap ? " bn-step-llm" : ""}${isMainLlm ? " bn-step-main-llm" : ""}${isActive ? " bn-step-active" : ""}`}
                      title={s.detail}
                    >
                      <span>{s.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="bn-hint">
              Amber = short-prompt referee. Teal-outline = main model fact rewrite. Dimmed panels
              stayed idle.
            </p>
          </div>

          <Reveal
            key={`llm-${turnKey}`}
            title="LLM path (demo)"
            summary={
              llmTouched
                ? [
                    answerProvider ? `source ${answerProvider}` : null,
                    cheapCalled
                      ? `cheap ${llmMeta.cheap_model || arbiter?.model || "review"}`
                      : null,
                    mainRewriteDone
                      ? `rewrite ${llmMeta.main_model || "main"}`
                      : null,
                    arbiterOverride
                      ? `${arbiterOverride.from} → ${arbiterOverride.to}`
                      : arbiter?.called
                        ? `intent ${arbiter.action}`
                        : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "LLM touched this turn"
                : "Idle — referee / rewrite when DashScope is live"
            }
            defaultOpen={llmOpen}
            active={activePanel === "llm"}
            dimmed={Boolean(activePanel) && activePanel !== "llm" && !llmTouched}
          >
            {!llmTouched ? (
              <p className="bn-empty">
                Short-prompt calls review intent, cancel picks, and gap wording. Separately, the
                main model can rewrite a fixed fact card so the reply matches the parent question.
              </p>
            ) : (
              <>
                <p className="bn-note">
                  On this MaaS workspace both paths may use the same model name — the difference is
                  the job (short JSON referee vs longer fact rewrite). Fail-open if a cheap call
                  times out.
                </p>
                <ul className="bn-fact-list">
                  <li>
                    <span>Answer source</span>
                    <code>{answerProvider || "—"}</code>
                  </li>
                  <li>
                    <span>Main model</span>
                    <code>{llmMeta.main_model || "—"}</code>
                  </li>
                  <li>
                    <span>Cheap model</span>
                    <code>
                      {cheapCalled
                        ? llmMeta.cheap_model || arbiter?.model || "called"
                        : "not called"}
                    </code>
                  </li>
                  {arbiter?.called ? (
                    <li>
                      <span>Intent review</span>
                      <code>
                        {arbiter.action || "keep"}
                        {arbiter.reason ? ` · ${arbiter.reason}` : ""}
                      </code>
                    </li>
                  ) : arbiterStep?.status === "skipped" ? (
                    <li>
                      <span>Intent review</span>
                      <code>skipped · {arbiter?.reason || "not needed"}</code>
                    </li>
                  ) : null}
                  {arbiterOverride ? (
                    <li>
                      <span>Override</span>
                      <code>
                        {arbiterOverride.from} → {arbiterOverride.to}
                      </code>
                    </li>
                  ) : null}
                  {adaptStep ? (
                    <li>
                      <span>Fact rewrite</span>
                      <code>
                        {adaptStep.status}
                        {adaptStep.detail ? ` · ${adaptStep.detail}` : ""}
                      </code>
                    </li>
                  ) : null}
                  {gapStep ? (
                    <li>
                      <span>Gap polish</span>
                      <code>
                        {gapStep.status}
                        {gapStep.detail ? ` · ${gapStep.detail}` : ""}
                      </code>
                    </li>
                  ) : null}
                  {cancelPickStep ? (
                    <li>
                      <span>Cancel pick</span>
                      <code>
                        {cancelPickStep.status}
                        {cancelPickStep.detail ? ` · ${cancelPickStep.detail}` : ""}
                      </code>
                    </li>
                  ) : null}
                  {bookingParseStep ? (
                    <li>
                      <span>Booking parse</span>
                      <code>
                        {bookingParseStep.status}
                        {bookingParseStep.detail ? ` · ${bookingParseStep.detail}` : ""}
                      </code>
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </Reveal>

          <Reveal
            key={`facts-${turnKey}`}
            title="Centre facts"
            summary={factsSummary}
            defaultOpen={factOpen}
            active={activePanel === "facts"}
            dimmed={Boolean(activePanel) && activePanel !== "facts"}
          >
            {!factOpen ? (
              <p className="bn-empty">
                Structured fees / policy / teachers answers land here (not RAG chunks).
              </p>
            ) : (
              <>
                <ul className="bn-fact-list">
                  <li>
                    <span>Route</span>
                    <code>{route}</code>
                  </li>
                  <li>
                    <span>Answer source</span>
                    <code>{answerProvider || "centre_facts"}</code>
                  </li>
                  <li>
                    <span>Process</span>
                    <code>{factStep?.label || "structured fact"}</code>
                  </li>
                  <li>
                    <span>Detail</span>
                    <code>{factStep?.detail || "centre_facts"}</code>
                  </li>
                </ul>
                {lastCitations.length > 0 ? (
                  <ul className="bn-hits">
                    {lastCitations.slice(0, 4).map((c, i) => (
                      <li key={`${c.source}-${i}`}>
                        <div className="bn-hit-head">
                          <strong>{c.title || c.source || `Source ${i + 1}`}</strong>
                        </div>
                        <span className="bn-hit-src">{c.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="bn-note">No citation objects on this turn.</p>
                )}
              </>
            )}
          </Reveal>

          <Reveal
            key={`hours-${turnKey}`}
            title="Date · holiday · weather"
            summary={hoursSummary}
            defaultOpen={hoursOpen}
            active={activePanel === "hours"}
            dimmed={Boolean(activePanel) && activePanel !== "hours"}
          >
            {!hoursFacts ? (
              <p className="bn-empty">Ask an hours/date question to populate this panel.</p>
            ) : (
              <ul className="bn-fact-list">
                <li>
                  <span>Resolved</span>
                  <code>{hoursFacts.datetime}</code>
                </li>
                <li>
                  <span>Matched via</span>
                  <code>
                    {hoursFacts.parse_debug?.matched_via ||
                      (hoursFacts.parse_debug?.is_fallback_to_now ? "fallback_now" : "—")}
                  </code>
                </li>
                <li>
                  <span>Window</span>
                  <code>
                    {hoursFacts.open_time && hoursFacts.close_time
                      ? `${hoursFacts.open_time}–${hoursFacts.close_time}`
                      : hoursFacts.is_sunday
                        ? "closed (Sunday)"
                        : "—"}
                  </code>
                </li>
                <li>
                  <span>Holiday</span>
                  <code>{hoursFacts.is_holiday ? hoursFacts.holiday_name || "yes" : "no"}</code>
                </li>
                <li>
                  <span>HKO weather</span>
                  <code>{hoursFacts.weather_hint || "none / not today"}</code>
                </li>
                {trace?.opening_hours?.effective_message && (
                  <li>
                    <span>Effective msg</span>
                    <code>{trace.opening_hours.effective_message}</code>
                  </li>
                )}
              </ul>
            )}
          </Reveal>

          <Reveal
            key={`rag-${turnKey}`}
            title="RAG retrieval"
            summary={ragSummary}
            defaultOpen={ragOpen}
            active={activePanel === "rag"}
            dimmed={Boolean(activePanel) && activePanel !== "rag"}
          >
            {hits.length === 0 ? (
              <p className="bn-empty">
                {route === "rag"
                  ? "No chunks returned."
                  : "Only shown for true RAG turns (fact citations stay in Centre facts)."}
              </p>
            ) : (
              <>
                <div className="bn-rag-strip">
                  <span>index {rag?.index_size ?? "—"}</span>
                  <span>top_k {rag?.top_k ?? "—"}</span>
                  {rag?.language_fallback ? <span>lang fallback</span> : null}
                </div>
                <ul className="bn-hits">
                  {hits.slice(0, 5).map((h, i) => (
                    <li key={`${h.source}-${i}`}>
                      <div className="bn-hit-head">
                        <strong>{h.title || h.canonical || h.source || `Hit ${i + 1}`}</strong>
                        {scoreLabel(h.score) && <code>{scoreLabel(h.score)}</code>}
                      </div>
                      <span className="bn-hit-src">{h.source}</span>
                      {h.snippet ? <p>{h.snippet}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Reveal>

          <Reveal
            key={`register-${turnKey}`}
            title="Class register"
            summary={scheduleSummary}
            defaultOpen={bookingOpen}
            active={activePanel === "booking"}
            dimmed={Boolean(activePanel) && activePanel !== "booking"}
          >
            <p className="bn-note">
              Backed by local CSV admin sheets (teachers, windows, sessions, enrolments,
              trial_slots). Chat bookings append to <code>chat_bookings.csv</code>.
              {lastSlots?.length ? (
                <>
                  {" "}
                  Highlighted rows match the <strong>{lastSlots.length}</strong> open slot
                  {lastSlots.length === 1 ? "" : "s"} from chat.
                </>
              ) : null}
              {schedule?.sheets_dir ? (
                <>
                  {" "}
                  <code className="bn-path">{schedule.sheets_dir}</code>
                </>
              ) : null}
            </p>
            <div className="bn-register-filters">
              <label>
                Teacher
                <select
                  value={scheduleTeacherId}
                  onChange={(e) => setScheduleTeacherId(e.target.value)}
                >
                  <option value="all">All teachers</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!schedule ? (
              <p className="bn-empty">Schedule API offline — restart local backend to load.</p>
            ) : (
              <div className="bn-register" ref={registerRef}>
                {teachers.length > 0 && scheduleTeacherId === "all" && (
                  <ul className="bn-teacher-windows">
                    {teachers.map((t) => (
                      <li key={t.id}>
                        <strong>{t.name}</strong>
                        <span>
                          {t.role} · {t.courses.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {scheduleDays.map((day) =>
                  day.sessions?.length ? (
                    <div className="bn-reg-day" key={day.date}>
                      <h4>{day.label}</h4>
                      <ul>
                        {day.sessions.map((s) => {
                          const hit = highlightedSessionKeys.has(`${s.session_id}-${s.slot_start}`);
                          return (
                            <li
                              key={`${s.session_id}-${s.slot_start}`}
                              className={hit ? "bn-reg-hit" : undefined}
                            >
                              <div className="bn-reg-line">
                                <strong>
                                  {s.slot_display.split(", ").pop()} · {s.course_label}
                                  {hit ? " · match" : ""}
                                </strong>
                                <code className={s.status === "open" ? "ok" : ""}>
                                  {s.seats_left}/{s.capacity}
                                </code>
                              </div>
                              <span>
                                {s.teacher_name}
                                {s.room ? ` · ${s.room}` : ""}
                                {s.kind === "trial" ? " · trial" : ""}
                                {s.enrolled_count
                                  ? ` · ${s.enrolled_count} on register`
                                  : ""}
                                {s.chat_bookings ? ` · +${s.chat_bookings} chat` : ""}
                              </span>
                              {s.enrolled?.length > 0 && (
                                <em>
                                  {s.enrolled
                                    .slice(0, 4)
                                    .map((e) => e.child)
                                    .join(", ")}
                                  {s.enrolled.length > 4
                                    ? ` +${s.enrolled.length - 4}`
                                    : ""}
                                </em>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </Reveal>

          <Reveal
            key={`admin-${turnKey}`}
            title="Admin to-do"
            summary={
              visibleTodos.length
                ? `${visibleTodos.length} open · quiet KB / programme gaps`
                : "Empty — quiet flags when RAG can't answer"
            }
            defaultOpen={adminTodoOpen}
            active={activePanel === "admin_todo"}
            dimmed={Boolean(activePanel) && activePanel !== "admin_todo"}
          >
            <p className="bn-note">
              Internal research queue (<code>admin_todos.csv</code>). Parents are{" "}
              <strong>never</strong> told about this sheet.
            </p>
            <div className="bn-scope-toggle">
              <button
                type="button"
                className={adminScope === "session" ? "bn-scope-on" : ""}
                onClick={() => setAdminScope("session")}
              >
                This session
              </button>
              <button
                type="button"
                className={adminScope === "all" ? "bn-scope-on" : ""}
                onClick={() => setAdminScope("all")}
              >
                All open
              </button>
            </div>
            {visibleTodos.length === 0 ? (
              <p className="bn-empty">No open to-dos in this view.</p>
            ) : (
              <ul className="bn-todos">
                {visibleTodos.map((t) => (
                  <li key={t.id}>
                    <div className="bn-todo-head">
                      <strong>{t.parent_name || t.phone || "Unknown parent"}</strong>
                      <code>{t.id}</code>
                    </div>
                    <span className="bn-todo-q">Q: {t.question}</span>
                    {t.info_needed ? (
                      <span className="bn-todo-need">Need: {t.info_needed}</span>
                    ) : null}
                    <details className="bn-todo-expand">
                      <summary>Full reply</summary>
                      <pre className="bn-pre">{t.reply || "(empty)"}</pre>
                    </details>
                    <button type="button" className="bn-ghost" onClick={() => markTodoDone(t.id)}>
                      Mark done
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          <Reveal
            key={`boss-${turnKey}`}
            title="Admin messages"
            summary={
              visibleStaff.length
                ? `${visibleStaff.length} open · bot → centre boss`
                : "Empty — human hand-off notices land here"
            }
            defaultOpen={adminMsgOpen}
            active={activePanel === "admin_messages"}
            dimmed={Boolean(activePanel) && activePanel !== "admin_messages"}
          >
            <p className="bn-note">
              Direct notices to the centre lead (<code>staff_messages.csv</code>). Parent hears a
              calm hand-off — never the sheet name.
            </p>
            <div className="bn-scope-toggle">
              <button
                type="button"
                className={adminScope === "session" ? "bn-scope-on" : ""}
                onClick={() => setAdminScope("session")}
              >
                This session
              </button>
              <button
                type="button"
                className={adminScope === "all" ? "bn-scope-on" : ""}
                onClick={() => setAdminScope("all")}
              >
                All open
              </button>
            </div>
            {visibleStaff.length === 0 ? (
              <p className="bn-empty">No open staff messages in this view.</p>
            ) : (
              <ul className="bn-todos">
                {visibleStaff.map((m) => {
                  const prio = (m.priority || "normal").toLowerCase();
                  const hot = prio === "high" || prio === "urgent" || prio === "critical";
                  return (
                    <li key={m.id} className={hot ? "bn-todo-hot" : undefined}>
                      <div className="bn-todo-head">
                        <strong>
                          <span className={`bn-prio ${hot ? "bn-prio-high" : ""}`}>
                            {prio.toUpperCase()}
                          </span>{" "}
                          · {m.category || "general"}
                        </strong>
                        <code>{m.id}</code>
                      </div>
                      <span className="bn-todo-q">
                        From: {m.parent_name || m.phone || "Unknown"}
                        {m.child_name ? ` · ${m.child_name}` : ""}
                      </span>
                      <span className="bn-todo-need">Boss: {m.summary_for_boss}</span>
                      <details className="bn-todo-expand" defaultOpen={hot}>
                        <summary>Full parent message</summary>
                        <pre className="bn-pre">{m.parent_message || "(empty)"}</pre>
                      </details>
                      <button
                        type="button"
                        className="bn-ghost"
                        onClick={() => ackStaffMessage(m.id)}
                      >
                        Acknowledge
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Reveal>

          <Reveal
            key={`book-${turnKey}`}
            title="Booking tool"
            summary={
              cancelTrace?.stage
                ? `cancel · ${cancelTrace.stage}${
                    cancelTrace.child_name ? ` · ${cancelTrace.child_name}` : ""
                  }`
                : dialogue?.stage
                  ? `${dialogue.stage}${dialogue.child_name ? ` · ${dialogue.child_name}` : ""}${
                      dialogue.course_key ? ` · ${dialogue.course_key}` : ""
                    }`
                  : trace?.booking?.course_key
                    ? `${trace.booking.course_key} · ${trace.booking.slot_count ?? 0} slots`
                    : "Idle — try book / cancel for Jason"
            }
            defaultOpen={bookingOpen}
            active={activePanel === "booking"}
            dimmed={Boolean(activePanel) && activePanel !== "booking"}
          >
            <p className="bn-note">
              Identity comes from the messaging number (<code>families.csv</code>). Demo
              number <code>+852 9000 0000</code> → Demo Parent / Jason Chan + Mia Chan.
            </p>
            {dialogue?.child_schedule?.length > 0 && (
              <ul className="bn-child-sched">
                {dialogue.child_schedule.slice(0, 4).map((s) => (
                  <li key={s.slot_start}>
                    <strong>{s.slot_display}</strong>
                    <span>
                      {s.course_label} · {s.teacher_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="bn-book-grid">
              <label>
                Course
                <select value={courseKey} onChange={(e) => setCourseKey(e.target.value)}>
                  {(courses.length
                    ? courses
                    : [
                        { key: "trial", label: "Trial Assessment" },
                        { key: "phonics", label: "Phonics" },
                      ]
                  ).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parent
                <input value={parentName} onChange={(e) => setParentName(e.target.value)} />
              </label>
              <label>
                Child
                <input value={childName} onChange={(e) => setChildName(e.target.value)} />
              </label>
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <div className="bn-book-actions">
              <button
                type="button"
                className="bn-secondary"
                disabled={isLoading}
                onClick={() => sendMessage(`Can I book a class for ${childName.split(" ")[0]} next week?`)}
              >
                Start booking dialogue
              </button>
              <button
                type="button"
                className="bn-secondary"
                disabled={isLoading}
                onClick={() =>
                  sendMessage(`Can I cancel ${childName.split(" ")[0]}'s class next Tuesday?`)
                }
              >
                Start cancel dialogue
              </button>
              <button
                type="button"
                className="bn-secondary"
                disabled={isLoading}
                onClick={() => sendMessage(`Show availability for ${courseKey}`)}
              >
                Browse slots only
              </button>
            </div>
            {lastBooking && (
              <p className="bn-note">
                Last booking <code>{lastBooking.id}</code> · {lastBooking.slot_display}
                {lastBooking.teacher_name ? ` · ${lastBooking.teacher_name}` : ""}
              </p>
            )}
          </Reveal>

          <Reveal
            key={`mem-${turnKey}`}
            title="Session memory"
            summary={`${memoryDisplayTurns}/${trace?.history?.limit ?? 10} msgs · includes this turn`}
            defaultOpen={memoryOpen}
            active={memoryOpen && !activePanel}
            dimmed={Boolean(activePanel) && activePanel !== "memory" && !memoryOpen}
          >
            {memoryLines.length === 0 && userTurns === 0 ? (
              <p className="bn-empty">No prior turns yet.</p>
            ) : (
              <>
                <p className="bn-note">
                  Loaded before reply: <strong>{trace?.history?.turns_loaded ?? 0}</strong> ·
                  parent turns this session: <strong>{userTurns}</strong>
                </p>
                {memoryLines.length > 0 ? (
                  <pre className="bn-pre bn-mem-pre">
                    {memoryLines.map((line, i) => {
                      const fresh = i >= Math.max(0, memoryLines.length - 2);
                      return (
                        <span
                          key={i}
                          className={`bn-mem-line${fresh ? " bn-mem-line-fresh" : ""}`}
                        >
                          {line}
                          {"\n"}
                        </span>
                      );
                    })}
                  </pre>
                ) : (
                  <p className="bn-empty">
                    First turn in this session — history will appear on the next message.
                  </p>
                )}
              </>
            )}
          </Reveal>

          <Reveal
            key={`probes-${turnKey}`}
            title="Demo probes"
            summary="90s path = numbered 1–6"
            defaultOpen={!trace}
            active={false}
            dimmed={Boolean(activePanel)}
          >
            <div className="bn-probes">
              {DEMO_PROBES.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  className="bn-probe"
                  disabled={isLoading}
                  onClick={() => sendMessage(p.text)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
