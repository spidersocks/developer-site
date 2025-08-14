import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import EightHundredCalculatorApp from "./apps/EightHundredCalculator/App";
import PokeTeamPredictorApp from "./apps/PokeTeamPredictor/App";
import PodcastProjectApp from "./apps/PodcastProject/App";
import { Analytics } from "@vercel/analytics/react";

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
  return (
    <BrowserRouter>
      <ErrorBoundary fallback={<div style={{ color: "#dc2626" }}>Couldn’t load this page.</div>}>
        <Routes>
          {/* Homepage */}
          <Route path="/" element={<Home />} />

          {/* 800m Calculator (with language support) */}
          <Route path="/800m-calculator" element={<EightHundredCalculatorApp lang="en" />} />
          <Route path="/en/800m-calculator/*" element={<EightHundredCalculatorApp lang="en" />} />
          <Route path="/zh/800m-calculator/*" element={<EightHundredCalculatorApp lang="zh" />} />

          {/* Other apps */}
          <Route path="/poke-team-predictor" element={<PokeTeamPredictorApp />} />

          {/* Podcast project: delegate all subroutes to this app */}
          <Route path="/podcast-project/*" element={<PodcastProjectApp />} />

          {/* Optional: catch-all -> home (or create a NotFound component) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>

      <Analytics />
    </BrowserRouter>
  );
}