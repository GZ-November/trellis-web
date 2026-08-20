// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KnowledgeCanvas } from '../src/client/KnowledgeCanvas.tsx'

describe('KnowledgeCanvas Component', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders document cards on the canvas', () => {
    render(
      <KnowledgeCanvas
        documents={[
          { id: 'a', title: 'Alpha', summary: 'First document', kind: 'document', tags: ['x'] },
          { id: 'b', title: 'Beta', summary: 'Second document', kind: 'note', tags: ['y'] },
        ]}
        edges={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('knowledge-canvas')).toBeDefined()
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Beta')).toBeDefined()
  })

  it('renders relation edges between connected documents', () => {
    render(
      <KnowledgeCanvas
        documents={[
          { id: 'a', title: 'Alpha', summary: 'First document', kind: 'document', tags: ['x'] },
          { id: 'b', title: 'Beta', summary: 'Second document', kind: 'note', tags: ['y'] },
        ]}
        edges={[{
          id: 'r1', source: 'a', target: 'b', kind: 'references', evidence: 'evidence', confidence: 0.9,
        }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('knowledge-canvas').querySelector('line')).not.toBeNull()
  })
})
