# Agent Note: Trellis personal knowledge base, text document intake, and interactive relationship graph

Status: implemented

English | [中文](2026-08-19-trellis-knowledge-graph-ingest.zh.md)

## Problem

Users needed a personal knowledge management workbench within DeepSeek Harness that supports direct ingestion of web URLs and text documents from the conversation input, automatic agent-driven categorization and relation discovery, and interactive graph exploration with grounded provenance, evidence passages, and confidence scores. Existing workbench tools provided flat relational tables without document relation indexing, graph projection capabilities, or dedicated browser visualization.

## Decision

**Source-backed knowledge persistence.** Extended the Trellis domain schema with `knowledge_documents`, storing `KnowledgeDocumentRecord` rows indexed by content-derived IDs. Each record preserves its provenance (`KnowledgeSource`: URL with fetch metadata, text file name/media type, or pasted text), curated title, agent-authored summary, normalized tags, and directed `KnowledgeRelationRecord` entries carrying relationship kind, edge label, source evidence text, and confidence.

**Agent knowledge tools.** Registered five purpose-built knowledge tools on `ctx.tools`: `trellis_ingest` for idempotent document intake with optional automatic web fetching via `ctx.web.fetch`, `trellis_search` for keyword and tag retrieval with scored excerpts, `trellis_read` for complete document content with computed incoming backlinks, `trellis_connect` for appending evidence-bearing directed relations, and `trellis_graph` for returning bounded neighborhood graph snapshots.

**Conversation document intake.** Extended the `InputBar` drop and paste handling to admit common text document formats (`.md`, `.txt`, `.json`, `.csv`, `.xml`, `.yaml`, `.html`, `.org`) alongside images. Dropped documents are decoded and formatted as structured document blocks in the draft, with system prompt guidance directing the agent to automatically archive, summarize, tag, and link the ingested content.

**Interactive graph toolview.** Created `@deepseek-ai/dsh-client-ui-trellis-graph`, registering a keyed `tool.call.toolview` renderer for settled `trellis_graph` tool results. The component renders interactive force-directed layouts with node color coding, zoom-to-fit, click-to-center focus, search filtering, and an inspector side drawer detailing document summaries, source provenance, connected relations, and evidence passages.

**Deterministic testing and snapshots.** Added comprehensive unit tests across domain storage, tool execution, and browser UI rendering, paired with a keyless real Loader composition snapshot test in `examples/trellis/tests/trellis.snapshot.ts`.

## Alternatives considered

**Embedding an external desktop knowledge base or AGPL graph engine.** Rejected to preserve MIT licensing, zero external daemon requirements, and seamless integration with Harness SQLite persistence.

**Representing connections solely as unstructured inline text wikilinks.** Rejected because agent querying, bounded graph traversal, and confidence-scored visual edges require structured relation records with explicit source evidence.

## Consequences

Trellis functions as a self-contained, local-first knowledge workbench. Dropping documents or submitting URLs triggers automatic agent organization and relational indexing, viewable both via tool-calling conversational interaction and interactive visual graph inspection.
