'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useData } from '@/lib/data';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, session, profile, isAdmin, loading, mine, listings, txs, requests, signOut } = useData();
  const router = useRouter();
  const path = usePathname();

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

  const items: [string, string][] = [
    ['/apercu', 'Aperçu'],
    ['/annonces', 'Mes annonces'],
    ['/ajouter', 'Ajouter un compte'],
    ['/transactions', 'Transactions'],
    ['/analytics', 'Analytics'],
    ['/boutique', 'Ma boutique'],
    ['/avis', 'Avis'],
    ['/compte', 'Mon compte'],
  ];

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img className="logo" src="/logo.webp" alt="NEXORA" />
          <div>
            <b>NEXORA</b>
            <small>Seller Center</small>
          </div>
        </div>
        <p className="tagline">Trade. Evaluate. Connect.</p>
        <nav className="nav" aria-label="Navigation">
          {items.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
              {label}
              {href === '/annonces' && mine.length > 0 ? (
                <span className="n" style={{ background: 'var(--line2)', color: 'var(--fg)' }}>
                  {mine.filter((l) => l.status !== 'archived').length}
                </span>
              ) : null}
            </Link>
          ))}
          {isAdmin && (
            <>
              <span className="sep" />
              <Link href="/moderation" aria-current={path === '/moderation' ? 'page' : undefined}>
                Modération{modCount > 0 ? <span className="n">{modCount}</span> : null}
              </Link>
            </>
          )}
          <span className="sep" />
          <Link href="/parametres" aria-current={path === '/parametres' ? 'page' : undefined}>
            Paramètres
          </Link>
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
    </div>
  );
}
