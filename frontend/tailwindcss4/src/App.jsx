import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import EightHundredCalculatorApp from "./apps/EightHundredCalculator/App";
import PokeTeamPredictorApp from "./apps/PokeTeamPredictor/App";
import PodcastProjectApp from "./apps/PodcastProject/App";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Homepage (no language prefix) */}
        <Route path="/" element={<Home />} />
        
        {/* 800m Calculator (with language support) */}
        <Route path="/800m-calculator" element={<EightHundredCalculatorApp lang="en" />} />
        <Route path="/en/800m-calculator/*" element={<EightHundredCalculatorApp lang="en" />} />
        <Route path="/zh/800m-calculator/*" element={<EightHundredCalculatorApp lang="zh" />} />
        
        {/* Other apps (no language prefix) */}
        <Route path="/poke-team-predictor" element={<PokeTeamPredictorApp />} />
        <Route path="/podcast-project/*" element={<PodcastProjectApp />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}