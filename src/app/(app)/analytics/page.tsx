'use client';

import Link from 'next/link';
import { useData } from '@/lib/data';
import { eur } from '@/lib/util';
import { Empty, Head } from '@/components/ui';

function niceMax(m: number) {
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export default function Analytics() {
  const { mine, txs, session } = useData();
  const uid = session.user.id;
  const done = txs.filter((t) => t.seller_id === uid && t.status === 'completed');
  const head = <Head title="Analytics" text="Calculées uniquement à partir des ventes finalisées par NEXORA." />;

  if (!done.length)
    return <>{head}<Empty title="Pas encore de vente finalisée" text="Les statistiques apparaissent dès la première vente confirmée."><Link className="btn" href="/annonces">Voir mes annonces</Link></Empty></>;

  const gross = done.reduce((a, t) => a + t.agreed_price_cents, 0);
  const fees = done.reduce((a, t) => a + (t.fee_cents || 0), 0);

  const delays: number[] = [];
  mine.forEach((l) => {
    if (l.status === 'sold' && l.published_at && l.sold_at) delays.push((+new Date(l.sold_at) - +new Date(l.published_at)) / 864e5);
  });
  const delay = delays.length ? Math.max(0, Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)) : null;
  const published = mine.filter((l) => l.published_at).length;
  const conv = published ? Math.round((done.length / published) * 100) : 0;

  const months: { k: string; l: string; v: number }[] = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push({ k: `${m.getFullYear()}-${m.getMonth() + 1}`, l: m.toLocaleDateString('fr-FR', { month: 'short' }), v: 0 });
  }
  done.forEach((t) => {
    const m = new Date(t.completed_at || t.created_at);
    const k = `${m.getFullYear()}-${m.getMonth() + 1}`;
    months.forEach((x) => { if (x.k === k) x.v += t.agreed_price_cents / 100; });
  });
  const mx = niceMax(Math.max(1, ...months.map((x) => x.v)));
  const W = 560, H = 214, pl = 46, pb = 28, pt = 18, ch = H - pb - pt, cw = W - pl - 8, slot = cw / 6, bw = slot * 0.54;

  return (
    <>
      {head}
      <div className="kpis">
        <div className="kpi"><div className="l">Ventes</div><div className="v">{done.length}</div><div className="s">finalisées</div></div>
        <div className="kpi"><div className="l">Prix moyen</div><div className="v">{eur(gross / done.length)}</div><div className="s">par compte vendu</div></div>
        <div className="kpi"><div className="l">Délai moyen</div><div className="v">{delay == null ? '—' : `${delay} j`}</div><div className="s">publication → vente</div></div>
        <div className="kpi"><div className="l">Conversion</div><div className="v">{conv} %</div><div className="s">ventes / annonces publiées</div></div>
      </div>
      <section className="panel">
        <h2>Volume de ventes, 6 derniers mois (€)</h2>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Volume de ventes par mois sur six mois">
          {[0, 0.5, 1].map((g) => {
            const y = pt + ch - ch * g;
            return (
              <g key={g}>
                <line className="grid" x1={pl} x2={W - 8} y1={y} y2={y} />
                <text x={pl - 8} y={y + 4} textAnchor="end">{Math.round(mx * g)}</text>
              </g>
            );
          })}
          {months.map((x, i) => {
            const bh = (ch * x.v) / mx;
            const bx = pl + slot * i + (slot - bw) / 2;
            return (
              <g key={x.k}>
                <rect className="bar" x={bx} y={pt + ch - bh} width={bw} height={Math.max(bh, x.v ? 2 : 0)} rx={3} />
                {x.v > 0 && <text className="val" x={bx + bw / 2} y={pt + ch - bh - 6} textAnchor="middle">{Math.round(x.v)}</text>}
                <text x={bx + bw / 2} y={H - 8} textAnchor="middle">{x.l}</text>
              </g>
            );
          })}
        </svg>
      </section>
      <section className="panel">
        <h2>Vue financière</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Annonce</th><th className="r">Brut</th><th className="r">Frais</th><th className="r">Net</th></tr></thead>
            <tbody>
              {done.map((t) => {
                const l = mine.find((x) => x.id === t.listing_id);
                return (
                  <tr key={t.id}>
                    <td>{l?.ref} · {l?.title}</td>
                    <td className="r">{eur(t.agreed_price_cents)}</td>
                    <td className="r">{eur(t.fee_cents || 0)}</td>
                    <td className="r">{eur(t.agreed_price_cents - (t.fee_cents || 0))}</td>
                  </tr>
                );
              })}
              <tr><td><b>Total</b></td><td className="r"><b>{eur(gross)}</b></td><td className="r"><b>{eur(fees)}</b></td><td className="r"><b>{eur(gross - fees)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ margin: '10px 0 0' }}>Frais Middleman : 6 % par transaction, minimum 5 €. Montants déclaratifs, hors frais éventuels de paiement.</p>
      </section>
    </>
  );
}
