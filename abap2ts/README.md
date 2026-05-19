# abap2ts — Technical Specification Agent

> **AI 驱动的 SAP ABAP 技术规格说明书生成工具**
> *AI-powered Technical Specification generator for SAP ABAP development objects*

---

## 简介 / Overview

`abap2ts` 是一个 MCP Server，通过 [mcp-abap-adt](https://github.com/SAP/mcp-abap-adt) 连接 SAP 系统，自动读取 ABAP 对象（程序、类、函数模块、BAdI、CDS 视图、数据字典等），并生成专业的 **技术规格说明书（Technical Specification）Word 文档**，同时输出 Mermaid 流程图 Markdown 文件。

*`abap2ts` is an MCP Server that connects to any SAP system via mcp-abap-adt, reads ABAP development objects, and auto-generates a professional **Technical Specification Word document (.docx)** along with a Mermaid flowchart Markdown file.*

---

## 文档结构 / Document Structure

| 章节 | 英文标题 | 内容 |
|------|----------|------|
| 第一章 | Development Background & Objectives | 业务背景、开发目的、适用范围 |
| 第二章 | Development Object List | 涉及的自定义 SAP 对象清单（表格） |
| 第三章 | Core Logic & Process Flow | 依赖关系表 + **嵌入式 Mermaid 流程图**（PNG） |
| 第四章 | Key Code Analysis | 参数说明表 + 带 `* [注]` 注解的关键 ABAP 源码 |

---

## 架构 / Architecture

```
Claude Code (AI Agent)
       │
       ├─ mcp-abap-adt ──────────────────────────────────────────────────┐
       │    读取 SAP 对象 (GetProgram / GetClass / GetFunctionModule ...)  │
       │    Read SAP objects via ADT REST API                             │
       │                                                                  ▼
       └─ abap2ts (本项目 / this project)                           SAP System
            管理上下文 + 生成 .docx + 生成 _FLOW.md               (On-Premise / S/4HANA)
            Context store + Word doc + Mermaid MD generation
```

```
src/
├── server.ts                  # MCP Server 入口 / Entry point (9 tools)
├── types.ts                   # 共享类型 / Shared types
├── core/
│   ├── context-store.ts       # 内存上下文存储 / In-memory context store
│   ├── dependency-graph.ts    # 依赖图 + 拓扑排序 / Dependency graph + topological sort
│   ├── analyzer.ts            # 跨对象分析 / Cross-object analysis
│   ├── doc-generator.ts       # Word (.docx) 文档生成 / Word document generator
│   └── generator.ts           # Handlebars 渲染 / Handlebars renderer
└── tools/
    ├── context.ts             # add_object_context / list_contexts / clear_context
    ├── doc.ts                 # generate_ts_doc
    ├── generate.ts            # analyze_context / generate_ts / generate_all
    └── template.ts            # list_templates / get_template
templates/                     # 可扩展 Handlebars 模板 / Extensible .hbs templates
output/                        # 生成文件输出目录 / Generated files (gitignored)
```

---

## 快速开始 / Quick Start

### 前置条件 / Prerequisites

| 工具 | 版本 | Tool | Version |
|------|------|------|---------|
| Node.js | ≥ 18 | Node.js | ≥ 18 |
| mcp-abap-adt | latest | mcp-abap-adt | latest |
| Claude Code | latest | Claude Code CLI | latest |

### 安装 / Installation

```bash
git clone <this-repo>
cd abap2ts
npm install
npm run build
```

### 配置 MCP Server / Configure MCP Servers

在 `~/.claude/settings.json` 中添加两个 MCP Server：
*Add both servers to `~/.claude/settings.json`:*

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "type": "stdio",
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/path/to/mcp-abap-adt/bin/mcp-abap-adt.js",
        "--transport=stdio",
        "--env-path=/path/to/your/sap.env",
        "--system-type=onprem"
      ]
    },
    "abap2ts": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/abap2ts/dist/server.js"]
    }
  }
}
```

### SAP 连接配置 / SAP Connection Config (`sap.env`)

参考 `.env.example` 创建 `sap.env`：
*Copy from `.env.example` and fill in your values:*

```env
SAP_URL=https://<your-sap-host>:<port>
SAP_CLIENT=<client>
SAP_USERNAME=<username>
SAP_PASSWORD=<password>
SAP_SYSTEM_TYPE=onprem
NODE_TLS_REJECT_UNAUTHORIZED=0
```

> **安全提示 / Security**: `sap.env` 含敏感凭证，已在 `.gitignore` 中排除，请勿提交至版本控制。
> *`sap.env` contains credentials and is excluded from version control via `.gitignore`. Never commit it.*

---

## 使用方法 / Usage

### 通过 Skill 调用（推荐）/ Via Skill (Recommended)

在 Claude Code 中输入 / *Type in Claude Code:*

```
/abap2ts
```

引导流程 / *The skill guides you step-by-step:*

1. **选择对象类型** — ABAP 程序 / BAdI / 函数模块 / 类 / CDS / BDEF / DDIC
2. **选择文档语言** — 中文（默认）/ English
3. **选择输出模板** — 标准四章节 / 用户自定义章节结构
4. **提供对象名称** — 如 `ZFIN_AP_INVOICE`
5. **AI 读取 SAP**，遍历依赖，对关键代码添加 `* [注]` 注解
6. **输出文件** — `./output/<OBJECT_NAME>_TS.docx` + `<OBJECT_NAME>_FLOW.md`

### 直接调用 MCP 工具 / Via MCP Tools Directly

```
abap2ts::clear_context
abap2ts::add_object_context({ name, type, description, fields, methods, references, metadata })
abap2ts::analyze_context
abap2ts::generate_ts_doc({ language: "zh", outputDir: "./output" })
```

---

## MCP 工具参考 / MCP Tools Reference

| 工具 / Tool | 说明 / Description |
|-------------|-------------------|
| `add_object_context` | 注册 ABAP 对象及元数据 / Register an ABAP object and its metadata |
| `list_contexts` | 查看已注册对象 / View all registered objects |
| `clear_context` | 重置会话 / Reset the session |
| `analyze_context` | 构建依赖图，返回生成顺序 / Build dependency graph, suggest generation order |
| `generate_ts_doc` | 生成技术规格说明书 Word 文档 / Generate Technical Specification Word document |
| `list_templates` | 列出可用 Handlebars 模板 / List available `.hbs` templates |
| `get_template` | 读取模板源码 / Read a template source |

### `generate_ts_doc` 参数 / Parameters

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `"zh"` \| `"en"` | `"zh"` | 文档语言 / Document language |
| `sections` | `string[]` | 全部 4 章 | 章节顺序：`background`, `objects`, `flowchart`, `code` |
| `customTitles` | `object` | — | 按 section key 覆盖章节标题 / Override chapter titles by section key |
| `outputDir` | `string` | `./output` | 输出目录 / Output directory |

---

## 输出文件 / Output Files

每次生成产出两个文件 / *Two files are generated each run:*

| 文件 | 格式 | 说明 |
|------|------|------|
| `<NAME>_TS.docx` | Word | 完整技术规格说明书（四章节，含嵌入流程图） |
| `<NAME>_FLOW.md` | Markdown | 流程图 Mermaid 代码块，可在 GitHub / VS Code / Typora 直接渲染 |

---

## 支持的 ABAP 对象类型 / Supported ABAP Object Types

`PROG` · `CLAS` · `INTF` · `FUNC` · `FUGR` · `BADI` · `ENHS` · `CDS` · `BDEF` · `TABL` · `STRU` · `DTEL` · `DOMA` · `TTYP` · `VIEW`

支持任意字符串类型 — 在 `templates/` 目录添加对应 `<type>.hbs` 文件即可扩展。
*Any string is accepted — add a matching `<type>.hbs` template to extend.*

---

## 扩展自定义模板 / Adding Custom Templates

1. 在 `templates/` 目录创建 `<type>.hbs`（如 `templates/cds.hbs`）
2. 可用 Handlebars helpers：`{{abapToTs type}}`、`{{pascalCase name}}`、`{{camelCase name}}`、`{{isoDate}}`
3. 无需修改任何代码，生成器自动发现新模板

*Create `templates/<type>.hbs`, use the available helpers, no code changes needed.*

---

## 开发命令 / Development

```bash
npm run build      # 编译 TypeScript → dist/ / Compile TS → dist/
npm run dev        # 开发模式（无需 build）/ Dev mode (no build needed)
npm run typecheck  # 类型检查 / Type-check only
```

---

## 依赖 / Dependencies

| 包 | 版本 | 用途 |
|----|------|------|
| `@modelcontextprotocol/sdk` | ^1.12.0 | MCP Server transport |
| `@mermaid-js/mermaid-cli` | latest | Mermaid → PNG 渲染 / Flowchart rendering |
| `docx` | ^9.x | Word 文档生成 / Word document generation |
| `handlebars` | ^4.7.8 | 模板渲染 / Template rendering |
| `zod` | ^3.23.8 | 输入校验 / Input validation |

---

## License

Internal SAP use. See repository for license details.
