import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { listTemplates } from '../core/generator.js';

export const getTemplateSchema = z.object({
  templateName: z.string(),
});

export function handleListTemplates(): string {
  const templates = listTemplates();
  const dir = process.env.TEMPLATES_DIR ?? path.resolve(process.cwd(), 'templates');
  if (templates.length === 0) return `No templates in ${dir}. Add .hbs files to get started.`;
  return `Templates in ${dir}:\n${templates.map((t) => `  - ${t}.hbs`).join('\n')}`;
}

export function handleGetTemplate(input: z.infer<typeof getTemplateSchema>): string {
  const dir = process.env.TEMPLATES_DIR ?? path.resolve(process.cwd(), 'templates');
  const p = path.join(dir, `${input.templateName}.hbs`);
  if (!fs.existsSync(p)) return `Template "${input.templateName}" not found at ${p}.`;
  return fs.readFileSync(p, 'utf-8');
}
