# Contribuer un rapport communautaire

Merci de partager uniquement un export public PerfComparator. Ne joignez
jamais le rapport privé produit par `perfcomparator run` : il contient des
informations de diagnostic qui ne sont pas destinées au catalogue.

Les rapports acceptés sont placés sous CC0 1.0 et restent communautaires,
non certifiés. La validation automatique contrôle leur format et leur
intégrité, pas l'identité de la machine ni l'exactitude des scores.

Le [tutoriel complet](https://github.com/frchalaoux/perfcomparator/blob/main/docs/tutoriel-catalogue.md)
commence à l'installation, mesure une machine, publie le rapport et montre
comment le comparer après téléchargement. Les étapes ci-dessous constituent
la procédure courte pour la pull request.

## Parcours guidé recommandé

Avec PerfComparator `0.4.0.dev2` ou une version ultérieure, aucune commande Git
n'est nécessaire :

```bash
perfcomparator contribute
```

Le menu choisit un rapport récent, construit et affiche l'export public,
prépare GitHub CLI dans le dossier utilisateur et ouvre le navigateur pour
connecter ou créer le compte GitHub. Il demande une confirmation distincte
avant de créer ou réutiliser le fork, créer la branche distante et ouvrir la
pull request.

Un essai sans connexion ni modification GitHub est disponible :

```bash
perfcomparator contribute --dry-run
```

## Préparer manuellement le fichier

PerfComparator `0.4.0.dev1` ou une version ultérieure est nécessaire :

```bash
perfcomparator export-public rapport-prive.json \
  --output rapport-public.json \
  --accept-cc0
perfcomparator validate-public rapport-public.json
```

Relisez le fichier. Même si les champs privés sont retirés, une configuration
matérielle rare peut être reconnaissable.

La dernière commande affiche un `report_id` préfixé par `sha256:`. Renommez le
fichier avec les 64 caractères qui suivent ce préfixe et placez-le dans le
dossier du protocole annoncé :

```text
reports/protocol-0.3.0/<64-caractères-hexadécimaux>.json
```

## Créer manuellement la pull request

Après avoir forké et cloné ce dépôt :

```bash
git switch -c add/community-report
uv sync --locked --dev
uv run python scripts/build_catalog.py validate
uv run python scripts/build_catalog.py build
uv run python scripts/build_catalog.py check
uv run pytest -q
node --test tests/test_catalog_ui.mjs
```

`build` régénère `catalog/index.json`. Le rapport et cet index doivent faire
partie du même commit :

```bash
git status --short
git add reports/protocol-0.3.0/*.json catalog/index.json
git commit -m "Add community benchmark report"
git push -u origin add/community-report
```

Ouvrez ensuite une pull request vers `frchalaoux/perfcomparator-results:main`.
Son workflow exécute les mêmes contrôles sans secret et avec un accès en
lecture seule au contenu.

## Critères de refus courants

- rapport privé ou champ non autorisé ;
- contenu modifié après l'export, donc `report_id` invalide ;
- nom différent des 64 caractères de l'identifiant ;
- dossier différent de `protocol-<protocol_version>` ;
- index non régénéré ;
- fichier de plus de 2 Mio.

Une fois fusionné, le rapport est publié sur le
[catalogue statique](https://frchalaoux.github.io/perfcomparator-results/) et
peut être téléchargé puis comparé localement avec `perfcomparator compare`.
