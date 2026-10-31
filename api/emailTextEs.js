// The emails in Spanish: the same shape as emailTextFr.js. Neutral Latin
// American and US usage, "tú", "encargo" for a commission and "tarifa" for a
// fee, as on the site. Drafted 2026-10-31; to be checked by a Spanish speaker
// with the site before Spanish is marked ready.
const q = (text) => `“${text}”`;
const named = (payload, fallback) => (payload.title ? q(payload.title) : fallback);

export const es = {
  locale: "es",
  q,
  questions: "¿Preguntas?",
  yourProject: "tu proyecto",
  yourConversation: "tu conversación",
  people: {
    buyer: "el comprador",
    Buyer: "El comprador",
    aBuyer: "Un comprador",
    creator: "el creador",
    Creator: "El creador",
    other: "la otra persona",
    Other: "La otra persona",
  },
  waited: (days) => (days ? `desde hace ${days} días` : "desde hace un tiempo"),
  deadlineFallback: "la fecha límite",
  subjectMilestone: (number, title) => `el hito ${number} (${title})`,
  subjectDelivery: (title) => `la entrega final (${title})`,
  subjectCommission: "este encargo",
  methods: { email: "correo electrónico", "text message": "mensaje de texto", other: "otra forma" },
  noReply: (days) => `No hubo respuesta a una advertencia de cancelación en ${days} días.`,

  receipt: ({ amount, title }) => ({
    subject: `Recibo: ${amount} por ${q(title)}`,
    title: "Pago recibido",
    lines: [`Recibimos tu pago de ${amount} por ${q(title)}.`],
    cta: "Ver el encargo",
  }),
  firstNotice: ({ title, action, date }) => ({
    subject: `Acción requerida en ${q(title)}`,
    title: "Se necesita una respuesta",
    lines: [
      `En ${q(title)}, la otra parte necesita lo siguiente: ${action}`,
      `Responde a más tardar el ${date}. Si no hay respuesta, podría seguir un aviso final.`,
    ],
    cta: "Abrir el encargo",
  }),
  finalNotice: ({ title, action, date }) => ({
    subject: `Aviso final: ${q(title)}`,
    title: "Aviso final",
    lines: [
      `Este es un aviso final sobre ${q(title)}: ${action}`,
      `Tienes hasta el ${date} para responder. Después, la otra parte puede pedirle a Made for Stream que cierre este proyecto administrativamente.`,
    ],
    cta: "Abrir el encargo",
  }),
  payoutReleased: ({ amount, arrivalDate }) => ({
    subject: `Cobro liberado: ${amount}`,
    title: "Cobro liberado",
    lines: [
      `Se liberó un cobro de ${amount} de tu saldo retenido y va en camino a tu banco${
        arrivalDate ? ` (llegada prevista: ${arrivalDate})` : ""
      }.`,
    ],
    cta: "Ver los cobros",
  }),
  decision: {
    approved: ({ brand }) => ({
      subject: `Te aprobaron como creador en ${brand}`,
      title: "Te aprobaron",
      lines: [
        `Buenas noticias: se aprobó tu solicitud de creador. Te damos la bienvenida a ${brand}.`,
        "Dos pasos antes de poder aceptar trabajo pagado:",
        "1. Configura tus cobros en Configuración, para poder recibir pagos. Se hace con Stripe y toma unos minutos.",
        "2. Publica tu primer anuncio.",
        "Los anuncios gratis no necesitan cobros configurados.",
      ],
      noteLabel: "Una nota de los revisores",
      cta: "Configurar los cobros",
    }),
    needs_changes: ({ brand }) => ({
      subject: `Tu solicitud de creador en ${brand} necesita cambios`,
      title: "Tu solicitud necesita cambios",
      lines: [
        "Revisamos tu solicitud de creador y necesita algunos cambios antes de que podamos aprobarla.",
        "Actualiza tu solicitud y vuelve a enviarla. No tienes que empezar de nuevo.",
      ],
      noteLabel: "Qué cambiar",
      cta: "Actualizar la solicitud",
    }),
    rejected: ({ brand, support }) => ({
      subject: `Novedades sobre tu solicitud de creador en ${brand}`,
      title: "Novedades sobre tu solicitud",
      lines: [
        `Gracias por solicitar ser creador en ${brand}. Después de revisar tu solicitud, no podemos aprobarla en este momento.`,
        `Puedes seguir usando ${brand} como comprador. Si crees que esta decisión fue un error, escribe a ${support}.`,
      ],
      noteLabel: "Motivo",
      cta: "Ver la solicitud",
    }),
  },

  notifications: {
    request_received: (t, p, n) => ({
      subject: `Nueva solicitud de encargo: ${q(t)}`,
      title: "Tienes una nueva solicitud de encargo",
      lines: [
        `${n.aBuyer} te envió una solicitud de encargo, ${q(t)}.`,
        "Ábrela para leer los detalles, hacer preguntas en el chat y aceptarla o rechazarla.",
      ],
      cta: "Revisar la solicitud",
    }),
    request_reminder: (t, p, n, h) => ({
      subject: `Sigue esperando tu respuesta: ${q(t)}`,
      title: "Una solicitud de encargo espera tu respuesta",
      lines: [`${q(t)} está en espera ${h.waited}. ${n.Buyer} no puede avanzar hasta que la aceptes o la rechaces.`],
      cta: "Revisar la solicitud",
    }),
    request_accepted: (t, p, n) => ({
      subject: `Aceptada: ${q(t)}`,
      title: `${n.Creator} aceptó tu solicitud de encargo`,
      lines: [
        `Buenas noticias: ${n.creator} aceptó ${q(t)}.`,
        `Ahora, ${n.creator} te enviará un acuerdo del proyecto con el alcance, el precio, el plazo y el calendario de pagos. Recibirás otro correo cuando esté listo. No empieza nada ni se cobra nada hasta que revises y aceptes ese acuerdo.`,
      ],
      cta: "Abrir el encargo",
    }),
    request_declined: (t, p, n, h) => ({
      subject: `Rechazada: ${q(t)}`,
      title: `${n.Creator} rechazó tu solicitud de encargo`,
      lines: [`${n.Creator} no puede aceptar ${q(t)}. No se te cobró nada.`],
      noteLabel: "Motivo indicado",
      note: h.reason,
      cta: "Ver el encargo",
    }),
    request_withdrawn: (t, p, n) => ({
      subject: `Ya no está en espera: ${q(t)}`,
      title: "Se archivó una solicitud de encargo",
      lines: [`La solicitud de encargo ${q(t)} fue archivada por ${n.other} antes de ser aceptada. No necesitas hacer nada más.`],
      cta: "Ver el encargo",
    }),
    agreement_sent: (t, p, n) => ({
      subject: `Acción requerida: revisa el acuerdo de ${q(t)}`,
      title: "Tu acuerdo del proyecto está listo para revisar",
      lines: [
        `${n.Creator} envió el acuerdo del proyecto de ${q(t)}.`,
        "Lee el alcance, el precio, el plazo y el calendario de pagos, confirma cada sección a medida que la leas, y acepta o rechaza. El trabajo no puede empezar hasta que aceptes.",
      ],
      cta: "Revisar el acuerdo",
    }),
    agreement_reminder: (t, p, n, h) => ({
      subject: `Recordatorio: el acuerdo de ${q(t)} necesita tu respuesta`,
      title: "Tu acuerdo del proyecto sigue en espera",
      lines: [`El acuerdo de ${q(t)} está en espera ${h.waited}. ${n.Creator} no puede empezar hasta que lo aceptes o lo rechaces.`],
      cta: "Revisar el acuerdo",
    }),
    agreement_accepted: (t, p, n) => ({
      subject: `Acuerdo aceptado: ${q(t)}`,
      title: `${n.Buyer} aceptó tu acuerdo del proyecto`,
      lines: [
        `${n.Buyer} leyó, confirmó y aceptó el acuerdo de ${q(t)}.`,
        "Si el acuerdo tiene un pago antes de empezar el trabajo, espera el correo del pago antes de comenzar. De lo contrario, ya puedes empezar.",
      ],
      cta: "Abrir el encargo",
    }),
    agreement_declined: (t, p, n) => ({
      subject: `Acuerdo rechazado: ${q(t)}`,
      title: `${n.Buyer} rechazó tu acuerdo del proyecto`,
      lines: [`${n.Buyer} rechazó el acuerdo de ${q(t)}. Pueden hablarlo en el chat y puedes enviar un acuerdo modificado.`],
      cta: "Abrir el encargo",
    }),
    change_order_sent: (t, p, n) => ({
      subject: `Acción requerida: un cambio en ${q(t)}`,
      title: `${n.Creator} propuso un cambio`,
      lines: [
        `${n.Creator} propuso ${named(p, "una orden de cambio")} en ${q(t)}. Puede cambiar el alcance, el precio, el plazo o los entregables.`,
        "Nada cambia hasta que la aceptes. Revísala y acéptala o recházala.",
      ],
      cta: "Revisar el cambio",
    }),
    change_order_accepted: (t, p, n) => ({
      subject: `Cambio aceptado: ${q(t)}`,
      title: `${n.Buyer} aceptó tu orden de cambio`,
      lines: [`${n.Buyer} aceptó ${named(p, "tu orden de cambio")} en ${q(t)}. Si aumentó el precio, ya se pidió el pago de la diferencia.`],
      cta: "Abrir el encargo",
    }),
    change_order_declined: (t, p, n) => ({
      subject: `Cambio rechazado: ${q(t)}`,
      title: `${n.Buyer} rechazó tu orden de cambio`,
      lines: [`${n.Buyer} rechazó ${named(p, "tu orden de cambio")} en ${q(t)}. El acuerdo original sigue vigente.`],
      cta: "Abrir el encargo",
    }),
    payment_required: (t, p, n, h) => ({
      subject: `Pago pendiente de ${q(t)}`,
      title: "Hay un pago pendiente",
      lines: [
        `${named(p, "Un pago")} de ${q(t)} está listo para pagarse${h.amount ? `: ${h.amount}` : ""}.`,
        "El proyecto espera este pago. Pagas en la moneda del creador, en una página segura de Stripe.",
      ],
      cta: "Pagar ahora",
    }),
    payment_reminder: (t, p, n, h) => ({
      subject: `Recordatorio: pago pendiente de ${q(t)}`,
      title: "Un pago sigue en espera",
      lines: [
        `${named(p, "Un pago")} de ${q(t)}${h.amount ? ` (${h.amount})` : ""} está sin pagar ${h.waited}.`,
        `${n.Creator} lo está esperando. Si algo no está bien, responde en el chat del encargo para que ${n.creator} lo sepa.`,
      ],
      cta: "Pagar ahora",
    }),
    payment_received: (t, p, n, h) => ({
      subject: `Pago recibido de ${q(t)}`,
      title: `${n.Buyer} pagó`,
      lines: [
        `${n.Buyer} pagó ${named(p, "un pago")} de ${q(t)}${h.amount ? `: ${h.amount} antes de tarifas` : ""}.`,
        "Puedes continuar con el siguiente paso del proyecto.",
      ],
      cta: "Abrir el encargo",
    }),
    payment_refunded: (t, p) => ({
      subject: `Reembolso en ${q(t)}`,
      title: "Se reembolsó un pago",
      lines: [`Se hizo un reembolso de ${named(p, "un pago")} de ${q(t)}. Abre el encargo para ver el monto.`],
      cta: "Ver el encargo",
    }),
    payment_disputed: (t, p) => ({
      subject: `Pago en disputa: ${q(t)}`,
      title: "Un pago está en disputa",
      lines: [`El banco del comprador abrió una disputa sobre ${named(p, "un pago")} de ${q(t)}. Made for Stream se comunicará contigo sobre lo que se necesita.`],
      cta: "Ver el encargo",
    }),
    milestone_submitted: (t, p, n) => ({
      subject: `Acción requerida: revisa ${named(p, "un hito")} en ${q(t)}`,
      title: "Un hito está listo para que lo revises",
      lines: [
        `${n.Creator} envió ${named(p, "un hito")} en ${q(t)}.`,
        "Revisa el trabajo y apruébalo o pide revisiones. Al aprobarlo, vence el pago de ese hito.",
      ],
      cta: "Revisar el hito",
    }),
    milestone_review_reminder: (t, p, n, h) => ({
      subject: `Recordatorio: ${named(p, "un hito")} en ${q(t)} necesita tu revisión`,
      title: "Un hito sigue esperando tu revisión",
      lines: [`${named(p, "Un hito")} en ${q(t)} está en espera ${h.waited}. ${n.Creator} no puede continuar hasta que lo apruebes o pidas revisiones.`],
      cta: "Revisar el hito",
    }),
    milestone_approved: (t, p, n) => ({
      subject: `Hito aprobado: ${q(t)}`,
      title: `${n.Buyer} aprobó tu hito`,
      lines: [`${n.Buyer} aprobó ${named(p, "tu hito")} en ${q(t)} y ya se pidió su pago. Recibirás un correo cuando llegue.`],
      cta: "Abrir el encargo",
    }),
    milestone_revision_requested: (t, p, n, h) => ({
      subject: `Revisiones solicitadas: ${q(t)}`,
      title: `${n.Buyer} pidió revisiones`,
      lines: [`${n.Buyer} pidió cambios en ${named(p, "tu hito")} de ${q(t)}.`],
      noteLabel: "Lo que se pidió",
      note: h.reason,
      cta: "Abrir el encargo",
    }),
    final_delivery_submitted: (t, p, n) => ({
      subject: `Acción requerida: tu entrega final de ${q(t)}`,
      title: "Tu entrega final está lista para revisar",
      lines: [
        `${n.Creator} envió la entrega final de ${q(t)}.`,
        "Revísala y apruébala o pide revisiones. Al aprobarla, se completa el proyecto.",
      ],
      cta: "Revisar la entrega",
    }),
    final_delivery_review_reminder: (t, p, n, h) => ({
      subject: `Recordatorio: la entrega final de ${q(t)} necesita tu revisión`,
      title: "Tu entrega final sigue en espera",
      lines: [`La entrega final de ${q(t)} está en espera ${h.waited}. Apruébala o pide revisiones.`],
      cta: "Revisar la entrega",
    }),
    final_delivery_revision_requested: (t, p, n, h) => ({
      subject: `Revisiones solicitadas en la entrega final: ${q(t)}`,
      title: `${n.Buyer} pidió revisiones a la entrega final`,
      lines: [`${n.Buyer} pidió cambios en la entrega final de ${q(t)}.`],
      noteLabel: "Lo que se pidió",
      note: h.reason,
      cta: "Abrir el encargo",
    }),
    progress_update_posted: (t, p, n) => ({
      subject: `Actualización de avance en ${q(t)}`,
      title: `${n.Creator} publicó una actualización de avance`,
      lines: [`${n.Creator} publicó ${named(p, "una actualización")} en ${q(t)}.`],
      cta: "Leer la actualización",
    }),
    progress_update_overdue: (t, p, n) => ({
      subject: `Hay una actualización de avance pendiente en ${q(t)}`,
      title: "Tienes una actualización de avance atrasada",
      lines: [
        `Tu acuerdo de ${q(t)} promete actualizaciones de avance periódicas, y una ya está atrasada.`,
        `Publica una actualización breve para que ${n.buyer} sepa cómo van las cosas. Las actualizaciones que faltan son una de las cosas que un comprador puede plantear si un proyecto se detiene.`,
      ],
      cta: "Publicar una actualización",
    }),
    cancellation_statement_needed: (t, p, n, h) => ({
      subject: `Acción requerida: pidieron cancelar ${q(t)}`,
      title: `${n.Buyer} pidió cancelar`,
      lines: [
        `${n.Buyer} pidió cancelar ${q(t)} después de pagar. Todavía no se cancela nada.`,
        `Envía tu desglose detallado del trabajo hecho por cada pago, para que ${n.buyer} pueda aceptarlo o disputarlo.`,
      ],
      noteLabel: "Motivo indicado",
      note: h.reason,
      cta: "Enviar el desglose",
    }),
    cancellation_statement_ready: (t, p, n, h) => ({
      subject: `Acción requerida: desglose de cancelación de ${q(t)}`,
      title: "Un desglose de cancelación necesita tu respuesta",
      lines: [
        `${n.Creator} proporcionó un desglose detallado para cancelar ${q(t)}: lo que se ganó y lo que se reembolsaría.`,
        "Acéptalo o dispútalo. Al aceptarlo, se cancela el resto del proyecto.",
      ],
      noteLabel: "Motivo indicado",
      note: h.reason,
      cta: "Revisar el desglose",
    }),
    cancellation_disputed: (t, p, n) => ({
      subject: `Desglose de cancelación en disputa: ${q(t)}`,
      title: `${n.Buyer} disputó tu desglose de cancelación`,
      lines: [`${n.Buyer} no aceptó tu desglose de cancelación de ${q(t)}. Made for Stream lo revisará. El proyecto no está cancelado y no se ha movido dinero.`],
      cta: "Abrir el encargo",
    }),
    conversation_started: (t, p, n) => ({
      subject: `Mensaje nuevo${n.sender ? `: ${n.sender}` : " en Made for Stream"}`,
      title: "Alguien inició una conversación contigo",
      lines: [
        `${n.sender || "Alguien"} te envió un mensaje${p.subject ? ` sobre ${q(p.subject)}` : ""}.`,
        "Abre la conversación para leerlo y responder.",
      ],
      cta: "Abrir la conversación",
    }),
    message_received: (t, p, n) => ({
      subject: `Mensaje nuevo${n.sender ? `: ${n.sender}` : " en Made for Stream"}`,
      title: "Tienes mensajes sin leer",
      lines: [
        `${n.sender || "Alguien"} te envió un mensaje${p.subject ? ` en ${q(p.subject)}` : ""} mientras no estabas.`,
        "No recibirás otro correo sobre esta conversación hasta que la leas.",
      ],
      cta: "Abrir la conversación",
    }),
    cancellation_warning: (t, p, n, h) => ({
      subject: `Advertencia de cancelación: responde a más tardar el ${h.deadline} sobre ${q(t)}`,
      title: "Recibiste una advertencia de cancelación",
      lines: [
        `${n.Other} en ${q(t)} no ha tenido noticias tuyas e inició un temporizador de cancelación${p.response_days ? ` de ${p.response_days} días` : ""}.`,
        `A menos que respondas a más tardar el ${h.deadline}, el encargo se cancelará automáticamente.`,
        "Cualquiera de estas dos cosas detiene el temporizador de inmediato: hacer lo que se pide (por ejemplo pagar, aceptar o aprobar) o enviar cualquier respuesta en el chat del encargo. No necesitas hacer ambas.",
        "Si quien no responde es el comprador, los pagos ya realizados se quedan con el creador. Si quien no responde es el creador, los montos pagados por el trabajo no alcanzado se reembolsan al comprador.",
      ],
      noteLabel: "Lo que necesita de ti",
      note: h.reason,
      cta: "Responder ahora",
    }),
    cancellation_warning_answered: (t, p, n) => ({
      subject: `Tu advertencia de cancelación recibió respuesta: ${q(t)}`,
      title: `${n.Other} respondió`,
      lines: [
        `${n.Other} en ${q(t)} respondió a tu advertencia de cancelación, con un mensaje o con el siguiente paso. El temporizador se detuvo y el encargo continúa.`,
        "Si las cosas se detienen de nuevo, puedes enviar una nueva advertencia.",
      ],
      cta: "Abrir el encargo",
    }),
    cancellation_warning_reminder: (t, p, n, h) => ({
      subject: `Último recordatorio: ${q(t)} se cancelará el ${h.deadline}`,
      title: "Una advertencia de cancelación está por vencer",
      lines: [`${q(t)} se cancelará automáticamente el ${h.deadline} a menos que respondas antes: haz lo que se pide o envía cualquier respuesta en su chat.`],
      noteLabel: "Lo que necesita de ti",
      note: h.reason,
      cta: "Responder ahora",
    }),
    request_cancelled: (t, p, n, h) => ({
      subject: `Cancelado: ${q(t)}`,
      title: "Este encargo fue cancelado",
      lines: [`${q(t)} fue cancelado y ahora está cerrado. Cualquier pago que no se haya hecho ya no se debe.`],
      noteLabel: "Motivo indicado",
      note: h.reason,
      cta: "Ver el encargo",
    }),
    off_site_receipt_requested: (t, p, n, h) => ({
      subject: `Acción requerida: confirma que recibiste el trabajo de ${q(t)}`,
      title: "¿Llegó el trabajo?",
      lines: [
        `${n.Creator} dice que envió el trabajo para ${h.subject("tu encargo")} en ${q(t)} fuera de Made for Stream${h.methods ? `, por ${h.methods}` : ""}.`,
        "Abre el encargo y confirma en el chat si llegó. El encargo no se puede completar hasta que lo hagas.",
      ],
      cta: "Confirmar la recepción",
    }),
    off_site_receipt_reminder: (t, p, n, h) => ({
      subject: `Recordatorio: confirma que recibiste el trabajo de ${q(t)}`,
      title: "Confirma que llegó el trabajo",
      lines: [
        `${n.Creator} envió el trabajo para ${h.subject("tu encargo")} en ${q(t)} fuera de Made for Stream, y la confirmación está en espera ${h.waited}.`,
        "Abre el encargo e indica en el chat si llegó. Si no llegó, dilo y se le avisará al creador.",
      ],
      cta: "Confirmar la recepción",
    }),
    off_site_receipt_confirmed: (t, p, n, h) => ({
      subject: `Recibido: tu trabajo de ${q(t)}`,
      title: "El trabajo llegó",
      lines: [
        p.recorded_by_admin
          ? `Made for Stream registró como recibido el trabajo para ${h.subject("el encargo")} en ${q(t)}. La nota está en el chat.`
          : `${n.Buyer} confirmó que recibió el trabajo para ${h.subject("el encargo")} en ${q(t)} que enviaste fuera de Made for Stream.`,
      ],
      cta: "Ver el encargo",
    }),
    off_site_receipt_missing: (t, p, n, h) => ({
      subject: `Acción requerida: el trabajo de ${q(t)} no ha llegado`,
      title: "El trabajo no ha llegado",
      lines: [
        `${n.Buyer} dice que el trabajo para ${h.subject("el encargo")} en ${q(t)}, enviado fuera de Made for Stream, no ha llegado.`,
        "Vuelve a enviarlo, o entrégalo desde la página del encargo, e indícalo en el chat. El encargo no se puede completar hasta que se confirme que llegó.",
      ],
      cta: "Abrir el encargo",
    }),
    request_completed: (t) => ({
      subject: `Completado: ${q(t)}`,
      title: "Este encargo está completo",
      lines: [`${q(t)} está completo: se aprobó la entrega final y el proyecto está cerrado. Gracias por usar Made for Stream.`],
      cta: "Ver el encargo",
    }),
  },
};
