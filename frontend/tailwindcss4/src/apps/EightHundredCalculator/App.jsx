import React, { useState, useEffect, useCallback, memo } from "react";
import './App.css'
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Helmet } from 'react-helmet-async';

// TRAINING TYPES AND FEATURES
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
    features: ["600m", "3x400m average"],
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

const SPLIT_FEATURES = {
  "600m_x3": 3,
  "500m_x3": 3,
  "600m_400m_x3": { "3x400m average": 3 },
  "600m_300m_x4": { "4x300m average": 4 },
  "300m_x3x2": { "Set 1 3x300m average": 3, "Set 2 3x300m average": 3 },
};

const PLACEHOLDERS = {
  "600m_x3": ["1:36.0", "1:34.0", "1:32.0"],
  "600m_400m_x3": ["1:32.0", "1:03.5", "1:03.5", "1:03.5"],
  "600m_300m_x4": ["1:33.5", "46.5", "46.0", "45.5", "45.0"],
  "500m_x3": ["1:18.0", "1:17.0", "1:16.0"],
  "300m_x3x2": ["47.0", "47.0", "47.0", "45.0", "45.0", "45.0"],
};

const DEFAULT_PLACEHOLDER = "1:32.5";
const GOAL_PLACEHOLDER = "2:00.0";
const API_URL = "https://eight00m-calculator.onrender.com";

function cleanLabel(label) {
  return label.replace(/average/gi, '').replace(/\s{2,}/g, ' ').trim();
}

const renderInput = (label, placeholder, value, onChange) => (
  <div>
    <label className="block text-gray-700 mb-1">{label}</label>
    <input
      type="text"
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 transition bg-white"
      value={value}
      onChange={onChange}
      required
    />
  </div>
);

const renderSplitInputs = (label, placeholders, values, onChange) => (
  <div>
    <label className="block text-gray-700 mb-1">{label}</label>
    <div className="flex gap-2 flex-wrap">
      {placeholders.map((ph, idx) => (
        <input
          key={idx}
          type="text"
          placeholder={ph}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 transition bg-white"
          value={values[idx] || ""}
          onChange={(e) => onChange(e.target.value, idx)}
          required
        />
      ))}
    </div>
  </div>
);

const TrainingInputs = memo(({ trainingType, inputs, setInputs, inputAverages }) => {
  const featureNames = trainingType.features;
  const splitConfig = SPLIT_FEATURES[trainingType.key] || {};
  const phArray = PLACEHOLDERS[trainingType.key] || [];

  const handleInputChange = useCallback((value, idx, splitIdx = null) => {
    setInputs((prev) => {
      const updatedInputs = [...prev];
      if (splitIdx !== null) {
        if (Array.isArray(updatedInputs[idx])) {
          if (updatedInputs[idx][splitIdx] === value) return prev;
          updatedInputs[idx] = [...updatedInputs[idx]];
          updatedInputs[idx][splitIdx] = value;
        } else {
          const numSplits = splitConfig[featureNames[idx]];
          updatedInputs[idx] = Array(numSplits).fill("").map((_, i) =>
            i === splitIdx ? value : ""
          );
        }
      } else {
        if (updatedInputs[idx] === value) return prev;
        updatedInputs[idx] = value;
      }
      return updatedInputs;
    });
  }, []);

  const handleArrayInputChange = useCallback((value, idx, splitIdx) => {
    setInputs(prev => {
      const updatedInputs = [...prev];
      if (Array.isArray(updatedInputs[idx])) {
        if (updatedInputs[idx][splitIdx] === value) return prev;
        updatedInputs[idx] = [...updatedInputs[idx]];
        updatedInputs[idx][splitIdx] = value;
      } else {
        const numSplits = splitConfig[featureNames[idx]];
        updatedInputs[idx] = Array(numSplits).fill("").map((_, i) => 
          i === splitIdx ? value : ""
        );
      }
      return updatedInputs;
    });
  }, []);

  // Utility for extracting main distance (e.g. "600m" from "First 600m" or "4x300m average")
  const getDistanceFromLabel = label => {
    const match = label.match(/(\d+\s*x\s*)?(\d+m)/i) || label.match(/(\d+m)/i);
    return match ? match[2] || match[0] : label.replace(/average|set\s*\d+/gi, '').trim();
  };

  // Utility for getting set number
  const getSetNumber = label => {
    const match = label.match(/Set\s*(\d+)/i);
    return match ? match[1] : null;
  };

  // --- Input Averages Option ---
  if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
    if (inputAverages) {
      const reps = SPLIT_FEATURES[trainingType.key];
      const distance = getDistanceFromLabel(trainingType.label);
      return renderInput(
        `Average ${reps} x ${distance} Split`,
        phArray[0] || DEFAULT_PLACEHOLDER,
        inputs[0] || "",
        (e) => handleInputChange(e.target.value, 0)
      );
    } else {
      const distance = getDistanceFromLabel(trainingType.label);
      const num = SPLIT_FEATURES[trainingType.key];
      return renderSplitInputs(
        `${distance} Split${num > 1 ? 's' : ''}`,
        phArray,
        inputs,
        (value, idx) => handleInputChange(value, idx)
      );
    }
  }

  // --- For compound workouts ---
  return featureNames.map((label, idx) => {
    const numSplits = splitConfig[label] || 0;
    const setNumber = getSetNumber(label);
    const distance = getDistanceFromLabel(label);

    // Custom logic for "2 x (3 x 300m)" workout
    if (trainingType.key === "300m_x3x2") {
      if (inputAverages) {
        // Set 1 300m Average, Set 2 300m Average
        return renderInput(
          `Set ${idx + 1} 300m Average`,
          phArray[idx] || DEFAULT_PLACEHOLDER,
          inputs[idx] || "",
          (e) => handleInputChange(e.target.value, idx)
        );
      } else {
        // Set 1 300m Splits, Set 2 300m Splits
        return renderSplitInputs(
          `Set ${idx + 1} 300m Splits`,
          phArray.slice(idx, idx + numSplits),
          Array.isArray(inputs[idx]) ? inputs[idx] : [],
          (value, splitIdx) => handleInputChange(value, idx, splitIdx)
        );
      }
    }

    // --- Default logic for other compound workouts ---
    if (numSplits) {
      if (inputAverages) {
        // Examples: Average 3 x 400m Split, Average 4 x 300m Split, etc.
        let reps = numSplits;
        let avgLabel = `Average ${reps} x ${distance} Split`;
        if (setNumber) {
          avgLabel = `Average Set ${setNumber} ${distance} Split`;
        }
        return renderInput(
          avgLabel,
          phArray[idx] || DEFAULT_PLACEHOLDER,
          inputs[idx] || "",
          (e) => handleInputChange(e.target.value, idx)
        );
      } else {
        // e.g., 400m Splits, 300m Splits (pluralized)
        return renderSplitInputs(
          `${distance} Split${numSplits > 1 ? 's' : ''}`,
          phArray.slice(idx, idx + numSplits),
          Array.isArray(inputs[idx]) ? inputs[idx] : [],
          (value, splitIdx) => handleInputChange(value, idx, splitIdx)
        );
      }
    } else {
      // Fallback, single split, label as e.g. "600m Split"
      return renderInput(
        `${distance} Split`,
        phArray[idx] || DEFAULT_PLACEHOLDER,
        inputs[idx] || "",
        (e) => handleInputChange(e.target.value, idx)
      );
    }
  });
});

function TrainingTypeDropdown({ trainingType, setTrainingType }) {
  return (
    <Listbox value={trainingType} onChange={setTrainingType}>
      <div className="relative">
        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition text-base font-medium">
          <span className="block truncate">{trainingType.label}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronUpDownIcon className="h-5 w-5 text-indigo-500" aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg z-[999] ring-1 ring-black/5 focus:outline-none">
          {TRAINING_TYPES.map((type) => (
            <Listbox.Option
              key={type.key}
              className={({ active }) =>
                `cursor-pointer select-none py-2 pl-4 pr-4 text-base ${
                  active ? "bg-indigo-50 text-indigo-800" : "text-gray-900"
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

function TabButton({ modeVal, currentMode, onClick, children }) {
  const isActive = currentMode === modeVal;
  return (
    <button
      className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
        isActive
          ? "bg-white text-indigo-700 border-b-2 border-b-white shadow"
          : "bg-gray-100 text-gray-600 hover:bg-indigo-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [mode, setMode] = useState("predict");
  const [trainingType, setTrainingType] = useState(TRAINING_TYPES[0]);
  const [inputs, setInputs] = useState([]);
  const [goalTime, setGoalTime] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRest, setShowRest] = useState(false);
  const [inputAverages, setInputAverages] = useState(false);

  const supportsAverages = useCallback(() => {
    return (
      typeof SPLIT_FEATURES[trainingType.key] === "number" ||
      Object.keys(SPLIT_FEATURES[trainingType.key] || {}).length > 0
    );
  }, [trainingType]);

  useEffect(() => {
    const defaultInputs = Array.isArray(SPLIT_FEATURES[trainingType.key])
      ? Array(SPLIT_FEATURES[trainingType.key]).fill("")
      : trainingType.features.map((fn) => {
          const splits = SPLIT_FEATURES[trainingType.key]?.[fn];
          return splits ? Array(splits).fill("") : "";
        });
    setInputs(defaultInputs);
    setResult(null);
    setError("");
    setInputAverages(false);
  }, [trainingType, mode]);

  const handleAveragesToggle = useCallback((e) => {
    const checked = e.target.checked;
    setInputAverages(checked);

    if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
      setInputs(prev => {
        if (checked) {
          return [prev && prev[0] ? prev[0] : "", "", ""];
        } else {
          return Array(SPLIT_FEATURES[trainingType.key])
            .fill("")
            .map((v, i) => (prev && prev[i] ? prev[i] : ""));
        }
      });
    } else {
      setInputs(prev =>
        prev.map((v, idx) => {
          const splits = SPLIT_FEATURES[trainingType.key]?.[trainingType.features[idx]];
          if (splits) {
            if (checked) {
              return Array.isArray(v) ? (v[0] || "") : "";
            } else {
              return Array(splits).fill("").map((sv, si) => (si === 0 && v ? v : ""));
            }
          }
          return v;
        })
      );
    }
  }, [trainingType]);

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      let input_values;
      if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
        if (inputAverages) {
          const avg = inputs[0] || "";
          input_values = [avg, avg, avg];
        } else {
          input_values = inputs.map(s => s.trim());
        }
      } else {
        input_values = trainingType.features.map((fn, idx) => {
          const splits = SPLIT_FEATURES[trainingType.key]?.[fn];
          if (splits) {
            if (inputAverages) {
              const avg = inputs[idx] || "";
              return Array(splits).fill(avg);
            } else {
              return inputs[idx].map(s => s.trim());
            }
          }
          return inputs[idx];
        });
      }

      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_type: trainingType.key,
          input_values,
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

  return (
    <>
      <Helmet>
        <title>800m Training Calculator | Predict Race Splits & Times</title>
        <meta
          name="description"
          content="Free 800m calculator to predict 800 meter race times and recommended splits from your training. Ideal for runners, athletes, and coaches."
        />
        <link rel="canonical" href="https://www.seanfontaine.dev/800m-calculator" />
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
        <div className="fixed inset-0 bg-gray-50 -z-10" aria-hidden="true" />
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
            <TabButton 
              modeVal="predict" 
              currentMode={mode} 
              onClick={() => setMode("predict")}
            >
              Predict Race Time
            </TabButton>
            <TabButton 
              modeVal="reverse" 
              currentMode={mode} 
              onClick={() => setMode("reverse")}
            >
              Get Training Splits
            </TabButton>
          </div>
          {mode === "predict" ? (
            <form onSubmit={handlePredict} className="space-y-6">
              <div className="mb-8">
                <label className="block text-indigo-700 font-semibold mb-1">Training Type</label>
                <TrainingTypeDropdown trainingType={trainingType} setTrainingType={setTrainingType} />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    className={`
                      flex items-center gap-1 text-xs font-medium focus:outline-none hover:underline
                      ${showRest ? "text-indigo-700" : "text-gray-600"}
                    `}
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
                  {supportsAverages() && (
                    <div className="flex items-center ml-auto">
                      <input
                        type="checkbox"
                        id="input-averages"
                        checked={inputAverages}
                        onChange={handleAveragesToggle}
                        className="accent-indigo-600"
                      />
                      <label htmlFor="input-averages" className="text-sm text-gray-700 cursor-pointer ml-2">
                        Input Averages
                      </label>
                    </div>
                  )}
                </div>
                {showRest && (
                  <div
                    id="rest-info"
                    className="mt-2 p-3 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 animate-fade-in text-sm"
                  >
                    <div className="font-semibold mb-1">Rest Times</div>
                    <div>{trainingType.rest}</div>
                  </div>
                )}
              </div>
              <TrainingInputs 
                trainingType={trainingType}
                inputs={inputs}
                setInputs={setInputs}
                inputAverages={inputAverages}
              />
              <button
                type="submit"
                className={`
                  w-full bg-indigo-50 hover:bg-indigo-100
                  text-indigo-700 font-bold py-2 rounded-lg transition
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
                <label className="block text-indigo-700 font-semibold mb-1">Training Type</label>
                <TrainingTypeDropdown trainingType={trainingType} setTrainingType={setTrainingType} />
                <div className="mt-2 flex items-center">
                  <button
                    type="button"
                    className={`
                      flex items-center gap-1 text-xs font-medium focus:outline-none hover:underline
                      ${showRest ? "text-indigo-700" : "text-gray-600"}
                    `}
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
                    className="mt-2 p-3 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 animate-fade-in text-sm"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition bg-white"
                  value={goalTime}
                  onChange={(e) => setGoalTime(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className={`
                  w-full bg-indigo-50 hover:bg-indigo-100
                  text-indigo-700 font-bold py-2 rounded-lg transition
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
          )}
          {result && (
            <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-center animate-fade-in">
              {mode === "predict" ? (
                <>
                  <div className="text-indigo-800 text-lg font-medium">Predicted 800m Time:</div>
                  <div className="text-2xl font-bold text-indigo-700 mt-2">
                    {result.predicted_formatted}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-indigo-800 text-lg font-medium">Recommended Splits:</div>
                  <ul className="mt-2 space-y-1">
                    {Array.isArray(result)
                      ? result.map((split, i) => (
                          <li key={i} className="text-indigo-700">
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