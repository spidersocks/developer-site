import React, { useState, useEffect, useCallback, memo } from "react";
import './App.css'
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import translations from "../../translations"; // <-- Make sure path is correct
import { useLocation, useNavigate } from "react-router-dom";

const SPLIT_FEATURES = {
  "600m_x3": 3,
  "500m_x3": 3,
  "600m_400m_x3": { "3x400m average": 3 },
  "600m_300m_x4": { "4x300m average": 4 },
  "300m_x3x2": { "Set 1 3x300m average": 3, "Set 2 3x300m average": 3 },
  "ladder": { "300m_avg": 2, "400m_avg": 2, "500m": 1, "200m": 1 },
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

const TrainingInputs = memo(({ trainingType, inputs, setInputs, inputAverages, t }) => {
  const phArray = PLACEHOLDERS[trainingType.key] || [];

  // Special handling for ladder training
  if (trainingType.key === "ladder") {
    if (inputAverages) {
      // Four input boxes: avg 300m, avg 400m, 500m, 200m
      return (
        <>
          {renderInput(
            t.prompts.ladder[0].average,
            phArray[0] || t.defaultPlaceholder,
            inputs[0] || "",
            (e) => setInputs(prev => [e.target.value, prev[1], prev[2], prev[3]])
          )}
          {renderInput(
            t.prompts.ladder[1].average,
            phArray[1] || t.defaultPlaceholder,
            inputs[1] || "",
            (e) => setInputs(prev => [prev[0], e.target.value, prev[2], prev[3]])
          )}
          {renderInput(
            t.prompts.ladder[2].average,
            phArray[2] || t.defaultPlaceholder,
            inputs[2] || "",
            (e) => setInputs(prev => [prev[0], prev[1], e.target.value, prev[3]])
          )}
          {renderInput(
            t.prompts.ladder[3].average,
            phArray[3] || t.defaultPlaceholder,
            inputs[3] || "",
            (e) => setInputs(prev => [prev[0], prev[1], prev[2], e.target.value])
          )}
        </>
      );
    } else {
      // Six input boxes, in race order
      const splitOrder = [
        { label: t.splitLabels["First 300m"] || "First 300m", ph: phArray[0] || t.defaultPlaceholder },
        { label: t.splitLabels["First 400m"] || "First 400m", ph: phArray[1] || t.defaultPlaceholder },
        { label: t.splitLabels["500m"] || "500m", ph: phArray[2] || t.defaultPlaceholder },
        { label: t.splitLabels["Second 400m"] || "Second 400m", ph: phArray[3] || t.defaultPlaceholder },
        { label: t.splitLabels["Second 300m"] || "Second 300m", ph: phArray[4] || t.defaultPlaceholder },
        { label: t.splitLabels["200m"] || "200m", ph: phArray[5] || t.defaultPlaceholder },
      ];
      return splitOrder.map((split, idx) => (
        renderInput(
          split.label,
          split.ph,
          inputs[idx] || "",
          (e) => setInputs(prev => {
            const arr = [...prev];
            arr[idx] = e.target.value;
            return arr;
          })
        )
      ));
    }
  }

  // --- Default logic for all other types ---
  const handleInputChange = useCallback((value, idx, splitIdx = null) => {
    setInputs((prev) => {
      const updatedInputs = [...prev];
      if (splitIdx !== null) {
        if (Array.isArray(updatedInputs[idx])) {
          if (updatedInputs[idx][splitIdx] === value) return prev;
          updatedInputs[idx] = [...updatedInputs[idx]];
          updatedInputs[idx][splitIdx] = value;
        } else {
          const numSplits = SPLIT_FEATURES[trainingType.key]?.[trainingType.features[idx]?.key];
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
  }, [trainingType]);

  if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
    if (inputAverages) {
      const labelObj = t.prompts[trainingType.key][0];
      const label = labelObj.average;
      return renderInput(
        label,
        phArray[0] || t.defaultPlaceholder,
        inputs[0] || "",
        (e) => handleInputChange(e.target.value, 0)
      );
    }
    return trainingType.features.map((feature, idx) => {
      const labelObj = t.prompts[trainingType.key][idx];
      const label = labelObj.split;
      return renderInput(
        label,
        phArray[idx] || t.defaultPlaceholder,
        inputs[idx] || "",
        (e) => handleInputChange(e.target.value, idx)
      );
    });
  }

  return trainingType.features.map((feature, idx) => {
    const labelObj = t.prompts[trainingType.key][idx];
    const label = inputAverages ? labelObj.average : labelObj.split;
    const splitConfig = SPLIT_FEATURES[trainingType.key] || {};
    const numSplits = splitConfig[feature.key] || 0;

    if (numSplits > 1 && !inputAverages) {
      return renderSplitInputs(
        label,
        phArray.slice(idx, idx + numSplits),
        Array.isArray(inputs[idx]) ? inputs[idx] : [],
        (value, splitIdx) => handleInputChange(value, idx, splitIdx)
      );
    } else {
      return renderInput(
        label,
        phArray[idx] || t.defaultPlaceholder,
        inputs[idx] || "",
        (e) => handleInputChange(e.target.value, idx)
      );
    }
  });
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, '0');
  if (minutes === 0) return `${secs}`;
  return `${minutes}:${secs}`;
}

function TrainingTypeDropdown({ trainingType, setTrainingType, trainingTypes }) {
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
  // Replace /en or /zh at the start of the path
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
  const [trainingTypes, setTrainingTypes] = useState(t.trainingTypes);
  const [trainingType, setTrainingType] = useState(t.trainingTypes[0]);
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

  // Update training type list and selected training type on language change
  useEffect(() => {
    setTrainingTypes(t.trainingTypes);
    setTrainingType(t.trainingTypes[0]);
  }, [lang]);

  useEffect(() => {
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
        const splits = SPLIT_FEATURES[trainingType.key]?.[f.key];
        return splits ? Array(splits).fill("") : "";
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
  
    if (trainingType.key === "ladder") {
      // Always reset to fresh array to avoid shape mismatches
      if (checked) {
        setInputs(["", "", "", ""]);
      } else {
        setInputs(["", "", "", "", "", ""]);
      }
    }
    else if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
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
          const splits = SPLIT_FEATURES[trainingType.key]?.[trainingType.features[idx].key];
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
  
      // Special handling for ladder training
      if (trainingType.key === "ladder") {
        if (inputAverages) {
          // [avg300m, avg400m, 500m, 200m] -> [avg300m, avg400m, 500m, avg400m, avg300m, 200m]
          const avg300 = inputs[0] || "";
          const avg400 = inputs[1] || "";
          const s500 = inputs[2] || "";
          const s200 = inputs[3] || "";
          input_values = [
            avg300,      // First 300m
            avg400,      // First 400m
            s500,        // 500m
            avg400,      // Second 400m
            avg300,      // Second 300m
            s200         // 200m
          ];
        } else {
          // Inputs are already in race order!
          input_values = [
            inputs[0] || "", // First 300m
            inputs[1] || "", // First 400m
            inputs[2] || "", // 500m
            inputs[3] || "", // Second 400m
            inputs[4] || "", // Second 300m
            inputs[5] || ""  // 200m
          ];
        }
      }
      // --- Other training types ---
      else if (typeof SPLIT_FEATURES[trainingType.key] === "number") {
        if (inputAverages) {
          const avg = inputs[0] || "";
          const count = SPLIT_FEATURES[trainingType.key]; // This will be 8 for 8x200m, 3 for 3x600, etc.
          input_values = Array(count).fill(avg);
        } else {
          input_values = inputs.map(s => s.trim());
        }
      } else {
        input_values = trainingType.features.map((f, idx) => {
          const splits = SPLIT_FEATURES[trainingType.key]?.[f.key];
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
    <>
      {/* Metadata */}
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

      <div className="relative min-h-screen w-full flex flex-col justify-between">
        <div className="fixed inset-0 bg-gray-50 -z-10" aria-hidden="true" />
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
                {showRest && (
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
                    {t.calculating}
                  </>
                ) : (
                  t.calculate
                )}
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
                {showRest && (
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
                    {t.calculating}
                  </>
                ) : (
                  t.calculate
                )}
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
    </>
  );
}