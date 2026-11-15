'use client';

import { useData } from '@/lib/data';
import { eur, REGION } from '@/lib/util';
import { Head, Pill } from '@/components/ui';

export default function Boutique() {
  const { mine, txs, profile, session } = useData();
  const uid = session.user.id;
  const handle = profile?.handle || 'vendeur';
  const shown = mine.filter((l) => l.status === 'active' || l.status === 'reserved');
  const done = txs.filter((t) => t.seller_id === uid && t.status === 'completed').length;
  const age = Math.max(0, Math.floor((Date.now() - +new Date(profile?.created_at || Date.now())) / 864e5));

  return (
    <>
      <Head title="Ma boutique" text="Aperçu de votre vitrine publique. Elle affichera vos annonces actives une fois le catalogue NEXORA en ligne." />
      <section className="panel">
        <div className="store-head">
          <div className="avatar">{handle.charAt(0).toUpperCase()}</div>
          <div>
            <h2 style={{ fontSize: 20 }}>{handle}</h2>
            <p style={{ color: 'var(--mut)', fontSize: 13 }}>
              Vendeur Summoners War: Sky Arena · vendeur n°{profile?.seller_number ?? '—'}
            </p>
          </div>
        </div>
      </section>
      <div className="kpis">
        <div className="kpi"><div className="l">Ancienneté</div><div className="v">{age} j</div><div className="s">depuis l&apos;inscription</div></div>
        <div className="kpi"><div className="l">Ventes finalisées</div><div className="v">{done}</div><div className="s">confirmées par NEXORA</div></div>
        <div className="kpi"><div className="l">Avis vérifiés</div><div className="v">0</div><div className="s">réservés aux acheteurs de transactions terminées</div></div>
      </div>
      <section className="panel">
        <h2>Comptes disponibles</h2>
        {shown.length ? (
          <div className="card-grid">
            {shown.map((l) => (
              <div className="card" key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ font: '500 11px var(--f-mono)', color: 'var(--mut)' }}>{l.ref} · {REGION[l.region]}</span>
                  <Pill status={l.status} />
                </div>
                <h3 style={{ overflowWrap: 'anywhere' }}>{l.title}</h3>
                <div className="mon">
                  {l.ld5_count > 0 && <span style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>{l.ld5_count} LD5</span>}
                  {(l.listing_monsters || []).map((m: any) => <span key={m.id}>{m.monster_name}</span>)}
                </div>
                <div className="price">{eur(l.price_cents)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="sub">Aucune annonce active pour l&apos;instant.</p>
        )}
      </section>
      <p className="legal">
        NEXORA n&apos;est pas affilié à Com2uS. Les conditions d&apos;utilisation de Com2uS indiquent que les comptes restent sa propriété et interdisent leur vente
        commerciale, ce qui peut exposer un compte à des sanctions. Les estimations de prix sont indicatives et ne garantissent aucune valeur. Les transactions ne
        sont pas autorisées officiellement par Com2uS.
      </p>
    </>
  );
}
