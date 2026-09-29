# Données, licence et confidentialité

Le catalogue accepte uniquement les exports publics créés par PerfComparator.
Un rapport privé produit directement par `perfcomparator run` ne doit jamais
être ajouté à ce dépôt.

## Données destinées à être publiques

Selon la version du format, un export peut notamment contenir :

- le système d'exploitation et l'architecture ;
- le processeur, le nombre de cœurs et la mémoire ;
- les GPU détectés ;
- le fabricant, le nom commercial et l'identifiant de modèle ;
- une référence commerciale ou SKU facultative ;
- le protocole, le profil et les résultats des benchmarks.

Le catalogue extrait une partie de ces informations dans son index généré afin
de permettre la recherche. Le fichier complet reste téléchargeable.

## Données exclues

Le format public interdit notamment :

- le numéro de série ;
- les UUID matériels ;
- le nom d'hôte ;
- les chemins locaux, PID et listes détaillées de processus ;
- les messages de diagnostic privés et les informations de disque non prévues
  par le contrat public.

Le validateur contrôle cette liste et recalcule l'identifiant de contenu. Il ne
faut cependant pas modifier manuellement un export pour tenter de le rendre
public : il faut toujours le régénérer depuis PerfComparator.

## Consentement et licence CC0

La contribution exige un consentement explicite. Les rapports intégrés sont
placés sous [CC0-1.0](../LICENSE-DATA.md), ce qui permet leur copie, leur
redistribution et leur réutilisation sans restriction de droit d'auteur.

Ce consentement ne rend pas les informations anonymes. Une combinaison rare de
matériel, de référence commerciale et de résultats peut être reconnaissable.
Relire systématiquement l'aperçu et le JSON avant l'envoi.

## Ce que garantit l'identifiant

Le `report_id` est dérivé du contenu public. Il permet de détecter une
modification du fichier et sert de nom au JSON. Il ne prouve pas :

- l'identité du participant ;
- la possession de la machine ;
- l'authenticité du modèle déclaré ;
- l'absence de manipulation des mesures.

## Retrait et limites de l'effacement

Supprimer le JSON de `main` puis redéployer retire le rapport du catalogue et
de ses URLs courantes. Cela ne garantit pas son effacement universel :

- le contenu a été publié sous CC0 et a pu être téléchargé ou recopié ;
- le commit et la pull request peuvent rester dans l'historique Git/GitHub ;
- des caches, forks ou archives externes peuvent conserver une copie.

Une demande de retrait ordinaire suit le
[guide de maintenance](maintenance.md#retirer-un-ou-plusieurs-rapports). Une
publication accidentelle de données sensibles est un incident différent : ne
pas recopier ces données dans une issue publique, retirer immédiatement le
fichier visible et demander au mainteneur d'évaluer une purge d'historique et,
si nécessaire, une intervention de GitHub.
