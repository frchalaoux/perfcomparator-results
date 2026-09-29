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

Le menu choisit un rapport récent, propose un nom commercial public à confirmer
ou corriger, puis construit et affiche l'export. Il prépare GitHub CLI dans le
dossier utilisateur et ouvre le navigateur pour connecter ou créer le compte
GitHub. Il demande une confirmation distincte avant de créer ou réutiliser le
fork, créer la branche distante et ouvrir la pull request.

Le message **Contribution envoyée** signifie que la pull request a été créée.
Le dépôt vérifie ensuite automatiquement le rapport. Si le contrôle réussit et
si la pull request contient uniquement un nouveau rapport et
`catalog/index.json`, elle est fusionnée automatiquement, puis GitHub Pages est
redéployé. Le rapport apparaît alors dans le
[catalogue web](https://frchalaoux.github.io/perfcomparator-results/). Une
validation en échec laisse la pull request ouverte afin que son erreur puisse
être corrigée.
Pour une première contribution provenant d'un fork, GitHub peut demander au
mainteneur d'autoriser le démarrage du contrôle. Une fois `validate` lancé, la
fusion et le déploiement ne demandent plus d'intervention.

Un essai sans connexion ni modification GitHub est disponible :

```bash
perfcomparator contribute --dry-run
```

## Préparer manuellement le fichier

PerfComparator `0.4.0.dev1` ou une version ultérieure est nécessaire :

```bash
perfcomparator export-public rapport-prive.json \
  --output rapport-public.json \
  --machine-name "Apple MacBook Pro 15 pouces (2018)" \
  --accept-cc0
perfcomparator validate-public rapport-public.json
```

Adaptez le nom commercial à la machine réellement vendue, puis relisez le
fichier. Ce nom est déclaré par le participant et n'est pas certifié. Même si
le numéro de série, les UUID matériels, le nom d'hôte et les autres champs
privés sont retirés, une configuration matérielle rare peut être reconnaissable.

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
Son premier workflow exécute les mêmes contrôles sans secret et avec un accès
en lecture seule au contenu. Un second workflow privilégié ne charge aucun code
de la contribution : il consulte la pull request par API, vérifie qu'elle ne
contient que les deux fichiers autorisés et que son commit n'a pas changé, puis
la fusionne et demande le déploiement Pages.

## Critères de refus courants

- rapport privé ou champ non autorisé ;
- contenu modifié après l'export, donc `report_id` invalide ;
- nom différent des 64 caractères de l'identifiant ;
- dossier différent de `protocol-<protocol_version>` ;
- index non régénéré ;
- fichier de plus de 2 Mio.

Une fois le déploiement terminé, ouvrir le
[catalogue statique](https://frchalaoux.github.io/perfcomparator-results/),
cliquer sur **Télécharger le JSON**, puis comparer localement :

```bash
perfcomparator compare mon-rapport-local.json rapport-telecharge.json \
  --html comparaison.html
```
