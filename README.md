# PerfComparator Community Reports

Catalogue statique de rapports publics produits par
[PerfComparator](https://github.com/frchalaoux/perfcomparator). Il permet de
rechercher une configuration, de télécharger son rapport JSON puis de la
comparer localement avec d'autres machines.

Les rapports sont communautaires et **non certifiés** : leur validation prouve
la conformité du fichier et son intégrité, jamais l'identité de la machine ni
l'exactitude de ses performances.

- [Ouvrir le catalogue public](https://frchalaoux.github.io/perfcomparator-results/)
- [Lire le tutoriel complet de publication et de
  comparaison](https://github.com/frchalaoux/perfcomparator/blob/main/docs/tutoriel-catalogue.md)
- [Consulter la documentation de ce dépôt](docs/index.md)
- [Contribuer un rapport](CONTRIBUTING.md)

## Versions

Le catalogue n'a pas encore de version publiée. La page permanente de
[tous les tags](https://github.com/frchalaoux/perfcomparator-results/tags) sera
la source de référence dès la première version.

Le validateur utilisé par l'automatisation est épinglé sur une révision exacte
de PerfComparator. Cette révision est indiquée dans les workflows de validation
et de déploiement.

## Utilisation rapide

Le catalogue se consulte sans compte GitHub. Depuis une fiche de machine :

1. cliquer sur **Télécharger le JSON** ;
2. vérifier le fichier avec `perfcomparator validate-public` ;
3. le comparer à un rapport local compatible.

```bash
perfcomparator validate-public rapport-telecharge.json
perfcomparator compare mon-rapport.json rapport-telecharge.json \
  --html comparaison.html
```

Les rapports doivent employer le même protocole, le même profil et la même
version de Python. Le premier rapport est la référence 100.

## Contribution rapide

À partir de PerfComparator `0.4.0.dev2`, le parcours guidé ne demande aucune
connaissance de Git :

```bash
perfcomparator contribute
```

La commande choisit un rapport local, prépare son export public, recueille le
consentement CC0, accompagne la connexion à GitHub puis propose une pull
request. `perfcomparator contribute --dry-run` permet d'essayer tout le parcours
sans connexion ni modification distante.

Une contribution normale contient **exactement un nouveau rapport JSON**.
Après validation, elle est fusionnée automatiquement puis GitHub Pages est
redéployé. L'index du site est calculé depuis les rapports présents dans
`main` : il n'est ni stocké dans une base de données ni versionné dans Git.

Le [guide de contribution](CONTRIBUTING.md) détaille le parcours guidé, la
méthode manuelle et les critères d'acceptation.

## Documentation

| Besoin | Document |
| --- | --- |
| Télécharger, vérifier et comparer un rapport | [Guide utilisateur](docs/guide-utilisateur.md) |
| Comprendre les données publiées et l'effacement | [Données et confidentialité](docs/donnees-et-confidentialite.md) |
| Comprendre le dépôt, l'index généré et les workflows | [Architecture](docs/architecture.md) |
| Valider, prévisualiser, déployer ou retirer un rapport | [Guide de maintenance](docs/maintenance.md) |
| Diagnostiquer une contribution ou un déploiement | [Dépannage](docs/depannage.md) |
| Ajouter un rapport | [Guide de contribution](CONTRIBUTING.md) |

## Principes techniques

- Les fichiers sous `reports/` sont l'unique source de vérité du catalogue.
- Chaque rapport est un export public validé par `perfcomparator
  validate-public`.
- Son chemin dépend du protocole et son nom est son identifiant SHA-256.
- `scripts/build_site.py` génère un artefact statique autonome dans `_site/`.
- Le site n'utilise ni serveur applicatif, ni base de données, ni compte, ni
  télémétrie.
- L'ajout d'un seul rapport peut être fusionné automatiquement ; toute
  suppression ou modification demande une revue humaine.

## Développement local

```bash
uv sync --locked --dev
uv run ruff format --check
uv run ruff check
uv run pytest -q
node --test tests/test_catalog_ui.mjs
uv run python scripts/build_catalog.py validate
uv run python scripts/build_site.py --output _site-preview
```

La construction exige que le dossier de sortie n'existe pas déjà. Le
[guide de maintenance](docs/maintenance.md) décrit l'installation du validateur,
la prévisualisation HTTP et la procédure complète de publication.

## Licences

Le code, les scripts, le site et la documentation sont distribués sous
[licence MIT](LICENSE). Les rapports placés sous `reports/` sont diffusés sous
[CC0-1.0](LICENSE-DATA.md), conformément au consentement explicite exigé par
PerfComparator.
