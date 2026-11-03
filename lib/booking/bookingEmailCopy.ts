import { COMPANY_INFO } from '@/lib/constants/company';
import { bookingLocale } from '@/lib/booking/appointmentPolicy';
import type { ProEstimateBookingEmailTranslations } from '@/lib/utils/emailTemplates';

type Lang = 'en' | 'es' | 'pt';

interface MailPack {
  details: string;
  when: string;
  with: string;
  service: string;
  location: string;
  note: string;
  manage: string;
  policy: string;
  confirmSubjectCustomer: string;
  confirmSubjectPro: string;
  confirmGreetingCustomer: string;
  confirmGreetingPro: string;
  confirmBodyCustomer: (business: string) => string;
  confirmBodyPro: (customer: string) => string;
  reminderSubjectCustomer: (business: string) => string;
  reminderSubjectPro: (customer: string) => string;
  reminderGreetingCustomer: string;
  reminderGreetingPro: string;
  reminderBodyCustomer: (business: string) => string;
  reminderBodyPro: (customer: string) => string;
  cancelSubjectCustomer: (business: string) => string;
  cancelSubjectPro: (customer: string) => string;
  cancelGreetingCustomer: string;
  cancelGreetingPro: string;
  cancelBodyCustomer: (business: string, byCustomer: boolean) => string;
  cancelBodyPro: (customer: string, byCustomer: boolean) => string;
  cancelDetails: string;
  moveSubjectCustomer: (business: string) => string;
  moveSubjectPro: (customer: string) => string;
  moveGreetingCustomer: string;
  moveGreetingPro: string;
  moveBodyCustomer: (business: string, byCustomer: boolean, previous: string) => string;
  moveBodyPro: (customer: string, byCustomer: boolean, previous: string) => string;
  moveDetails: string;
}

const packs: Record<Lang, MailPack> = {
  en: {
    details: 'Appointment details',
    when: 'Date & time',
    with: 'With',
    service: 'Service',
    location: 'Address',
    note: 'Note',
    manage: 'Manage appointment',
    policy: 'You can reschedule or cancel up to 2 hours before the visit.',
    confirmSubjectCustomer: 'Your appointment is confirmed',
    confirmSubjectPro: 'New appointment',
    confirmGreetingCustomer: 'Your visit is confirmed.',
    confirmGreetingPro: 'You have a new appointment.',
    confirmBodyCustomer: (business) =>
      `You're scheduled with ${business}. We'll email a reminder the morning of your visit. A calendar file is attached.`,
    confirmBodyPro: (customer) => `${customer} booked a visit. The address is below, and a calendar file is attached.`,
    reminderSubjectCustomer: (business) => `Reminder: your visit with ${business} is today`,
    reminderSubjectPro: (customer) => `Reminder: ${customer} is visiting today`,
    reminderGreetingCustomer: 'Your visit is today.',
    reminderGreetingPro: 'You have a visit today.',
    reminderBodyCustomer: (business) => `This is a morning reminder that you're scheduled with ${business}.`,
    reminderBodyPro: (customer) => `${customer} is scheduled to visit today.`,
    cancelSubjectCustomer: (business) => `Your appointment with ${business} was cancelled`,
    cancelSubjectPro: (customer) => `Appointment cancelled – ${customer}`,
    cancelGreetingCustomer: 'This appointment was cancelled.',
    cancelGreetingPro: 'An appointment was cancelled.',
    cancelBodyCustomer: (business, byCustomer) =>
      byCustomer ? `You cancelled your appointment with ${business}.` : `${business} cancelled your appointment.`,
    cancelBodyPro: (customer, byCustomer) =>
      byCustomer ? `${customer} cancelled their appointment.` : `You cancelled ${customer}'s appointment.`,
    cancelDetails: 'Cancelled appointment',
    moveSubjectCustomer: (business) => `Your appointment with ${business} was rescheduled`,
    moveSubjectPro: (customer) => `Appointment rescheduled – ${customer}`,
    moveGreetingCustomer: 'Your appointment has a new time.',
    moveGreetingPro: 'An appointment was rescheduled.',
    moveBodyCustomer: (business, byCustomer, previous) =>
      `${byCustomer ? 'You moved' : `${business} moved`} your appointment.${previous}`,
    moveBodyPro: (customer, byCustomer, previous) =>
      `${byCustomer ? `${customer} moved their` : `You moved ${customer}'s`} appointment.${previous}`,
    moveDetails: 'New appointment',
  },
  es: {
    details: 'Detalles de la cita',
    when: 'Fecha y hora',
    with: 'Con',
    service: 'Servicio',
    location: 'Dirección',
    note: 'Nota',
    manage: 'Administrar cita',
    policy: 'Puedes cambiar o cancelar hasta 2 horas antes de la visita.',
    confirmSubjectCustomer: 'Tu cita está confirmada',
    confirmSubjectPro: 'Nueva cita',
    confirmGreetingCustomer: 'Tu visita está confirmada.',
    confirmGreetingPro: 'Tienes una cita nueva.',
    confirmBodyCustomer: (business) =>
      `Quedaste agendado con ${business}. Te enviaremos un recordatorio la mañana de la visita. Adjuntamos un archivo de calendario.`,
    confirmBodyPro: (customer) => `${customer} reservó una visita. La dirección está abajo y adjuntamos un archivo de calendario.`,
    reminderSubjectCustomer: (business) => `Recordatorio: tu visita con ${business} es hoy`,
    reminderSubjectPro: (customer) => `Recordatorio: ${customer} visita hoy`,
    reminderGreetingCustomer: 'Tu visita es hoy.',
    reminderGreetingPro: 'Tienes una visita hoy.',
    reminderBodyCustomer: (business) => `Este es un recordatorio de la mañana: tienes una cita con ${business}.`,
    reminderBodyPro: (customer) => `${customer} tiene una visita hoy.`,
    cancelSubjectCustomer: (business) => `Tu cita con ${business} fue cancelada`,
    cancelSubjectPro: (customer) => `Cita cancelada – ${customer}`,
    cancelGreetingCustomer: 'Esta cita fue cancelada.',
    cancelGreetingPro: 'Una cita fue cancelada.',
    cancelBodyCustomer: (business, byCustomer) =>
      byCustomer ? `Cancelaste tu cita con ${business}.` : `${business} canceló tu cita.`,
    cancelBodyPro: (customer, byCustomer) =>
      byCustomer ? `${customer} canceló su cita.` : `Cancelaste la cita de ${customer}.`,
    cancelDetails: 'Cita cancelada',
    moveSubjectCustomer: (business) => `Tu cita con ${business} cambió de horario`,
    moveSubjectPro: (customer) => `Cita reprogramada – ${customer}`,
    moveGreetingCustomer: 'Tu cita tiene un nuevo horario.',
    moveGreetingPro: 'Una cita fue reprogramada.',
    moveBodyCustomer: (business, byCustomer, previous) =>
      `${byCustomer ? 'Cambiaste' : `${business} cambió`} tu cita.${previous}`,
    moveBodyPro: (customer, byCustomer, previous) =>
      `${byCustomer ? `${customer} cambió su` : `Cambiaste la`} cita.${previous}`,
    moveDetails: 'Nueva cita',
  },
  pt: {
    details: 'Detalhes do horário',
    when: 'Data e hora',
    with: 'Com',
    service: 'Serviço',
    location: 'Endereço',
    note: 'Nota',
    manage: 'Gerenciar horário',
    policy: 'Você pode remarcar ou cancelar até 2 horas antes da visita.',
    confirmSubjectCustomer: 'Seu horário está confirmado',
    confirmSubjectPro: 'Novo horário',
    confirmGreetingCustomer: 'Sua visita está confirmada.',
    confirmGreetingPro: 'Você tem um novo horário.',
    confirmBodyCustomer: (business) =>
      `Você marcou com ${business}. Enviaremos um lembrete na manhã da visita. Um arquivo de calendário está anexo.`,
    confirmBodyPro: (customer) => `${customer} marcou uma visita. O endereço está abaixo e um arquivo de calendário está anexo.`,
    reminderSubjectCustomer: (business) => `Lembrete: sua visita com ${business} é hoje`,
    reminderSubjectPro: (customer) => `Lembrete: ${customer} visita hoje`,
    reminderGreetingCustomer: 'Sua visita é hoje.',
    reminderGreetingPro: 'Você tem uma visita hoje.',
    reminderBodyCustomer: (business) => `Este é um lembrete da manhã: você tem horário com ${business}.`,
    reminderBodyPro: (customer) => `${customer} está marcado para visitar hoje.`,
    cancelSubjectCustomer: (business) => `Seu horário com ${business} foi cancelado`,
    cancelSubjectPro: (customer) => `Horário cancelado – ${customer}`,
    cancelGreetingCustomer: 'Este horário foi cancelado.',
    cancelGreetingPro: 'Um horário foi cancelado.',
    cancelBodyCustomer: (business, byCustomer) =>
      byCustomer ? `Você cancelou seu horário com ${business}.` : `${business} cancelou seu horário.`,
    cancelBodyPro: (customer, byCustomer) =>
      byCustomer ? `${customer} cancelou o horário.` : `Você cancelou o horário de ${customer}.`,
    cancelDetails: 'Horário cancelado',
    moveSubjectCustomer: (business) => `Seu horário com ${business} foi remarcado`,
    moveSubjectPro: (customer) => `Horário remarcado – ${customer}`,
    moveGreetingCustomer: 'Seu horário tem um novo momento.',
    moveGreetingPro: 'Um horário foi remarcado.',
    moveBodyCustomer: (business, byCustomer, previous) =>
      `${byCustomer ? 'Você remarcou' : `${business} remarcou`} seu horário.${previous}`,
    moveBodyPro: (customer, byCustomer, previous) =>
      `${byCustomer ? `${customer} remarcou o` : `Você remarcou o`} horário.${previous}`,
    moveDetails: 'Novo horário',
  },
};

function packFor(locale: string): MailPack {
  return packs[bookingLocale(locale)];
}

function labels(pack: MailPack, lang: Lang): Pick<
  ProEstimateBookingEmailTranslations,
  'detailsLabel' | 'dateTimeLabel' | 'withLabel' | 'serviceLabel' | 'locationLabel' | 'noteLabel' | 'manageLabel' | 'policyNote' | 'footer' | 'lang'
> {
  return {
    lang,
    detailsLabel: pack.details,
    dateTimeLabel: pack.when,
    withLabel: pack.with,
    serviceLabel: pack.service,
    locationLabel: pack.location,
    noteLabel: pack.note,
    manageLabel: pack.manage,
    policyNote: pack.policy,
    footer: { companyName: COMPANY_INFO.name, contactInfo: COMPANY_INFO.email.contact },
  };
}

export function confirmationEmailCopy(locale: string, businessName: string, customerName: string): ProEstimateBookingEmailTranslations {
  const lang = bookingLocale(locale);
  const pack = packFor(locale);
  return {
    ...labels(pack, lang),
    subjectCustomer: pack.confirmSubjectCustomer,
    subjectPro: `${pack.confirmSubjectPro} – ${customerName}`,
    greetingCustomer: pack.confirmGreetingCustomer,
    greetingPro: pack.confirmGreetingPro,
    bodyCustomer: pack.confirmBodyCustomer(businessName),
    bodyPro: pack.confirmBodyPro(customerName),
  };
}

export function reminderEmailCopy(locale: string, businessName: string, customerName: string): ProEstimateBookingEmailTranslations {
  const lang = bookingLocale(locale);
  const pack = packFor(locale);
  return {
    ...labels(pack, lang),
    subjectCustomer: pack.reminderSubjectCustomer(businessName),
    subjectPro: pack.reminderSubjectPro(customerName),
    greetingCustomer: pack.reminderGreetingCustomer,
    greetingPro: pack.reminderGreetingPro,
    bodyCustomer: pack.reminderBodyCustomer(businessName),
    bodyPro: pack.reminderBodyPro(customerName),
  };
}

export function changeEmailCopy(input: {
  locale: string;
  kind: 'cancelled' | 'rescheduled';
  actor: 'customer' | 'pro';
  businessName: string;
  customerName: string;
  previousDisplay: string | null;
}): ProEstimateBookingEmailTranslations {
  const lang = bookingLocale(input.locale);
  const pack = packFor(input.locale);
  const byCustomer = input.actor === 'customer';
  const previous = input.previousDisplay
    ? lang === 'es'
      ? ` Antes era ${input.previousDisplay}.`
      : lang === 'pt'
        ? ` Antes era ${input.previousDisplay}.`
        : ` It was previously ${input.previousDisplay}.`
    : '';
  if (input.kind === 'cancelled') {
    return {
      ...labels(pack, lang),
      policyNote: undefined,
      subjectCustomer: pack.cancelSubjectCustomer(input.businessName),
      subjectPro: pack.cancelSubjectPro(input.customerName),
      greetingCustomer: pack.cancelGreetingCustomer,
      greetingPro: pack.cancelGreetingPro,
      bodyCustomer: pack.cancelBodyCustomer(input.businessName, byCustomer),
      bodyPro: pack.cancelBodyPro(input.customerName, byCustomer),
      detailsLabel: pack.cancelDetails,
    };
  }
  return {
    ...labels(pack, lang),
    subjectCustomer: pack.moveSubjectCustomer(input.businessName),
    subjectPro: pack.moveSubjectPro(input.customerName),
    greetingCustomer: pack.moveGreetingCustomer,
    greetingPro: pack.moveGreetingPro,
    bodyCustomer: pack.moveBodyCustomer(input.businessName, byCustomer, previous),
    bodyPro: pack.moveBodyPro(input.customerName, byCustomer, previous),
    detailsLabel: pack.moveDetails,
  };
}
