# Guide utilisateur du catalogue

Le catalogue public permet de trouver un rapport communautaire puis de le
comparer localement. Sa consultation et le téléchargement ne nécessitent aucun
compte GitHub.

## Rechercher une machine

Ouvrir le [catalogue web](https://frchalaoux.github.io/perfcomparator-results/).
L'interface permet :

- une recherche libre dans le fabricant, le nom commercial, l'identifiant de
  modèle, la référence commerciale, le processeur et les GPU ;
- un filtre par système d'exploitation ;
- un filtre par profil de mesure.

Chaque fiche présente les informations matérielles utiles, le nombre de
mesures et un bouton **Télécharger le JSON**. Le nom commercial et la référence
éventuelle ont été confirmés par le participant, mais ne sont pas certifiés par
le constructeur.

Si aucun rapport n'est publié, l'interface affiche normalement que le catalogue
attend ses premières contributions. Ce n'est pas une panne.

## Télécharger et vérifier

Télécharger le JSON depuis la fiche, puis le contrôler avant utilisation :

```bash
perfcomparator validate-public rapport-telecharge.json
```

Une validation réussie signifie que le schéma, les champs autorisés et
l'identifiant de contenu sont cohérents. Elle ne garantit ni l'origine du
fichier ni la véracité des performances déclarées.

## Comparer deux rapports

Le premier fichier donné à la commande devient la référence 100 :

```bash
perfcomparator compare \
  mon-rapport-local.json \
  rapport-telecharge.json \
  --html comparaison.html
```

Le rapport HTML est produit et consulté localement. Il n'est envoyé ni au
catalogue ni à un service tiers.

Deux rapports sont comparables lorsqu'ils utilisent :

- le même `protocol_version` ;
- le même profil ;
- la même version de Python ;
- des benchmarks communs.

Des versions différentes de la suite PerfComparator peuvent rester compatibles
si leur protocole de mesure est identique. La commande refuse les associations
qu'elle ne peut pas interpréter de manière sûre.

## Interpréter prudemment

Un résultat dépend notamment de la température, de l'alimentation, de la charge
en arrière-plan, du système, des pilotes et de la configuration matérielle. Le
catalogue facilite la comparaison ; il ne transforme pas une mesure
communautaire en certification indépendante.

Avant une décision d'achat, privilégier plusieurs rapports cohérents et des
conditions de mesure comparables. Une configuration rare ou modifiée peut ne
pas représenter tous les exemplaires vendus sous le même nom.

## Publier son propre rapport

La commande recommandée est :

```bash
perfcomparator contribute
```

Elle crée une proposition de contribution, pas une publication immédiate. Le
rapport apparaît seulement après la validation, la fusion dans `main` et le
déploiement GitHub Pages. Le [guide de contribution](../CONTRIBUTING.md) décrit
chaque état et la procédure manuelle de secours.

## Signaler ou retirer un rapport

Ouvrir une issue ou une pull request sur le
[dépôt du catalogue](https://github.com/frchalaoux/perfcomparator-results) en
indiquant l'identifiant public du rapport. Ne jamais y recopier un rapport privé,
un numéro de série, un UUID matériel ou une autre donnée personnelle.

Le retrait du site passe par la suppression du JSON dans une pull request revue
manuellement. Les conséquences sur l'historique Git sont détaillées dans
[Données et confidentialité](donnees-et-confidentialite.md).
