import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  normalizeSessionLog,
  normalizeStdout,
  type NormalizeContext,
} from '@deepseek-ai/dsh-acp-snapshot'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

const here = dirname(fileURLToPath(import.meta.url))
const configPath = join(here, 'fixtures', 'cordis.yml')
const binScript = fileURLToPath(new URL('../../headless-agent/tests/fixtures/headless-driver.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const expectedPath = join(here, 'snapshots', 'knowledge-ingest', 'stream-json.expected.jsonl')

interface JsonObject { [key: string]: unknown }

function parseJsonl(content: string): JsonObject[] {
  return content.split('\n').filter(line => line.trim().length > 0).map(line => JSON.parse(line) as JsonObject)
}

function normalizeStream(raw: string, cwd: string): string {
  const records = parseJsonl(raw)
  const sessionIds = [...new Set(records.flatMap(record => typeof record.sessionId === 'string' ? [record.sessionId] : []))]
  if (sessionIds.length !== 1) throw new Error(`Trellis snapshot streamed ${sessionIds.length} session ids`)
  const context: NormalizeContext = { sessionIds, cwd }
  const events = records.slice(0, -1).map((record) => {
    if (record.event === null || typeof record.event !== 'object' || Array.isArray(record.event)) {
      throw new Error('Trellis snapshot emitted an invalid session event')
    }
    return record.event as JsonObject
  })
  const normalizedEvents = parseJsonl(normalizeSessionLog(
    `${events.map(event => JSON.stringify(event)).join('\n')}\n`,
    context,
  ))
  const normalized = records.map((record, index) => index < normalizedEvents.length
    ? { ...record, event: normalizedEvents[index] }
    : record)
  return normalizeStdout(`${normalized.map(record => JSON.stringify(record)).join('\n')}\n`, context)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '{{timestamp}}')
}

describe('Trellis assembled transcript', () => {
  it('archives a document and returns the graph through the real Loader composition', async () => {
    let cwd = ''
    const result = await runLoaderSmoke({
      label: 'trellis-knowledge-ingest',
      tempDirPrefix: 'trellis-knowledge-',
      binScript,
      libBinScript: binScript,
      configPath,
      binArgs: [configPath, 'Archive and organize the attached Trellis document.'],
      tsconfigPath,
      inspect: async (runtimeCwd) => {
        cwd = runtimeCwd
        const stored = await readFile(join(runtimeCwd, '.storage', 'trellis.json'), 'utf8')
        expect(stored).toContain('Network effects')
        expect(stored).toContain('network-effects.md')
      },
    })
    expect(result.stderr).toBe('')
    await expect(normalizeStream(result.stdout, cwd)).toMatchFileSnapshot(expectedPath)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
