'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import { eur, feeCents, REGION, STATUS } from '@/lib/util';
import { Empty, Head, Pill, useToast } from '@/components/ui';

const ORDER = ['all', 'draft', 'pending', 'active', 'reserved', 'sold', 'rejected', 'archived'];

export default function Annonces() {
  const { mine, requests, setStatus, requestMiddleman } = useData();
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState<any>(null);
  const [buyer, setBuyer] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();

  const count = (k: string) => (k === 'all' ? mine.length : mine.filter((l) => l.status === k).length);
  const rows = mine.filter((l) => filter === 'all' || l.status === filter);
  const hasOpenReq = (id: string) => requests.some((r) => r.listing_id === id && r.status === 'open');

  async function change(id: string, status: string) {
    const e = await setStatus(id, status);
    toast.show(e || 'Statut mis à jour.');
  }

  async function sendRequest() {
    const p = Number(price);
    if (buyer.trim().length < 2) return setErr("Indiquez le pseudo de l'acheteur.");
    if (!(p > 0)) return setErr('Indiquez un prix valide.');
    const e = await requestMiddleman(modal.id, buyer, p);
    if (e) return setErr(e);
    setModal(null);
    toast.show('Demande envoyée à NEXORA.');
  }

  function actions(l: any) {
    const B = (t: string, fn: () => void, c = '') => <button key={t} className={`btn sm ${c}`} onClick={fn}>{t}</button>;
    switch (l.status) {
      case 'draft': return <>
        <Link className="btn sm" href={`/ajouter?id=${l.id}`}>Modifier</Link>
        <Link className="btn sm pri" href={`/ajouter?id=${l.id}`}>Soumettre</Link>
        {B('Archiver', () => change(l.id, 'archived'))}</>;
      case 'pending': return B('Retirer de la validation', () => change(l.id, 'draft'));
      case 'active': return <>
        <Link className="btn sm" href={`/ajouter?id=${l.id}`}>Modifier</Link>
        {hasOpenReq(l.id)
          ? <span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>Demande Middleman envoyée</span>
          : B('Demander un Middleman', () => { setModal(l); setBuyer(''); setPrice(String(l.price_cents / 100)); setErr(''); }, 'pri')}
        {B('Archiver', () => change(l.id, 'archived'))}</>;
      case 'reserved': return <Link className="btn sm" href="/transactions">Voir la transaction</Link>;
      case 'rejected': return <>
        <Link className="btn sm" href={`/ajouter?id=${l.id}`}>Modifier</Link>
        {B('Archiver', () => change(l.id, 'archived'))}</>;
      case 'archived': return B('Restaurer', () => change(l.id, 'draft'));
      default: return null;
    }
  }

  const head = <Head title="Mes annonces" text="Toutes vos annonces Summoners War: Sky Arena, avec leur statut." actions={<Link className="btn pri" href="/ajouter">Ajouter un compte</Link>} />;
  if (!mine.length)
    return <>{head}<Empty title="Aucune annonce" text="Ajoutez un compte pour démarrer."><Link className="btn pri" href="/ajouter">Ajouter un compte</Link></Empty></>;

  return (
    <>
      {head}
      <div className="chips">
        {ORDER.map((k) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === 'all' ? 'Toutes' : STATUS[k][0]}<b>{count(k)}</b>
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="list">
          {rows.map((l) => {
            const mons = (l.listing_monsters || []).map((m: any) => m.monster_name);
            return (
              <article className="item" key={l.id}>
                <div>
                  <span className="ref">{l.ref}</span>
                  <h3>{l.title}</h3>
                  <p className="meta">{REGION[l.region]} · {l.ld5_count || 0} LD5{mons.length ? ' · ' + mons.join(', ') : ''}</p>
                  {l.admin_feedback && (l.status === 'draft' || l.status === 'rejected') && (
                    <div className={`note${l.status === 'rejected' ? ' bad' : ''}`}>
                      <small>{l.status === 'rejected' ? 'Motif du refus' : 'Corrections demandées'}</small>
                      {l.admin_feedback}
                    </div>
                  )}
                </div>
                <div className="side2"><span className="price">{eur(l.price_cents)}</span><Pill status={l.status} /></div>
                <div className="act actions">{actions(l)}</div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="sub">Aucune annonce dans ce statut.</p>
      )}

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="dialog" role="dialog" aria-modal="true">
            <h2>Demander un Middleman</h2>
            <p className="sub" style={{ margin: 0 }}>{modal.ref} · {modal.title}</p>
            <div className="field"><label htmlFor="m-buyer">Pseudo de l&apos;acheteur</label><input id="m-buyer" maxLength={60} value={buyer} onChange={(e) => setBuyer(e.target.value)} autoFocus /></div>
            <div className="field"><label htmlFor="m-price">Prix convenu (€)</label><input id="m-price" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <p className="hint">Frais Middleman : {Number(price) > 0 ? eur(feeCents(Math.round(Number(price) * 100))) : '6 %, minimum 5 €'}. NEXORA ouvre ensuite la transaction et réserve l&apos;annonce.</p>
            <div className="err">{err}</div>
            <div className="actions"><button className="btn pri" onClick={sendRequest}>Envoyer la demande</button><button className="btn" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </div>
      )}
      {toast.node}
    </>
  );
}
