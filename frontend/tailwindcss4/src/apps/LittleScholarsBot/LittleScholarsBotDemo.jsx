import React, { useState, useEffect, useRef } from "react";
import "./little-scholars.css";

const API_BASE_URL = "https://unified-backend.fly.dev";

const WA_BG = "#efeae2";
const WA_USER = "#d9fdd3";
const WA_BOT = "#ffffff";
const WA_ACCENT = "#25D366";

const SEND_BTN = 56;
const SEND_ICON = 36;

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("ls_bot_session_id");
  if (!sessionId) {
    sessionId = "web:" + Math.random().toString(36).substr(2, 8) + Date.now();
    localStorage.setItem("ls_bot_session_id", sessionId);
  }
  return sessionId;
}

function formatTime(d = new Date()) {
  const hrs = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hrs}:${mins}`;
}

export default function LittleScholarsBotDemo() {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatWindowRef = useRef(null);
  const textAreaRef = useRef(null);

  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const maxHeight = 140;
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

    const payload = { message: trimmed, session_id: getOrCreateSessionId() };

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
        prev.length && prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || !inputMessage.trim();

  return (
    <div className="ls-root" style={{ backgroundColor: WA_BG }}>
      {/* Sticky header */}
      <div className="ls-header">
        <div className="ls-header-inner">
          {/* Keep this block left-aligned always */}
          <div className="ls-header-left">
            <div className="ls-avatar">
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
            <div className="ls-title-wrap">
              <h1 className="ls-title">Little Scholars Bot</h1>
              <div className="ls-session">
                Session: <span className="select-all">{localStorage.getItem("ls_bot_session_id") || "(none)"}</span>
              </div>
            </div>
          </div>

          {/* Reset stays right aligned */}
          <button
            className="ls-reset"
            onClick={handleReset}
            title="Restart chat session"
            disabled={isLoading}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Scrollable chat area */}
      <div className="ls-chat custom-scroll" ref={chatWindowRef}>
        {chatHistory.length === 0 && !isLoading && (
          <div className="ls-row-start">
            <div className="ls-bubble-bot" style={{ backgroundColor: WA_BOT }}>
              <span>👋 Hello this is the Little Scholars bot demo! Ask me anything.</span>
              <span className="ls-time">{formatTime()}</span>
              <span className="ls-tail-bot" />
            </div>
          </div>
        )}

        <div className="ls-stack">
          {chatHistory.map((msg, idx) =>
            msg.role === "user" ? (
              <div className="ls-row-end" key={idx}>
                <div className="ls-bubble-user" style={{ backgroundColor: WA_USER }}>
                  <div className="ls-content">{msg.message}</div>
                  <div className="ls-meta">
                    <span className="ls-time">{msg.time || formatTime()}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#4fc3f7" aria-hidden className="opacity-80">
                      <path d="M0 13l2-2 5 5L22 1l2 2L7 20z" />
                      <path d="M0 13l2-2 5 5 1-1-6-6-2 2z" />
                    </svg>
                  </div>
                  <span className="ls-tail-user" />
                </div>
              </div>
            ) : (
              <div className="ls-row-start" key={idx}>
                <div className="ls-bubble-bot" style={{ backgroundColor: WA_BOT }}>
                  <div className="ls-content">{msg.message}</div>
                  <span className="ls-time">{msg.time || formatTime()}</span>
                  <span className="ls-tail-bot" />
                </div>
              </div>
            )
          )}

          {isLoading && (
            <div className="ls-row-start">
              <div className="ls-bubble-bot" style={{ backgroundColor: WA_BOT }}>
                <div className="ls-typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="sr-only">The bot is typing…</span>
                </div>
                <span className="ls-time">{formatTime()}</span>
                <span className="ls-tail-bot" />
              </div>
            </div>
          )}

          {error && <div className="ls-error">Error: {error}</div>}
        </div>
      </div>

      {/* Sticky input bar */}
      <form onSubmit={handleSubmit} className="ls-inputbar" noValidate>
        <div className="ls-inputwrap ls-input-neutral">
          <textarea
            ref={textAreaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message"
            className="ls-textarea no-purple-focus"
            disabled={isLoading}
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

        <button
          type="submit"
          disabled={isDisabled}
          title={isDisabled ? "Type a message" : "Send"}
          className={`send-btn ls-send ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
          aria-label="Send message"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            style={{ width: SEND_ICON, height: SEND_ICON, color: WA_ACCENT, fill: WA_ACCENT }}
            className="force-wa-green"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}