'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLocale } from '@/lib/i18n';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Head } from '@/components/ui';
import GroupChat from '@/components/GroupChat';

const hm = (iso: string) =>
  new Date(iso).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Messages() {
  const { session, isAdmin, people } = useData();
  const uid = session.user.id;
  const [all, setAll] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sellers, setSellers] = useState<any[]>([]);
  const [sel, setSel] = useState<string>(isAdmin ? '' : uid);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'priv' | 'disc' | 'grp'>('priv');
  useEffect(() => { if (/g=/.test(window.location.hash)) setTab('disc'); }, []);
  const tabs = (
    <div className="chips">
      <button className="chip" aria-pressed={tab === 'priv'} onClick={() => setTab('priv')}>{isAdmin ? 'Vendeurs' : 'Équipe NEXORA'}</button>
      <button className="chip" aria-pressed={tab === 'disc'} onClick={() => setTab('disc')}>Discussions</button>
      <button className="chip" aria-pressed={tab === 'grp'} onClick={() => setTab('grp')}>Groupes</button>
    </div>
  );

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }),
      supabase.from('profiles').select('id,handle,role').order('handle'),
    ]);
    setAll(m.data || []);
    const map: Record<string, string> = {};
    (p.data || []).forEach((x: any) => (map[x.id] = x.handle));
    setNames(map);
    setSellers((p.data || []).filter((x: any) => x.id !== uid && x.role !== 'admin'));
  }, [uid]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    const f = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', f);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', f); };
  }, [load]);

  useEffect(() => { if (isAdmin === false) setSel(uid); }, [isAdmin, uid]);

  // Fils : un par vendeur
  const threads = Array.from(new Set(all.map((m) => m.thread_id))).filter((t) => t !== uid || !isAdmin);
  const msgsOf = (t: string) => all.filter((m) => m.thread_id === t);
  // Non lu pour moi : vendeur = messages reçus de l'équipe ; admin = messages envoyés par le vendeur du fil
  const incoming = (m: any) => (isAdmin ? m.sender_id === m.thread_id : m.sender_id !== uid);
  const unreadOf = (t: string) => msgsOf(t).filter((m) => !m.read_at && incoming(m)).length;
  const lastOf = (t: string) => msgsOf(t).slice(-1)[0];
  const list = sel ? msgsOf(sel) : [];
  const unreadHere = sel ? unreadOf(sel) : 0;

  // Marque comme lu la conversation ouverte
  useEffect(() => {
    if (!sel || !unreadHere) return;
    const ids = msgsOf(sel).filter((m) => !m.read_at && incoming(m)).map((m) => m.id);
    if (ids.length) supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, unreadHere]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list.length, sel]);

  async function send() {
    setErr('');
    const body = text.trim();
    if (!sel) return setErr('Choisissez un destinataire.');
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from('messages').insert({ thread_id: sel, sender_id: uid, body });
    setBusy(false);
    if (error) return setErr(error.message);
    setText('');
    load();
  }

  const label = (m: any) => (m.sender_id === uid ? 'Vous' : isAdmin ? names[m.sender_id] || 'Vendeur' : 'Équipe NEXORA');
  const newTargets = sellers.filter((s) => !threads.includes(s.id));

  const conversation = (
    <section className="panel chat">
      <h2>{isAdmin ? (sel ? names[sel] || 'Vendeur' : 'Conversation') : 'Équipe NEXORA'}</h2>
      <div className="msgs" aria-live="polite">
        {!sel && <p className="sub">Sélectionnez une conversation ou démarrez-en une.</p>}
        {sel && !list.length && <p className="sub">Aucun message pour l&apos;instant. {isAdmin ? '' : 'Écrivez à l’équipe NEXORA ci-dessous.'}</p>}
        {list.map((m) => (
          <div key={m.id} className={`msg ${m.sender_id === uid ? 'me' : ''}`}>
            <small>{label(m)} · {hm(m.created_at)}{m.sender_id === uid && m.read_at ? ' · lu' : ''}</small>
            <p>{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {sel && (
        <div className="form">
          <div className="field">
            <label htmlFor="msg">Votre message</label>
            <textarea id="msg" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} style={{ minHeight: 70 }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
              placeholder="Question sur une annonce, une transaction, un paiement…" />
            <span className="hint">Ctrl + Entrée pour envoyer. N&apos;envoyez jamais d&apos;identifiant ou de mot de passe de jeu.</span>
          </div>
          <div className="err">{err}</div>
          <div className="actions"><button className="btn pri" disabled={busy || !text.trim()} onClick={send}>Envoyer</button></div>
        </div>
      )}
    </section>
  );

  if (!isAdmin) {
    return (
      <>
        <Head title="Messages" text="Conversation privée avec l'équipe NEXORA. Vous seul et les administrateurs la voyez." />
        {tabs}
        {tab === 'grp' ? <GroupChat kind="group" /> : tab === 'disc' ? <GroupChat kind="direct" /> : conversation}
      </>
    );
  }

  return (
    <>
      <Head title="Messages" text="Conversations privées avec les membres et groupes de mise en relation." />
      {tabs}
      {tab === 'grp' ? <GroupChat kind="group" /> : tab === 'disc' ? <GroupChat kind="direct" /> : (
      <div className="split">
        <section className="panel">
          <h2>Conversations</h2>
          <div className="list" style={{ marginTop: 10 }}>
            {threads.length === 0 && <p className="sub">Aucune conversation.</p>}
            {threads
              .sort((a, b) => (lastOf(b)?.created_at || '').localeCompare(lastOf(a)?.created_at || ''))
              .map((t) => (
                <button key={t} className="thread" aria-pressed={sel === t} onClick={() => setSel(t)}>
                  <b>{names[t] || 'Vendeur'}</b>
                  {unreadOf(t) > 0 && <span className="n">{unreadOf(t)}</span>}
                  <span className="meta">{lastOf(t)?.body.slice(0, 60)}</span>
                </button>
              ))}
          </div>
          {newTargets.length > 0 && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="new">Nouvelle conversation</label>
              <select id="new" value="" onChange={(e) => e.target.value && setSel(e.target.value)}>
                <option value="">Choisir un vendeur…</option>
                {newTargets.map((s) => <option key={s.id} value={s.id}>{s.handle}</option>)}
              </select>
            </div>
          )}
        </section>
        {conversation}
      </div>
      )}
    </>
  );
}
