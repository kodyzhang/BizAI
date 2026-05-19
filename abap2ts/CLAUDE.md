# abap2ts — Technical Specification Agent

## 项目说明

MCP Server，连接 SAP 系统读取 ABAP 对象，生成**技术规格说明书（Technical Specification）Word 文档（.docx）**，同时输出 Mermaid 流程图 Markdown 文件。配合 `mcp-abap-adt` 使用：前者负责从 SAP 读取对象，本服务负责上下文管理和文档生成。

## 常用命令

```bash
npm run build      # 编译源码 → dist/
npm run dev        # 开发模式（tsx 直接运行，无需 build）
npm run typecheck  # 类型检查（不产生输出）
```

## 架构

```
src/
├── server.ts              # MCP Server 入口，注册 9 个工具
├── types.ts               # 共享类型定义（AbapObjectContext 等）
├── core/
│   ├── context-store.ts   # 单例内存存储，Map<name, AbapObjectContext>
│   ├── dependency-graph.ts # 依赖图构建 + 拓扑排序
│   ├── analyzer.ts        # 跨对象整体分析
│   ├── doc-generator.ts   # Word (.docx) 文档生成 + Mermaid PNG 渲染
│   └── generator.ts       # Handlebars 渲染（legacy，扩展模板用）
└── tools/
    ├── context.ts         # add_object_context / list_contexts / clear_context
    ├── doc.ts             # generate_ts_doc（主入口）
    ├── generate.ts        # analyze_context / generate_ts / generate_all
    └── template.ts        # list_templates / get_template
templates/                 # 可扩展 .hbs 模板文件
output/                    # 生成的 .docx / _FLOW.md 落地目录（gitignored）
```

## MCP 工具说明

| 工具 | 作用 |
|------|------|
| `add_object_context` | 写入单个 SAP 对象的元数据 |
| `list_contexts` | 查看已积累的对象列表 |
| `clear_context` | 重置当前 session |
| `analyze_context` | 依赖图分析，返回生成顺序 |
| `generate_ts_doc` | 生成技术规格说明书 .docx + _FLOW.md（**主工具**） |
| `generate_ts` | 单对象 Handlebars 渲染（legacy） |
| `generate_all` | 批量 Handlebars 渲染（legacy） |
| `list_templates` | 列出可用模板 |
| `get_template` | 查看模板内容 |

## 输出文件

每次调用 `generate_ts_doc` 产出两个文件：

| 文件 | 说明 |
|------|------|
| `<NAME>_TS.docx` | 完整技术规格说明书（四章节，第三章嵌入 Mermaid 流程图 PNG） |
| `<NAME>_FLOW.md` | 流程图 Mermaid 代码块，可在 GitHub / VS Code / Typora 直接渲染 |

## 模板（Handlebars helpers）

`generator.ts` 注册了以下 helper，可在 `.hbs` 模板中使用：

| Helper | 说明 |
|--------|------|
| `{{abapToTs type}}` | ABAP 数据类型映射 |
| `{{pascalCase name}}` | 转 PascalCase |
| `{{camelCase name}}` | 转 camelCase |
| `{{upperCase name}}` | 转大写 |
| `{{lowerCase name}}` | 转小写 |
| `{{isoDate}}` | 当前 ISO 时间戳 |

内置模板：`default / clas / intf / stru / tabl / badi / cds / func / bdef / prog`

新增对象类型：在 `templates/` 目录添加 `<type>.hbs` 即可自动识别，无需修改代码。

## 与 mcp-abap-adt 的协作

本服务**不**直接连接 SAP，只负责：
1. 接收已解析的对象元数据（由 AI Agent 通过 `mcp-abap-adt` 从 SAP 读取）
2. 积累上下文，构建依赖图
3. 生成 Word 文档和 Mermaid 流程图文件

完整工作流见 `~/.claude/skills/abap2ts/SKILL.md`
