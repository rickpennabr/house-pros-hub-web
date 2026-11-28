import { AGENT_RULE } from '@/lib/agent/constants';
import { presentPro, type AgentPro } from '@/lib/agent/present';
import {
  clampDirectoryPage,
  findProfileMentions,
  getCachedDirectoryCategories,
  getPublicBusiness,
  searchBusinessesForAgents,
} from '@/lib/data/businessDirectory';

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'list_categories',
    description: 'List directory categories that currently have an active pro. Use one of these values as category in search_pros.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'search_pros',
    description:
      'Find active pros by trade, category, or city. Share the profile with the homeowner. This does not assign a pro. Filing an estimate is a separate tool.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        search: { type: 'string', description: 'Name, trade, or service. Example: pavers. Do not put a city here.' },
        category: { type: 'string', description: 'Label from list_categories.' },
        city: { type: 'string', description: 'City the job is in, such as Henderson.' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
        offset: { type: 'integer', minimum: 0 },
      },
    },
  },
  {
    name: 'get_pro',
    description: 'Read one active pro by the id or slug returned from search_pros. Licenses are the numbers the pro listed.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Business id or slug.' },
      },
    },
  },
  {
    name: 'create_estimate',
    description:
      'Open a free estimate request for a homeowner. House Pros Hub does not price the job and does not promise a pro will accept it. Show messageForUser to the homeowner unchanged. budgetRange is the range the homeowner chose.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'firstName',
        'lastName',
        'email',
        'phone',
        'streetAddress',
        'city',
        'state',
        'zipCode',
        'projectType',
        'requiresHoaApproval',
        'wants3D',
        'trades',
        'budgetRange',
        'timeline',
        'preferredContactMethod',
      ],
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string', description: 'US phone, for example 702-555-0123.' },
        streetAddress: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string', description: 'Two-letter state code.' },
        zipCode: { type: 'string' },
        apartment: { type: 'string' },
        projectType: { type: 'string', enum: ['new_construction', 'renovation', 'repair', 'remodel', 'addition_extension', 'maintenance', 'other'] },
        projectTypeOther: { type: 'string' },
        requiresHoaApproval: { type: 'boolean' },
        wants3D: { type: 'boolean' },
        trades: { type: 'array', items: { type: 'string' }, minItems: 1 },
        projectDescription: { type: 'string' },
        projectImages: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        budgetRange: {
          type: 'string',
          enum: ['under_5k', '5k_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k', 'not_sure'],
        },
        timeline: {
          type: 'string',
          enum: ['asap', 'within_month', '1_3_months', '3_6_months', '6_plus_months', 'flexible'],
        },
        preferredContactMethod: { type: 'string', enum: ['phone', 'email', 'text', 'either'] },
        additionalNotes: { type: 'string' },
        idempotencyKey: {
          type: 'string',
          description: 'Repeat this value to retry without creating a second request.',
        },
      },
    },
  },
  {
    name: 'get_estimate',
    description: "Read an estimate this app created. Status stays received until a pro contacts the homeowner. This app cannot see another app's requests.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'estimateId from create_estimate.' },
      },
    },
  },
];

export const PROAGENT_TOOL_NAMES = ['list_categories', 'search_pros', 'get_pro', 'create_estimate'] as const;

export interface OpenAiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Tool list for the in-chat loop. create_estimate prepares a draft. It does not file. */
export function proAgentOpenAiTools(): OpenAiTool[] {
  return AGENT_TOOLS.filter((tool) => (PROAGENT_TOOL_NAMES as readonly string[]).includes(tool.name)).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description:
        tool.name === 'create_estimate'
          ? 'Prepare a free estimate request. This does not file it. The homeowner must tap Confirm. Call this only after the homeowner has given every required field. Do not invent a name, email, phone, address, budget, or timeline.'
          : tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

export interface DirectoryToolResult {
  data: unknown;
  isError: boolean;
}

/** Read tools shared by MCP and ProAgent. create_estimate is not executed here. */
export async function runDirectoryTool(
  name: string,
  args: Record<string, unknown>,
  origin: string
): Promise<DirectoryToolResult | null> {
  if (name === 'list_categories') {
    const categories = await getCachedDirectoryCategories();
    return { data: { categories, rules: AGENT_RULE }, isError: false };
  }

  if (name === 'search_pros') {
    const requestedLimit = typeof args.limit === 'number' ? args.limit : 12;
    const requestedOffset = typeof args.offset === 'number' ? args.offset : 0;
    const { limit, offset } = clampDirectoryPage(requestedLimit, requestedOffset);
    const search = typeof args.search === 'string' ? args.search : '';
    const category = typeof args.category === 'string' ? args.category : '';
    const city = typeof args.city === 'string' ? args.city : '';
    const [page, profile] = await Promise.all([
      searchBusinessesForAgents({ limit, offset, search, category, city }),
      // A trade the Hub may not list (plumbing): pros of another trade who mention it on their profile.
      offset === 0 && (search || category)
        ? findProfileMentions(search || category, city).catch(() => null)
        : Promise.resolve(null),
    ]);
    const mentionIds = new Set((profile?.mentions ?? []).map((card) => card.id));
    // Listed pros for the trade only: a handyman who mentions plumbing is not a plumber.
    const pros = page.businesses.filter((business) => !mentionIds.has(business.id));
    const profileMentions = (profile?.trade.length ?? 0) === 0 ? (profile?.mentions ?? []).slice(0, 3) : [];
    return {
      data: {
        pros: pros.map((business) => presentPro(business, origin)),
        ...(profileMentions.length > 0
          ? {
              profileMentions: profileMentions.map((business) => presentPro(business, origin)),
              profileMentionsNote:
                'No pro is listed for this trade at the Hub. These pros are another trade, but their own profile mentions it. Do not call them a pro of this trade. Say they mention it on their profile: for a small repair the homeowner can call them; for a bigger job, offer a free estimate so the Hub finds a pro.',
            }
          : {}),
        rules: AGENT_RULE,
        pagination: {
          limit,
          offset,
          count: page.businesses.length,
          total: page.total,
          hasMore: offset + page.businesses.length < page.total,
          cityMatchTruncated: page.cityMatchTruncated,
        },
      },
      isError: false,
    };
  }

  if (name === 'get_pro') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return { data: { error: 'id is required' }, isError: true };
    const business = await getPublicBusiness(id);
    if (!business) return { data: { error: 'Pro not found' }, isError: true };
    return { data: { pro: presentPro(business, origin), rules: AGENT_RULE }, isError: false };
  }

  return null;
}

export function prosFromToolData(data: unknown): AgentPro[] {
  if (!data || typeof data !== 'object') return [];
  const record = data as { pros?: unknown; pro?: unknown; profileMentions?: unknown };
  if (Array.isArray(record.pros)) {
    const mentions = Array.isArray(record.profileMentions) ? record.profileMentions : [];
    return [...record.pros, ...mentions].filter((pro): pro is AgentPro => Boolean(pro) && typeof pro === 'object' && 'id' in pro && 'name' in pro);
  }
  if (record.pro && typeof record.pro === 'object' && 'id' in record.pro && 'name' in record.pro) {
    return [record.pro as AgentPro];
  }
  return [];
}
