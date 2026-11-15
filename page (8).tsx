'use client';

import Link from 'next/link';
import { useData } from '@/lib/data';
import { eur, fmtD, TX_LABELS, txStep } from '@/lib/util';
import { Empty, Head } from '@/components/ui';

export default function Apercu() {
  const { mine, txs, requests, profile, session } = useData();
  const uid = session.user.id;
  const myTx = txs.filter((t) => t.seller_id === uid);
  const done = myTx.filter((t) => t.status === 'completed');
  const volume = done.reduce((a, t) => a + (t.agreed_price_cents || 0), 0);
  const count = (s: string) => mine.filter((l) => l.status === s).length;

  const title = <>Bonjour, {profile?.handle || 'vendeur'}</>;
  const head = (
    <Head
      title={title}
      text="Votre espace vendeur gratuit. Publiez, suivez et finalisez vos ventes de comptes Summoners War depuis un seul endroit."
      actions={<Link className="btn pri" href="/ajouter">Ajouter un compte</Link>}
    />
  );

  if (!mine.length) {
    return (
      <>
        {head}
        <Empty title="Aucune annonce pour l'instant" text="Créez votre première annonce. Elle sera visible après validation par NEXORA.">
          <Link className="btn pri" href="/ajouter">Ajouter mon premier compte</Link>
        </Empty>
      </>
    );
  }

  const alerts: JSX.Element[] = [];
  mine.forEach((l) => {
    if (l.status === 'draft' && l.admin_feedback)
      alerts.push(<li key={'f' + l.id}><span className="pill" style={{ ['--c' as any]: 'var(--warn)' }}>Corrections</span><span><b>{l.ref}</b> · {l.admin_feedback} <Link className="btn sm" href={`/ajouter?id=${l.id}`}>Modifier</Link></span></li>);
    if (l.status === 'rejected')
      alerts.push(<li key={'r' + l.id}><span className="pill" style={{ ['--c' as any]: 'var(--bad)' }}>Refusée</span><span><b>{l.ref}</b> · {l.admin_feedback || 'Aucun motif indiqué'}</span></li>);
    if (l.status === 'pending')
      alerts.push(<li key={'p' + l.id}><span className="pill" style={{ ['--c' as any]: 'var(--warn)' }}>En validation</span><span><b>{l.ref}</b> attend la modération NEXORA.</span></li>);
  });
  requests.filter((r) => r.requester_id === uid && r.status === 'open').forEach((r) =>
    alerts.push(<li key={'q' + r.id}><span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>Middleman</span><span>Demande envoyée pour l&apos;acheteur <b>{r.buyer_label}</b>, en attente de NEXORA.</span></li>)
  );
  myTx.filter((t) => !['completed', 'cancelled'].includes(t.status)).forEach((t) => {
    const l = mine.find((x) => x.id === t.listing_id);
    alerts.push(<li key={'t' + t.id}><span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>Transaction</span><span><b>{l?.ref}</b> · étape « {TX_LABELS[txStep(t.status)]} »</span></li>);
  });

  const events: [string, JSX.Element][] = [];
  mine.forEach((l) => {
    events.push([l.created_at, <>Annonce <b>{l.ref}</b> créée</>]);
    if (l.published_at) events.push([l.published_at, <>Annonce <b>{l.ref}</b> publiée</>]);
  });
  myTx.forEach((t) => {
    const l = mine.find((x) => x.id === t.listing_id);
    events.push([t.created_at, <>Transaction ouverte sur <b>{l?.ref}</b></>]);
    if (t.completed_at) events.push([t.completed_at, <>Vente finalisée : <b>{l?.ref}</b> à {eur(t.agreed_price_cents)}</>]);
  });
  events.sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <>
      {head}
      <div className="kpis">
        <div className="kpi"><div className="l">Comptes</div><div className="v">{mine.filter((l) => l.status !== 'archived').length}</div><div className="s">hors archives</div></div>
        <div className="kpi"><div className="l">Disponibles</div><div className="v">{count('active')}</div><div className="s">annonces actives</div></div>
        <div className="kpi"><div className="l">Réservées</div><div className="v">{count('reserved')}</div><div className="s">en cours de vente</div></div>
        <div className="kpi"><div className="l">Vendues</div><div className="v">{count('sold')}</div><div className="s">confirmées par NEXORA</div></div>
        <div className="kpi"><div className="l">Volume brut</div><div className="v">{eur(volume)}</div><div className="s">ventes finalisées</div></div>
      </div>
      <div className="grid2">
        <section className="panel">
          <h2>À traiter</h2>
          {alerts.length ? <ul className="feed">{alerts}</ul> : <p className="sub" style={{ margin: 0 }}>Rien en attente.</p>}
        </section>
        <section className="panel">
          <h2>Dernières activités</h2>
          <ul className="feed">
            {events.slice(0, 6).map((e, i) => (
              <li key={i}><time>{fmtD(e[0])}</time><span>{e[1]}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
