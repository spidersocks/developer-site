import React, { useState } from "react";
import { rememberLastRoutineId } from "./Remote.jsx";

const OPEN_DISPLAY = "/clozzz-overlay";

function displayUrl() {
  if (typeof window === "undefined") return OPEN_DISPLAY;
  return `${window.location.origin}${OPEN_DISPLAY}`;
}

/**
 * Remote-only channel picker (post-unlock fallback).
 * Hard isolation: no links into routines/editor — open that URL deliberately.
 */
export default function ModeChooser({ catalog }) {
  const routines = catalog?.routines || [];
  const [copied, setCopied] = useState(false);

  async function copyObsLink() {
    const url = displayUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy OBS display URL", url);
    }
  }

  return (
    <div className="clozzz-chooser">
      <div className="clozzz-chooser__shell">
        <p className="clozzz-chooser__eyebrow">Clozzz Sleep</p>
        <h1 className="clozzz-chooser__title">Remote control</h1>
        <p className="clozzz-chooser__lead">
          Pick a channel. The OBS display follows it. Browser Source stays fixed
          at <code className="clozzz-chooser__code">{OPEN_DISPLAY}</code>.
        </p>

        <div className="clozzz-chooser__modes">
          <button
            type="button"
            className="clozzz-chooser__card clozzz-chooser__card--action"
            onClick={copyObsLink}
          >
            <span className="clozzz-chooser__card-title">
              {copied ? "Copied OBS link" : "Copy OBS display URL"}
            </span>
            <span className="clozzz-chooser__card-desc">
              Paste once into Browser Source. No password on the display.
            </span>
          </button>
        </div>

        <h2 className="clozzz-chooser__section">Pick a channel</h2>
        <ul className="clozzz-chooser__list">
          {routines.map((r) => (
            <li key={r.id} className="clozzz-chooser__item">
              <span className="clozzz-chooser__name">{r.title}</span>
              <span className="clozzz-chooser__actions">
                <a
                  className="clozzz-chooser__link clozzz-chooser__link--remote"
                  href={`/clozzz-remote/${encodeURIComponent(r.id)}`}
                  onClick={() => rememberLastRoutineId(r.id)}
                >
                  Open
                </a>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
