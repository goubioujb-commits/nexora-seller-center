'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import { TX_KEYS, TX_LABELS } from '@/lib/util';

type Ev = { id: string; title: string; ref?: string; sub?: string; href: string };
type Snap = { tx: Record<string, string>; li: Record<string, string>; req: number; pend: number; msgs: number };

const SHOW_MS = 9000;
const MAX = 4;

// Notifications pop-up : détecte les changements (messages, transactions, annonces, demandes) et les signale.
export default function Notifier({ unread }: { unread: number }) {
  const { session, isAdmin, txs, listings, mine, requests, refresh } = useData();
  const uid = session?.user?.id as string | undefined;
  const [items, setItems] = useState<Ev[]>([]);
  const first = useRef(true);
  const timers = useRef<Record<string, any>>({});

  // Actualisation périodique des données (onglet visible)
  useEffect(() => {
    if (!uid) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 45000);
    return () => clearInterval(t);
  }, [uid, refresh]);

  const dismiss = (id: string) => {
    clearTimeout(timers.current[id]);
    setItems((l) => l.filter((x) => x.id !== id));
  };

  useEffect(() => {
    if (!uid) return;
    const key = `nx_snap_${uid}`;
    const myTx = txs.filter((t) => t.seller_id === uid || t.buyer_id === uid);
    const cur: Snap = {
      tx: Object.fromEntries(myTx.map((t) => [t.id, t.status])),
      li: Object.fromEntries(mine.map((l) => [l.id, l.status])),
      req: isAdmin ? requests.filter((r) => r.status === 'open').length : 0,
      pend: isAdmin ? listings.filter((l) => l.status === 'pending').length : 0,
      msgs: unread,
    };
    let prev: Snap | null = null;
    try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    // Première mesure sans historique : on mémorise sans notifier
    if (first.current && !listings.length && !txs.length && !mine.length) return;
    const evs: Ev[] = [];
    if (prev) {
      myTx.forEach((t) => {
        const l = listings.find((x) => x.id === t.listing_id);
        const ref = l?.ref;
        const was = prev!.tx[t.id];
        const buyer = t.buyer_id === uid;
        if (!was) evs.push({ id: `tx-new-${t.id}`, title: 'Transaction ouverte', ref, sub: buyer ? 'Frais Middleman à régler' : 'Annonce réservée', href: '/transactions' });
        else if (was !== t.status) {
          if (t.status === 'completed') evs.push({ id: `tx-${t.id}-c`, title: 'Vente finalisée', ref, href: '/transactions' });
          else if (t.status === 'cancelled') evs.push({ id: `tx-${t.id}-x`, title: 'Transaction annulée', ref, href: '/transactions' });
          else evs.push({ id: `tx-${t.id}-${t.status}`, title: 'Transaction mise à jour', ref, sub: TX_LABELS[Math.max(0, TX_KEYS.indexOf(t.status))], href: '/transactions' });
        }
      });
      mine.forEach((l) => {
        const was = prev!.li[l.id];
        if (was && was !== l.status) {
          if (l.status === 'active' && was !== 'reserved') evs.push({ id: `li-${l.id}-a`, title: 'Annonce publiée', ref: l.ref, href: '/annonces' });
          if (l.status === 'rejected') evs.push({ id: `li-${l.id}-r`, title: 'Annonce refusée', ref: l.ref, sub: 'Voir le motif dans Mes annonces', href: '/annonces' });
        }
      });
      if (isAdmin && cur.req > prev.req) evs.push({ id: `req-${cur.req}`, title: 'Nouvelle demande Middleman', href: '/moderation' });
      if (isAdmin && cur.pend > prev.pend) evs.push({ id: `pend-${cur.pend}`, title: 'Annonce à valider', href: '/moderation' });
      if (cur.msgs > prev.msgs) evs.push({ id: `msg-${cur.msgs}-${Date.now()}`, title: 'Nouveau message', sub: 'Ouvrir mes messages', href: '/messages' });
    }
    first.current = false;
    try { localStorage.setItem(key, JSON.stringify(cur)); } catch {}
    if (!evs.length) return;
    const shown = evs.slice(0, MAX);
    setItems((l) => [...l, ...shown].slice(-MAX));
    shown.forEach((e) => {
      timers.current[e.id] = setTimeout(() => setItems((l) => l.filter((x) => x.id !== e.id)), SHOW_MS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, listings, mine, requests, unread, uid, isAdmin]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  if (!items.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((e) => (
        <div className="ntoast" key={e.id}>
          <Link href={e.href} onClick={() => dismiss(e.id)}>
            <b>{e.title}</b>
            <span>{e.ref ? <em>{e.ref}</em> : null}{e.ref && e.sub ? ' · ' : ''}{e.sub || ''}</span>
          </Link>
          <button type="button" aria-label="Fermer" onClick={() => dismiss(e.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
