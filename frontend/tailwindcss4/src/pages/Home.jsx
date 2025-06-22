export default function Home({ lang = "en" }) {
  // Build the correct path for the calculator based on language (default to 'en' if anything unexpected)
  const validLang = lang === "zh" ? "zh" : "en";
  const calculatorLink = `/${validLang}/800m-calculator`;
  const pokemonCalcLink = "/poke-team-predictor"; // Adjust if your route is different

  return (
    <>
      <title>Sean Fontaine | Portfolio & Web Apps</title>
      <meta
        name="description"
        content="Sean Fontaine's personal website and web app portfolio. Explore calculators and projects for athletes, developers, and more."
      />
      <link rel="canonical" href="https://www.seanfontaine.dev/" />
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #e0e7ff 0%, #f0fdfa 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
            borderRadius: "1.5rem",
            maxWidth: 480,
            width: "100%",
            padding: "2.5rem 2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5em", color: "#3730a3", fontWeight: 800 }}>
            Sean Fontaine
          </h1>
          <p style={{ fontSize: "1.2rem", marginBottom: "2rem", color: "#334155" }}>
            Welcome to my site! Explore my projects and web apps below.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "1.2rem" }}>
              <a
                href={calculatorLink}
                style={{
                  display: "inline-block",
                  background: "#6366f1",
                  color: "#fff",
                  padding: "0.75em 1.5em",
                  borderRadius: "0.75em",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  transition: "background 0.2s",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "#4338ca")}
                onMouseOut={e => (e.currentTarget.style.background = "#6366f1")}
              >
                800m Training & Race Calculator
              </a>
            </li>
            <li>
              <a
                href={pokemonCalcLink}
                style={{
                  display: "inline-block",
                  background: "#fbbf24",
                  color: "#374151",
                  padding: "0.75em 1.5em",
                  borderRadius: "0.75em",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  transition: "background 0.2s",
                  position: "relative",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "#f59e42")}
                onMouseOut={e => (e.currentTarget.style.background = "#fbbf24")}
              >
                Pokémon VGC Teammate Calculator
                <span
                  style={{
                    fontSize: "0.85em",
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "0.5em",
                    padding: "0.2em 0.6em",
                    fontWeight: 700,
                    marginLeft: "0.8em",
                    verticalAlign: "middle",
                  }}
                >
                  NEW
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}