import { z } from 'zod';
import { contextStore } from '../core/context-store.js';
import { analyzeContexts } from '../core/analyzer.js';
import { generateTs, generateAll } from '../core/generator.js';

export const generateTsSchema = z.object({
  objectName: z.string(),
  templateName: z.string().optional(),
  outputDir: z.string().optional(),
});

export const generateAllSchema = z.object({
  outputDir: z.string().optional(),
});

export function handleGenerateTs(input: z.infer<typeof generateTsSchema>): string {
  const r = generateTs(input);
  return `Generated: ${r.outputPath}\n\n---\n${r.content}`;
}

export function handleGenerateAll(input: z.infer<typeof generateAllSchema>): string {
  const results = generateAll(input.outputDir);
  if (results.length === 0) return 'No objects in context.';
  return (
    `Generated ${results.length} file(s):\n` +
    results.map((r) => `  ✓ ${r.objectName} → ${r.outputPath}`).join('\n')
  );
}

export function handleAnalyzeContext(): string {
  return analyzeContexts(contextStore.getAll()).summary;
}
