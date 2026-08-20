# @deepseek-ai/dsh-client-ui-trellis-shell

English | [中文](README.zh.md)

Trellis standalone shell: a minimal full-screen knowledge surface for the DeepSeek Harness web client. It shadows the regular chat/workspace layout and provides direct information capture, automatic organization through the Trellis agent tools, and a focused document analysis panel.

## Features

- Full-screen root surface with no sidebar, workspace list, or conversation chrome.
- Capture bar accepts a URL, pasted text, or dropped text document.
- Capture prompts run through a hidden Trellis session; the knowledge list refreshes automatically after the agent finishes.
- Document list with search by title, summary, and tags.
- Detail drawer shows stored document content and provenance.
- Analysis panel sends focused questions to the agent and renders the resulting analysis transcript.
- Knowledge canvas maps documents as draggable cards and relations as edges, with pan, zoom, and persisted card positions.

## Integrated Plugins

The Trellis profile activates several DSH plugins under the hood:

- `dsh-read-url` — cleaner URL reading, encoding detection, batch reads, and SPA rendering for the agent.
- `dsh-deepread` — five-mode deep reading, knowledge maps, PDF extraction, and mindmap exports.
- `dsh-file-upload` — bundled MarkItDown document conversion and a `read_document` tool for PDF/DOCX/XLSX etc.
- `dsh-memory-palace` — user/workspace Markdown memory injected into agent turns.
- `@0xsline/dsh-spotlight` — keyboard-first command palette overlay.
- `@dph/taskboard` — session task board; its button mounts in the Trellis header through a `data-dph-taskboard-mount` anchor.
- `dsh-zotero` — Zotero library search, evidence extraction, and citation generation.
- `dsh-plugin-academic-writing` — paper outline, abstract, citation, phrasing QA, and submission checklist tools.

## Model Experience

This package is a browser-side presentation plugin. It does not register model-facing tools or prompt sections itself. Capture and analysis prompts are user-visible through the session log but are not part of this package's model-facing contract.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The shell still runs the standard web client underneath; it hides the chat/workspace UI rather than removing those host services.
- Text files dropped into the capture bar are read in the browser; PDF/DOCX/XLSX files are uploaded through `dsh-file-upload` and the agent reads them with `read_document` before archiving into Trellis.
- The knowledge canvas currently maps documents and relations; analysis branches are not yet represented as separate canvas nodes.
