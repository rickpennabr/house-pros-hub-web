'use client';

/**
 * A top-down plan of a typical US lot: block walls on the back and both sides, open to the street in
 * front, the house in the middle with side yards. Tap a zone to pick it (backyard, sides, front).
 */
/** White box with a black check, drawn left of a picked zone's label. */
function CheckMark({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width="14" height="14" rx="2.5" fill="#fff" />
      <path d={`M${x + 3.2} ${y + 7.2}l2.6 2.6 5-5.4`} fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function PropertyPlanPicker({ value, onPick }: { value: string; onPick: (key: string) => void }) {
  const zone = (key: string) => {
    const on = value === key;
    return {
      props: {
        role: 'button' as const,
        tabIndex: 0,
        'aria-pressed': on,
        onClick: () => onPick(key),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick(key);
          }
        },
        className: 'cursor-pointer outline-none [&:focus-visible>rect]:stroke-red-600',
      },
      fill: on ? '#000' : '#fff',
      text: on ? '#fff' : '#111',
    };
  };

  const back = zone('back');
  const left = zone('left');
  const right = zone('right');
  const front = zone('front');

  return (
    <svg viewBox="0 0 320 334" className="mx-auto block w-full max-w-md select-none" aria-label="Property plan: tap an area">
      {/* Block walls: back and both sides. */}
      <path d="M8 236 V8 H312 V236" fill="none" stroke="#6b7280" strokeWidth="8" strokeDasharray="10 3" />

      {/* Backyard */}
      <g {...back.props}>
        <rect x="16" y="16" width="288" height="92" rx="8" fill={back.fill} stroke="#000" strokeWidth="2" />
        <text x="160" y="66" textAnchor="middle" fontSize="15" fontWeight="600" fill={back.text}>Backyard</text>
        {value === 'back' ? <CheckMark x={104} y={55} /> : null}
      </g>

      {/* Left side yard */}
      <g {...left.props}>
        <rect x="16" y="116" width="58" height="120" rx="8" fill={left.fill} stroke="#000" strokeWidth="2" />
        <text x="45" y="176" textAnchor="middle" fontSize="12" fontWeight="600" fill={left.text} transform="rotate(-90 45 176)">
          Left side
        </text>
        {value === 'left' ? (
          <g transform="rotate(-90 45 176)">
            <CheckMark x={45 - 44} y={176 - 11} />
          </g>
        ) : null}
      </g>

      {/* House */}
      <rect x="82" y="116" width="156" height="120" rx="6" fill="#e5e7eb" stroke="#6b7280" strokeWidth="2" />
      <path d="M160 140 L132 162 H140 V196 H180 V162 H188 Z" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinejoin="round" />
      <text x="160" y="220" textAnchor="middle" fontSize="11" fill="#4b5563">House</text>

      {/* Right side yard */}
      <g {...right.props}>
        <rect x="246" y="116" width="58" height="120" rx="8" fill={right.fill} stroke="#000" strokeWidth="2" />
        <text x="275" y="176" textAnchor="middle" fontSize="12" fontWeight="600" fill={right.text} transform="rotate(90 275 176)">
          Right side
        </text>
        {value === 'right' ? (
          <g transform="rotate(90 275 176)">
            <CheckMark x={275 - 47} y={176 - 11} />
          </g>
        ) : null}
      </g>


      {/* Front: open, no wall. */}
      <g {...front.props}>
        <rect x="16" y="244" width="288" height="86" rx="8" fill={front.fill} stroke="#000" strokeWidth="2" />
        <text x="160" y="292" textAnchor="middle" fontSize="15" fontWeight="600" fill={front.text}>Front</text>
        {value === 'front' ? <CheckMark x={120} y={281} /> : null}
      </g>
    </svg>
  );
}
