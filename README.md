# Pilotage chantier HMP

Outil de suivi du chantier de rénovation (Bouchemaine) : budget, devis, **factures et
paiements**, adossé à un Google Sheet qui reste la seule source de vérité.

- **Cadre** : Next.js (App Router), déploiement Vercel.
- **Données** : Google Sheets (lecture/écriture) et Google Drive (documents), via OAuth
  au nom de l'utilisateur. Aucune base de données.
- **Direction visuelle** : « Graphite » — anthracite, bleu acier éteint, gris neutres.

## Développement

```bash
npm install
cp .env.example .env.local   # renseigner les identifiants Google
npm run dev
```

Sans identifiants Google, l'application démarre et affiche un état « à configurer » ;
la connexion se vérifie dans l'écran Réglages.

## Structure

- `app/` — écrans (Budget, Lots, Ajouter, Réglages) et routes API.
- `app/styles/` — `tokens.css` (variables), `base.css`, `screens.css`.
- `lib/` — accès Google (`google`, `sheets`, `drive`), calculs (`facture`), formats.
- `components/` — coque : navigation, en-tête, icônes.

## Configuration

Variables d'environnement (voir `.env.example`) : `HMP_SPREADSHEET_ID`,
`HMP_DRIVE_LOTS_PARENT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`. À renseigner dans Vercel, jamais dans le dépôt.
