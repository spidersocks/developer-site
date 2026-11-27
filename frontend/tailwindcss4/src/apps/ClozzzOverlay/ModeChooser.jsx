import React from "react";
import { rememberLastRoutineId } from "./Remote.jsx";

/**
 * Remote-only channel picker (post-unlock fallback).
 * OBS copy lives on the routines library footer — not here.
 */
export default function ModeChooser({ catalog }) {
  const routines = catalog?.routines || [];

  return (
    <div className="clozzz-chooser">
      <div className="clozzz-chooser__shell">
        <p className="clozzz-chooser__eyebrow">Clozzz Sleep</p>
        <h1 className="clozzz-chooser__title">Remote control</h1>
        <p className="clozzz-chooser__lead">
          Pick a channel. The OBS display follows it.
        </p>

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
