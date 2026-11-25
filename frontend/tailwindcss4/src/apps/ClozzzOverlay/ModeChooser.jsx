import React from "react";

/**
 * Post-unlock chooser: Display vs Remote vs Library.
 * Deep links that already imply a mode skip this screen.
 * On phones, Display is hidden — OBS/desktop keep the Display path.
 */
export default function ModeChooser({ catalog }) {
  const routines = catalog?.routines || [];

  return (
    <div className="clozzz-chooser">
      <div className="clozzz-chooser__shell">
        <p className="clozzz-chooser__eyebrow">Clozzz Sleep</p>
        <h1 className="clozzz-chooser__title">This device is…</h1>
        <p className="clozzz-chooser__lead">
          Unlock once per browser. OBS Browser Source keeps its own cookies —
          unlock there separately with Remember.
        </p>

        <div className="clozzz-chooser__modes">
          <a className="clozzz-chooser__card" href="/clozzz-overlay">
            <span className="clozzz-chooser__card-title">Library</span>
            <span className="clozzz-chooser__card-desc">
              Edit routines, then open Remote on your phone (Display stays on
              desktop / OBS).
            </span>
          </a>
        </div>

        <h2 className="clozzz-chooser__section">Pick a routine</h2>
        <ul className="clozzz-chooser__list">
          {routines.map((r) => (
            <li key={r.id} className="clozzz-chooser__item">
              <span className="clozzz-chooser__name">{r.title}</span>
              <span className="clozzz-chooser__actions">
                <a
                  className="clozzz-chooser__link clozzz-chooser__link--display"
                  href={`/clozzz-overlay/${encodeURIComponent(r.id)}`}
                >
                  Display
                </a>
                <a
                  className="clozzz-chooser__link clozzz-chooser__link--remote"
                  href={`/clozzz-overlay/${encodeURIComponent(r.id)}/remote`}
                >
                  Remote
                </a>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
