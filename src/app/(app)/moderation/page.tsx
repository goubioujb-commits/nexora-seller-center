'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { eur, fmtD, REGION, TX_KEYS, TX_LABELS } from '@/lib/util';
import { Head, useToast } from '@/components/ui';
import TxCard from '@/components/TxCard';

export default function Moderation() {
  const { isAdmin, listings, requests, txs, people, moderate, openTx, closeRequest, advanceTx, finishTx, cancelTx } = useData();
  const [fb, setFb] = useState<Record<string, string>>({});
  const toast = useToast();

  if (!isAdmin) return <Head title="Modération" text="Réservée à l'administrateur NEXORA." />;

  const pending = listings.filter((l) => l.status === 'pending');
  const openReq = requests.filter((r) => r.status === 'open');
  const openTxs = txs.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const seller = (id: string) => people[id]?.handle || 'vendeur';
  const done = async (p: Promise<string | null>, ok: string) => {
    const e = await p;
    toast.show(e || ok);
  };

  async function mod(id: string, kind: 'approve' | 'fix' | 'reject') {
    const msg = (fb[id] || '').trim();
    if (kind !== 'approve' && !msg) return toast.show('Ajoutez un message pour le vendeur.');
    await done(moderate(id, kind, msg), kind === 'approve' ? 'Annonce publiée.' : kind === 'fix' ? 'Retournée au vendeur.' : 'Annonce refusée.');
  }

  return (
    <>
      <Head title="Modération" text="Validez les annonces avant publication et faites avancer les transactions. Seul l'administrateur peut confirmer une vente." />

      <section className="panel">
        <h2>Annonces à valider ({pending.length})</h2>
        {pending.length ? (
          <div className="list">
            {pending.map((l) => (
              <article className="item" key={l.id}>
                <div>
                  <span className="ref">{l.ref}</span>
                  <h3>{l.title}</h3>
                  <p className="meta">
                    {seller(l.seller_id)} · {REGION[l.region]} · {l.ld5_count || 0} LD5 · {(l.listing_monsters || []).map((m: any) => m.monster_name).join(', ')} · soumise le {fmtD(l.submitted_at)}
                  </p>
                  {l.description ? <p className="meta" style={{ marginTop: 6, color: 'var(--fg)' }}>{l.description}</p> : null}
                </div>
                <div className="side2"><span className="price">{eur(l.price_cents)}</span></div>
                <div className="act field">
                  <label htmlFor={`fb-${l.id}`}>Message au vendeur (obligatoire pour corriger ou refuser)</label>
                  <textarea id={`fb-${l.id}`} style={{ minHeight: 64 }} value={fb[l.id] || ''} onChange={(e) => setFb({ ...fb, [l.id]: e.target.value })} />
                </div>
                <div className="act actions">
                  <button className="btn sm good" onClick={() => mod(l.id, 'approve')}>Accepter et publier</button>
                  <button className="btn sm" onClick={() => mod(l.id, 'fix')}>À corriger</button>
                  <button className="btn sm bad" onClick={() => mod(l.id, 'reject')}>Refuser</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="sub" style={{ margin: 0 }}>Aucune annonce en attente de validation.</p>
        )}
      </section>

      <section className="panel">
        <h2>Demandes de Middleman ({openReq.length})</h2>
        {openReq.length ? (
          <div className="list">
            {openReq.map((r) => {
              const l = listings.find((x) => x.id === r.listing_id);
              return (
                <article className="item" key={r.id}>
                  <div>
                    <span className="ref">{l?.ref}</span>
                    <h3>{l?.title}</h3>
                    <p className="meta">Vendeur {seller(r.requester_id)} · acheteur {r.buyer_label} · demandée le {fmtD(r.created_at)}</p>
                  </div>
                  <div className="side2"><span className="price">{eur(r.agreed_price_cents)}</span></div>
                  <div className="act actions">
                    <button className="btn sm pri" onClick={() => done(openTx(r), 'Transaction ouverte. Annonce réservée.')}>Ouvrir la transaction</button>
                    <button className="btn sm bad" onClick={() => done(closeRequest(r.id), 'Demande refusée.')}>Refuser</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="sub" style={{ margin: 0 }}>Aucune demande en attente.</p>
        )}
      </section>

      <section className="panel">
        <h2>Transactions en cours ({openTxs.length})</h2>
        {openTxs.length ? (
          <div className="list">
            {openTxs.map((t) => {
              const i = TX_KEYS.indexOf(t.status);
              return (
                <TxCard
                  key={t.id}
                  tx={t}
                  listing={listings.find((l) => l.id === t.listing_id)}
                  actions={
                    <>
                      {i < 4 ? (
                        <button className="btn sm pri" onClick={() => done(advanceTx(t), 'Étape mise à jour.')}>Étape suivante : {TX_LABELS[i + 1]}</button>
                      ) : (
                        <button className="btn sm good" onClick={() => done(finishTx(t), 'Vente finalisée et enregistrée.')}>Finaliser la vente</button>
                      )}
                      <button className="btn sm bad" onClick={() => done(cancelTx(t), "Transaction annulée. L'annonce est de nouveau active.")}>Annuler</button>
                    </>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="sub" style={{ margin: 0 }}>Aucune transaction en cours.</p>
        )}
      </section>
      {toast.node}
    </>
  );
}
