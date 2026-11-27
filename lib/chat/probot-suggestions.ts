/**
 * Next-step buttons under ProBot's answer (Gemini/ChatGPT-style), picked from the tools that just ran.
 * Plain rules, no AI call. Tapping one sends it as the next message.
 */
type Lang = 'en' | 'es' | 'pt';

const TEXT: Record<string, Record<Lang, string>> = {
  owes: { en: 'Who owes me money?', es: '¿Quién me debe dinero?', pt: 'Quem me deve dinheiro?' },
  overdue: { en: 'Who is most overdue?', es: '¿Quién está más atrasado?', pt: 'Quem está mais atrasado?' },
  estimates: { en: 'Which estimates are waiting?', es: '¿Qué estimados están esperando?', pt: 'Quais orçamentos estão esperando?' },
  today: { en: "What's on my schedule today?", es: '¿Qué tengo hoy en la agenda?', pt: 'O que tenho na agenda hoje?' },
  tomorrow: { en: 'And tomorrow?', es: '¿Y mañana?', pt: 'E amanhã?' },
  projects: { en: 'Which projects finish this week?', es: '¿Qué proyectos terminan esta semana?', pt: 'Quais projetos terminam esta semana?' },
  maintenance: { en: 'Any maintenance visits this week?', es: '¿Hay visitas de mantenimiento esta semana?', pt: 'Tem visitas de manutenção esta semana?' },
  morePros: { en: 'Show me more pros', es: 'Muéstrame más pros', pt: 'Mostre mais profissionais' },
  estimate: { en: 'I want a free estimate', es: 'Quiero un estimado gratis', pt: 'Quero um orçamento grátis' },
  places: { en: 'What is going on at my places?', es: '¿Qué pasa en mis propiedades?', pt: 'O que está acontecendo nos meus imóveis?' },
  placeDocs: { en: 'Any invoices or documents on my place?', es: '¿Hay facturas o documentos en mi propiedad?', pt: 'Tem faturas ou documentos no meu imóvel?' },
  findPro: { en: 'Find a pro near me', es: 'Busca un pro cerca de mí', pt: 'Encontre um profissional perto de mim' },
};

const AFTER_TOOL: Record<string, string[]> = {
  get_customers: ['owes', 'estimates', 'today'],
  get_open_invoices: ['overdue', 'estimates', 'today'],
  get_estimates_waiting: ['owes', 'projects'],
  get_projects: ['today', 'owes'],
  get_day_schedule: ['tomorrow', 'owes', 'projects'],
  get_maintenance_on: ['today', 'tomorrow'],
  get_tax_summary: ['owes', 'projects'],
  search_pros: ['morePros', 'estimate'],
  list_categories: ['findPro', 'estimate'],
  get_pro: ['estimate', 'morePros'],
  get_my_places: ['placeDocs'],
  get_place_details: ['placeDocs'],
  get_place_timeline: ['placeDocs'],
  search_my_places: ['places'],
};

/** Up to 3 next steps after the tools that ran (none after small talk or a confirm card). */
export function nextSteps(toolNames: string[], locale: string | undefined): string[] {
  const lang: Lang = locale === 'es' || locale === 'pt' ? locale : 'en';
  const keys: string[] = [];
  for (const name of [...toolNames].reverse()) {
    for (const key of AFTER_TOOL[name] ?? []) if (!keys.includes(key)) keys.push(key);
  }
  // Do not suggest asking again what was just answered.
  const asked = new Set<string>();
  if (toolNames.includes('get_open_invoices')) asked.add('owes');
  if (toolNames.includes('get_estimates_waiting')) asked.add('estimates');
  if (toolNames.includes('get_projects')) asked.add('projects');
  return keys.filter((key) => !asked.has(key)).slice(0, 3).map((key) => TEXT[key][lang]);
}
