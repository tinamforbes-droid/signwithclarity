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
          text: `Sign With Clarity est un site gratuit à signwithclarity.ca. Il explique des documents d'assurance en langage clair pour les personnes au Canada et aux États-Unis. Il est tenu par ${name}.`,
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
          text: "Le site ne vous demande pas de créer un compte. Il ne demande pas votre nom, votre adresse courriel, votre numéro de téléphone ni vos renseignements de paiement.",
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
          text: "Quand vous choisissez Expliquer mon document, le navigateur envoie une demande à la fonction Netlify de ce site, à /.netlify/functions/decode. La demande comprend le texte du document, le pays que vous avez choisi, la province, le territoire ou l'État que vous avez choisi, et la langue que vous avez choisie.",
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
          text: "La fonction ne sauvegarde pas votre document, les notes, votre lieu ni l'explication dans une base de données ou un fichier. Il n'y a pas de compte auquel les rattacher.",
        },
        {
          type: "p",
          text: "La page garde le texte et l'explication en mémoire pendant que vous l'utilisez. Si vous choisissez Expliquer un autre document, la page efface le texte et le nom du fichier. Fermer la page les efface aussi. Le choix de langue peut rester dans localStorage sur cet appareil. Le document, non.",
        },
        {
          type: "p",
          text: "Les documents ne sont pas conservés.",
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
          text: "Le code de la fonction ne lit pas et ne sauvegarde pas votre adresse IP. Rien dans le code du site ne l'écrit.",
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
          text: "Le site et la fonction qui écrit l'explication sont hébergés par Netlify. La demande d'explication va chez Netlify parce que c'est là que la fonction à /.netlify/functions/decode s'exécute. Le code de la fonction ne sauvegarde pas le corps de la demande.",
        },
        {
          type: "p",
          text: "Le code ne comprend pas d'outil d'analyse, de pixel publicitaire ni d'autre traceur. Il ne dépose pas de témoins (cookies). Il utilise localStorage seulement pour retenir la langue que vous avez choisie : anglais, français ou espagnol. Il ne conserve pas votre document dans localStorage. Il n'utilise pas sessionStorage. Nous ne contrôlons pas si Google ou Cloudflare dépose un témoin quand votre navigateur charge une police de caractères ou le fichier pdf.js chez eux.",
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
      ],
    },
    {
      heading: "Combien de temps ils restent",
      blocks: [
        {
          type: "p",
          text: "Nous ne conservons pas le document, les notes, le lieu ni l'explication après la réponse de la fonction. Votre navigateur les garde seulement jusqu'à ce que vous quittiez la page ou les effaciez. Le choix de langue peut rester dans localStorage jusqu'à ce que vous le changiez ou l'effaciez.",
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
          text: `Comme nous ne gardons pas de copie, nous n'avons habituellement rien de votre document à vous montrer ou à corriger. Si vous écrivez à ${email}, nous vous dirons ce que nous détenons et nous répondrons dans le délai que ces lois permettent. Nous ne pouvons pas récupérer un ancien document à partir de ce site. Nous ne pouvons pas non plus l'effacer chez Anthropic pour vous, parce que nous ne gardons pas de dossier qui nous permettrait de trouver cette demande.`,
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
          text: "Si vous utilisez le site depuis les États-Unis, nous traitons les renseignements de la même façon. Nous ne vendons pas de renseignements personnels. Nous ne les partageons pas pour la publicité. Nous ne bâtissons pas de profil publicitaire. Les renseignements que le site traite sont le texte que vous envoyez, le lieu que vous sélectionnez, la langue que vous choisissez, et les demandes que votre navigateur fait pour charger la page, les polices de caractères, pdf.js et l'explication.",
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
          text: `Ces conditions sont entre vous et ${name} pour votre utilisation de Sign With Clarity à signwithclarity.ca. Le site est gratuit. Il n'y a pas de compte.`,
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
          text: "Le site est fourni tel quel, gratuitement. Une explication peut être incomplète ou inexacte. Le site peut être lent ou indisponible. Nous ne promettons pas qu'une explication est exacte, à jour ou convenable pour une décision que vous devez prendre.",
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
