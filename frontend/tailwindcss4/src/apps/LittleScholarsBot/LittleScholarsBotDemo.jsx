import React, { useState, useEffect, useRef } from "react";

// The base URL for your FastAPI backend
const API_BASE_URL = "https://unified-backend.fly.dev";

// Color palette aligned closer to WhatsApp vibes
const WA_BG = "#efeae2"; // WhatsApp chat background tone
const WA_USER = "#d9fdd3"; // WhatsApp user bubble green
const WA_BOT = "#ffffff"; // WhatsApp received bubble white

// WhatsApp accent for the send icon
const WA_ACCENT = "#25D366";

// Sizes
const SEND_BTN = 60;   // clickable area (px)
const SEND_ICON = 44;  // SVG size (px)

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("ls_bot_session_id");
  if (!sessionId) {
    sessionId = "web:" + Math.random().toString(36).substr(2, 8) + Date.now();
    localStorage.setItem("ls_bot_session_id", sessionId);
  }
  return sessionId;
}

// Helper to format timestamps like "12:34"
function formatTime(d = new Date()) {
  const hrs = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hrs}:${mins}`;
}

export default function LittleScholarsBotDemo() {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]); // [{role, message, time}]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatWindowRef = useRef(null);
  const textAreaRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  // Auto-grow textarea height
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const maxHeight = 160; // ~8 lines
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [inputMessage]);

  function handleReset() {
    setChatHistory([]);
    setError(null);
    localStorage.removeItem("ls_bot_session_id");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    const now = formatTime();

    setChatHistory((prev) => [...prev, { role: "user", message: trimmed, time: now }]);
    setIsLoading(true);
    setError(null);

    const payload = {
      message: trimmed,
      session_id: getOrCreateSessionId(),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

      const data = await res.json();

      if (data.answer && data.answer.trim() !== "") {
        setChatHistory((prev) => [
          ...prev,
          { role: "bot", message: data.answer, time: formatTime() },
        ]);
      }

      setInputMessage("");
    } catch (err) {
      console.error("API Error:", err);
      setError("Failed to connect to the backend or process the request.");
      setChatHistory((prev) =>
        prev.length && prev[prev.length - 1]?.role === "user"
          ? prev.slice(0, -1)
          : prev
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || !inputMessage.trim();

  return (
    <div className="min-h-screen" style={{ backgroundColor: WA_BG }}>
      <div
        className="w-full h-full"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {/* Fluid container on large screens */}
        <div className="mx-auto w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl px-0 sm:px-4 py-0 sm:py-6">
          {/* Header bar */}
          <div className="bg-[#128C7E] text-white rounded-none sm:rounded-t-xl shadow-sm">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Bigger avatar using your public image */}
                <div className="w-12 h-12 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
                  <img
                    src="/little_scholars.png"
                    alt="Little Scholars"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.textContent = "LS";
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-[20px] sm:text-[22px] font-semibold leading-tight">
                    Little Scholars Bot
                  </h1>
                  <div className="text-xs text-white/90">
                    Session:{" "}
                    <span className="select-all">
                      {localStorage.getItem("ls_bot_session_id") || "(none)"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="text-sm text-[#0b3b33] bg-white rounded-full px-4 py-1.5 hover:bg-white/90 shadow-sm"
                onClick={handleReset}
                title="Restart chat session"
                disabled={isLoading}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Chat container */}
          <div className="bg-[#F0F2F5] sm:rounded-b-xl shadow-md overflow-hidden">
            {/* Chat area */}
            <div
              className="h-[70vh] sm:h-[72vh] overflow-y-auto px-3 sm:px-4 py-3"
              ref={chatWindowRef}
              style={{ scrollBehavior: "smooth" }}
            >
              {chatHistory.length === 0 && !isLoading && (
                <div className="flex justify-start">
                  <div
                    className="relative max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm"
                    style={{ backgroundColor: WA_BOT, borderTopLeftRadius: "6px" }}
                  >
                    <span>👋 Hello this is the Little Scholars bot demo! Ask me anything.</span>
                    <span className="block text-[11px] text-gray-400 text-right mt-1">
                      {formatTime()}
                    </span>
                    <span
                      className="absolute -left-1.5 bottom-0"
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: "8px solid transparent",
                        borderRight: `12px solid ${WA_BOT}`,
                        borderBottom: "8px solid transparent",
                        transform: "translateY(-2px)",
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {chatHistory.map((msg, idx) =>
                  msg.role === "user" ? (
                    <div className="flex justify-end" key={idx}>
                      <div
                        className="relative max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm"
                        style={{ backgroundColor: WA_USER, borderTopRightRadius: "6px" }}
                      >
                        <div className="whitespace-pre-wrap break-words text-gray-900">
                          {msg.message}
                        </div>
                        <div className="flex justify-end items-center gap-1 mt-1">
                          <span className="text-[11px] text-gray-500">
                            {msg.time || formatTime()}
                          </span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="#4fc3f7"
                            aria-hidden
                            className="opacity-80"
                          >
                            <path d="M0 13l2-2 5 5L22 1l2 2L7 20z" />
                            <path d="M0 13l2-2 5 5 1-1-6-6-2 2z" />
                          </svg>
                        </div>
                        <span
                          className="absolute -right-1.5 bottom-0"
                          style={{
                            width: 0,
                            height: 0,
                            borderTop: "8px solid transparent",
                            borderLeft: `12px solid ${WA_USER}`,
                            borderBottom: "8px solid transparent",
                            transform: "translateY(-2px)",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start" key={idx}>
                      <div
                        className="relative max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm"
                        style={{ backgroundColor: WA_BOT, borderTopLeftRadius: "6px" }}
                      >
                        <div className="whitespace-pre-wrap break-words text-gray-900">
                          {msg.message}
                        </div>
                        <span className="block text-[11px] text-gray-400 text-right mt-1">
                          {msg.time || formatTime()}
                        </span>
                        <span
                          className="absolute -left-1.5 bottom-0"
                          style={{
                            width: 0,
                            height: 0,
                            borderTop: "8px solid transparent",
                            borderRight: `12px solid ${WA_BOT}`,
                            borderBottom: "8px solid transparent",
                            transform: "translateY(-2px)",
                          }}
                        />
                      </div>
                    </div>
                  )
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div
                      className="relative max-w-[60%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm"
                      style={{ backgroundColor: WA_BOT, borderTopLeftRadius: "6px" }}
                    >
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.1s]" />
                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <span className="sr-only">The bot is typing…</span>
                      </div>
                      <span className="block text-[11px] text-gray-400 text-right mt-1">
                        {formatTime()}
                      </span>
                      <span
                        className="absolute -left-1.5 bottom-0"
                        style={{
                          width: 0,
                          height: 0,
                          borderTop: "8px solid transparent",
                          borderRight: `12px solid ${WA_BOT}`,
                          borderBottom: "8px solid transparent",
                          transform: "translateY(-2px)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                      Error: {error}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="px-2 sm:px-3 py-2 bg-[#F0F2F5] border-t border-black/5">
              <div className="flex items-end gap-2">
                {/* Textarea */}
                <div className="flex-grow bg-white rounded-2xl px-3 py-2 border border-black/10 shadow-sm">
                  <textarea
                    ref={textAreaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type a message"
                    className="w-full max-h-40 resize-none outline-none text-[15px] leading-6 placeholder-gray-400"
                    disabled={isLoading}
                    autoFocus
                    autoComplete="off"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                </div>

                {/* Icon-only send control with no outline on hover/focus */}
                <button
                  type="submit"
                  disabled={isDisabled}
                  title={isDisabled ? "Type a message" : "Send"}
                  className={`send-btn relative flex items-center justify-center rounded-full transition ${
                    isDisabled ? "opacity-40 cursor-not-allowed" : "hover:scale-105"
                  }`}
                  style={{
                    width: SEND_BTN,
                    height: SEND_BTN,
                    background: "transparent",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    style={{
                      width: SEND_ICON,
                      height: SEND_ICON,
                      color: WA_ACCENT,
                      fill: WA_ACCENT,
                    }}
                    className="force-wa-green"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z" />
                  </svg>
                  <span className="sr-only">Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Styles: custom scrollbars + force icon color + remove outline */}
      <style>{`
        .h-\\[70vh\\]::-webkit-scrollbar { width: 10px; }
        .h-\\[70vh\\]::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.15);
          border-radius: 8px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .h-\\[70vh\\]::-webkit-scrollbar-track { background-color: transparent; }
        .h-\\[70vh\\] { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.25) transparent; }

        /* Force WhatsApp green on the icon */
        button > svg.force-wa-green,
        button svg.force-wa-green path {
          color: ${WA_ACCENT} !important;
          fill: ${WA_ACCENT} !important;
        }

        /* Brutal removal of any purple/pseudo ring/outline/border highlight */
.send-btn,
.send-btn *,
.send-btn:before,
.send-btn:after {
  outline: none !important;
  box-shadow: none !important;
  border-color: transparent !important;
  text-decoration: none !important;
  -webkit-tap-highlight-color: transparent;
}

/* Kill Tailwind-like ring utilities if applied globally */
.send-btn,
.send-btn:hover,
.send-btn:active,
.send-btn:focus {
  --tw-ring-offset-shadow: 0 0 #0000 !important;
  --tw-ring-shadow: 0 0 #0000 !important;
  --tw-ring-color: transparent !important;
  --tw-ring-offset-width: 0px !important;
}

/* Remove any hover/focus border highlight specifically */
.send-btn:hover,
.send-btn:focus,
.send-btn:active {
  border: none !important;
  border-color: transparent !important;
  color: inherit !important;
}

/* Keep only a subtle, accessible keyboard focus style */
.send-btn:focus-visible {
  outline: none !important;
  box-shadow: 0 0 0 6px rgba(37, 211, 102, 0.12) !important; /* soft green glow */
}

/* Maintain the hover scale and soft drop shadow without any color highlight */
.send-btn:not(:disabled):hover {
  transform: translateZ(0) scale(1.05);
  box-shadow: 0 6px 14px rgba(0,0,0,0.12) !important;
}

/* If any inherited text selection/caret color causes purple tint near the button */
.send-btn ::selection { background: transparent !important; color: inherit !important; }
      `}</style>
    </div>
  );
}