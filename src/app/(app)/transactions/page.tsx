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
  const myReq = requests.filter((r) => r.requester_id === uid && r.status === 'open' && !r.buyer_id);
  // Achats : mes demandes d'acheteur et les transactions où je suis l'acheteur
  const buyReq = requests.filter((r) => r.buyer_id === uid && r.status === 'open');
  const buyTx = txs.filter((t) => t.buyer_id === uid);
  const rows = mine.filter((t) => (filter === 'all' ? true : filter === 'open' ? isOpen(t) : t.status === filter));
  const n = (k: string) => (k === 'all' ? mine.length : k === 'open' ? mine.filter(isOpen).length : mine.filter((t) => t.status === k).length);

  const head = <Head title="Transactions" text="Suivi de chaque vente. Seul NEXORA confirme une vente comme terminée." />;
  if (!mine.length && !myReq.length && !buyReq.length && !buyTx.length)
    return <>{head}<Empty title="Aucune transaction" text="Quand une annonce active a un acheteur, demandez un Middleman depuis « Mes annonces ». Le suivi apparaît ici."><Link className="btn" href="/annonces">Voir mes annonces</Link></Empty></>;

  return (
    <>
      {head}
      {(buyReq.length > 0 || buyTx.length > 0) && (
        <section className="panel">
          <h2>Mes achats</h2>
          <p className="sub" style={{ margin: '2px 0 10px' }}>Le vendeur reste anonyme : NEXORA vous met en relation si nécessaire (voir l’onglet Messages, Groupes).</p>
          <div className="list">
            {buyReq.map((r) => {
              const l = listings.find((x) => x.id === r.listing_id);
              return <article className="item" key={r.id}><div><span className="ref">{l?.ref}</span><h3>{l?.title}</h3><p className="meta">Demande envoyée le {fmtD(r.created_at)}, en attente de NEXORA</p></div><div className="side2"><span className="price">{eur(r.agreed_price_cents)}</span></div></article>;
            })}
            {buyTx.map((t) => <TxCard key={t.id} tx={t} listing={listings.find((l) => l.id === t.listing_id)} buyerName="vous" payFee />)}
          </div>
        </section>
      )}
      {myReq.length > 0 && (
        <section className="panel">
          <h2>Demandes en attente de NEXORA</h2>
          <ul className="feed">
            {myReq.map((r) => {
              const l = listings.find((x) => x.id === r.listing_id);
              return <li key={r.id}><time>{fmtD(r.created_at)}</time><span><b>{l?.ref}</b> · {r.buyer_id ? 'votre demande d’achat' : `acheteur ${r.buyer_label}`} · {eur(r.agreed_price_cents)}</span></li>;
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
