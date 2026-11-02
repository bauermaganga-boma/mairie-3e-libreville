# Mairie du 3e arrondissement de Libreville — portail municipal, e-Services et back-office

Site de démonstration conçu par Rouana pour la mairie du 3e arrondissement de Libreville (Mont-Bouët, Petit-Paris, Akébé), à partir du site de la Mairie de Libreville. Mode **mono-arrondissement** : toutes les données portent `arr = 3`. Faits : `dossier-3e-arrondissement.json` (recherche du 1er novembre 2026) ; les éléments non vérifiés sont signalés « à confirmer ».

L'équipe : **Franck Ibouili**, maire (installé le 19 novembre 2025), et ses adjoints **Alex Jordy Mangala Yentsa** et **Boris Mba Ndong**. La mairie centrale (maire : Eugène Mba) est présentée à part (`MAIRIE.centrale` / `CENTRALE` dans `data.js`).

## Pages publiques
- `index.html` : accueil (« Que voulez-vous faire ? », mot du maire du 3e, e-Services, démarches, quartiers, projets, actualités, application installable)
- `mairie.html` : le maire du 3e et ses deux adjoints, organisation, la mairie centrale de Libreville
- `arrondissements.html` : le 3e arrondissement, ses quartiers (Mont-Bouët, Petit-Paris, Akébé Ville / Likouala ; Sorbonne et Nombakélé-Nord à confirmer), équipements et actions datées
- `demarches.html` : démarches (état civil, mariage, vignette, marché, urbanisme, rendez-vous au guichet avec choix du créneau, signalement, audience), paiement Airtel Money / Moov Money / carte ou guichet, suivi, PDF, documents authentifiés. Information timbres : depuis la note du 1er octobre 2026, la légalisation des actes d'état civil se fait **sans timbre** jusqu'au retour des stocks (actes de décès : volets à timbrer ultérieurement).
- `payer.html` : e-Services — payer une taxe (vignettes, droits de place, domaine public, publicité), vignette PDF avec QR code, reçu PDF ; vérifier une vignette (saisie ou scan) ; e-Tax et MADIGIPAIE
- `transparence.html` : dotation de l'arrondissement (70 → ~230 M FCFA) dans le budget communal 2026 de 30,77 Md FCFA, chronologie
- `projets.html` (marché d'Akébé Ville, centre de santé d'Akébé, canal du PK8, salubrité Petit-Paris / Mont-Bouët, marchés), `actualites.html` (presse + avis + galerie créditée), `contact.html`

Mobile : barre d'onglets en bas, bouton Retour, fenêtres plein écran. Le site s'installe comme une application (`manifest.webmanifest`, `sw.js`, cache `l3e-v1`).

## Back-office (`espace.html` → `agents.html`)
| Profil | Identifiant / mot de passe (démo) | Modules |
|---|---|---|
| Cabinet du maire du 3e | `maire` / `3e2026` | tout |
| Secrétariat | `secretariat` / `admin2026` | tout + comptes |
| État civil | `etat.civil` / `agent2026` | demandes, rendez-vous, actes authentifiés, registre, messages, stocks |
| Services techniques | `services.techniques` / `agent2026` | signalements, chantiers, stocks |
| Recettes & e-Tax | `recettes` / `agent2026` | recettes, **vignettes QR** (registre, contrôle terrain par scan), indicateurs |
| Ressources humaines | `rh` / `agent2026` | personnel |

Le rôle « mairie d'arrondissement » et les comptes `arr1` … `arr6` n'existent plus. Mots de passe de démonstration : à changer avant la mise en service.

Démonstration : vignette `L3-TX-0001` (plaque `GA 0001 LV`, valide) · dossier `L3-26-01234` / `077 12 34 56` (document prêt) · dossier `L3-26-01235` / `074 55 66 77` (paiement au guichet) · acte `0312/2004` / Mengue (authentifié). Références : `L3-AA-NNNNN` (démarches), `SIG-AA-NNNN` (signalements), `L3-TX-NNNN` (vignettes).

Personnes, montants, stocks et effectifs de démonstration **fictifs** (les lieux, projets et dates viennent du dossier) ; paiements **simulés**. Le stock de timbres municipaux est à zéro (pénurie depuis le 29 septembre 2026). Tarifs indicatifs à fixer par délibération. En production, les paiements se raccordent à la plateforme **e-Tax** (etax-libreville.ga) et à **MADIGIPAIE**.

## Base de données
- `assets/js/config.js` vide = mode démonstration (données dans le navigateur, clés `l3e_db_v1` / `l3e_session`, sans conflit avec le site de Libreville).
- Supabase : créer un **nouveau projet**, exécuter `supabase/install.sql`, puis renseigner l'URL et la clé publique dans `config.js`. Les identifiants sont `<login>@mairie-3e.local`. Avant la mise en service : changer les mots de passe et passer `showDemo` à `false`.

## À confirmer avec la mairie
- Adresse (avenue de Cointet, source unique non officielle), téléphones, e-mail, horaires : non publiés, donc masqués.
- Liste officielle des quartiers : Mont-Bouët, Petit-Paris et Akébé sont confirmés ; Sorbonne et Nombakélé-Nord (liste électorale de 2018) à valider ; ne pas afficher Batterie IV, Lalala, Louis sans validation ; rattachement du PK8 et de la Peyrie au 3e.
- Parcours du maire, secrétaire général, conseillers et chefs de quartier ; population du 3e.
- Services d'état civil, pièces, délais et grille des tarifs (non publiés) ; réouverture des timbres.
- Ouverture effective du centre de santé d'Akébé et du centre médical du Pont d'Akébé ; calendrier du marché d'Akébé Ville.
- Photos : aucune photo libre propre au 3e ; photos de la ville sous licence CC BY-SA 4.0 (auteurs crédités) ; photos de presse (Gabonclic, Gabonreview, Gabon Media Time) à valider avec les médias ; photos réelles de la mairie à demander (page Facebook).
- Contenu de la page Facebook et des publications X (non lisibles lors de la recherche).

## Test
`node tests/e2e.js http://localhost:8091/` (puppeteer-core + Chrome ; variable `BROWSER` pour un autre navigateur).
