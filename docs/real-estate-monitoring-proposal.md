# Proposition — Outil de veille & scraping immobilier

Statut : **proposition initiale, aucun code applicatif écrit**. Destinée à revue critique (ChatGPT) avant implémentation.

> Note de contexte : ce dépôt (`undercover`) contient actuellement une petite app statique sans rapport (un jeu de société "Undercover" en une page HTML). Voir la question Q0 en section 11 — à trancher avant de coder : nouveau dépôt dédié, ou réutilisation de celui-ci.

---

## 0. Hypothèses explicites (à valider ou corriger)

- Usage mono-utilisateur au départ (toi), pas de multi-comptes/permissions fines pour le MVP.
- Périmètre géographique : France uniquement au MVP.
- Hébergement : un serveur/VPS unique (pas de scale horizontal nécessaire au départ).
- Pas de budget connu pour API payantes tierces (ex. API portails premium) — à confirmer en Q7.
- "Client ou projet" sur un scénario est un simple champ texte/label, pas un système multi-tenant avec droits séparés.
- Alertes et exports sont explicitement **post-MVP** (demandé dans le brief).
- Tolérance au risque juridique : prudente par défaut (API/flux officiels priorisés, scraping HTML en dernier recours et avec parcimonie) — à confirmer en Q5.

---

## 1. Fonctionnalités exactes du MVP

### Dans le MVP

**Scénarios de veille**
- CRUD complet : créer, modifier, dupliquer, mettre en pause/réactiver, supprimer.
- Champs configurables par scénario : nom, client/projet (texte libre), résidentiel/professionnel, achat/location, type(s) de bien, zones géographiques (villes, codes postaux, départements, ou rayon autour d'un point), budget min/max, surface min/max, critères additionnels simples (pièces, étage, etc. sous forme de critères clé/valeur extensibles), mots-clés inclus/exclus, sources à surveiller, fréquence de collecte, statut actif/pause.
- Résultats, favoris, écartés et historique **isolés par scénario** (même annonce peut apparaître dans plusieurs scénarios avec des statuts différents dans chacun).

**Connecteurs (mutualisés par source, pas par scénario)**
- Interface commune à tous les connecteurs (fetch → parse → normaliser).
- 1 à 2 connecteurs réels au MVP (sources à choisir en Q1 — privilégier une source avec API/flux légal pour valider le pipeline sans risque juridique dès le départ).
- Statut de santé par connecteur (dernier succès, dernier échec, nombre d'échecs consécutifs) visible dans le dashboard.

**Pipeline catalogue commun**
- Normalisation des annonces vers un schéma unique, quelle que soit la source.
- Déduplication intra-source (ré-annonce déjà connue → mise à jour, pas doublon) et inter-source basique (clé exacte : adresse/CP + surface + prix ; le fuzzy matching avancé est post-MVP, voir section 6).
- Détection nouvelle annonce vs déjà connue.
- Suivi des changements de prix / statut (active, retirée, vendue/louée si détectable) avec historique horodaté.

**Moteur de correspondance**
- Application des critères de chaque scénario actif sur le catalogue commun après chaque ingestion.
- Un scénario ne voit que les annonces qui correspondent à ses critères.

**Dashboard**
- Vue par scénario : liste des annonces (nouvelles en évidence), filtrage/tri simples (prix, surface, date), marquer favori/écarté, voir l'historique de prix d'une annonce.
- Vue globale de santé des connecteurs (erreurs, dernière exécution).

**Ordonnancement**
- Exécution automatique quotidienne des collectes (fréquence par scénario respectée, mais le run de connecteur est mutualisé par source — voir section 8).

**Score simple**
- Un score/tri basique par scénario (ex. correspondance des critères + fraîcheur), pas un moteur de règles complexe custom pondérable par l'utilisateur (ça, c'est V2).

### Explicitement hors MVP (V2+)

- Alertes (email/push/Slack) sur nouvelles annonces.
- Exports (CSV/Excel/API).
- Règles de classement/pondération personnalisables par l'utilisateur (au-delà d'un tri simple).
- Fuzzy dedup avancé (similarité de texte, géocodage précis, embeddings).
- Multi-utilisateurs avec permissions, partage de scénario avec un client.
- Carte interactive, géocodage/rayon précis avec PostGIS.
- Notifications de connecteur cassé par email (le MVP se contente d'un indicateur dans le dashboard).
- Détection avancée du statut "vendu/loué" (souvent non fiable sans confirmation).

---

## 2. Stack technique recommandée

| Composant | Choix | Pourquoi |
|---|---|---|
| Langage backend | Python 3.12 | Écosystème scraping/parsing mature (httpx, BeautifulSoup, Playwright, feedparser, rapidfuzz), bon pour pipelines batch, facile à tester avec fixtures. |
| Framework API | FastAPI | Typé (Pydantic), async natif (utile pour I/O réseau des connecteurs), génère une doc OpenAPI gratuite, léger. |
| Base de données | PostgreSQL | JSONB pour les critères de scénario et données brutes hétérogènes, contraintes/index solides pour la dédup, extension PostGIS disponible plus tard si besoin de rayon géographique précis. |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | Standard, migrations versionnées indispensables vu que le modèle va évoluer (nouveaux critères, nouveaux champs par connecteur). |
| Ordonnancement | APScheduler (in-process) au MVP | Suffisant pour des jobs quotidiens/horaires sans infra supplémentaire. Migration vers Celery + Redis seulement si besoin réel de parallélisme/distribution (à réévaluer, pas anticipé au MVP pour éviter la sur-ingénierie). |
| Connecteurs "API/flux" | httpx + feedparser | Pour sources avec API officielle ou flux RSS/Atom — cas prioritaire. |
| Connecteurs "rendu JS" | Playwright (uniquement si nécessaire et autorisé) | Certains sites nécessitent JS ; à n'utiliser qu'après vérification CGU/robots.txt (voir section 9). |
| Frontend MVP | FastAPI + Jinja2 + HTMX | Permet un dashboard fonctionnel rapidement sans construire un frontend séparé ; l'API JSON reste propre en dessous, donc migration vers une SPA (React/Vite) possible plus tard sans réécrire le backend. |
| Tests | pytest + respx/vcrpy (fixtures HTTP enregistrées) | Les tests de connecteurs ne doivent jamais taper les vrais sites en CI — on rejoue des réponses enregistrées. |
| Déploiement | Docker Compose (app + Postgres) sur un VPS unique | Simple, reproductible, pas de sur-dimensionnement cloud pour un usage mono-utilisateur. |
| Auth MVP | Login unique (mot de passe + session), pas de gestion de rôles | Suffisant tant qu'il n'y a qu'un utilisateur (toi) ; à revoir si "Steamcar" implique un accès pour un tiers (Q6). |

Alternative écartée : stack full-JS/TypeScript (Node + Next.js). Viable aussi, mais l'écosystème Python est plus mûr pour le scraping/parsing HTML et le traitement batch, ce qui est le cœur du produit ici. Je recommande Python sauf préférence contraire de ta part.

---

## 3. Architecture générale

```
                ┌─────────────────────────────────────────────┐
                │                Scheduler                     │
                │  (déclenche les runs par source, quotidien)  │
                └───────────────────┬───────────────────────────┘
                                    │
                ┌───────────────────▼───────────────────────────┐
                │              Connecteurs (par source)          │
                │  interface commune: fetch() → parse() → items  │
                │  ex: LeboncoinConnector, PapConnector, ...      │
                └───────────────────┬───────────────────────────┘
                                    │  items bruts
                ┌───────────────────▼───────────────────────────┐
                │           Pipeline de normalisation             │
                │  brut source-spécifique → schéma Listing commun │
                └───────────────────┬───────────────────────────┘
                                    │
                ┌───────────────────▼───────────────────────────┐
                │         Moteur de déduplication / upsert        │
                │  clé exacte (MVP) → Catalogue commun (Listing)  │
                │  + ListingSnapshot (historique prix/statut)      │
                └───────────────────┬───────────────────────────┘
                                    │  nouvelles / annonces modifiées
                ┌───────────────────▼───────────────────────────┐
                │              Moteur de correspondance            │
                │   pour chaque Scénario actif → évalue critères   │
                │   → ScenarioMatch (nouveau statut, score)         │
                └───────────────────┬───────────────────────────┘
                                    │
                ┌───────────────────▼───────────────────────────┐
                │            API (FastAPI, JSON + HTML/HTMX)       │
                └───────────────────┬───────────────────────────┘
                                    │
                ┌───────────────────▼───────────────────────────┐
                │         Dashboard (par scénario + santé)         │
                └───────────────────────────────────────────────┘
```

Principe clé : **une annonce est collectée et normalisée une seule fois** dans le catalogue commun. Les scénarios ne font qu'interroger/filtrer ce catalogue — ils ne déclenchent jamais eux-mêmes une collecte spécifique. Ajouter un scénario = ajouter des critères, jamais un nouveau connecteur.

---

## 4. Modèle de données principal

```
Source
 - id, name, connector_key, base_url
 - kind: "api" | "rss" | "html_scrape"
 - legal_basis: notes CGU/robots.txt (texte)
 - status: "active" | "disabled" | "broken"
 - default_frequency

Scenario
 - id, name, client_label (nullable)
 - category: "residential" | "professional"
 - transaction: "buy" | "rent"
 - property_types: [] (maison, appartement, local commercial, immeuble, terrain...)
 - geo_criteria: { cities[], postal_codes[], departments[], radius: {center_lat, center_lng, km} }
 - budget_min, budget_max
 - surface_min, surface_max
 - extra_criteria: jsonb (pièces, étage, DPE, etc. — extensible sans migration)
 - keywords_include: [], keywords_exclude: []
 - source_ids: [] (quelles sources surveiller pour ce scénario)
 - frequency
 - ranking_rule: simple au MVP (ex: "newest_first" | "best_price_per_m2")
 - status: "active" | "paused"
 - created_at, updated_at

Listing  (catalogue commun, dédupliqué)
 - id, dedup_key (hash déterministe: source_id normalisé ou clé cross-source)
 - source_id, external_id, url
 - title, description
 - property_type, transaction_type
 - price, surface, rooms
 - city, postal_code, department, lat, lng (si dispo)
 - status: "active" | "removed" | "unknown"
 - first_seen_at, last_seen_at
 - raw_data: jsonb (payload brut normalisé, pour debug/re-traitement)

ListingSnapshot (historique)
 - id, listing_id, captured_at
 - price, status, content_hash
 - diff_summary (ex: "price -5%", "status changed")

ScenarioMatch
 - id, scenario_id, listing_id
 - first_matched_at, last_seen_matching_at
 - score
 - user_status: "new" | "seen" | "favorite" | "discarded"
 - notes (texte libre)

ConnectorRun
 - id, source_id, started_at, finished_at
 - status: "success" | "partial" | "error"
 - items_fetched, items_new, items_updated
 - error_message
```

Points de conception :
- `Listing` n'a **aucune** référence à un scénario — c'est le catalogue neutre.
- `ScenarioMatch` est la table de jonction qui porte tout l'état "vu par ce scénario" (favori, écarté, etc.), permettant qu'une même annonce ait un statut différent dans deux scénarios différents.
- `extra_criteria` en JSONB évite une migration à chaque nouveau critère ponctuel, tout en gardant les critères structurants (prix, surface, géo) en colonnes typées pour pouvoir indexer/requêter efficacement.

---

## 5. Cycle complet d'une annonce

1. **Collecte** : le scheduler déclenche le connecteur d'une source (ex. toutes les X heures selon la source, indépendamment des scénarios). Le connecteur récupère la liste brute (API/flux/HTML) et les items bruts sont stockés tels quels (traçabilité + rejouabilité en cas de bug de parsing).
2. **Normalisation** : chaque item brut est transformé vers le schéma `Listing` commun par le normaliseur du connecteur (mapping champs source → champs communs, parsing prix/surface, nettoyage texte).
3. **Déduplication / upsert** :
   - Si `dedup_key` déjà connue pour cette source → mise à jour du `Listing` existant (`last_seen_at`), et si prix/statut/contenu a changé → écriture d'un `ListingSnapshot`.
   - Si `dedup_key` correspond (via règles cross-source, MVP = clé exacte) à un `Listing` d'une autre source → fusion/liaison (le `Listing` garde une trace des sources multiples).
   - Sinon → création d'un nouveau `Listing`, `first_seen_at` = maintenant.
4. **Correspondance** : pour chaque `Scenario` actif dont `source_ids` inclut cette source, on évalue les critères sur le `Listing` (nouveau ou modifié). Match → création/màj d'un `ScenarioMatch` avec `user_status = "new"` si c'est une première correspondance pour ce scénario.
5. **Présentation** : le dashboard, filtré par scénario, affiche les `ScenarioMatch` triés selon la `ranking_rule`, avec badge "nouveau" tant que l'utilisateur ne l'a pas marqué "vu".
6. **Suivi dans le temps** : si l'annonce n'est plus vue lors d'une collecte ultérieure (absente du flux), elle passe `status = "removed"` après un délai de grâce (ex. absente 2 collectes consécutives, pour éviter les faux positifs dus à une pagination instable) — visible dans le dashboard comme "annonce retirée".

---

## 6. Stratégie de déduplication et de suivi des modifications

**Intra-source (facile, MVP jour 1)**
- Chaque source fournit un identifiant externe stable (`external_id` dans l'URL ou l'API). Upsert direct sur `(source_id, external_id)`.

**Cross-source (même bien annoncé sur 2 portails différents)**
- MVP : clé approximative mais stricte — normalisation de `(code_postal, surface arrondie, prix arrondi à 1%, type de bien)`. Si ça matche exactement, on lie les deux `Listing` comme doublons probables mais on **ne fusionne pas silencieusement** : on marque `possible_duplicate_of` et on laisse les deux entrées visibles avec un badge, pour éviter de perdre une annonce à tort (un faux négatif — deux vrais biens différents fusionnés à tort — est pire qu'un doublon visible).
- V2 : score de similarité texte (rapidfuzz sur titre/description) + tolérance géographique + tolérance prix plus fine, avec seuil de confiance ajustable, potentiellement géocodage pour comparer des coordonnées précises.

**Suivi des modifications**
- Un `content_hash` (hash du titre+description+prix+statut) est recalculé à chaque collecte. S'il diffère du dernier snapshot → nouveau `ListingSnapshot` avec un résumé du diff (prix, statut, ou contenu texte).
- Le prix est suivi spécifiquement (colonne dédiée) pour permettre un historique/graphique de prix par annonce.

---

## 7. Ajouter un nouveau connecteur

1. Implémenter l'interface commune (ex. classe Python respectant un `Protocol`) :
   - `fetch_raw() -> list[RawItem]` (appel API/flux/HTML)
   - `normalize(raw_item) -> NormalizedListing` (mapping vers le schéma commun)
2. Déclarer les métadonnées de la `Source` (type, base légale, fréquence par défaut, statut).
3. Écrire des fixtures de test (réponses enregistrées) et des tests unitaires du normaliseur — aucun appel réseau réel en CI.
4. Activer la source avec `status = "disabled"` par défaut, tester manuellement en environnement de dev, puis passer à `"active"`.
5. Documenter dans le connecteur les contraintes CGU/robots.txt constatées (champ `legal_basis`), pour audit ultérieur.
6. Aucune modification du moteur de correspondance ni des scénarios n'est nécessaire — un scénario existant commence à recevoir des résultats de la nouvelle source dès qu'un utilisateur l'ajoute à `source_ids`.

Isolation : si un connecteur casse (site qui change son HTML), seul son propre run échoue (`ConnectorRun.status = "error"`), les autres sources et le reste de l'app continuent de fonctionner normalement.

---

## 8. Planification des collectes quotidiennes et gestion des erreurs

- Le scheduler ordonnance **par source**, pas par scénario (mutualisation). Fréquence par défaut : quotidienne, ajustable par source (certaines sources API peuvent supporter une fréquence plus élevée).
- La "fréquence" définie sur un scénario détermine la fréquence *minimale* à laquelle ses sources doivent être rafraîchies pour lui — si deux scénarios pointent vers la même source avec des fréquences différentes, la source est collectée à la fréquence la plus élevée demandée (mutualisation, pas de double collecte).
- Chaque run de connecteur est journalisé (`ConnectorRun`) avec statut, compteurs, message d'erreur.
- Gestion des erreurs :
  - Retry avec backoff sur erreurs réseau transitoires (ex. 3 tentatives).
  - Après N échecs consécutifs (ex. 3), la source passe `status = "broken"` et un indicateur visible apparaît dans le dashboard (pas d'email au MVP, cf. hors-MVP).
  - Respect d'un rate-limit configurable par source pour rester raisonnable vis-à-vis du site cible.
  - Timeout strict par run pour éviter qu'un connecteur bloque le scheduler.

---

## 9. Risques techniques, juridiques et opérationnels

**Juridiques (les plus critiques, à trancher avant de coder les connecteurs HTML)**
- Les CGU de la plupart des grands portails (Leboncoin, SeLoger, etc.) **interdisent explicitement l'extraction automatisée**. Le `robots.txt` peut aussi désautoriser le crawl de certaines zones.
- Le RGPD s'applique dès qu'une annonce contient des données personnelles (nom, téléphone, email d'un particulier vendeur) : minimiser la collecte de ces champs, ne pas les republier, définir une durée de conservation, avoir une base légale pour le traitement (probablement intérêt légitime pour un usage personnel, mais un usage type "Steamcar" pour un client pose des questions différentes — voir Q5).
- Recommandation : prioriser strictement les sources avec API officielle, flux RSS/Atom publics, ou données ouvertes (ex. DVF/données notariales) pour le MVP. Le scraping HTML de portails à CGU restrictives est un risque à traiter au cas par cas, avec validation explicite de ta part avant activation de chaque connecteur de ce type.

**Techniques**
- Fragilité du HTML scraping : un changement de structure de page casse le connecteur (mitigé par l'architecture modulaire + tests de fixtures + alerting de santé).
- Anti-bot (captcha, blocage IP, rate limiting) sur les sources scrapées — peut nécessiter des délais, rotation d'IP (attention : la rotation d'IP pour contourner un blocage explicite peut aggraver le risque juridique, à ne pas faire sans validation).
- Qualité de dédup imparfaite au MVP (clé exacte) → doublons visibles mais gérables, faux négatifs de fusion peu probables.

**Opérationnels**
- Dépendance à un connecteur unique pour un scénario = point de défaillance si cette source tombe ou change ses CGU. D'où l'intérêt de pouvoir attacher plusieurs sources à un même scénario dès le MVP.
- Volume de données croissant (historique de snapshots) — prévoir une politique de rétention/purge dès que le volume devient significatif (pas critique au MVP, à surveiller).
- Coût potentiel si on doit passer à des API payantes ou des proxies pour contourner des blocages (à ne considérer qu'après validation légale).

---

## 10. Plan de réalisation — étapes vérifiables

Chaque étape produit quelque chose de démontrable, testable indépendamment.

1. **Socle** : structure du projet, Docker Compose (app + Postgres), CI basique (lint + tests).
2. **Modèle de données v1** : migrations Alembic pour `Source`, `Scenario`, `Listing`, `ListingSnapshot`, `ScenarioMatch`, `ConnectorRun`. Tests de migration.
3. **Premier connecteur (source légale/API ou flux)** : implémentation + normalisation + tests fixtures. Vertical slice complet jusqu'au stockage en `Listing`, sans dédup ni scénario encore.
4. **Déduplication intra-source + historique** : upsert par `external_id`, création de `ListingSnapshot` sur changement détecté. Démontrable via un run répété avec données modifiées en fixture.
5. **CRUD Scénario** (API + formulaire minimal) : créer/modifier/dupliquer/pauser/supprimer, avec les critères. Pas encore de matching.
6. **Moteur de correspondance v1** : évaluation des critères d'un scénario sur le catalogue, création de `ScenarioMatch`. Démontrable avec données de test.
7. **Dashboard MVP** : liste par scénario, badge nouveau, favoris/écartés, historique de prix d'une annonce.
8. **Scheduler** : exécution automatique quotidienne, `ConnectorRun` journalisé, page de santé des connecteurs.
9. **Deuxième connecteur** (source différente) : validation concrète que l'ajout d'une source ne touche ni au moteur de matching ni aux scénarios existants — critère de succès explicite de la modularité.
10. **Dédup cross-source v1** (clé exacte + badge doublon probable).
11. *(Post-MVP, à planifier après validation du MVP)* : alertes, exports, fuzzy dedup avancé, pondération de score personnalisable.

---

## 11. Questions auxquelles j'ai besoin d'une réponse avant de coder

- **Q0 — Dépôt** : ce dépôt `undercover` contient une app sans rapport (jeu de société). On crée un nouveau dépôt dédié pour cet outil, ou on réutilise celui-ci (et on supprime/archive l'existant) ?
- **Q1 — Sources prioritaires** : quelles sources veux-tu couvrir en premier ? Idéalement au moins une avec API/flux officiel pour valider le pipeline sans risque juridique dès le MVP (ex. données notariales/DVF pour des indicateurs de marché, flux RSS d'agences, API si tu as des accès partenaires). As-tu déjà des accès à des API payantes de portails (ex. API pro Leboncoin/SeLoger) ?
- **Q2 — Utilisateurs** : usage strictement pour toi seul, ou d'autres personnes (ex. un client du scénario "Steamcar") doivent-elles se connecter et voir leurs propres résultats ?
- **Q3 — Hébergement** : tu as déjà un serveur/VPS, ou faut-il le prévoir ? Contrainte de budget mensuel ?
- **Q4 — Zone géographique** : confirmé France uniquement pour le MVP ?
- **Q5 — Tolérance légale** : es-tu d'accord pour que le MVP se limite strictement à des sources API/flux/données ouvertes, et que tout scraping HTML de portail à CGU restrictive passe par une validation explicite de ta part avant activation, plutôt que d'être automatiquement inclus dans le plan ?
- **Q6 — Canal d'alerte préféré** (pour la V2, mais utile à savoir maintenant) : email, push, Slack, autre ?
- **Q7 — Budget outillage** : ok pour dépendre d'outils gratuits/open-source uniquement au MVP (pas de proxy payant, pas d'API payante) ?
- **Q8 — Rétention** : combien de temps veux-tu garder l'historique des annonces écartées/retirées avant purge (pas bloquant pour le MVP mais impacte le modèle de rétention) ?
- **Q9 — Critères "autres"** : au-delà de prix/surface/type/géo/mots-clés, y a-t-il des critères que tu sais déjà vouloir (ex. DPE, étage, présence de garage, date de construction) qui justifieraient des colonnes dédiées plutôt que le champ `extra_criteria` générique ?
