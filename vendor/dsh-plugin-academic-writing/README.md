# dsh-plugin-academic-writing

An **academic writing toolkit** for [DeepSeek Harness](https://github.com/deepseek-ai/dsh) agents. The model composes the prose; the plugin supplies structure, formats, and deterministic checks.

## Install

```bash
dsh plugin --profile <profile> add dsh-plugin-academic-writing
```

Restart DSH. The `academic_writing` tool is registered host-wide.

## Tool

| action | purpose |
| --- | --- |
| `outline` | Paper outline skeleton (research / review / proposal / essay), optional section cap |
| `title` | Title variants from style templates (descriptive, question, declarative, colon) |
| `abstract` | Structured abstract skeleton — background / methods / results / conclusion |
| `citation` | Reference entry formatted as **GB/T 7714**, **APA 7**, or **MLA 9** |
| `check` | Phrasing QA on a passage (passive voice, first person, hedging, sentence length) |
| `checklist` | Pre-submission checklist (ethics, conflict of interest, data, funding, formatting) |

## Config

All optional, on the composition row's `config`:

| key | default | meaning |
| --- | --- | --- |
| `personaSection` | `true` | register the academic prompt-guidance section |
| `sectionOrder` | `6` | prompt section order (persona is 0, ascending) |

## Design

Pure logic (`lib/academic.js`) has zero DSH/Cordis imports and is unit-tested in isolation; `lib/index.js` is the thin Cordis plugin wiring the tool and the prompt section. No filesystem access — everything is deterministic and side-effect free.

## License

MIT
