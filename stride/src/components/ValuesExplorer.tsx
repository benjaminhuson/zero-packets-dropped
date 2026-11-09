import { useRef, useState } from 'react';
import { LBG_VALUES } from '../data';

type Props = {
  onAllViewed: () => void;
};

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
      <div className="icon-strip" role="tablist" aria-label="Choose a value">
        {LBG_VALUES.map((v, i) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={i === index}
            aria-label={`${v.name}: ${v.tagline}`}
            className={`icon-btn${i === index ? ' selected' : ''}${viewed.includes(i) ? ' seen' : ''}`}
            style={{ ['--v' as string]: v.colour }}
            onClick={() => go(i)}
          >
            <img src={`/values/icon-${i + 1}.png`} alt="" draggable={false} />
            <span className="icon-name">{v.name}</span>
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
