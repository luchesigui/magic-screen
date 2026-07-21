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
          <ScoreRing
            label="Distance"
            value={active.breakdown.distance}
            delta={
              selected > 0
                ? active.breakdown.distance - rec.best.breakdown.distance
                : undefined
            }
          />
          <ScoreRing
            label="Centering"
            value={active.breakdown.centering}
            delta={
              selected > 0
                ? active.breakdown.centering - rec.best.breakdown.centering
                : undefined
            }
          />
          <ScoreRing
            label="Sound"
            value={active.breakdown.sound}
            delta={
              selected > 0
                ? active.breakdown.sound - rec.best.breakdown.sound
                : undefined
            }
          />
        </div>
      </section>

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

      <details className="card explainer">
        <summary>How the scoring works</summary>
        <div className="explainer-body">
          <p>
            Every block of {partySize} free {partySize === 1 ? "seat" : "seats"}{" "}
            in a single row gets a score from 0 to 100. The score is pure
            geometry, worked out from where the seats sit relative to the screen
            and the center of the room. It doesn&rsquo;t measure the actual
            room; screen size, speakers, and audio format aren&rsquo;t in a seat
            map. It blends three criteria, three angles on the same
            &ldquo;center, about two-thirds back&rdquo; sweet spot:
          </p>
          <p>
            <strong>Distance · 40%</strong>: Peaks at about 62% of the way back.
            That row puts the screen at the ~36° viewing angle THX recommends,
            wide enough to feel immersive without forcing your eyes to scan.
            Sitting too close is penalized harder than too far, because steep
            upward gaze angles cause neck strain.
          </p>
          <p>
            <strong>Centering · 35%</strong>: How close the middle of the block
            is to the screen's center line. A straight-on view keeps the image
            geometry undistorted and both speakers equally distant.
          </p>
          <p>
            <strong>Sound · 25%</strong>: Cinema audio is mixed and calibrated
            for a reference listening position: center, about two thirds back.
            This rewards how close your seats sit to that spot. It&rsquo;s an
            estimate from your position, not a check of the actual room&rsquo;s
            speakers or format (Atmos, IMAX and the like aren&rsquo;t visible in
            a seat map).
          </p>
          <p>
            Because all three read the same position, a great seat tends to
            score well on all of them. Blocks that span an aisle (when no row
            fits everyone side by side) lose 10% of their total. Tap an option
            to see how each criterion compares to the top pick.
          </p>
        </div>
      </details>

      <button className="cta secondary" onClick={onReset}>
        Check another session
      </button>
    </div>
  );
}
