'use client';

import { ReactNode, useEffect, useState } from 'react';
import { eur, feeCents, fmtD, REGION } from '@/lib/util';
import { sortImages } from '@/lib/photos';
import { Pill } from './ui';
import { useUrls } from './Photos';

// Fiche détaillée d'une annonce : grande photo, miniatures, caractéristiques, description.
export default function ListingDetail({ listing, seller, onClose, children }: { listing: any; seller?: string; onClose: () => void; children?: ReactNode }) {
  const imgs = sortImages(listing.listing_images);
  const urls = useUrls(imgs.map((i) => i.storage_path));
  const [cur, setCur] = useState(0);
  const mons = (listing.listing_monsters || []).map((m: any) => m.monster_name);
  const big = imgs[cur] && urls[imgs[cur].storage_path];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (imgs.length > 1 && e.key === 'ArrowRight') setCur((c) => (c + 1) % imgs.length);
      if (imgs.length > 1 && e.key === 'ArrowLeft') setCur((c) => (c - 1 + imgs.length) % imgs.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [imgs.length, onClose]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-label={listing.title}>
        <div className="d-top">
          <span className="ref">{listing.ref} · {REGION[listing.region]}</span>
          <button className="btn sm" onClick={onClose}>Fermer</button>
        </div>

        {imgs.length > 0 ? (
          <div className="d-gal">
            <div className="d-big">
              {big ? <img src={big} alt={`Photo ${cur + 1} sur ${imgs.length}`} /> : <span className="meta">Chargement…</span>}
              {imgs.length > 1 && (
                <>
                  <button className="btn d-p" onClick={() => setCur((cur - 1 + imgs.length) % imgs.length)} aria-label="Photo précédente">‹</button>
                  <button className="btn d-n" onClick={() => setCur((cur + 1) % imgs.length)} aria-label="Photo suivante">›</button>
                  <b>{cur + 1} / {imgs.length}</b>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="d-th">
                {imgs.map((im, i) => (
                  <button key={im.id} type="button" aria-pressed={i === cur} onClick={() => setCur(i)} aria-label={`Photo ${i + 1}`}>
                    {urls[im.storage_path] ? <img src={urls[im.storage_path]} alt="" loading="lazy" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="meta">Aucune photo pour cette annonce.</p>
        )}

        <div className="d-head">
          <h2 style={{ overflowWrap: 'anywhere' }}>{listing.title}</h2>
          <Pill status={listing.status} />
        </div>
        <div className="d-price">{eur(listing.price_cents)}</div>

        <dl className="d-facts">
          <div><dt>Région</dt><dd>{REGION[listing.region]}</dd></div>
          <div><dt>LD5</dt><dd>{listing.ld5_count || 0}</dd></div>
          <div><dt>Vendeur</dt><dd>{seller || '—'}</dd></div>
          <div><dt>Créée le</dt><dd>{fmtD(listing.created_at)}</dd></div>
          <div><dt>Publiée le</dt><dd>{fmtD(listing.published_at)}</dd></div>
          <div><dt>Frais Middleman</dt><dd>{eur(feeCents(listing.price_cents))}</dd></div>
        </dl>

        {mons.length > 0 && (
          <div>
            <h3 className="d-h">Monstres clés</h3>
            <div className="chips2">{mons.map((m: string) => <span key={m}>{m}</span>)}</div>
          </div>
        )}
        {listing.description && (
          <div>
            <h3 className="d-h">Description</h3>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--fg)' }}>{listing.description}</p>
          </div>
        )}
        {children ? <div className="actions">{children}</div> : null}
        <p className="hint">Aucun identifiant de jeu n&apos;est jamais affiché ni stocké par NEXORA.</p>
      </div>
    </div>
  );
}
