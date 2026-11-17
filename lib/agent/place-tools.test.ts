import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPlaceTool, placeOpenAiTools, rankChunks, PLACE_TOOL_NAMES } from './place-tools';
import { AGENT_TOOLS, proAgentOpenAiTools } from './tools';

const chunk = (kind: string, text: string, date: string | null = null) => ({
  placeId: 'p1',
  placeName: 'Home',
  kind,
  text,
  date,
});

describe('place tools', () => {
  it('never exposes homeowner place tools to MCP/REST apps', () => {
    const shared = new Set(AGENT_TOOLS.map((tool) => tool.name));
    for (const name of PLACE_TOOL_NAMES) assert.ok(!shared.has(name), `${name} leaked into AGENT_TOOLS`);
    const anonymous = new Set(proAgentOpenAiTools().map((tool) => tool.function.name));
    for (const name of PLACE_TOOL_NAMES) assert.ok(!anonymous.has(name), `${name} offered without sign-in`);
  });

  it('describes approve_estimate as a card, not an approval', () => {
    const approve = placeOpenAiTools().find((tool) => tool.function.name === 'approve_estimate');
    assert.ok(approve);
    assert.match(approve.function.description, /does NOT approve/);
    assert.ok(isPlaceTool('approve_estimate'));
    assert.ok(!isPlaceTool('create_estimate'));
  });

  it('ranks the records that share the most keywords', () => {
    const chunks = [
      chunk('invoice', 'Invoice 1042 · sent · Desert Pavers · 1200.00 USD · balance 600.00 USD'),
      chunk('maintenance', 'Maintenance Irrigation check · monthly · next visit 2026-12-01'),
      chunk('estimate', 'Estimate 77 · sent · Desert Pavers · backyard pavers · deposit 500.00 USD'),
    ];
    const top = rankChunks('pavers deposit', chunks);
    assert.equal(top[0]?.kind, 'estimate');
    assert.equal(rankChunks('irrigation visit', chunks)[0]?.kind, 'maintenance');
  });

  it('matches without accents and ignores filler words', () => {
    const chunks = [chunk('document', 'Document Contrato de instalação · contract')];
    assert.equal(rankChunks('instalacao', chunks).length, 1);
    assert.equal(rankChunks('what is the', chunks).length, 0);
  });
});
