# Guide de maintenance

Ce guide s'adresse aux personnes qui développent le site, examinent les
contributions ou administrent le catalogue.

## Préparer l'environnement local

Prérequis : Git, `uv`, `jq`, Node.js avec son test runner natif et PerfComparator.
Le projet demande Python 3.14 ; `uv` installe la version compatible déclarée.

```bash
git clone https://github.com/frchalaoux/perfcomparator-results.git
cd perfcomparator-results
uv sync --locked --dev
uv tool install --force \
  "git+https://github.com/frchalaoux/perfcomparator@v0.4.0.dev6"
```

Vérifier les outils réellement utilisés :

```bash
uv --version
uv run python --version
node --version
perfcomparator --version
```

Les workflows GitHub n'installent pas le validateur depuis un nom mouvant : ils
emploient un SHA exact visible dans `validate-reports.yml` et
`deploy-pages.yml`.

## Exécuter les contrôles

Le contrôle local complet est :

```bash
uv run ruff format --check
uv run ruff check
uv run pytest -q
node --check site/catalog.mjs
node --check site/app.mjs
node --test tests/test_catalog_ui.mjs
uv run python scripts/build_catalog.py validate
```

`build_catalog.py validate` affiche le nombre de rapports valides. Zéro est un
état valide lorsque le catalogue est vide.

## Construire et prévisualiser le site

Pour développer avec reconstruction automatique et sans cache navigateur :

```bash
uv run python scripts/serve_site.py
```

Ouvrir `http://localhost:8000/` et conserver la commande active. Toute
modification sous `site/` ou `reports/` déclenche une nouvelle construction.
Une construction invalide est signalée dans le terminal sans remplacer le
dernier aperçu valide. Arrêter le serveur avec `Ctrl+C`.

Dans cette version locale uniquement, chaque fiche propose **Supprimer**. Après
confirmation, le serveur retire le JSON correspondant sous `reports/` et
l'observateur reconstruit l'index. Vérifier ensuite `git status` : la suppression
reste une modification locale ordinaire et ne devient distante qu'après le
parcours de revue et de publication. Pour annuler immédiatement la suppression
d'un fichier suivi :

```bash
git restore reports/protocol-VERSION/IDENTIFIANT.json
```

Ne jamais utiliser cette interface pour contourner la revue obligatoire d'un
retrait public.

### Ajouter un rapport à l'aperçu local

Le fichier doit être un export public PerfComparator, jamais le rapport privé
produit directement par `perfcomparator run`. Le valider avant de le copier :

```bash
perfcomparator validate-public /chemin/vers/rapport-public.json
```

Extraire son protocole et son identifiant, puis construire le chemin imposé par
le catalogue :

```bash
report_file=/chemin/vers/rapport-public.json
protocol=$(jq -r '.protocol_version' "$report_file")
digest=$(jq -r '.report_id | sub("^sha256:"; "")' "$report_file")

mkdir -p "reports/protocol-$protocol"
cp "$report_file" "reports/protocol-$protocol/$digest.json"
```

Avec `serve_site.py` actif, le terminal doit ensuite afficher :

```text
Changement détecté, reconstruction…
Aperçu reconstruit. Rechargez la page si nécessaire.
```

Contrôler enfin que seul le rapport public attendu apparaît dans l'état Git :

```bash
git status --short
```

Cet ajout reste strictement local. Il ne crée ni branche distante, ni pull
request, ni publication GitHub Pages. La publication suit séparément le guide
de contribution et exige les validations et autorisations prévues par le dépôt.

Pour produire ponctuellement un artefact immuable, choisir un dossier de sortie
qui n'existe pas encore :

```bash
uv run python scripts/build_site.py --output _site-preview
python -m http.server 8000 --directory _site-preview
```

Ouvrir `http://localhost:8000/`. Il faut un serveur HTTP : ouvrir directement
`index.html` avec une URL `file://` empêche généralement le chargement des
modules et de l'index.

Après inspection, supprimer uniquement le dossier généré choisi. `build_site.py`
refuse volontairement d'écraser une destination existante afin qu'un ancien
fichier ne reste pas silencieusement dans un nouvel artefact.

## Ajouter un rapport

Le parcours normal appartient au participant et est décrit dans le
[guide de contribution](../CONTRIBUTING.md). Pour la revue, vérifier :

1. exactement un JSON ajouté sous `reports/protocol-<version>/` ;
2. aucun index, rapport privé ou fichier annexe ;
3. le contrôle `validate` réussi sur le SHA courant ;
4. les données publiques plausibles, sans prétendre les certifier.

Une contribution conforme est fusionnée automatiquement. Si le SHA de la PR
change après validation, l'auto-fusion la refuse jusqu'au nouveau contrôle.

## Retirer un ou plusieurs rapports

Créer une branche depuis le `main` à jour, supprimer uniquement les JSON
concernés et conserver les éventuels `.gitkeep` :

```bash
git fetch origin main
git switch -c remove/reports origin/main
git rm reports/protocol-0.3.0/IDENTIFIANT.json
uv run python scripts/build_catalog.py validate
uv run python scripts/build_site.py --output _site-without-reports
```

Ouvrir ensuite une pull request documentant les identifiants et le motif. Les
retraits ne sont jamais auto-fusionnés : cette protection empêche un tiers de
supprimer le rapport d'un autre. Un mainteneur examine et fusionne manuellement
la PR, puis vérifie le déploiement Pages.

Le workflow d'auto-fusion peut actuellement apparaître en échec sur une PR de
retrait parce qu'elle ne contient pas exactement un rapport ajouté. Cet échec
confirme le garde-fou ; le contrôle `validate` reste le contrôle de conformité
à examiner.

Après déploiement, vérifier :

- que `catalog/index.json` présente le bon `report_count` ;
- que les anciennes URLs des JSON renvoient `404` ;
- que l'interface montre l'état vide ou les rapports restants.

La suppression courante ne purge pas automatiquement l'historique Git. Lire
[Données et confidentialité](donnees-et-confidentialite.md#retrait-et-limites-de-leffacement)
avant de traiter une publication sensible.

## Mettre à jour le validateur

Une mise à jour de PerfComparator doit être coordonnée :

1. choisir un commit source publié et testé ;
2. remplacer le SHA dans `validate-reports.yml` et `deploy-pages.yml` ;
3. exécuter les contrôles sur tous les rapports existants ;
4. construire le site réel ;
5. vérifier que les deux workflows utilisent exactement le même SHA ;
6. intégrer la modification avant d'accepter des rapports nécessitant le
   nouveau format.

Épingler un tag dans la documentation est pratique pour les humains ; épingler
le commit immuable dans l'automatisation protège la reproductibilité.

## Relancer un déploiement

Un mainteneur peut utiliser l'onglet **Actions**, ouvrir **Deploy GitHub Pages**
puis choisir **Run workflow** sur `main`. Avec GitHub CLI :

```bash
gh workflow run deploy-pages.yml --ref main
gh run list --workflow deploy-pages.yml --limit 3
```

Une relance ne modifie pas les rapports : elle revalide `main`, reconstruit
l'artefact et le republie.

## Nettoyer les branches

La fusion d'une PR ne supprime pas toujours sa branche. Avant toute suppression
distante, vérifier que la PR correspondante est fusionnée ou fermée et résoudre
le SHA exact. Supprimer une branche ne supprime ni la PR ni les commits déjà
intégrés à `main`.
