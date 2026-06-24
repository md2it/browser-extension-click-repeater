# CLICK REPEATER

=-=-=-=-=-=-=-=-= | [DE](./DE.md) | [EN](../README.md) | [ES](./ES.md) | FR | [RU](./RU.md) | [中文](./ZH.md) | [عربي](./AR.md) | =-=-=-=-=-=-=-=-=

## INSTALLATION

### Boutiques

Les versions destinées aux boutiques ne sont pas encore publiées.

### Mode développement

Chargez l'intégralité du répertoire [`extension`](../extension) comme extension non empaquetée.

## DESCRIPTION

Click Repeater enregistre les clics et les saisies au clavier effectués sur une page web et les répète ultérieurement.

Créez une séquence d'actions une fois, configurez son exécution et lancez-la depuis la fenêtre de l'extension ou avec un raccourci clavier. Les clics peuvent utiliser des coordonnées enregistrées ou des éléments de la page.

## FONCTIONNALITÉS PRINCIPALES

- Enregistrer des séquences de clics sur des pages web
- Enregistrer et répéter les saisies au clavier
- Exécuter en mode Position ou Élément
- Exécution visible ou invisible
- Répéter jusqu'à 999 fois
- Quatre vitesses d'exécution
- Définir une option par défaut et la lancer avec un raccourci
- Modifier, supprimer et réorganiser les clics enregistrés
- Thèmes clair et sombre

## CONFIDENTIALITÉ

- Aucune collecte de données
- Aucun suivi
- Aucune requête réseau
- Les clics et les paramètres sont enregistrés localement dans le navigateur

## LANGUES DE L'INTERFACE

- Anglais
- Russe
- Espagnol
- Français
- Allemand
- Chinois simplifié
- Arabe

## UTILISATION

### Enregistrer des clics

1. Ouvrez la fenêtre de l'extension
2. Lancez l'enregistrement
3. Cliquez sur les points ou les éléments nécessaires de la page
4. Cliquez à nouveau sur l'icône de l'extension
5. Nommez et configurez les clics, puis enregistrez-les

### Exécuter les clics

1. Ouvrez la fenêtre de l'extension
2. Lancez les clics souhaités
3. L'extension répète les clics enregistrés et indique le résultat

Un clic de l'utilisateur ou `Esc` arrête l'exécution. L'option par défaut peut également être lancée avec `Ctrl+Shift+X` → `M` ou, sur Mac, `Cmd+Shift+X` → `M`.

Consultez [tous les parcours utilisateur](../SPEC/user-path.md) pour plus de détails.

## LIMITATIONS

- Les extensions ne fonctionnent pas sur les pages système du navigateur ni sur les sites web protégés
- Le mode Élément nécessite que les éléments enregistrés soient toujours présents sur la page
- Le mode Position nécessite que le contenu concerné reste aux coordonnées enregistrées
- Les modifications d'un site web peuvent empêcher l'exécution complète d'anciens clics enregistrés
- Le mouvement simulé du pointeur ne peut pas garantir le CSS `:hover` natif ; les contrôles qui n'apparaissent qu'au survol réel du curseur peuvent ne pas s'activer
- La lecture de Delete / Backspace ne fonctionne pas dans Google Docs
- La saisie au clavier dans les cellules Google Sheets ne fonctionne pas
- Les clics simulés peuvent être détectés par les sites web même en mode Stealth — les événements générés par le navigateur ne portent pas l'indicateur `isTrusted: true` propre aux interactions utilisateur réelles ; les sites qui vérifient `event.isTrusted` détecteront l'automatisation quelle que soit la méthode utilisée pour déclencher le clic

## LICENCE

[Licence MIT](../LICENSE)
