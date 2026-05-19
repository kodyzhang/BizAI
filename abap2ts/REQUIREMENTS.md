# Requirements

## Functional Requirements

### FR-01 — ABAP Object Reading
- System MUST connect to SAP via mcp-abap-adt MCP server
- System MUST support reading: ABAP Programs (PROG), Classes (CLAS), Interfaces (INTF), Function Modules (FUNC), BAdI Implementations (BADI), CDS Views (CDS), RAP Behavior Definitions (BDEF), Transparent Tables (TABL), Structures (STRU), Data Elements (DTEL), Domains (DOMA)
- System MUST auto-traverse dependent objects (max 2 levels deep)
- System MUST NOT fabricate or guess ABAP content — all data must come from SAP

### FR-02 — Context Management
- System MUST maintain an in-memory context store per session
- System MUST support registering metadata: name, type, description, fields[], methods[], references[], metadata{}
- System MUST build a dependency graph and produce topological generation order
- System MUST support resetting context between sessions

### FR-03 — Technical Specification Document Generation
- System MUST generate `.docx` Word documents
- Default document MUST contain exactly 4 chapters:
  1. Development Background & Objectives
  2. Development Object List (tabular format)
  3. Core Logic & Process Flow (dependency table + Mermaid flowchart syntax)
  4. Key Code Analysis (parameter tables + annotated source code)
- Chapter 4 MUST display annotated ABAP source code when provided via `metadata.annotatedCode`
- Annotation lines (`* [注]` / `* [Note]`) MUST be visually distinguished from code (green color, italic)

### FR-04 — Language Support
- System MUST support Chinese (zh) and English (en) output
- Default language MUST be Chinese
- All chapter titles, table headers, and labels MUST switch based on selected language

### FR-05 — Custom Template
- System MUST accept user-defined document structure (section list)
- Agent MUST map user sections to available content generators
- System MUST use user-provided section titles in the final document
- Unmappable sections MUST be skipped with a notification

### FR-06 — User Interaction (Claude Code Skill)
- Skill MUST use `AskUserQuestion` tool for object type, language, and template selection
- Skill MUST execute end-to-end without confirmation checkpoints
- Skill MUST communicate with user in Chinese

---

## Non-Functional Requirements

### NFR-01 — Security
- SAP credentials MUST be stored in a local `.env` file, never in source code
- `.env` / `sap.env` files MUST be excluded from version control via `.gitignore`
- Output files (`.docx`, `.ts`) MUST be excluded from version control
- Generated documents MUST NOT contain SAP system hostnames or credentials

### NFR-02 — Performance
- Context store operations MUST be O(1) (hash map)
- Dependency graph construction MUST complete in < 100ms for ≤ 100 objects
- Document generation MUST complete in < 5 seconds for typical SAP programs

### NFR-03 — Extensibility
- New ABAP object types MUST be supportable by adding a `.hbs` template file only
- No source code changes MUST be required for new template types
- MCP tool schema MUST accept any string as object type

### NFR-04 — Compatibility
- Node.js ≥ 18 (ESM module support required)
- MCP SDK `@modelcontextprotocol/sdk` ≥ 1.12.0
- docx ≥ 9.x for Word document generation
- Must work with SAP on-premise systems via ADT (SAP NetWeaver ABAP 7.40+)
- Must work with SAP S/4HANA systems

---

## System Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.12.0 | MCP Server transport |
| `handlebars` | ^4.7.8 | Template rendering |
| `docx` | ^9.x | Word document generation |
| `zod` | ^3.23.8 | Input validation |
| `typescript` | ^5.7.0 | Type safety |

### External Services
| Service | Protocol | Purpose |
|---------|----------|---------|
| SAP ABAP system | HTTPS / ADT REST API | Read ABAP objects |
| mcp-abap-adt | stdio (MCP) | SAP ADT adapter |

---

## Constraints

- **No cloud dependency**: Operates fully offline once SAP connection is established
- **No database**: All state is in-memory per session; context does not persist between restarts
- **Single-session**: Context store is not shared across concurrent Claude Code instances
- **Max dependency depth**: 2 levels to prevent infinite loops in circular dependencies
