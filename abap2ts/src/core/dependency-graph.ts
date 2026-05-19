import { AbapObjectContext, DependencyNode } from '../types.js';

export function buildDependencyGraph(
  contexts: AbapObjectContext[]
): Record<string, DependencyNode> {
  const graph: Record<string, DependencyNode> = {};

  for (const ctx of contexts) {
    graph[ctx.name] = {
      name: ctx.name,
      type: ctx.type,
      dependsOn: ctx.references ?? [],
      dependedBy: [],
    };
  }

  for (const ctx of contexts) {
    for (const ref of ctx.references ?? []) {
      if (graph[ref]) {
        graph[ref].dependedBy.push(ctx.name);
      }
    }
  }

  return graph;
}

export function topoSort(graph: Record<string, DependencyNode>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);
    for (const dep of graph[name]?.dependsOn ?? []) {
      visit(dep);
    }
    result.push(name);
  }

  for (const name of Object.keys(graph)) {
    visit(name);
  }

  return result;
}
