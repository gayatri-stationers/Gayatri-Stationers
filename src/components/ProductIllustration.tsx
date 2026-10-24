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
    return { primary: '#18181B', secondary: '#3F3F46', label: 'BLACK INK', isMulti: false };
  }
  if (lower.includes('red')) {
    return { primary: '#DC2626', secondary: '#991B1B', label: 'RED INK', isMulti: false };
  }
  if (lower.includes('green')) {
    return { primary: '#16A34A', secondary: '#065F46', label: 'GREEN INK', isMulti: false };
  }
  if (lower.includes('assorted') || lower.includes('multi') || lower.includes('pastel')) {
    return { primary: '#7C3AED', secondary: '#DB2777', label: 'MULTI COLOUR', isMulti: true };
  }
  if (lower.includes('blue')) {
    return { primary: '#1D4ED8', secondary: '#1E3A8A', label: 'BLUE INK', isMulti: false };
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
      <div className={`relative overflow-hidden bg-[#F8FAFC] flex items-center justify-center ${className}`}>
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
                ? 'conic-gradient(#1D4ED8 0deg 90deg, #DC2626 90deg 180deg, #16A34A 180deg 270deg, #18181B 270deg 360deg)'
                : tint.primary,
            }}
          />
        )}
      </div>
    );
  }

  const multiColors = ['#1D4ED8', '#18181B', '#DC2626', '#16A34A'];

  return (
    <div
      className={`relative overflow-hidden bg-[#F8FAFC] flex items-center justify-center select-none ${className}`}
      role="img"
      aria-label={alt}
    >
      <svg className="w-full h-full p-3 sm:p-4" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="240" height="180" rx="4" fill="#F8FAFC" />
        <ellipse cx="120" cy="154" rx="68" ry="8" fill="#E2E8F0" />

        {resolvedType === 'spiral_notebook' && (
          <g>
            <rect x="76" y="24" width="96" height="126" rx="3" fill="#1E293B" />
            <rect
              x="68"
              y="28"
              width="96"
              height="126"
              rx="3"
              fill={tint ? tint.primary : '#B42318'}
              stroke="#18181B"
              strokeWidth="1.5"
            />
            <rect x="80" y="42" width="72" height="34" rx="2" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.2" />
            <line x1="88" y1="53" x2="144" y2="53" stroke="#18181B" strokeWidth="1.5" />
            <line x1="88" y1="63" x2="128" y2="63" stroke="#71717A" strokeWidth="1.2" />
            <rect x="164" y="38" width="7" height="18" rx="1" fill="#D97706" />
            <rect x="164" y="60" width="7" height="18" rx="1" fill="#0F766E" />
            <rect x="164" y="82" width="7" height="18" rx="1" fill="#1D4ED8" />
            <rect x="164" y="104" width="7" height="18" rx="1" fill="#4338CA" />
            {[36, 48, 60, 72, 84, 96, 108, 120, 132, 144].map((y) => (
              <path
                key={y}
                d={`M63 ${y} H73`}
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
          </g>
        )}

        {resolvedType === 'stickers_craft' && (
          <g>
            <rect x="58" y="22" width="124" height="132" rx="6" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <rect x="58" y="22" width="124" height="22" rx="4" fill="#B42318" />
            <text x="74" y="36" fill="#FFFFFF" fontSize="8.5" fontFamily="monospace" fontWeight="700">
              CRAFT STICKER PACK
            </text>
            {[
              { cx: 88, cy: 68, color: '#E11D48' },
              { cx: 120, cy: 68, color: '#DB2777' },
              { cx: 152, cy: 68, color: '#EA580C' },
              { cx: 88, cy: 102, color: '#D97706' },
              { cx: 120, cy: 102, color: '#E11D48' },
              { cx: 152, cy: 102, color: '#7C3AED' },
            ].map((st, idx) => (
              <g key={idx}>
                <circle cx={st.cx} cy={st.cy} r="13" fill="#FFFFFF" stroke="#D4D4D8" strokeWidth="1" />
                <path
                  d={`M ${st.cx} ${st.cy + 6} C ${st.cx - 9} ${st.cy} ${st.cx - 9} ${st.cy - 8} ${st.cx} ${st.cy - 3} C ${st.cx + 9} ${st.cy - 8} ${st.cx + 9} ${st.cy} ${st.cx} ${st.cy + 6} Z`}
                  fill={st.color}
                />
              </g>
            ))}
            <rect x="74" y="128" width="92" height="14" rx="3" fill="#F1F5F9" stroke="#18181B" strokeWidth="1" />
            <text x="86" y="138" fill="#18181B" fontSize="8" fontFamily="monospace" fontWeight="600">
              GLOSS DIE-CUT · A5
            </text>
          </g>
        )}

        {resolvedType === 'hardbound_register' && (
          <g>
            <rect x="66" y="24" width="104" height="130" rx="2" fill="#1E293B" stroke="#18181B" strokeWidth="1.5" />
            <rect
              x="66"
              y="24"
              width="18"
              height="130"
              fill={tint ? tint.primary : '#991B1B'}
              stroke="#18181B"
              strokeWidth="1.5"
            />
            <path d="M156 24 H170 V38 L156 24Z" fill={tint ? tint.primary : '#991B1B'} />
            <path d="M156 154 H170 V140 L156 154Z" fill={tint ? tint.primary : '#991B1B'} />
            <rect x="96" y="46" width="60" height="38" rx="2" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.2" />
            <line x1="104" y1="58" x2="148" y2="58" stroke="#18181B" strokeWidth="1.5" />
            <line x1="104" y1="68" x2="140" y2="68" stroke="#71717A" strokeWidth="1.2" />
            <text x="104" y="128" fill="#E2E8F0" fontSize="9" fontFamily="monospace" fontWeight="600">
              240 PAGES · A4
            </text>
          </g>
        )}

        {(resolvedType === 'pen_set' ||
          resolvedType === 'roller_pen' ||
          resolvedType === 'gift_pen' ||
          resolvedType === 'ballpoint_pen') && (
          <g>
            <rect x="52" y="30" width="136" height="116" rx="6" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <rect
              x="52"
              y="30"
              width="136"
              height="24"
              rx="4"
              fill={
                tint
                  ? tint.secondary
                  : resolvedType === 'gift_pen'
                  ? '#18181B'
                  : '#1E3A8A'
              }
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
                : resolvedType === 'gift_pen'
                ? '#18181B'
                : resolvedType === 'ballpoint_pen'
                ? ['#2563EB', '#DB2777', '#0D9488', '#7C3AED'][idx % 4]
                : idx % 2 === 0
                ? '#1E293B'
                : '#1D4ED8';
              return (
                <g key={x}>
                  <rect
                    x={x}
                    y="64"
                    width="12"
                    height="66"
                    rx="3"
                    fill={barrelFill}
                    stroke="#18181B"
                    strokeWidth="1.2"
                  />
                  <rect x={x + 2.5} y="68" width="2.5" height="22" rx="1" fill="#FBBF24" />
                  <polygon
                    points={`${x},130 ${x + 12},130 ${x + 6},140`}
                    fill="#E2E8F0"
                    stroke="#18181B"
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
            <rect x="64" y="30" width="88" height="120" rx="3" fill="#18181B" stroke="#18181B" strokeWidth="1.5" />
            <rect x="64" y="46" width="88" height="32" fill="#DC2626" />
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
                  fill={idx === 0 ? '#EA580C' : idx === 1 ? '#16A34A' : '#2563EB'}
                  stroke="#18181B"
                  strokeWidth="1.2"
                />
                <polygon points={`${x},44 ${x + 8},44 ${x + 4},31`} fill="#FDE68A" stroke="#18181B" strokeWidth="1" />
                <polygon points={`${x + 2.5},36 ${x + 5.5},36 ${x + 4},31`} fill="#18181B" />
              </g>
            ))}
          </g>
        )}

        {(resolvedType === 'watercolor_set' || resolvedType === 'drawing_book') && (
          <g>
            <rect x="44" y="36" width="152" height="106" rx="5" fill="#E4E4E7" stroke="#18181B" strokeWidth="1.5" />
            <rect x="52" y="44" width="136" height="90" rx="3" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.2" />
            {[
              '#DC2626',
              '#EA580C',
              '#EAB308',
              '#16A34A',
              '#0D9488',
              '#2563EB',
              '#4F46E5',
              '#9333EA',
              '#DB2777',
              '#78350F',
              '#52525B',
              '#18181B',
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
                  rx="2"
                  fill={color}
                  stroke="#18181B"
                  strokeWidth="1"
                />
              );
            })}
            <line x1="62" y1="120" x2="162" y2="120" stroke="#78350F" strokeWidth="4" strokeLinecap="round" />
            <path d="M162 120 Q174 116 178 120 Q174 124 162 120Z" fill="#18181B" />
          </g>
        )}

        {resolvedType === 'sketchbook' && (
          <g>
            <rect x="46" y="38" width="148" height="108" rx="3" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <rect x="46" y="38" width="148" height="24" fill="#D97706" stroke="#18181B" strokeWidth="1.5" />
            {[58, 74, 90, 106, 122, 138, 154, 170, 182].map((x) => (
              <line key={x} x1={x} y1="33" x2={x} y2="43" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
            ))}
            <text x="60" y="88" fill="#18181B" fontSize="12" fontFamily="serif" fontWeight="700">
              140 GSM CARTRIDGE
            </text>
            <text x="60" y="106" fill="#52525B" fontSize="9" fontFamily="monospace">
              ACID-FREE DRAWING PAD · A3
            </text>
          </g>
        )}

        {resolvedType === 'geometry_box' && (
          <g>
            <rect x="44" y="42" width="152" height="96" rx="6" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <rect x="44" y="42" width="152" height="22" rx="4" fill="#0F766E" />
            <text x="56" y="57" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="600">
              MATHEMATICAL INSTRUMENTS
            </text>
            <polygon points="60,124 112,124 60,76" fill="#CCFBF1" stroke="#18181B" strokeWidth="1.3" />
            <path d="M122 124 A28 28 0 0 1 178 124 Z" fill="#FEF3C7" stroke="#18181B" strokeWidth="1.3" />
            <line x1="146" y1="74" x2="134" y2="118" stroke="#18181B" strokeWidth="2" />
            <line x1="146" y1="74" x2="158" y2="118" stroke="#18181B" strokeWidth="2" />
            <circle cx="146" cy="74" r="4" fill="#B42318" />
          </g>
        )}

        {resolvedType === 'calculator' && (
          <g>
            <rect x="72" y="22" width="96" height="134" rx="6" fill="#27272A" stroke="#18181B" strokeWidth="1.5" />
            <rect x="82" y="34" width="76" height="26" rx="2" fill="#D9F99D" stroke="#18181B" strokeWidth="1.2" />
            <text x="102" y="52" fill="#18181B" fontSize="13" fontFamily="monospace" fontWeight="700">
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
                  rx="2"
                  fill={row === 3 && col === 3 ? '#B42318' : '#52525B'}
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
            <rect x="68" y="24" width="102" height="130" rx="3" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <rect
              x="68"
              y="24"
              width="20"
              height="130"
              fill={
                tint
                  ? tint.primary
                  : resolvedType === 'file_folder'
                  ? '#1E3A8A'
                  : resolvedType === 'practical_book'
                  ? '#065F46'
                  : '#B42318'
              }
              stroke="#18181B"
              strokeWidth="1.5"
            />
            <rect x="100" y="42" width="54" height="28" rx="2" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.2" />
            <line x1="106" y1="52" x2="146" y2="52" stroke="#18181B" strokeWidth="1.5" />
            <line x1="106" y1="61" x2="136" y2="61" stroke="#71717A" strokeWidth="1.2" />
            <circle cx="78" cy="134" r="5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.2" />
          </g>
        )}
      </svg>
    </div>
  );
};
