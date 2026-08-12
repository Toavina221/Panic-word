# État du projet PANIC WORD (notes internes)

## Contexte
- Cahier des charges : jeu d'anagrammes sous pression (3 s/mot), solo + multijoueur, FR/EN/ES, thèmes Normal/Horreur/Cyberpunk, sons 100% Web Audio API (aucun fichier externe), reconnaissance vocale Web Speech, PWA offline (manifest + SW), fin de partie avec partage.
- Structure UI : Home (/) → Solo (/solo) → Multi (/multi) → End (/end?s=&b=&m=).

## Fichiers clés créés
- shared/game.ts — logique métier (normalize, shuffle mulberry32, scrambleWord, difficultyOf, pickSeries, roundScore, totalScore, checkAnswer, generateRoomCode, constantes ROUND_DURATION_MS=3000, ROUNDS_PER_GAME=10, MAX_SCORE_PER_ROUND=1000)
- client/public/data/{fr,en,es}.json — banques validées (4-7 lettres : fr=45, en=42, es=37)
- client/src/lib/wordBank.ts — chargement banques + filtre difficulté
- client/src/lib/audio.ts — sons Web Audio API (countdownTick, playVictory, playFailure, startPressureAmbiance par thème, playReveal)
- client/src/lib/voice.ts — Web Speech API (listenVoice, isVoiceSupported)
- client/src/lib/storage.ts — localStorage prefs + records (meilleur score)
- client/src/contexts/GameContext.tsx — provider global, i18n UI complète FR/EN/ES, application data-theme
- client/src/index.css — thèmes CSS complets (data-theme=normal|horror|cyberpunk), bulles 3D, shake, flash ampoule, glitch, chrono
- client/src/hooks/useGameEngine.ts — moteur rounds (states idle/reveal/playing/correct/missed/finished), roundIndex exposé
- client/src/components/CodeRain.tsx — fond lignes de code cyberpunk
- client/src/pages/Home.tsx — accueil + pop-up casque (localStorage headsetWarningSeen)
- client/src/pages/Solo.tsx — choix difficulté
- client/src/pages/Game.tsx — cœur du jeu (bulles, chrono, saisie clavier/voix, auto-validate, ambiance pression)
- client/src/pages/Multi.tsx — créer/rejoindre salle (code 4 lettres), lobby, polling 1200ms classement
- client/src/pages/GameEnd.tsx — scores par manche, record, rejouer, partage (Web Share API / clipboard)
- server/routers/multi.ts — salles mémoire (createRoom, joinRoom, getRoom, reportRound, finishGame, listPlayers)
- server/routers.ts — multiRouter enregistré
- client/public/manifest.json, service-worker.js, icons/icon-192/512.png
- client/index.html — fonts Cinzel/Orbitron/Inter, manifest, meta PWA
- client/src/main.tsx — SW registration en PROD uniquement
- client/src/App.tsx — routes + GameProvider + ThemeProvider dark
- server/game.test.ts — tests vitest logique partagée

## Icônes
- /home/ubuntu/webdev-static-assets/panicword-icon-{192,512}.png
- Storage: /manus-storage/panicword-icon-192_23927992.png et /manus-storage/panicword-icon-512_090e396b.png
- Copiées aussi dans client/public/icons/ (192=2.2ko, 512=6ko — ok)

## Reste à faire
1. Vérifs visuelles desktop+mobile, thème horreur/cyberpunk dynamiques, écran /end avec tableau manches, /history
2. Marquer todo.md [x] + checkpoint + livraison

## Avancement phase 6 (écarts comblés)
- [FAIT] Leaderboard temps réel overlay pendant partie multi (Multi.tsx step=playing, polling 1200ms affiche inputMode+scores)
- [FAIT] Verrouillage saisie par salle : multiRouter.store inputMode (hôte via createRoom.inputMode), getRoom/joinRoom retournent inputMode ; Game.tsx prop overrideInputMode
- [FAIT] Historique : page /history (History.tsx), route dans App.tsx, lien sur accueil (bouton record), clés i18n history.* ajoutées à GameContext
- [FAIT] Tableau manches fin de partie : lastDetail depuis localStorage panicword.lastSoloDetails, sauvé dans Game.tsx onFinished (solo)
- [FAIT] Params URL /end : s, f, n, b, m
- [À FAIRE] Clarification offline : périmètre = solo/PWA 100% offline, multi nécessite réseau (polling tRPC)

## Phase 8 — Retours utilisateur v2 (en cours)
Retours : (1) chrono configurable défaut 3s, options ≤10s ; (2) pas de bouton Start au lancement — Restart seulement ; (3) sons pas assez pressants + choix d'intensité.

Déjà fait :
- shared/game.ts : type SoundIntensity, ROUND_DURATION_OPTIONS=[2,3,5,7,10]s, MIN=2000 MAX=10000, roundScore(elapsed, duration) paramétré, SOUND_INTENSITIES (soft/normal/terrifying, labels FR/EN/ES)
- useGameEngine.ts : état "start" initial (bouton Commencer requis), prop durationMs + normalizeDuration, durationRef, duration exposée, pression démarre à min(durée/2, 1500ms), ROUND_DURATION_MS remplacé par roundScoreFn(elapsed, durationRef.current)

## Phase 8-9 — RETOURS v2 TERMINÉS (2026-08-12)
- chrono réglable (2/3/5/7/10s, défaut 3s) dans Home.tsx, persisté (storage roundDurationMs), imposé en multi (hôte → salle → overrideRoundDurationMs dans Game)
- bouton COMMENCER : engine init roundState="start", Game.tsx affiche gros bouton (resumeAudio + engine.start()) + durée affichée
- sons plus pressants : drone 48Hz + triton + craquements fréquents (horreur), sirene accélérant + sub-bass (cyberpunk), countdownTick plus strident
- sélecteur intensité sonore (Doux/Normal/Terrifiant) Home.tsx → setSoundIntensity → audio.ts pressureCoeffs
- i18n : home.timer/timerLabel/intensity/intensityLabel, game.start/game.perRound
- game.test.ts : +5 tests (25 passent), tsc 0 erreurs

## Phase 10 — DEBUG BUG v3 (2026-08-12) — signalé par l'utilisateur
Bug : InvalidStateError "cannot call start more than once" (audio.ts:153 startPressureAmbiance) quand on rate un mot + thème horreur. Le son de pression continue, le chrono gèle.

FAIT (audio.ts) :
- doublons screech.start/lfo.start supprimés (lignes 196-197 redondantes) — C'ÉTAIT LA CAUSE PRINCIPALE
- safeStart() wrapper try/catch pour tous les nodes ambiance + playFailure
- playWrong() nouveau : buzzer sec 160→90Hz 0.3s (ne gèle pas le chrono)

FAIT (useGameEngine.ts) :
- submit : mauvaise réponse = playWrong() + return false SANS stopLoop() — le chrono continue
- victoire : stopLoop() conservé dans la branche ok
- import playWrong ajouté

FAIT (voice.ts) :
- running guard + release() + recréation instance SpeechRecognition après erreur (une instance arrêtée ne peut plus redémarrer → InvalidStateError)
- onresult/onerror/onend = handlers nommés onResultHandler/onErrorHandler/onEndHandler

FAIT (Game.tsx) :
- onSubmit : playWrong() + shake + toast error → clé i18n "game.wrong" À AJOUTER dans GameContext (actuellement t("game.wrong") non défini !)

RESTE :
- Ajouter clé i18n game.wrong (FR "Ce n'est pas le mot...", EN "Wrong word...", ES "No es la palabra...") dans GameContext.tsx
- Vérifier que le mot "DROD" dans la capture = scramble de DORD? (probablement DROD ou mot valide — vérifier scrambleWord ne duplique jamais le mot)
- pnpm check + pnpm test + screenshot solo (vérifier bouton COMMENCER après corrections)
- Todo v3 : tout cocher sauf livraison

Reste à faire :
- [FAIT] storage.ts roundDurationMs/soundIntensity ajoutés (defaults 3000/"normal")
- [FAIT] GameContext : setRoundDuration, setSoundIntensity, SOUND_INTENSITIES réexporté, clés i18n home.timer/home.timerLabel/home.intensity/home.intensityLabel/game.start
- [FAIT] audio.ts : setSoundIntensity(intensity) ajouté, countdownTick + startPressureAmbiance (drone 48Hz + triton + craquements plus fréquents + sub-bass) + pressureCoeffs par intensité, crackle(ac, volMult)
- [FAIT] Game.tsx : état "start" avec gros bouton COMMENCER (resumeAudio + engine.start()), overrideRoundDurationMs prop, roundDurationMs = override ?? settings.roundDurationMs, setSoundIntensity au montage, progress/timeLeft basés sur engine.duration. Attention : home.timerLabel affiché dans Game avec replace pour retirer la parenthèse (laid, à améliorer en créant clé game.seconds)
- [FAIT] Home.tsx : sections durée chrono (2/3/5/7/10s) + intensité sonore après Thème
- [EN COURS] multi.ts : import MIN/MAX_ROUND_MS + clampDuration + MultiRoom.roundDurationMs OK (ajouté) ; createRoom input roundDurationMs optionnel + assignation + retour OK ; joinRoom retour roundDurationMs — manquant (ligne ~104) ; getRoom retour roundDurationMs — manquant (ligne ~121)
- [À FAIRE] Multi.tsx client : créerSalle → trpc input roundDurationMs: settings.roundDurationMs ; rejoindre → stocker roomRoundDurationMs dans state et le passer à Game overrideRoundDurationMs
- [À FAIRE] Solo.tsx : passer rien (Game lit déjà settings) — vérifier
- [À FAIRE] game.test.ts : tests durée configurable (roundScore custom + plage)
- [À FAIRE] pnpm test + tsc + screenshots + checkpoint

Checkpoint livraison précédent : c4edf8b7

## Vérifs visuelles (desktop+mobile, 2026-08-12)
- Accueil : OK (titre PANIC WORD, mode/langue/thème/saisie, record+historique, CTA Jouer)
- Mobile / : pop-up casque s'affiche correctement en premier lancement
- /solo, /multi, /history : OK desktop + mobile, responsive
- tscheck OK, tests 20/20
- Manque : capture de l'écran de jeu lui-même (impossible à capturer via screenshot statique car état temps-réel ; à valider via preview live par l'utilisateur)

## Points d'attention connus
- Le test totalScore a une parenthèse de trop dans l'écriture actuelle (à vérifier: `totalScore([{ score: 100 }, { score: 200 }, { score: 0 })).toBe(300)` — INVALIDE TS, corriger avant run)
- GameEnd "Rejouer" ne recharge pas les mots (navigate vers /end avec params mais engine.words=[]) → à corriger : charger la banque dans GameEnd ou rediriger vers /solo.
