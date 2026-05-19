import { AbapObjectContext, AnalysisResult } from '../types.js';
import { buildDependencyGraph, topoSort } from './dependency-graph.js';

export function analyzeContexts(contexts: AbapObjectContext[]): AnalysisResult {
  if (contexts.length === 0) {
    return {
      objectCount: 0,
      dependencyGraph: {},
      generationOrder: [],
      summary: 'Context is empty — add objects first.',
    };
  }

  const graph = buildDependencyGraph(contexts);
  const generationOrder = topoSort(graph);

  const byType: Record<string, string[]> = {};
  for (const ctx of contexts) {
    (byType[ctx.type] ??= []).push(ctx.name);
  }

  const lines: string[] = [
    `Total objects: ${contexts.length}`,
    `Types present: ${Object.keys(byType).join(', ')}`,
    '',
    'By type:',
    ...Object.entries(byType).map(([t, names]) => `  ${t}: ${names.join(', ')}`),
    '',
    `Suggested generation order: ${generationOrder.join(' → ')}`,
    '',
    'Dependency graph:',
    ...Object.values(graph).map(
      (n) =>
        `  ${n.name}  depends_on:[${n.dependsOn.join(', ') || 'none'}]  depended_by:[${n.dependedBy.join(', ') || 'none'}]`
    ),
  ];

  return {
    objectCount: contexts.length,
    dependencyGraph: graph,
    generationOrder,
    summary: lines.join('\n'),
  };
}
