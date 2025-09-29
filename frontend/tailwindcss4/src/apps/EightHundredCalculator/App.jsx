import React, { useState, useEffect, useCallback, memo } from "react";
import './App.css'
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import translations from "../../translations";
import { useLocation, useNavigate } from "react-router-dom";

const SPLIT_FEATURES = {
  "600m_x3": 3,
  "500m_x3": 3,
  "600m_400m_x3": 4, 
  "600m_300m_x4": 5,  
  "300m_x3x2": 6,      
  "ladder": 6,
  "200m_x8": 8
};

const PLACEHOLDERS = {
  "600m_x3": ["1:36.0", "1:34.0", "1:32.0"],
  "600m_400m_x3": ["1:32.0", "1:03.5", "1:03.5", "1:03.5"],
  "600m_300m_x4": ["1:33.5", "46.5", "46.0", "45.5", "45.0"],
  "500m_x3": ["1:18.0", "1:17.0", "1:16.0"],
  "ladder": ["44.0", "59.0", "1:15.0", "60.0", "45.0", "28.0"],
  "300m_x3x2": ["47.0", "47.0", "47.0", "45.0", "45.0", "45.0"],
  "200m_x8": ["27.0", "27.0", "27.0", "27.0", "27.0", "27.0", "27.0", "27.0"],
};

// --- CHANGED: Updated API URL
const API_URL = "https://unified-backend.fly.dev/running";

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

const TrainingInputs = memo(({ trainingType, inputs, setInputs, inputAverages, t }) => {
  if (!trainingType) return null;
  const phArray = PLACEHOLDERS[trainingType.key] || [];

  // --- Special case: ladder ---
  if (trainingType.key === "ladder") {
    if (inputAverages) {
      return (
        <>
          {t.prompts.ladder.map((prompt, idx) => (
            <div key={`${trainingType.key}-avg-${idx}`}>
              {renderInput(
                prompt.average,
                phArray[idx] || t.defaultPlaceholder,
                inputs[idx] || "",
                (e) => {
                  const arr = [...inputs];
                  arr[idx] = e.target.value;
                  setInputs(arr);
                }
              )}
            </div>
          ))}
        </>
      );
    } else {
      // ... your splitOrder ladder case (unchanged) ...
    }
  }

  // --- General case ---
  if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
    if (inputAverages) {
      // Special handling for workouts with multiple average features
      if (["600m_400m_x3", "600m_300m_x4"].includes(trainingType.key)) {
        return (
          <>
            {[
              t.prompts[trainingType.key][0].average, // 600m average
              t.prompts[trainingType.key][1].average, // reps average
            ].map((label, idx) => (
              <div key={`${trainingType.key}-avg-${idx}`}>
                {renderInput(
                  label,
                  phArray[idx] || t.defaultPlaceholder,
                  inputs[idx] || "",
                  (e) => {
                    const arr = [...inputs];
                    arr[idx] = e.target.value;
                    setInputs(arr);
                  }
                )}
              </div>
            ))}
          </>
        );
      } else if (trainingType.key === "300m_x3x2") {
        return (
          <>
            {[
              t.prompts[trainingType.key][0].average, // Set1 avg
              t.prompts[trainingType.key][3].average, // Set2 avg
            ].map((label, idx) => (
              <div key={`${trainingType.key}-avg-${idx}`}>
                {renderInput(
                  label,
                  phArray[idx] || t.defaultPlaceholder,
                  inputs[idx] || "",
                  (e) => {
                    const arr = [...inputs];
                    arr[idx] = e.target.value;
                    setInputs(arr);
                  }
                )}
              </div>
            ))}
          </>
        );
      } else {
        // default: single average input
        return (
          <div key={`${trainingType.key}-average`}>
            {renderInput(
              t.prompts[trainingType.key][0].average,
              phArray[0] || t.defaultPlaceholder,
              inputs[0] || "",
              (e) => setInputs([e.target.value])
            )}
          </div>
        );
      }
    }

    // Split mode → show all splits
    return t.prompts[trainingType.key].map((prompt, idx) => (
      <div key={`${trainingType.key}-${idx}`}>
        {renderInput(
          prompt.split,
          phArray[idx] || t.defaultPlaceholder,
          inputs[idx] || "",
          (e) => {
            const arr = [...inputs];
            arr[idx] = e.target.value;
            setInputs(arr);
          }
        )}
      </div>
    ));
  }

  return null;
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, '0');
  if (minutes === 0) return `${secs}`;
  return `${minutes}:${secs}`;
}

function TrainingTypeDropdown({ trainingType, setTrainingType, trainingTypes }) {
  if (!trainingType) return null; // Add a guard clause
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
          {trainingTypes.map((type) => (
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

function LangButton({ lang }) {
  const location = useLocation();
  const navigate = useNavigate();
  const otherLang = lang === "zh" ? "en" : "zh";
  const newPath = location.pathname.replace(/^\/(en|zh)/, `/${otherLang}`);

  return (
    <button
      style={{
        position: "absolute", top: 14, right: 20,
        fontWeight: "bold", fontSize: 18, zIndex: 1000,
        background: "none", border: "none", cursor: "pointer"
      }}
      onClick={() => navigate(newPath + location.search)}
      aria-label={lang === "zh" ? "Switch to English" : "切換到繁體中文"}
    >
      {lang === "zh" ? "EN" : "繁"}
    </button>
  );
}


export default function App({ lang = "en" }) {
  const t = translations[lang] || translations.en;
  const [mode, setMode] = useState("predict");
  const [trainingTypes, setTrainingTypes] = useState([]); // Start with an empty array
  const [trainingType, setTrainingType] = useState(null); // Start with null
  const [inputs, setInputs] = useState([]);
  const [goalTime, setGoalTime] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRest, setShowRest] = useState(false);
  const [inputAverages, setInputAverages] = useState(false);

  // Fetch training types from the backend on component load
  useEffect(() => {
    const fetchTrainingTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/get-training-types`);
        if (!response.ok) {
          throw new Error('Could not fetch training types');
        }
        const backendTypes = await response.json();
        
        // Merge backend data with frontend translations
        const mergedTypes = backendTypes.map(backendType => {
          const frontendType = t.trainingTypes.find(ft => ft.key === backendType.key);
          return {
            ...backendType, // includes key, features, intervals from backend
            label: frontendType ? frontendType.label : backendType.key, // Use translated label if available
            rest: frontendType ? frontendType.rest : 'N/A', // Use translated rest info if available
          };
        });

        setTrainingTypes(mergedTypes);
        if (mergedTypes.length > 0) {
          setTrainingType(mergedTypes[0]); // Set the first available type as default
        }
      } catch (err) {
        setError(t.genericError);
        // Fallback to static types if API fails
        setTrainingTypes(t.trainingTypes);
        setTrainingType(t.trainingTypes[0]);
      }
    };

    fetchTrainingTypes();
  }, [lang, t.trainingTypes, t.genericError]);

  const supportsAverages = useCallback(() => {
    if (!trainingType) return false;
    return (
      typeof SPLIT_FEATURES[trainingType.key] === "number" ||
      Object.keys(SPLIT_FEATURES[trainingType.key] || {}).length > 0
    );
  }, [trainingType]);

  useEffect(() => {
    if (!trainingType) return; // Don't run if no training type is selected yet

    let defaultInputs;
    if (trainingType.key === "ladder") {
      if (inputAverages) {
        defaultInputs = ["", "", "", ""];
      } else {
        defaultInputs = ["", "", "", "", "", ""];
      }
    } else if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
      defaultInputs = Array(SPLIT_FEATURES[trainingType.key]).fill("");
    } else {
      defaultInputs = trainingType.features.map((f) => {
        const featureKey = typeof f === 'string' ? f : f.key;
        const splits = SPLIT_FEATURES[trainingType.key]?.[featureKey];
        if (splits && splits > 1) {
          return Array(splits).fill("");
        }
        return "";
      });
    }
    setInputs(defaultInputs);
    setResult(null);
    setError("");
    setInputAverages(false);
  }, [trainingType, mode]);

  const handleAveragesToggle = useCallback((e) => {
  const checked = e.target.checked;
  setInputAverages(checked);

  if (!trainingType) return;

  if (trainingType.key === "ladder") {
    if (checked) {
      // ladder averages: 300m avg, 400m avg, 500m, 200m
      setInputs(["", "", "", ""]);
    } else {
      // ladder splits: 6 parts
      setInputs(["", "", "", "", "", ""]);
    }
  }
  else if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
    if (checked) {
      if (["600m_400m_x3", "600m_300m_x4", "300m_x3x2"].includes(trainingType.key)) {
        // these require TWO average inputs
        setInputs(["", ""]);
      } else {
        // default: single average input (e.g. 3×600, 3×500, 8×200)
        setInputs([""]);
      }
    } else {
      // reset to full split inputs
      setInputs(Array(SPLIT_FEATURES[trainingType.key]).fill(""));
    }
  }
}, [trainingType]);

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");

    try {
      let input_values;

      if (trainingType.key === "ladder") {
        if (inputAverages) {
          // input order: 300m avg, 400m avg, 500m, 200m
          const avg300 = inputs[0] || "";
          const avg400 = inputs[1] || "";
          const s500 = inputs[2] || "";
          const s200 = inputs[3] || "";
          input_values = [avg300, avg400, s500, avg400, avg300, s200];
        } else {
          input_values = inputs.map((s) => s.trim());
        }
      }
      else if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
        if (inputAverages) {
          if (trainingType.key === "600m_400m_x3") {
            // two averages: 600m avg, 3×400m avg
            const avg600 = inputs[0] || "";
            const avg400 = inputs[1] || "";
            input_values = [avg600, avg400];
          }
          else if (trainingType.key === "600m_300m_x4") {
            // two averages: 600m avg, 4×300m avg
            const avg600 = inputs[0] || "";
            const avg300 = inputs[1] || "";
            input_values = [avg600, avg300];
          }
          else if (trainingType.key === "300m_x3x2") {
            // two averages: Set1 avg, Set2 avg
            const avgSet1 = inputs[0] || "";
            const avgSet2 = inputs[1] || "";
            input_values = [avgSet1, avgSet2];
          }
          else {
            // default: single average → repeat N times
            const avg = inputs[0] || "";
            const count = SPLIT_FEATURES[trainingType.key];
            input_values = Array(count).fill(avg);
          }
        } else {
          // Split mode (per rep)
          if (trainingType.key === "600m_400m_x3") {
            const sixHundred = inputs[0]?.trim() || "";
            const fourHundreds = inputs.slice(1, 4).map((s) => parseFloat(s) || 0);
            const avg400 = fourHundreds.length
              ? (fourHundreds.reduce((a, b) => a + b, 0) / fourHundreds.length).toFixed(2)
              : "";
            input_values = [sixHundred, avg400];
          }
          else if (trainingType.key === "600m_300m_x4") {
            const sixHundred = inputs[0]?.trim() || "";
            const threeHundreds = inputs.slice(1, 5).map((s) => parseFloat(s) || 0);
            const avg300 = threeHundreds.length
              ? (threeHundreds.reduce((a, b) => a + b, 0) / threeHundreds.length).toFixed(2)
              : "";
            input_values = [sixHundred, avg300];
          }
          else if (trainingType.key === "300m_x3x2") {
            const set1 = inputs.slice(0, 3).map((s) => parseFloat(s) || 0);
            const set2 = inputs.slice(3, 6).map((s) => parseFloat(s) || 0);
            const avgSet1 = set1.length
              ? (set1.reduce((a, b) => a + b, 0) / set1.length).toFixed(2)
              : "";
            const avgSet2 = set2.length
              ? (set2.reduce((a, b) => a + b, 0) / set2.length).toFixed(2)
              : "";
            input_values = [avgSet1, avgSet2];
          }
          else {
            input_values = inputs.map((s) => s.trim());
          }
        }
      }

      // --- Send to backend ---
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_type: trainingType.key,
          input_values,
        }),
      });

      if (!res.ok) {
        let errorDetail = t.predictionError;
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch (parseError) {}
        throw new Error(errorDetail);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err.message || t.genericError);
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
        let errorDetail = t.splitError;
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch (parseError) {}
        throw new Error(errorDetail);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || t.genericError);
    }
    setLoading(false);
  };

  return (
    <div className="calculator-app-wrapper" style={{ overflowY: 'auto' }}>
      <title>{t.metaTitle}</title>
      <meta name="description" content={t.metaDescription} />
      <link rel="canonical" href={t.metaUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={t.metaTitle} />
      <meta property="og:description" content={t.metaDescription} />
      <meta property="og:image" content={t.metaImage} />
      <meta property="og:url" content={t.metaUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={t.metaTitle} />
      <meta name="twitter:description" content={t.metaDescription} />
      <meta name="twitter:image" content={t.metaImage} />

      <LangButton lang={lang} />

      <div className="relative w-full">
        <header className="mb-6 text-center z-10 flex flex-col items-center">
          <h1 className="font-bold text-gray-900 mb-2 drop-shadow-none inline-block px-2
            text-base sm:text-lg md:text-xl lg:text-2xl tracking-tight max-w-[20rem] sm:max-w-[28rem] leading-tight
          ">
            {t.title}
          </h1>
          <p
            className="text-gray-500 text-sm sm:text-base md:text-lg px-2"
            style={{ width: "auto", maxWidth: "100%", display: "inline-block" }}
          >
            {t.description}
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
              {t.predictTab}
            </TabButton>
            <TabButton 
              modeVal="reverse" 
              currentMode={mode} 
              onClick={() => setMode("reverse")}
            >
              {t.reverseTab}
            </TabButton>
          </div>
          {mode === "predict" ? (
            <form onSubmit={handlePredict} className="space-y-6">
              <div className="mb-8">
                <label className="block text-indigo-700 font-semibold mb-1">{t.trainingType}</label>
                <TrainingTypeDropdown 
                  trainingType={trainingType}
                  setTrainingType={setTrainingType}
                  trainingTypes={trainingTypes}
                />
                {trainingType && (
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
                        {showRest ? t.hideTrainingInfo : t.showTrainingInfo}
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
                            {t.inputAverages}
                        </label>
                        </div>
                    )}
                    </div>
                )}
                {showRest && trainingType && (
                  <div
                    id="rest-info"
                    className="mt-2 p-3 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 animate-fade-in text-sm"
                  >
                    <div className="font-semibold mb-1">{t.restTimes}</div>
                    <div>{trainingType.rest}</div>
                  </div>
                )}
              </div>
              <TrainingInputs 
                trainingType={trainingType}
                inputs={inputs}
                setInputs={setInputs}
                inputAverages={inputAverages}
                t={t}
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
                {loading ? t.calculating : t.calculate}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReverse} className="space-y-6">
              <div className="mb-8">
                <label className="block text-indigo-700 font-semibold mb-1">{t.trainingType}</label>
                <TrainingTypeDropdown
                  trainingType={trainingType}
                  setTrainingType={setTrainingType}
                  trainingTypes={trainingTypes}
                />
                {trainingType && (
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
                        {showRest ? t.hideTrainingInfo : t.showTrainingInfo}
                    </button>
                    </div>
                )}
                {showRest && trainingType && (
                  <div
                    id="rest-info"
                    className="mt-2 p-3 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 animate-fade-in text-sm"
                  >
                    <div className="font-semibold mb-1">{t.restTimes}</div>
                    <div>{trainingType.rest}</div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t.goal800mTime}</label>
                <input
                  type="text"
                  placeholder={t.goalPlaceholder}
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
                {loading ? t.calculating : t.calculate}
              </button>
            </form>
          )}
          {result && (
            <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-center animate-fade-in">
              {mode === "predict" ? (
                <>
                  <div className="text-indigo-800 text-lg font-medium">{t.predictedTime}</div>
                  <div className="text-2xl font-bold text-indigo-700 mt-2">
                    {result.predicted_formatted}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-indigo-800 text-lg font-medium">{t.recommendedSplits}</div>
                  <ul className="mt-2 space-y-1">
                    {Array.isArray(result)
                      ? result.map((split, i) => (
                          <li key={i} className="text-indigo-700">
                            <span className="font-semibold">
                              {(t.splitLabels && t.splitLabels[split.interval]) ? t.splitLabels[split.interval] : split.interval}
                              {lang === "zh" ? "：" : ":"}
                            </span>{" "}
                            <span className="font-mono">
                              {formatTime(split.seconds)}
                            </span>
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
          {t.copyright}
        </footer>
      </div>
    </div>
  );
}