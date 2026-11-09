import { useRef, useState } from 'react';
import { LBG_VALUES } from '../data';

type Props = {
  onAllViewed: () => void;
};

// Approximate centres of each icon on the 1024×724 values poster (percent of width / height).
// Each hotspot covers the icon and its title so the whole value is tappable.
const HOTSPOTS = [
  { x: 9.5, y: 22 },
  { x: 27.1, y: 22 },
  { x: 45.4, y: 22 },
  { x: 65.2, y: 22 },
  { x: 84.5, y: 22 },
];

export function ValuesExplorer({ onAllViewed }: Props) {
  const [index, setIndex] = useState(0);
  const [viewed, setViewed] = useState<number[]>([0]);
  const [direction, setDirection] = useState<1 | -1>(1);
  const touchX = useRef<number | null>(null);
  const value = LBG_VALUES[index];

  const go = (next: number) => {
    const clamped = (next + LBG_VALUES.length) % LBG_VALUES.length;
    setDirection(clamped > index || (index === LBG_VALUES.length - 1 && clamped === 0) ? 1 : -1);
    setIndex(clamped);
    if (!viewed.includes(clamped)) {
      const updated = [...viewed, clamped];
      setViewed(updated);
      if (updated.length === LBG_VALUES.length) onAllViewed();
    }
  };

  const allViewed = viewed.length === LBG_VALUES.length;
  const next = LBG_VALUES[(index + 1) % LBG_VALUES.length];

  return (
    <section className="values-explorer" aria-label="Explore the five LBG values">
      <div className="poster-wrap">
        <img
          className="values-poster"
          src="/lbg-values.png"
          alt="The five LBG values: People-first, Bold, Inclusive, Sustainable and Trust"
          draggable={false}
        />
        {LBG_VALUES.map((v, i) => (
          <button
            key={v.id}
            className={`hotspot${i === index ? ' selected' : ''}${viewed.includes(i) ? ' seen' : ''}`}
            style={{
              left: `${HOTSPOTS[i].x}%`,
              top: `${HOTSPOTS[i].y}%`,
              ['--v' as string]: v.colour,
            }}
            onClick={() => go(i)}
            aria-pressed={i === index}
            aria-label={`${v.name}: ${v.tagline}`}
          >
            <span className="hotspot-ring" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="value-tabs" role="tablist" aria-label="Values">
        {LBG_VALUES.map((v, i) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={i === index}
            className={i === index ? 'value-tab active' : 'value-tab'}
            style={{ ['--v' as string]: v.colour }}
            onClick={() => go(i)}
          >
            {v.name}
          </button>
        ))}
      </div>

      <article
        key={value.id}
        className={`value-detail ${direction === 1 ? 'from-right' : 'from-left'}`}
        style={{ ['--v' as string]: value.colour }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="value-count">
          Value {index + 1} of {LBG_VALUES.length}
        </p>
        <h3>{value.name}</h3>
        <p className="value-tagline">{value.tagline}</p>
        <p className="value-behaviour">{value.behaviour}</p>
        <div className="value-opposite-box">
          <p className="eyebrow">The opposite is</p>
          <p>{value.opposite}</p>
        </div>
      </article>

      <div className="value-nav">
        <button className="btn ghost" onClick={() => go(index - 1)} aria-label="Previous value">
          ‹ Previous
        </button>
        <div className="dots" aria-hidden="true">
          {LBG_VALUES.map((v, i) => (
            <span key={v.id} className={i === index ? 'on' : viewed.includes(i) ? 'seen' : ''} />
          ))}
        </div>
        {index < LBG_VALUES.length - 1 ? (
          <button className="btn primary" onClick={() => go(index + 1)}>
            Next: {next.name} ›
          </button>
        ) : (
          <span className="ok">{allViewed ? 'All five explored' : 'Keep going'}</span>
        )}
      </div>
    </section>
  );
}
