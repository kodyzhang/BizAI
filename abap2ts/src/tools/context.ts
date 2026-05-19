import { z } from 'zod';
import { contextStore } from '../core/context-store.js';
import { AbapObjectContext } from '../types.js';

const paramSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  optional: z.boolean().optional(),
});

const fieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  length: z.number().optional(),
  decimals: z.number().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const methodSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  importing: z.array(paramSchema).optional(),
  exporting: z.array(paramSchema).optional(),
  changing: z.array(paramSchema).optional(),
  returning: paramSchema.optional(),
  exceptions: z.array(z.string()).optional(),
});

export const addObjectContextSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema).optional(),
  methods: z.array(methodSchema).optional(),
  references: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function addObjectContext(input: z.infer<typeof addObjectContextSchema>): string {
  const ctx: AbapObjectContext = {
    ...input,
    metadata: input.metadata ?? {},
    addedAt: new Date(),
  };
  contextStore.add(ctx);
  return `Added ${ctx.type} "${ctx.name}" to context. Total: ${contextStore.size()} object(s).`;
}

export function listContexts(): string {
  const all = contextStore.getAll();
  if (all.length === 0) return 'Context is empty.';
  const rows = all.map(
    (c) => `  [${c.type.padEnd(6)}] ${c.name}${c.description ? ` — ${c.description}` : ''}`
  );
  return `Objects in context (${all.length}):\n${rows.join('\n')}`;
}

export function clearContext(): string {
  const n = contextStore.size();
  contextStore.clear();
  return `Cleared ${n} object(s) from context.`;
}
