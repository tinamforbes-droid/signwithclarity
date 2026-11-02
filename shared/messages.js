// Plain-language copy for Sign With Clarity.
// en: the existing wording. fr: Canadian French. es: neutral Latin American Spanish.
// No translation service. {placeholders} are filled in by t().

export const LANG_STORAGE_KEY = "swc-lang";

export const LANGUAGE_CHOICES = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "fr", label: "Français", htmlLang: "fr-CA" },
  { code: "es", label: "Español", htmlLang: "es-419" },
];

const en = {
  tagline: "Understand before you sign",
  badge: "🇨🇦🇺🇸 CA & US",
  languageSwitcher: "Language",
  heroEyebrow: "Insurance documents, explained",
  heroTitleLead: "Your policy,",
  heroTitleEm: "in plain English",
  heroSub: "Paste or upload any insurance document and we'll tell you exactly what it means — no legal training required.",
  trustNotAdvice: "Not legal advice",
  trustPlain: "Plain language",
  trustPlaces: "All provinces & states",
  uploadTitle: "Paste or upload your document",
  tabPaste: "Paste Text",
  tabUpload: "Upload File",
  pastePlaceholder: "Paste your insurance document text here... (policy wording, renewal notice, claim letter, etc.)",
  fileChoose: "Tap to choose a file",
  fileDrop: "or drag and drop here",
  fileTypes: "Supports .txt and .pdf text files",
  countryLabel: "Country:",
  countryCanada: "🇨🇦 Canada",
  countryUS: "🇺🇸 United States",
  regionLabelCanada: "Your province or territory:",
  regionLabelUS: "Your state:",
  regionPlaceholder: "Type or choose",
  regionListCanada: "Provinces and territories",
  regionListUS: "States",
  regionEmpty: "No matches. Try another spelling.",
  regionHintCanada: "Choose your province or territory to continue. Type to search, or pick from the list.",
  regionHintUS: "Choose your state or D.C. to continue. Type to search, or pick from the list.",
  decodeButton: "Explain my document",
  decodeSub: "Free • Private • Canada & US",
  loadingTitle: "Reading your document...",
  loadingSub: "We're translating the fine print into plain language for you.",
  loadingCombineTitle: "Putting it together...",
  loadingCombineSub: "We've read the whole document. Now we're writing it in plain language.",
  loadingPart: "Part {current} of {total}. We'll keep going through the later pages, including exclusions.",
  resultsTitle: "Your document, explained ✨",
  resultsSub: "Here's what your insurance document actually says",
  resultsWhole: "We read the whole document, including the later pages, before writing this.",
  sectionSummary: "Plain Language Summary",
  sectionFlags: "Watch Out For",
  sectionQuestions: "Questions To Ask Your Insurer",
  sectionTerms: "Key Terms Explained",
  disclaimerStrong: "Not legal advice.",
  disclaimerRest: "Sign With Clarity helps you understand documents — it does not provide legal, financial, or insurance advice. For important decisions, always speak with a licensed professional.",
  newDecode: "← Explain another document",
  howTitle: "How It Works",
  howSub: "Three steps to understanding your document",
  step1Title: "Paste or upload",
  step1Desc: "Copy text from your insurance document or upload a text file.",
  step2Title: "Select your location",
  step2Desc: "We tailor the explanation to your province or state's insurance rules.",
  step3Title: "Read plain English",
  step3Desc: "Get a clear summary, red flags, questions to ask, and key terms defined.",
  footerText: "signwithclarity.ca • Helping Canadians and Americans understand what they sign • Not legal advice",
  footerNav: "Legal",
  privacyLink: "Privacy Policy",
  termsLink: "Terms of Use",
  backToDecoder: "← Back to the explainer",
  pageTitleHome: "Sign With Clarity – Understand before you sign",
  pageTitlePrivacy: "Privacy Policy – Sign With Clarity",
  pageTitleTerms: "Terms of Use – Sign With Clarity",
  pdfScanned: "This PDF appears to be scanned or image-based. Please copy and paste the text instead.",
  pdfReadError: "Couldn't read this PDF. Please try copying and pasting the text instead.",
  aboutOnePage: "about a page",
  aboutPages: "about {count} pages",
  longerThanWeCanRead: "longer than we can read",
  longNote: "This looks like {pages}. We'll read the whole document, one part at a time, including the sections at the end.",
  tooLong: "This document is too long for us to read all the way through. It looks like {pages}, and we can carefully read about {maxPages} pages at a time. Please split it into smaller parts — the declarations, the exclusions, and any endorsements are the pieces that matter most — and explain each one. We won't quietly use only the beginning.",
  pieceTooLong: "This part of the document is too long to read in one step, so we stopped. Please try again from the page and we'll read it in parts. We didn't use only the beginning.",
  errorGeneric: "Something went wrong on our side. Please try again in a moment. Your document is still here.",
  errorPartFailed: "We couldn't finish part {part} of {total}, so we stopped. Nothing after that was skipped on purpose — this reading isn't complete. Please try again in a moment.",
  errorBadJson: "We read your document, but the answer didn't come back in a form we could show. Please try again.",
  errorBusy: "We're a little busy right now. Please wait a moment and try again.",
  errorPartTimeout: "This part took too long to read. Please try again in a moment.",
  errorTimeout: "This is taking longer than expected. Please try again in a moment.",
  errorNetwork: "We couldn't reach the explainer just now. Please check your connection and try again.",
  errorBadResponse: "We got an unexpected reply while writing the explanation. Please try again in a moment.",
  errorEmpty: "Please paste your document text or upload a file first.",
  errorCombine: "We read the whole document, but it was too much to combine into one explanation. Please split it into two smaller parts and try each one.",
  errorMethod: "That request wasn't accepted. Please try again from the page.",
  errorBadRequest: "That request didn't come through clearly. Please try again.",
  errorBadMode: "We didn't understand that request. Please try again from the page.",
  errorMissingKey: "Server is missing its API key. Add ANTHROPIC_API_KEY in Netlify's environment variables.",
  errorMissingNotes: "We didn't receive the notes from the earlier parts. Please try the document again.",
  errorTooManyNotes: "This document produced more notes than we can combine in one step. Please split it into two smaller parts and try each one.",
  errorNoText: "Please include some document text.",
  errorAuth: "The reading service could not sign in. The site owner needs to check the API key.",
  errorCantReadPart: "We couldn't read that part of the document. Please try again, or paste a shorter section.",
  errorUnexpected: "The reading service didn't respond as expected. Please try again in a moment.",
  errorEmptyAnswer: "The reading service sent back an empty answer. Please try again in a moment.",
  errorReadFailed: "Something went wrong while reading the document. Please try again in a moment.",
};

const fr = {
  tagline: "Comprendre avant de signer",
  badge: "🇨🇦🇺🇸 CA et É.-U.",
  languageSwitcher: "Langue",
  heroEyebrow: "Documents d'assurance, expliqués",
  heroTitleLead: "Votre police,",
  heroTitleEm: "en français clair",
  heroSub: "Collez ou téléversez un document d'assurance et nous vous dirons clairement ce qu'il veut dire. Aucune formation en droit n'est nécessaire.",
  trustNotAdvice: "Pas un avis juridique",
  trustPlain: "Langage clair",
  trustPlaces: "Toutes les provinces et tous les États",
  uploadTitle: "Collez ou téléversez votre document",
  tabPaste: "Coller le texte",
  tabUpload: "Téléverser un fichier",
  pastePlaceholder: "Collez ici le texte de votre document d'assurance... (texte de la police, avis de renouvellement, lettre de réclamation, etc.)",
  fileChoose: "Touchez pour choisir un fichier",
  fileDrop: "ou faites-le glisser ici",
  fileTypes: "Fichiers .txt et PDF contenant du texte",
  countryLabel: "Pays :",
  countryCanada: "🇨🇦 Canada",
  countryUS: "🇺🇸 États-Unis",
  regionLabelCanada: "Votre province ou territoire :",
  regionLabelUS: "Votre État :",
  regionPlaceholder: "Tapez ou choisissez",
  regionListCanada: "Provinces et territoires",
  regionListUS: "États",
  regionEmpty: "Aucun résultat. Essayez une autre orthographe.",
  regionHintCanada: "Choisissez votre province ou territoire pour continuer. Tapez pour chercher, ou choisissez dans la liste.",
  regionHintUS: "Choisissez votre État ou le district de Columbia pour continuer. Tapez pour chercher, ou choisissez dans la liste.",
  decodeButton: "Expliquer mon document",
  decodeSub: "Gratuit • Confidentiel • Canada et É.-U.",
  loadingTitle: "Lecture de votre document...",
  loadingSub: "Nous mettons les petits caractères en langage clair pour vous.",
  loadingCombineTitle: "On rassemble le tout...",
  loadingCombineSub: "Nous avons lu le document en entier. Nous l'écrivons maintenant en langage clair.",
  loadingPart: "Partie {current} de {total}. Nous continuons avec les pages suivantes, y compris les exclusions.",
  resultsTitle: "Votre document, expliqué ✨",
  resultsSub: "Voici ce que dit vraiment votre document d'assurance",
  resultsWhole: "Nous avons lu le document en entier, y compris les dernières pages, avant d'écrire ceci.",
  sectionSummary: "Résumé en langage clair",
  sectionFlags: "À surveiller",
  sectionQuestions: "Questions à poser à votre assureur",
  sectionTerms: "Termes importants expliqués",
  disclaimerStrong: "Pas un avis juridique.",
  disclaimerRest: "Sign With Clarity vous aide à comprendre des documents. Le site ne donne pas de conseils juridiques, financiers ou en assurance. Pour une décision importante, parlez-en toujours avec une personne qualifiée.",
  newDecode: "← Expliquer un autre document",
  howTitle: "Comment ça marche",
  howSub: "Trois étapes pour comprendre votre document",
  step1Title: "Collez ou téléversez",
  step1Desc: "Copiez le texte de votre document d'assurance ou téléversez un fichier texte.",
  step2Title: "Indiquez où vous habitez",
  step2Desc: "Nous adaptons l'explication aux règles d'assurance de votre province ou de votre État.",
  step3Title: "Lisez en français clair",
  step3Desc: "Vous obtenez un résumé clair, des points à surveiller, des questions à poser et les termes importants.",
  footerText: "signwithclarity.ca • Pour aider les gens au Canada et aux États-Unis à comprendre ce qu'ils signent • Pas un avis juridique",
  footerNav: "Informations juridiques",
  privacyLink: "Politique de confidentialité",
  termsLink: "Conditions d'utilisation",
  backToDecoder: "← Retour à l'explication",
  pageTitleHome: "Sign With Clarity – Comprendre avant de signer",
  pageTitlePrivacy: "Politique de confidentialité – Sign With Clarity",
  pageTitleTerms: "Conditions d'utilisation – Sign With Clarity",
  pdfScanned: "Ce PDF semble numérisé ou fait d'images. Veuillez copier et coller le texte.",
  pdfReadError: "Impossible de lire ce PDF. Essayez de copier et coller le texte.",
  aboutOnePage: "environ une page",
  aboutPages: "environ {count} pages",
  longerThanWeCanRead: "plus long que ce que nous pouvons lire",
  longNote: "Ceci ressemble à {pages}. Nous lirons le document en entier, une partie à la fois, y compris les sections à la fin.",
  tooLong: "Ce document est trop long pour que nous le lisions jusqu'au bout. Il fait {pages}, et nous pouvons lire attentivement environ {maxPages} pages à la fois. Veuillez le séparer en parties plus petites — les déclarations, les exclusions et les avenants comptent le plus — et expliquer chacune. Nous ne garderons pas seulement le début sans vous le dire.",
  pieceTooLong: "Cette partie du document est trop longue à lire en une seule étape, alors nous avons arrêté. Veuillez réessayer à partir de la page et nous la lirons en parties. Nous n'avons pas utilisé seulement le début.",
  errorGeneric: "Quelque chose s'est mal passé de notre côté. Veuillez réessayer dans un moment. Votre document est encore ici.",
  errorPartFailed: "Nous n'avons pas pu finir la partie {part} de {total}, alors nous avons arrêté. Rien après cela n'a été laissé de côté exprès — cette lecture n'est pas complète. Veuillez réessayer dans un moment.",
  errorBadJson: "Nous avons lu votre document, mais la réponse n'est pas revenue sous une forme que nous pouvons afficher. Veuillez réessayer.",
  errorBusy: "Nous sommes un peu occupés en ce moment. Veuillez patienter un moment et réessayer.",
  errorPartTimeout: "Cette partie a pris trop de temps à lire. Veuillez réessayer dans un moment.",
  errorTimeout: "Cela prend plus de temps que prévu. Veuillez réessayer dans un moment.",
  errorNetwork: "Nous n'avons pas pu joindre le service d'explication pour le moment. Vérifiez votre connexion et réessayez.",
  errorBadResponse: "Nous avons reçu une réponse inattendue en écrivant l'explication. Veuillez réessayer dans un moment.",
  errorEmpty: "Veuillez d'abord coller le texte de votre document ou téléverser un fichier.",
  errorCombine: "Nous avons lu le document en entier, mais c'était trop pour le réunir en une seule explication. Veuillez le séparer en deux parties plus petites et essayer chacune.",
  errorMethod: "Cette demande n'a pas été acceptée. Veuillez réessayer à partir de la page.",
  errorBadRequest: "Cette demande n'est pas arrivée clairement. Veuillez réessayer.",
  errorBadMode: "Nous n'avons pas compris cette demande. Veuillez réessayer à partir de la page.",
  errorMissingKey: "Le serveur n'a pas sa clé d'API. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement de Netlify.",
  errorMissingNotes: "Nous n'avons pas reçu les notes des parties précédentes. Veuillez réessayer le document.",
  errorTooManyNotes: "Ce document a produit plus de notes que nous pouvons combiner en une étape. Veuillez le séparer en deux parties plus petites et essayer chacune.",
  errorNoText: "Veuillez inclure du texte du document.",
  errorAuth: "Le service de lecture n'a pas pu se connecter. Le propriétaire du site doit vérifier la clé d'API.",
  errorCantReadPart: "Nous n'avons pas pu lire cette partie du document. Veuillez réessayer, ou collez une section plus courte.",
  errorUnexpected: "Le service de lecture n'a pas répondu comme prévu. Veuillez réessayer dans un moment.",
  errorEmptyAnswer: "Le service de lecture a renvoyé une réponse vide. Veuillez réessayer dans un moment.",
  errorReadFailed: "Quelque chose s'est mal passé pendant la lecture du document. Veuillez réessayer dans un moment.",
};

const es = {
  tagline: "Entienda antes de firmar",
  badge: "🇨🇦🇺🇸 CA y EE. UU.",
  languageSwitcher: "Idioma",
  heroEyebrow: "Documentos de seguro, explicados",
  heroTitleLead: "Su póliza,",
  heroTitleEm: "en español claro",
  heroSub: "Pegue o suba cualquier documento de seguro y le diremos con claridad qué significa. No hace falta saber de leyes.",
  trustNotAdvice: "No es asesoría legal",
  trustPlain: "Lenguaje claro",
  trustPlaces: "Todas las provincias y los estados",
  uploadTitle: "Pegue o suba su documento",
  tabPaste: "Pegar texto",
  tabUpload: "Subir archivo",
  pastePlaceholder: "Pegue aquí el texto de su documento de seguro... (texto de la póliza, aviso de renovación, carta de reclamo, etc.)",
  fileChoose: "Toque para elegir un archivo",
  fileDrop: "o arrástrelo aquí",
  fileTypes: "Acepta archivos .txt y PDF con texto",
  countryLabel: "País:",
  countryCanada: "🇨🇦 Canadá",
  countryUS: "🇺🇸 Estados Unidos",
  regionLabelCanada: "Su provincia o territorio:",
  regionLabelUS: "Su estado:",
  regionPlaceholder: "Escriba o elija",
  regionListCanada: "Provincias y territorios",
  regionListUS: "Estados",
  regionEmpty: "No hay coincidencias. Pruebe con otra ortografía.",
  regionHintCanada: "Elija su provincia o territorio para continuar. Escriba para buscar, o elija de la lista.",
  regionHintUS: "Elija su estado o el Distrito de Columbia para continuar. Escriba para buscar, o elija de la lista.",
  decodeButton: "Explicar mi documento",
  decodeSub: "Gratis • Privado • Canadá y EE. UU.",
  loadingTitle: "Leyendo su documento...",
  loadingSub: "Estamos pasando la letra chica a un lenguaje claro.",
  loadingCombineTitle: "Juntando las partes...",
  loadingCombineSub: "Ya leímos el documento completo. Ahora lo escribimos en lenguaje claro.",
  loadingPart: "Parte {current} de {total}. Seguimos con las páginas de más adelante, incluidas las exclusiones.",
  resultsTitle: "Su documento, explicado ✨",
  resultsSub: "Esto es lo que realmente dice su documento de seguro",
  resultsWhole: "Leímos el documento completo, incluidas las últimas páginas, antes de escribir esto.",
  sectionSummary: "Resumen en lenguaje claro",
  sectionFlags: "Ojo con esto",
  sectionQuestions: "Preguntas para su aseguradora",
  sectionTerms: "Términos importantes explicados",
  disclaimerStrong: "No es asesoría legal.",
  disclaimerRest: "Sign With Clarity le ayuda a entender documentos. No ofrece asesoría legal, financiera ni de seguros. Para una decisión importante, hable siempre con un profesional autorizado.",
  newDecode: "← Explicar otro documento",
  howTitle: "Cómo funciona",
  howSub: "Tres pasos para entender su documento",
  step1Title: "Pegue o suba",
  step1Desc: "Copie el texto de su documento de seguro o suba un archivo de texto.",
  step2Title: "Elija su ubicación",
  step2Desc: "Adaptamos la explicación a las reglas de seguros de su provincia o estado.",
  step3Title: "Lea en español claro",
  step3Desc: "Reciba un resumen claro, puntos a vigilar, preguntas para hacer y los términos importantes.",
  footerText: "signwithclarity.ca • Para ayudar a las personas en Canadá y Estados Unidos a entender lo que firman • No es asesoría legal",
  footerNav: "Información legal",
  privacyLink: "Política de privacidad",
  termsLink: "Condiciones de uso",
  backToDecoder: "← Volver a la explicación",
  pageTitleHome: "Sign With Clarity – Entienda antes de firmar",
  pageTitlePrivacy: "Política de privacidad – Sign With Clarity",
  pageTitleTerms: "Condiciones de uso – Sign With Clarity",
  pdfScanned: "Este PDF parece escaneado o hecho de imágenes. Copie y pegue el texto.",
  pdfReadError: "No pudimos leer este PDF. Pruebe copiar y pegar el texto.",
  aboutOnePage: "alrededor de una página",
  aboutPages: "alrededor de {count} páginas",
  longerThanWeCanRead: "más largo de lo que podemos leer",
  longNote: "Esto parece {pages}. Leeremos el documento completo, una parte a la vez, incluidas las secciones del final.",
  tooLong: "Este documento es demasiado largo para leerlo hasta el final. Parece {pages}, y podemos leer con cuidado alrededor de {maxPages} páginas a la vez. Divídalo en partes más pequeñas — las declaraciones, las exclusiones y los endosos son las partes que más importan — y explique cada una. No usaremos solo el comienzo sin decírselo.",
  pieceTooLong: "Esta parte del documento es demasiado larga para leerla de una sola vez, así que nos detuvimos. Vuelva a intentarlo desde la página y la leeremos por partes. No usamos solo el comienzo.",
  errorGeneric: "Algo salió mal de nuestro lado. Vuelva a intentarlo en un momento. Su documento sigue aquí.",
  errorPartFailed: "No pudimos terminar la parte {part} de {total}, así que nos detuvimos. Nada de lo que sigue se dejó afuera a propósito: esta lectura no está completa. Vuelva a intentarlo en un momento.",
  errorBadJson: "Leímos su documento, pero la respuesta no volvió en una forma que podamos mostrar. Vuelva a intentarlo.",
  errorBusy: "Estamos un poco ocupados en este momento. Espere un momento y vuelva a intentarlo.",
  errorPartTimeout: "Esta parte tardó demasiado en leerse. Vuelva a intentarlo en un momento.",
  errorTimeout: "Esto está tardando más de lo esperado. Vuelva a intentarlo en un momento.",
  errorNetwork: "No pudimos comunicarnos con el servicio de explicación en este momento. Revise su conexión y vuelva a intentarlo.",
  errorBadResponse: "Recibimos una respuesta inesperada al escribir la explicación. Vuelva a intentarlo en un momento.",
  errorEmpty: "Primero pegue el texto de su documento o suba un archivo.",
  errorCombine: "Leímos el documento completo, pero era demasiado para juntarlo en una sola explicación. Divídalo en dos partes más pequeñas y pruebe cada una.",
  errorMethod: "Esa solicitud no fue aceptada. Vuelva a intentarlo desde la página.",
  errorBadRequest: "Esa solicitud no llegó con claridad. Vuelva a intentarlo.",
  errorBadMode: "No entendimos esa solicitud. Vuelva a intentarlo desde la página.",
  errorMissingKey: "Al servidor le falta su clave de API. Agregue ANTHROPIC_API_KEY en las variables de entorno de Netlify.",
  errorMissingNotes: "No recibimos las notas de las partes anteriores. Vuelva a probar el documento.",
  errorTooManyNotes: "Este documento produjo más notas de las que podemos combinar en un paso. Divídalo en dos partes más pequeñas y pruebe cada una.",
  errorNoText: "Incluya un poco del texto del documento.",
  errorAuth: "El servicio de lectura no pudo iniciar sesión. Quien administra el sitio debe revisar la clave de API.",
  errorCantReadPart: "No pudimos leer esa parte del documento. Vuelva a intentarlo, o pegue una sección más corta.",
  errorUnexpected: "El servicio de lectura no respondió como esperábamos. Vuelva a intentarlo en un momento.",
  errorEmptyAnswer: "El servicio de lectura devolvió una respuesta vacía. Vuelva a intentarlo en un momento.",
  errorReadFailed: "Algo salió mal al leer el documento. Vuelva a intentarlo en un momento.",
};

export const MESSAGES = { en, fr, es };

export function asLanguage(value) {
  const base = String(value ?? "").toLowerCase().trim().split("-")[0];
  if (base === "fr" || base === "es" || base === "en") return base;
  return "";
}

export function languageFromTags(tags) {
  const list = Array.isArray(tags) ? tags : [tags];
  for (const tag of list) {
    const code = asLanguage(tag);
    if (code) return code;
  }
  return "en";
}

export function readStoredLanguage(storage) {
  try {
    return asLanguage(storage?.getItem?.(LANG_STORAGE_KEY)) || "";
  } catch {
    return "";
  }
}

export function storeLanguage(storage, lang) {
  const code = asLanguage(lang);
  if (!code) return;
  try {
    storage?.setItem?.(LANG_STORAGE_KEY, code);
  } catch {
    // Private browsing can block storage. The language still changes for this visit.
  }
}

export function resolveLanguage({ storage, tags } = {}) {
  return readStoredLanguage(storage) || languageFromTags(tags);
}

export function htmlLang(lang) {
  return LANGUAGE_CHOICES.find((choice) => choice.code === lang)?.htmlLang || "en";
}

export function t(lang, key, vars) {
  const code = lang === "fr" || lang === "es" ? lang : "en";
  let text = MESSAGES[code][key];
  if (typeof text !== "string") text = MESSAGES.en[key];
  if (typeof text !== "string") return key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (full, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : full
  ));
}

export function loadingCopy(lang, progress) {
  if (!progress || progress.total <= 1) {
    return { title: t(lang, "loadingTitle"), sub: t(lang, "loadingSub") };
  }
  if (progress.phase === "combining") {
    return { title: t(lang, "loadingCombineTitle"), sub: t(lang, "loadingCombineSub") };
  }
  return {
    title: t(lang, "loadingTitle"),
    sub: t(lang, "loadingPart", { current: progress.current, total: progress.total }),
  };
}

const PAGE_TITLE_KEYS = {
  home: "pageTitleHome",
  privacy: "pageTitlePrivacy",
  terms: "pageTitleTerms",
};

export function pageTitle(lang, page) {
  return t(lang, PAGE_TITLE_KEYS[page] || "pageTitleHome");
}
