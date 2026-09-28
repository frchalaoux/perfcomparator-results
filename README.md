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

## Ajouter un rapport

Créer et contrôler le fichier avec une version de PerfComparator qui fournit
les commandes publiques :

```bash
perfcomparator export-public rapport-prive.json \
  --output rapport-public.json \
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
- `deploy-pages.yml` revalide le catalogue sur `main`, assemble `_site`, puis
  demande uniquement `pages: write` et `id-token: write` dans son job de
  déploiement.

Tous deux installent le validateur depuis une révision exacte de
`frchalaoux/perfcomparator`. Ils ne deviendront exécutables qu'après publication
de cette révision et création explicite du dépôt distant.

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
