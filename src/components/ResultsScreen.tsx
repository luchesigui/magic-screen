import { useState } from "react";
import type { Recommendation, ScoredBlock, SeatMap } from "../lib/types";
import { ScoreRing } from "./ScoreRing";
import { SeatMapView } from "./SeatMapView";

interface Props {
  map: SeatMap;
  rec: Recommendation;
  partySize: number;
  onReset: () => void;
}

function seatRange(block: ScoredBlock): string {
  const seats = block.seats;
  if (seats.length === 1) return seats[0].id;
  return `${seats[0].id} – ${seats[seats.length - 1].id}`;
}

export function ResultsScreen({ map, rec, partySize, onReset }: Props) {
  const options = [rec.best, ...rec.alternatives];
  const [selected, setSelected] = useState(0);
  const active = options[selected];

  return (
    <div className="screen">
      <header className="large-title">
        <h1>Your seats</h1>
        <p>
          Best row for {partySize} {partySize === 1 ? "person" : "people"},
          science included.
        </p>
      </header>

      <div className="results-grid">
        <div className="results-map">
          <section className="card seatmap-card">
            <SeatMapView map={map} highlighted={active} />
          </section>

          <section className="card">
            <div className="result-header">
              <div>
                <div className="seats">{seatRange(active)}</div>
                <div className="row-note">Row {active.rowLabel}</div>
              </div>
              <div className="score-pill">{active.score}</div>
            </div>
            {active.split && (
              <p className="split-note">
                No row had {partySize} adjacent seats free, so this block spans a
                gap or aisle.
              </p>
            )}
            <div className="rings">
              <details className="ring-detail">
                <summary>
                  <ScoreRing
                    label="Distance · 40%"
                    value={active.breakdown.distance}
                    delta={
                      selected > 0
                        ? active.breakdown.distance - rec.best.breakdown.distance
                        : undefined
                    }
                  />
                </summary>
                <div className="ring-detail-body">
                  Peaks at about 62% of the way back. That row puts the screen
                  at the ~36° viewing angle THX recommends, wide enough to feel
                  immersive without forcing your eyes to scan. Sitting too close
                  is penalized harder than too far, because steep upward gaze
                  angles cause neck strain.
                </div>
              </details>
              <details className="ring-detail">
                <summary>
                  <ScoreRing
                    label="Centering · 35%"
                    value={active.breakdown.centering}
                    delta={
                      selected > 0
                        ? active.breakdown.centering - rec.best.breakdown.centering
                        : undefined
                    }
                  />
                </summary>
                <div className="ring-detail-body">
                  How close the middle of the block is to the screen&apos;s center
                  line. A straight-on view keeps the image geometry undistorted
                  and both speakers equally distant.
                </div>
              </details>
              <details className="ring-detail">
                <summary>
                  <ScoreRing
                    label="Sound · 25%"
                    value={active.breakdown.sound}
                    delta={
                      selected > 0
                        ? active.breakdown.sound - rec.best.breakdown.sound
                        : undefined
                    }
                  />
                </summary>
                <div className="ring-detail-body">
                  Cinema audio is mixed and calibrated for a reference listening
                  position: center, about two thirds back. This rewards how close
                  your seats sit to that spot. It&apos;s an estimate from your
                  position, not a check of the actual room&apos;s speakers or format
                  (Atmos, IMAX and the like aren&apos;t visible in a seat map).
                </div>
              </details>
            </div>
            <p className="split-note">
              Blocks that span an aisle lose 10% of their total. Tap an option to
              compare each criterion with the top pick.
            </p>
          </section>
        </div>

        <div className="results-side">
          {rec.alternatives.length > 0 && (
            <section className="card">
              <div className="card-label">Options</div>
              <div className="alt-list">
                {options.map((block, i) => (
                  <button
                    key={`${block.rowLabel}-${block.seats[0].id}`}
                    className="alt-row"
                    aria-pressed={i === selected}
                    onClick={() => setSelected(i)}
                  >
                    <span>
                      <span className="alt-seats">{seatRange(block)}</span>
                      <span className="alt-sub">
                        {i === 0 ? "Top pick" : `Alternative ${i}`} · Row{" "}
                        {block.rowLabel}
                      </span>
                    </span>
                    <span className="alt-score">{block.score}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <button className="cta secondary" onClick={onReset}>
            Check another session
          </button>
        </div>
      </div>
    </div>
  );
}
