'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useData } from '@/lib/data';
import { LangSwitch } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { ready, session } = useData();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') setMode('signup');
  }, []);

  useEffect(() => {
    if (ready && session) router.replace('/');
  }, [ready, session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (password.length < 8) return setMsg('Le mot de passe doit faire au moins 8 caractères.');
    setBusy(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      <div className="auth-lang"><LangSwitch /></div>
      <div className="box">
        <img className="logo" src="/logo.webp" alt="NEXORA" />
        <h1>NEXORA Seller Center</h1>
        <p className="tagline">Trade. Evaluate. Connect.</p>
        {!supabaseConfigured && (
          <div className="banner bad">
            La base de données n&apos;est pas configurée. Ajoutez les variables NEXT_PUBLIC_SUPABASE_URL et
            NEXT_PUBLIC_SUPABASE_ANON_KEY comme indiqué dans le guide.
          </div>
        )}
        <form className="panel form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw">Mot de passe</label>
            <input
              id="pw"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && <span className="hint">8 caractères minimum.</span>}
          </div>
          <div className="err">{msg}</div>
          <button className="btn pri" disabled={busy || !supabaseConfigured} type="submit" style={{ justifyContent: 'center' }}>
            {mode === 'login' ? 'Se connecter' : 'Créer mon espace vendeur'}
          </button>
          <button type="button" className="btn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(''); }}>
            {mode === 'login' ? 'Pas encore de compte ? Créer un espace vendeur gratuit' : 'J\'ai déjà un compte'}
          </button>
        </form>
        <p className="legal" style={{ marginBottom: 6 }}>
          <a href="/">← Présentation de NEXORA</a> · <a href="https://discord.gg/yKp3YsA6J" target="_blank" rel="noopener noreferrer">Rejoindre le Discord</a>
        </p>
        <p className="legal">
          Publication gratuite. NEXORA n&apos;est pas affilié à Com2uS, dont les conditions interdisent la vente de comptes. Ne communiquez jamais
          d&apos;identifiant ni de mot de passe de jeu.
        </p>
      </div>
    </div>
  );
}
