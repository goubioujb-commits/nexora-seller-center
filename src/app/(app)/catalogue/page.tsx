'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { eur, REGION } from '@/lib/util';
import { Empty, Head, useToast } from '@/components/ui';
import { Cover } from '@/components/Photos';
import ListingDetail from '@/components/ListingDetail';

export default function Catalogue() {
  const { listings, requests, session, aliases, isAdmin, people, requestPurchase } = useData();
  const uid = session.user.id;
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [maxP, setMaxP] = useState('');
  const [minLd5, setMinLd5] = useState('');
  const [sort, setSort] = useState('new');
  const [open, setOpen] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showF, setShowF] = useState(false);
  const nF = [q.trim(), region, Number(maxP) > 0 ? maxP : '', Number(minLd5) > 0 ? minLd5 : '', sort !== 'new' ? sort : ''].filter(Boolean).length;
  const reset = () => { setQ(''); setRegion(''); setMaxP(''); setMinLd5(''); setSort('new'); };
  const toast = useToast();

  const sellerName = (l: any) =>
    isAdmin && people[l.seller_id]?.handle ? `${people[l.seller_id].handle} (Vendeur n°${aliases[l.seller_id] ?? '—'})` : `Vendeur n°${aliases[l.seller_id] ?? '—'}`;

  const rows = useMemo(() => {
    let r = listings.filter((l) => l.status === 'active' && l.seller_id !== uid);
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((l) => (l.title + ' ' + (l.listing_monsters || []).map((m: any) => m.monster_name).join(' ') + ' ' + l.ref).toLowerCase().includes(t));
    if (region) r = r.filter((l) => l.region === region);
    if (Number(maxP) > 0) r = r.filter((l) => l.price_cents <= Number(maxP) * 100);
    if (Number(minLd5) > 0) r = r.filter((l) => (l.ld5_count || 0) >= Number(minLd5));
    r = [...r].sort((a, b) => (sort === 'asc' ? a.price_cents - b.price_cents : sort === 'desc' ? b.price_cents - a.price_cents : +new Date(b.published_at || b.created_at) - +new Date(a.published_at || a.created_at)));
    return r;
  }, [listings, uid, q, region, maxP, minLd5, sort]);

  const hasReq = (id: string) => requests.some((r) => r.listing_id === id && r.buyer_id === uid && r.status === 'open');

  async function buy(l: any) {
    setBusy(true);
    const e = await requestPurchase(l.id);
    setBusy(false);
    toast.show(e || 'Demande envoyée à NEXORA. Vous serez contacté par un administrateur.');
  }

  return (
    <>
      <Head title="Catalogue" text="Comptes Summoners War disponibles. Les identités restent privées : seul NEXORA connaît les noms d'utilisateur et vous met en relation si besoin." />
      <div className="filterbar">
        <button type="button" className="btn sm" aria-expanded={showF} aria-controls="filtres" onClick={() => setShowF(!showF)}>
          Filtres{nF > 0 ? <span className="n" style={{ marginLeft: 8, font: '500 11px var(--f-mono)', background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 99, padding: '0 7px', lineHeight: '18px' }}>{nF}</span> : null}
        </button>
        {nF > 0 && <button type="button" className="btn sm" onClick={reset}>Réinitialiser</button>}
        <span className="hint">{rows.length} {rows.length > 1 ? 'comptes' : 'compte'}</span>
      </div>
      {showF && <section className="panel" id="filtres">
        <div className="form">
          <div className="row2">
            <div className="field"><label htmlFor="q">Recherche</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Monstre, titre, référence…" /></div>
            <div className="field"><label htmlFor="r">Région</label>
              <select id="r" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">Toutes</option>
                {Object.keys(REGION).map((k) => <option key={k} value={k}>{REGION[k]}</option>)}
              </select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="p">Prix maximum (€)</label><input id="p" type="number" min={0} inputMode="numeric" value={maxP} onChange={(e) => setMaxP(e.target.value)} /></div>
            <div className="field"><label htmlFor="l">LD5 minimum</label><input id="l" type="number" min={0} inputMode="numeric" value={minLd5} onChange={(e) => setMinLd5(e.target.value)} /></div>
            <div className="field"><label htmlFor="s">Tri</label>
              <select id="s" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="new">Plus récentes</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option>
              </select></div>
          </div>
        </div>
      </section>}

      {rows.length ? (
        <div className="card-grid">
          {rows.map((l) => (
            <div className="card click" key={l.id} role="button" tabIndex={0} onClick={() => setOpen(l)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(l))}>
              <Cover images={l.listing_images} />
              <span style={{ font: '500 11px var(--f-mono)', color: 'var(--mut)' }}>{l.ref} · {REGION[l.region]} · Vendeur n°{aliases[l.seller_id] ?? '—'}</span>
              <h3 style={{ overflowWrap: 'anywhere' }}>{l.title}</h3>
              <div className="mon">
                {l.ld5_count > 0 && <span style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>{l.ld5_count} LD5</span>}
                {(l.listing_monsters || []).slice(0, 6).map((m: any) => <span key={m.id}>{m.monster_name}</span>)}
              </div>
              <div className="price">{eur(l.price_cents)}</div>
              {hasReq(l.id) && <span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>Demande envoyée</span>}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Aucun compte ne correspond" text="Modifiez vos filtres, ou revenez plus tard : de nouvelles annonces arrivent régulièrement." />
      )}

      {open && (
        <ListingDetail listing={listings.find((x) => x.id === open.id) || open} seller={sellerName(open)} onClose={() => setOpen(null)}>
          {hasReq(open.id) ? (
            <span className="pill" style={{ ['--c' as any]: 'var(--res)' }}>Demande Middleman envoyée</span>
          ) : (
            <button className="btn pri" disabled={busy || open.status !== 'active'} onClick={() => buy(open)}>Demander un Middleman · {eur(open.price_cents)}</button>
          )}
          <span className="hint">Frais Middleman 6 % (minimum 5 €). NEXORA vérifie la demande, puis vous met en relation avec le vendeur.</span>
        </ListingDetail>
      )}
      <p className="legal">
        NEXORA n&apos;est pas affilié à Com2uS. Leurs conditions interdisent la vente de comptes, ce qui peut exposer un compte à des sanctions. NEXORA ne garantit
        pas la transaction et n&apos;est pas autorisé officiellement par Com2uS.
      </p>
      {toast.node}
    </>
  );
}
