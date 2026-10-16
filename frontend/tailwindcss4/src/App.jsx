import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import EightHundredCalculatorApp from "./apps/EightHundredCalculator/App";
import PokeTeamPredictorApp from "./apps/PokeTeamPredictor/App";
import PodcastProjectApp from "./apps/PodcastProject/App";
import { Analytics } from "@vercel/analytics/react";
import About from "./pages/About";
import Resume from "./pages/Resume";
// Import the new component
import LittleScholarsBotDemo from "./apps/LittleScholarsBot/LittleScholarsBotDemo";

const STETHOSCRIBE_HEALTH_URL = "https://medical-scribe-1j17.onrender.com/healthz";
let stethoscribePingSent = false;

function scheduleStethoscribePing() {
  if (stethoscribePingSent) return () => {};

  const send = () => {
    if (stethoscribePingSent) return;
    stethoscribePingSent = true;
    fetch(STETHOSCRIBE_HEALTH_URL, {
      cache: "no-store",
      priority: "low",
    }).catch(() => {});
  };

  let idleId = 0;
  let timeoutId = 0;

  const scheduleIdle = () => {
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(send, { timeout: 5000 });
      return;
    }
    timeoutId = window.setTimeout(send, 2000);
  };

  if (document.readyState === "complete") {
    scheduleIdle();
  } else {
    window.addEventListener("load", scheduleIdle, { once: true });
  }

  return () => {
    window.removeEventListener("load", scheduleIdle);
    if (idleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId) window.clearTimeout(timeoutId);
  };
} 

// Class-based Error Boundary (per React docs)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // Optional: send error + info?.componentStack to your logging service
    // console.error(error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ color: "#dc2626", padding: "1rem" }}>
          Something went wrong loading this view.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useEffect(() => scheduleStethoscribePing(), []);

  return (
    <BrowserRouter>
      <ErrorBoundary fallback={<div style={{ color: "#dc2626" }}>Couldn’t load this page.</div>}>
        <Routes>
          {/* Homepage */}
          <Route path="/" element={<Home />} />
          {/* About page */}
          <Route path="/about" element={<About />} />
          {/* Resume */}
          <Route path="/resume" element={<Resume />} />
          
          {/* NEW ROUTE: Little Scholars Bot Demo */}
          <Route path="/little-scholars-bot" element={<LittleScholarsBotDemo />} />
          
          {/* 800m Calculator (with language support) */}
          <Route path="/800m-calculator" element={<EightHundredCalculatorApp lang="en" />} />
          <Route path="/en/800m-calculator/*" element={<EightHundredCalculatorApp lang="en" />} />
          <Route path="/zh/800m-calculator/*" element={<EightHundredCalculatorApp lang="zh" />} />
          {/* Poke Team Predictor App */}
          <Route path="/poke-team-predictor" element={<PokeTeamPredictorApp />} />
          {/* Podcast project and all subroutes */}
          <Route path="/podcast-project/*" element={<PodcastProjectApp />} />
          {/* Stethoscribe is served at /stethoscribe by a vercel.json rewrite */}
          {/* Catch all for not found components */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>

      <Analytics />
    </BrowserRouter>
  );
}