'use client';

import { ReactNode, useState } from 'react';

// Palette catégorielle validée (mode sombre, surface #0D1019) : bleu, orange, aqua, jaune.
// Rampe ordinale validée pour l'entonnoir : bleu clair → foncé.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];
export const RAMP = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf'];

type Tip = { x: number; y: number; title: string; rows: [string, string, string?][] } | null;

// Carte de graphique : titre, sous-titre, bascule Graphique / Tableau, légende.
export function ChartCard({ title, sub, legend, table, children }: {
  title: string; sub?: string;
  legend?: { label: string; color: string }[];
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="panel viz">
      <div className="viz-h">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="sub" style={{ margin: '2px 0 0' }}>{sub}</p> : null}
        </div>
        <div className="seg" role="group" aria-label="Affichage">
          <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Graphique</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>Tableau</button>
        </div>
      </div>
      {view === 'chart' ? (
        <>
          {legend && legend.length > 1 && (
            <ul className="legend">
              {legend.map((l) => <li key={l.label}><i style={{ background: l.color }} />{l.label}</li>)}
            </ul>
          )}
          {children}
        </>
      ) : (
        <div className="scroll">
          <table>
            <thead><tr>{table.head.map((h, i) => <th key={h} className={i ? 'r' : ''}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tooltip({ tip, w }: { tip: Tip; w: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max((tip.x / w) * 100, 14), 86);
  return (
    <div className="tip" style={{ left: `${left}%`, top: tip.y }} role="status">
      <b>{tip.title}</b>
      {tip.rows.map(([k, v, c]) => (
        <span key={k}>{c ? <i style={{ background: c }} /> : null}{k}<em>{v}</em></span>
      ))}
    </div>
  );
}

// Barre arrondie au sommet (4 px), carrée sur la ligne de base
const top = (x: number, y: number, w: number, h: number, r = 4) => {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

const niceMax = (m: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(m || 1)));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

// Colonnes empilées (2 séries) par mois
export function StackedColumns({ data, names, fmt }: {
  data: { label: string; a: number; b: number; n: number }[]; names: [string, string]; fmt: (v: number) => string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 560, H = 230, pl = 48, pr = 8, pt = 16, pb = 28, ch = H - pt - pb, cw = W - pl - pr;
  const slot = cw / data.length, bw = Math.min(24, slot * 0.5);
  const mx = niceMax(Math.max(1, ...data.map((d) => d.a + d.b)));
  const y = (v: number) => pt + ch - (ch * v) / mx;
  return (
    <div className="plot">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Ventes par mois, net vendeur et frais Middleman">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line className="gl" x1={pl} x2={W - pr} y1={y(mx * g)} y2={y(mx * g)} />
            <text x={pl - 8} y={y(mx * g) + 4} textAnchor="end">{Math.round(mx * g)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pl + slot * i + (slot - bw) / 2;
          const ha = (ch * d.a) / mx, hb = (ch * d.b) / mx;
          const gap = ha > 2 && hb > 2 ? 2 : 0;
          return (
            <g key={i} onPointerEnter={() => setTip({ x: x + bw / 2, y: Math.max(y(d.a + d.b) - 8, 0), title: d.label, rows: [[names[0], fmt(d.a), SERIES[0]], [names[1], fmt(d.b), SERIES[1]], ['Ventes', String(d.n)]] })} onPointerLeave={() => setTip(null)}>
              <rect x={pl + slot * i} y={pt} width={slot} height={ch} fill="transparent" />
              {d.b > 0 && <path d={top(x, y(d.a + d.b), bw, hb)} fill={SERIES[1]} />}
              {d.a > 0 && <rect x={x} y={y(d.a)} width={bw} height={Math.max(ha - gap, 0)} fill={SERIES[0]} transform={`translate(0 ${gap})`} />}
              {d.a > 0 && d.b === 0 && <path d={top(x, y(d.a), bw, ha)} fill={SERIES[0]} />}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
        <line className="ax" x1={pl} x2={W - pr} y1={pt + ch} y2={pt + ch} />
      </svg>
      <Tooltip tip={tip} w={W} />
    </div>
  );
}

// Barres horizontales (une série)
export function HBars({ data, fmt }: { data: { label: string; v: number; note?: string }[]; fmt: (v: number) => string }) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 560, rowH = 38, pl = 84, pr = 74, H = data.length * rowH + 8;
  const mx = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="plot">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Barres horizontales">
        {data.map((d, i) => {
          const w = ((W - pl - pr) * d.v) / mx, y0 = 4 + i * rowH + (rowH - 20) / 2;
          return (
            <g key={d.label} onPointerEnter={() => setTip({ x: pl + w, y: i * rowH - 4, title: d.label, rows: [['Prix moyen', fmt(d.v), SERIES[0]], ...(d.note ? [['Annonces', d.note] as [string, string]] : [])] })} onPointerLeave={() => setTip(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={pl - 10} y={y0 + 14} textAnchor="end">{d.label}</text>
              <rect x={pl} y={y0} width={Math.max(w, 2)} height={20} rx={4} fill={SERIES[0]} />
              <text className="val" x={pl + w + 8} y={y0 + 14}>{fmt(d.v)}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} w={W} />
    </div>
  );
}

// Entonnoir : étapes ordonnées, rampe ordinale
export function Funnel({ steps }: { steps: { label: string; v: number }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 400, rowH = 40, pl = 78, pr = 36, H = steps.length * rowH + 8;
  const mx = Math.max(1, ...steps.map((s) => s.v));
  return (
    <div className="plot">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Entonnoir des annonces">
        {steps.map((s, i) => {
          const w = ((W - pl - pr) * s.v) / mx, y0 = 4 + i * rowH + (rowH - 22) / 2;
          const pct = steps[0].v ? Math.round((s.v / steps[0].v) * 100) : 0;
          return (
            <g key={s.label} onPointerEnter={() => setTip({ x: pl + w, y: i * rowH - 4, title: s.label, rows: [['Annonces', String(s.v), RAMP[i]], ['Part des créées', `${pct} %`]] })} onPointerLeave={() => setTip(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={pl - 10} y={y0 + 15} textAnchor="end">{s.label}</text>
              <rect x={pl} y={y0} width={Math.max(w, 2)} height={22} rx={4} fill={RAMP[i]} />
              <text className="val" x={pl + w + 8} y={y0 + 15}>{s.v}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} w={W} />
    </div>
  );
}

// Barre segmentée : un tout réparti en parts
export function SegBar({ parts }: { parts: { label: string; v: number; color: string }[] }) {
  const [tip, setTip] = useState<{ i: number } | null>(null);
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div>
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.label} ${p.v}`).join(', ')}>
        {parts.filter((p) => p.v > 0).map((p) => {
          const pct = Math.round((p.v / total) * 100);
          return (
            <div key={p.label} style={{ flexGrow: p.v, background: p.color }} tabIndex={0} onPointerEnter={() => setTip({ i: parts.indexOf(p) })} onPointerLeave={() => setTip(null)} onFocus={() => setTip({ i: parts.indexOf(p) })} onBlur={() => setTip(null)}>
              {pct >= 12 ? `${pct} %` : ''}
            </div>
          );
        })}
      </div>
      <div className="seg-info" aria-live="polite">
        {tip ? <><i style={{ background: parts[tip.i].color }} />{parts[tip.i].label} : {parts[tip.i].v} ({Math.round((parts[tip.i].v / total) * 100)} %)</> : 'Survolez une part pour le détail.'}
      </div>
      <ul className="legend">
        {parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label}</li>)}
      </ul>
    </div>
  );
}
