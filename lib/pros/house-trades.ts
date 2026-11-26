/**
 * Every kind of house pro on the Hub, from foundation to roof plus home services.
 * A pro picks one primary trade at signup. It becomes the title on their card and details page
 * ("Plumber", "House Cleaner"), decides which signup path they take, and which details tabs show.
 */

export type HouseTradeGroup =
  | 'general'
  | 'structure'
  | 'systems'
  | 'interior'
  | 'outdoor'
  | 'cleaning'
  | 'pool'
  | 'pest_inspection'
  | 'moving_repair';

/** build: project trades (Products tab allowed). service: recurring or visit services (no Products tab). */
export type HouseTradeLayout = 'build' | 'service';

/** Which account path the trade signs up through. */
export type HouseTradeRole = 'contractor' | 'handyman' | 'installer';

/** Nevada Business License only (no contractor license). Seeded in migration 155. */
export const NV_BUSINESS_LICENSE_CODE = 'NV_BUSINESS';

type Title = { en: string; es: string; pt: string };

export interface HouseTrade {
  slug: string;
  group: HouseTradeGroup;
  title: Title;
  /** Lucide icon name. */
  icon: string;
  /** Needs a Nevada contractor license. */
  licensed: boolean;
  layout: HouseTradeLayout;
  role: HouseTradeRole;
  /** License classification picked for them by default in the license step. */
  license?: string;
  /** Directory filter label (SERVICE_CATEGORIES). */
  category: string;
  /** Extra words people search for. */
  keywords?: string;
}

type Row = [slug: string, group: HouseTradeGroup, en: string, es: string, pt: string, icon: string, category: string, license?: string, keywords?: string];

const SERVICE_GROUPS = new Set<HouseTradeGroup>(['cleaning', 'pool', 'pest_inspection', 'moving_repair']);
const SERVICE_SLUGS = new Set(['tree_service', 'lawn_care']);

// [slug, group, en, es, pt, icon, directory category, default license (licensed trades), search words]
const ROWS: Row[] = [
  ['general_contractor', 'general', 'General Contractor', 'Contratista general', 'Empreiteiro geral', 'Home', 'General Contractor', 'B-2', 'builder construction'],
  ['remodeler', 'general', 'Remodeler', 'Remodelador', 'Reformador', 'Hammer', 'General Contractor', 'B-2', 'remodel renovation kitchen bath'],
  ['handyman', 'general', 'Handyman', 'Handyman', 'Faz-tudo', 'Hand', 'Handyman', undefined, 'repairs small jobs'],

  ['foundation', 'structure', 'Foundation Contractor', 'Contratista de cimientos', 'Empreiteiro de fundações', 'Box', 'Concrete', 'C-5', 'foundation slab'],
  ['concrete', 'structure', 'Concrete Contractor', 'Contratista de concreto', 'Empreiteiro de concreto', 'Box', 'Concrete', 'C-5', 'cement driveway'],
  ['framer', 'structure', 'Framer', 'Carpintero de estructuras', 'Carpinteiro de estrutura', 'Hammer', 'Carpentry', 'C-3', 'framing'],
  ['mason', 'structure', 'Mason', 'Albañil', 'Pedreiro', 'Square', 'Masonry', 'C-18', 'masonry block brick stone'],
  ['welder', 'structure', 'Welder', 'Soldador', 'Soldador', 'Fence', 'Ornamental Iron', undefined, 'welding iron gates'],
  ['insulation', 'structure', 'Insulation Installer', 'Instalador de aislamiento', 'Instalador de isolamento', 'Layers', 'Insulation', undefined, 'attic'],
  ['drywall', 'structure', 'Drywall Installer', 'Instalador de drywall', 'Instalador de drywall', 'Square', 'Drywall', 'C-4', 'sheetrock texture'],
  ['siding', 'structure', 'Siding Installer', 'Instalador de revestimiento', 'Instalador de revestimento', 'Layers', 'Siding', undefined, 'stucco'],
  ['roofer', 'structure', 'Roofer', 'Techador', 'Telhadista', 'Home', 'Roofing', 'C-15', 'roof roofing'],
  ['gutters', 'structure', 'Gutter Installer', 'Instalador de canaletas', 'Instalador de calhas', 'Droplet', 'Gutters', undefined, 'gutter'],

  ['plumber', 'systems', 'Plumber', 'Plomero', 'Encanador', 'Droplet', 'Plumbing', 'C-1', 'plumbing water heater drain'],
  ['electrician', 'systems', 'Electrician', 'Electricista', 'Eletricista', 'Zap', 'Electrical', 'C-2', 'electrical wiring'],
  ['hvac', 'systems', 'HVAC Technician', 'Técnico de HVAC', 'Técnico de climatização', 'Wind', 'HVAC', 'C-21', 'air conditioning ac heating'],
  ['solar', 'systems', 'Solar Installer', 'Instalador solar', 'Instalador solar', 'Sun', 'Solar', 'C-37', 'solar panels'],
  ['smart_home', 'systems', 'Smart Home Installer', 'Instalador de casa inteligente', 'Instalador de casa inteligente', 'Wifi', 'Smart Home', 'C-2d', 'security cameras network'],
  ['fire_protection', 'systems', 'Fire Protection', 'Protección contra incendios', 'Proteção contra incêndio', 'Shield', 'Fire Protection', 'C-41', 'sprinklers fire'],
  ['water_treatment', 'systems', 'Water Treatment', 'Tratamiento de agua', 'Tratamento de água', 'Droplet', 'Plumbing', 'C-1', 'water softener reverse osmosis'],
  ['garage_doors', 'systems', 'Garage Door Technician', 'Técnico de puertas de garaje', 'Técnico de portões de garagem', 'DoorOpen', 'Garage Doors', undefined, 'garage door opener'],

  ['painter', 'interior', 'Painter', 'Pintor', 'Pintor', 'Paintbrush', 'Painting', 'C-4', 'painting paint'],
  ['tile', 'interior', 'Tile Installer', 'Instalador de azulejos', 'Azulejista', 'Grid3x3', 'Tile', 'C-20', 'tile tiler stone backsplash'],
  ['flooring', 'interior', 'Flooring Installer', 'Instalador de pisos', 'Instalador de pisos', 'Layers', 'Flooring', 'C-16', 'floors vinyl laminate wood'],
  ['carpet_installer', 'interior', 'Carpet Installer', 'Instalador de alfombras', 'Instalador de carpetes', 'SquareStack', 'Carpet', 'C-16', 'carpet'],
  ['carpenter', 'interior', 'Carpenter', 'Carpintero', 'Carpinteiro', 'Hammer', 'Carpentry', 'C-3', 'trim doors'],
  ['cabinets', 'interior', 'Cabinet Maker', 'Ebanista', 'Marceneiro', 'Hammer', 'Carpentry', 'C-3', 'cabinets closets'],
  ['countertops', 'interior', 'Countertop Installer', 'Instalador de cubiertas', 'Instalador de bancadas', 'Square', 'Countertops', undefined, 'granite quartz countertop'],
  ['glass', 'interior', 'Glass & Mirror', 'Vidrio y espejos', 'Vidros e espelhos', 'CircleDot', 'Glass', undefined, 'shower glass mirror'],
  ['windows_doors', 'interior', 'Windows & Doors', 'Ventanas y puertas', 'Janelas e portas', 'RectangleHorizontal', 'Windows & Doors', 'C-8', 'windows doors'],
  ['interior_designer', 'interior', 'Interior Designer', 'Diseñador de interiores', 'Designer de interiores', 'Sparkles', 'Interior Design', undefined, 'design decor'],

  ['landscaper', 'outdoor', 'Landscaper', 'Paisajista', 'Paisagista', 'TreePine', 'Landscape', 'C-10', 'landscape landscaping yard'],
  ['hardscaper', 'outdoor', 'Hardscaper', 'Contratista de hardscape', 'Empreiteiro de hardscape', 'Square', 'Pavers', 'C-10', 'pavers hardscape retaining wall'],
  ['irrigation', 'outdoor', 'Irrigation Specialist', 'Especialista en riego', 'Especialista em irrigação', 'Droplet', 'Landscape', 'C-10', 'sprinkler drip'],
  ['lawn_care', 'outdoor', 'Lawn Care', 'Cuidado del césped', 'Cuidado de gramado', 'TreePine', 'Lawn Care', undefined, 'mowing yard maintenance gardener'],
  ['tree_service', 'outdoor', 'Tree Service', 'Servicio de árboles', 'Serviço de árvores', 'TreePine', 'Tree Service', undefined, 'tree trimming removal arborist'],
  ['fencing', 'outdoor', 'Fence Installer', 'Instalador de cercas', 'Instalador de cercas', 'Fence', 'Fencing', 'C-25', 'fence'],
  ['decking', 'outdoor', 'Deck Builder', 'Constructor de terrazas', 'Construtor de decks', 'Layout', 'Decking', 'C-3', 'deck'],
  ['patio_cover', 'outdoor', 'Patio Cover Builder', 'Constructor de techos de patio', 'Construtor de coberturas', 'Umbrella', 'Patio Cover', undefined, 'pergola shade'],
  ['outdoor_living', 'outdoor', 'Outdoor Living', 'Espacios exteriores', 'Áreas externas', 'Sparkles', 'Custom Outdoor Living', undefined, 'bbq island fire pit outdoor kitchen'],
  ['pool_builder', 'outdoor', 'Pool Builder', 'Constructor de piscinas', 'Construtor de piscinas', 'Waves', 'Pools & Spas', 'A-10', 'pool construction'],

  ['house_cleaner', 'cleaning', 'House Cleaner', 'Limpieza de casas', 'Limpeza residencial', 'Sparkles', 'House Cleaning', undefined, 'cleaning maid housekeeping'],
  ['move_out_cleaner', 'cleaning', 'Move-out Cleaning', 'Limpieza de mudanza', 'Limpeza pós-mudança', 'Box', 'House Cleaning', undefined, 'move in move out deep cleaning'],
  ['carpet_cleaner', 'cleaning', 'Carpet Cleaner', 'Limpieza de alfombras', 'Limpeza de carpetes', 'SquareStack', 'Carpet Cleaning', undefined, 'carpet steam'],
  ['upholstery_cleaner', 'cleaning', 'Upholstery Cleaner', 'Limpieza de tapicería', 'Limpeza de estofados', 'Sofa', 'Carpet Cleaning', undefined, 'couch sofa'],
  ['window_cleaner', 'cleaning', 'Window Cleaner', 'Limpieza de ventanas', 'Limpeza de janelas', 'RectangleHorizontal', 'Window Cleaning', undefined, 'windows screens'],
  ['pressure_washing', 'cleaning', 'Pressure Washing', 'Lavado a presión', 'Lavagem de alta pressão', 'Droplets', 'Pressure Washing', undefined, 'power washing driveway'],
  ['air_duct_cleaning', 'cleaning', 'Air Duct Cleaning', 'Limpieza de ductos', 'Limpeza de dutos', 'Wind', 'Air Duct Cleaning', undefined, 'ducts dryer vent'],
  ['solar_panel_cleaning', 'cleaning', 'Solar Panel Cleaning', 'Limpieza de paneles solares', 'Limpeza de painéis solares', 'Sun', 'Pressure Washing', undefined, 'solar panels'],

  ['pool_service', 'pool', 'Pool Service', 'Servicio de piscinas', 'Manutenção de piscinas', 'Waves', 'Pool Service', undefined, 'pool cleaning weekly chemicals'],
  ['pool_repair', 'pool', 'Pool Repair', 'Reparación de piscinas', 'Reparo de piscinas', 'Wrench', 'Pool Service', undefined, 'pump filter heater'],
  ['spa_service', 'pool', 'Spa & Hot Tub Service', 'Servicio de spas', 'Manutenção de spas', 'Waves', 'Pool Service', undefined, 'hot tub jacuzzi'],

  ['pest_control', 'pest_inspection', 'Pest Control', 'Control de plagas', 'Controle de pragas', 'Bug', 'Pest Control', undefined, 'exterminator termites scorpions'],
  ['home_inspector', 'pest_inspection', 'Home Inspector', 'Inspector de viviendas', 'Inspetor residencial', 'ClipboardCheck', 'Home Inspection', undefined, 'inspection'],
  ['mold_testing', 'pest_inspection', 'Mold & Radon Testing', 'Pruebas de moho y radón', 'Teste de mofo e radônio', 'FlaskConical', 'Home Inspection', undefined, 'mold radon air quality'],

  ['movers', 'moving_repair', 'Movers', 'Mudanzas', 'Mudanças', 'Truck', 'Moving', undefined, 'moving'],
  ['junk_removal', 'moving_repair', 'Junk Removal', 'Retiro de basura', 'Remoção de entulho', 'Trash2', 'Junk Removal', undefined, 'hauling trash'],
  ['appliance_repair', 'moving_repair', 'Appliance Repair', 'Reparación de electrodomésticos', 'Conserto de eletrodomésticos', 'Refrigerator', 'Appliance Repair', undefined, 'washer dryer fridge'],
  ['locksmith', 'moving_repair', 'Locksmith', 'Cerrajero', 'Chaveiro', 'KeyRound', 'Locksmith', undefined, 'locks keys'],
];

export const HOUSE_TRADES: HouseTrade[] = ROWS.map(([slug, group, en, es, pt, icon, category, license, keywords]) => {
  const role: HouseTradeRole = slug === 'handyman' ? 'handyman' : slug === 'installer' ? 'installer' : 'contractor';
  return {
    slug,
    group,
    title: { en, es, pt },
    icon,
    licensed: Boolean(license),
    layout: SERVICE_GROUPS.has(group) || SERVICE_SLUGS.has(slug) ? 'service' : 'build',
    role,
    license: license ?? (role === 'contractor' ? NV_BUSINESS_LICENSE_CODE : undefined),
    category,
    keywords,
  };
});

export const HOUSE_TRADE_GROUPS: HouseTradeGroup[] = [
  'general',
  'structure',
  'systems',
  'interior',
  'outdoor',
  'cleaning',
  'pool',
  'pest_inspection',
  'moving_repair',
];

const BY_SLUG = new Map(HOUSE_TRADES.map((trade) => [trade.slug, trade]));

export function houseTrade(slug: string | null | undefined): HouseTrade | null {
  return slug ? BY_SLUG.get(slug) ?? null : null;
}

export function isHouseTradeSlug(value: unknown): value is string {
  return typeof value === 'string' && BY_SLUG.has(value);
}

export function houseTradeTitle(slug: string | null | undefined, locale = 'en'): string {
  const trade = houseTrade(slug);
  if (!trade) return '';
  return trade.title[(locale as keyof Title) in trade.title ? (locale as keyof Title) : 'en'];
}

/** Keep only known slugs, no duplicates, at most `max`. */
export function cleanTradeSlugs(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isHouseTradeSlug))].slice(0, max);
}

/** Best trade for an existing pro that has no primary trade yet, from their first license code. */
const LICENSE_TO_TRADE: Record<string, string> = {
  'B-2': 'general_contractor',
  'B-7': 'general_contractor',
  'A-7': 'general_contractor',
  'C-17': 'general_contractor',
  GENERAL: 'general_contractor',
  'C-1': 'plumber',
  'C-27': 'plumber',
  'C-30': 'plumber',
  'C-2': 'electrician',
  'C-2d': 'smart_home',
  'C-3': 'carpenter',
  'C-4': 'painter',
  'C-5': 'concrete',
  'C-8': 'windows_doors',
  'C-10': 'landscaper',
  'C-15': 'roofer',
  'C-16': 'flooring',
  'C-18': 'mason',
  'C-19': 'tile',
  'C-20': 'tile',
  'C-21': 'hvac',
  'C-39': 'hvac',
  'C-25': 'fencing',
  'C-37': 'solar',
  'C-41': 'fire_protection',
  'A-10': 'pool_builder',
  HANDYMAN: 'handyman',
  INSTALLER: 'installer',
};

export function tradeFromLicense(code: string | null | undefined): string | null {
  if (!code) return null;
  return LICENSE_TO_TRADE[code] ?? LICENSE_TO_TRADE[code.toUpperCase()] ?? null;
}

/** Simple search over titles (all languages), category, and keywords. */
export function searchHouseTrades(query: string): HouseTrade[] {
  const q = query.trim().toLowerCase();
  if (!q) return HOUSE_TRADES;
  return HOUSE_TRADES.filter((trade) =>
    [trade.title.en, trade.title.es, trade.title.pt, trade.category, trade.keywords ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
}
