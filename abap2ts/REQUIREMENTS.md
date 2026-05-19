# abap2ts — Requirements & Setup Guide

> 面向安装者的完整配置手册 + 功能规格说明
> *Complete setup guide for installers + functional specification*

---

## 目录 / Contents

1. [前置条件 / Prerequisites](#1-前置条件--prerequisites)
2. [安装 abap2ts](#2-安装-abap2ts)
3. [安装并配置 mcp-abap-adt](#3-安装并配置-mcp-abap-adt)
4. [配置 Claude Code MCP Server](#4-配置-claude-code-mcp-server)
5. [安装 /abap2ts Skill](#5-安装-abap2ts-skill)
6. [验证安装](#6-验证安装)
7. [功能规格](#7-功能规格)

---

## 1. 前置条件 / Prerequisites

### 1.1 本地环境

| 工具 | 最低版本 | 说明 | 安装 |
|------|---------|------|------|
| Node.js | **≥ 18** | ESM 模块支持必需 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | 随 Node.js 自带 | — |
| Git | 任意 | 克隆仓库用 | [git-scm.com](https://git-scm.com) |
| Claude Code CLI | latest | AI Agent 运行环境 | `npm install -g @anthropic-ai/claude-code` |

```bash
# 快速检查
node -v      # 应显示 v18.x 或更高
npm -v
git --version
claude --version
```

### 1.2 SAP 系统要求

| 条件 | 说明 |
|------|------|
| SAP 系统版本 | NetWeaver ABAP 7.40+ 或 S/4HANA（On-Premise / BTP ABAP） |
| ADT 服务已激活 | ICF 节点 `/sap/bc/adt` 必须处于激活状态（事务码 SICF） |
| 用户权限 | 需要 `S_ADT_RES` 授权对象（ADT 访问权限） |
| 网络连通 | 本地机器能通过 HTTPS 访问 SAP 系统（含自签证书场景） |

> **验证 ADT 是否可用**：在浏览器中访问 `https://<sap-host>:<port>/sap/bc/adt/`，能看到 XML 响应即表示正常。

---

## 2. 安装 abap2ts

```bash
# 1. 克隆仓库
git clone https://github.com/kodyzhang/BizAI.git
cd BizAI/abap2ts

# 2. 安装依赖（包含 @mermaid-js/mermaid-cli，用于流程图 PNG 渲染）
npm install

# 3. 编译 TypeScript
npm run build
# 产出：dist/server.js

# 4. 记录 dist/server.js 的绝对路径（后续配置 MCP 用）
echo "$(pwd)/dist/server.js"
```

---

## 3. 安装并配置 mcp-abap-adt

`mcp-abap-adt` 是连接 SAP 系统的 MCP 适配器，abap2ts 依赖它读取 ABAP 对象。

### 3.1 安装

```bash
# 方式一：npm 全局安装（推荐）
npm install -g @sap/mcp-abap-adt

# 方式二：从源码安装
git clone https://github.com/SAP/mcp-abap-adt.git
cd mcp-abap-adt
npm install && npm run build
```

### 3.2 创建 SAP 连接配置文件

在**任意安全目录**（建议 `~/.sap/`）创建 `sap.env`：

```bash
mkdir -p ~/.sap
touch ~/.sap/sap.env
chmod 600 ~/.sap/sap.env   # 仅当前用户可读
```

编辑 `~/.sap/sap.env`，填入实际值：

```env
# SAP 系统连接信息
SAP_URL=https://<your-sap-host>:<port>
SAP_CLIENT=<client-number>          # 如 100
SAP_USERNAME=<your-sap-user>
SAP_PASSWORD=<your-sap-password>
SAP_SYSTEM_TYPE=onprem              # onprem 或 cloud

# SAP 使用自签证书时必须设置
NODE_TLS_REJECT_UNAUTHORIZED=0
```

> **安全提示**：`sap.env` 含敏感凭证，绝不能提交到版本控制。

### 3.3 记录 mcp-abap-adt 路径

```bash
# 全局安装方式
which mcp-abap-adt           # 或
ls $(npm root -g)/@sap/mcp-abap-adt/bin/

# 源码安装方式
echo "$(pwd)/bin/mcp-abap-adt.js"
```

---

## 4. 配置 Claude Code MCP Server

编辑 Claude Code 配置文件 `~/.claude/settings.json`，添加两个 MCP Server：

```bash
# 打开配置文件
open ~/.claude/settings.json
# 或
code ~/.claude/settings.json
```

在 `mcpServers` 节点下添加（替换 `<path>` 为实际路径）：

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/mcp-abap-adt/bin/mcp-abap-adt.js",
        "--transport=stdio",
        "--env-path=/Users/<you>/.sap/sap.env",
        "--system-type=onprem"
      ]
    },
    "abap2ts": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/BizAI/abap2ts/dist/server.js"
      ]
    }
  }
}
```

**路径填写参考**：

| 配置项 | 示例值（macOS） |
|-------|----------------|
| `mcp-abap-adt.js` 路径 | `/opt/homebrew/lib/node_modules/@sap/mcp-abap-adt/bin/mcp-abap-adt.js` |
| `sap.env` 路径 | `/Users/yourname/.sap/sap.env` |
| `dist/server.js` 路径 | `/Users/yourname/BizAI/abap2ts/dist/server.js` |

> **配置生效**：修改 `settings.json` 后需**重启 Claude Code**。

---

## 5. 安装 /abap2ts Skill

Skill 是引导 AI 完成 TS 生成流程的提示词文件，需放到 Claude Code 的 skills 目录：

```bash
# 创建 skill 目录
mkdir -p ~/.claude/skills/abap2ts

# 从项目中复制（如果项目包含 SKILL.md）
# 或从仓库 Wiki / Releases 下载最新版

# SKILL.md 应放在以下路径：
# ~/.claude/skills/abap2ts/SKILL.md
```

安装完成后在 Claude Code 中输入 `/abap2ts` 即可触发。

---

## 6. 验证安装

### 6.1 验证 MCP Server 加载

在 Claude Code 中运行：

```
请调用 abap2ts::list_contexts 工具
```

若返回 `Context store is empty` 则说明 abap2ts MCP Server 已正常加载。

### 6.2 验证 SAP 连接

```
请调用 mcp-abap-adt::SearchObject，搜索对象名 "DEMO*"
```

若返回搜索结果（即使为空列表）则说明 SAP 连接正常。

若报错，检查：
- `sap.env` 中的 URL / 用户名 / 密码是否正确
- SAP 系统的 ADT ICF 节点是否已激活（事务码 SICF）
- 防火墙 / VPN 是否已连接

### 6.3 端到端测试

输入 `/abap2ts`，按引导选择一个已知的 ABAP 程序名（如 `RSDEMO01`），确认能生成 `.docx` 文件。

---

## 7. 功能规格

### FR-01 — ABAP 对象读取
- 必须通过 mcp-abap-adt MCP server 连接 SAP
- 支持读取：PROG、CLAS、INTF、FUNC、BADI、CDS、BDEF、TABL、STRU、DTEL、DOMA
- 自动遍历依赖对象，最深 2 层
- 禁止捏造或猜测 ABAP 内容，所有数据必须来自 SAP

### FR-02 — 上下文管理
- 每个 session 维护一个内存上下文存储
- 支持注册：name、type、description、fields[]、methods[]、references[]、metadata{}
- `metadata.annotatedCode`：带 `* [注]` 注解的关键代码段（第四章内容来源）
- `metadata.mermaidFlow`：业务流程 Mermaid 代码（第三章流程图来源）
- 支持构建依赖图并生成拓扑排序的生成顺序

### FR-03 — 文档生成
- 生成 `.docx` Word 文档 + `_FLOW.md` Mermaid 文件
- 默认 4 章：开发背景 / 对象清单 / 核心流程（Mermaid PNG）/ 关键代码解析
- `* [注]` 注解行以绿色斜体显示，与代码视觉区分
- 流程图 PNG 按页面双向约束缩放（最大 576×620pt），确保不超页

### FR-04 — 语言支持
- 支持中文（zh，默认）和英文（en）
- 章节标题、表头、标签全部随语言切换

### FR-05 — 自定义模板
- 接受用户自定义文档结构（章节列表）
- AI 将用户章节映射到 4 个内容生成器（background / objects / flowchart / code）
- 无法映射的章节跳过并通知用户

### FR-06 — 用户交互
- Phase 1 通过 `AskUserQuestion` 一次性收集 4 个问题（对象类型 / 对象名称 / 语言 / 模板）
- 全程无确认检查点，端到端自动执行
- 与用户全程使用中文沟通

---

## 非功能规格

### NFR-01 — 安全
- SAP 凭证必须存储在本地 `.env` 文件，不得出现在源码中
- `.env` / `sap.env` 必须通过 `.gitignore` 排除版本控制
- 生成的文档不得包含 SAP 系统主机名或凭证

### NFR-02 — 性能
- Document generation < 5 秒（含 Mermaid PNG 渲染）
- 上下文操作 O(1)，依赖图构建 < 100ms（≤ 100 个对象）

### NFR-03 — 可扩展性
- 新 ABAP 对象类型只需在 `templates/` 目录添加 `.hbs` 文件，无需修改代码
- MCP tool schema 接受任意字符串作为对象类型

### NFR-04 — 兼容性
- Node.js ≥ 18（ESM 支持必需）
- SAP NetWeaver ABAP 7.40+ 或 S/4HANA（On-Premise / BTP ABAP）
- Claude Code CLI latest
- macOS / Linux（Windows 未测试）

---

## 依赖清单

| 包 | 版本 | 用途 |
|----|------|------|
| `@modelcontextprotocol/sdk` | ^1.12.0 | MCP Server transport |
| `@mermaid-js/mermaid-cli` | latest | Mermaid → PNG 渲染（流程图嵌入 Word）|
| `docx` | ^9.x | Word 文档生成 |
| `handlebars` | ^4.7.8 | Handlebars 模板渲染（扩展模板用）|
| `zod` | ^3.23.8 | 输入校验 |
| `typescript` | ^5.7.0 | 类型安全 |

| 外部服务 | 协议 | 用途 |
|---------|------|------|
| SAP ABAP 系统 | HTTPS / ADT REST API | 读取 ABAP 对象 |
| mcp-abap-adt | stdio (MCP) | SAP ADT 适配器 |
