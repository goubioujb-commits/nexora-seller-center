'use client';

import { ReactNode } from 'react';
import { eur, fmtD } from '@/lib/util';
import { TxSteps } from '@/components/ui';

export default function TxCard({ tx, listing, actions }: { tx: any; listing?: any; actions?: ReactNode }) {
  const fee = tx.fee_cents ?? 0;
  const price = tx.agreed_price_cents ?? 0;
  const pill =
    tx.status === 'cancelled' ? <span className="pill" style={{ ['--c' as any]: 'var(--mut)' }}>Annulée</span>
    : tx.status === 'completed' ? <span className="pill" style={{ ['--c' as any]: 'var(--good)' }}>Finalisée</span>
    : <span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>En cours</span>;
  return (
    <article className="item">
      <div>
        <span className="ref">{listing?.ref}</span>
        <h3>{listing?.title || 'Annonce'}</h3>
        <p className="meta">Acheteur : {tx.buyer_label || 'membre NEXORA'} · ouverte le {fmtD(tx.created_at)}</p>
        <div className="tx-fig"><span>Prix <b>{eur(price)}</b></span><span>Frais Middleman <b>{eur(fee)}</b></span><span>Net vendeur <b>{eur(price - fee)}</b></span></div>
      </div>
      <div className="side2">{pill}</div>
      <div className="act"><TxSteps tx={tx} /></div>
      {actions ? <div className="act actions">{actions}</div> : null}
    </article>
  );
}
