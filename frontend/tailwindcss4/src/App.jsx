import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EightHundredCalculatorApp from "./apps/EightHundredCalculator/App";
import PokeTeamPredictorApp from "./apps/PokeTeamPredictor/App";
import PodcastProjectApp from "./apps/PodcastProject/App";
import { Analytics } from "@vercel/analytics/react";
import Resume from "./pages/Resume";
import LittleScholarsBotDemo from "./apps/LittleScholarsBot/LittleScholarsBotDemo";
import BrightNestBotDemo from "./apps/BrightNestBot/BrightNestBotDemo";
import PlazaHome from "./pages/homeLab/Home2";

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
          {/* Soft Aero plaza is the site home */}
          <Route path="/" element={<PlazaHome />} />
          {/* Legacy URLs */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/home1" element={<Navigate to="/" replace />} />
          <Route path="/home2" element={<Navigate to="/" replace />} />
          <Route path="/home3" element={<Navigate to="/" replace />} />
          <Route path="/home4" element={<Navigate to="/" replace />} />
          <Route path="/home5" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<Navigate to="/#about" replace />} />
          {/* Resume */}
          <Route path="/resume" element={<Resume />} />
          
          {/* NEW ROUTE: Little Scholars Bot Demo */}
          <Route path="/little-scholars-bot" element={<LittleScholarsBotDemo />} />
          {/* BrightNest COMP6708 A3 Demo (MPA + Vercel rewrite is primary) */}
          <Route path="/COMP6708_A3_Demo" element={<BrightNestBotDemo />} />
          <Route path="/COMP6708_A3_Demo/*" element={<BrightNestBotDemo />} />
          
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