# @deepseek-ai/dsh-client-ui-trellis-browser

English | [中文](README.zh.md)

In-app Chromium web browser, course workspace, and MarkItDown clipper view for Trellis in the DeepSeek Harness web client.

## Features

- In-app Chromium web browser supporting live navigation, history (back/forward), reload, and URL bar.
- 1-Click "Clip to Trellis" knowledge base ingestion that triggers MarkItDown extraction and Agent relational graph linking.
- "Open in Chrome" external browser launcher to preserve existing Google and university login sessions.
- MarkItDown Reader Mode toggle for distraction-free structured Markdown viewing of online course pages and documentation.
- Course and resource bookmarks drawer with saved online learning sites.

## Model Experience

None, as this package is a browser-side UI view plugin and registers nothing model-facing.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Sites with strict `X-Frame-Options: SAMEORIGIN` or CSP can be viewed via Reader Mode or launched directly into external Chrome.
