// The emails in French. The English lives beside each template, in
// emailTemplates.js and notificationEmails.js; `notifications` here has one
// entry per kind in NOTIFICATION_EMAILS (a test fails if one is missing).
// `h` holds what is worked out per email: h.amount, h.waited, h.deadline,
// h.reason and h.subject(fallback). Drafted 2026-10-31; to be checked by a
// French speaker with the site before French is marked ready.
const q = (text) => `« ${text} »`;
const named = (payload, fallback) => (payload.title ? q(payload.title) : fallback);

export const fr = {
  locale: "fr",
  q,
  questions: "Des questions?",
  yourProject: "votre projet",
  yourConversation: "votre discussion",
  people: {
    buyer: "l’acheteur",
    Buyer: "L’acheteur",
    aBuyer: "Un acheteur",
    creator: "le créateur",
    Creator: "Le créateur",
    other: "l’autre personne",
    Other: "L’autre personne",
  },
  waited: (days) => (days ? `depuis ${days} jours` : "depuis un moment"),
  deadlineFallback: "la date limite",
  subjectMilestone: (number, title) => `l’étape ${number} (${title})`,
  subjectDelivery: (title) => `la livraison finale (${title})`,
  subjectCommission: "cette commande",
  methods: { email: "courriel", "text message": "texto", other: "un autre moyen" },
  noReply: (days) => `Aucune réponse à un avertissement d’annulation dans un délai de ${days} jours.`,

  receipt: ({ amount, title }) => ({
    subject: `Reçu : ${amount} pour ${q(title)}`,
    title: "Paiement reçu",
    lines: [`Nous avons reçu votre paiement de ${amount} pour ${q(title)}.`],
    cta: "Voir la commande",
  }),
  firstNotice: ({ title, action, date }) => ({
    subject: `Action requise sur ${q(title)}`,
    title: "Une réponse est attendue",
    lines: [
      `Sur ${q(title)}, l’autre partie a besoin de ceci : ${action}`,
      `Veuillez répondre d’ici le ${date}. Un avis final pourrait suivre s’il n’y a pas de réponse.`,
    ],
    cta: "Ouvrir la commande",
  }),
  finalNotice: ({ title, action, date }) => ({
    subject: `Avis final : ${q(title)}`,
    title: "Avis final",
    lines: [
      `Ceci est un avis final sur ${q(title)} : ${action}`,
      `Vous avez jusqu’au ${date} pour répondre. Ensuite, l’autre partie pourra demander à Made for Stream de fermer ce projet par voie administrative.`,
    ],
    cta: "Ouvrir la commande",
  }),
  payoutReleased: ({ amount, arrivalDate }) => ({
    subject: `Versement effectué : ${amount}`,
    title: "Versement effectué",
    lines: [
      `Un versement de ${amount} a été libéré de votre solde retenu et est en route vers votre banque${
        arrivalDate ? ` (arrivée prévue : ${arrivalDate})` : ""
      }.`,
    ],
    cta: "Voir les versements",
  }),
  decision: {
    approved: ({ brand }) => ({
      subject: `Vous êtes approuvé comme créateur sur ${brand}`,
      title: "Vous êtes approuvé",
      lines: [
        `Bonne nouvelle : votre candidature de créateur a été approuvée. Bienvenue sur ${brand}.`,
        "Deux étapes avant de pouvoir accepter du travail rémunéré :",
        "1. Configurez vos versements dans les paramètres, pour pouvoir être payé. Cela se fait avec Stripe et prend quelques minutes.",
        "2. Publiez votre première annonce.",
        "Les annonces gratuites n’ont pas besoin de versements configurés.",
      ],
      noteLabel: "Une note de l’équipe d’examen",
      cta: "Configurer les versements",
    }),
    needs_changes: ({ brand }) => ({
      subject: `Votre candidature de créateur sur ${brand} doit être modifiée`,
      title: "Votre candidature doit être modifiée",
      lines: [
        "Nous avons examiné votre candidature de créateur, et quelques changements sont nécessaires avant de pouvoir l’approuver.",
        "Mettez votre candidature à jour et envoyez-la de nouveau. Vous n’avez pas à tout recommencer.",
      ],
      noteLabel: "Ce qu’il faut changer",
      cta: "Mettre à jour la candidature",
    }),
    rejected: ({ brand, support }) => ({
      subject: `Du nouveau sur votre candidature de créateur sur ${brand}`,
      title: "Du nouveau sur votre candidature",
      lines: [
        `Merci d’avoir proposé votre candidature de créateur sur ${brand}. Après examen, nous ne pouvons pas l’approuver pour le moment.`,
        `Vous pouvez toujours utiliser ${brand} comme acheteur. Si vous pensez que cette décision est une erreur, écrivez à ${support}.`,
      ],
      noteLabel: "Raison",
      cta: "Voir la candidature",
    }),
  },

  notifications: {
    request_received: (t, p, n) => ({
      subject: `Nouvelle demande de commande : ${q(t)}`,
      title: "Vous avez une nouvelle demande de commande",
      lines: [
        `${n.aBuyer} vous a envoyé une demande de commande, ${q(t)}.`,
        "Ouvrez-la pour lire les détails, poser des questions dans la discussion, et accepter ou refuser.",
      ],
      cta: "Examiner la demande",
    }),
    request_reminder: (t, p, n, h) => ({
      subject: `Toujours en attente de votre réponse : ${q(t)}`,
      title: "Une demande de commande attend votre réponse",
      lines: [`${q(t)} attend ${h.waited}. ${n.Buyer} ne peut pas avancer tant que vous n’acceptez ou ne refusez pas.`],
      cta: "Examiner la demande",
    }),
    request_accepted: (t, p, n) => ({
      subject: `Acceptée : ${q(t)}`,
      title: `${n.Creator} a accepté votre demande de commande`,
      lines: [
        `Bonne nouvelle : ${n.creator} a accepté ${q(t)}.`,
        `Ensuite, ${n.creator} vous enverra une entente du projet avec la portée, le prix, l’échéancier et le calendrier de paiement. Vous recevrez un autre courriel lorsqu’elle sera prête. Rien ne commence et rien n’est facturé tant que vous n’avez pas examiné et accepté cette entente.`,
      ],
      cta: "Ouvrir la commande",
    }),
    request_declined: (t, p, n, h) => ({
      subject: `Refusée : ${q(t)}`,
      title: `${n.Creator} a refusé votre demande de commande`,
      lines: [`${n.Creator} ne peut pas prendre en charge ${q(t)}. Rien ne vous a été facturé.`],
      noteLabel: "Raison indiquée",
      note: h.reason,
      cta: "Voir la commande",
    }),
    request_withdrawn: (t, p, n) => ({
      subject: `Plus en attente : ${q(t)}`,
      title: "Une demande de commande a été archivée",
      lines: [`La demande de commande ${q(t)} a été archivée par ${n.other} avant d’être acceptée. Vous n’avez rien d’autre à faire.`],
      cta: "Voir la commande",
    }),
    agreement_sent: (t, p, n) => ({
      subject: `Action requise : examinez l’entente pour ${q(t)}`,
      title: "Votre entente du projet est prête à être examinée",
      lines: [
        `${n.Creator} a envoyé l’entente du projet pour ${q(t)}.`,
        "Veuillez lire la portée, le prix, l’échéancier et le calendrier de paiement, confirmer chaque section au fil de votre lecture, puis accepter ou refuser. Le travail ne peut pas commencer tant que vous n’avez pas accepté.",
      ],
      cta: "Examiner l’entente",
    }),
    agreement_reminder: (t, p, n, h) => ({
      subject: `Rappel : l’entente pour ${q(t)} attend votre réponse`,
      title: "Votre entente du projet est toujours en attente",
      lines: [`L’entente pour ${q(t)} attend ${h.waited}. ${n.Creator} ne peut pas commencer tant que vous n’acceptez ou ne refusez pas.`],
      cta: "Examiner l’entente",
    }),
    agreement_accepted: (t, p, n) => ({
      subject: `Entente acceptée : ${q(t)}`,
      title: `${n.Buyer} a accepté votre entente du projet`,
      lines: [
        `${n.Buyer} a lu, confirmé et accepté l’entente pour ${q(t)}.`,
        "Si l’entente prévoit un paiement avant le début du travail, attendez le courriel de paiement avant de commencer. Sinon, vous pouvez commencer maintenant.",
      ],
      cta: "Ouvrir la commande",
    }),
    agreement_declined: (t, p, n) => ({
      subject: `Entente refusée : ${q(t)}`,
      title: `${n.Buyer} a refusé votre entente du projet`,
      lines: [`${n.Buyer} a refusé l’entente pour ${q(t)}. Vous pouvez en parler dans la discussion et envoyer une entente révisée.`],
      cta: "Ouvrir la commande",
    }),
    change_order_sent: (t, p, n) => ({
      subject: `Action requise : une modification de ${q(t)}`,
      title: `${n.Creator} a proposé une modification`,
      lines: [
        `${n.Creator} a proposé ${named(p, "une modification")} sur ${q(t)}. Elle peut changer la portée, le prix, l’échéancier ou les livrables.`,
        "Rien ne change tant que vous ne l’acceptez pas. Veuillez l’examiner, puis accepter ou refuser.",
      ],
      cta: "Examiner la modification",
    }),
    change_order_accepted: (t, p, n) => ({
      subject: `Modification acceptée : ${q(t)}`,
      title: `${n.Buyer} a accepté votre modification`,
      lines: [`${n.Buyer} a accepté ${named(p, "votre modification")} sur ${q(t)}. Si le prix a augmenté, le paiement de la différence a été demandé.`],
      cta: "Ouvrir la commande",
    }),
    change_order_declined: (t, p, n) => ({
      subject: `Modification refusée : ${q(t)}`,
      title: `${n.Buyer} a refusé votre modification`,
      lines: [`${n.Buyer} a refusé ${named(p, "votre modification")} sur ${q(t)}. L’entente d’origine continue de s’appliquer.`],
      cta: "Ouvrir la commande",
    }),
    payment_required: (t, p, n, h) => ({
      subject: `Paiement dû pour ${q(t)}`,
      title: "Un paiement est dû",
      lines: [
        `${named(p, "Un paiement")} pour ${q(t)} est prêt à être payé${h.amount ? ` : ${h.amount}` : ""}.`,
        "Le projet attend ce paiement. Vous payez dans la devise du créateur, sur une page Stripe sécurisée.",
      ],
      cta: "Payer maintenant",
    }),
    payment_reminder: (t, p, n, h) => ({
      subject: `Rappel : paiement dû pour ${q(t)}`,
      title: "Un paiement est toujours en attente",
      lines: [
        `${named(p, "Un paiement")} pour ${q(t)}${h.amount ? ` (${h.amount})` : ""} est impayé ${h.waited}.`,
        `${n.Creator} attend ce paiement. Si quelque chose ne va pas, répondez dans la discussion de la commande pour que ${n.creator} le sache.`,
      ],
      cta: "Payer maintenant",
    }),
    payment_received: (t, p, n, h) => ({
      subject: `Paiement reçu pour ${q(t)}`,
      title: `${n.Buyer} a payé`,
      lines: [
        `${n.Buyer} a payé ${named(p, "un paiement")} pour ${q(t)}${h.amount ? ` : ${h.amount} avant les frais` : ""}.`,
        "Vous pouvez passer à la prochaine étape du projet.",
      ],
      cta: "Ouvrir la commande",
    }),
    payment_refunded: (t, p) => ({
      subject: `Remboursement sur ${q(t)}`,
      title: "Un paiement a été remboursé",
      lines: [`Un remboursement a été fait sur ${named(p, "un paiement")} pour ${q(t)}. Ouvrez la commande pour voir le montant.`],
      cta: "Voir la commande",
    }),
    payment_disputed: (t, p) => ({
      subject: `Paiement contesté : ${q(t)}`,
      title: "Un paiement est contesté",
      lines: [`La banque de l’acheteur a ouvert un litige sur ${named(p, "un paiement")} pour ${q(t)}. Made for Stream communiquera avec vous au sujet de ce dont nous avons besoin.`],
      cta: "Voir la commande",
    }),
    milestone_submitted: (t, p, n) => ({
      subject: `Action requise : examinez ${named(p, "une étape")} sur ${q(t)}`,
      title: "Une étape est prête à être examinée",
      lines: [
        `${n.Creator} a soumis ${named(p, "une étape")} sur ${q(t)}.`,
        "Veuillez examiner le travail, puis l’approuver ou demander des révisions. L’approbation rend le paiement de cette étape exigible.",
      ],
      cta: "Examiner l’étape",
    }),
    milestone_review_reminder: (t, p, n, h) => ({
      subject: `Rappel : ${named(p, "une étape")} sur ${q(t)} attend votre examen`,
      title: "Une étape attend toujours votre examen",
      lines: [`${named(p, "Une étape")} sur ${q(t)} attend ${h.waited}. ${n.Creator} ne peut pas continuer tant que vous ne l’approuvez pas ou ne demandez pas de révisions.`],
      cta: "Examiner l’étape",
    }),
    milestone_approved: (t, p, n) => ({
      subject: `Étape approuvée : ${q(t)}`,
      title: `${n.Buyer} a approuvé votre étape`,
      lines: [`${n.Buyer} a approuvé ${named(p, "votre étape")} sur ${q(t)}, et son paiement a été demandé. Vous recevrez un courriel lorsqu’il sera reçu.`],
      cta: "Ouvrir la commande",
    }),
    milestone_revision_requested: (t, p, n, h) => ({
      subject: `Révisions demandées : ${q(t)}`,
      title: `${n.Buyer} a demandé des révisions`,
      lines: [`${n.Buyer} a demandé des changements à ${named(p, "votre étape")} sur ${q(t)}.`],
      noteLabel: "Ce qui a été demandé",
      note: h.reason,
      cta: "Ouvrir la commande",
    }),
    final_delivery_submitted: (t, p, n) => ({
      subject: `Action requise : votre livraison finale pour ${q(t)}`,
      title: "Votre livraison finale est prête à être examinée",
      lines: [
        `${n.Creator} a soumis la livraison finale pour ${q(t)}.`,
        "Veuillez l’examiner, puis l’approuver ou demander des révisions. L’approbation termine le projet.",
      ],
      cta: "Examiner la livraison",
    }),
    final_delivery_review_reminder: (t, p, n, h) => ({
      subject: `Rappel : la livraison finale pour ${q(t)} attend votre examen`,
      title: "Votre livraison finale est toujours en attente",
      lines: [`La livraison finale pour ${q(t)} attend ${h.waited}. Veuillez l’approuver ou demander des révisions.`],
      cta: "Examiner la livraison",
    }),
    final_delivery_revision_requested: (t, p, n, h) => ({
      subject: `Révisions demandées sur la livraison finale : ${q(t)}`,
      title: `${n.Buyer} a demandé des révisions à la livraison finale`,
      lines: [`${n.Buyer} a demandé des changements à la livraison finale pour ${q(t)}.`],
      noteLabel: "Ce qui a été demandé",
      note: h.reason,
      cta: "Ouvrir la commande",
    }),
    progress_update_posted: (t, p, n) => ({
      subject: `Mise à jour sur ${q(t)}`,
      title: `${n.Creator} a publié une mise à jour`,
      lines: [`${n.Creator} a publié ${named(p, "une mise à jour")} sur ${q(t)}.`],
      cta: "Lire la mise à jour",
    }),
    progress_update_overdue: (t, p, n) => ({
      subject: `Une mise à jour est due sur ${q(t)}`,
      title: "Une mise à jour de progression est en retard",
      lines: [
        `Votre entente pour ${q(t)} prévoit des mises à jour régulières, et l’une d’elles est maintenant en retard.`,
        `Publiez une courte mise à jour pour que ${n.buyer} sache où en sont les choses. Les mises à jour manquées font partie de ce qu’un acheteur peut signaler si un projet est au point mort.`,
      ],
      cta: "Publier une mise à jour",
    }),
    cancellation_statement_needed: (t, p, n, h) => ({
      subject: `Action requise : demande d’annulation de ${q(t)}`,
      title: `${n.Buyer} a demandé l’annulation`,
      lines: [
        `${n.Buyer} a demandé d’annuler ${q(t)} après avoir payé. Rien n’est annulé pour l’instant.`,
        `Veuillez soumettre votre relevé détaillé du travail fait pour chaque paiement, pour que ${n.buyer} puisse l’accepter ou le contester.`,
      ],
      noteLabel: "Raison indiquée",
      note: h.reason,
      cta: "Soumettre le relevé",
    }),
    cancellation_statement_ready: (t, p, n, h) => ({
      subject: `Action requise : relevé d’annulation pour ${q(t)}`,
      title: "Un relevé d’annulation attend votre réponse",
      lines: [
        `${n.Creator} a fourni un relevé détaillé pour l’annulation de ${q(t)} : ce qui a été gagné, et ce qui serait remboursé.`,
        "Veuillez l’accepter ou le contester. L’accepter annule le reste du projet.",
      ],
      noteLabel: "Raison indiquée",
      note: h.reason,
      cta: "Examiner le relevé",
    }),
    cancellation_disputed: (t, p, n) => ({
      subject: `Relevé d’annulation contesté : ${q(t)}`,
      title: `${n.Buyer} a contesté votre relevé d’annulation`,
      lines: [`${n.Buyer} n’a pas accepté votre relevé d’annulation pour ${q(t)}. Made for Stream l’examinera. Le projet n’est pas annulé et aucun argent n’a bougé.`],
      cta: "Ouvrir la commande",
    }),
    conversation_started: (t, p, n) => ({
      subject: `Nouveau message${n.sender ? ` de ${n.sender}` : " sur Made for Stream"}`,
      title: "Quelqu’un a commencé une discussion avec vous",
      lines: [
        `${n.sender || "Quelqu’un"} vous a envoyé un message${p.subject ? ` au sujet de ${q(p.subject)}` : ""}.`,
        "Ouvrez la discussion pour le lire et répondre.",
      ],
      cta: "Ouvrir la discussion",
    }),
    message_received: (t, p, n) => ({
      subject: `Nouveau message${n.sender ? ` de ${n.sender}` : " sur Made for Stream"}`,
      title: "Vous avez des messages non lus",
      lines: [
        `${n.sender || "Quelqu’un"} vous a envoyé un message${p.subject ? ` dans ${q(p.subject)}` : ""} pendant votre absence.`,
        "Vous ne recevrez pas d’autre courriel sur cette discussion tant que vous ne l’aurez pas lue.",
      ],
      cta: "Ouvrir la discussion",
    }),
    cancellation_warning: (t, p, n, h) => ({
      subject: `Avertissement d’annulation : répondez d’ici le ${h.deadline} au sujet de ${q(t)}`,
      title: "Vous avez reçu un avertissement d’annulation",
      lines: [
        `${n.Other} sur ${q(t)} n’a pas eu de vos nouvelles et a lancé un délai d’annulation${p.response_days ? ` de ${p.response_days} jours` : ""}.`,
        `À moins que vous répondiez d’ici le ${h.deadline}, la commande sera annulée automatiquement.`,
        "L’une de ces deux choses arrête le délai immédiatement : faire ce qui est demandé (par exemple payer, accepter ou approuver), ou envoyer une réponse dans la discussion de la commande. Vous n’avez pas à faire les deux.",
        "Si c’est l’acheteur qui ne répond pas, les paiements déjà faits restent au créateur. Si c’est le créateur qui ne répond pas, les montants payés pour le travail non atteint sont remboursés à l’acheteur.",
      ],
      noteLabel: "Ce dont l’autre personne a besoin",
      note: h.reason,
      cta: "Répondre maintenant",
    }),
    cancellation_warning_answered: (t, p, n) => ({
      subject: `Votre avertissement d’annulation a reçu une réponse : ${q(t)}`,
      title: `${n.Other} a répondu`,
      lines: [
        `${n.Other} sur ${q(t)} a répondu à votre avertissement d’annulation, par un message ou par la prochaine étape. Le délai s’est arrêté et la commande continue.`,
        "Si les choses bloquent de nouveau, vous pouvez envoyer un nouvel avertissement.",
      ],
      cta: "Ouvrir la commande",
    }),
    cancellation_warning_reminder: (t, p, n, h) => ({
      subject: `Dernier rappel : ${q(t)} sera annulée le ${h.deadline}`,
      title: "Un avertissement d’annulation arrive à échéance",
      lines: [`${q(t)} sera annulée automatiquement le ${h.deadline}, à moins que vous répondiez avant : faites ce qui est demandé, ou envoyez une réponse dans sa discussion.`],
      noteLabel: "Ce dont l’autre personne a besoin",
      note: h.reason,
      cta: "Répondre maintenant",
    }),
    request_cancelled: (t, p, n, h) => ({
      subject: `Annulée : ${q(t)}`,
      title: "Cette commande a été annulée",
      lines: [`${q(t)} a été annulée et est maintenant fermée. Tout paiement qui n’avait pas été fait n’est plus dû.`],
      noteLabel: "Raison indiquée",
      note: h.reason,
      cta: "Voir la commande",
    }),
    off_site_receipt_requested: (t, p, n, h) => ({
      subject: `Action requise : confirmez avoir reçu le travail pour ${q(t)}`,
      title: "Le travail est-il arrivé?",
      lines: [
        `${n.Creator} dit avoir envoyé le travail pour ${h.subject("votre commande")} sur ${q(t)} hors de Made for Stream${h.methods ? `, par ${h.methods}` : ""}.`,
        "Veuillez ouvrir la commande et confirmer dans la discussion si le travail est arrivé. La commande ne peut pas être terminée tant que vous ne l’avez pas fait.",
      ],
      cta: "Confirmer la réception",
    }),
    off_site_receipt_reminder: (t, p, n, h) => ({
      subject: `Rappel : confirmez avoir reçu le travail pour ${q(t)}`,
      title: "Veuillez confirmer que le travail est arrivé",
      lines: [
        `${n.Creator} a envoyé le travail pour ${h.subject("votre commande")} sur ${q(t)} hors de Made for Stream, et la confirmation est attendue ${h.waited}.`,
        "Ouvrez la commande et indiquez dans la discussion si le travail est arrivé. S’il n’est pas arrivé, dites-le et le créateur en sera informé.",
      ],
      cta: "Confirmer la réception",
    }),
    off_site_receipt_confirmed: (t, p, n, h) => ({
      subject: `Reçu : votre travail pour ${q(t)}`,
      title: "Le travail est arrivé",
      lines: [
        p.recorded_by_admin
          ? `Made for Stream a enregistré le travail pour ${h.subject("la commande")} sur ${q(t)} comme reçu. La note se trouve dans la discussion.`
          : `${n.Buyer} a confirmé avoir reçu le travail pour ${h.subject("la commande")} sur ${q(t)} que vous avez envoyé hors de Made for Stream.`,
      ],
      cta: "Voir la commande",
    }),
    off_site_receipt_missing: (t, p, n, h) => ({
      subject: `Action requise : le travail pour ${q(t)} n’est pas arrivé`,
      title: "Le travail n’est pas arrivé",
      lines: [
        `${n.Buyer} indique que le travail pour ${h.subject("la commande")} sur ${q(t)}, envoyé hors de Made for Stream, n’est pas arrivé.`,
        "Renvoyez-le, ou livrez-le depuis la page de la commande, et indiquez-le dans la discussion. La commande ne peut pas être terminée tant que la réception n’est pas confirmée.",
      ],
      cta: "Ouvrir la commande",
    }),
    request_completed: (t) => ({
      subject: `Terminée : ${q(t)}`,
      title: "Cette commande est terminée",
      lines: [`${q(t)} est terminée : la livraison finale a été approuvée et le projet est fermé. Merci d’utiliser Made for Stream.`],
      cta: "Voir la commande",
    }),
  },
};
