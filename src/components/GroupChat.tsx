'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLocale } from '@/lib/i18n';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { createGroup } from '@/lib/groups';

const hm = (iso: string) => new Date(iso).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ROLE: Record<string, string> = { admin: 'NEXORA', seller: 'Vendeur', buyer: 'Acheteur' };

export default function GroupChat({ kind = 'group' }: { kind?: 'group' | 'direct' }) {
  const { session, isAdmin, aliases } = useData();
  const uid = session.user.id;
  const [allGroups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sel, setSel] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // création / ajout (admin)
  const [title, setTitle] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [addId, setAddId] = useState('');
  const [addRole, setAddRole] = useState<'seller' | 'buyer'>('buyer');

  const load = useCallback(async () => {
    const [g, m, x] = await Promise.all([
      supabase.from('chat_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('chat_group_members').select('*'),
      supabase.from('chat_group_messages').select('*').order('created_at', { ascending: true }),
    ]);
    setGroups(g.data || []);
    setMembers(m.data || []);
    setMsgs(x.data || []);
    if (isAdmin) {
      const p = await supabase.from('profiles').select('id,handle');
      const map: Record<string, string> = {};
      (p.data || []).forEach((y: any) => (map[y.id] = y.handle));
      setNames(map);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const h = window.location.hash.match(/g=([0-9a-f-]{36})/);
    if (h) setSel(h[1]);
  }, []);

  // Discussion directe = NEXORA + une seule personne ; groupe = plusieurs membres
  const isDirect = (gid: string) => members.filter((m) => m.group_id === gid && m.role !== 'admin').length <= 1;
  const direct = kind === 'direct';
  const groups = allGroups.filter((g) => isDirect(g.id) === direct);
  const mine = (gid: string) => members.find((m) => m.group_id === gid && m.user_id === uid);
  const list = msgs.filter((m) => m.group_id === sel);
  const unreadOf = (gid: string) => {
    const me = mine(gid);
    return me ? msgs.filter((m) => m.group_id === gid && m.sender_id !== uid && m.created_at > me.last_read_at).length : 0;
  };
  const lastOf = (gid: string) => msgs.filter((m) => m.group_id === gid).slice(-1)[0];
  const unreadHere = sel ? unreadOf(sel) : 0;

  useEffect(() => {
    if (!sel || !unreadHere) return;
    supabase.from('chat_group_members').update({ last_read_at: new Date().toISOString() }).eq('group_id', sel).eq('user_id', uid).then(() => load());
  }, [sel, unreadHere, uid, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list.length, sel]);

  const who = (gid: string, userId: string) => {
    if (userId === uid) return 'Vous';
    const role = members.find((m) => m.group_id === gid && m.user_id === userId)?.role;
    const base = role === 'admin' ? 'NEXORA' : `${ROLE[role] || 'Membre'} n°${aliases[userId] ?? '—'}`;
    return isAdmin && names[userId] ? `${names[userId]} · ${base}` : base;
  };
  const group = groups.find((g) => g.id === sel);
  const gm = members.filter((m) => m.group_id === sel);

  async function send() {
    const body = text.trim();
    if (!sel || !body) return;
    setErr('');
    setBusy(true);
    const { error } = await supabase.from('chat_group_messages').insert({ group_id: sel, sender_id: uid, body });
    setBusy(false);
    if (error) return setErr(error.message);
    setText('');
    load();
  }

  async function create() {
    setErr('');
    if (title.trim().length < 2) return setErr('Donnez un nom au groupe.');
    const mem: { user_id: string; role: 'seller' | 'buyer' }[] = [];
    if (sellerId) mem.push({ user_id: sellerId, role: 'seller' });
    if (buyerId && buyerId !== sellerId) mem.push({ user_id: buyerId, role: 'buyer' });
    if (!mem.length) return setErr('Choisissez au moins un membre.');
    setBusy(true);
    const r = await createGroup({ title, members: mem, adminId: uid });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setTitle(''); setSellerId(''); setBuyerId('');
    await load();
    if (r.id) setSel(r.id);
  }

  async function addMember() {
    if (!addId || !sel) return;
    const { error } = await supabase.from('chat_group_members').insert({ group_id: sel, user_id: addId, role: addRole });
    if (error) return setErr(error.message.includes('duplicate') ? 'Déjà membre du groupe.' : error.message);
    setAddId('');
    load();
  }

  const people = Object.keys(isAdmin ? names : aliases).filter((id) => id !== uid);
  const labelOf = (id: string) => `${names[id] || '—'} (n°${aliases[id] ?? '—'})`;

  return (
    <div className="split">
      <section className="panel">
        <h2>{direct ? 'Discussions' : 'Groupes'}</h2>
        <div className="list" style={{ marginTop: 10 }}>
          {groups.length === 0 && (direct
            ? <p className="sub">Aucune discussion pour l&apos;instant. {isAdmin ? '' : 'NEXORA ouvre une discussion privée avec vous pendant une transaction.'}</p>
            : <p className="sub">Aucun groupe pour l&apos;instant. {isAdmin ? '' : 'NEXORA peut en créer pour vous mettre en relation avec un acheteur ou un vendeur.'}</p>)}
          {groups.map((g) => (
            <button key={g.id} className="thread" aria-pressed={sel === g.id} onClick={() => setSel(g.id)}>
              <b>{g.title}</b>
              {unreadOf(g.id) > 0 && <span className="n">{unreadOf(g.id)}</span>}
              <span className="meta">{lastOf(g.id)?.body.slice(0, 60) || 'Aucun message'}</span>
            </button>
          ))}
        </div>
        {isAdmin && !direct && (
          <div className="form" style={{ marginTop: 16 }}>
            <h3>Nouveau groupe</h3>
            <div className="field"><label htmlFor="gt">Nom du groupe</label><input id="gt" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. NX-0001 · Middleman" /></div>
            <div className="field"><label htmlFor="gs">Vendeur</label>
              <select id="gs" value={sellerId} onChange={(e) => setSellerId(e.target.value)}><option value="">—</option>{people.map((id) => <option key={id} value={id}>{labelOf(id)}</option>)}</select></div>
            <div className="field"><label htmlFor="gb">Acheteur</label>
              <select id="gb" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}><option value="">—</option>{people.map((id) => <option key={id} value={id}>{labelOf(id)}</option>)}</select></div>
            <div className="actions"><button className="btn pri" disabled={busy} onClick={create}>Créer le groupe</button></div>
          </div>
        )}
      </section>

      <section className="panel chat">
        <h2>{group ? group.title : 'Conversation'}</h2>
        {group && (
          <p className="meta">
            {direct ? 'Discussion privée avec' : 'Membres :'} {gm.filter((m) => !direct || m.user_id !== uid).map((m) => (m.user_id === uid ? 'vous' : who(sel, m.user_id))).join(' · ')}
          </p>
        )}
        <div className="msgs" aria-live="polite">
          {!group && <p className="sub">{direct ? 'Sélectionnez une discussion.' : 'Sélectionnez un groupe.'}</p>}
          {group && !list.length && <p className="sub">Aucun message. Présentez-vous et expliquez la situation.</p>}
          {list.map((m) => (
            <div key={m.id} className={`msg ${m.sender_id === uid ? 'me' : ''}`}>
              <small>{who(sel, m.sender_id)} · {hm(m.created_at)}</small>
              <p>{m.body}</p>
            </div>
          ))}
          <div ref={end} />
        </div>
        {group && (
          <div className="form">
            <div className="field">
              <label htmlFor="gmsg">Votre message</label>
              <textarea id="gmsg" value={text} maxLength={2000} style={{ minHeight: 70 }} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
              <span className="hint">{direct ? 'Ctrl + Entrée pour envoyer. N\'envoyez jamais d\'identifiant ou de mot de passe de jeu.' : 'Ctrl + Entrée pour envoyer. Les noms d\'utilisateur restent masqués : chacun apparaît par son rôle. N\'envoyez jamais d\'identifiant ou de mot de passe de jeu.'}</span>
            </div>
            <div className="err">{err}</div>
            <div className="actions"><button className="btn pri" disabled={busy || !text.trim()} onClick={send}>Envoyer</button></div>
            {isAdmin && !direct && (
              <div className="row2">
                <div className="field"><label htmlFor="am">Ajouter un membre</label>
                  <select id="am" value={addId} onChange={(e) => setAddId(e.target.value)}><option value="">—</option>{people.filter((id) => !gm.some((m) => m.user_id === id)).map((id) => <option key={id} value={id}>{labelOf(id)}</option>)}</select></div>
                <div className="field"><label htmlFor="ar">Rôle</label>
                  <select id="ar" value={addRole} onChange={(e) => setAddRole(e.target.value as any)}><option value="buyer">Acheteur</option><option value="seller">Vendeur</option></select></div>
                <div className="actions" style={{ alignSelf: 'end' }}><button className="btn" onClick={addMember} disabled={!addId}>Ajouter</button></div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
