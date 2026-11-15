'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { fmtD } from '@/lib/util';
import { Empty, Head, useToast } from '@/components/ui';

export default function Avis() {
  const { session, isAdmin } = useData();
  const uid = session.user.id;
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sellers, setSellers] = useState<any[]>([]);
  const [target, setTarget] = useState('');
  const [rating, setRating] = useState(8);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('seller_reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,handle').order('handle'),
    ]);
    setRows(r.data || []);
    const m: Record<string, string> = {};
    (p.data || []).forEach((x: any) => (m[x.id] = x.handle));
    setNames(m);
    setSellers((p.data || []).filter((x: any) => x.id !== uid));
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const received = rows.filter((r) => r.seller_id === uid);
  const avg = received.length ? received.reduce((a, r) => a + r.rating, 0) / received.length : null;
  const given = rows.filter((r) => r.reviewer_id === uid);

  async function send() {
    setErr('');
    if (!target) return setErr('Choisissez le vendeur concerné.');
    const mine = given.find((g) => g.seller_id === target);
    const body = { reviewer_id: uid, seller_id: target, rating, comment: comment.trim() || null };
    const { error } = mine
      ? await supabase.from('seller_reviews').update({ rating, comment: body.comment }).eq('id', mine.id)
      : await supabase.from('seller_reviews').insert(body);
    if (error) return setErr(error.message);
    setComment('');
    toast.show(mine ? 'Avis mis à jour.' : 'Avis publié.');
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from('seller_reviews').delete().eq('id', id);
    toast.show(error ? error.message : 'Avis supprimé.');
    load();
  }

  const item = (r: any, who: string, label: string) => (
    <article className="item" key={r.id}>
      <div>
        <span className="ref">{label}</span>
        <h3>{who}</h3>
        {r.comment ? <p className="meta" style={{ color: 'var(--fg)' }}>{r.comment}</p> : null}
        <p className="meta">{fmtD(r.created_at)}</p>
      </div>
      <div className="side2"><span className="price">{r.rating}/10</span></div>
      {(r.reviewer_id === uid || isAdmin) && <div className="act actions"><button className="btn sm bad" onClick={() => del(r.id)}>Supprimer</button></div>}
    </article>
  );

  return (
    <>
      <Head title="Avis" text="Notez un vendeur sur 10 et consultez les avis reçus. Chaque avis affiche le pseudo de son auteur." />
      <div className="kpis">
        <div className="kpi"><div className="l">Ma note</div><div className="v">{avg == null ? '—' : `${avg.toFixed(1)}/10`}</div><div className="s">moyenne des avis reçus</div></div>
        <div className="kpi"><div className="l">Avis reçus</div><div className="v">{received.length}</div><div className="s">sur votre profil</div></div>
        <div className="kpi"><div className="l">Avis donnés</div><div className="v">{given.length}</div><div className="s">un avis par vendeur</div></div>
      </div>

      <section className="panel">
        <h2>Laisser un avis</h2>
        <div className="form">
          <div className="row2">
            <div className="field"><label htmlFor="t">Vendeur</label>
              <select id="t" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choisir…</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.handle}</option>)}
              </select></div>
            <div className="field"><label htmlFor="n">Note : {rating}/10</label>
              <input id="n" type="range" min={1} max={10} step={1} value={rating} onChange={(e) => setRating(Number(e.target.value))} /></div>
          </div>
          <div className="field"><label htmlFor="c">Commentaire (facultatif)</label>
            <textarea id="c" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Votre expérience avec ce vendeur…" style={{ minHeight: 70 }} /></div>
          <div className="err">{err}</div>
          <div className="actions"><button className="btn pri" onClick={send}>Publier l&apos;avis</button></div>
          <p className="hint">Un seul avis par vendeur : en renvoyer un le remplace. Pas d&apos;avis sur soi-même.</p>
        </div>
      </section>

      <section className="panel">
        <h2>Avis reçus ({received.length})</h2>
        {received.length ? <div className="list">{received.map((r) => item(r, names[r.reviewer_id] || 'membre', 'de'))}</div> : <Empty title="Aucun avis reçu" text="Les avis laissés sur votre profil apparaîtront ici." />}
      </section>

      {given.length > 0 && (
        <section className="panel">
          <h2>Avis donnés ({given.length})</h2>
          <div className="list">{given.map((r) => item(r, names[r.seller_id] || 'vendeur', 'pour'))}</div>
        </section>
      )}
      {toast.node}
    </>
  );
}
