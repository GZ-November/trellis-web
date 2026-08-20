# @deepseek-ai/dsh-client-ui-trellis-shell

English | [中文](README.zh.md)

Trellis full-screen knowledge workbench shell for the DeepSeek Harness web client. It registers a chat-free root surface: a capture bar for links and documents, a searchable document ledger, a draggable knowledge canvas, document details, deep-read actions, analysis transcript, and an in-app companion browser drawer.

## Features

- Chat-free full-screen workbench UI over the existing sessions/workspaces services.
- Capture bar accepts URLs, pasted text, text documents, and uploaded binary files (PDF/DOCX/XLSX via `dsh-file-upload`).
- Knowledge ledger and searchable document list backed by `/api/trellis/knowledge`.
- Draggable, pannable, zoomable knowledge canvas with persisted card positions.
- Document detail panel with source provenance, deep-read modes, and grounded analysis.
- Companion browser drawer with one-click clip back into the capture bar.

## Model Experience

None, as this package is a browser-side UI shell and registers nothing model-facing.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The shell intentionally hides the regular chat columns; switch to the default Web profile when a full conversation surface is required.
