# Agent Note: Trellis workbench shell restored

Status: implemented

English | [中文](2026-08-20-trellis-workbench-shell-restored.zh.md)

## Problem

A chat-first experiment restored the regular three-column conversation shell for the Trellis profile. The user's actual workflow is chat-free and they preferred the original full-screen Trellis workbench UI. The standalone desktop packaging layer was also no longer needed.

## Decision

1. **Restore the full-screen workbench shell.** Add `@deepseek-ai/dsh-client-ui-trellis-shell` back as a client plugin that registers the full-screen `TrellisHome` component into the built-in `root` slot at priority `-1`. Lower priority wins for single slots, so the shell shadows the regular chat layout while sessions/workspaces remain underneath.
2. **Keep the shell integrated with the new features.** The shell keeps the capture bar, searchable document ledger, draggable knowledge canvas, document details, deep-read modes, and analysis transcript. It adds a compact companion browser drawer whose clip action returns the page to the shell capture bar.
3. **Keep the conversation-slot Trellis views available but disabled in this profile.** `ui-trellis-graph`, `ui-trellis-browser`, and `ui-trellis-knowledge` stay enabled in the default Web profile and are disabled for the standalone shell profile, which owns those surfaces itself.
4. **Remove the desktop packaging layer.** The `desktop/` scaffold and its generated build are deleted; `pnpm trellis:web` remains the only run target.
5. **Keep host-side collection behavior.** `dsh-file-upload`, `dsh-read-url`, `dsh-deepread`, and the Trellis tools stay mounted; binary drops upload through `/api/upload` and are archived via `read_document`, and `tool-web` stays enabled for DeepSeek native search.

## Alternatives considered

- **Embedding the existing browser view by value import.** Rejected because the client-bundle purity gate forbids cross-plugin value imports; the shell owns a compact browser panel instead.
- **Deleting the shell and teaching the conversation UI to hide its chat chrome.** Rejected: that couples the workbench to the shared three-column layout and reintroduces exactly the coupling the original shell avoided.

## Consequences

- `pnpm trellis:web` opens the original full-screen Trellis workbench with the new browser drawer and all current knowledge features.
- The default Web profile still renders the regular chat shell; only the Trellis overlay switches to the standalone workbench.
