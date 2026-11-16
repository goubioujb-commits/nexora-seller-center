'use client';

import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useData } from '@/lib/data';
import { LangSwitch } from '@/lib/i18n';
import Notifier from '@/components/Notifier';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, session, profile, isAdmin, loading, mine, listings, txs, requests, signOut } = useData();
  const router = useRouter();
  const path = usePathname();
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const myId = session?.user?.id;

  // Messages non lus (relevé toutes les 30 s)
  useEffect(() => {
    if (!myId || !profile) return;
    let off = false;
    const run = async () => {
      const { data } = await supabase.from('messages').select('thread_id,sender_id').is('read_at', null);
      if (off) return;
      const admin = profile.role === 'admin';
      let n = (data || []).filter((m: any) => (admin ? m.sender_id === m.thread_id : m.sender_id !== myId)).length;
      const mem = await supabase.from('chat_group_members').select('group_id,last_read_at').eq('user_id', myId);
      if (!off && mem.data?.length) {
        const last: Record<string, string> = {};
        mem.data.forEach((x: any) => (last[x.group_id] = x.last_read_at));
        const gm = await supabase.from('chat_group_messages').select('group_id,sender_id,created_at').in('group_id', Object.keys(last)).order('created_at', { ascending: false }).limit(300);
        n += (gm.data || []).filter((m: any) => m.sender_id !== myId && m.created_at > last[m.group_id]).length;
      }
      if (off) return;
      setUnreadMsgs(n);
    };
    run();
    const t = setInterval(run, 30000);
    return () => { off = true; clearInterval(t); };
  }, [myId, profile, path]);

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  if (!ready || !session || (loading && !profile)) {
    return <div className="banner info" style={{ maxWidth: 420, margin: '20vh auto 0' }}>Chargement de votre espace…</div>;
  }

  const pending = listings.filter((l) => l.status === 'pending').length;
  const openReq = requests.filter((r) => r.status === 'open').length;
  const openTx = txs.filter((t) => !['completed', 'cancelled'].includes(t.status)).length;
  const modCount = pending + openReq + openTx;

  const annCount = mine.filter((l) => l.status !== 'archived').length;
  type Item = { href: string; label: string; badge?: number; ext?: boolean; soft?: boolean };
  type Group = { id: string; label: string; items: Item[] };
  const groups: Group[] = [
    { id: 'market', label: 'Marketplace', items: [{ href: '/catalogue', label: 'Catalogue' }, { href: '/transactions', label: 'Transactions' }] },
    { id: 'sell', label: 'Vendre', items: [
      { href: '/annonces', label: 'Mes annonces', badge: annCount, soft: true },
      { href: '/ajouter', label: 'Ajouter un compte' },
      { href: '/boutique', label: 'Ma boutique' },
      { href: '/analytics', label: 'Analytics' },
    ] },
    { id: 'talk', label: 'Échanges', items: [{ href: '/messages', label: 'Messages', badge: unreadMsgs }, { href: '/avis', label: 'Avis Middleman' }] },
    { id: 'me', label: 'Mon espace', items: [{ href: '/compte', label: 'Mon compte' }, { href: '/parametres', label: 'Paramètres' }] },
  ];
  if (isAdmin) groups.push({ id: 'admin', label: 'Administration', items: [{ href: '/moderation', label: 'Modération', badge: modCount }] });
  groups.push({ id: 'nx', label: 'NEXORA', items: [{ href: '/', label: "Page d'accueil" }, { href: 'https://discord.gg/yKp3YsA6J', label: 'Discord NEXORA ↗', ext: true }] });

  const isOpen = (g: Group) => (g.id in open ? open[g.id] : g.items.some((i) => !i.ext && i.href !== '/' && path === i.href));
  const toggle = (g: Group) => setOpen((o) => ({ ...o, [g.id]: !isOpen(g) }));

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img className="logo" src="/logo.webp" alt="NEXORA" />
          <div>
            <b>NEXORA</b>
            <small>Seller Center</small>
          </div>
          <LangSwitch />
        </div>
        <p className="tagline">Trade. Evaluate. Connect.</p>
        <nav className="nav nav-groups" aria-label="Navigation">
          <Link href="/apercu" aria-current={path === '/apercu' ? 'page' : undefined}>Aperçu</Link>
          {groups.map((g) => {
            const o = isOpen(g);
            const hidden = g.items.reduce((n, i) => n + (i.badge && !i.soft ? i.badge : 0), 0);
            return (
              <div key={g.id} className="ngroup">
                <button type="button" className="nhead" aria-expanded={o} onClick={() => toggle(g)}>
                  <span>{g.label}</span>
                  <span className="nright">
                    {!o && hidden > 0 ? <span className="n">{hidden}</span> : null}
                    <i className="chev" aria-hidden="true" />
                  </span>
                </button>
                {o && (
                  <div className="nsub">
                    {g.items.map((i) =>
                      i.ext ? (
                        <a key={i.href} href={i.href} target="_blank" rel="noopener noreferrer">{i.label}</a>
                      ) : (
                        <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}>
                          {i.label}
                          {i.badge && i.badge > 0 ? (
                            <span className="n" style={i.soft ? { background: 'var(--line2)', color: 'var(--fg)' } : undefined}>{i.badge}</span>
                          ) : null}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="who">
          <span>{profile?.handle || 'vendeur'}{isAdmin ? ' · admin' : ''}</span>
          <span>{session.user.email}</span>
          <button className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={async () => { await signOut(); router.replace('/login'); }}>
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <Notifier unread={unreadMsgs} />
    </div>
  );
}
