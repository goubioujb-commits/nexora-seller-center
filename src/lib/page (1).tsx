'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import { eur, fmtD } from '@/lib/util';
import { Empty, Head } from '@/components/ui';
import TxCard from '@/components/TxCard';

const FILTERS: [string, string][] = [['open', 'En cours'], ['completed', 'Finalisées'], ['cancelled', 'Annulées'], ['all', 'Toutes']];
const isOpen = (t: any) => !['completed', 'cancelled'].includes(t.status);

export default function Transactions() {
  const { txs, requests, listings, session } = useData();
  const [filter, setFilter] = useState('open');
  const uid = session.user.id;
  const mine = txs.filter((t) => t.seller_id === uid);
  const myReq = requests.filter((r) => r.requester_id === uid && r.status === 'open');
  const rows = mine.filter((t) => (filter === 'all' ? true : filter === 'open' ? isOpen(t) : t.status === filter));
  const n = (k: string) => (k === 'all' ? mine.length : k === 'open' ? mine.filter(isOpen).length : mine.filter((t) => t.status === k).length);

  const head = <Head title="Transactions" text="Suivi de chaque vente. Seul NEXORA confirme une vente comme terminée." />;
  if (!mine.length && !myReq.length)
    return <>{head}<Empty title="Aucune transaction" text="Quand une annonce active a un acheteur, demandez un Middleman depuis « Mes annonces ». Le suivi apparaît ici."><Link className="btn" href="/annonces">Voir mes annonces</Link></Empty></>;

  return (
    <>
      {head}
      {myReq.length > 0 && (
        <section className="panel">
          <h2>Demandes en attente de NEXORA</h2>
          <ul className="feed">
            {myReq.map((r) => {
              const l = listings.find((x) => x.id === r.listing_id);
              return <li key={r.id}><time>{fmtD(r.created_at)}</time><span><b>{l?.ref}</b> · acheteur {r.buyer_label} · {eur(r.agreed_price_cents)}</span></li>;
            })}
          </ul>
        </section>
      )}
      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}<b>{n(k)}</b></button>
        ))}
      </div>
      {rows.length ? (
        <div className="list">{rows.map((t) => <TxCard key={t.id} tx={t} listing={listings.find((l) => l.id === t.listing_id)} />)}</div>
      ) : (
        <p className="sub">Aucune transaction dans cette catégorie.</p>
      )}
    </>
  );
}
