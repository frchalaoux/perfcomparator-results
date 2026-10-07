# Guide développeur

Ce guide présente le code du catalogue, son environnement de développement et
la manière de modifier chaque composant sans rompre la validation, la sécurité
des contributions ni le déploiement statique.

Pour l'exploitation courante, les retraits et les déploiements, consulter le
[guide de maintenance](maintenance.md). Pour les choix structurants, consulter
l'[architecture](architecture.md).

## Périmètre des deux dépôts

Le travail est réparti entre deux projets :

- [`perfcomparator`](https://github.com/frchalaoux/perfcomparator) produit,
  valide et compare les rapports ;
- [`perfcomparator-results`](https://github.com/frchalaoux/perfcomparator-results)
  stocke les exports publics, construit leur index et sert le catalogue web.

Le catalogue ne doit pas réimplémenter le contrat complet du rapport public.
Il délègue sa validation à `perfcomparator validate-public`, puis extrait
seulement les champs nécessaires à l'interface. Toute évolution du format
public commence donc dans PerfComparator et se termine par une mise à jour
coordonnée du validateur épinglé dans ce dépôt.

## Installer l'environnement

Prérequis : Git, `uv`, Node.js avec son test runner natif et une version publiée
de PerfComparator compatible avec le validateur attendu.

```bash
git clone https://github.com/frchalaoux/perfcomparator-results.git
cd perfcomparator-results
uv sync --locked --dev
uv tool install --force \
  "git+https://github.com/frchalaoux/perfcomparator@v0.4.0.dev6"
```

Le projet déclare Python `>=3.14,<3.15`. Les dépendances de développement sont
verrouillées dans `uv.lock`. Le site lui-même n'a aucune dépendance JavaScript à
installer : il utilise les API natives du navigateur et de Node.js.

Contrôler l'environnement :

```bash
uv run python --version
uv run ruff --version
uv run pytest --version
node --version
perfcomparator --version
```

## Carte du code

| Fichier | Responsabilité principale |
| --- | --- |
| `scripts/build_catalog.py` | Découvrir et valider les rapports, construire l'index en mémoire |
| `scripts/build_site.py` | Assembler l'artefact statique `_site` |
| `scripts/serve_site.py` | Reconstruire automatiquement et servir l'aperçu local sans cache |
| `scripts/auto_merge.py` | Revérifier et fusionner un ajout de rapport strictement borné |
| `site/index.html` | Structure accessible de l'interface |
| `site/styles.css` | Présentation et adaptation aux tailles d'écran |
| `site/catalog.mjs` | Fonctions pures de recherche, statistiques et formatage |
| `site/app.mjs` | Chargement de l'index et rendu du DOM |
| `site/comparison.mjs` | Comparaison des rapports publics et génération du HTML autonome |
| `site/zip.mjs` | Création locale des archives de rapports sélectionnés |
| `tests/test_catalog.py` | Validation, indexation et assemblage Python |
| `tests/test_auto_merge.py` | Garde-fous de l'automatisation privilégiée |
| `tests/test_catalog_ui.mjs` | Comportement des fonctions de l'interface |

Les fichiers sous `reports/` sont des données, pas des fixtures de test. Les
tests qui ont besoin d'un rapport temporaire doivent le créer sous `tmp_path` et
simuler le validateur lorsque le contrat public n'est pas l'objet du test.

## Comprendre la construction

### Validation et indexation

`report_paths()` retourne les JSON dans un ordre stable. `load_entry()` vérifie
la taille, appelle le validateur externe, lit le contenu puis contrôle le
protocole, le dossier et le nom. `build_index()` refuse les identifiants
dupliqués et trie les entrées avant sérialisation.

Préserver ces propriétés lors d'une modification :

- aucune dépendance à l'ordre du système de fichiers ;
- aucune donnée dérivée suivie dans Git ;
- aucune tolérance implicite d'un protocole inconnu ;
- aucune exposition d'un champ privé dans l'index ;
- messages d'erreur exploitables par un participant.

### Assemblage du site

`build_site()` valide d'abord les rapports, puis crée une destination neuve. Il
copie les ressources statiques, écrit l'index généré, copie les JSON publics et
ajoute `.nojekyll`.

La fonction refuse une destination existante. Ce choix évite qu'un fichier
retiré des sources survive dans un artefact réutilisé.

`serve_site.py` conserve cette règle : chaque reconstruction est réalisée dans
un répertoire temporaire. La destination servie est remplacée seulement après
une construction complète. En cas d'échec, le message apparaît dans le terminal
et l'ancien aperçu reste accessible. L'observateur suit les créations,
modifications et suppressions sous `site/` et `reports/` ; une modification des
scripts Python eux-mêmes demande de relancer la commande.

### Administration locale

`LocalSiteHandler` annonce la suppression locale à l'interface via
`/__local/capabilities`. `app.mjs` n'affiche donc **Supprimer** que lorsque le
site est servi par `serve_site.py`; GitHub Pages répond normalement 404 et reste
strictement en lecture seule.

La route `POST /__local/reports/delete` accepte uniquement un objet JSON
contenant un `report_id` complet. Le serveur résout lui-même le fichier sous
`reports/protocol-*`, refuse les liens symboliques, les chemins fournis par le
client, les requêtes non locales et les origines différentes. Toute évolution
de cette route doit conserver ces tests de frontière et une confirmation côté
interface.

### Interface

Conserver autant que possible la logique testable dans `catalog.mjs` et
`comparison.mjs`. Le rendu DOM et les événements appartiennent à `app.mjs`.
Les valeurs provenant des rapports sont affectées avec `textContent` ou
échappées explicitement lors de la génération du rapport HTML autonome.

Le filtre libre normalise les accents et la casse. Les filtres système et
profil utilisent une égalité exacte. Toute nouvelle information recherchable
doit être ajoutée à `reportSearchText()` et couverte par un test.

## Parcours de modification

### Modifier l'index

1. définir le champ public nécessaire et son comportement en cas d'absence ;
2. modifier `load_entry()` sans copier les résultats détaillés dans l'index ;
3. ajouter les tests Python couvrant formats courant et historique ;
4. adapter l'interface et ses tests si le champ est affiché ou recherché ;
5. construire un site réel et inspecter `catalog/index.json`.

Une évolution incompatible de l'index exige d'incrémenter `format_version` et
d'adapter simultanément le consommateur web.

### Modifier l'interface

1. conserver un HTML utilisable au clavier et des libellés explicites ;
2. placer la logique pure dans `catalog.mjs` ;
3. éviter les dépendances ou appels réseau supplémentaires sans nécessité ;
4. tester l'état vide, les filtres et les valeurs facultatives ;
5. prévisualiser le résultat avec le serveur local supervisé.

```bash
uv run python scripts/serve_site.py
```

La commande reconstruit `_site` au démarrage puis après chaque changement sous
`site/` ou `reports/`. Elle désactive le cache du navigateur. L'arrêter avec
`Ctrl+C` avant de modifier `serve_site.py` ou les autres scripts de construction.

### Modifier l'auto-fusion

`auto_merge.py` manipule un jeton disposant d'un droit d'écriture. Toute
évolution doit conserver une frontière stricte entre le workflow de validation
non privilégié et le workflow privilégié chargé depuis `main`.

Tester au minimum :

- événement sans PR ou validation en échec ;
- PR fermée, brouillon ou visant une autre base ;
- SHA modifié après validation ;
- zéro, deux ou plusieurs fichiers ;
- fichier modifié ou supprimé au lieu d'être ajouté ;
- chemin ne correspondant pas à un rapport ;
- refus de fusion de l'API GitHub.

Ne jamais exécuter le code d'une branche externe avec un secret d'écriture.

### Prendre en charge un nouveau protocole public

1. publier d'abord le validateur correspondant dans PerfComparator ;
2. ajouter explicitement le protocole à `SUPPORTED_PROTOCOLS` ;
3. ajouter des tests représentatifs sans données privées ;
4. vérifier l'extraction des champs historiques et nouveaux ;
5. mettre à jour le SHA du validateur dans les deux workflows ;
6. mettre à jour la documentation de compatibilité ;
7. valider et construire l'ensemble des rapports existants.

## Contrôles avant commit

Exécuter le même ensemble que l'intégration continue :

```bash
uv run ruff format --check
uv run ruff check
uv run pytest -q
node --check site/catalog.mjs
node --check site/app.mjs
node --test tests/test_catalog_ui.mjs
uv run python scripts/build_catalog.py validate
```

Pour une modification touchant la construction ou les données, ajouter un smoke
test réel dans un dossier de sortie neuf :

```bash
uv run python scripts/build_site.py --output _site-preview
```

Inspecter au minimum le nombre de rapports, les chemins de téléchargement et
l'absence de fichier inattendu. Ne pas ajouter `_site-preview` au commit.

## Conventions de contribution

- Une PR de rapport contient exactement un nouveau JSON et rien d'autre.
- Une PR de code ou de documentation ne contient aucun rapport.
- Une suppression de rapport est isolée et fusionnée manuellement.
- Les fichiers générés, notamment l'index et `_site`, ne sont pas versionnés.
- Les actions GitHub restent épinglées par SHA.
- Le validateur est épinglé sur le même commit dans les workflows de validation
  et de déploiement.
- Une modification fonctionnelle ajoute ou adapte ses tests.
- La documentation décrit l'état réellement déployé, pas une intention future.

## Déboguer efficacement

Commencer par la couche la plus proche de l'erreur :

| Symptôme | Premier contrôle |
| --- | --- |
| Rapport refusé | `perfcomparator validate-public FICHIER.json` |
| Nom ou dossier refusé | `report_id`, `protocol_version` et chemin Git |
| Index incorrect | `uv run python scripts/build_catalog.py validate` puis construction neuve |
| Filtre incorrect | `node --test tests/test_catalog_ui.mjs` |
| Auto-fusion refusée | liste des fichiers, statut `added` et SHA validé |
| Site absent | jobs `build` puis `deploy` de GitHub Pages |

Le [guide de dépannage](depannage.md) détaille les erreurs visibles par les
participants et les mainteneurs.

## Préparer une pull request

Avant l'ouverture :

1. rebaser ou recréer la branche depuis le `main` actuel ;
2. vérifier que le diff ne contient que les fichiers attendus ;
3. exécuter les contrôles proportionnés au changement ;
4. expliquer le comportement, les risques et la validation effectuée ;
5. laisser les workflows confirmer le SHA réellement proposé.

Les changements de code et de documentation sont revus et fusionnés
manuellement. Seul l'ajout isolé d'un rapport public conforme utilise
l'auto-fusion.
