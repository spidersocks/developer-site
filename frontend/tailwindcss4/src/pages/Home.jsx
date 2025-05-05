import { Helmet } from "react-helmet-async";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Sean Fontaine | Portfolio & Web Apps</title>
        <meta
          name="description"
          content="Sean Fontaine's personal website and web app portfolio. Explore calculators and projects for athletes, developers, and more."
        />
        <link rel="canonical" href="https://www.seanfontaine.dev/" />
      </Helmet>
      <div style={{ padding: "2rem" }}>
        <h1>Sean Fontaine</h1>
        <p>Welcome to my site! Check out my projects:</p>
        <ul>
          <li>
            <a href="/800m-calculator">800m Training & Race Calculator</a>
          </li>
          {/* Add more links as you build more apps */}
        </ul>
      </div>
    </>
  );
}