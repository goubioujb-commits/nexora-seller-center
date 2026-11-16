import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type L = 'fr' | 'en' | 'de';
const T: Record<string, Record<L, [string, string]>> = {
  message: { fr: ['Nouveau message', 'Vous avez reçu un message sur NEXORA.'], en: ['New message', 'You received a message on NEXORA.'], de: ['Neue Nachricht', 'Du hast eine Nachricht auf NEXORA erhalten.'] },
  tx_step: { fr: ['Transaction mise à jour', 'Une étape de votre transaction a avancé.'], en: ['Transaction updated', 'A step of your transaction has advanced.'], de: ['Transaktion aktualisiert', 'Ein Schritt deiner Transaktion wurde vorangebracht.'] },
  tx_completed: { fr: ['Vente finalisée', 'La transaction est terminée.'], en: ['Sale completed', 'The transaction is complete.'], de: ['Verkauf abgeschlossen', 'Die Transaktion ist abgeschlossen.'] },
  tx_cancelled: { fr: ['Transaction annulée', 'La transaction a été annulée.'], en: ['Transaction cancelled', 'The transaction has been cancelled.'], de: ['Transaktion storniert', 'Die Transaktion wurde storniert.'] },
  listing_active: { fr: ['Annonce publiée', 'Votre annonce est visible dans le catalogue.'], en: ['Listing published', 'Your listing is visible in the catalogue.'], de: ['Anzeige veröffentlicht', 'Deine Anzeige ist im Katalog sichtbar.'] },
  listing_rejected: { fr: ['Annonce refusée', 'Consultez le motif dans Mes annonces.'], en: ['Listing rejected', 'See the reason in My listings.'], de: ['Anzeige abgelehnt', 'Den Grund findest du unter Meine Anzeigen.'] },
  listing_pending: { fr: ['Annonce à valider', 'Une annonce attend votre validation.'], en: ['Listing to review', 'A listing is waiting for your review.'], de: ['Anzeige zur Prüfung', 'Eine Anzeige wartet auf deine Prüfung.'] },
  test: { fr: ['Test de notification', 'Si vous lisez ceci, les notifications fonctionnent.'], en: ['Notification test', 'If you can read this, notifications work.'], de: ['Benachrichtigungstest', 'Wenn du das liest, funktionieren die Benachrichtigungen.'] },
  request: { fr: ['Nouvelle demande Middleman', 'Une demande attend votre traitement.'], en: ['New Middleman request', 'A request is waiting for you.'], de: ['Neue Middleman-Anfrage', 'Eine Anfrage wartet auf dich.'] },
};

// Contrôle rapide dans un navigateur : confirme que l'API est déployée et que les variables sont présentes
export async function GET() {
  return NextResponse.json({
    ok: true,
    api: 'notify',
    method: 'POST attendu',
    secret: !!process.env.PUSH_SECRET,
    service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    vapid_private: !!process.env.VAPID_PRIVATE_KEY,
  });
}

export async function POST(req: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!secret || req.headers.get('x-push-secret') !== secret) return NextResponse.json({ error: 'forbidden', secret_configured: !!secret, secret_received: !!req.headers.get('x-push-secret') }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const users: string[] = Array.isArray(body?.users) ? body.users.filter((x: any) => typeof x === 'string').slice(0, 50) : [];
  const code: string = body?.code;
  const ref: string | null = body?.ref || null;
  const path: string = typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/';
  if (!users.length || !T[code]) return NextResponse.json({ ok: true, sent: 0 });

  if (code === 'test') await new Promise((r) => setTimeout(r, 4000));
  const db = createClient(url, key, { auth: { persistSession: false } });
  const origin = new URL(req.url).origin;
  let pushed = 0;
  let mailed = 0;

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const canPush = !!(pub && priv);
  if (canPush) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:sylver66430@gmail.com', pub!, priv!);

  const [subs, profs] = await Promise.all([
    db.from('push_subscriptions').select('*').in('user_id', users),
    db.from('profiles').select('id,lang,notify_email').in('id', users),
  ]);
  const prof: Record<string, any> = {};
  (profs.data || []).forEach((p: any) => (prof[p.id] = p));

  if (canPush) {
    await Promise.all(
      (subs.data || []).map(async (s: any) => {
        const l: L = (['fr', 'en', 'de'].includes(s.lang) ? s.lang : 'fr') as L;
        const [title, text] = T[code][l];
        const payload = JSON.stringify({ title: ref ? `${title} · ${ref}` : title, body: text, url: path, tag: `${code}-${ref || ''}` });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          pushed++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        }
      })
    );
  }

  // E-mail (facultatif : actif si RESEND_API_KEY est défini)
  const rk = process.env.RESEND_API_KEY;
  if (rk) {
    await Promise.all(
      users.map(async (id) => {
        const p = prof[id];
        if (!p || p.notify_email === false) return;
        const { data } = await db.auth.admin.getUserById(id);
        const to = data?.user?.email;
        if (!to) return;
        const l: L = (['fr', 'en', 'de'].includes(p.lang) ? p.lang : 'fr') as L;
        const [title, text] = T[code][l];
        const subject = ref ? `${title} · ${ref}` : title;
        const link = origin + path;
        const html = `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>${subject}</h2><p>${text}</p><p><a href="${link}" style="background:#5b7cff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">NEXORA</a></p></div>`;
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${rk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'NEXORA <onboarding@resend.dev>', to: [to], subject, html }),
        }).catch(() => null);
        if (r?.ok) mailed++;
      })
    );
  }
  return NextResponse.json({ ok: true, pushed, mailed });
}
