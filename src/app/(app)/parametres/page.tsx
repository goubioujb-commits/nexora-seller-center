'use client';

import Link from 'next/link';
import { useData } from '@/lib/data';
import { useState } from 'react';
import { Head, useToast } from '@/components/ui';

export default function Parametres() {
  const { profile, mine, txs, session, isAdmin, autoPublish, setAutoPublish } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function exportData() {
    const uid = session.user.id;
    const data = {
      app: 'nexora-seller-center',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      listings: mine,
      transactions: txs.filter((t) => t.seller_id === uid),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nexora-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Head title="Paramètres" text="Profil vendeur, sauvegarde et règles de la plateforme." />
      <section className="panel">
        <h2>Profil et mot de passe</h2>
        <p className="sub">Nom d&apos;utilisateur, Discord et mot de passe se gèrent maintenant dans l&apos;onglet <Link href="/compte">Mon compte</Link>.</p>
      </section>
      {isAdmin && (
        <section className="panel">
          <h2>Publication des annonces</h2>
          <p className="sub">
            {autoPublish
              ? 'Publication automatique activée : toute annonce soumise est visible tout de suite par les membres, sans validation. Vous pouvez toujours refuser ou archiver une annonce depuis la modération.'
              : 'Validation manuelle : chaque annonce attend votre accord avant d’être visible dans le catalogue.'}
          </p>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={async () => { setBusy(true); const e = await setAutoPublish(!autoPublish); setBusy(false); toast.show(e || (autoPublish ? 'Validation manuelle activée.' : 'Publication automatique activée.')); }}>
              {autoPublish ? 'Passer en validation manuelle' : 'Activer la publication automatique'}
            </button>
          </div>
          <p className="hint">Sans validation, les annonces ne sont pas relues avant publication : un risque d&apos;abus ou de contenu inapproprié existe.</p>
        </section>
      )}
      <section className="panel">
        <h2>Installer l&apos;application</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--mut)', display: 'grid', gap: 4 }}>
          <li><b style={{ color: 'var(--fg)' }}>iPhone (Safari)</b> : bouton Partager, puis « Sur l&apos;écran d&apos;accueil ».</li>
          <li><b style={{ color: 'var(--fg)' }}>Android (Chrome)</b> : menu ⋮, puis « Installer l&apos;application ».</li>
          <li><b style={{ color: 'var(--fg)' }}>Ordinateur (Chrome, Edge)</b> : icône d&apos;installation à droite de la barre d&apos;adresse.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>Sauvegarde</h2>
        <p className="sub">Vos données sont enregistrées en ligne sur votre compte et retrouvées sur tous vos appareils. Vous pouvez aussi exporter une copie.</p>
        <div className="actions"><button className="btn" onClick={exportData}>Exporter une copie (JSON)</button></div>
      </section>
      <section className="panel">
        <h2>Règles V1</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--mut)', display: 'grid', gap: 4 }}>
          <li>Publication gratuite, sans abonnement.</li>
          <li>{autoPublish ? 'Les annonces sont publiées sans validation préalable (NEXORA peut les retirer).' : 'Chaque annonce est validée par NEXORA avant d’être visible.'}</li>
          <li>Les noms d&apos;utilisateur restent privés : seul NEXORA les connaît.</li>
          <li>Middleman : service distinct, 6 % par transaction, minimum 5 €.</li>
          <li>Aucun identifiant ni mot de passe de jeu n&apos;est demandé ou stocké.</li>
          <li>Les avis sont réservés aux transactions vérifiées.</li>
        </ul>
      </section>
      {toast.node}
    </>
  );
}
