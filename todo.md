# Project TODO — PANIC WORD

## Socle & architecture
- [x] Initialisation du projet web (web-db-user)
- [x] todo.md avec toutes les fonctionnalités

## Banques de mots multilingues
- [x] Fichiers JSON locaux : client/public/data/fr.json, en.json, es.json
- [x] Mots de 4 à 7 lettres, avec traduction du mot pour vérification normalisée
- [x] Niveaux de difficulté basés sur la longueur (Facile 4, Moyen 5, Difficile 6-7)
- [x] Module words : Fisher-Yates scrambling déterministe + normalisation Unicode (accents → de base)

## Moteur de jeu solo
- [x] Screen Solo : mot mélangé, lettres en bulles 3D distinctes, animation d'entrée (explosive/tombante)
- [x] Compte à rebours de 3 secondes (0,1 ms de précision) avec chrono visuel (barre + chiffres)
- [x] Validation instantanée : auto-valide quand la saisie forme le bon mot + bouton "Valider" géant
- [x] Enchaînement automatique vers le mot suivant (10 manches par partie)
- [x] Score au prorata du temps restant (si trouvé avant 3s), 0 point sinon
- [x] Rétroaction victoire (accord majeur ascendant) / échec (buzzer descendant) en Web Audio API
- [x] Son de compte à rebours accélérant (bips de plus en plus rapprochés)

## Saisie double
- [x] Saisie clavier : input clavier mobile-friendly (touch)
- [x] Reconnaissance vocale : Web Speech API (SpeechRecognition), traitement local, fallback gracieux si non supporté
- [x] Indicateur d'écoute vocale (pulse) + bouton micro

## Thèmes visuels & sonores (appliqués dynamiquement, sans rechargement)
- [x] Thème Normal : palette claire/élégante par défaut
- [x] Thème Horreur : palette rouge/noir/gris, flashs ampoule qui grille, glitch, tremblement violent des lettres
- [x] Thème Cyberpunk : néon sur fond sombre, lignes de code en arrière-plan (canvas), chrono holographique vert→rouge, sub-bass
- [x] Audio thème : horreur (cri/grincement qui monte), cyberpunk (bip bombe + sub-bass), générés en Web Audio (pas de fichiers)

## Écran d'accueil & config
- [x] Pop-up d'alerte au premier lancement : "Pour une expérience traumatisante maximale, branchez votre casque." (localStorage)
- [x] Choix du mode : Solo / Multijoueur
- [x] Choix de la langue (FR/EN/ES) avec interface traduite (i18n FR par défaut)
- [x] Choix du thème visuel (Normal / Horreur / Cyberpunk)
- [x] Design soigné : typographie raffinée, animations fluides, mobile-first

## Multijoueur synchronisé
- [x] Création de salle avec code de 4 lettres
- [x] Rejoindre une salle par code
- [x] Synchronisation des séries de mots (même graine = mêmes mots, même ordre)
- [x] Envoi minimal des données : pseudo + chrono/points de fin de manche (polling léger)
- [x] Classement en temps réel entre les joueurs de la salle
- [x] Mode verrouillé "Voix seule" ou "Clavier seul" pour équité

## Stockage local & scores
- [x] localStorage : préférences (langue, thème, mode de saisie), pseudo, pop-up vue
- [x] Historique des scores par partie (meilleur score, séries)
- [x] Persistance hors-ligne (tout le jeu fonctionne sans réseau)

## PWA & fin de partie
- [x] manifest.json (icônes, nom, fullscreen standalone, display iOS)
- [x] service-worker.js : cache des assets, stratégie offline-first, skipWaiting
- [x] Écran de fin de partie : tableau des scores par manche, score total, meilleur record
- [x] Bouton "Rejouer"
- [x] Partage du résultat (Web Share API + fallback copie/presse-papiers)

## Qualité
- [x] Tests vitest : scrambling, normalisation, calcul de score, routage des manches (20 tests passant)
- [x] Vérifications visuelles desktop + mobile
- [x] Checkpoint + livraison

## Retours utilisateur (v2)
- [x] Choix de durée de chrono : défaut 3 s, options 2–10 s (paramètre sur l'écran d'accueil, persisté dans les préférences)
- [x] Ajouter un vrai bouton « Commencer » au lancement du jeu (au lieu de devoir cliquer sur Restart)
- [x] Sons plus pressants / angoissants : réécrire les ambiances de pression Web Audio
- [x] Sélecteur d'intensité sonore (choix de sons : doux / normal / terrifiant)
- [x] Synchroniser la durée de chrono entre les joueurs d'une salle multijoueur
- [x] Traductions i18n pour les nouveaux sélecteurs (chrono, intensité sonore, bouton commencer)
- [x] Tests vitest pour la nouvelle durée configurable (25 tests passant)
- [x] Vérifications visuelles, checkpoint et livraison

## Bug signalé (v3)
- [x] InvalidStateError "cannot call start more than once" (AudioScheduledSourceNode) — doublons start supprimés + safeStart() + voice.ts recrée l'instance après erreur
- [x] Après une mauvaise réponse : jouer un son d'erreur sec (playWrong) puis LE CHRONO CONTINUE jusqu'à épuisement (pas de gel)
- [x] Le son de pression (ambiance) s'arrête proprement en fin de manche (réponse correcte ou temps écoulé)
- [x] Tester le scénario "mot non trouvé + erreur" : manche écoulée → onContinue au mot suivant sans plantage
- [x] Vérification visuelle, tests, checkpoint et livraison

## Améliorations v4
- [x] Recentrer l'affichage en jeu (verticalement centré, pas collé en haut)
- [x] Chaos visuel global en fin de manche (pas seulement la barre) : tremblement de l'écran, distorsion, clignotement rouge, bulles qui se déforment
- [x] Banque de mots malgache (mg.json, 4-7 lettres) + détection MG
- [x] Banque de mots allemande (de.json, 4-7 lettres)
- [x] Traductions UI en malgache et allemand (GameContext UI)
- [x] Sélecteurs langue MG/DE sur l'accueil + persistance préférences
- [x] Reconnaissance vocale : mappage MG/DE vers les locales du navigateur
- [x] Tests et vérifications, checkpoint et livraison

## v5 — Auto-validation à longueur atteinte
- [x] Auto-validation : dès que l'utilisateur tape le nombre de lettres du mot cible, la réponse est jugée automatiquement
- [x] Après un échec : champ vide automatiquement pour retaper, chrono continue
- [x] Tests, vérification visuelle, checkpoint et livraison
