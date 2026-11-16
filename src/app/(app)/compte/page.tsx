'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Head, useToast } from '@/components/ui';
import { PushState, disablePush, enablePush, pushState } from '@/lib/push';
import { useLang } from '@/lib/i18n';

export default function Compte() {
  const { profile, saveProfile, session, isAdmin } = useData();
  const [handle, setHandle] = useState('');
  const [discord, setDiscord] = useState('');
  const [err, setErr] = useState('');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [perr, setPerr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { lang } = useLang();
  const [ps, setPs] = useState<PushState>('off');
  const [mail, setMail] = useState(true);
  useEffect(() => { pushState().then(setPs); }, []);
  useEffect(() => { if (profile) setMail(profile.notify_email !== false); }, [profile]);
  async function togglePush() {
    if (!session) return;
    if (ps === 'on') { await disablePush(); setPs('off'); toast.show('Notifications désactivées sur cet appareil.'); return; }
    const e = await enablePush(session.user.id, lang);
    setPs(await pushState());
    toast.show(e ? (e === 'denied' ? 'Notifications refusées : autorisez-les dans les réglages du navigateur.' : e) : 'Notifications activées sur cet appareil.');
  }
  async function testLocal() {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('NEXORA', { body: 'Test local : si vous voyez ceci, l\'affichage fonctionne.', icon: '/icons/icon-192.png', tag: 'local-test' });
      toast.show('Notification locale envoyée.');
    } catch (e: any) {
      toast.show(e?.message || 'Impossible d\'afficher une notification.');
    }
  }
  async function testServer() {
    const { error } = await supabase.rpc('send_test_push');
    toast.show(error ? error.message : 'Envoyé. Verrouillez l\'écran maintenant : la notification arrive dans 5 secondes.');
  }
  async function toggleMail(v: boolean) {
    setMail(v);
    const { error } = await supabase.from('profiles').update({ notify_email: v }).eq('id', session.user.id);
    toast.show(error ? error.message : v ? 'E-mails de notification activés.' : 'E-mails de notification désactivés.');
  }

  useEffect(() => {
    if (profile) {
      setHandle(profile.handle || '');
      setDiscord(profile.discord_handle || '');
    }
  }, [profile]);

  async function save() {
    setErr('');
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(handle.trim())) return setErr('Nom d\'utilisateur invalide : 3 à 24 caractères, lettres, chiffres, _ . -');
    const e = await saveProfile(handle.trim(), discord.trim());
    if (e) return setErr(e.includes('duplicate') ? 'Ce nom d\'utilisateur est déjà pris.' : e);
    toast.show('Profil enregistré.');
  }

  async function changePw() {
    setPerr('');
    if (!cur) return setPerr('Saisissez votre mot de passe actuel.');
    if (pw.length < 8) return setPerr('Le nouveau mot de passe doit faire au moins 8 caractères.');
    if (pw !== pw2) return setPerr('Les deux nouveaux mots de passe ne correspondent pas.');
    if (pw === cur) return setPerr('Le nouveau mot de passe doit être différent de l\'actuel.');
    setBusy(true);
    const chk = await supabase.auth.signInWithPassword({ email: session.user.email, password: cur });
    if (chk.error) {
      setBusy(false);
      return setPerr('Mot de passe actuel incorrect.');
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setPerr(error.message);
    setCur(''); setPw(''); setPw2('');
    toast.show('Mot de passe modifié.');
  }

  return (
    <>
      <Head title="Mon compte" text="Vos informations de connexion à NEXORA. Cela ne concerne pas vos comptes de jeu : leurs photos se gèrent dans chaque annonce." />
      <section className="panel">
        <h2>Informations</h2>
        <div className="form">
          <div className="row2">
            <div className="field"><label htmlFor="handle">Nom d&apos;utilisateur</label><input id="handle" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} placeholder="SylverZz" autoComplete="username" /><span className="hint">3 à 24 caractères : lettres, chiffres, _ . -</span></div>
            <div className="field"><label htmlFor="discord">Discord</label><input id="discord" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="pseudo ou lien" /></div>
          </div>
          <div className="field"><label htmlFor="mail">Adresse e-mail</label><input id="mail" value={session.user.email || ''} readOnly /><span className="hint">Identifiant de connexion, non modifiable ici.</span></div>
          <p className="meta">Vendeur n°{profile?.seller_number ?? '—'}{isAdmin ? ' · administrateur' : ''}</p>
          <div className="actions"><button className="btn pri" onClick={save}>Enregistrer</button></div>
          <div className="err">{err}</div>
        </div>
      </section>
      <section className="panel">
        <h2>Changer de mot de passe</h2>
        <form className="form" onSubmit={(e) => { e.preventDefault(); changePw(); }}>
          <input type="text" value={session.user.email || ''} autoComplete="username" readOnly hidden />
          <div className="field"><label htmlFor="cur">Mot de passe actuel</label><input id="cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
          <div className="row2">
            <div className="field"><label htmlFor="pw">Nouveau mot de passe</label><input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><span className="hint">8 caractères minimum.</span></div>
            <div className="field"><label htmlFor="pw2">Confirmer</label><input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
          </div>
          <div className="err">{perr}</div>
          <div className="actions"><button className="btn pri" type="submit" disabled={busy}>Modifier le mot de passe</button></div>
        </form>
      </section>
      <section className="panel">
        <h2>Notifications</h2>
        <p className="sub" style={{ margin: '2px 0 12px' }}>Soyez prévenu d'un nouveau message ou de l'avancement d'une transaction, même quand NEXORA est fermé.</p>
        <div className="form">
          {ps === 'unsupported' && <div className="banner info">Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d'abord NEXORA à l'écran d'accueil (Paramètres, Installer l'application).</div>}
          {ps === 'unavailable' && <div className="banner info">Les notifications ne sont pas encore activées sur ce site.</div>}
          {ps === 'denied' && <div className="banner bad">Notifications bloquées : autorisez-les pour NEXORA dans les réglages du navigateur, puis revenez ici.</div>}
          {(ps === 'on' || ps === 'off') && (
            <div className="actions">
              <button type="button" className={ps === 'on' ? 'btn' : 'btn pri'} onClick={togglePush}>{ps === 'on' ? 'Désactiver les notifications sur cet appareil' : 'Activer les notifications sur cet appareil'}</button>
            </div>
          )}
          {ps === 'on' && (
            <div className="actions">
              <button type="button" className="btn sm" onClick={testLocal}>Test local</button>
              <button type="button" className="btn sm" onClick={testServer}>Test serveur (écran verrouillé)</button>
            </div>
          )}
          <label className="check" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={mail} onChange={(e) => toggleMail(e.target.checked)} />
            <span>Recevoir aussi un e-mail</span>
          </label>
        </div>
      </section>
      {toast.node}
    </>
  );
}
