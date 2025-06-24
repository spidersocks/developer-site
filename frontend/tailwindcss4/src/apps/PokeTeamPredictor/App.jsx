import React, { useState, useEffect } from "react";
import "./App.css";

const API_URL = "https://poke-team-predictor.onrender.com/predict-teammates";

// Fetches the correct sprite for a Pokemon from PokeAPI
// With consideration for special forms

async function fetchSpriteUrl(pokeName) {
  const FALLBACKS = {
    "ogerpon-cornerstone": "ogerpon-cornerstone-mask",
    "ogerpon-hearthflame": "ogerpon-hearthflame-mask",
    "ogerpon-wellspring":  "ogerpon-wellspring-mask",
    "ogerpon":             "ogerpon-teal-mask",
    "landorus":            "landorus-incarnate",
    "tornadus":            "tornadus-incarnate",
    "thundurus":           "thundurus-incarnate",
    "enamorus":            "enamorus-incarnate",
    "urshifu":             "urshifu-single-strike",
    "indeedee-f":          "indeedee-female",
    "giratina":            "giratina-altered",
  };

  const base = pokeName.toLowerCase().replace(/ /g, "-").replace(/[’']/g, "");
  const attempts = [];
  if (base in FALLBACKS) attempts.push(FALLBACKS[base]);
  attempts.push(base, base.split("-")[0]);

  for (let attempt of attempts) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${attempt}`);
      if (!res.ok) continue;
      const data = await res.json();
      const sprite =
        data.sprites.front_default ||
        (data.sprites.other &&
          data.sprites.other["official-artwork"] &&
          data.sprites.other["official-artwork"].front_default);
      if (sprite) return sprite;
    } catch {}
  }
  // Transparent fallback
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";
}

// Converts a Pokémon name to the correct Pikalytics VGC 2025 Regulation I URL.
//Example: "Calyrex-Ice" -> "https://www.pikalytics.com/pokedex/gen9vgc2025regi/calyrex-ice"

function toPikalyticsUrl(name) {
  return (
    "https://www.pikalytics.com/pokedex/gen9vgc2025regi/" +
    name
      .toLowerCase()
      .replace(/[\s.']/g, "-")    // spaces, dots, apostrophes to dash
      .replace(/[^a-z0-9-]/g, "") // remove anything that's not alphanumeric or dash
  );
}

export default function PokeTeamPredictorApp() {
  const [pokemonList] = useState([
    "Mewtwo","Lugia","Ho-Oh","Kyogre","Groudon","Rayquaza","Dialga","Dialga-Origin","Palkia","Palkia-Origin",
    "Giratina","Giratina-Origin","Reshiram","Zekrom","Kyurem","Kyurem-White","Kyurem-Black","Cosmog","Cosmoem",
    "Solgaleo","Lunala","Necrozma","Necrozma-Dusk-Mane","Necrozma-Dawn-Wings","Zacian","Zacian-Crowned",
    "Zamazenta","Zamazenta-Crowned","Eternatus","Calyrex","Calyrex-Ice","Calyrex-Shadow","Koraidon","Miraidon",
    "Terapagos"
  ]);
  const [core1, setCore1] = useState("Calyrex-Ice");
  const [core2, setCore2] = useState("Miraidon");
  const [core1Img, setCore1Img] = useState("");
  const [core2Img, setCore2Img] = useState("");
  const [loading, setLoading] = useState(false);
  const [teammates, setTeammates] = useState([]);
  const [error, setError] = useState("");

  // Fetch sprite for core1 when it changes
  useEffect(() => {
    let ignore = false;
    fetchSpriteUrl(core1).then(url => {
      if (!ignore) setCore1Img(url);
    });
    return () => { ignore = true; };
  }, [core1]);

  // Fetch sprite for core2 when it changes
  useEffect(() => {
    let ignore = false;
    fetchSpriteUrl(core2).then(url => {
      if (!ignore) setCore2Img(url);
    });
    return () => { ignore = true; };
  }, [core2]);

  // Handle prediction request
  async function handlePredict(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTeammates([]);
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core1, core2 })
      });
      if (!resp.ok) throw new Error("Prediction failed. Please try again.");
      const data = await resp.json();
      setTeammates(data);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }

  function toPercent(p) {
    return (p * 100).toFixed(1) + "%";
  }

  return (
    <div className="poke-bg">
      <div className="min-h-screen flex justify-center items-start">
        <div className="max-w-4xl w-full mx-auto py-10 px-4 bg-white/60 backdrop-blur-md rounded-xl shadow-xl mt-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 text-indigo-700 text-center">
            Pokémon VGC Teammate Predictor
          </h1>

          {/* Centered dropdowns */}
          <form
            onSubmit={handlePredict}
            className="flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center mb-10"
            autoComplete="off"
          >
            <div className="flex flex-col items-center">
              <label className="block text-gray-700 mb-1 font-medium text-center">
                Core 1:
              </label>
              <select
                className="border rounded px-2 py-1 w-48 text-center"
                value={core1}
                onChange={e => setCore1(e.target.value)}
              >
                {pokemonList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-gray-700 mb-1 font-medium text-center">
                Core 2:
              </label>
              <select
                className="border rounded px-2 py-1 w-48 text-center"
                value={core2}
                onChange={e => setCore2(e.target.value)}
              >
                {pokemonList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </form>

          {/* Restricted Core display */}
          <div className="mb-8">
            <div className="text-lg font-semibold text-gray-700 mb-6 text-center">
              Restricted Core:
            </div>
            <div className="flex gap-6 items-center justify-center mb-6">
              <div className="flex flex-col items-center">
                <img
                  src={core1Img}
                  alt={core1}
                  className="w-28 h-28 object-contain"
                />
                <a
                  href={toPikalyticsUrl(core1)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-800 font-medium mt-2 text-center hover:underline hover:text-indigo-700 transition"
                  style={{ display: "block" }}
                >
                  {core1}
                </a>
              </div>
              <span className="text-2xl font-bold text-gray-500">+</span>
              <div className="flex flex-col items-center">
                <img
                  src={core2Img}
                  alt={core2}
                  className="w-28 h-28 object-contain"
                />
                <a
                  href={toPikalyticsUrl(core2)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-800 font-medium mt-2 text-center hover:underline hover:text-indigo-700 transition"
                  style={{ display: "block" }}
                >
                  {core2}
                </a>
              </div>
            </div>
            {/* Centered, larger transparent button below core images */}
            <div className="flex justify-center">
              <button
                type="button"
                className={`poke-transparent-btn text-black border border-black
                  font-bold py-3 px-10 text-lg rounded-lg shadow hover:bg-gray-200 
                  hover:text-black transition duration-150
                  ${loading ? "opacity-70" : ""}
                `}
                onClick={handlePredict}
                disabled={loading}
                style={{ fontSize: "1.25rem"}}
              >
                {loading ? "Predicting..." : "Predict Teammates"}
              </button>
            </div>
          </div>

          {/* Prediction Results */}
          {error && <div className="text-red-600 font-semibold mb-5 text-center">{error}</div>}

          {teammates.length > 0 && (
            <>
              <div className="text-lg font-semibold text-gray-700 mb-3 mt-8 text-center">
                Predicted Teammates:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 justify-items-center">
                {teammates.map(tm => (
                  <div key={tm.Teammate} className="flex flex-col items-center">
                    <img
                      src={tm.sprite_url}
                      alt={tm.Teammate}
                      className="w-20 h-20 object-contain mb-2 rounded-lg"
                      loading="lazy"
                    />
                    <a
                      href={toPikalyticsUrl(tm.Teammate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-800 text-center text-sm hover:underline hover:text-indigo-700 transition"
                      style={{ display: "block" }}
                    >
                      {tm.Teammate.replace(/-/g, " ")}
                    </a>
                    <div className="text-indigo-700 font-bold text-sm">
                      {toPercent(tm["Predicted Probability"] ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}