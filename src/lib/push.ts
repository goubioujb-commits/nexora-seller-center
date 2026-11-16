import { supabase } from './supabase';

// Clé publique VAPID (publique par nature). La variable Vercel, si présente, a priorité.
const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BD2j1ZSkE18PY4F-qm96Rd83QPwK7VvFFeGJTshZHEAS827dEC43rSNIhe6qI8xpMJJ2bggZMKE8xAMrqmHOZA8';

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

const b64 = (s: string) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!PUB) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function enablePush(uid: string, lang: string): Promise<string | null> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(PUB) });
    const j: any = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, lang },
      { onConflict: 'endpoint' }
    );
    return error ? error.message : null;
  } catch (e: any) {
    return e?.message || 'error';
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
}
