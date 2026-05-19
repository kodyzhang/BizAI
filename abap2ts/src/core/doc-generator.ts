import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  convertInchesToTwip, ShadingType,
} from 'docx';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { contextStore } from './context-store.js';
import { analyzeContexts } from './analyzer.js';
import { AbapObjectContext } from '../types.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MMDC = path.join(PROJECT_ROOT, 'node_modules/.bin/mmdc');

// ── Mermaid → PNG renderer ─────────────────────────────────────────────────

function pngDimensions(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function renderMermaidPng(mermaidCode: string): Promise<Buffer | null> {
  const ts  = Date.now();
  const inp = path.join(os.tmpdir(), `abap2ts_${ts}.mmd`);
  const out = path.join(os.tmpdir(), `abap2ts_${ts}.png`);
  try {
    fs.writeFileSync(inp, mermaidCode);
    execFileSync(MMDC, ['-i', inp, '-o', out, '-w', '1200', '-b', 'white'], { timeout: 30_000 });
    return fs.readFileSync(out);
  } catch {
    return null;
  } finally {
    for (const f of [inp, out]) try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
}

// ── i18n ───────────────────────────────────────────────────────────────────

export type Language = 'zh' | 'en';

export type SectionKey = 'background' | 'objects' | 'flowchart' | 'code';

const I18N: Record<Language, {
  ch1: string; ch1_1: string; ch1_2: string; ch1_3: string;
  ch2: string;
  ch3: string; ch3_1: string; ch3_2: string; ch3_mermaid_hint: string;
  ch4: string; ch4_methods: string; ch4_fields: string; ch4_none: string;
  ch4_source: string; ch4_source_note: string;
  col_seq: string; col_name: string; col_type: string; col_desc: string; col_note: string;
  col_order: string; col_obj: string; col_dep: string;
  col_dir: string; col_param: string; col_abap_type: string;
  col_field: string; col_len: string;
  no_dep: string; no_fields: string;
  bg_purpose: string; bg_scope: string; bg_audience: string;
  type_label: (t: string) => string;
}> = {
  zh: {
    ch1: '第一章  开发背景及目的',
    ch1_1: '1.1  业务背景',
    ch1_2: '1.2  开发目的',
    ch1_3: '1.3  适用范围',
    ch2: '第二章  开发对象清单',
    ch3: '第三章  核心逻辑流程',
    ch3_1: '3.1  总体流程说明',
    ch3_2: '3.2  Mermaid 流程图',
    ch3_mermaid_hint: '将以下代码粘贴至 https://mermaid.live 即可查看可视化流程图：',
    ch4: '第四章  关键代码解析',
    ch4_methods: '逻辑方法',
    ch4_fields: '字段定义',
    ch4_none: '本次涉及对象暂无可分析的方法或字段定义。',
    ch4_source: '关键代码（带注解）',
    ch4_source_note: '以下为关键 ABAP 代码，"* [注]" 开头的行为逻辑说明：',
    col_seq: '序号', col_name: '对象名称', col_type: '对象类型', col_desc: '描述说明', col_note: '备注',
    col_order: '执行顺序', col_obj: '对象名称', col_dep: '依赖对象',
    col_dir: '方向', col_param: '参数名', col_abap_type: '类型', col_field: '字段名', col_len: '长度',
    no_dep: '（无依赖）', no_fields: '—',
    bg_purpose: '本技术规格说明书针对 {name}（{type}）进行完整记录，覆盖相关自定义对象、核心逻辑流程及关键代码，供开发、测试、维护团队参考。',
    bg_scope: '本文档适用于以下人员：系统开发人员、功能顾问、质量测试人员、后续维护人员。',
    bg_audience: '以下为本次开发涉及的所有自定义 SAP 对象：',
    type_label: (t) => ZH_TYPE_LABELS[t.toUpperCase()] ?? t,
  },
  en: {
    ch1: 'Chapter 1  Development Background & Objectives',
    ch1_1: '1.1  Business Background',
    ch1_2: '1.2  Development Objectives',
    ch1_3: '1.3  Scope of Application',
    ch2: 'Chapter 2  Development Object List',
    ch3: 'Chapter 3  Core Logic & Process Flow',
    ch3_1: '3.1  Overall Process Description',
    ch3_2: '3.2  Mermaid Flowchart',
    ch3_mermaid_hint: 'Paste the code below into https://mermaid.live to view the flowchart:',
    ch4: 'Chapter 4  Key Code Analysis',
    ch4_methods: 'Logic Methods / Forms',
    ch4_fields: 'Field Definitions',
    ch4_none: 'No analyzable methods or field definitions found for the registered objects.',
    ch4_source: 'Annotated Key Code',
    ch4_source_note: 'Key ABAP source code below. Lines starting with "* [Note]" are analysis annotations:',
    col_seq: 'No.', col_name: 'Object Name', col_type: 'Object Type', col_desc: 'Description', col_note: 'Remarks',
    col_order: 'Order', col_obj: 'Object', col_dep: 'Dependencies',
    col_dir: 'Direction', col_param: 'Parameter', col_abap_type: 'Type', col_field: 'Field', col_len: 'Length',
    no_dep: '(none)', no_fields: '—',
    bg_purpose: 'This Technical Specification documents {name} ({type}) in full, covering custom objects, core logic flow, and key code, for use by development, QA, and maintenance teams.',
    bg_scope: 'This document is intended for: system developers, functional consultants, QA engineers, and maintenance personnel.',
    bg_audience: 'All custom SAP objects involved in this development:',
    type_label: (t) => EN_TYPE_LABELS[t.toUpperCase()] ?? t,
  },
};

const ZH_TYPE_LABELS: Record<string, string> = {
  PROG: 'ABAP 程序 / Include', CLAS: 'ABAP 类', INTF: 'ABAP 接口',
  FUNC: '函数模块', FUGR: '函数组', BADI: 'BAdI 实现',
  CDS: 'CDS 视图', BDEF: 'RAP 行为定义', TABL: '透明表',
  STRU: '结构', DTEL: '数据元素', DOMA: '域', VIEW: '视图',
};
const EN_TYPE_LABELS: Record<string, string> = {
  PROG: 'ABAP Program / Include', CLAS: 'ABAP Class', INTF: 'ABAP Interface',
  FUNC: 'Function Module', FUGR: 'Function Group', BADI: 'BAdI Implementation',
  CDS: 'CDS View', BDEF: 'RAP Behavior Definition', TABL: 'Transparent Table',
  STRU: 'Structure', DTEL: 'Data Element', DOMA: 'Domain', VIEW: 'View',
};

// ── Style constants ────────────────────────────────────────────────────────

const COLOR_PRIMARY      = '0F172A';  // 深海军蓝 — 主标题、对象名
const COLOR_ACCENT       = '2563EB';  // 明蓝 — 章节标题、徽章
const COLOR_ACCENT_DARK  = '1E3A8A';  // 深蓝 — 表头文字
const COLOR_LIGHT        = 'DBEAF5';  // 浅蓝 — 表头背景
const COLOR_GRAY         = 'F8FAFC';  // 近白 — 代码/奇偶行背景
const COLOR_DIVIDER      = 'E2E8F0';  // 浅灰 — 分割线

function heading1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: convertInchesToTwip(0.35), after: convertInchesToTwip(0.12) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_DIVIDER } },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: convertInchesToTwip(0.22), after: convertInchesToTwip(0.06) },
  });
}

function body(text: string, bold = false, indent = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 22, color: '1E293B' })],
    spacing: { after: 80 },
    indent: indent ? { left: convertInchesToTwip(0.3) } : undefined,
  });
}

function codeBlock(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1E40AF' })],
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.4) },
    shading: { type: ShadingType.CLEAR, color: COLOR_GRAY, fill: COLOR_GRAY },
  });
}

function hline(): Paragraph {
  return new Paragraph({
    text: '',
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_DIVIDER } },
    spacing: { after: 140 },
  });
}

const TABLE_BORDERS = {
  top:     { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
  bottom:  { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
  left:    { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
  right:   { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
} as const;

function tCell(text: string, bold = false, fill?: string, widthPct?: number, color = '1E293B'): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: 20, color })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
    })],
    shading: fill ? { type: ShadingType.CLEAR, color: fill, fill } : undefined,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function tHeaderRow(cols: string[], pcts?: number[]): TableRow {
  return new TableRow({
    children: cols.map((c, i) => tCell(c, true, COLOR_LIGHT, pcts?.[i], COLOR_ACCENT_DARK)),
    tableHeader: true,
  });
}

// ── Section builders ───────────────────────────────────────────────────────

function buildSection1(
  mainObj: AbapObjectContext,
  L: typeof I18N['zh'],
  customTitles?: Partial<Record<SectionKey, string>>,
): (Paragraph | Table)[] {
  const title = customTitles?.background ?? L.ch1;
  return [
    heading1(title),
    heading2(L.ch1_1),
    body(mainObj.description || '（请补充业务背景说明）'),
    heading2(L.ch1_2),
    body(L.bg_purpose.replace('{name}', mainObj.name).replace('{type}', L.type_label(mainObj.type))),
    heading2(L.ch1_3),
    body(L.bg_scope),
    hline(),
  ];
}

function buildSection2(
  contexts: AbapObjectContext[],
  L: typeof I18N['zh'],
  customTitles?: Partial<Record<SectionKey, string>>,
): (Paragraph | Table)[] {
  const title = customTitles?.objects ?? L.ch2;
  const rows: TableRow[] = [
    tHeaderRow([L.col_seq, L.col_name, L.col_type, L.col_desc, L.col_note], [5, 22, 20, 43, 10]),
    ...contexts.map((ctx, idx) =>
      new TableRow({ children: [
        tCell(String(idx + 1), false, undefined, 5),
        tCell(ctx.name, true, undefined, 22),
        tCell(L.type_label(ctx.type), false, COLOR_LIGHT, 20),
        tCell(ctx.description || L.no_fields, false, undefined, 43),
        tCell('', false, undefined, 10),
      ]}),
    ),
  ];
  return [
    heading1(title),
    body(L.bg_audience),
    new Paragraph({ text: '', spacing: { after: 60 } }),
    new Table({ rows, borders: TABLE_BORDERS, width: { size: 100, type: WidthType.PERCENTAGE } }),
    hline(),
  ];
}

async function buildSection3(
  contexts: AbapObjectContext[],
  order: string[],
  L: typeof I18N['zh'],
  customTitles?: Partial<Record<SectionKey, string>>,
): Promise<(Paragraph | Table)[]> {
  const title = customTitles?.flowchart ?? L.ch3;
  const depRows: TableRow[] = [
    tHeaderRow([L.col_order, L.col_obj, L.col_type, L.col_dep], [8, 25, 20, 47]),
    ...order.map((name, idx) => {
      const ctx = contexts.find(c => c.name === name);
      if (!ctx) return null;
      const deps = (ctx.references ?? []).filter(r => contexts.find(c => c.name === r));
      return new TableRow({ children: [
        tCell(String(idx + 1), false, undefined, 8),
        tCell(name, true, undefined, 25),
        tCell(L.type_label(ctx.type), false, COLOR_LIGHT, 20),
        tCell(deps.length ? deps.join(' → ') : L.no_dep, false, undefined, 47),
      ]});
    }).filter(Boolean) as TableRow[],
  ];

  // Prefer AI-generated business flow over auto-generated dependency graph
  const mainObj    = contexts.find(c => c.name === order.at(-1)) ?? contexts[0];
  const customFlow = (mainObj?.metadata as any)?.mermaidFlow as string | undefined;
  const mermaidCode = customFlow ?? buildMermaidLines(contexts, order).join('\n');
  const pngBuf      = await renderMermaidPng(mermaidCode);

  let flowchartBlock: (Paragraph | Table)[];
  if (pngBuf) {
    const { width, height } = pngDimensions(pngBuf);
    const MAX_W = 576;
    const MAX_H = 620;
    const scale  = Math.min(MAX_W / width, MAX_H / height);
    const displayW = Math.round(width  * scale);
    const displayH = Math.round(height * scale);
    flowchartBlock = [
      new Paragraph({
        children: [new ImageRun({ data: pngBuf, transformation: { width: displayW, height: displayH }, type: 'png' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      }),
    ];
  } else {
    flowchartBlock = [
      body(L.ch3_mermaid_hint),
      new Paragraph({ text: '', spacing: { after: 40 } }),
      ...mermaidCode.split('\n').map((l: string) => codeBlock(l)),
    ];
  }

  return [
    heading1(title),
    heading2(L.ch3_1),
    body(L.bg_audience.replace('对象', '依赖对象').replace('All custom SAP objects involved in this development:', 'Dependency order and call chain:')),
    new Paragraph({ text: '', spacing: { after: 60 } }),
    new Table({ rows: depRows, borders: TABLE_BORDERS, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: '', spacing: { after: 120 } }),
    heading2(L.ch3_2),
    ...flowchartBlock,
    hline(),
  ];
}

function buildMermaidLines(contexts: AbapObjectContext[], order: string[]): string[] {
  const lines = ['flowchart TD'];
  for (const name of order) {
    const ctx = contexts.find(c => c.name === name);
    if (!ctx) continue;
    lines.push(`    ${name}["${name}\\n[${ctx.type}]"]`);
  }
  for (const ctx of contexts) {
    for (const ref of ctx.references ?? []) {
      if (contexts.find(c => c.name === ref))
        lines.push(`    ${ref} --> ${ctx.name}`);
    }
  }
  return lines;
}

// ── Annotated code rendering ───────────────────────────────────────────────

const ANNOTATION_PREFIX_ZH = '* [注]';
const ANNOTATION_PREFIX_EN = '* [Note]';

function renderAnnotatedCode(code: string, lang: Language): Paragraph[] {
  const annotPrefix = lang === 'zh' ? ANNOTATION_PREFIX_ZH : ANNOTATION_PREFIX_EN;
  return code.split('\n').map(line => {
    const isAnnotation = line.trimStart().startsWith('* [注]') || line.trimStart().startsWith('* [Note]');
    return new Paragraph({
      children: [new TextRun({
        text: line || ' ',
        font: 'Courier New',
        size: 18,
        color: isAnnotation ? '1a6b1a' : '003366',  // green for annotations, navy for code
        bold: isAnnotation,
        italics: isAnnotation,
      })],
      spacing: { before: 0, after: 0 },
      indent: { left: convertInchesToTwip(0.4) },
      shading: {
        type: ShadingType.CLEAR,
        color: isAnnotation ? 'EEF7EE' : 'F4F6F9',
        fill:  isAnnotation ? 'EEF7EE' : 'F4F6F9',
      },
    });
  });
}

// ── Section 4 ──────────────────────────────────────────────────────────────

function buildSection4(
  contexts: AbapObjectContext[],
  L: typeof I18N['zh'],
  lang: Language,
  customTitles?: Partial<Record<SectionKey, string>>,
): (Paragraph | Table)[] {
  const title = customTitles?.code ?? L.ch4;
  const items: (Paragraph | Table)[] = [heading1(title)];

  const withMethods = contexts.filter(c => c.methods?.length);
  const withFields  = contexts.filter(c => c.fields?.length);
  const withCode    = contexts.filter(c => (c.metadata as any)?.annotatedCode);

  // Collect all unique objects that have something to show
  const allObjects = [...new Set([
    ...withMethods.map(c => c.name),
    ...withFields.map(c => c.name),
    ...withCode.map(c => c.name),
  ])].map(name => contexts.find(c => c.name === name)!);

  if (!allObjects.length) {
    items.push(body(L.ch4_none));
    return items;
  }

  let sn = 1;

  for (const ctx of allObjects) {
    const hasMethods = ctx.methods?.length;
    const hasFields  = ctx.fields?.length;
    const annotated  = (ctx.metadata as any)?.annotatedCode as string | undefined;

    // Section heading: show whichever applies
    const suffix = hasMethods ? L.ch4_methods : hasFields ? L.ch4_fields : L.ch4_source;
    items.push(heading2(`4.${sn}  ${ctx.name} — ${suffix}`));
    sn++;

    // ① Methods + parameter table
    if (hasMethods) {
      for (const method of ctx.methods!) {
        items.push(
          new Paragraph({
            children: [new TextRun({ text: `▶  ${method.name}`, bold: true, size: 22, color: COLOR_PRIMARY })],
            spacing: { before: 120, after: 60 },
          }),
        );
        if (method.description) items.push(body(method.description, false, true));

        const params = [
          ...(method.importing ?? []).map(p => ({ dir: 'IMPORTING', ...p })),
          ...(method.exporting ?? []).map(p => ({ dir: 'EXPORTING', ...p })),
          ...(method.changing  ?? []).map(p => ({ dir: 'CHANGING',  ...p })),
          ...(method.returning ? [{ dir: 'RETURNING', ...method.returning }] : []),
        ];
        if (params.length) {
          items.push(
            new Table({
              rows: [
                tHeaderRow([L.col_dir, L.col_param, L.col_abap_type, L.col_desc], [15, 30, 20, 35]),
                ...params.map(p =>
                  new TableRow({ children: [
                    tCell(p.dir, false, COLOR_LIGHT, 15),
                    tCell(p.name, true, undefined, 30),
                    tCell(p.type, false, undefined, 20),
                    tCell((p as any).description || L.no_fields, false, undefined, 35),
                  ]}),
                ),
              ],
              borders: TABLE_BORDERS,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
            new Paragraph({ text: '', spacing: { after: 60 } }),
          );
        }
      }
    }

    // ② Field definitions table
    if (hasFields) {
      items.push(
        new Table({
          rows: [
            tHeaderRow([L.col_field, L.col_abap_type, L.col_len, L.col_desc], [25, 20, 15, 40]),
            ...ctx.fields!.map(f =>
              new TableRow({ children: [
                tCell(f.name, true, undefined, 25),
                tCell(f.type, false, COLOR_LIGHT, 20),
                tCell(f.length !== undefined ? String(f.length) : L.no_fields, false, undefined, 15),
                tCell(f.description || L.no_fields, false, undefined, 40),
              ]}),
            ),
          ],
          borders: TABLE_BORDERS,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ text: '', spacing: { after: 60 } }),
      );
    }

    // ③ Annotated source code
    if (annotated) {
      items.push(
        heading2(`    ${L.ch4_source}`),
        body(L.ch4_source_note),
        new Paragraph({ text: '', spacing: { after: 40 } }),
        ...renderAnnotatedCode(annotated, lang),
        new Paragraph({ text: '', spacing: { after: 80 } }),
      );
    }
  }

  items.push(hline());
  return items;
}

function buildTitlePage(mainObj: AbapObjectContext, L: typeof I18N['zh']): Paragraph[] {
  const today = new Date().toLocaleDateString(
    L === I18N.zh ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
  const typeLabel = L.type_label(mainObj.type);
  return [
    // ── 顶部蓝色横线
    new Paragraph({
      text: '',
      border: { top: { style: BorderStyle.THICK, size: 20, color: COLOR_ACCENT } },
      spacing: { before: convertInchesToTwip(0.6), after: 0 },
    }),
    // ── 文档类型标签（小号蓝字）
    new Paragraph({
      children: [new TextRun({
        text: L === I18N.zh ? 'Technical Specification  ·  技术规格说明书' : 'Technical Specification',
        size: 20, color: COLOR_ACCENT, bold: true,
      })],
      spacing: { before: 120, after: 80 },
    }),
    // ── 主标题（对象名）
    new Paragraph({
      children: [new TextRun({ text: mainObj.name, bold: true, size: 56, color: COLOR_PRIMARY })],
      spacing: { after: 80 },
    }),
    // ── 副标题（描述）
    new Paragraph({
      children: [new TextRun({
        text: mainObj.description || (L === I18N.zh ? '（请补充业务背景说明）' : 'No description provided'),
        size: 26, color: '475569', italics: !mainObj.description,
      })],
      spacing: { after: 160 },
    }),
    // ── 元信息行（类型 badge + 日期）
    new Paragraph({
      children: [
        new TextRun({ text: `  ${typeLabel}  `, bold: true, size: 20, color: 'FFFFFF',
          highlight: undefined,
          shading: { type: ShadingType.CLEAR, color: COLOR_ACCENT, fill: COLOR_ACCENT } as any,
        }),
        new TextRun({ text: '    ' }),
        new TextRun({ text: (L === I18N.zh ? '生成日期：' : 'Generated: ') + today, size: 20, color: '64748B' }),
      ],
      spacing: { after: convertInchesToTwip(0.3) },
    }),
    // ── 底部分割线
    new Paragraph({
      text: '',
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_DIVIDER } },
      spacing: { after: convertInchesToTwip(0.4) },
    }),
  ];
}

// ── Flowchart Markdown file ────────────────────────────────────────────────

function generateFlowchartMd(
  contexts: AbapObjectContext[],
  order: string[],
  mainObj: AbapObjectContext,
  L: typeof I18N['zh'],
  customTitle?: string,
): string {
  const title = customTitle ?? L.ch3;
  const customFlow  = (mainObj?.metadata as any)?.mermaidFlow as string | undefined;
  const mermaidCode = customFlow ?? buildMermaidLines(contexts, order).join('\n');
  const lines: string[] = [
    `# ${title}`,
    '',
    `> **${mainObj.name}** (${L.type_label(mainObj.type)})`,
    '',
    '```mermaid',
    ...mermaidCode.split('\n'),
    '```',
    '',
  ];
  return lines.join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface TechSpecOptions {
  outputDir?: string;
  language?: Language;
  /** Ordered list of sections to include. Defaults to all 4. */
  sections?: SectionKey[];
  /** Optional custom chapter titles keyed by section */
  customTitles?: Partial<Record<SectionKey, string>>;
}

export interface TechSpecResult {
  docxPath: string;
  mdPath: string;
}

export async function generateTechSpecDoc(opts: TechSpecOptions = {}): Promise<TechSpecResult> {
  const contexts = contextStore.getAll();
  if (!contexts.length) throw new Error('Context is empty. Register objects first.');

  const lang     = opts.language ?? 'zh';
  const L        = I18N[lang];
  const sections = opts.sections ?? ['background', 'objects', 'flowchart', 'code'];
  const analysis = analyzeContexts(contexts);
  const mainObj  = contexts.find(c => c.name === analysis.generationOrder.at(-1)) ?? contexts[0];
  const order    = analysis.generationOrder;

  const sectionMap: Record<SectionKey, () => Promise<(Paragraph | Table)[]> | (Paragraph | Table)[]> = {
    background: () => buildSection1(mainObj, L, opts.customTitles),
    objects:    () => buildSection2(contexts, L, opts.customTitles),
    flowchart:  () => buildSection3(contexts, order, L, opts.customTitles),
    code:       () => buildSection4(contexts, L, lang, opts.customTitles),
  };

  const sectionParts: (Paragraph | Table)[] = [];
  for (const s of sections) {
    const fn = sectionMap[s];
    if (fn) sectionParts.push(...await fn());
  }

  const children: (Paragraph | Table)[] = [
    ...buildTitlePage(mainObj, L),
    ...sectionParts,
  ];

  const doc = new Document({
    styles: {
      default: {
        heading1: { run: { bold: true, size: 34, color: COLOR_PRIMARY, font: 'Calibri' } },
        heading2: { run: { bold: true, size: 26, color: COLOR_ACCENT,  font: 'Calibri' } },
        document: { run: { size: 22, font: 'Calibri', color: '1E293B' }, paragraph: { spacing: { after: 100 } } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1), bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2),
          },
        },
      },
      children,
    }],
  });

  const dir = opts.outputDir ?? path.join(PROJECT_ROOT, 'output');
  fs.mkdirSync(dir, { recursive: true });

  const docxPath = path.join(dir, `${mainObj.name}_TS.docx`);
  fs.writeFileSync(docxPath, await Packer.toBuffer(doc));

  const mdPath = path.join(dir, `${mainObj.name}_FLOW.md`);
  fs.writeFileSync(mdPath, generateFlowchartMd(contexts, order, mainObj, L, opts.customTitles?.flowchart));

  return { docxPath, mdPath };
}
