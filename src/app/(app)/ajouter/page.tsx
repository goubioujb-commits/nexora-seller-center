'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/lib/data';
import { eur, feeCents, REGION } from '@/lib/util';
import { Head } from '@/components/ui';
import PhotoPicker from '@/components/PhotoPicker';
import { PhotoItem, sortImages, syncPhotos } from '@/lib/photos';

type F = { title: string; region: string; ld5: string; monsters: string; price: string; description: string; ack: boolean };
const BLANK: F = { title: '', region: 'europe', ld5: '0', monsters: '', price: '', description: '', ack: false };

function PreviewCover({ photos }: { photos: PhotoItem[] }) {
  const first = photos[0];
  const [u, setU] = useState('');
  useEffect(() => {
    let off = false;
    if (first?.kind === 'new') setU(first.preview);
    else if (first) import('@/lib/photos').then((m) => m.signedUrls([first.path])).then((r) => !off && setU(r[first.path] || ''));
    else setU('');
    return () => { off = true; };
  }, [first]);
  return <div className="cover md">{u ? <img src={u} alt="" /> : <span>Pas de photo</span>}{photos.length > 1 && <b>{photos.length}</b>}</div>;
}

function Form() {
  const params = useSearchParams();
  const id = params.get('id');
  const router = useRouter();
  const { mine, saveListing, loading, refresh, session, autoPublish } = useData();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const photoErr = params.get('photoerr');
  const base = id ? mine.find((l) => l.id === id) : null;
  const [f, setF] = useState<F>(BLANK);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => { loaded.current = false; }, [id]);

  useEffect(() => {
    if (base && !loaded.current) {
      loaded.current = true;
      setPhotos(sortImages(base.listing_images).map((im: any) => ({ key: im.id, kind: 'old' as const, id: im.id, path: im.storage_path })));
      setF({
        title: base.title,
        region: base.region,
        ld5: String(base.ld5_count || 0),
        monsters: (base.listing_monsters || []).map((m: any) => m.monster_name).join(', '),
        price: String(base.price_cents / 100),
        description: base.description || '',
        ack: false,
      });
    }
  }, [base]);

  const set = (k: keyof F, v: any) => setF((p) => ({ ...p, [k]: v }));
  const monsters = f.monsters.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const priceC = Math.round((Number(f.price) || 0) * 100);
  const isActive = base?.status === 'active';
  const locked = base && ['reserved', 'sold'].includes(base.status);

  async function save(submit: boolean) {
    setErr('');
    const title = f.title.trim();
    if (title.length < 5 || title.length > 120) return setErr('Le titre doit faire entre 5 et 120 caractères.');
    if (!(Number(f.price) > 0)) return setErr('Indiquez un prix supérieur à 0.');
    if ((submit || isActive) && !f.ack) return setErr('Cochez la case de confirmation pour envoyer en validation.');
    setBusy(true);
    const res = await saveListing(
      { id: base?.id || null, title, region: f.region, ld5: Math.max(0, Math.round(Number(f.ld5) || 0)), monsters, priceEuros: Number(f.price), description: f.description },
      submit
    );
    if (res.error || !res.id) {
      setBusy(false);
      return setErr(res.error || 'Erreur');
    }
    const kept = new Set(photos.filter((p) => p.kind === 'old').map((p: any) => p.id));
    const removed = sortImages(base?.listing_images).filter((im: any) => !kept.has(im.id)).map((im: any) => ({ id: im.id, path: im.storage_path }));
    const pe = await syncPhotos(res.id, session.user.id, photos, removed);
    await refresh();
    setBusy(false);
    if (pe) return router.replace(`/ajouter?id=${res.id}&photoerr=${encodeURIComponent(pe)}`);
    router.push('/annonces');
  }

  if (id && loading && !base) return <div className="banner info">Chargement de l&apos;annonce…</div>;
  if (id && !base && !loading) return <div className="banner bad">Annonce introuvable.</div>;
  if (locked) return <div className="banner">Une annonce réservée ou vendue ne peut plus être modifiée.</div>;

  return (
    <>
      <Head title={base ? `Modifier ${base.ref}` : 'Ajouter un compte'} text="Renseignez les caractéristiques du compte. Aucun identifiant ni mot de passe de jeu ne doit être saisi ici." />
      <div className="split">
        <form className="panel form" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <div className="field"><label htmlFor="title">Titre de l&apos;annonce</label>
            <input id="title" maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. 5 LD5 — Lucifer / Jaara — Europe" /></div>
          <div className="row2">
            <div className="field"><label htmlFor="region">Région</label>
              <select id="region" value={f.region} onChange={(e) => set('region', e.target.value)}>
                {Object.keys(REGION).map((k) => <option key={k} value={k}>{REGION[k]}</option>)}
              </select></div>
            <div className="field"><label htmlFor="price">Prix demandé (€)</label>
              <input id="price" type="number" min={1} step={1} inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value)} /></div>
            <div className="field"><label htmlFor="ld5">Nombre de LD5</label>
              <input id="ld5" type="number" min={0} max={60} step={1} inputMode="numeric" value={f.ld5} onChange={(e) => set('ld5', e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="mons">Monstres clés</label>
            <input id="mons" value={f.monsters} onChange={(e) => set('monsters', e.target.value)} placeholder="Séparés par des virgules" />
            <span className="hint">Ex. Lucifer, Jaara, Talisman</span></div>
          <div className="field"><label htmlFor="desc">Description</label>
            <textarea id="desc" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Progression PvE, niveau PvP, qualité des runes, particularités du compte…" /></div>
          <PhotoPicker items={photos} onChange={setPhotos} disabled={busy} />
          <label className="check">
            <input type="checkbox" checked={f.ack} onChange={(e) => set('ack', e.target.checked)} />
            <span>Je comprends que Com2uS interdit la vente de comptes et que cela peut exposer le compte à des sanctions. NEXORA ne garantit pas la transaction. Je ne publie aucun identifiant de connexion.</span>
          </label>
          {photoErr && <div className="banner bad">L&apos;annonce est enregistrée, mais les photos n&apos;ont pas toutes été envoyées : {photoErr}. Réessayez ci-dessous.</div>}
          <div className="err">{err}</div>
          <div className="actions">
            {isActive ? (
              <button className="btn pri" disabled={busy} onClick={() => save(true)}>{autoPublish ? 'Enregistrer les modifications' : 'Enregistrer et renvoyer en validation'}</button>
            ) : (
              <>
                <button className="btn" disabled={busy} onClick={() => save(false)}>Enregistrer le brouillon</button>
                <button className="btn pri" disabled={busy} onClick={() => save(true)}>{autoPublish ? 'Publier maintenant' : 'Soumettre pour validation'}</button>
              </>
            )}
            <button className="btn" onClick={() => router.push('/annonces')}>Annuler</button>
          </div>
          {isActive && <p className="hint">{autoPublish ? 'Les modifications sont publiées immédiatement.' : 'Modifier le titre, le prix, la région ou la description d’une annonce active déclenche une nouvelle validation.'}</p>}
        </form>
        <aside className="panel preview">
          <div className="tag">Aperçu de l&apos;annonce</div>
          <div className="card">
            <PreviewCover photos={photos} />
            <span style={{ font: '500 11px var(--f-mono)', color: 'var(--mut)' }}>{base?.ref || 'NX-···'} · {REGION[f.region]}</span>
            <h3 style={{ overflowWrap: 'anywhere' }}>{f.title || "Titre de l'annonce"}</h3>
            <div className="mon">
              {Number(f.ld5) > 0 && <span style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>{Number(f.ld5)} LD5</span>}
              {monsters.map((m) => <span key={m}>{m}</span>)}
            </div>
            <p style={{ color: 'var(--mut)', fontSize: 13, overflowWrap: 'anywhere' }}>{f.description.slice(0, 220) || 'La description apparaîtra ici.'}</p>
            <div className="price">{priceC ? eur(priceC) : '— €'}</div>
            <p style={{ fontSize: 12, color: 'var(--mut)' }}>Frais Middleman si vente : {priceC ? eur(feeCents(priceC)) : '6 %, minimum 5 €'}</p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function Ajouter() {
  return (
    <Suspense fallback={<div className="banner info">Chargement…</div>}>
      <Form />
    </Suspense>
  );
}
