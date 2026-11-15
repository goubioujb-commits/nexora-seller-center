'use client';

import { useEffect, useState } from 'react';
import { signedUrls, sortImages } from '@/lib/photos';

export function useUrls(paths: string[]) {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = paths.join('|');
  useEffect(() => {
    let off = false;
    if (paths.length) signedUrls(paths).then((m) => !off && setMap(m));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

// Vignette de couverture (première photo)
export function Cover({ images, size = 'md' }: { images?: any[]; size?: 'sm' | 'md' }) {
  const imgs = sortImages(images);
  const urls = useUrls(imgs.slice(0, 1).map((i) => i.storage_path));
  const u = imgs[0] && urls[imgs[0].storage_path];
  return (
    <div className={`cover ${size}`}>
      {u ? <img src={u} alt="" loading="lazy" /> : <span>{imgs.length ? '…' : 'Pas de photo'}</span>}
      {imgs.length > 1 && <b>{imgs.length}</b>}
    </div>
  );
}

// Galerie + visionneuse plein écran
export function Gallery({ images }: { images?: any[] }) {
  const imgs = sortImages(images);
  const urls = useUrls(imgs.map((i) => i.storage_path));
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % imgs.length));
      if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + imgs.length) % imgs.length));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, imgs.length]);

  if (!imgs.length) return <p className="meta">Aucune photo.</p>;
  return (
    <>
      <div className="gallery">
        {imgs.map((im, i) => (
          <button key={im.id} type="button" className="g-th" onClick={() => setOpen(i)} aria-label={`Photo ${i + 1} sur ${imgs.length}`}>
            {urls[im.storage_path] ? <img src={urls[im.storage_path]} alt="" loading="lazy" /> : null}
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="overlay lb" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <button className="btn sm lb-x" onClick={() => setOpen(null)}>Fermer</button>
          {imgs.length > 1 && <button className="btn lb-p" onClick={() => setOpen((open - 1 + imgs.length) % imgs.length)} aria-label="Précédente">‹</button>}
          {urls[imgs[open].storage_path] && <img className="lb-img" src={urls[imgs[open].storage_path]} alt={`Photo ${open + 1}`} />}
          {imgs.length > 1 && <button className="btn lb-n" onClick={() => setOpen((open + 1) % imgs.length)} aria-label="Suivante">›</button>}
          <span className="lb-c">{open + 1} / {imgs.length}</span>
        </div>
      )}
    </>
  );
}
