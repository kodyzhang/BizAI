import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  addObjectContextSchema,
  addObjectContext,
  listContexts,
  clearContext,
} from './tools/context.js';
import {
  generateTsSchema,
  generateAllSchema,
  handleGenerateTs,
  handleGenerateAll,
  handleAnalyzeContext,
} from './tools/generate.js';
import {
  getTemplateSchema,
  handleListTemplates,
  handleGetTemplate,
} from './tools/template.js';
import { generateTsDocSchema, handleGenerateTsDoc } from './tools/doc.js';

const server = new Server(
  { name: 'abap2ts', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// ── Tool registry ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'add_object_context',
      description:
        'Add a SAP ABAP object and its metadata to the context store. ' +
        'Call for the main object and every dependency before generating Technical Specification document. ' +
        'Supported types: PROG, CLAS, INTF, FUNC, FUGR, BADI, ENHS, CDS, BDEF, TABL, STRU, DTEL, DOMA, TTYP, VIEW — extensible with any string.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'ABAP object name, e.g. ZCL_MY_CLASS' },
          type: {
            type: 'string',
            description: 'Object type: PROG | CLAS | INTF | FUNC | BADI | CDS | BDEF | TABL | STRU | ...',
          },
          description: { type: 'string' },
          fields: {
            type: 'array',
            description: 'Structure fields or table columns',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', description: 'ABAP data type, e.g. CHAR, INT4, STRING' },
                length: { type: 'number' },
                decimals: { type: 'number' },
                description: { type: 'string' },
                required: { type: 'boolean' },
              },
              required: ['name', 'type'],
            },
          },
          methods: {
            type: 'array',
            description: 'Methods (for CLAS, INTF, BADI) or function module signature (for FUNC)',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                importing: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      optional: { type: 'boolean' },
                    },
                    required: ['name', 'type'],
                  },
                },
                exporting: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { name: { type: 'string' }, type: { type: 'string' } },
                    required: ['name', 'type'],
                  },
                },
                changing: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { name: { type: 'string' }, type: { type: 'string' } },
                    required: ['name', 'type'],
                  },
                },
                returning: {
                  type: 'object',
                  properties: { name: { type: 'string' }, type: { type: 'string' } },
                  required: ['name', 'type'],
                },
                exceptions: { type: 'array', items: { type: 'string' } },
              },
              required: ['name'],
            },
          },
          references: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of other ABAP objects this object depends on (for dependency graph)',
          },
          metadata: {
            type: 'object',
            description: 'Extended metadata used for Technical Specification document generation',
            properties: {
              annotatedCode: {
                type: 'string',
                description:
                  'All key ABAP source code sections (every FORM/METHOD body, SELECT, CALL FUNCTION, IF/CASE blocks, ' +
                  'calculations, MODIFY/UPDATE statements) with * [注] inline annotations on each important line. ' +
                  'EXCLUDE only top-level TYPE-POOLS/TYPES/DATA/CONSTANTS/TABLES declaration blocks. ' +
                  'Each FORM/METHOD must be wrapped with ══ separator headers. ' +
                  'This content is rendered as Chapter 4 "Key Code Analysis" in the Word document.',
              },
              mermaidFlow: {
                type: 'string',
                description:
                  'Mermaid flowchart TD source code showing the BUSINESS PROCESS FLOW of the program in execution order. ' +
                  'NOT an object dependency graph. Show 5-9 steps: selection screen inputs → AUTHORITY-CHECK → ' +
                  'DB reads (include table names like LFA1/BSIK) → data processing/calculation → ALV/output. ' +
                  'Use diamond nodes {...} for decision branches (e.g., auth pass/fail). ' +
                  'This becomes the embedded PNG diagram in Chapter 3 "Core Logic & Process Flow".',
              },
            },
          },
        },
        required: ['name', 'type'],
      },
    },
    {
      name: 'list_contexts',
      description: 'List all ABAP objects currently accumulated in the context store.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'clear_context',
      description: 'Clear all objects from the context store. Call before starting a new generation session.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'analyze_context',
      description:
        'Analyze all objects in context: builds dependency graph, groups by type, suggests generation order. ' +
        'Call after collecting all objects and before generating Technical Specification document.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'generate_ts',
      description:
        'Generate TypeScript for a single ABAP object using its context and a matched Handlebars template.',
      inputSchema: {
        type: 'object',
        properties: {
          objectName: { type: 'string', description: 'Name of the object to generate TS for' },
          templateName: {
            type: 'string',
            description: 'Override template name (without .hbs). Auto-selected by object type if omitted.',
          },
          outputDir: { type: 'string', description: 'Output directory. Defaults to ./output' },
        },
        required: ['objectName'],
      },
    },
    {
      name: 'generate_all',
      description: 'Generate TypeScript for all objects in the context store. One .ts file per object.',
      inputSchema: {
        type: 'object',
        properties: {
          outputDir: { type: 'string', description: 'Output directory. Defaults to ./output' },
        },
      },
    },
    {
      name: 'list_templates',
      description: 'List available Handlebars templates (.hbs) in the templates/ directory.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_template',
      description: 'Read the source of a specific Handlebars template.',
      inputSchema: {
        type: 'object',
        properties: {
          templateName: { type: 'string', description: 'Template name without .hbs extension' },
        },
        required: ['templateName'],
      },
    },
    {
      name: 'generate_ts_doc',
      description:
        'Generate a Technical Specification Word document (.docx) for all objects in the context store. ' +
        'Sections: background, objects, flowchart, code. Supports Chinese/English output and custom section titles.',
      inputSchema: {
        type: 'object',
        properties: {
          outputDir: { type: 'string', description: 'Output directory. Defaults to ./output' },
          language: {
            type: 'string',
            enum: ['zh', 'en'],
            description: 'Document language: zh (Chinese, default) or en (English)',
          },
          sections: {
            type: 'array',
            items: { type: 'string', enum: ['background', 'objects', 'flowchart', 'code'] },
            description: 'Ordered list of sections to include. Defaults to all 4.',
          },
          customTitles: {
            type: 'object',
            description: 'Custom chapter titles keyed by section name (background/objects/flowchart/code)',
            additionalProperties: { type: 'string' },
          },
        },
      },
    },
  ],
}));

// ── Tool dispatch ──────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'add_object_context':
        result = addObjectContext(addObjectContextSchema.parse(args));
        break;
      case 'list_contexts':
        result = listContexts();
        break;
      case 'clear_context':
        result = clearContext();
        break;
      case 'analyze_context':
        result = handleAnalyzeContext();
        break;
      case 'generate_ts':
        result = handleGenerateTs(generateTsSchema.parse(args));
        break;
      case 'generate_all':
        result = handleGenerateAll(generateAllSchema.parse(args));
        break;
      case 'list_templates':
        result = handleListTemplates();
        break;
      case 'get_template':
        result = handleGetTemplate(getTemplateSchema.parse(args));
        break;
      case 'generate_ts_doc': {
        const docResult = await handleGenerateTsDoc(args);
        return docResult;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[abap2ts] MCP Server running on stdio');
}

main().catch((err) => {
  console.error('[abap2ts] Fatal:', err);
  process.exit(1);
});
