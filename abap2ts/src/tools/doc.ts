import { z } from 'zod';
import { generateTechSpecDoc, Language, SectionKey } from '../core/doc-generator.js';

export const generateTsDocSchema = z.object({
  outputDir: z.string().optional().describe('Output directory. Defaults to ./output'),
  language: z.enum(['zh', 'en']).optional().default('zh').describe('Document language: zh (Chinese, default) or en (English)'),
  sections: z
    .array(z.enum(['background', 'objects', 'flowchart', 'code']))
    .optional()
    .describe('Ordered list of sections to include. Defaults to all 4: background, objects, flowchart, code'),
  customTitles: z
    .record(z.string())
    .optional()
    .describe('Custom chapter titles keyed by section name (background/objects/flowchart/code)'),
});

export async function handleGenerateTsDoc(
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = generateTsDocSchema.parse(args);
  const result = await generateTechSpecDoc({
    outputDir:    parsed.outputDir,
    language:     parsed.language as Language,
    sections:     parsed.sections as SectionKey[] | undefined,
    customTitles: parsed.customTitles as Record<SectionKey, string> | undefined,
  });
  return {
    content: [{ type: 'text', text: `Technical Specification generated:\n  Word: ${result.docxPath}\n  Flow: ${result.mdPath}` }],
  };
}
