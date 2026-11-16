'use client';

import Link from 'next/link';
import { getLocale } from '@/lib/i18n';
import { useData } from '@/lib/data';
import { eur, REGION } from '@/lib/util';
import { Head } from '@/components/ui';
import { ChartCard, Funnel, HBars, SegBar, SERIES, StackedColumns } from '@/components/charts';

const MONTH_FMT = (d: Date) => d.toLocaleDateString(getLocale(), { month: 'short' }).replace('.', '');

export default function Analytics() {
  const { mine, txs, session } = useData();
  const uid = session.user.id;
  const done = txs.filter((t) => t.seller_id === uid && t.status === 'completed');

  const gross = done.reduce((a, t) => a + t.agreed_price_cents, 0);
  const fees = done.reduce((a, t) => a + (t.fee_cents || 0), 0);
  const delays: number[] = [];
  mine.forEach((l) => {
    if (l.status === 'sold' && l.published_at && l.sold_at) delays.push((+new Date(l.sold_at) - +new Date(l.published_at)) / 864e5);
  });
  const delay = delays.length ? Math.max(0, Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)) : null;
  const published = mine.filter((l) => l.published_at).length;
  const conv = published ? Math.round((done.length / published) * 100) : null;

  // 6 derniers mois
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { k: `${m.getFullYear()}-${m.getMonth()}`, label: MONTH_FMT(m), a: 0, b: 0, n: 0 };
  });
  done.forEach((t) => {
    const m = new Date(t.completed_at || t.created_at);
    const x = months.find((y) => y.k === `${m.getFullYear()}-${m.getMonth()}`);
    if (x) {
      x.a += (t.agreed_price_cents - (t.fee_cents || 0)) / 100;
      x.b += (t.fee_cents || 0) / 100;
      x.n += 1;
    }
  });
  const hasSales = months.some((m) => m.n > 0);

  // Répartition des annonces
  const c = (...s: string[]) => mine.filter((l) => s.includes(l.status)).length;
  const parts = [
    { label: 'En préparation', v: c('draft', 'pending', 'rejected'), color: SERIES[3] },
    { label: 'Actives', v: c('active'), color: SERIES[2] },
    { label: 'Réservées', v: c('reserved'), color: SERIES[0] },
    { label: 'Vendues', v: c('sold'), color: SERIES[1] },
  ];
  const archived = c('archived');

  const steps = [
    { label: 'Créées', v: mine.length },
    { label: 'Soumises', v: mine.filter((l) => l.submitted_at || l.published_at).length },
    { label: 'Publiées', v: published },
    { label: 'Vendues', v: Math.max(c('sold'), done.length) },
  ];

  const byRegion = Object.keys(REGION)
    .map((k) => {
      const ls = mine.filter((l) => l.region === k && l.status !== 'archived');
      return { label: REGION[k], v: ls.length ? ls.reduce((a, l) => a + l.price_cents, 0) / ls.length / 100 : 0, note: String(ls.length) };
    })
    .filter((r) => r.v > 0);

  return (
    <>
      <Head title="Analytics" text="Ventes calculées uniquement à partir des ventes finalisées par NEXORA ; le reste vient de vos annonces." />
      <div className="kpis">
        <div className="kpi"><div className="l">Ventes</div><div className="v">{done.length}</div><div className="s">finalisées</div></div>
        <div className="kpi"><div className="l">Prix moyen</div><div className="v">{done.length ? eur(gross / done.length) : '—'}</div><div className="s">par compte vendu</div></div>
        <div className="kpi"><div className="l">Délai moyen</div><div className="v">{delay == null ? '—' : `${delay} j`}</div><div className="s">publication → vente</div></div>
        <div className="kpi"><div className="l">Conversion</div><div className="v">{conv == null ? '—' : `${conv} %`}</div><div className="s">ventes / annonces publiées</div></div>
      </div>

      {!mine.length && <div className="banner info">Aucune annonce pour l&apos;instant : les graphiques se rempliront dès votre premier compte. <Link href="/ajouter">Ajouter un compte</Link></div>}

      <ChartCard
        title="Ventes par mois (€)"
        sub="Montant net vendeur et frais Middleman, 6 derniers mois."
        legend={[{ label: 'Net vendeur', color: SERIES[0] }, { label: 'Frais Middleman', color: SERIES[1] }]}
        table={{ head: ['Mois', 'Net (€)', 'Frais (€)', 'Ventes'], rows: months.map((m) => [m.label, m.a.toFixed(2), m.b.toFixed(2), m.n]) }}
      >
        {hasSales ? <StackedColumns data={months} names={['Net vendeur', 'Frais Middleman']} fmt={(v) => eur(v * 100)} /> : <p className="sub">Aucune vente finalisée sur la période.</p>}
      </ChartCard>

      <div className="two">
        <ChartCard
          title="Parcours des annonces"
          sub="De la création à la vente."
          table={{ head: ['Étape', 'Annonces'], rows: steps.map((s) => [s.label, s.v]) }}
        >
          {mine.length ? <Funnel steps={steps} /> : <p className="sub">Pas encore d&apos;annonce.</p>}
        </ChartCard>
        <ChartCard
          title="Répartition des annonces"
          sub={archived ? `${mine.length - archived} annonces hors archives (${archived} archivée${archived > 1 ? 's' : ''}).` : 'Vos annonces par statut.'}
          table={{ head: ['Statut', 'Annonces'], rows: parts.map((p) => [p.label, p.v]) }}
        >
          {mine.length ? <SegBar parts={parts} /> : <p className="sub">Pas encore d&apos;annonce.</p>}
        </ChartCard>
      </div>

      <ChartCard
        title="Prix demandé moyen par région"
        sub="Annonces non archivées."
        table={{ head: ['Région', 'Prix moyen (€)', 'Annonces'], rows: byRegion.map((r) => [r.label, r.v.toFixed(2), r.note!]) }}
      >
        {byRegion.length ? <HBars data={byRegion} fmt={(v) => eur(v * 100)} /> : <p className="sub">Pas encore d&apos;annonce.</p>}
      </ChartCard>

      {done.length > 0 && (
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
      )}
    </>
  );
}
