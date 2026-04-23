import { useMemo } from 'react';

type Direction = 'right' | 'left' | 'up' | 'down';

type Walker = {
  key: string;
  dir: Direction;
  lane: string;
  size: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
};

type Splitter = {
  key: string;
  x: string;
  y: string;
  size: number;
  delaySec: number;
  // clones fly off in these directions
  clones: { dx: number; dy: number; delayOffset: number }[];
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeWalkers(): Walker[] {
  const rand = seeded(7);
  const list: Walker[] = [];

  const horizontalLanes = [12, 28, 44, 58, 74, 88];
  horizontalLanes.forEach((y, i) => {
    const dir: Direction = i % 2 === 0 ? 'right' : 'left';
    list.push({
      key: `h-${i}`,
      dir,
      lane: `${y}%`,
      size: 18 + Math.floor(rand() * 16),
      durationSec: 28 + Math.floor(rand() * 24),
      delaySec: Math.floor(rand() * 20),
      opacity: 0.18 + rand() * 0.12
    });
  });

  const verticalLanes: { dir: Direction; x: string }[] = [
    { dir: 'up', x: '3%' },
    { dir: 'down', x: '96%' },
    { dir: 'up', x: '16%' },
    { dir: 'down', x: '84%' }
  ];
  verticalLanes.forEach((v, i) => {
    list.push({
      key: `v-${i}`,
      dir: v.dir,
      lane: v.x,
      size: 16 + Math.floor(rand() * 14),
      durationSec: 32 + Math.floor(rand() * 24),
      delaySec: Math.floor(rand() * 20),
      opacity: 0.16 + rand() * 0.1
    });
  });

  return list;
}

function makeSplitters(): Splitter[] {
  return [
    {
      key: 'split-1',
      x: '12%', y: '30%',
      size: 260,
      delaySec: 0,
      clones: [
        { dx: -90,  dy: -50, delayOffset: 0.1 },
        { dx: 110,  dy: -30, delayOffset: 0.2 },
        { dx: -70,  dy: 70,  delayOffset: 0.3 },
        { dx: 130,  dy: 80,  delayOffset: 0.45 }
      ]
    },
    {
      key: 'split-2',
      x: '78%', y: '72%',
      size: 300,
      delaySec: 4,
      clones: [
        { dx: 80,   dy: -60, delayOffset: 0.15 },
        { dx: -110, dy: -40, delayOffset: 0.25 },
        { dx: 70,   dy: 90,  delayOffset: 0.4 },
        { dx: -140, dy: 60,  delayOffset: 0.55 }
      ]
    }
  ];
}

export default function JungleDecor() {
  const walkers = useMemo(makeWalkers, []);
  const splitters = useMemo(makeSplitters, []);

  return (
    <div className="jungle" aria-hidden="true">
      {/* Ambient corner foliage */}
      <img src="/palm.png" alt="" className="deco deco-palm-tl" />
      <img src="/leaf.png" alt="" className="deco deco-leaf-tr" />
      <img src="/leaf.png" alt="" className="deco deco-leaf-bl" />
      <img src="/palm.png" alt="" className="deco deco-palm-br" />
      <img src="/leaf.png" alt="" className="deco deco-leaf-ml" />
      <img src="/leaf.png" alt="" className="deco deco-leaf-mr" />

      {/* Big background lizards that "split" into smaller clones */}
      {splitters.map((s) => (
        <div
          key={s.key}
          className="splitter"
          style={{
            left: s.x,
            top: s.y,
            ['--size' as string]: `${s.size}px`,
            ['--delay' as string]: `${s.delaySec}s`
          }}
        >
          <img src="/lizard.png" alt="" className="splitter-big" />
          {s.clones.map((c, i) => (
            <img
              key={i}
              src="/lizard.png"
              alt=""
              className="splitter-clone"
              style={{
                ['--dx' as string]: `${c.dx}px`,
                ['--dy' as string]: `${c.dy}px`,
                ['--offset' as string]: `${c.delayOffset}s`
              }}
            />
          ))}
        </div>
      ))}

      {/* Small walk-stop-walk lizards */}
      {walkers.map((w) => {
        const isHoriz = w.dir === 'right' || w.dir === 'left';
        const style: React.CSSProperties = {
          width: w.size,
          height: w.size,
          ['--dur' as string]: `${w.durationSec}s`,
          ['--delay' as string]: `-${w.delaySec}s`,
          ['--op' as string]: w.opacity
        };
        if (isHoriz) {
          (style as Record<string, string>).top = w.lane;
        } else {
          (style as Record<string, string>).left = w.lane;
        }
        return (
          <span key={w.key} className={`walker walker-${w.dir}`} style={style}>
            <img src="/lizard.png" alt="" />
          </span>
        );
      })}
    </div>
  );
}
