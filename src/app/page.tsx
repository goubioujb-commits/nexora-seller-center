'use client';

import Link from 'next/link';
import { useData } from '@/lib/data';
import { LangSwitch } from '@/lib/i18n';
import { TX_LABELS } from '@/lib/util';

const DISCORD = 'https://discord.gg/yKp3YsA6J';

const STEPS = [
  ['01', 'Publiez', 'Créez votre annonce en quelques minutes : titre, monstres clés, prix et jusqu’à 20 captures d’écran. La publication est gratuite.'],
  ['02', 'Trouvez', 'Parcourez le catalogue avec recherche, région, budget et nombre de LD5. Chaque fiche montre toutes les photos et le détail du compte.'],
  ['03', 'Demandez un Middleman', 'Un clic suffit. NEXORA examine la demande et ouvre la transaction : l’annonce est réservée pour vous.'],
  ['04', 'NEXORA sécurise', 'Un administrateur suit chaque étape jusqu’à la finalisation. Lui seul confirme la vente.'],
];

const FAQ = [
  ['Est-ce vraiment gratuit ?', 'Oui : pas d’abonnement et pas de frais de publication. Seul le service Middleman, facultatif et distinct, est facturé : 6 % par transaction, avec un minimum de 5 €.'],
  ['Qui voit mon nom d’utilisateur ?', 'Uniquement l’administration NEXORA. Les autres membres vous voient sous un numéro (« Vendeur n°12 », « Acheteur n°12 »). Si une mise en relation est utile, l’administrateur crée un groupe privé où chacun apparaît par son rôle.'],
  ['NEXORA stocke-t-il des identifiants de jeu ?', 'Jamais. Aucun identifiant ni mot de passe de jeu n’est demandé ou conservé dans l’application. Ne les partagez pas non plus dans les messages.'],
  ['NEXORA est-il autorisé par Com2uS ?', 'Non. NEXORA n’est pas affilié à Com2uS. Les conditions d’utilisation de Com2uS interdisent la vente de comptes : l’achat ou la vente d’un compte peut l’exposer à des sanctions, y compris un bannissement. Vous agissez à vos risques.'],
  ['Comment fonctionne un avis ?', 'Après une transaction finalisée, le vendeur et l’acheteur peuvent noter le service Middleman sur 10. Les avis sont publics et n’affichent qu’un numéro de membre.'],
];

export default function Home() {
  const { session } = useData();
  const logged = !!session;
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="NEXORA">
          <img src="/logo.webp" alt="" />
          <span><b>NEXORA</b><small>Trade. Evaluate. Connect.</small></span>
        </Link>
        <nav aria-label="Sections">
          <a href="#fonctionnement">Fonctionnement</a>
          <a href="#middleman">Middleman</a>
          <a href="#confiance">Confiance</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-nav-cta">
          <LangSwitch />
          <a className="btn sm" href={DISCORD} target="_blank" rel="noopener noreferrer">Discord</a>
          {logged ? <Link className="btn sm pri" href="/apercu">Mon espace</Link> : <Link className="btn sm pri" href="/login">Se connecter</Link>}
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-kicker">Summoners War : Sky Arena</p>
            <h1>La place de marché des comptes, avec un tiers de confiance.</h1>
            <p className="lp-lead">
              Publiez gratuitement vos comptes, trouvez celui qu’il vous faut et laissez NEXORA encadrer l’échange de bout en bout grâce au service Middleman.
              Vos identités restent privées.
            </p>
            <div className="lp-cta">
              <Link className="btn pri lg" href={logged ? '/catalogue' : '/login?mode=signup'}>{logged ? 'Voir le catalogue' : 'Créer mon espace gratuit'}</Link>
              <a className="btn lg" href={DISCORD} target="_blank" rel="noopener noreferrer">Rejoindre le Discord</a>
            </div>
            <ul className="lp-facts">
              <li><b>0 €</b><span>de frais de publication</span></li>
              <li><b>6 %</b><span>Middleman, 5 € minimum</span></li>
              <li><b>100 %</b><span>des ventes confirmées par NEXORA</span></li>
            </ul>
          </div>
          <div className="lp-orbit" aria-hidden="true">
            <i className="r1" /><i className="r2" /><i className="r3" />
            <img src="/logo.webp" alt="" />
            <span className="dot d1" /><span className="dot d2" /><span className="dot d3" />
          </div>
        </section>

        <section id="fonctionnement" className="lp-sec">
          <p className="lp-kicker">Fonctionnement</p>
          <h2>De l’annonce à la vente, en quatre étapes</h2>
          <div className="lp-steps">
            {STEPS.map(([n, t, d]) => (
              <article key={n} className="lp-card">
                <span className="lp-n">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-sec lp-two">
          <article className="lp-card big">
            <p className="lp-kicker">Vendeurs</p>
            <h3>Un espace pour piloter vos ventes</h3>
            <ul>
              <li>Annonces avec jusqu’à 20 photos et fiche détaillée</li>
              <li>Statistiques : ventes par mois, parcours des annonces, prix par région</li>
              <li>Suivi de chaque transaction, étape par étape</li>
              <li>Messagerie privée avec l’équipe NEXORA</li>
            </ul>
          </article>
          <article className="lp-card big">
            <p className="lp-kicker">Acheteurs</p>
            <h3>Un catalogue clair, une demande en un clic</h3>
            <ul>
              <li>Recherche par monstre, région, budget et LD5</li>
              <li>Toutes les photos avant de décider</li>
              <li>Prix affiché, frais Middleman connus d’avance</li>
              <li>Suivi de vos achats et groupe de discussion privé si besoin</li>
            </ul>
          </article>
        </section>

        <section id="middleman" className="lp-sec">
          <p className="lp-kicker">Service Middleman</p>
          <h2>Un tarif simple, un suivi complet</h2>
          <div className="lp-mm">
            <div className="lp-card price">
              <div className="lp-big">6 %</div>
              <p>par transaction, minimum <b>5 €</b>. Service distinct de la publication, qui reste gratuite.</p>
              <ul className="lp-ex">
                <li><span>Compte à 50 €</span><b>5 €</b></li>
                <li><span>Compte à 200 €</span><b>12 €</b></li>
                <li><span>Compte à 500 €</span><b>30 €</b></li>
              </ul>
            </div>
            <ol className="lp-tl">
              {TX_LABELS.map((l, i) => (<li key={l}><i>{i + 1}</i>{l}</li>))}
            </ol>
          </div>
        </section>

        <section id="confiance" className="lp-sec">
          <p className="lp-kicker">Confiance</p>
          <h2>Pensé pour protéger les deux parties</h2>
          <div className="lp-grid3">
            <article className="lp-card"><h3>Identités privées</h3><p>Seul NEXORA connaît les noms d’utilisateur. Les membres se voient sous un simple numéro.</p></article>
            <article className="lp-card"><h3>Aucun identifiant de jeu</h3><p>L’application ne demande ni ne stocke jamais de login ou de mot de passe de jeu.</p></article>
            <article className="lp-card"><h3>Vente confirmée par NEXORA</h3><p>Un seul administrateur valide chaque étape. Les groupes privés ne sont créés que par lui.</p></article>
          </div>
          <p className="lp-warn">
            <b>À savoir.</b> NEXORA n’est pas affilié à Com2uS. Selon ses conditions d’utilisation, les comptes restent sa propriété et leur vente est interdite : un compte
            échangé peut être sanctionné. NEXORA ne garantit ni la valeur d’un compte ni l’absence de sanction.
          </p>
        </section>

        <section className="lp-discord">
          <div>
            <p className="lp-kicker">Communauté</p>
            <h2>Rejoignez le Discord NEXORA</h2>
            <p>Échangez avec la communauté, posez vos questions et suivez les nouveautés de la plateforme.</p>
          </div>
          <a className="btn pri lg" href={DISCORD} target="_blank" rel="noopener noreferrer">Rejoindre le Discord</a>
        </section>

        <section id="faq" className="lp-sec">
          <p className="lp-kicker">Questions fréquentes</p>
          <h2>Les réponses essentielles</h2>
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <h2>Prêt à publier ou à trouver votre prochain compte ?</h2>
          <div className="lp-cta" style={{ justifyContent: 'center' }}>
            <Link className="btn pri lg" href={logged ? '/catalogue' : '/login?mode=signup'}>{logged ? 'Ouvrir le catalogue' : 'Créer mon espace gratuit'}</Link>
            <a className="btn lg" href={DISCORD} target="_blank" rel="noopener noreferrer">Discord</a>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} NEXORA · Trade. Evaluate. Connect.</span>
        <span><a href={DISCORD} target="_blank" rel="noopener noreferrer">Discord</a> · <Link href="/login">Connexion</Link></span>
        <p>NEXORA n’est pas affilié à Com2uS. Summoners War : Sky Arena est une marque de Com2uS. Les estimations de prix sont indicatives.</p>
      </footer>
    </div>
  );
}
