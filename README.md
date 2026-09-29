# PerfComparator Community Reports

Catalogue statique de rapports publics produits par PerfComparator. Les
rapports sont communautaires et **non certifiés** : leur conformité au format
ne prouve ni la machine déclarée ni les performances mesurées.

## Versions

Le catalogue n'a pas encore de version publiée. Consulter la page permanente
de [tous les tags](https://github.com/frchalaoux/perfcomparator-results/tags).

## Organisation

```text
reports/
└── protocol-0.3.0/
    └── <identifiant-sha256>.json
catalog/
└── index.json
scripts/
└── build_catalog.py
site/
└── index.html
```

Le rangement est fondé sur le protocole, puis sur l'identifiant de contenu. Il
n'impose pas un fabricant unique à une machine qui peut combiner CPU et GPU de
marques différentes.

Les rapports publics v2 fournissent un nom commercial confirmé par leur auteur,
le fabricant détecté et un identifiant de modèle non unique. La v3 ajoute une
référence commerciale ou SKU facultative. Ces indications restent
communautaires et non certifiées. Les numéros de série, UUID matériels et noms
d'hôte sont exclus. Pour les rapports historiques v1, l'interface affiche le
processeur à la place du nom commercial absent.

## Ajouter un rapport

Le [guide de contribution](CONTRIBUTING.md) fournit la procédure de pull
request. Le
[tutoriel de A à Z](https://github.com/frchalaoux/perfcomparator/blob/main/docs/tutoriel-catalogue.md)
couvre aussi l'installation, la mesure, la publication, le téléchargement et
la comparaison locale.

À partir de PerfComparator `0.4.0.dev2`, le parcours guidé ne demande aucune
connaissance de Git :

```bash
perfcomparator contribute
```

`perfcomparator contribute --dry-run` permet de contrôler localement l'export
et son aperçu sans se connecter à GitHub.

La commande affiche **Contribution envoyée** dès que la pull request existe.
Le rapport n'est pas encore visible à cet instant. Le dépôt enchaîne ensuite
automatiquement la validation, la fusion des contributions qui ne contiennent
que le rapport et l'index généré, puis le déploiement GitHub Pages. Une
contribution refusée reste ouverte avec son contrôle en erreur.
Pour la première contribution d'un compte externe, la politique de sécurité de
GitHub peut demander au mainteneur d'autoriser le démarrage du contrôle. Après
ce contrôle initial, la fusion et le déploiement restent automatiques.

## Télécharger et comparer

Ouvrir le [catalogue web](https://frchalaoux.github.io/perfcomparator-results/),
filtrer si nécessaire, puis cliquer sur **Télécharger le JSON** dans la fiche
choisie. Comparer ensuite ce fichier avec un rapport local compatible :

```bash
perfcomparator compare mon-rapport-local.json rapport-telecharge.json \
  --html comparaison.html
```

Le premier fichier sert de référence 100. Les rapports doivent employer le
même protocole, le même profil et la même version de Python.

Le parcours manuel reste disponible en créant et contrôlant le fichier avec une
version de PerfComparator qui fournit les commandes publiques :

```bash
perfcomparator export-public rapport-prive.json \
  --output rapport-public.json \
  --machine-name "Apple MacBook Pro 15 pouces (2018)" \
  --machine-sku "MR942FN/A" \
  --accept-cc0
perfcomparator validate-public rapport-public.json
```

Renommer ensuite le fichier avec les 64 caractères hexadécimaux de son
`report_id`, sans le préfixe `sha256:`, et le placer sous le protocole annoncé.
Les données du rapport sont diffusées sous `CC0-1.0`.

## Valider et construire l'index

```bash
python scripts/build_catalog.py validate
python scripts/build_catalog.py build
python scripts/build_catalog.py check
```

Chaque rapport est d'abord confié à `perfcomparator validate-public`. Le script
contrôle ensuite son emplacement, son nom, son unicité et produit
`catalog/index.json` dans un ordre déterministe. `check` vérifie que l'index
suivi correspond exactement aux rapports présents.

Deux workflows sont préparés avec des actions épinglées par SHA :

- `validate-reports.yml` s'exécute sur `pull_request`, sans secret et avec le
  seul droit `contents: read` ;
- `auto-merge-reports.yml` s'exécute depuis `main` après une validation réussie,
  refuse toute modification autre qu'un nouveau rapport et l'index, vérifie que
  le commit validé est toujours en tête, puis fusionne la pull request ;
- `deploy-pages.yml` revalide le catalogue sur `main`, assemble `_site`, puis
  demande uniquement `pages: write` et `id-token: write` dans son job de
  déploiement.

La fusion réalisée avec le jeton éphémère de GitHub Actions ne déclenchant pas
un second workflow par événement `push`, l'automatisation demande explicitement
le lancement de `deploy-pages.yml` par `workflow_dispatch`.

Tous deux installent le validateur depuis une révision exacte de
`frchalaoux/perfcomparator`.

## Prévisualiser le site

Le site est assemblé avec l'index et les rapports publics dans un artefact
autonome ignoré par Git. Depuis la racine du dépôt :

```bash
python scripts/build_site.py
python -m http.server 8000 --directory _site
```

Ouvrir ensuite `http://localhost:8000/`. Aucun framework, service externe,
compte ou télémétrie n'est utilisé. Supprimer `_site` avant une nouvelle
construction afin qu'un ancien fichier ne puisse pas rester dans l'artefact.

La logique de recherche se vérifie avec les tests natifs de Node :

```bash
node --test tests/test_catalog_ui.mjs
```

## Licences

Le code, les scripts, le site et la documentation sont distribués sous
[licence MIT](LICENSE). Les rapports JSON placés sous `reports/` sont diffusés
sous [CC0-1.0](LICENSE-DATA.md), conformément au consentement explicite exigé
par `perfcomparator export-public --accept-cc0`.
