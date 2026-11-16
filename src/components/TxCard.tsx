'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { PAYPAL_ME, paypalLink } from '@/lib/config';
import { eur, fmtD } from '@/lib/util';
import { TxSteps } from '@/components/ui';

export default function TxCard({ tx, listing, actions, buyerName, sellerName, payFee }: { tx: any; listing?: any; actions?: ReactNode; buyerName?: string; sellerName?: string; payFee?: boolean }) {
  const [copied, setCopied] = useState(false);
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
        <p className="meta">{sellerName ? `Vendeur : ${sellerName} · ` : ''}Acheteur : {buyerName || tx.buyer_label || 'anonyme (identité gérée par NEXORA)'} · ouverte le {fmtD(tx.created_at)}</p>
        <div className="tx-fig"><span>Prix <b>{eur(price)}</b></span><span>Frais Middleman <b>{eur(fee)}</b></span><span>Net vendeur <b>{eur(price - fee)}</b></span></div>
      </div>
      <div className="side2">{pill}</div>
      <div className="act"><TxSteps tx={tx} /></div>
      {payFee && fee > 0 && !['completed', 'cancelled'].includes(tx.status) ? (
        <div className="act paybox">
          <div>
            <b>Frais Middleman à régler : {eur(fee)}</b>
            <p className="hint">Paiement par PayPal à NEXORA : <b>paypal.me/SylverZz</b>.</p>
            <p className="hint">Indiquez la référence <b>{listing?.ref}</b> et prévenez NEXORA dans votre discussion une fois payé.</p>
          </div>
          <div className="actions">
            <a className="btn pri" href={paypalLink(fee, listing?.ref || '')} target="_blank" rel="noopener noreferrer">Payer {eur(fee)} avec PayPal ↗</a>
            <button type="button" className="btn sm" onClick={() => { try { navigator.clipboard.writeText(PAYPAL_ME); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }}>{copied ? 'Copié ✓' : "Copier le lien PayPal"}</button>
            <Link className="btn sm" href="/messages">Ouvrir ma discussion avec NEXORA</Link>
          </div>
        </div>
      ) : null}
      {actions ? <div className="act actions">{actions}</div> : null}
    </article>
  );
}
