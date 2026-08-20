# @trellis/trellis

English | [中文](README.zh.md)

Trellis is a personal academic, career, and knowledge workbench built on DeepSeek Harness. It provides local-first SQLite persistence, knowledge document ingestion, relationship graph management, and agent-facing tools.

## Features

- Local-first SQLite storage through DSH `storageDomain`.
- Ingest and archive web pages, text documents, notes, and pasted content with persistent provenance metadata.
- Directed, evidence-bearing knowledge relationships with confidence ratings and backlinks.
- Bounded graph projections and keyword-based knowledge search for both the agent and UI views.
- Import and track job postings, contacts, applications, courses, degree requirements, term plans, sources, and competitions.

## Tools

- `trellis_ingest` — Ingest a URL or document content with summary, tags, and initial relations.
- `trellis_search` — Search knowledge documents by text query with excerpt snippets and ranking scores.
- `trellis_read` — Retrieve full document content along with incoming backlinks and outgoing relations.
- `trellis_connect` — Add a directed, evidence-bearing relation between two existing documents.
- `trellis_graph` — Return a bounded projection of the knowledge graph and its neighbors.
- `trellis_archive` — Legacy web page and note archiver.
- `trellis_job_import` / `trellis_job_list` — Import and list tracked job postings.
- `trellis_contact_import` — Record professional contacts and outreach stages.
- `trellis_application_upsert` — Create or update job application statuses.
- `trellis_note_create` — Create unstructured personal notes.
- `trellis_course_upsert` — Track course credits, grades, and prerequisites.
- `trellis_degree_requirement_upsert` — Record graduation requirement credit buckets.
- `trellis_academic_plan_upsert` — Plan term schedules and target GPAs.
- `trellis_source_register` — Register external information sources for periodic review.
- `trellis_competition_import` — Track competitions, hackathons, and scholarship deadlines.
- `trellis_summary` — Summarize workbench status across all domains.
- `trellis_link_note` — Link notes to workbench items.
- `trellis_export` — Export workbench records to Markdown or JSON.
- `trellis_skill_gap` — Compare job requirements against completed coursework.
- `trellis_graduation_forecast` — Audit credit progress against degree requirements.

## Model Experience

### Trellis tools and archiving

#### What the model sees

The plugin registers tool definitions for `trellis_ingest`, `trellis_search`, `trellis_read`, `trellis_connect`, `trellis_graph`, and the legacy workbench tools. When invoked, each tool executes against local SQLite storage and returns structured JSON responses matching `KnowledgeDocumentRecord`, `TrellisSearchHit`, `TrellisDocumentRead`, or `TrellisGraphSnapshot`.

#### Token effect

Tool definitions occupy tool-catalog context space while active. Executing a tool adds the JSON arguments and structured return payloads to conversation context tokens.

#### KV Cache effect

None: Trellis records are stored in SQLite via `storageDomain` and do not alter past request tokens.

## Known Limitations and Deferred Work

- PDF and DOCX binary parsing delegates to upstream tools; the intake path directly processes text formats.
- Remote URL fetching uses `ctx.web.fetch` without headless browser rendering for JavaScript-heavy single-page apps.
