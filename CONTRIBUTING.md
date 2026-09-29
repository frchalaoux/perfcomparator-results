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
la procédure courte pour la pull request. La
[documentation du catalogue](docs/index.md) sépare aussi les parcours
utilisateur, architecture, maintenance et dépannage.

## Parcours guidé recommandé

Avec PerfComparator `0.4.0.dev2` ou une version ultérieure, aucune commande Git
n'est nécessaire. La version publiée recommandée est `0.4.0.dev6` :

```bash
perfcomparator contribute
```

Le menu choisit un rapport récent, propose un nom commercial public et une
référence commerciale facultative à confirmer ou corriger, puis construit et
affiche l'export. Il prépare GitHub CLI dans le
dossier utilisateur et ouvre le navigateur pour connecter ou créer le compte
GitHub. Il demande une confirmation distincte avant de créer ou réutiliser le
fork, créer la branche distante et ouvrir la pull request.

Le message **Contribution envoyée** signifie que la pull request a été créée.
Le dépôt vérifie ensuite automatiquement le rapport. Si le contrôle réussit et
si la pull request contient uniquement un nouveau rapport, elle est fusionnée
automatiquement. GitHub Pages génère ensuite l'index depuis les rapports et
redéploie le site. Le rapport apparaît alors dans le
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

Utiliser de préférence PerfComparator `0.4.0.dev6` :

```bash
perfcomparator export-public rapport-prive.json \
  --output rapport-public.json \
  --machine-name "Apple MacBook Pro 15 pouces (2018)" \
  --machine-sku "MR942FN/A" \
  --accept-cc0
perfcomparator validate-public rapport-public.json
```

Adaptez le nom commercial à la machine réellement vendue. La référence
commerciale est facultative : omettez-la si elle est inconnue et n'indiquez
jamais le numéro de série. Le nom et la référence sont déclarés par le
participant et ne sont pas certifiés. Même si le numéro de série, les UUID
matériels, le nom d'hôte et les autres champs privés sont retirés, une
configuration ou une région de vente rare peut être reconnaissable.

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
uv run pytest -q
node --test tests/test_catalog_ui.mjs
```

L'index est généré seulement pendant le déploiement et ne doit pas faire partie
du commit :

```bash
git status --short
git add reports/protocol-0.3.0/IDENTIFIANT_EXACT.json
git commit -m "Add community benchmark report"
git push -u origin add/community-report
```

Ouvrez ensuite une pull request vers `frchalaoux/perfcomparator-results:main`.
Son premier workflow exécute les mêmes contrôles sans secret et avec un accès
en lecture seule au contenu. Un second workflow privilégié ne charge aucun code
de la contribution : il consulte la pull request par API, vérifie qu'elle ne
contient que l'unique rapport autorisé et que son commit n'a pas changé, puis
la fusionne et demande le déploiement Pages.

Ne réunissez pas un rapport avec une correction de code ou de documentation.
L'auto-fusion est volontairement réservée à l'ajout isolé d'un seul JSON.

## Critères de refus courants

- rapport privé ou champ non autorisé ;
- contenu modifié après l'export, donc `report_id` invalide ;
- nom différent des 64 caractères de l'identifiant ;
- dossier différent de `protocol-<protocol_version>` ;
- fichier de plus de 2 Mio.

## Demander le retrait d'un rapport

Supprimez uniquement le fichier JSON concerné et ouvrez une pull request. Les
retraits ne sont jamais fusionnés automatiquement : un mainteneur vérifie la
demande avant la fusion. Le prochain déploiement régénère l'index sans le
rapport supprimé ; aucun autre fichier n'est à modifier. Lire auparavant les
[limites de l'effacement](docs/donnees-et-confidentialite.md#retrait-et-limites-de-leffacement).

## Contribuer au code ou à la documentation

Créer une pull request distincte des rapports et décrire le comportement
modifié. Le contrôle local complet figure dans le
[guide de maintenance](docs/maintenance.md#exécuter-les-contrôles). Une telle
PR est toujours revue et fusionnée manuellement ; elle ne correspond pas au
cas très restreint de l'auto-fusion des données.

Une fois le déploiement terminé, ouvrir le
[catalogue statique](https://frchalaoux.github.io/perfcomparator-results/),
cliquer sur **Télécharger le JSON**, puis comparer localement :

```bash
perfcomparator compare mon-rapport-local.json rapport-telecharge.json \
  --html comparaison.html
```
