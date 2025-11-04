import React, { useState, useEffect, useRef } from "react";

// The base URL for your FastAPI backend
const API_BASE_URL = "https://unified-backend.fly.dev";

// Color palette (Tailwind blue/white)
const ACTIVE_BG_COLOR = "#1d4ed8"; // Tailwind blue-700
const DISABLED_BG_COLOR = "#3b82f6"; // Tailwind blue-500
const TEXT_COLOR = "#ffffff"; // White

// Util: Maintain one session id per browser via localStorage
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("ls_bot_session_id");
  if (!sessionId) {
    sessionId = "web:" + Math.random().toString(36).substr(2, 8) + Date.now();
    localStorage.setItem("ls_bot_session_id", sessionId);
  }
  return sessionId;
}

export default function LittleScholarsBotDemo() {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]); // [{role: "user"/"bot", message: "..."}]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatWindowRef = useRef(null);

  // Auto-scroll chat to bottom when history changes
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  // "Reset chat" button (clear history & localStorage)
  function handleReset() {
    setChatHistory([]);
    setError(null);
    const oldSession = localStorage.getItem("ls_bot_session_id");
    localStorage.removeItem("ls_bot_session_id");
    // New session is lazily generated on next send
  }

  // On send
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    // Add user message immediately to history
    setChatHistory((prev) => [...prev, { role: "user", message: trimmed }]);
    setIsLoading(true);
    setError(null);

    const payload = {
      message: trimmed,
      session_id: getOrCreateSessionId(),
      // language omitted – server will auto-detect
    };

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

      const data = await res.json();

      // The bot can respond silently (no output); don't show a bot bubble then
      if (data.answer && data.answer.trim() !== "") {
        setChatHistory((prev) => [
          ...prev,
          { role: "bot", message: data.answer },
        ]);
      }
      // else: silent, don't add bot message

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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-xl p-6 md:p-10">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Little Scholars Bot Demo
          </h1>
          <p className="text-gray-600">
            Ask questions about content indexed in the knowledge base.
          </p>
        </div>

        {/* Reset/Info */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-gray-400">
            Session: <span className="select-all">{localStorage.getItem("ls_bot_session_id") || "(none)"}</span>
          </span>
          <button
            className="text-xs bg-gray-200 rounded px-3 py-1 hover:bg-gray-300 ml-2"
            onClick={handleReset}
            title="Restart chat session"
            disabled={isLoading}
          >
            Reset Chat
          </button>
        </div>

        {/* Chat History/Display Area */}
        <div
          className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50 border border-gray-200 rounded-lg mb-8"
          ref={chatWindowRef}
          style={{scrollBehavior: "smooth"}}
        >
          {chatHistory.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-tl-none bg-green-100 text-gray-800 shadow-md">
                👋 Hello this is the Little Scholars bot demo! Ask me anything.
              </div>
            </div>
          )}

          {chatHistory.map((msg, idx) =>
            msg.role === "user" ? (
              <div className="flex justify-end" key={idx}>
                <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-br-none bg-blue-500 text-white shadow-md">
                  {msg.message}
                </div>
              </div>
            ) : (
              <div className="flex justify-start" key={idx}>
                <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-tl-none bg-green-100 text-gray-800 shadow-md whitespace-pre-wrap">
                  {msg.message}
                </div>
              </div>
            )
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-tl-none bg-gray-200 text-gray-600 italic">
                The bot is typing...
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              Error: {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="E.g., 學費幾多？/ What's the tuition?"
              className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              autoFocus
              autoComplete="off"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: isDisabled ? DISABLED_BG_COLOR : ACTIVE_BG_COLOR,
                color: TEXT_COLOR,
              }}
              className={`px-6 py-3 rounded-full font-semibold transition duration-150 ${
                isDisabled ? "cursor-not-allowed opacity-75" : "hover:bg-blue-800"
              }`}
              disabled={isDisabled}
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}