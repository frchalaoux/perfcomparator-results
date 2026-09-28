# PerfComparator Community Reports

Catalogue statique de rapports publics produits par PerfComparator. Les
rapports sont communautaires et **non certifiés** : leur conformité au format
ne prouve ni la machine déclarée ni les performances mesurées.

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

Le dépôt local ne contient encore aucun workflow GitHub : celui-ci sera ajouté
seulement quand une révision publiquement installable de PerfComparator offrira
le validateur, afin de ne pas référencer une branche ou un commit inexistant.

## Prévisualiser le site

Le site est statique et charge directement `catalog/index.json`. Depuis la
racine du dépôt :

```bash
python -m http.server 8000
```

Ouvrir ensuite `http://localhost:8000/site/`. Aucun framework, service externe,
compte ou télémétrie n'est utilisé.

La logique de recherche se vérifie avec les tests natifs de Node :

```bash
node --test tests/test_catalog_ui.mjs
```
