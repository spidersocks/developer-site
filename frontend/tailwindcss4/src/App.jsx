import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import EightHundredCalculatorApp from "./apps/EightHundredCalculator/App";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/800m-calculator/*" element={<EightHundredCalculatorApp />} />
        {/* Add more routes for other apps as you build them */}
      </Routes>
    </BrowserRouter>
  );
}