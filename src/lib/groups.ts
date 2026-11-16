import { supabase } from './supabase';

// Crée un groupe (admin) avec ses membres ; renvoie l'id ou un message d'erreur.
export async function createGroup(opts: {
  title: string;
  listingId?: string | null;
  members: { user_id: string; role: 'admin' | 'seller' | 'buyer' }[];
  adminId: string;
}): Promise<{ id: string | null; error: string | null }> {
  const g = await supabase.from('chat_groups').insert({ title: opts.title.trim(), listing_id: opts.listingId || null, created_by: opts.adminId }).select('id').single();
  if (g.error) return { id: null, error: g.error.message };
  const rows = [{ user_id: opts.adminId, role: 'admin' as const }, ...opts.members.filter((m) => m.user_id !== opts.adminId)];
  const m = await supabase.from('chat_group_members').insert(rows.map((r) => ({ group_id: g.data.id, user_id: r.user_id, role: r.role })));
  if (m.error) return { id: g.data.id, error: m.error.message };
  return { id: g.data.id, error: null };
}

// Réutilise le groupe existant d'une annonce s'il y en a un, sinon en crée un.
export async function openOrCreateGroup(opts: Parameters<typeof createGroup>[0]) {
  if (opts.listingId) {
    const ex = await supabase.from('chat_groups').select('id').eq('listing_id', opts.listingId).order('created_at', { ascending: false }).limit(1);
    if (ex.data?.[0]) {
      // s'assure que les membres demandés y sont
      const have = await supabase.from('chat_group_members').select('user_id').eq('group_id', ex.data[0].id);
      const ids = new Set((have.data || []).map((x: any) => x.user_id));
      const add = [{ user_id: opts.adminId, role: 'admin' as const }, ...opts.members].filter((m) => !ids.has(m.user_id));
      if (add.length) await supabase.from('chat_group_members').insert(add.map((r) => ({ group_id: ex.data![0].id, user_id: r.user_id, role: r.role })));
      return { id: ex.data[0].id as string, error: null as string | null };
    }
  }
  return createGroup(opts);
}

// Discussion privée distincte (admin + UNE seule personne) liée à une annonce : une pour le vendeur, une pour l'acheteur.
export async function openOrCreateDirect(opts: {
  listingId: string;
  ref: string;
  userId: string;
  role: 'seller' | 'buyer';
  adminId: string;
}): Promise<{ id: string | null; error: string | null }> {
  const gs = await supabase.from('chat_groups').select('id').eq('listing_id', opts.listingId);
  const ids = (gs.data || []).map((g: any) => g.id);
  if (ids.length) {
    const ms = await supabase.from('chat_group_members').select('group_id,user_id').in('group_id', ids);
    const by: Record<string, string[]> = {};
    (ms.data || []).forEach((m: any) => { if (m.user_id !== opts.adminId) (by[m.group_id] ||= []).push(m.user_id); });
    const hit = ids.find((id: string) => by[id]?.length === 1 && by[id][0] === opts.userId);
    if (hit) return { id: hit, error: null };
  }
  const title = `${opts.ref} · ${opts.role === 'seller' ? 'Discussion vendeur' : 'Discussion acheteur'}`;
  return createGroup({ title, listingId: opts.listingId, members: [{ user_id: opts.userId, role: opts.role }], adminId: opts.adminId });
}
