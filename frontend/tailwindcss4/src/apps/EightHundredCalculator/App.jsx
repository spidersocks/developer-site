import React, { useState, useEffect } from "react";
import './App.css'
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Helmet } from 'react-helmet-async';

const TRAINING_TYPES = [
  {
    key: "600m_x3",
    label: "3 x 600m",
    features: ["First 600m", "Second 600m", "Third 600m"],
    rest: "20 minutes rest between each 600m.",
  },
  {
    key: "600m_400m_x3",
    label: "600m + 3 x 400m",
    features: ["600m", "3x400 average"],
    rest: "8 minutes rest after the 600m. 2.5 minutes rest between each 400m.",
  },
  {
    key: "600m_300m_x4",
    label: "600m + 4 x 300m",
    features: ["600m", "4x300m average"],
    rest: "8 minutes rest after the 600m. 3 minutes rest between each 300m.",
  },
  {
    key: "500m_x3",
    label: "3 x 500m",
    features: ["First 500m", "Second 500m", "Third 500m"],
    rest: "10 minutes rest between each 500m.",
  },
  {
    key: "300m_x3x2",
    label: "2 x (3 x 300m)",
    features: ["Set 1 3x300m average", "Set 2 3x300m average"],
    rest: "3 minutes rest between each 300m. 10 minutes between set 1 and set 2.",
  },
];

// Placeholder map for each training type
const PLACEHOLDERS = {
  "600m_x3": ["1:36.0", "1:34.0", "1:32.0"],
  "600m_400m_x3": ["1:32.0", "1:03.5"],
  "600m_300m_x4": ["1:33.5", "0:46.5"],
  "500m_x3": ["1:18.0", "1:17.0", "1:16.0"],
  "300m_x3x2": ["0:47.0", "0:45.0"],
};
const DEFAULT_PLACEHOLDER = "1:32.5";
const GOAL_PLACEHOLDER = "2:00.0"; // for 800m goal input

const API_URL = "https://eight00m-calculator.onrender.com";

// Choose your accent color here
const accentColor = "indigo";

export default function App() {
  const [mode, setMode] = useState("predict");
  const [trainingType, setTrainingType] = useState(TRAINING_TYPES[0]);
  const [inputs, setInputs] = useState(Array(TRAINING_TYPES[0].features.length).fill(""));
  const [goalTime, setGoalTime] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    setInputs(Array(trainingType.features.length).fill(""));
    setResult(null);
    setError("");
  }, [trainingType, mode]);

  function TrainingTypeDropdown() {
    return (
      <Listbox value={trainingType} onChange={setTrainingType}>
        <div className="relative">
          <Listbox.Button className={`relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-${accentColor}-200 transition text-base font-medium`}>
            <span className="block truncate">{trainingType.label}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronUpDownIcon className={`h-5 w-5 text-${accentColor}-500`} aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg z-[999] ring-1 ring-black/5 focus:outline-none">
            {TRAINING_TYPES.map((type) => (
              <Listbox.Option
                key={type.key}
                className={({ active }) =>
                  `cursor-pointer select-none py-2 pl-4 pr-4 text-base ${
                    active ? `bg-${accentColor}-50 text-${accentColor}-800` : "text-gray-900"
                  }`
                }
                value={type}
              >
                {({ selected }) => (
                  <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                    {type.label}
                  </span>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    );
  }

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_type: trainingType.key,
          input_values: inputs,
        }),
      });
      if (!res.ok) {
        let errorDetail = "Prediction failed. Please check inputs.";
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch (parseError) {}
        throw new Error(errorDetail);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || "An error occurred.");
    }
    setLoading(false);
  };

  const handleReverse = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`${API_URL}/reverse-predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_type: trainingType.key,
          goal_time: goalTime,
        }),
      });
      if (!res.ok) {
        let errorDetail = "Split calculation failed. Please check goal time.";
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch (parseError) {}
        throw new Error(errorDetail);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || "An error occurred.");
    }
    setLoading(false);
  };

  function TabButton({ modeVal, children }) {
    return (
      <button
        className={`
          px-4 py-2 rounded-t-lg font-medium transition-all
          ${
            mode === modeVal
              ? `!bg-white !text-${accentColor}-700 border-b-2 border-b-white shadow`
              : `bg-gray-100 text-gray-500 hover:bg-${accentColor}-50`
          }
        `}
        onClick={() => setMode(modeVal)}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <Helmet>
        <title>800m Training Calculator | Predict Race Splits & Times</title>
        <meta
          name="description"
          content="Free 800m calculator to predict 800 meter race times and recommended splits from your training. Ideal for runners, athletes, and coaches."
        />
        <link rel="canonical" href="https://www.seanfontaine.dev/800m-calculator" />

        {/* Open Graph / Twitter tags for social sharing */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="800m Training Calculator | Predict Race Splits & Times" />
        <meta property="og:description" content="Free 800m calculator to predict 800 meter race times and recommended splits from your training. Ideal for runners, athletes, and coaches." />
        <meta property="og:image" content="https://www.seanfontaine.dev/og-800m.png" />
        <meta property="og:url" content="https://www.seanfontaine.dev/800m-calculator" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="800m Training Calculator | Predict Race Splits & Times" />
        <meta name="twitter:description" content="Free 800m calculator to predict 800 meter race times and recommended splits from your training. Ideal for runners, athletes, and coaches." />
        <meta name="twitter:image" content="https://www.seanfontaine.dev/og-800m.png" />
      </Helmet>
      <div className="relative min-h-screen w-full flex flex-col justify-between">
        {/* Fixed, full-viewport grayscale background */}
        <div className="fixed inset-0 bg-gray-50 -z-10" aria-hidden="true" />

        {/* Glassy Card Centered */}
        <header className="mb-6 text-center z-10 flex flex-col items-center">
          <h1 className="font-bold text-gray-900 mb-2 drop-shadow-none inline-block px-2
            text-base sm:text-lg md:text-xl lg:text-2xl tracking-tight max-w-[20rem] sm:max-w-[28rem] leading-tight
          ">
            800m Training & Race Calculator
          </h1>
          <p
            className="text-gray-500 text-sm sm:text-base md:text-lg px-2"
            style={{ width: "auto", maxWidth: "100%", display: "inline-block" }}
          >
            Predict your 800m race time from your training results,<br />
            or calculate recommended splits for a goal 800m time.
          </p>
        </header>

        <main className="
          w-full max-w-md mx-auto
          bg-white/80 backdrop-blur-sm shadow-xl rounded-xl
          p-6 md:p-8 z-10 relative
          border border-gray-200
          animate-fade-in
        ">
          <div className="flex mb-6 gap-2 md:gap-6 justify-center">
            <TabButton modeVal="predict">Predict Race Time</TabButton>
            <TabButton modeVal="reverse">Get Training Splits</TabButton>
          </div>
          {mode === "predict" ? (
            <form onSubmit={handlePredict} className="space-y-6">
              <div className="mb-8">
                <label className={`block text-${accentColor}-700 font-semibold mb-1`}>Training Type</label>
                <TrainingTypeDropdown />
                <div className="mt-2 flex items-center">
                  <button
                    type="button"
                    className={`flex items-center gap-1 text-xs !text-${accentColor}-600 hover:underline font-medium focus:outline-none`}
                    style={{ padding: "2px 0" }}
                    onClick={() => setShowRest((v) => !v)}
                    aria-expanded={showRest}
                    aria-controls="rest-info"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {showRest ? "Hide Training Info" : "Show Training Info"}
                  </button>
                </div>
                {showRest && (
                  <div
                    id="rest-info"
                    className={`mt-2 p-3 rounded bg-${accentColor}-50 border border-${accentColor}-100 text-${accentColor}-800 animate-fade-in text-sm`}
                  >
                    <div className="font-semibold mb-1">Rest Times</div>
                    <div>{trainingType.rest}</div>
                  </div>
                )}
              </div>
              {trainingType.features.map((label, idx) => {
                const phArray = PLACEHOLDERS[trainingType.key] || [];
                const placeholder = phArray[idx] || DEFAULT_PLACEHOLDER;
                return (
                  <div key={label}>
                    <label className="block text-gray-700 mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      className="
                        w-full border border-gray-300 rounded-lg px-3 py-2
                        focus:outline-none focus:ring-2 focus:ring-indigo-200 transition
                        bg-white
                      "
                      value={inputs[idx] || ""}
                      onChange={(e) => setInputs((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                      required
                    />
                  </div>
                );
              })}
              <button
                type="submit"
                className={`
                  w-full !bg-${accentColor}-600 hover:!bg-${accentColor}-700
                  !text-white font-bold py-2 rounded-lg transition
                  transition-transform duration-150 hover:scale-105
                  shadow
                  ${loading ? "opacity-70" : ""}
                `}
                disabled={loading}
              >
                {loading ? (
      <>
        <svg
          className="animate-spin h-5 w-5 text-white inline-block mr-2 align-middle"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          ></path>
        </svg>
        Calculating...
      </>
    ) : (
      "Calculate"
    )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReverse} className="space-y-6">
              <div className="mb-8">
                <label className={`block text-${accentColor}-700 font-semibold mb-1`}>Training Type</label>
                <TrainingTypeDropdown />
                <div className="mt-2 flex items-center">
                  <button
                    type="button"
                    className={`flex items-center gap-1 text-xs !text-${accentColor}-600 hover:underline font-medium focus:outline-none`}
                    style={{ padding: "2px 0" }}
                    onClick={() => setShowRest((v) => !v)}
                    aria-expanded={showRest}
                    aria-controls="rest-info"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {showRest ? "Hide Training Info" : "Show Training Info"}
                  </button>
                </div>
                {showRest && (
                  <div
                    id="rest-info"
                    className={`mt-2 p-3 rounded bg-${accentColor}-50 border border-${accentColor}-100 text-${accentColor}-800 animate-fade-in text-sm`}
                  >
                    <div className="font-semibold mb-1">Rest Times</div>
                    <div>{trainingType.rest}</div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Goal 800m Time</label>
                <input
                  type="text"
                  placeholder={GOAL_PLACEHOLDER}
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-indigo-200 transition
                    bg-white
                  "
                  value={goalTime}
                  onChange={(e) => setGoalTime(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className={`
                  w-full !bg-${accentColor}-600 hover:!bg-${accentColor}-700
                  !text-white font-bold py-2 rounded-lg transition
                  transition-transform duration-150 hover:scale-105
                  shadow
                  ${loading ? "opacity-70" : ""}
                `}
                disabled={loading}
              >
                {loading ? (
      <>
        <svg
          className="animate-spin h-5 w-5 text-white inline-block mr-2 align-middle"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          ></path>
        </svg>
        Calculating...
      </>
    ) : (
      "Get Recommended Splits"
    )}
              </button>
            </form>
          )}
          {result && (
            <div className={`mt-6 bg-${accentColor}-50 border border-${accentColor}-100 rounded-lg p-4 text-center animate-fade-in`}>
              {mode === "predict" ? (
                <>
                  <div className={`text-${accentColor}-800 text-lg font-medium`}>Predicted 800m Time:</div>
                  <div className={`text-2xl font-bold text-${accentColor}-700 mt-2`}>
                    {result.predicted_formatted}
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-${accentColor}-800 text-lg font-medium`}>Recommended Splits:</div>
                  <ul className="mt-2 space-y-1">
                    {Array.isArray(result)
                      ? result.map((split, i) => (
                          <li key={i} className={`text-${accentColor}-700`}>
                            <span className="font-semibold">{split.interval}:</span>{" "}
                            <span className="font-mono">{split.formatted}</span>
                          </li>
                        ))
                      : null}
                  </ul>
                </>
              )}
            </div>
          )}
          {error && <div className="mt-4 text-red-600 text-center">{error}</div>}
        </main>

        <footer className="mt-10 text-gray-400 text-xs z-10 text-center pb-2">
          @2025 Sean-Fontaine-Tools
        </footer>
      </div>
    </>
  );
}