// French privacy policy and terms. Canadian French, plain wording.
// A person should review this translation before it is relied on.
// The operator's legal name is left in English.

import { CONTACT_EMAIL, OWNER_LEGAL_NAME } from "../legalMeta.js";

const name = OWNER_LEGAL_NAME;
const email = CONTACT_EMAIL;

export const privacyPolicyFr = {
  title: "Politique de confidentialité",
  sections: [
    {
      heading: "Qui tient ce site",
      blocks: [
        {
          type: "p",
          text: `Sign With Clarity est un site à signwithclarity.ca. Il explique des documents d'assurance en langage clair pour les personnes au Canada et aux États-Unis. Trois explications par mois sont gratuites. Les forfaits payants sont décrits dans les conditions d'utilisation. Il est tenu par ${name}.`,
        },
        {
          type: "p",
          text: "Cette politique décrit ce que le code du site fait avec les renseignements. Elle est écrite pour les personnes au Canada, selon la Loi sur la protection des renseignements personnels et les documents électroniques (PIPEDA, aussi appelée LPRPDE) et la Personal Information Protection Act (PIPA) de la Colombie-Britannique. Elle décrit aussi, en termes généraux, les mêmes pratiques pour les personnes aux États-Unis.",
        },
        {
          type: "p",
          text: "Au Canada, la PIPEDA vise les renseignements personnels qu'une organisation recueille dans le cadre d'une activité commerciale, sauf si la loi d'une province s'applique à la place. En Colombie-Britannique, cette loi est la PIPA. Cette politique est écrite pour qu'une personne, dans n'importe quelle province, voie ce que le site fait, et pour respecter les devoirs généraux des deux lois : dire ce qui est recueilli et pourquoi, l'utiliser seulement pour cette fin, en prendre soin, dire quand ces renseignements peuvent quitter le Canada, et vous permettre de poser des questions.",
        },
      ],
    },
    {
      heading: "Ce que vous pouvez envoyer",
      blocks: [
        {
          type: "p",
          text: "Vous pouvez coller du texte, ou choisir un fichier .txt ou .pdf. Un document peut contenir des renseignements personnels, comme un nom, une adresse, un numéro de police ou des détails sur une réclamation. Le texte qui se trouve sur la page est celui que le site utilise.",
        },
        {
          type: "p",
          text: "Si vous choisissez un PDF, votre navigateur le lit sur votre appareil avec pdf.js. Le site utilise les mots qu'il trouve. Il n'envoie pas le fichier PDF lui-même. Si le PDF n'a pas de couche de texte, la page vous demande de coller le texte, et rien de ce fichier n'est envoyé.",
        },
        {
          type: "p",
          text: "Vous choisissez aussi un pays, le Canada ou les États-Unis, et une province, un territoire ou un État. Vous pouvez choisir la langue de la page et de l'explication : anglais, français ou espagnol. La page envoie le pays, la province, le territoire ou l'État, et cette langue avec le texte du document.",
        },
        {
          type: "p",
          text: "Le nom d'un fichier que vous choisissez s'affiche sur la page. Le nom du fichier reste dans le navigateur. Il n'est pas inclus dans la demande d'explication.",
        },
        {
          type: "p",
          text: "Vous n'avez pas besoin d'un compte. La connexion est facultative, et vous pouvez demander une explication sans compte. Si vous choisissez de vous connecter, le site demande une adresse courriel et vous envoie un lien. Il n'y a pas de mot de passe. Le site ne demande pas votre nom ni votre numéro de téléphone. Les numéros de carte sont saisis sur la page de Stripe, pas sur ce site. L'indicateur payé reste faux jusqu'à ce que le serveur le change après une confirmation de paiement de Stripe.",
        },
      ],
    },
    {
      heading: "Comment une explication est écrite",
      blocks: [
        {
          type: "p",
          text: "Le texte que vous collez ou que le site extrait reste dans la mémoire du navigateur pendant que la page est ouverte.",
        },
        {
          type: "p",
          text: "Quand vous choisissez Expliquer mon document, le navigateur envoie une demande à la fonction Netlify de ce site, à /.netlify/functions/decode. La demande comprend le texte du document, le pays que vous avez choisi, la province, le territoire ou l'État que vous avez choisi, la langue que vous avez choisie, et un identifiant aléatoire pour cette explication. La page crée cet identifiant au moment de la demande. Ce n'est pas votre nom, et il ne vient pas du document. Chaque partie d'un document plus long utilise le même identifiant, pour que les parties comptent comme une seule explication.",
        },
        {
          type: "p",
          text: "Si vous êtes connecté, le navigateur envoie aussi le jeton de connexion avec cette demande. La fonction vérifie le jeton auprès de Supabase avant de décider quel compte du mois utiliser. Le jeton n'est pas envoyé à Anthropic. Un nom, une adresse courriel ou un identifiant de compte ajouté à la demande du document est ignoré. La fonction utilise seulement l'identifiant de compte que Supabase confirme.",
        },
        {
          type: "p",
          text: "Un court document est envoyé une seule fois. Un document plus long est séparé en parties, avec un petit chevauchement pour qu'une phrase à la jonction soit incluse avec les deux parties voisines. Chaque partie est envoyée seule. La fonction renvoie des notes sur cette partie. Votre navigateur peut renvoyer ces notes pour qu'elles soient combinées, puis envoyer les notes combinées une fois de plus pour que l'explication soit écrite. Les notes portent sur le document que vous avez envoyé.",
        },
        {
          type: "p",
          text: "La fonction transmet ce texte, avec votre pays, votre province ou votre État, et la langue que vous avez choisie, à l'API d'Anthropic à https://api.anthropic.com/v1/messages. Le modèle nommé dans le code du serveur est claude-sonnet-4-6. La demande comprend aussi des instructions qui disent au modèle comment expliquer un document d'assurance dans cette langue. Anthropic renvoie l'explication. La fonction renvoie cette réponse à votre navigateur, et la page l'affiche.",
        },
        {
          type: "p",
          text: "La clé qui appelle Anthropic est gardée dans un réglage du serveur nommé ANTHROPIC_API_KEY. Elle n'est pas incluse dans la page que votre navigateur charge.",
        },
      ],
    },
    {
      heading: "Ce que nous conservons",
      blocks: [
        {
          type: "p",
          text: "La fonction ne sauvegarde pas votre document, les notes, votre lieu ni l'explication dans une base de données ou un fichier. Se connecter ne change pas cela. Le compte ne contient pas le document.",
        },
        {
          type: "p",
          text: "La page garde le texte et l'explication en mémoire pendant que vous l'utilisez. Si vous choisissez Expliquer un autre document, la page efface le texte et le nom du fichier. Fermer la page les efface aussi. Le choix de langue peut rester dans localStorage sur cet appareil, sous le nom swc-lang. Si vous vous connectez, la session de connexion peut rester dans localStorage sur cet appareil, sous des noms qui commencent par swc-auth. Cette session contient les jetons qui vous gardent connecté, et un code de courte durée pour terminer le lien reçu par courriel. Elle ne contient pas le document.",
        },
        {
          type: "p",
          text: "Les documents ne sont pas conservés.",
        },
        {
          type: "p",
          text: "Pour compter les trois explications gratuites de chaque mois civil, la fonction lit l'adresse IP de la connexion et la transforme en un hachage salé. Un hachage salé est un code brouillé. Il est fait à partir de l'adresse IP, mélangée avec une valeur ajoutée appelée sel, pour que l'adresse ne soit pas conservée telle quelle. Nous conservons le code brouillé, pas l'adresse. Le même dossier conserve le mois civil, le nombre d'explications commencées ce mois-ci, un identifiant aléatoire pour chacune de ces explications, et le nombre de fois que le service a été appelé pour cette explication. Nous ne conservons pas le document, les notes, le nom du fichier, le lieu choisi ni l'explication dans ce dossier. Le hachage et le compte ne sont pas envoyés à Anthropic. Les personnes qui ne sont pas connectées, et qui utilisent la même connexion Internet, partagent les trois explications gratuites, parce que le hachage représente la connexion, pas un nom. Cette limite n'est pas gardée dans le navigateur. Le site ne dépose pas de témoin (cookie) pour elle, et il ne la met pas dans localStorage. Vider le navigateur ne remet pas le compte à zéro.",
        },
        {
          type: "p",
          text: "Si vous êtes connecté, ces trois explications gratuites sont comptées sur le compte, et non sur la connexion. La fonction vérifie le jeton de connexion auprès de Supabase et lit l'identifiant de compte que Supabase confirme. Elle conserve un hachage salé de cet identifiant, le mois civil, le nombre d'explications commencées, l'identifiant aléatoire de chaque explication, et le nombre de fois que le service a été appelé. Elle ne conserve pas l'adresse courriel dans ce dossier. Elle n'y conserve pas le document, les notes, le nom du fichier, le lieu choisi ni l'explication. Le même compte a droit à trois explications, même depuis une autre connexion. Une autre personne connectée sur la même connexion a ses propres trois. Vider le navigateur ne remet pas ce compte à zéro.",
        },
        {
          type: "p",
          text: "Quand vous vous connectez, Supabase conserve le compte à https://ldhkqqhlztsaljccazti.supabase.co. Le compte contient votre adresse courriel, l'identifiant de compte que Supabase attribue, et les moments que Supabase note pour ce compte. Supabase envoie le courriel de connexion. Le site ne conserve pas de mot de passe, parce qu'il n'y en a pas. Ce compte ne contient pas votre document, les notes ni l'explication.",
        },
        {
          type: "p",
          text: "Nous gardons aussi une ligne dans une table Supabase nommée accounts. La ligne contient l'identifiant de compte, l'adresse courriel, un indicateur payé, le nom du forfait (household, yearly, ou aucun), le nombre de Household Checks restants, le nombre d'explications individuelles restantes d'un Household Check plus ancien, le nombre d'explications Clarity Yearly déjà utilisées dans l'année en cours, la fin de cette année, l'identifiant client Stripe, l'identifiant d'abonnement Stripe, les identifiants aléatoires des explications déjà comptées sur un forfait payant, et les moments où la ligne a été créée et mise à jour. L'indicateur payé reste faux jusqu'à ce que le serveur le change après une confirmation de paiement de Stripe. La ligne ne contient pas votre document, les notes, le numéro de carte ni l'explication. La sécurité au niveau des lignes (row level security) est activée : une session dans le navigateur ne peut pas changer l'indicateur payé ni le forfait, et elle ne peut pas lire la ligne de quelqu'un d'autre. La section des forfaits lit votre propre ligne pour montrer ce qu'il vous reste. La clé secrète qui peut gérer la table reste sur le serveur, dans un réglage nommé SUPABASE_SECRET_KEY. Elle n'est pas incluse dans la page que votre navigateur charge. Un nouveau compte reçoit une ligne quand cette table est en place. Si vous vous êtes connecté avant que la table existe, la ligne est ajoutée au moment où la table est mise en place.",
        },
      ],
    },
    {
      heading: "Ce que le serveur note",
      blocks: [
        {
          type: "p",
          text: "Si Anthropic renvoie une erreur, la fonction écrit le code d'état HTTP d'Anthropic dans le journal du serveur. Elle n'écrit pas votre document, et elle n'écrit pas la réponse d'Anthropic, dans cette ligne.",
        },
        {
          type: "p",
          text: "Si la fonction échoue d'une façon imprévue, elle écrit cette erreur dans le journal du serveur. Le code n'ajoute pas votre document, vos notes ni votre lieu à ce message.",
        },
        {
          type: "p",
          text: "La fonction lit l'adresse IP seulement pour faire le hachage salé décrit plus haut. Elle n'écrit pas l'adresse IP dans le dossier d'utilisation. Elle n'écrit pas l'adresse IP dans le journal du serveur. Elle n'écrit pas le jeton de connexion ni l'adresse courriel dans le journal du serveur.",
        },
        {
          type: "p",
          text: "Si un avis de paiement de Stripe ne peut pas être enregistré, la fonction écrit l'identifiant de l'événement et le type d'événement dans le journal du serveur. Elle n'écrit pas le numéro de carte. Elle n'écrit pas le document.",
        },
      ],
    },
    {
      heading: "Les autres services que la page contacte",
      blocks: [
        {
          type: "p",
          text: "La page charge deux polices de caractères, Cormorant Garamond et DM Sans, à partir de Google Fonts, à fonts.googleapis.com. Votre navigateur contacte Google pour les télécharger. Cette demande ne comprend pas votre document.",
        },
        {
          type: "p",
          text: "La page charge pdf.js, et le script de travail dont il a besoin, à partir de cdnjs.cloudflare.com, un service de Cloudflare. Votre navigateur contacte Cloudflare pour télécharger ces fichiers. Cette demande ne comprend pas votre document. Un PDF est lu sur votre appareil une fois la bibliothèque chargée.",
        },
        {
          type: "p",
          text: "Le site et la fonction qui écrit l'explication sont hébergés par Netlify. La demande d'explication va chez Netlify parce que c'est là que la fonction à /.netlify/functions/decode s'exécute. Le code de la fonction ne sauvegarde pas le corps de la demande. Il sauvegarde le dossier d'utilisation dans Netlify Blobs, un espace de stockage inclus avec l'hébergement Netlify de ce site. Ce dossier contient le hachage salé et les comptes décrits plus haut, pas le document.",
        },
        {
          type: "p",
          text: "Si vous vous connectez, le navigateur contacte Supabase à https://ldhkqqhlztsaljccazti.supabase.co pour envoyer l'adresse courriel et pour recevoir la session de connexion. Cette demande ne comprend pas votre document. La fonction contacte aussi cette adresse, avec la clé secrète nommée SUPABASE_SECRET_KEY, pour vérifier que la session est réelle. Cette vérification envoie le jeton de connexion. Elle n'envoie pas le document, les notes ni l'explication.",
        },
        {
          type: "p",
          text: "Si vous achetez un forfait, le navigateur envoie le nom du forfait, la devise et le jeton de connexion à la fonction de ce site, à /.netlify/functions/checkout. La fonction vérifie le jeton, puis demande à Stripe d'ouvrir Checkout avec Managed Payments. Stripe est le vendeur et calcule la taxe. La fonction envoie à Stripe votre identifiant de compte, le prix et, si Checkout ne vous connaît pas déjà, votre adresse courriel. Elle n'envoie pas le document. Le numéro de carte est saisi sur la page de Stripe. Stripe avise notre fonction à /.netlify/functions/stripe-webhook quand un paiement réussit, quand un forfait annuel se renouvelle, et quand un forfait annuel se termine. Cet avis est vérifié avec un réglage du serveur nommé STRIPE_WEBHOOK_SECRET. La clé secrète Stripe est un réglage du serveur nommé STRIPE_SECRET_KEY. Ni l'une ni l'autre n'est incluse dans la page que votre navigateur charge. Une personne avec le forfait annuel peut ouvrir le portail client de Stripe à partir de /.netlify/functions/portal pour gérer ou annuler le forfait. La politique de confidentialité de Stripe décrit ce service : https://stripe.com/privacy",
        },
        {
          type: "p",
          text: "Le code ne comprend pas d'outil d'analyse, de pixel publicitaire ni d'autre traceur. Il ne dépose pas de témoins (cookies). Il utilise localStorage pour retenir la langue que vous avez choisie : anglais, français ou espagnol. Si vous vous connectez, il utilise aussi localStorage pour garder la session de connexion sur cet appareil. Il ne conserve pas votre document dans localStorage. Il n'utilise pas sessionStorage. Nous ne contrôlons pas si Google, Cloudflare, Supabase ou Stripe dépose un témoin quand votre navigateur les contacte.",
        },
      ],
    },
    {
      heading: "Pourquoi nous utilisons ces renseignements",
      blocks: [
        {
          type: "p",
          text: "Nous utilisons le texte du document et le lieu que vous avez choisis pour une seule fin : écrire l'explication en langage clair que vous avez demandée, et vous la montrer. La langue sert à écrire cette explication dans la langue choisie.",
        },
        {
          type: "p",
          text: "Nous utilisons le hachage salé et le compte du mois pour une seule fin : permettre trois explications gratuites par connexion à chaque mois civil, et vous dire quand elles recommencent. Nous n'utilisons pas le hachage pour trouver votre nom, et nous ne le rattachons pas au document.",
        },
        {
          type: "p",
          text: "Si vous vous connectez, nous utilisons l'adresse courriel pour envoyer le lien de connexion et pour montrer quel compte est connecté sur cet appareil. Nous utilisons l'identifiant de compte pour donner à ce compte ses trois explications gratuites à chaque mois civil, au lieu de les compter sur la connexion, et pour rattacher un paiement à ce compte. Nous gardons l'indicateur payé, le forfait, les Household Checks restants, les explications individuelles restantes d'un Household Check plus ancien, le compte Clarity Yearly et l'identifiant client Stripe pour que le serveur puisse permettre les explications qui ont été payées et ouvrir le portail client. L'indicateur payé reste faux jusqu'à ce que Stripe confirme un paiement. Nous n'utilisons pas l'adresse courriel pour des messages publicitaires, et nous ne la vendons pas. Nous ne conservons pas le numéro de carte.",
        },
        {
          type: "p",
          text: "Le site n'a aucune fonction qui vend ou loue des renseignements personnels. Il n'affiche pas de publicité, et le code n'envoie pas votre document à un réseau publicitaire ni ne l'utilise pour bâtir un profil publicitaire. Il n'utilise pas le texte pour décider s'il doit vous offrir de l'assurance.",
        },
        {
          type: "p",
          text: "Envoyer un document, c'est ainsi que vous demandez l'explication. Nous traitons cela comme votre consentement à utiliser le texte pour cette fin, y compris l'envoi à Anthropic, comme cette politique le décrit. Nous ne l'utiliserons pas pour une nouvelle fin sans mettre cette page à jour. Vous pouvez arrêter en quittant la page.",
        },
      ],
    },
    {
      heading: "Renseignements qui quittent votre province ou le Canada",
      blocks: [
        {
          type: "p",
          text: "Netlify héberge le site. Anthropic reçoit le texte du document pour écrire l'explication. La demande va à api.anthropic.com. Anthropic est une entreprise aux États-Unis. Le texte peut être traité à l'extérieur de votre province et à l'extérieur du Canada, y compris aux États-Unis.",
        },
        {
          type: "p",
          text: "Nous vous le disons parce que la PIPEDA demande aux organisations d'être transparentes au sujet de ce genre de transfert, et parce que la PIPA de la Colombie-Britannique demande à une organisation d'aviser quand des renseignements personnels peuvent être consultés de l'extérieur du Canada. Pendant que les renseignements sont à l'extérieur du Canada, les lois de l'endroit où ils sont traités peuvent s'appliquer, y compris des ordonnances légales aux États-Unis.",
        },
        {
          type: "p",
          text: "Ce site n'envoie pas à Anthropic d'instruction sur la durée de conservation d'une demande d'API. Nous ne gardons pas notre propre copie, et le site n'a aucun moyen de retrouver ou d'effacer une ancienne demande chez Anthropic. La politique de confidentialité d'Anthropic décrit ce qu'Anthropic fait des entrées d'API : https://www.anthropic.com/legal/privacy",
        },
        {
          type: "p",
          text: "Supabase reçoit l'adresse courriel et la session de connexion pour envoyer le lien et confirmer qui est connecté. La demande va à https://ldhkqqhlztsaljccazti.supabase.co. Supabase peut traiter ces renseignements à l'extérieur de votre province et à l'extérieur du Canada. Le document ne fait pas partie de cette demande. La politique de confidentialité de Supabase décrit ce service : https://supabase.com/privacy",
        },
        {
          type: "p",
          text: "Stripe reçoit l'identifiant de compte, l'adresse courriel quand Checkout en a besoin, et les renseignements de carte que vous saisissez sur la page de Stripe, pour encaisser le paiement et calculer la taxe. Stripe est le vendeur officiel. Le document ne fait pas partie de cette demande. Stripe peut traiter ces renseignements à l'extérieur de votre province et à l'extérieur du Canada. La politique de confidentialité de Stripe est à https://stripe.com/privacy",
        },
      ],
    },
    {
      heading: "Combien de temps ils restent",
      blocks: [
        {
          type: "p",
          text: "Nous ne conservons pas le document, les notes, le lieu ni l'explication après la réponse de la fonction. Votre navigateur les garde seulement jusqu'à ce que vous quittiez la page ou les effaciez. Le choix de langue peut rester dans localStorage jusqu'à ce que vous le changiez ou l'effaciez.",
        },
        {
          type: "p",
          text: "Nous gardons ce dossier d'utilisation pour le mois civil en cours, selon le temps universel coordonné (UTC). Quand vous commencez une explication dans un nouveau mois, nous remplaçons le dossier par ce nouveau mois. Nous ne gardons pas les mois précédents. Si vous ne revenez pas, le hachage et le compte du dernier mois peuvent rester dans Netlify Blobs jusqu'à ce qu'une visite plus tard les remplace. Un dossier d'un mois passé ne change pas le compte du nouveau mois.",
        },
        {
          type: "p",
          text: `Si vous vous connectez, nous conservons l'adresse courriel et la ligne du compte tant que le compte existe. La ligne comprend l'indicateur payé, le forfait et l'identifiant client Stripe. Se déconnecter retire la session de localStorage sur cet appareil. Cela n'efface pas le compte. Vous pouvez nous demander d'effacer le compte en écrivant à ${email}. Nous ne conservons pas le document ni le numéro de carte avec le compte.`,
        },
      ],
    },
    {
      heading: "Demander vos renseignements",
      blocks: [
        {
          type: "p",
          text: "La PIPEDA et la PIPA de la Colombie-Britannique vous donnent le droit de demander si une organisation détient des renseignements personnels à votre sujet, de demander l'accès, et de demander une correction si quelque chose est inexact. Vous pouvez aussi retirer votre consentement pour une utilisation future, et vous pouvez porter plainte.",
        },
        {
          type: "p",
          text: `Comme nous ne gardons pas de copie du document, nous n'avons habituellement rien du document à vous montrer ou à corriger. Si vous ne vous êtes pas connecté, le dossier d'utilisation n'est pas classé sous votre nom ni votre courriel, alors un courriel seul ne nous dit pas quel hachage de connexion est le vôtre. Si vous vous êtes connecté, nous pouvons trouver le compte par l'adresse courriel. Ce compte comprend le courriel, l'indicateur payé, le forfait et l'identifiant client Stripe. Il ne comprend pas le document ni le numéro de carte. Si vous écrivez à ${email}, nous vous dirons ce que nous détenons et nous répondrons dans le délai que ces lois permettent. Nous ne pouvons pas récupérer un ancien document à partir de ce site. Nous ne pouvons pas non plus l'effacer chez Anthropic pour vous, parce que nous ne gardons pas de dossier qui nous permettrait de trouver cette demande.`,
        },
        {
          type: "p",
          text: "Si vous êtes au Canada et que la réponse ne vous satisfait pas, vous pouvez communiquer avec le Commissariat à la protection de la vie privée du Canada. Si votre préoccupation concerne une organisation en Colombie-Britannique, vous pouvez communiquer avec le Bureau du commissaire à l'information et à la protection de la vie privée de la Colombie-Britannique.",
        },
      ],
    },
    {
      heading: "Personnes aux États-Unis",
      blocks: [
        {
          type: "p",
          text: "Si vous utilisez le site depuis les États-Unis, nous traitons les renseignements de la même façon. Nous ne vendons pas de renseignements personnels. Nous ne les partageons pas pour la publicité. Nous ne bâtissons pas de profil publicitaire. Les renseignements que le site traite sont le texte que vous envoyez, le lieu que vous sélectionnez, la langue que vous choisissez, l'identifiant aléatoire de l'explication, le hachage salé de l'adresse IP de la connexion, le compte du mois, et les demandes que votre navigateur fait pour charger la page, les polices de caractères, pdf.js et l'explication. Si vous vous connectez, ils comprennent aussi l'adresse courriel, l'identifiant de compte, la session de connexion gardée sur cet appareil, et l'indicateur payé, qui reste faux jusqu'à ce que Stripe confirme un paiement. Si vous achetez un forfait, Stripe traite aussi les renseignements de carte, comme cette politique le décrit.",
        },
        {
          type: "p",
          text: `Les lois des États sur la vie privée diffèrent. Cette page n'essaie pas de les énumérer. Si une loi de l'endroit où vous vivez vous donne le droit de poser des questions sur des renseignements personnels, vous pouvez écrire à ${email}. Nous répondrons conformément à cette loi, dans la mesure où elle s'applique. Rien ici ne renonce à un droit que vous avez là où vous vivez.`,
        },
      ],
    },
    {
      heading: "Enfants",
      blocks: [
        {
          type: "p",
          text: "Le site est écrit pour des adultes qui lisent des documents d'assurance. Il ne demande pas de date de naissance, et il ne s'adresse pas aux enfants.",
        },
      ],
    },
    {
      heading: "Modifications de cette politique",
      blocks: [
        {
          type: "p",
          text: "Si le site commence à recueillir, à conserver ou à partager des renseignements d'une façon différente, nous mettrons cette page à jour et nous changerons la date d'entrée en vigueur en haut.",
        },
      ],
    },
    {
      heading: "Comment nous joindre",
      blocks: [
        {
          type: "p",
          text: `${name} tient Sign With Clarity à signwithclarity.ca. Pour une question sur la confidentialité, ou pour demander quels renseignements nous détenons, écrivez à ${email}.`,
        },
      ],
    },
  ],
};

export const termsOfUseFr = {
  title: "Conditions d'utilisation",
  sections: [
    {
      heading: "Ces conditions",
      blocks: [
        {
          type: "p",
          text: `Ces conditions sont entre vous et ${name} pour votre utilisation de Sign With Clarity à signwithclarity.ca. Vous pouvez demander trois explications par mois sans payer. La connexion par courriel est facultative. Acheter d'autres explications exige un compte.`,
        },
        {
          type: "p",
          text: "La politique de confidentialité décrit ce qui arrive à un document que vous envoyez. Elle fait partie de ces conditions.",
        },
      ],
    },
    {
      heading: "À quoi sert le site",
      blocks: [
        {
          type: "p",
          text: "Sign With Clarity explique des documents d'assurance en langage clair pour que vous puissiez comprendre le texte plus facilement. C'est pour l'éducation et l'information générale. Le site est offert aux personnes au Canada et aux États-Unis.",
        },
        {
          type: "p",
          text: "Une explication n'est pas un conseil en assurance. Ce n'est pas un avis juridique. Ce n'est pas un conseil financier.",
        },
        {
          type: "p",
          text: "Le site ne recommande pas une garantie. Il ne recommande pas une police, un plafond, une franchise, un avenant ni aucun autre produit. Il ne vous dit pas d'acheter, de renouveler, de modifier ou d'annuler une assurance.",
        },
        {
          type: "p",
          text: `Sign With Clarity n'est pas un professionnel de l'assurance titulaire d'un permis. Ce n'est pas votre assureur, votre courtier ni votre agent. Utiliser le site ne fait pas de ${name} votre avocat, votre conseiller en assurance ni votre conseiller financier, et cela ne crée pas une relation professionnelle.`,
        },
        {
          type: "p",
          text: "Les questions que le site propose sont des exemples que vous pourriez poser à votre propre assureur ou courtier. Ce ne sont pas des instructions.",
        },
      ],
    },
    {
      heading: "L'explication peut être inexacte",
      blocks: [
        {
          type: "p",
          text: "Un modèle d'IA écrit l'explication. L'IA peut se tromper. Elle peut manquer une phrase, mal comprendre un terme, ou dire quelque chose qui ne correspond pas à votre document ou aux règles de l'endroit où vous vivez.",
        },
        {
          type: "p",
          text: "Lisez votre propre document. Avant de signer, de renouveler, d'annuler ou de vous fier à quelque chose d'important, confirmez-le avec votre assureur ou votre courtier, ou avec une autre personne qualifiée pour vous conseiller.",
        },
      ],
    },
    {
      heading: "Votre document",
      blocks: [
        {
          type: "p",
          text: "N'envoyez que du texte que vous avez le droit de partager. Les documents ne sont pas conservés. Le texte reste dans ce navigateur jusqu'à ce que vous partiez ou recommenciez. Cet appareil se souvient seulement de la langue que vous avez choisie. Quand vous demandez une explication, le texte est envoyé à la fonction décrite dans la politique de confidentialité.",
        },
        {
          type: "p",
          text: "Si un document est trop long pour être lu jusqu'au bout, le site le dit. Il ne se contente pas du début sans vous le dire.",
        },
      ],
    },
    {
      heading: "Explications payantes",
      blocks: [
        {
          type: "p",
          text: "Trois explications par mois civil sont gratuites. Household Check est un achat unique d'une comparaison d'au plus quatre polices, avec une courte explication de chacune, au prix affiché pour le Canada ou les États-Unis. La comparaison note les lacunes et les chevauchements. Elle n'expire pas. Clarity Yearly est un abonnement annuel au prix affiché. Il comprend jusqu'à 100 explications dans cette année. Une comparaison compte pour une de ces explications. Stripe est le vendeur et ajoute la taxe au paiement. Un forfait annuel se renouvelle chaque année jusqu'à ce que vous l'annuliez dans le portail client de Stripe. Après l'annulation, vous pouvez continuer à l'utiliser jusqu'à la fin de l'année déjà payée. Household Check n'est pas un abonnement. Payer ne change pas ce qu'est une explication : ce n'est toujours pas un conseil en assurance, un avis juridique ni un conseil financier.",
        },
      ],
    },
    {
      heading: "Utilisation du site",
      blocks: [
        {
          type: "p",
          text: "Utilisez le site pour comprendre un document que vous avez le droit de partager. N'essayez pas de perturber le site ou la fonction d'explication, et n'utilisez pas le site pour nuire à quelqu'un d'autre.",
        },
      ],
    },
    {
      heading: "Aucune promesse d'une réponse parfaite ou toujours disponible",
      blocks: [
        {
          type: "p",
          text: "Le site est fourni tel quel. Une explication peut être incomplète ou inexacte. Le site peut être lent ou indisponible. Nous ne promettons pas qu'une explication est exacte, à jour ou convenable pour une décision que vous devez prendre.",
        },
      ],
    },
    {
      heading: "Responsabilité",
      blocks: [
        {
          type: "p",
          text: `Vous êtes responsable de la façon dont vous utilisez une explication. Dans la mesure où la loi le permet, ${name} n'est pas responsable d'une décision que vous prenez à partir d'une explication, ni d'une perte qui vient du fait de vous fier au site au lieu de vérifier auprès de votre assureur ou de votre courtier.`,
        },
        {
          type: "p",
          text: "Certaines lois ne permettent pas certaines limites de responsabilité. Cela comprend les protections des consommateurs dans les provinces et les territoires du Canada et dans les États américains. Ces protections s'appliquent encore à vous.",
        },
      ],
    },
    {
      heading: "La loi de l'endroit où vous vivez",
      blocks: [
        {
          type: "p",
          text: "Ces conditions visent un site éducatif gratuit utilisé au Canada et aux États-Unis. Elles ne choisissent pas un tribunal pour vous. Les droits que vous avez selon la loi de votre province, de votre territoire ou de votre État restent en place.",
        },
      ],
    },
    {
      heading: "Modifications",
      blocks: [
        {
          type: "p",
          text: "Nous pouvons mettre ces conditions à jour. Quand nous le faisons, nous changeons la date d'entrée en vigueur en haut de cette page. Si vous continuez à utiliser le site après cette date, ces conditions mises à jour s'appliquent.",
        },
      ],
    },
    {
      heading: "Contact",
      blocks: [
        {
          type: "p",
          text: `Les questions sur ces conditions peuvent être envoyées à ${email}.`,
        },
      ],
    },
  ],
};
