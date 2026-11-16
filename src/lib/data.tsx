'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { TX_KEYS, eur, feeCents } from './util';
import { openOrCreateDirect } from './groups';
import { paypalLink } from './config';

export type ListingForm = {
  id: string | null;
  title: string;
  region: string;
  ld5: number;
  monsters: string[];
  priceEuros: number;
  description: string;
};

type Ctx = {
  ready: boolean;
  loading: boolean;
  session: Session | null;
  profile: any;
  isAdmin: boolean;
  listings: any[]; // tout ce que la base autorise à voir
  mine: any[]; // annonces du vendeur connecté
  txs: any[];
  requests: any[];
  people: Record<string, any>;
  autoPublish: boolean;
  aliases: Record<string, number>; // id -> numéro de membre (identité publique)
  setAutoPublish: (v: boolean) => Promise<string | null>;
  requestPurchase: (listingId: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  saveListing: (f: ListingForm, submit: boolean) => Promise<{ error: string | null; id: string | null }>;
  setStatus: (id: string, status: string) => Promise<string | null>;
  deleteListing: (id: string) => Promise<string | null>;
  moderate: (id: string, kind: 'approve' | 'fix' | 'reject', message: string) => Promise<string | null>;
  requestMiddleman: (listingId: string, buyer: string, priceEuros: number) => Promise<string | null>;
  openTx: (req: any) => Promise<string | null>;
  closeRequest: (id: string) => Promise<string | null>;
  advanceTx: (tx: any) => Promise<string | null>;
  finishTx: (tx: any) => Promise<string | null>;
  cancelTx: (tx: any) => Promise<string | null>;
  saveProfile: (handle: string, discord: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const DataCtx = createContext<Ctx>(null as any);
export const useData = () => useContext(DataCtx);

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [people, setPeople] = useState<Record<string, any>>({});
  const [autoPublish, setAuto] = useState(false);
  const [aliases, setAliases] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;

  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const [p, l, t, r, st, al] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('listings').select('*, listing_monsters(*), listing_images(id,storage_path,position)').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('middleman_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'auto_publish').maybeSingle(),
      supabase.rpc('member_aliases'),
    ]);
    setAuto(st.data?.value === true);
    const am: Record<string, number> = {};
    ((al.data as any[]) || []).forEach((x: any) => (am[x.id] = x.seller_number));
    setAliases(am);
    const ls = l.data || [];
    const ts = t.data || [];
    const rs = r.data || [];
    setProfile(p.data || null);
    setListings(ls);
    setTxs(ts);
    setRequests(rs);
    const ids = Array.from(new Set([...ls.map((x: any) => x.seller_id), ...ts.map((x: any) => x.seller_id), ...rs.map((x: any) => x.requester_id), ...rs.map((x: any) => x.buyer_id), ...ts.map((x: any) => x.buyer_id)])).filter(Boolean);
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id,handle,seller_number').in('id', ids as string[]);
      const map: Record<string, any> = {};
      (data || []).forEach((x: any) => (map[x.id] = x));
      setPeople(map);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (uid) refresh();
    else {
      setProfile(null);
      setListings([]);
      setTxs([]);
      setRequests([]);
    }
  }, [uid, refresh]);

  const isAdmin = profile?.role === 'admin';
  const mine = useMemo(() => listings.filter((l) => l.seller_id === uid), [listings, uid]);

  // Exécute une écriture, recharge, renvoie un message d'erreur ou null
  const run = async (fn: () => PromiseLike<any>): Promise<string | null> => {
    const res = await fn();
    if (res?.error) return res.error.message || 'Erreur';
    await refresh();
    return null;
  };

  const value: Ctx = {
    ready,
    loading,
    session,
    profile,
    isAdmin,
    listings,
    mine,
    txs,
    requests,
    people,
    autoPublish,
    aliases,
    refresh,

    saveListing: async (f, submit) => {
      if (!uid) return { error: 'Non connecté', id: null };
      const base = f.id ? mine.find((l) => l.id === f.id) : null;
      const fields = {
        title: f.title.trim(),
        region: f.region,
        price_cents: Math.round(f.priceEuros * 100),
        description: f.description.trim(),
        ld5_count: f.ld5,
      };
      let id = f.id;
      if (!base) {
        const { data, error } = await supabase.from('listings').insert({ ...fields, seller_id: uid }).select('id').single();
        if (error) return { error: error.message, id: null };
        id = data.id;
      } else {
        const patch: any = { ...fields };
        if (['pending', 'rejected', 'archived'].includes(base.status)) patch.status = 'draft';
        const { error } = await supabase.from('listings').update(patch).eq('id', id);
        if (error) return { error: error.message, id };
      }
      await supabase.from('listing_monsters').delete().eq('listing_id', id);
      if (f.monsters.length) {
        const { error } = await supabase
          .from('listing_monsters')
          .insert(f.monsters.map((m) => ({ listing_id: id, monster_name: m, is_ld5: false })));
        if (error) return { error: error.message, id };
      }
      // Une annonce active modifiée repasse automatiquement en validation (règle côté base)
      if (submit && (!base || base.status !== 'active')) {
        const { error } = await supabase.from('listings').update({ status: autoPublish ? 'active' : 'pending' }).eq('id', id);
        if (error) return { error: error.message, id };
      }
      await refresh();
      return { error: null, id };
    },

    // Suppression définitive : seulement Brouillon / Refusée / Archivée (règle côté base).
    // Une annonce Active ou En validation est d'abord archivée / retirée, puis supprimée.
    deleteListing: async (id) => {
      const l = mine.find((x) => x.id === id);
      if (!l) return 'Annonce introuvable';
      if (['reserved', 'sold'].includes(l.status)) return 'Une annonce réservée ou vendue ne peut pas être supprimée.';
      const paths = (l.listing_images || []).map((i: any) => i.storage_path);
      if (l.status === 'active' || l.status === 'pending') {
        const { error } = await supabase.from('listings').update({ status: l.status === 'active' ? 'archived' : 'draft' }).eq('id', id);
        if (error) return error.message;
      }
      const { error, count } = await supabase.from('listings').delete({ count: 'exact' }).eq('id', id);
      if (error) {
        await refresh();
        return error.message.includes('violates foreign key')
          ? 'Cette annonce a un historique de transaction : elle ne peut pas être supprimée. Elle a été archivée.'
          : error.message;
      }
      if (!count) {
        await refresh();
        return 'Suppression refusée par la base de données (exécutez la migration 005).';
      }
      if (paths.length) await supabase.storage.from('listing-images').remove(paths);
      await refresh();
      return null;
    },

    setStatus: (id, status) => run(() => supabase.from('listings').update({ status }).eq('id', id)),

    moderate: (id, kind, message) =>
      run(() =>
        supabase
          .from('listings')
          .update(
            kind === 'approve'
              ? { status: 'active' }
              : kind === 'fix'
              ? { status: 'draft', admin_feedback: message }
              : { status: 'rejected', admin_feedback: message }
          )
          .eq('id', id)
      ),

    requestMiddleman: (listingId, buyer, priceEuros) =>
      run(() =>
        supabase.from('middleman_requests').insert({
          listing_id: listingId,
          requester_id: uid,
          buyer_label: buyer.trim(),
          agreed_price_cents: Math.round(priceEuros * 100),
        })
      ),

    // Admin : transforme une demande en transaction (l'annonce passe en « Réservée » côté base)
    openTx: async (req) => {
      const l = listings.find((x) => x.id === req.listing_id);
      if (!l) return 'Annonce introuvable';
      const { error } = await supabase.from('transactions').insert({
        listing_id: l.id,
        seller_id: l.seller_id,
        buyer_id: req.buyer_id || null,
        buyer_label: req.buyer_label || null,
        agreed_price_cents: req.agreed_price_cents,
        status: 'buyer_identified',
      });
      if (error) return error.message;
      await supabase.from('middleman_requests').update({ status: 'converted' }).eq('id', req.id);
      // Messages automatiques (FR + EN) dans les discussions privées du vendeur et de l'acheteur
      try {
        const ref = l.ref;
        const price = req.agreed_price_cents || 0;
        const fee = feeCents(price);
        if (uid && req.buyer_id) {
          const d = await openOrCreateDirect({ listingId: l.id, ref, userId: req.buyer_id, role: 'buyer', adminId: uid });
          if (d.id)
            await supabase.from('chat_group_messages').insert({
              group_id: d.id,
              sender_id: uid,
              body: `Bonjour, votre transaction ${ref} est ouverte. Prix convenu : ${eur(price)}.\nMerci de régler les frais Middleman de ${eur(fee)} : ${paypalLink(fee, ref)}\nUne fois payé, répondez ici pour que NEXORA confirme la réception.\n—\nHello, your transaction ${ref} is now open. Agreed price: ${eur(price)}.\nPlease pay the Middleman fee of ${eur(fee)}: ${paypalLink(fee, ref)}\nOnce paid, reply here so NEXORA can confirm receipt.`,
            });
        }
        if (uid) {
          const d = await openOrCreateDirect({ listingId: l.id, ref, userId: l.seller_id, role: 'seller', adminId: uid });
          if (d.id)
            await supabase.from('chat_group_messages').insert({
              group_id: d.id,
              sender_id: uid,
              body: `Bonjour, la transaction ${ref} est ouverte : votre annonce est réservée. NEXORA contacte l'acheteur et vous tient informé à chaque étape. Ne communiquez jamais d'identifiant de jeu ici.\n—\nHello, transaction ${ref} is now open: your listing is reserved. NEXORA is in touch with the buyer and will keep you informed at every step. Never share a game login here.`,
            });
        }
      } catch {}
      await refresh();
      return null;
    },

    setAutoPublish: (v) =>
      run(() => supabase.from('app_settings').upsert({ key: 'auto_publish', value: v })),

    requestPurchase: async (listingId) => {
      const l = listings.find((x) => x.id === listingId);
      if (!l || !uid) return 'Annonce introuvable';
      const { error } = await supabase.from('middleman_requests').insert({
        listing_id: l.id,
        requester_id: uid,
        buyer_id: uid,
        agreed_price_cents: l.price_cents,
      });
      if (error) return error.message.includes('duplicate') ? 'Vous avez déjà une demande en cours pour cette annonce.' : error.message;
      await refresh();
      return null;
    },

    closeRequest: (id) => run(() => supabase.from('middleman_requests').update({ status: 'closed' }).eq('id', id)),

    advanceTx: (tx) => {
      const i = TX_KEYS.indexOf(tx.status);
      if (i < 0 || i >= 4) return Promise.resolve('Étape non modifiable');
      return run(() => supabase.from('transactions').update({ status: TX_KEYS[i + 1] }).eq('id', tx.id));
    },
    finishTx: (tx) => run(() => supabase.from('transactions').update({ status: 'completed' }).eq('id', tx.id)),
    cancelTx: (tx) => run(() => supabase.from('transactions').update({ status: 'cancelled' }).eq('id', tx.id)),

    saveProfile: (handle, discord) =>
      run(() => supabase.from('profiles').update({ handle, discord_handle: discord }).eq('id', uid)),

    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
