import React, { useState, useEffect } from 'react';

export const ILLUSTRATION_PRESETS = [
  { value: 'spiral_notebook', label: 'Spiral Notebook' },
  { value: 'hardbound_register', label: 'Hardbound Register (A4)' },
  { value: 'stickers_craft', label: 'Stickers & Craft Sheet' },
  { value: 'pen_set', label: 'Ball / Gel Pen Pack' },
  { value: 'roller_pen', label: 'Fine Roller Pen' },
  { value: 'gift_pen', label: 'Executive Gift Pen' },
  { value: 'pencil_box', label: 'Graphite Pencil Pack' },
  { value: 'watercolor_set', label: 'Watercolour & Paint Set' },
  { value: 'sketchbook', label: 'Artist Drawing Pad / Sketchbook' },
  { value: 'geometry_box', label: 'Mathematical Geometry Box' },
  { value: 'calculator', label: 'Desk / Scientific Calculator' },
  { value: 'file_folder', label: 'Office File & Folder' },
  { value: 'exam_pad', label: 'Exam Clipboard & Pad' },
  { value: 'practical_book', label: 'Lab Practical Notebook' },
];

interface ProductIllustrationProps {
  type?: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  colorTint?: string;
}

function resolveTintPalette(colorTint?: string): {
  primary: string;
  secondary: string;
  label: string;
  isMulti: boolean;
} | null {
  if (!colorTint) return null;
  const lower = colorTint.toLowerCase();
  if (lower.includes('black')) {
    return { primary: '#1F1C18', secondary: '#8C341B', label: 'BLACK INK', isMulti: false };
  }
  if (lower.includes('red')) {
    return { primary: '#DC2626', secondary: '#991B1B', label: 'RED INK', isMulti: false };
  }
  if (lower.includes('green')) {
    return { primary: '#15803D', secondary: '#166534', label: 'GREEN INK', isMulti: false };
  }
  if (lower.includes('assorted') || lower.includes('multi') || lower.includes('pastel')) {
    return { primary: '#C95939', secondary: '#8C341B', label: 'MULTI COLOUR', isMulti: true };
  }
  if (lower.includes('blue')) {
    return { primary: '#B44C2E', secondary: '#1F1C18', label: 'BLUE INK', isMulti: false };
  }
  return null;
}

const KNOWN_TYPES = new Set([
  'spiral_notebook',
  'stickers_craft',
  'hardbound_register',
  'pen_set',
  'roller_pen',
  'gift_pen',
  'ballpoint_pen',
  'pencil_box',
  'watercolor_set',
  'sketchbook',
  'drawing_book',
  'geometry_box',
  'calculator',
  'file_folder',
  'exam_pad',
  'practical_book',
  'notebook',
]);

export const ProductIllustration: React.FC<ProductIllustrationProps> = ({
  type = 'notebook',
  imageUrl,
  alt,
  className = 'w-full h-full',
  colorTint,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const tint = resolveTintPalette(colorTint);
  const resolvedType = KNOWN_TYPES.has(type) ? type : 'spiral_notebook';

  if (imageUrl && imageUrl.trim() !== '' && !imgError) {
    return (
      <div
        className={`relative overflow-hidden bg-[#FAF8F5]/80 flex items-center justify-center ${className}`}
      >
        <img
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        {tint && (
          <span
            className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full border border-white shadow-xs"
            style={{
              background: tint.isMulti
                ? 'conic-gradient(#B44C2E 0deg 90deg, #DC2626 90deg 180deg, #15803D 180deg 270deg, #1F1C18 270deg 360deg)'
                : tint.primary,
            }}
          />
        )}
      </div>
    );
  }

  const multiColors = ['#B44C2E', '#1F1C18', '#DC2626', '#15803D'];

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#FDF2ED]/75 via-[#FFFDF9]/88 to-[#F4EDE4]/65 flex items-center justify-center select-none ${className}`}
      role="img"
      aria-label={alt}
    >
      <svg
        className="w-full h-full p-3 sm:p-4"
        viewBox="0 0 240 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="120" cy="154" rx="68" ry="8" fill="#E8D8CC" opacity="0.55" />

        {resolvedType === 'spiral_notebook' && (
          <g>
            <rect x="76" y="24" width="96" height="126" rx="5" fill="#1F1C18" />
            <rect
              x="68"
              y="28"
              width="96"
              height="126"
              rx="5"
              fill={tint ? tint.primary : '#B44C2E'}
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="80"
              y="42"
              width="72"
              height="34"
              rx="3"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.2"
            />
            <line x1="88" y1="53" x2="144" y2="53" stroke="#1F1C18" strokeWidth="1.5" />
            <line x1="88" y1="63" x2="128" y2="63" stroke="#D97757" strokeWidth="1.2" />
            <rect x="164" y="38" width="7" height="18" rx="2" fill="#818CF8" />
            <rect x="164" y="60" width="7" height="18" rx="2" fill="#D97757" />
            <rect x="164" y="82" width="7" height="18" rx="2" fill="#C95939" />
            <rect x="164" y="104" width="7" height="18" rx="2" fill="#8C341B" />
            {[36, 48, 60, 72, 84, 96, 108, 120, 132, 144].map((y) => (
              <path
                key={y}
                d={`M63 ${y} H73`}
                stroke="#1F1C18"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
          </g>
        )}

        {resolvedType === 'stickers_craft' && (
          <g>
            <rect
              x="58"
              y="22"
              width="124"
              height="132"
              rx="8"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect x="58" y="22" width="124" height="22" rx="6" fill="#8C341B" />
            <text x="74" y="36" fill="#FFFFFF" fontSize="8.5" fontFamily="monospace" fontWeight="700">
              CRAFT STICKER PACK
            </text>
            {[
              { cx: 88, cy: 68, color: '#8C341B' },
              { cx: 120, cy: 68, color: '#4338CA' },
              { cx: 152, cy: 68, color: '#D97757' },
              { cx: 88, cy: 102, color: '#C95939' },
              { cx: 120, cy: 102, color: '#B44C2E' },
              { cx: 152, cy: 102, color: '#818CF8' },
            ].map((st, idx) => (
              <g key={idx}>
                <circle
                  cx={st.cx}
                  cy={st.cy}
                  r="13"
                  fill="#FDF2ED"
                  stroke="#E8D8CC"
                  strokeWidth="1"
                />
                <circle cx={st.cx} cy={st.cy} r="6" fill={st.color} />
              </g>
            ))}
            <rect
              x="74"
              y="128"
              width="92"
              height="14"
              rx="4"
              fill="#FDF2ED"
              stroke="#1F1C18"
              strokeWidth="1"
            />
            <text x="86" y="138" fill="#1F1C18" fontSize="8" fontFamily="monospace" fontWeight="600">
              GLOSS DIE-CUT · A5
            </text>
          </g>
        )}

        {resolvedType === 'hardbound_register' && (
          <g>
            <rect
              x="66"
              y="24"
              width="104"
              height="130"
              rx="4"
              fill="#1F1C18"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="66"
              y="24"
              width="18"
              height="130"
              fill={tint ? tint.primary : '#4338CA'}
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="96"
              y="46"
              width="60"
              height="38"
              rx="3"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.2"
            />
            <line x1="104" y1="58" x2="148" y2="58" stroke="#1F1C18" strokeWidth="1.5" />
            <line x1="104" y1="68" x2="140" y2="68" stroke="#D97757" strokeWidth="1.2" />
            <text x="104" y="128" fill="#E0E7FF" fontSize="9" fontFamily="monospace" fontWeight="600">
              240 PAGES · A4
            </text>
          </g>
        )}

        {(resolvedType === 'pen_set' ||
          resolvedType === 'roller_pen' ||
          resolvedType === 'gift_pen' ||
          resolvedType === 'ballpoint_pen') && (
          <g>
            <rect
              x="52"
              y="30"
              width="136"
              height="116"
              rx="8"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="52"
              y="30"
              width="136"
              height="24"
              rx="6"
              fill={tint ? tint.secondary : '#8C341B'}
            />
            <text x="64" y="46" fill="#FFFFFF" fontSize="8.5" fontFamily="monospace" fontWeight="700">
              {tint
                ? `PEN SET · ${tint.label}`
                : resolvedType === 'gift_pen'
                ? 'EXECUTIVE ROLLER'
                : 'PRECISION INK 0.7MM'}
            </text>
            {[74, 98, 122, 146].map((x, idx) => {
              const barrelFill = tint
                ? tint.isMulti
                  ? multiColors[idx % multiColors.length]
                  : tint.primary
                : ['#8C341B', '#4338CA', '#C95939', '#1F1C18'][idx % 4];
              return (
                <g key={x}>
                  <rect
                    x={x}
                    y="64"
                    width="12"
                    height="66"
                    rx="4"
                    fill={barrelFill}
                    stroke="#1F1C18"
                    strokeWidth="1.2"
                  />
                  <rect x={x + 2.5} y="68" width="2.5" height="22" rx="1" fill="#E8D8CC" />
                  <polygon
                    points={`${x},130 ${x + 12},130 ${x + 6},140`}
                    fill="#E0E7FF"
                    stroke="#1F1C18"
                    strokeWidth="1"
                  />
                  <circle cx={x + 6} cy="140" r="1.3" fill={barrelFill} />
                </g>
              );
            })}
          </g>
        )}

        {resolvedType === 'pencil_box' && (
          <g>
            <rect
              x="64"
              y="30"
              width="88"
              height="120"
              rx="6"
              fill="#1F1C18"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect x="64" y="46" width="88" height="32" fill="#4338CA" />
            <text x="74" y="66" fill="#FFFFFF" fontSize="11" fontFamily="monospace" fontWeight="700">
              SUPER DARK 2B
            </text>
            {[158, 169, 180].map((x, idx) => (
              <g key={x}>
                <rect
                  x={x}
                  y="44"
                  width="8"
                  height="104"
                  fill={idx === 0 ? '#D97757' : idx === 1 ? '#4338CA' : '#8C341B'}
                  stroke="#1F1C18"
                  strokeWidth="1.2"
                />
                <polygon
                  points={`${x},44 ${x + 8},44 ${x + 4},31`}
                  fill="#FDF2ED"
                  stroke="#1F1C18"
                  strokeWidth="1"
                />
                <polygon points={`${x + 2.5},36 ${x + 5.5},36 ${x + 4},31`} fill="#1F1C18" />
              </g>
            ))}
          </g>
        )}

        {(resolvedType === 'watercolor_set' || resolvedType === 'drawing_book') && (
          <g>
            <rect
              x="44"
              y="36"
              width="152"
              height="106"
              rx="8"
              fill="#E0E7FF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="52"
              y="44"
              width="136"
              height="90"
              rx="5"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.2"
            />
            {[
              '#1F1C18',
              '#8C341B',
              '#B44C2E',
              '#4338CA',
              '#C95939',
              '#D97757',
              '#818CF8',
              '#DEC6B6',
              '#DC2626',
              '#D97706',
              '#15803D',
              '#0284C7',
            ].map((color, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              return (
                <rect
                  key={color}
                  x={60 + col * 20}
                  y={54 + row * 26}
                  width="15"
                  height="18"
                  rx="3"
                  fill={color}
                  stroke="#1F1C18"
                  strokeWidth="1"
                />
              );
            })}
            <line
              x1="62"
              y1="120"
              x2="162"
              y2="120"
              stroke="#8C341B"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path d="M162 120 Q174 116 178 120 Q174 124 162 120Z" fill="#1F1C18" />
          </g>
        )}

        {resolvedType === 'sketchbook' && (
          <g>
            <rect
              x="46"
              y="38"
              width="148"
              height="108"
              rx="6"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="46"
              y="38"
              width="148"
              height="24"
              rx="4"
              fill="#B44C2E"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            {[58, 74, 90, 106, 122, 138, 154, 170, 182].map((x) => (
              <line
                key={x}
                x1={x}
                y1="33"
                x2={x}
                y2="43"
                stroke="#1F1C18"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
            <text x="60" y="88" fill="#1F1C18" fontSize="12" fontFamily="serif" fontWeight="700">
              140 GSM CARTRIDGE
            </text>
            <text x="60" y="106" fill="#C95939" fontSize="9" fontFamily="monospace">
              ACID-FREE DRAWING PAD · A3
            </text>
          </g>
        )}

        {resolvedType === 'geometry_box' && (
          <g>
            <rect
              x="44"
              y="42"
              width="152"
              height="96"
              rx="8"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect x="44" y="42" width="152" height="22" rx="6" fill="#8C341B" />
            <text x="56" y="57" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="600">
              MATHEMATICAL INSTRUMENTS
            </text>
            <polygon points="60,124 112,124 60,76" fill="#E0E7FF" stroke="#1F1C18" strokeWidth="1.3" />
            <path d="M122 124 A28 28 0 0 1 178 124 Z" fill="#FDF2ED" stroke="#1F1C18" strokeWidth="1.3" />
            <line x1="146" y1="74" x2="134" y2="118" stroke="#1F1C18" strokeWidth="2" />
            <line x1="146" y1="74" x2="158" y2="118" stroke="#1F1C18" strokeWidth="2" />
            <circle cx="146" cy="74" r="4" fill="#4338CA" />
          </g>
        )}

        {resolvedType === 'calculator' && (
          <g>
            <rect
              x="72"
              y="22"
              width="96"
              height="134"
              rx="8"
              fill="#1F1C18"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="82"
              y="34"
              width="76"
              height="26"
              rx="4"
              fill="#E0E7FF"
              stroke="#8C341B"
              strokeWidth="1.2"
            />
            <text x="102" y="52" fill="#1F1C18" fontSize="13" fontFamily="monospace" fontWeight="700">
              1,25,000
            </text>
            {[0, 1, 2, 3].map((row) =>
              [0, 1, 2, 3].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={82 + col * 19.5}
                  y={70 + row * 19}
                  width="15"
                  height="13"
                  rx="3"
                  fill={row === 3 && col === 3 ? '#C95939' : '#4338CA'}
                />
              ))
            )}
          </g>
        )}

        {(resolvedType === 'file_folder' ||
          resolvedType === 'exam_pad' ||
          resolvedType === 'practical_book' ||
          resolvedType === 'notebook') && (
          <g>
            <rect
              x="68"
              y="24"
              width="102"
              height="130"
              rx="5"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="68"
              y="24"
              width="20"
              height="130"
              fill={tint ? tint.primary : '#B44C2E'}
              stroke="#1F1C18"
              strokeWidth="1.5"
            />
            <rect
              x="100"
              y="42"
              width="54"
              height="28"
              rx="3"
              fill="#FFFFFF"
              stroke="#1F1C18"
              strokeWidth="1.2"
            />
            <line x1="106" y1="52" x2="146" y2="52" stroke="#1F1C18" strokeWidth="1.5" />
            <line x1="106" y1="61" x2="136" y2="61" stroke="#D97757" strokeWidth="1.2" />
            <circle cx="78" cy="134" r="5" fill="#FFFFFF" stroke="#1F1C18" strokeWidth="1.2" />
          </g>
        )}
      </svg>
    </div>
  );
};
