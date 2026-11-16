'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { fmtD } from '@/lib/util';
import { Empty, Head, useToast } from '@/components/ui';

export default function Avis() {
  const { session, isAdmin, aliases, txs, listings, people } = useData();
  const uid = session.user.id;
  const [rows, setRows] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [err, setErr] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await supabase.from('middleman_reviews').select('*').order('created_at', { ascending: false });
    setRows(r.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : null;
  const mineRev = rows.filter((r) => r.reviewer_id === uid);

  // Transactions finalisées auxquelles je participe et que je n'ai pas encore évaluées
  const todo = txs
    .filter((t) => t.status === 'completed' && (t.seller_id === uid || t.buyer_id === uid) && !mineRev.some((r) => r.transaction_id === t.id))
    .map((t) => ({ t, role: t.seller_id === uid ? 'seller' : 'buyer', l: listings.find((x) => x.id === t.listing_id) }));

  const who = (r: any) => {
    const base = `${r.reviewer_role === 'seller' ? 'Vendeur' : 'Acheteur'} n°${aliases[r.reviewer_id] ?? '—'}`;
    const h = isAdmin ? people[r.reviewer_id]?.handle : null;
    return h ? `${h} · ${base}` : base;
  };
  const d = (id: string) => draft[id] || { rating: 8, comment: '' };

  async function send(t: any, role: string) {
    setErr('');
    const v = d(t.id);
    const { error } = await supabase.from('middleman_reviews').insert({
      transaction_id: t.id, reviewer_id: uid, reviewer_role: role, rating: v.rating, comment: v.comment.trim() || null,
    });
    if (error) return setErr(error.message);
    toast.show('Avis publié. Merci !');
    load();
  }
  async function del(id: string) {
    const { error } = await supabase.from('middleman_reviews').delete().eq('id', id);
    toast.show(error ? error.message : 'Avis supprimé.');
    load();
  }

  return (
    <>
      <Head title="Avis Middleman" text="Évaluez le service Middleman NEXORA après une transaction finalisée. Les avis sont publics et affichent uniquement un numéro de membre." />
      <div className="kpis">
        <div className="kpi"><div className="l">Note Middleman</div><div className="v">{avg == null ? '—' : `${avg.toFixed(1)}/10`}</div><div className="s">moyenne de tous les avis</div></div>
        <div className="kpi"><div className="l">Avis publiés</div><div className="v">{rows.length}</div><div className="s">transactions évaluées</div></div>
        {!isAdmin && <div className="kpi"><div className="l">À évaluer</div><div className="v">{todo.length}</div><div className="s">vos transactions finalisées</div></div>}
      </div>

      {!isAdmin && todo.length > 0 && (
        <section className="panel">
          <h2>Évaluer une transaction</h2>
          <div className="list" style={{ marginTop: 10 }}>
            {todo.map(({ t, role, l }) => (
              <article className="item" key={t.id} style={{ display: 'block' }}>
                <span className="ref">{l?.ref} · en tant que {role === 'seller' ? 'vendeur' : 'acheteur'}</span>
                <h3>{l?.title || 'Transaction'}</h3>
                <div className="form" style={{ marginTop: 8 }}>
                  <div className="field"><label htmlFor={`n-${t.id}`}>Note du service Middleman : {d(t.id).rating}/10</label>
                    <input id={`n-${t.id}`} type="range" min={1} max={10} step={1} value={d(t.id).rating} onChange={(e) => setDraft({ ...draft, [t.id]: { ...d(t.id), rating: Number(e.target.value) } })} /></div>
                  <div className="field"><label htmlFor={`c-${t.id}`}>Commentaire (facultatif)</label>
                    <textarea id={`c-${t.id}`} maxLength={600} style={{ minHeight: 64 }} value={d(t.id).comment} onChange={(e) => setDraft({ ...draft, [t.id]: { ...d(t.id), comment: e.target.value } })} placeholder="Suivi, rapidité, sécurité de la transaction…" /></div>
                  <div className="actions"><button className="btn pri" onClick={() => send(t, role)}>Publier l&apos;avis</button></div>
                </div>
              </article>
            ))}
          </div>
          <div className="err">{err}</div>
        </section>
      )}

      <section className="panel">
        <h2>Avis sur le Middleman ({rows.length})</h2>
        {rows.length ? (
          <div className="list" style={{ marginTop: 10 }}>
            {rows.map((r) => (
              <article className="item" key={r.id}>
                <div>
                  <span className="ref">{who(r)}</span>
                  {r.comment ? <p style={{ overflowWrap: 'anywhere' }}>{r.comment}</p> : <p className="meta">Sans commentaire</p>}
                  <p className="meta">{fmtD(r.created_at)}</p>
                </div>
                <div className="side2"><span className="price">{r.rating}/10</span></div>
                {(isAdmin || r.reviewer_id === uid) && <div className="act actions"><button className="btn sm bad" onClick={() => del(r.id)}>Supprimer</button></div>}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Aucun avis pour l'instant" text="Les avis apparaissent ici après les premières transactions Middleman finalisées." />
        )}
      </section>
      {toast.node}
    </>
  );
}
