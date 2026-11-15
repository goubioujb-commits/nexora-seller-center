'use client';

import { useRef, useState } from 'react';
import { compress, MAX_PHOTOS, PhotoItem } from '@/lib/photos';
import { useUrls } from './Photos';

export default function PhotoPicker({ items, onChange, disabled }: { items: PhotoItem[]; onChange: (n: PhotoItem[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const urls = useUrls(items.filter((i) => i.kind === 'old').map((i: any) => i.path));

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setMsg('');
    setBusy(true);
    const room = MAX_PHOTOS - items.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    const added: PhotoItem[] = [];
    const errs: string[] = [];
    for (const f of list) {
      try {
        const c = await compress(f);
        added.push({ key: crypto.randomUUID(), kind: 'new', file: c, preview: URL.createObjectURL(c) });
      } catch (e: any) {
        errs.push(e.message || 'Image illisible.');
      }
    }
    if (files.length > room) errs.push(`Maximum ${MAX_PHOTOS} photos : ${files.length - room} ignorée(s).`);
    onChange([...items, ...added]);
    setMsg(errs.join(' '));
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  const move = (i: number, d: number) => {
    const n = [...items];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));

  return (
    <div className="field">
      <label>Photos du compte ({items.length}/{MAX_PHOTOS})</label>
      <div className="photos">
        {items.map((it, i) => {
          const src = it.kind === 'new' ? it.preview : urls[it.path];
          return (
            <div className="ph" key={it.key}>
              {src ? <img src={src} alt={`Photo ${i + 1}`} /> : <span className="meta">…</span>}
              {i === 0 && <em>Couverture</em>}
              <div className="ph-a">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || disabled} aria-label="Reculer">‹</button>
                <button type="button" onClick={() => remove(i)} disabled={disabled} aria-label="Retirer">✕</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1 || disabled} aria-label="Avancer">›</button>
              </div>
            </div>
          );
        })}
        {items.length < MAX_PHOTOS && (
          <button type="button" className="ph add" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? 'Préparation…' : '+ Ajouter'}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
      <span className="hint">Captures d&apos;écran du profil, des monstres, des runes… JPEG, PNG ou WebP, réduites automatiquement. La première photo sert de couverture. Masquez votre pseudo et votre ID en jeu.</span>
      {msg && <div className="err">{msg}</div>}
    </div>
  );
}
