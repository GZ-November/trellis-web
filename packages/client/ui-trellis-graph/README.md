# @deepseek-ai/dsh-client-ui-trellis-graph

English | [中文](README.zh.md)

Interactive graph visualization toolview for settled `trellis_graph` results in the DeepSeek Harness web client.

## Features

- Renders force-directed graph layouts for Trellis knowledge documents and directed relations using `force-graph`.
- Interactive node inspection panel displaying document summaries, tags, source provenance, connected relations, evidence passages, and confidence scores.
- Local node search and filtering within the current graph snapshot.
- Zoom-to-fit and click-to-center focus behaviors.

## Model Experience

None, as this package is a browser-side toolview plugin layer and registers nothing model-facing.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Large graphs beyond configured node limits render as a bounded local neighborhood.
- Edge creation is initiated through agent tool actions rather than direct canvas gesture editing.
