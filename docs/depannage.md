# Dépannage

## Le catalogue affiche zéro rapport

Consulter directement
`https://frchalaoux.github.io/perfcomparator-results/catalog/index.json`.
Si `report_count` vaut `0` et `reports` est vide, le catalogue est simplement
vide. Si le chargement échoue, consulter le dernier workflow **Deploy GitHub
Pages**.

## « Contribution envoyée », mais aucun rapport sur le site

Ce message confirme uniquement la création de la pull request. Vérifier dans
l'ordre :

1. que le contrôle **Validate community reports** est vert ;
2. que la PR a été fusionnée dans `main` ;
3. que **Deploy GitHub Pages** a réussi ;
4. que l'index public contient l'identifiant attendu.

Une première PR issue d'un fork peut attendre l'autorisation de démarrer ses
workflows selon la politique GitHub du dépôt.

## « Le schéma privé … ne peut pas être exporté sûrement »

Le fichier choisi est un ancien rapport privé que la version installée de
PerfComparator ne sait pas convertir sans ambiguïté. Installer la version
recommandée par le tutoriel, puis relancer `perfcomparator contribute`. Ne pas
modifier le JSON privé à la main.

## Identifiant ou nom de fichier incorrect

`perfcomparator validate-public` recalcule l'identifiant. Le fichier doit porter
les 64 caractères hexadécimaux situés après `sha256:` dans `report_id` :

```text
reports/protocol-0.3.0/<64 caractères>.json
```

Toute modification après l'export change l'identifiant. Régénérer l'export au
lieu de corriger son nom au hasard.

## Emplacement ou protocole refusé

Le dossier doit correspondre exactement à `protocol_version`. Seuls les
protocoles listés dans `SUPPORTED_PROTOCOLS` de `scripts/build_catalog.py` sont
acceptés. L'ajout d'un protocole demande une évolution revue du catalogue et du
validateur, pas seulement la création d'un dossier.

## « Le validateur est introuvable »

Vérifier :

```bash
perfcomparator --version
command -v perfcomparator
```

Puis installer la version attendue comme indiqué dans le
[guide de maintenance](maintenance.md#préparer-lenvironnement-local). Dans les
workflows, contrôler que l'étape d'installation du validateur précède la
validation et ajoute le dossier des outils `uv` au `PATH`.

## L'ancien message demande de régénérer `catalog/index.json`

Cette procédure est obsolète. L'index n'est plus versionné : une contribution
doit contenir uniquement son nouveau rapport. Retirer `catalog/index.json` du
commit et rebaser la branche sur le `main` actuel.

## L'auto-fusion exige exactement un fichier

Pour un ajout normal, la PR doit contenir exactement un rapport JSON ajouté.
Retirer toute modification de documentation, d'index ou de workflow de cette
PR et proposer ces changements séparément.

Pour une suppression ou une opération de maintenance, le refus est volontaire.
Après un contrôle `validate` réussi, la PR doit être examinée et fusionnée
manuellement par un mainteneur. Le site sera ensuite régénéré sans index à
modifier.

## La PR a été validée, puis sa tête a changé

L'auto-fusion compare le SHA validé au SHA courant pour empêcher une modification
après contrôle. Attendre la fin du nouveau workflow. Ne pas forcer la fusion
automatique avec un ancien résultat.

## `build_site.py` refuse la destination

Le script n'écrase jamais un dossier existant. Choisir un autre chemin avec
`--output` ou supprimer uniquement l'ancien artefact local après avoir vérifié
qu'il ne contient rien à conserver.

## Le site local ne charge pas l'index

Ne pas ouvrir `site/index.html` directement. Utiliser le serveur local supervisé :

```bash
uv run python scripts/serve_site.py
```

Ouvrir ensuite `http://localhost:8000/` et consulter la console du navigateur si
le message persiste.

## Le serveur local n'affiche pas la dernière modification

`serve_site.py` désactive le cache et reconstruit automatiquement après une
modification sous `site/` ou `reports/`. Vérifier dans le terminal que le message
« Aperçu reconstruit » apparaît. Si la reconstruction est refusée, corriger
l'erreur signalée ; le dernier aperçu valide reste volontairement servi.

Une modification de `scripts/serve_site.py`, `build_site.py` ou
`build_catalog.py` nécessite de relancer le serveur avec `Ctrl+C`, puis la même
commande. Si le port 8000 est déjà utilisé, arrêter l'ancien serveur ou choisir
un autre port avec `--port 8001`.

## Le bouton « Supprimer » n'apparaît pas

Ce bouton est volontairement réservé à `scripts/serve_site.py`. Il n'apparaît
ni sur GitHub Pages ni avec `python -m http.server`. Arrêter l'ancien serveur,
puis lancer :

```bash
uv run python scripts/serve_site.py
```

## Restaurer un rapport supprimé localement

La suppression locale retire le JSON source et apparaît dans `git status`. Si
le fichier était suivi et que la suppression ne doit pas être conservée :

```bash
git restore reports/protocol-VERSION/IDENTIFIANT.json
```

Le serveur détecte la restauration et reconstruit automatiquement le catalogue.
Un rapport non suivi n'est pas récupérable par Git ; conserver une copie avant
de supprimer une donnée locale qui n'a jamais été commitée.

## Une ancienne URL de rapport répond encore

Confirmer d'abord que le retrait est fusionné et que le déploiement Pages est
terminé. Tester ensuite l'URL avec un paramètre de cache différent. Si le JSON
reste servi après un déploiement réussi, inspecter l'artefact du workflow et les
caches GitHub Pages.

## Une donnée sensible a été publiée

Une suppression normale retire le fichier courant du site, mais pas
nécessairement l'historique, les forks ou les copies externes. Ne pas reproduire
la donnée dans une issue publique. Retirer l'accès courant, conserver les
identifiants techniques nécessaires au diagnostic et demander immédiatement une
évaluation de purge d'historique. Voir
[Données et confidentialité](donnees-et-confidentialite.md).
