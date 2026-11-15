# NEXORA Seller Center — guide de mise en ligne

Application web installable (PWA) : Next.js + Supabase, hébergée sur Vercel.
Compter environ 30 minutes. Tout est gratuit pour démarrer.

## 1. Créer les comptes (une seule fois)

1. **GitHub** : https://github.com (compte gratuit). Il sert à stocker le code.
2. **Supabase** : https://supabase.com, « Start your project », connexion avec GitHub. C'est la base de données et les comptes utilisateurs.
3. **Vercel** : https://vercel.com, « Sign up », connexion avec GitHub. C'est l'hébergement de l'application.

## 2. Préparer la base de données (Supabase)

1. « New project ». Nom : `nexora`. Choisissez un mot de passe de base de données (notez-le) et une région européenne (Frankfurt ou Paris).
2. Attendez 1 à 2 minutes que le projet soit prêt.
3. Menu **SQL Editor** > « New query ».
   - Ouvrez le fichier `supabase/migrations/001_schema.sql`, copiez tout, collez, cliquez **Run**.
   - Nouvelle requête : faites pareil avec `supabase/migrations/002_app_adjustments.sql`.
   - Chaque exécution doit afficher « Success ».
4. Menu **Project Settings > API** : notez deux valeurs.
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - **anon public key** (longue chaîne qui commence par `eyJ…`)
   - N'utilisez jamais la clé `service_role` dans cette application.
5. (Conseillé pour tester) **Authentication > Providers > Email** : désactivez « Confirm email », ou gardez-le actif si vous voulez que chaque inscrit confirme son adresse par mail.

## 3. Mettre le code sur GitHub

1. Sur GitHub : « New repository », nom `nexora-seller-center`, **Private**, Create.
2. Sur la page du dépôt vide : « uploading an existing file ». Décompressez l'archive, puis glissez-déposez tout le contenu du dossier `nexora-app` (pas le dossier lui-même). Cliquez « Commit changes ».

## 4. Déployer (Vercel)

1. Vercel > **Add New > Project** > importez `nexora-seller-center`.
2. Avant « Deploy », ouvrez **Environment Variables** et ajoutez :
   - `NEXT_PUBLIC_SUPABASE_URL` = votre Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre anon public key
3. Cliquez **Deploy**. Au bout d'une minute, Vercel donne une adresse du type `https://nexora-seller-center.vercel.app`.
4. Retournez dans Supabase > **Authentication > URL Configuration** : mettez cette adresse dans **Site URL**.

## 5. Devenir administrateur

1. Ouvrez l'adresse de l'application et **créez votre compte** (« Créer mon espace vendeur »).
2. Dans Supabase > SQL Editor, exécutez (en remplaçant l'email) :

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'VOTRE@EMAIL.COM');
```

3. Rechargez l'application : l'onglet **Modération** apparaît.

## 6. Installer comme une application

- **iPhone (Safari)** : bouton Partager > « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ > « Installer l'application ».
- **Ordinateur (Chrome, Edge)** : icône d'installation à droite de la barre d'adresse.

## 7. Tester le parcours complet

1. Paramètres : choisissez votre pseudo vendeur.
2. Ajouter un compte > Soumettre pour validation.
3. Modération > Accepter et publier.
4. Mes annonces > Demander un Middleman (acheteur + prix).
5. Modération > Ouvrir la transaction, avancer les étapes, Finaliser la vente.
6. Analytics et Aperçu : la vente et les frais (6 %, minimum 5 €) apparaissent.

## Tester en local (optionnel)

```bash
npm install
cp .env.local.example .env.local   # puis renseignez les deux valeurs
npm run dev                        # http://localhost:3000
```

## Ce qui est inclus / pas encore

Inclus : comptes, espace vendeur, annonces avec validation, demandes de Middleman, transactions suivies par l'admin, analytics, aperçu de boutique, installation PWA, sécurité par règles de base de données (chaque vendeur ne voit que ses données).

Pas encore : captures d'écran des comptes, catalogue public pour les acheteurs, avis vérifiés, notifications Discord/email, applications App Store / Google Play (possible plus tard en enveloppant cette application avec Capacitor).

## Rappels importants

- Les conditions de Com2uS interdisent la vente de comptes. Ne présentez jamais le service comme autorisé ni comme une garantie contre les sanctions.
- Ne demandez ni ne stockez jamais d'identifiant ou de mot de passe de jeu.
- Faites vérifier les obligations légales et fiscales de l'activité de Middleman (paiements, déclarations) avant un lancement commercial.
