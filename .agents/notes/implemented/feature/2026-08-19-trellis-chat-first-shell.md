# Agent Note: Trellis chat-first shell restoration

Status: implemented

English | [中文](2026-08-19-trellis-chat-first-shell.zh.md)

## Problem

An earlier iteration replaced the regular DeepSeek Harness web shell with a standalone Trellis surface (`ui-trellis-shell`) registered into the built-in `root` slot. That shadowed the layout plugin, which removed the center conversation composer entirely — the user lost the basic DeepSeek Chat interaction: talking to the agent, web search, and chat-first document capture.

## Decision

1. **Remove the root-slot shadow shell.** Delete `@deepseek-ai/dsh-client-ui-trellis-shell` and its profile row, TypeScript references, and bundle dependency. The regular `ui-layout` + `ui-conversation` shell renders again, so the center chat composer is always present.
2. **Keep the Trellis UI as conversation-slot plugins.** `ui-trellis-graph` stays a keyed `tool.call.toolview` renderer for `trellis_graph`; `ui-trellis-browser` stays a `conversation.session.header.utilities` drawer; `ui-trellis-knowledge` stays a `conversation.view` tab plus a compact `conversation.input.dock` above the composer. No Trellis surface owns the root slot.
3. **Chat-first collection.** `InputBar` accepts text documents and images natively; `dsh-file-upload` owns PDF/DOCX/XLSX and binary uploads. The vendor client sets `data-dsh-file-upload` on `<html>`, and `InputBar` defers unsupported files to it instead of rejecting them, avoiding duplicate intake. The Trellis system-prompt section treats a standalone URL, a `[Trellis document]` block, or an uploaded/`@`-referenced file with no other task as an archive request.
4. **Re-enable web search for the Trellis profile.** The base composition ships `web_search` over DeepSeek native search; the Trellis overlay re-enables `tool-web` with `fetch: false` (search only, no provider-arbitrary fetch).
5. **Fix the workspace build.** `tsdown` excludes vendored external DSH plugins (they ship their own build scripts) so `pnpm build` no longer fails on packages that do not follow the repository `lib/types` convention.
6. **Data honesty and UI polish.** `TrellisKnowledgeView` no longer renders hard-coded sample documents; it starts empty and polls/refreshes from `/api/trellis/knowledge`. The knowledge dock, favicon, boot wordmark, and browser/knowledge surfaces use theme tokens and a consistent green Trellis accent.

## Alternatives considered

- **Keeping the standalone shell and embedding a second composer.** Rejected: two input surfaces split the capture path and fight for session state.
- **Moving Trellis UI into the right details column only.** Rejected: the knowledge hub is wide (ledger, relations, graph) and needs a full conversation-view tab; the input dock covers the compact state.

## Consequences

- `pnpm trellis:web` boots the normal three-column chat shell with the Trellis knowledge hub as a view tab and the knowledge dock above the composer.
- Pasting a URL or text document, or dropping a PDF, reaches the agent through the single composer and is archived into the Trellis knowledge graph.
- The default web profile is unchanged except for the restored chat shell; Trellis-specific rows only exist in `examples/trellis/cordis.yml`.
