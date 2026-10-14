import React from 'react';
// Lightweight, dependency-free SVG charts tuned to the IHSD palette.
const BRAND = '#2E9C88';
export function BarChart({ data, color = BRAND, height = 160, unit = '', highlightMax = true }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    const maxIdx = data.reduce((mi, d, i, arr) => d.value > arr[mi].value ? i : mi, 0);
    return (<div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => {
            const isMax = highlightMax && i === maxIdx;
            return (<div key={d.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <span className="text-[10px] font-semibold text-charcoal-muted opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value}
              {unit}
            </span>
            <div className="w-full rounded-full transition-all duration-500" style={{
                    height: `${d.value / max * (height - 34)}px`,
                    background: isMax ? color : '#CDEEE5',
                    minHeight: 6
                }}/>
            <span className="text-[11px] font-medium text-charcoal-muted">{d.label}</span>
          </div>);
        })}
    </div>);
}
export function LineChart({ data, color = BRAND, height = 160, fill = true }) {
    const w = 320;
    const h = height;
    const pad = 14;
    const max = Math.max(...data.map((d) => d.value)) * 1.1;
    const min = Math.min(...data.map((d) => d.value), 0);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (data.length - 1);
    const pts = data.map((d, i) => {
        const x = pad + i * stepX;
        const y = pad + (1 - (d.value - min) / range) * (h - pad * 2);
        return { x, y };
    });
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${path} L${pts[pts.length - 1].x},${h - pad} L${pts[0].x},${h - pad} Z`;
    const gid = React.useId();
    return (<svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`}/>}
      <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2.5}/>)}
    </svg>);
}
export function RadarChart({ data, size = 260 }) {
    const center = size / 2;
    const radius = size / 2 - 44;
    const n = data.length;
    const angle = (i) => Math.PI * 2 * i / n - Math.PI / 2;
    const point = (i, v) => {
        const r = v / 100 * radius;
        return { x: center + r * Math.cos(angle(i)), y: center + r * Math.sin(angle(i)) };
    };
    const poly = (key) => data.map((d, i) => point(i, (d[key] ?? 0))).map((p) => `${p.x},${p.y}`).join(' ');
    return (<svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={data.map((_, i) => point(i, f * 100)).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#E2EEE9" strokeWidth={1}/>)}
      {data.map((_, i) => {
            const p = point(i, 100);
            return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E2EEE9" strokeWidth={1}/>;
        })}
      <polygon points={poly('prev')} fill="#9EB2DB" fillOpacity={0.25} stroke="#7F95CC" strokeWidth={1.5} strokeDasharray="4 3"/>
      <polygon points={poly('value')} fill={BRAND} fillOpacity={0.18} stroke={BRAND} strokeWidth={2.5}/>
      {data.map((d, i) => {
            const p = point(i, 116);
            return (<text key={d.name} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-charcoal-muted" style={{ fontSize: 9, fontWeight: 600 }}>
            {d.name.split(' ')[0]}
          </text>);
        })}
    </svg>);
}
export function DonutChart({ segments, size = 160, stroke = 22 }) {
    const radius = (size - stroke) / 2;
    const circ = 2 * Math.PI * radius;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;
    return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {segments.map((s, i) => {
            const len = s.value / total * circ;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} strokeLinecap="round"/>;
            offset += len;
            return el;
        })}
    </svg>);
}
