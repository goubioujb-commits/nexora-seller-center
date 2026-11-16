import { supabase } from './supabase';

export const BUCKET = 'listing-images';
export const MAX_PHOTOS = 20;

// Réduit l'image (côté navigateur) : 1600 px max, JPEG qualité 0.82 → ~200-400 Ko
export async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name} : format non accepté (JPEG, PNG ou WebP).`);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  if (!blob) throw new Error(`${file.name} : image illisible.`);
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export type PhotoItem =
  | { key: string; kind: 'old'; id: string; path: string }
  | { key: string; kind: 'new'; file: File; preview: string };

export const sortImages = (imgs?: any[]) => [...(imgs || [])].sort((a, b) => a.position - b.position);

// Applique les changements : supprime les retirées, envoie les nouvelles, réécrit l'ordre.
export async function syncPhotos(listingId: string, uid: string, items: PhotoItem[], removed: { id: string; path: string }[]): Promise<string | null> {
  if (removed.length) {
    await supabase.storage.from(BUCKET).remove(removed.map((r) => r.path));
    const { error } = await supabase.from('listing_images').delete().in('id', removed.map((r) => r.id));
    if (error) return error.message;
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'old') {
      const { error } = await supabase.from('listing_images').update({ position: i }).eq('id', it.id);
      if (error) return error.message;
    } else {
      const path = `${uid}/${listingId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, it.file, { contentType: 'image/jpeg' });
      if (up.error) return `Envoi de la photo ${i + 1} impossible : ${up.error.message}`;
      const { error } = await supabase.from('listing_images').insert({ listing_id: listingId, storage_path: path, position: i });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        return error.message;
      }
    }
  }
  return null;
}

// Liens temporaires (1 h) pour afficher les images du bucket privé
const cache = new Map<string, { url: string; exp: number }>();
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const need = paths.filter((p) => !cache.get(p) || cache.get(p)!.exp < now);
  if (need.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(need, 3600);
    (data || []).forEach((d: any) => d.signedUrl && cache.set(d.path, { url: d.signedUrl, exp: now + 3300e3 }));
  }
  const out: Record<string, string> = {};
  paths.forEach((p) => { const c = cache.get(p); if (c) out[p] = c.url; });
  return out;
}
