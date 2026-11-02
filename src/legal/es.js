// Spanish privacy policy and terms. Neutral Latin American Spanish, plain wording.
// A person should review this translation before it is relied on.
// The operator's legal name, and the official names of Canadian statutes, stay in English.

import { CONTACT_EMAIL, OWNER_LEGAL_NAME } from "../legalMeta.js";

const name = OWNER_LEGAL_NAME;
const email = CONTACT_EMAIL;

export const privacyPolicyEs = {
  title: "Política de privacidad",
  sections: [
    {
      heading: "Quién opera este sitio",
      blocks: [
        {
          type: "p",
          text: `Sign With Clarity es un sitio gratuito en signwithclarity.ca. Explica documentos de seguro en lenguaje claro para personas en Canadá y Estados Unidos. Lo opera ${name}.`,
        },
        {
          type: "p",
          text: "Esta política describe lo que el código del sitio hace con la información. Está escrita para personas en Canadá, conforme a la ley de protección de la información personal y los documentos electrónicos, la Personal Information Protection and Electronic Documents Act (PIPEDA), y a la Personal Information Protection Act (PIPA) de Columbia Británica. También describe, en términos generales, las mismas prácticas para personas en Estados Unidos.",
        },
        {
          type: "p",
          text: "En Canadá, la PIPEDA cubre la información personal que una organización recoge en el curso de una actividad comercial, salvo que se aplique en su lugar la ley de una provincia. En Columbia Británica, esa ley es la PIPA. Esta política está escrita para que una persona, en cualquier provincia, vea lo que el sitio hace, y para cumplir los deberes generales de ambas leyes: decir qué se recoge y por qué, usarlo solo para ese fin, tratarlo con cuidado, decir cuándo puede salir de Canadá y permitirle preguntar al respecto.",
        },
      ],
    },
    {
      heading: "Qué puede enviar",
      blocks: [
        {
          type: "p",
          text: "Puede pegar texto, o elegir un archivo .txt o .pdf. Un documento puede contener información personal, como un nombre, una dirección, un número de póliza o detalles de un reclamo. El texto que está en la página es el que el sitio usa.",
        },
        {
          type: "p",
          text: "Si elige un PDF, su navegador lo lee en su dispositivo con pdf.js. El sitio usa las palabras que encuentra. No envía el archivo PDF en sí. Si el PDF no tiene capa de texto, la página le pide que pegue el texto, y no se envía nada de ese archivo.",
        },
        {
          type: "p",
          text: "También elige un país, Canadá o Estados Unidos, y una provincia, un territorio o un estado. Puede elegir el idioma de la página y de la explicación: inglés, francés o español. La página envía el país, la provincia, el territorio o el estado, y ese idioma junto con el texto del documento.",
        },
        {
          type: "p",
          text: "El nombre de un archivo que usted elige se muestra en la página. El nombre del archivo se queda en el navegador. No se incluye en la solicitud de descifrado.",
        },
        {
          type: "p",
          text: "El sitio no le pide que cree una cuenta. No pide su nombre, su correo electrónico, su número de teléfono ni sus datos de pago.",
        },
      ],
    },
    {
      heading: "Cómo se escribe una explicación",
      blocks: [
        {
          type: "p",
          text: "El texto que usted pega o que se extrae se queda en la memoria del navegador mientras la página está abierta.",
        },
        {
          type: "p",
          text: "Cuando elige Descifrar mi documento, el navegador envía una solicitud a la función de Netlify de este sitio, en /.netlify/functions/decode. La solicitud incluye el texto del documento, el país que eligió, la provincia, el territorio o el estado que eligió, y el idioma que eligió.",
        },
        {
          type: "p",
          text: "Un documento corto se envía una sola vez. Un documento más largo se divide en partes, con un pequeño texto repetido para que una frase en el límite quede en las dos partes vecinas. Cada parte se envía por separado. La función devuelve notas sobre esa parte. Su navegador puede volver a enviar esas notas para combinarlas, y luego enviar las notas combinadas una vez más para que se escriba la explicación. Las notas son sobre el documento que usted envió.",
        },
        {
          type: "p",
          text: "La función pasa ese texto, junto con su país, su provincia o estado, y el idioma que eligió, a la API de Anthropic en https://api.anthropic.com/v1/messages. El modelo nombrado en el código del servidor es claude-sonnet-4-6. La solicitud también incluye instrucciones que le dicen al modelo cómo explicar un documento de seguro en ese idioma. Anthropic devuelve la explicación. La función envía esa respuesta a su navegador, y la página la muestra.",
        },
        {
          type: "p",
          text: "La clave que llama a Anthropic se guarda en un ajuste del servidor llamado ANTHROPIC_API_KEY. No está incluida en la página que carga su navegador.",
        },
      ],
    },
    {
      heading: "Qué guardamos",
      blocks: [
        {
          type: "p",
          text: "La función no guarda su documento, las notas, su ubicación ni la explicación en una base de datos ni en un archivo. No hay una cuenta a la cual asociarlos.",
        },
        {
          type: "p",
          text: "La página conserva el texto y la explicación en la memoria mientras usted la usa. Si elige Descifrar otro documento, la página borra el texto y el nombre del archivo. Cerrar la página también los borra. La elección de idioma puede quedarse en localStorage en este dispositivo. El documento, no.",
        },
        {
          type: "p",
          text: "Los documentos no se guardan.",
        },
      ],
    },
    {
      heading: "Qué anota el servidor",
      blocks: [
        {
          type: "p",
          text: "Si Anthropic devuelve un error, la función escribe el código de estado HTTP de Anthropic en el registro del servidor. No escribe su documento, y no escribe la respuesta de Anthropic, en esa línea.",
        },
        {
          type: "p",
          text: "Si la función falla de una forma inesperada, escribe ese error en el registro del servidor. El código no agrega su documento, sus notas ni su ubicación a ese mensaje.",
        },
        {
          type: "p",
          text: "El código de la función no lee ni guarda su dirección IP. Nada en el código del sitio la anota.",
        },
      ],
    },
    {
      heading: "Otros servicios que contacta la página",
      blocks: [
        {
          type: "p",
          text: "La página carga dos tipos de letra, Cormorant Garamond y DM Sans, desde Google Fonts en fonts.googleapis.com. Su navegador contacta a Google para descargarlos. Esa solicitud no incluye su documento.",
        },
        {
          type: "p",
          text: "La página carga pdf.js, y el script de apoyo que necesita, desde cdnjs.cloudflare.com, un servicio de Cloudflare. Su navegador contacta a Cloudflare para descargar esos archivos. Esa solicitud no incluye su documento. Un PDF se lee en su dispositivo después de que la biblioteca se ha cargado.",
        },
        {
          type: "p",
          text: "El sitio y la función de descifrado están alojados en Netlify. La solicitud de descifrado va a Netlify porque allí se ejecuta la función. El código de la función no guarda el cuerpo de la solicitud.",
        },
        {
          type: "p",
          text: "El código no incluye una herramienta de analítica, un píxel publicitario ni otro rastreador. No coloca cookies. Usa localStorage solo para recordar el idioma que usted eligió: inglés, francés o español. No guarda su documento en localStorage. No usa sessionStorage. No controlamos si Google o Cloudflare coloca una cookie cuando su navegador carga un tipo de letra o el archivo pdf.js desde ellos.",
        },
      ],
    },
    {
      heading: "Por qué usamos esta información",
      blocks: [
        {
          type: "p",
          text: "Usamos el texto del documento y la ubicación que usted eligió para un solo fin: escribir la explicación en lenguaje claro que pidió, y mostrársela. El idioma sirve para escribir esa explicación en el idioma elegido.",
        },
        {
          type: "p",
          text: "El sitio no tiene una función que venda o alquile información personal. No muestra anuncios, y el código no envía su documento a una red de publicidad ni lo usa para crear un perfil publicitario. No usa el texto para decidir si ofrecerle un seguro.",
        },
        {
          type: "p",
          text: "Enviar un documento es la forma en que usted pide la explicación. Tratamos eso como su consentimiento para usar el texto con ese fin, incluido enviarlo a Anthropic como describe esta política. No lo usaremos para un fin nuevo sin actualizar esta página. Puede detenerse saliendo de la página.",
        },
      ],
    },
    {
      heading: "Información que sale de su provincia o de Canadá",
      blocks: [
        {
          type: "p",
          text: "Netlify aloja el sitio. Anthropic recibe el texto del documento para poder escribir la explicación. La solicitud va a api.anthropic.com. Anthropic es una empresa de Estados Unidos. El texto puede procesarse fuera de su provincia y fuera de Canadá, incluso en Estados Unidos.",
        },
        {
          type: "p",
          text: "Se lo decimos porque la PIPEDA pide a las organizaciones ser abiertas sobre este tipo de transferencia, y porque la PIPA de Columbia Británica pide a una organización avisar cuando la información personal puede consultarse desde fuera de Canadá. Mientras la información está fuera de Canadá, pueden aplicarse las leyes del lugar donde se procesa, incluidas órdenes legales de Estados Unidos.",
        },
        {
          type: "p",
          text: "Este sitio no envía a Anthropic una instrucción sobre cuánto tiempo conservar una solicitud de API. No guardamos una copia propia, y el sitio no tiene forma de buscar o borrar una solicitud anterior en Anthropic. La política de privacidad de Anthropic describe lo que Anthropic hace con las entradas de la API: https://www.anthropic.com/legal/privacy",
        },
      ],
    },
    {
      heading: "Cuánto tiempo permanece",
      blocks: [
        {
          type: "p",
          text: "No conservamos el documento, las notas, la ubicación ni la explicación después de que la función ha respondido. Su navegador los guarda solo hasta que usted sale de la página o los borra. La elección de idioma puede quedarse en localStorage hasta que usted la cambie o la borre.",
        },
      ],
    },
    {
      heading: "Preguntar por su información",
      blocks: [
        {
          type: "p",
          text: "La PIPEDA y la PIPA de Columbia Británica le dan el derecho de preguntar si una organización tiene información personal sobre usted, de pedir acceso y de pedir una corrección si algo está mal. También puede retirar el consentimiento para un uso futuro, y puede presentar una queja.",
        },
        {
          type: "p",
          text: `Como no guardamos una copia, por lo general no tenemos nada de su documento que mostrarle o corregir. Si escribe a ${email}, le diremos qué tenemos y responderemos dentro del plazo que esas leyes permiten. No podemos recuperar un documento anterior desde este sitio. Tampoco podemos borrarlo de Anthropic por usted, porque no guardamos un registro que nos permita encontrar esa solicitud.`,
        },
        {
          type: "p",
          text: "Si está en Canadá y la respuesta no le satisface, puede comunicarse con la Office of the Privacy Commissioner of Canada (Oficina del Comisionado de Privacidad de Canadá). Si su inquietud es sobre una organización en Columbia Británica, puede comunicarse con la Office of the Information and Privacy Commissioner for British Columbia (Oficina del Comisionado de Información y Privacidad de Columbia Británica).",
        },
      ],
    },
    {
      heading: "Personas en Estados Unidos",
      blocks: [
        {
          type: "p",
          text: "Si usa el sitio desde Estados Unidos, tratamos la información de la misma manera. No vendemos información personal. No la compartimos para publicidad. No creamos un perfil publicitario. La información que el sitio maneja es el texto que usted envía, la ubicación que selecciona, el idioma que elige y las solicitudes que su navegador hace para cargar la página, los tipos de letra, pdf.js y la explicación.",
        },
        {
          type: "p",
          text: `Las leyes estatales de privacidad difieren. Esta página no intenta enumerarlas. Si una ley del lugar donde usted vive le da el derecho de preguntar por información personal, puede escribir a ${email}. Responderemos conforme a esa ley, en la medida en que se aplique. Nada aquí renuncia a un derecho que usted tiene donde vive.`,
        },
      ],
    },
    {
      heading: "Niños",
      blocks: [
        {
          type: "p",
          text: "El sitio está escrito para adultos que leen documentos de seguro. No pide una fecha de nacimiento y no está dirigido a niños.",
        },
      ],
    },
    {
      heading: "Cambios a esta política",
      blocks: [
        {
          type: "p",
          text: "Si el sitio empieza a recoger, guardar o compartir información de una forma distinta, actualizaremos esta página y cambiaremos la fecha de entrada en vigor de arriba.",
        },
      ],
    },
    {
      heading: "Cómo contactarnos",
      blocks: [
        {
          type: "p",
          text: `${name} opera Sign With Clarity en signwithclarity.ca. Para una pregunta de privacidad, o para preguntar qué información tenemos, escriba a ${email}.`,
        },
      ],
    },
  ],
};

export const termsOfUseEs = {
  title: "Condiciones de uso",
  sections: [
    {
      heading: "Estas condiciones",
      blocks: [
        {
          type: "p",
          text: `Estas condiciones son entre usted y ${name} por el uso de Sign With Clarity en signwithclarity.ca. El sitio es gratuito. No hay una cuenta.`,
        },
        {
          type: "p",
          text: "La política de privacidad describe lo que ocurre con un documento que usted envía. Forma parte de estas condiciones.",
        },
      ],
    },
    {
      heading: "Para qué sirve el sitio",
      blocks: [
        {
          type: "p",
          text: "Sign With Clarity explica documentos de seguro en lenguaje claro para que usted pueda entender el texto con más facilidad. Es para educación e información general. Se ofrece a personas en Canadá y Estados Unidos.",
        },
        {
          type: "p",
          text: "Una explicación no es asesoría de seguros. No es asesoría legal. No es asesoría financiera.",
        },
        {
          type: "p",
          text: "El sitio no recomienda una cobertura. No recomienda una póliza, un límite, un deducible, un endoso ni ningún otro producto. No le dice que compre, renueve, cambie o cancele un seguro.",
        },
        {
          type: "p",
          text: `Sign With Clarity no es un profesional de seguros con licencia. No es su aseguradora, su corredor ni su agente. Usar el sitio no hace que ${name} sea su abogado, su asesor de seguros ni su asesor financiero, y no crea una relación profesional.`,
        },
        {
          type: "p",
          text: "Las preguntas que el sitio sugiere son ejemplos que usted podría plantear a su propia aseguradora o corredor. No son instrucciones.",
        },
      ],
    },
    {
      heading: "La explicación puede estar equivocada",
      blocks: [
        {
          type: "p",
          text: "Un modelo de IA escribe la explicación. La IA puede equivocarse. Puede pasar por alto una frase, malentender un término o decir algo que no coincide con su documento o con las reglas del lugar donde usted vive.",
        },
        {
          type: "p",
          text: "Lea su propio documento. Antes de firmar, renovar, cancelar o confiar en algo importante, confírmelo con su aseguradora o corredor, o con otra persona calificada para asesorarlo.",
        },
      ],
    },
    {
      heading: "Su documento",
      blocks: [
        {
          type: "p",
          text: "Envíe solo texto que tenga permiso de compartir. Los documentos no se guardan. El texto permanece en este navegador hasta que usted se vaya o empiece de nuevo. Este dispositivo recuerda solo el idioma que usted eligió. Cuando pide una explicación, el texto se envía a la función de descifrado descrita en la política de privacidad.",
        },
        {
          type: "p",
          text: "Si un documento es demasiado largo para leerlo hasta el final, el sitio lo dice. No usa solo el comienzo sin decírselo.",
        },
      ],
    },
    {
      heading: "Uso del sitio",
      blocks: [
        {
          type: "p",
          text: "Use el sitio para entender un documento que tiene permiso de compartir. No intente interrumpir el sitio ni la función de descifrado, y no use el sitio para hacer daño a otra persona.",
        },
      ],
    },
    {
      heading: "Sin promesa de una respuesta perfecta o siempre disponible",
      blocks: [
        {
          type: "p",
          text: "El sitio se ofrece tal como está, sin costo. Una explicación puede estar incompleta o equivocada. El sitio puede ir lento o no estar disponible. No prometemos que una explicación sea exacta, actual o adecuada para una decisión que usted necesite tomar.",
        },
      ],
    },
    {
      heading: "Responsabilidad",
      blocks: [
        {
          type: "p",
          text: `Usted es responsable de cómo usa una explicación. En la medida en que la ley lo permite, ${name} no es responsable de una decisión que usted tome a partir de una explicación, ni de una pérdida que venga de confiar en el sitio en lugar de verificar con su aseguradora o corredor.`,
        },
        {
          type: "p",
          text: "Algunas leyes no permiten ciertos límites de responsabilidad. Eso incluye las protecciones al consumidor en las provincias y los territorios de Canadá y en los estados de Estados Unidos. Esas protecciones siguen aplicándose a usted.",
        },
      ],
    },
    {
      heading: "La ley del lugar donde usted vive",
      blocks: [
        {
          type: "p",
          text: "Estas condiciones son para un sitio educativo gratuito usado en Canadá y Estados Unidos. No eligen un tribunal para usted. Los derechos que usted tiene según la ley de su provincia, territorio o estado siguen en pie.",
        },
      ],
    },
    {
      heading: "Cambios",
      blocks: [
        {
          type: "p",
          text: "Podemos actualizar estas condiciones. Cuando lo hagamos, cambiaremos la fecha de entrada en vigor en la parte de arriba de esta página. Si sigue usando el sitio después de esa fecha, se aplican estas condiciones actualizadas.",
        },
      ],
    },
    {
      heading: "Contacto",
      blocks: [
        {
          type: "p",
          text: `Las preguntas sobre estas condiciones pueden enviarse a ${email}.`,
        },
      ],
    },
  ],
};
