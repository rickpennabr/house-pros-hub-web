/**
 * Words for the ProBot morning brief and cards, in the pro's language (en, es, pt).
 * Built on the server from CRM data; the AI does not write these.
 */
export type BriefLocale = 'en' | 'es' | 'pt';

export function briefLocale(value: string | null | undefined): BriefLocale {
  return value === 'es' || value === 'pt' ? value : 'en';
}

const INTL: Record<BriefLocale, string> = { en: 'en-US', es: 'es-US', pt: 'pt-BR' };

export function intlLocale(locale: BriefLocale): string {
  return INTL[locale];
}

export function briefMoney(cents: number, locale: BriefLocale): string {
  return new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function briefDay(iso: string, locale: BriefLocale, withWeekday = true): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(INTL[locale], {
    ...(withWeekday ? { weekday: 'long' } : {}),
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

type Plural = (n: number) => string;

interface Words {
  hello: (name: string | null) => string;
  hereIs: (day: string) => string;
  today: string;
  tomorrow: string;
  todayTitle: string;
  maintenance: string;
  houses: Plural;
  visitRequest: string;
  finishing: string;
  starting: string;
  ends: (when: string) => string;
  starts: (when: string) => string;
  money: (open: string, count: number, late: string | null) => string;
  needOk: (count: number) => string;
  pushTitle: string;
  pushCards: (count: number) => string;
  pushReady: string;
  invoiceUnpaid: (c: { name: string; number: string; amount: string; late: number; before: boolean; days: number }) => string;
  estimateWaiting: (c: { name: string; number: string; amount: string; before: boolean; days: number }) => string;
  estimateAccepted: (c: { name: string; number: string; amount: string }) => string;
  projectFinishing: (c: { name: string; project: string; when: string }) => string;
  projectStarting: (c: { name: string; project: string; when: string }) => string;
  settingsLink: string;
}

export const BRIEF_WORDS: Record<BriefLocale, Words> = {
  en: {
    hello: (name) => `☀️ **Good morning${name ? `, ${name}` : ''}!**`,
    hereIs: (day) => `Here is ${day}.`,
    today: 'today',
    tomorrow: 'tomorrow',
    todayTitle: '**📅 Today**',
    maintenance: 'Maintenance',
    houses: (n) => (n === 1 ? 'house' : 'houses'),
    visitRequest: 'Estimate visit',
    finishing: '**🏁 Finishing this week**',
    starting: '**🚧 Starting this week**',
    ends: (when) => `ends ${when}`,
    starts: (when) => `starts ${when}`,
    money: (open, count, late) => `**💰 Money:** ${open} open on ${count} ${count === 1 ? 'invoice' : 'invoices'}${late ? `, ${late} of it late` : ''}.`,
    needOk: (count) => `**📋 ${count} ${count === 1 ? 'thing needs' : 'things need'} your OK** below. Nothing goes to a customer until you tap Send.`,
    pushTitle: '☀️ Good morning from ProBot',
    pushCards: (count) => `${count} ${count === 1 ? 'thing needs' : 'things need'} your OK today.`,
    pushReady: 'Your day is ready.',
    invoiceUnpaid: (c) => `${c.name} has not paid invoice ${c.number} (${c.amount}${c.late > 0 ? `, ${c.late} ${c.late === 1 ? 'day' : 'days'} late` : ''}). ${c.before ? 'Last reminder' : 'Sent'} ${c.days} days ago.`,
    estimateWaiting: (c) => `${c.name} has not answered estimate ${c.number} (${c.amount}). ${c.before ? 'Last follow-up' : 'Sent'} ${c.days} days ago.`,
    estimateAccepted: (c) => `${c.name} accepted estimate ${c.number} (${c.amount}). Start the project?`,
    projectFinishing: (c) => `${c.name}'s ${c.project} ends ${c.when}. Ready for the final invoice?`,
    projectStarting: (c) => `${c.name}'s ${c.project} starts ${c.when}. Materials and crew ready?`,
    settingsLink: 'Brief settings',
  },
  es: {
    hello: (name) => `☀️ **¡Buenos días${name ? `, ${name}` : ''}!**`,
    hereIs: (day) => `Así viene tu ${day}.`,
    today: 'hoy',
    tomorrow: 'mañana',
    todayTitle: '**📅 Hoy**',
    maintenance: 'Mantenimiento',
    houses: (n) => (n === 1 ? 'casa' : 'casas'),
    visitRequest: 'Visita de estimado',
    finishing: '**🏁 Terminan esta semana**',
    starting: '**🚧 Empiezan esta semana**',
    ends: (when) => `termina ${when}`,
    starts: (when) => `empieza ${when}`,
    money: (open, count, late) => `**💰 Dinero:** ${open} pendiente en ${count} ${count === 1 ? 'factura' : 'facturas'}${late ? `, ${late} vencido` : ''}.`,
    needOk: (count) => `**📋 ${count} ${count === 1 ? 'cosa necesita' : 'cosas necesitan'} tu OK** abajo. Nada le llega al cliente hasta que toques Enviar.`,
    pushTitle: '☀️ Buenos días de ProBot',
    pushCards: (count) => `${count} ${count === 1 ? 'cosa necesita' : 'cosas necesitan'} tu OK hoy.`,
    pushReady: 'Tu día está listo.',
    invoiceUnpaid: (c) => `${c.name} no ha pagado la factura ${c.number} (${c.amount}${c.late > 0 ? `, ${c.late} ${c.late === 1 ? 'día' : 'días'} de atraso` : ''}). ${c.before ? 'Último recordatorio' : 'Enviada'} hace ${c.days} días.`,
    estimateWaiting: (c) => `${c.name} no ha respondido el estimado ${c.number} (${c.amount}). ${c.before ? 'Último seguimiento' : 'Enviado'} hace ${c.days} días.`,
    estimateAccepted: (c) => `${c.name} aceptó el estimado ${c.number} (${c.amount}). ¿Empezamos el proyecto?`,
    projectFinishing: (c) => `${c.project} de ${c.name} termina ${c.when}. ¿Listo para la factura final?`,
    projectStarting: (c) => `${c.project} de ${c.name} empieza ${c.when}. ¿Materiales y equipo listos?`,
    settingsLink: 'Ajustes del resumen',
  },
  pt: {
    hello: (name) => `☀️ **Bom dia${name ? `, ${name}` : ''}!**`,
    hereIs: (day) => `Assim está sua ${day}.`,
    today: 'hoje',
    tomorrow: 'amanhã',
    todayTitle: '**📅 Hoje**',
    maintenance: 'Manutenção',
    houses: (n) => (n === 1 ? 'casa' : 'casas'),
    visitRequest: 'Visita de orçamento',
    finishing: '**🏁 Terminam esta semana**',
    starting: '**🚧 Começam esta semana**',
    ends: (when) => `termina ${when}`,
    starts: (when) => `começa ${when}`,
    money: (open, count, late) => `**💰 Dinheiro:** ${open} em aberto em ${count} ${count === 1 ? 'fatura' : 'faturas'}${late ? `, ${late} atrasado` : ''}.`,
    needOk: (count) => `**📋 ${count} ${count === 1 ? 'item precisa' : 'itens precisam'} do seu OK** abaixo. Nada vai para o cliente até você tocar em Enviar.`,
    pushTitle: '☀️ Bom dia do ProBot',
    pushCards: (count) => `${count} ${count === 1 ? 'item precisa' : 'itens precisam'} do seu OK hoje.`,
    pushReady: 'Seu dia está pronto.',
    invoiceUnpaid: (c) => `${c.name} não pagou a fatura ${c.number} (${c.amount}${c.late > 0 ? `, ${c.late} ${c.late === 1 ? 'dia' : 'dias'} de atraso` : ''}). ${c.before ? 'Último lembrete' : 'Enviada'} há ${c.days} dias.`,
    estimateWaiting: (c) => `${c.name} não respondeu o orçamento ${c.number} (${c.amount}). ${c.before ? 'Último contato' : 'Enviado'} há ${c.days} dias.`,
    estimateAccepted: (c) => `${c.name} aprovou o orçamento ${c.number} (${c.amount}). Começar o projeto?`,
    projectFinishing: (c) => `${c.project} de ${c.name} termina ${c.when}. Pronto para a fatura final?`,
    projectStarting: (c) => `${c.project} de ${c.name} começa ${c.when}. Materiais e equipe prontos?`,
    settingsLink: 'Ajustes do resumo',
  },
};
