export default function Home({ lang = "en" }) {
  // Build the correct path for the calculator based on language (default to 'en' if anything unexpected)
  const validLang = lang === "zh" ? "zh" : "en";
  const calculatorLink = `/${validLang}/800m-calculator`;

  return (
    <>
      <title>Sean Fontaine | Portfolio & Web Apps</title>
      <meta
        name="description"
        content="Sean Fontaine's personal website and web app portfolio. Explore calculators and projects for athletes, developers, and more."
      />
      <link rel="canonical" href="https://www.seanfontaine.dev/" />
      <div style={{ padding: "2rem" }}>
        <h1>Sean Fontaine</h1>
        <p>Welcome to my site! Check out my projects:</p>
        <ul>
          <li>
            <a href={calculatorLink}>800m Training & Race Calculator</a>
          </li>
          {/* Add more links as you build more apps */}
        </ul>
      </div>
    </>
  );
}