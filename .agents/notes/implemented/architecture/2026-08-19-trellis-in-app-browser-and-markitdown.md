# Agent Note: Trellis in-app browser, MarkItDown converter, and knowledge ingestion

Status: implemented

English | [中文](2026-08-19-trellis-in-app-browser-and-markitdown.zh.md)

## Problem

When studying online courses, reading documentation, or researching materials on the web, users need to interactively browse web pages within their learning environment, transform messy HTML into clean structured Markdown, and archive content directly into their relational knowledge graph.

Previously, web reading required switching between external applications and manually copying text into chat prompts. Web extraction lacked a structured Markdown pipeline that preserves document hierarchy, tables, blockquotes, and code blocks while stripping noisy navigational residue.

## Decision

1. **Microsoft MarkItDown Architecture**: Implement a pure TypeScript Markdown conversion engine in `@trellis/trellis` (`markitdown.ts`) inspired by Microsoft MarkItDown that strips scripts, styles, and nav elements, converts HTML tables into standard GFM tables, preserves code block indentation and syntax tags, and extracts document titles, links, and excerpts.
2. **In-App Chromium Web Browser & Clipper Client Plugin**: Create `@deepseek-ai/dsh-client-ui-trellis-browser` registering into the conversation view slot (`conversation.view`, id: `trellis_browser`) providing navigation controls, 1-click "Clip to Trellis" action, external Google Chrome bridge for authenticating with user Google accounts, MarkItDown reader mode, and a course bookmarks drawer.
3. **Knowledge Ingestion Pipeline**: Wire `convertToMarkdown` directly into `TrellisKnowledge.ingest` so all ingested web pages, documents, and files are normalized into structured Markdown with provenance metadata before storage in SQLite domain tables.

## Alternatives considered

- **Puppeteer/Playwright Heavy Headless Browsers**: Rejected because running full headless Chrome processes in the background adds heavy binary dependencies, slows startup, and creates host environment portability constraints compared to iframe web embedding combined with lightweight MarkItDown HTML processing.
- **External Obsidian App Integration**: Rejected because users want native interactive graph visualization and seamless knowledge clipping built directly inside the Trellis product rather than maintaining a separate Obsidian vault.

## Consequences

- Web and document ingestion in Trellis produces clean, formatted Markdown without manual copy-pasting.
- Users can browse study materials and online courses directly within the conversation shell and clip them with one click into their knowledge graph.
- Restricted or authenticated web pages can be launched directly into system Google Chrome while maintaining clipping capabilities.
