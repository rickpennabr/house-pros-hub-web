import { AGENT_RULE } from '@/lib/agent/constants';

const estimateProperties = {
  firstName: { type: 'string', description: 'Homeowner given name.' },
  lastName: { type: 'string', description: 'Homeowner family name.' },
  email: { type: 'string', format: 'email', description: 'Where House Pros Hub sends the copy of this request.' },
  phone: { type: 'string', description: 'US phone, for example 702-555-0123.' },
  streetAddress: { type: 'string', description: 'Job street address.' },
  city: { type: 'string', description: 'Job city, for example Henderson.' },
  state: { type: 'string', description: 'Two-letter state code, for example NV.' },
  zipCode: { type: 'string', description: 'US ZIP code.' },
  apartment: { type: 'string' },
  projectType: {
    type: 'string',
    enum: ['new_construction', 'renovation', 'repair', 'remodel', 'other'],
    description: 'Kind of job. Use projectTypeOther when this is other.',
  },
  projectTypeOther: { type: 'string' },
  requiresHoaApproval: { type: 'boolean', description: 'True when the homeowner says an HOA must approve the work.' },
  wants3D: { type: 'boolean', description: 'True when the homeowner asked for a 3D design. This does not add a price.' },
  trades: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    description: 'Trades the homeowner named, such as pavers or drainage. At least one.',
  },
  projectDescription: { type: 'string', description: 'What the homeowner said about the yard. Empty string is allowed.' },
  projectImages: {
    type: 'array',
    items: { type: 'string', format: 'uri' },
    maxItems: 5,
    description: 'Public image URLs the homeowner already has. Maximum 5.',
  },
  budgetRange: {
    type: 'string',
    enum: ['under_5k', '5k_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k', 'not_sure'],
    description: 'Range the homeowner chose. Do not turn this into a quote.',
  },
  timeline: {
    type: 'string',
    enum: ['asap', 'within_month', '1_3_months', '3_6_months', '6_plus_months', 'flexible'],
    description: 'When the homeowner hopes to start. Not a promised start date.',
  },
  preferredContactMethod: {
    type: 'string',
    enum: ['phone', 'email', 'text', 'either'],
  },
  additionalNotes: { type: 'string' },
  idempotencyKey: {
    type: 'string',
    description: 'Optional. Send the same value on retry so a second estimate is not created. Letters, numbers, and . _ : - up to 128 characters.',
  },
} as const;

/**
 * OpenAPI 3.1 description of the agent API.
 * Operation ids match the MCP tool names.
 */
export function buildOpenApiDocument(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'House Pros Hub agent API',
      version: '1.0.0',
      description: AGENT_RULE,
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Agent API key created by a House Pros Hub admin. Prefix hph_.',
        },
      },
    },
    paths: {
      '/api/agent/v1/categories': {
        get: {
          operationId: 'list_categories',
          summary: 'List directory categories that currently have an active pro.',
          responses: { '200': { description: 'Category labels.' } },
        },
      },
      '/api/agent/v1/pros': {
        get: {
          operationId: 'search_pros',
          summary: 'Search active pros. Does not assign a pro to a job.',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Name, trade, or service. Do not put the city here.' },
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category from list_categories.' },
            { name: 'city', in: 'query', schema: { type: 'string' }, description: 'City the job is in. Matched to the pro listing city.' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          ],
          responses: { '200': { description: 'Matching pros and the marketplace rules.' } },
        },
      },
      '/api/agent/v1/pros/{id}': {
        get: {
          operationId: 'get_pro',
          summary: 'Read one active pro by id or slug.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Business id or slug from search_pros.' },
          ],
          responses: { '200': { description: 'The pro.' }, '404': { description: 'No active pro with that id or slug.' } },
        },
      },
      '/api/agent/v1/estimates': {
        post: {
          operationId: 'create_estimate',
          summary: 'Open an estimate request. This does not price the job.',
          parameters: [
            {
              name: 'Idempotency-Key',
              in: 'header',
              schema: { type: 'string' },
              description: 'Same effect as body idempotencyKey. Header wins when both are sent.',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
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
                  properties: estimateProperties,
                },
              },
            },
          },
          responses: {
            '200': { description: 'Request stored. Show messageForUser to the homeowner.' },
            '400': { description: 'The brief is missing a required field or uses a value outside the enums.' },
          },
        },
      },
      '/api/agent/v1/estimates/{id}': {
        get: {
          operationId: 'get_estimate',
          summary: 'Read an estimate this app created.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Status received, plus messageForUser.' },
            '404': { description: 'Unknown id, or the estimate belongs to another app.' },
          },
        },
      },
    },
  };
}
