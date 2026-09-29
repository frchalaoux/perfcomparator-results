# Architecture du catalogue

Le catalogue est volontairement statique. Git conserve les rapports publics,
les scripts génèrent un index déterministe et GitHub Pages sert l'artefact final.
Il n'existe ni base SQLite versionnée, ni base distante, ni API applicative.

## Flux des données

```text
rapport public JSON
        │
        ▼
pull request ── validation sans secret
        │
        ▼
branche main (source de vérité : reports/)
        │
        ▼
build_site.py ── index généré + fichiers statiques
        │
        ▼
artefact _site ── GitHub Pages
```

Une contribution contenant exactement un nouveau rapport peut suivre le chemin
automatique complet. Une suppression, une modification de code ou une PR
contenant plusieurs fichiers exige une revue et une fusion humaines.

## Arborescence

```text
.github/workflows/   validation, auto-fusion et déploiement
docs/                documentation du catalogue
reports/             rapports publics, classés par protocole
scripts/             validation, génération et auto-fusion
site/                HTML, CSS et JavaScript sources
tests/               tests Python et JavaScript
_site/               artefact local généré, jamais versionné
```

Le chemin d'un rapport suit ce contrat :

```text
reports/protocol-<protocol_version>/<report_id sans sha256:>.json
```

## Source de vérité et index

Les JSON sous `reports/` sont l'unique source de vérité. `build_catalog.py` :

1. découvre les fichiers dans un ordre stable ;
2. appelle `perfcomparator validate-public` pour chacun ;
3. contrôle la taille, le protocole, le dossier et le nom ;
4. refuse les identifiants dupliqués ;
5. construit en mémoire les entrées utiles à l'interface.

`build_site.py` sérialise ensuite cet index dans
`_site/catalog/index.json`, copie les rapports et ajoute les ressources du site.
L'index n'est pas versionné : il ne peut donc pas devenir incohérent avec les
rapports à cause d'un commit oublié.

Le format d'index courant expose :

```json
{
  "format": "perfcomparator-community-catalog",
  "format_version": 1,
  "report_count": 0,
  "reports": []
}
```

Chaque entrée contient le chemin du rapport, ses versions, son profil, le
nombre de résultats et les informations matérielles nécessaires à la recherche.
Les résultats détaillés restent uniquement dans le JSON téléchargeable.

## Interface web

Le site utilise du HTML, du CSS et des modules JavaScript natifs. `app.mjs`
charge l'index avec `cache: "no-store"`, construit les filtres et crée les
fiches. `catalog.mjs` porte les fonctions pures de recherche, de tri et de
présentation testées avec le test runner natif de Node.js.

Cette architecture peut être servie par n'importe quel hébergement de fichiers
statiques. Aucun traitement n'est exécuté côté serveur après le déploiement.

## Workflows et frontières de confiance

### Validation des pull requests

`validate-reports.yml` s'exécute avec `contents: read`, sans secret. Il installe
le validateur depuis une révision exacte, contrôle Python et JavaScript, valide
les rapports puis construit le site. Le code proposé par un fork ne reçoit donc
aucun jeton d'écriture.

### Auto-fusion des ajouts simples

`auto-merge-reports.yml` s'exécute après une validation réussie et charge son
script depuis le `main` de confiance. Avant de fusionner, `auto_merge.py`
revérifie par l'API GitHub :

- que la PR est ouverte, non brouillon et cible `main` ;
- que son SHA correspond exactement au commit validé ;
- qu'elle ajoute exactement un fichier ;
- que ce fichier respecte le chemin d'un rapport public.

Après fusion, il déclenche explicitement le déploiement Pages. Toute autre PR
est laissée à une revue humaine.

### Déploiement

`deploy-pages.yml` revalide l'état complet de `main`, reconstruit `_site`,
téléverse l'artefact puis accorde `pages: write` et `id-token: write` uniquement
au job de déploiement. Les actions tierces sont épinglées par SHA.

## Propriétés recherchées

- **Déterminisme** : mêmes rapports, même index sérialisé.
- **Simplicité** : aucun état dérivé suivi dans Git.
- **Auditabilité** : chaque ajout ou retrait passe par une pull request.
- **Moindre privilège** : validation non privilégiée, écriture séparée.
- **Portabilité** : artefact statique autonome et rapports JSON téléchargeables.
