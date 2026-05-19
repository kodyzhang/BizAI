import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GenerateOptions, GenerateResult } from '../types.js';
import { contextStore } from './context-store.js';

// Project root = two levels up from dist/core/generator.js
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Handlebars helpers ─────────────────────────────────────────────────────

const ABAP_TYPE_MAP: Record<string, string> = {
  CHAR: 'string', NUMC: 'string', STRING: 'string', SSTRING: 'string',
  INT1: 'number', INT2: 'number', INT4: 'number', INT8: 'number',
  DEC: 'number', FLTP: 'number', CURR: 'number', QUAN: 'number',
  DATS: 'string', TIMS: 'string', UTCL: 'string', TIMESTAMP: 'string',
  XFELD: 'boolean', ABAP_BOOL: 'boolean', WDY_BOOLEAN: 'boolean',
  RAW: 'string', RAWSTRING: 'string',
  ANY: 'unknown', DATA: 'unknown',
};

Handlebars.registerHelper('abapToTs', (abapType: string) => {
  if (!abapType) return 'unknown';
  return ABAP_TYPE_MAP[abapType.toUpperCase().trim()] ?? 'string';
});

Handlebars.registerHelper('pascalCase', (str: string) => {
  if (!str) return '';
  return str
    .split(/[_\s-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
});

Handlebars.registerHelper('camelCase', (str: string) => {
  if (!str) return '';
  const parts = str.split(/[_\s-]/);
  return parts
    .map((p, i) =>
      i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join('');
});

Handlebars.registerHelper('upperCase', (str: string) => str?.toUpperCase() ?? '');
Handlebars.registerHelper('lowerCase', (str: string) => str?.toLowerCase() ?? '');
Handlebars.registerHelper('isoDate', () => new Date().toISOString());

// ── Template resolution ────────────────────────────────────────────────────

function getTemplatesDir(): string {
  return process.env.TEMPLATES_DIR ?? path.join(PROJECT_ROOT, 'templates');
}

function getOutputDir(): string {
  return process.env.OUTPUT_DIR ?? path.join(PROJECT_ROOT, 'output');
}

function loadTemplate(templateName: string): HandlebarsTemplateDelegate {
  const p = path.join(getTemplatesDir(), `${templateName}.hbs`);
  if (!fs.existsSync(p)) throw new Error(`Template not found: ${p}`);
  return Handlebars.compile(fs.readFileSync(p, 'utf-8'));
}

function resolveTemplateName(type: string): string {
  const dir = getTemplatesDir();
  for (const name of [type.toLowerCase(), type.toLowerCase().replace(/_/g, '-')]) {
    if (fs.existsSync(path.join(dir, `${name}.hbs`))) return name;
  }
  if (fs.existsSync(path.join(dir, 'default.hbs'))) return 'default';
  throw new Error(
    `No template for type "${type}". Add templates/${type.toLowerCase()}.hbs or templates/default.hbs`
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

export function generateTs(opts: GenerateOptions): GenerateResult {
  const context = contextStore.get(opts.objectName);
  if (!context) throw new Error(`"${opts.objectName}" not found in context store`);

  const templateName = opts.templateName ?? resolveTemplateName(context.type);
  const content = loadTemplate(templateName)({ ...context, generatedAt: new Date().toISOString() });

  const outputDir = opts.outputDir ?? getOutputDir();
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${context.name}.ts`);
  fs.writeFileSync(outputPath, content, 'utf-8');

  return { objectName: context.name, outputPath, content };
}

export function generateAll(outputDir?: string): GenerateResult[] {
  return contextStore.getAll().map((ctx) => generateTs({ objectName: ctx.name, outputDir }));
}

export function listTemplates(): string[] {
  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.hbs'))
    .map((f) => f.slice(0, -4));
}
