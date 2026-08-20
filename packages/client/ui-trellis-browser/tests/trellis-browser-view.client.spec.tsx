// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { TrellisBrowserDrawer, TrellisBrowserView } from '../src/client/index.ts'
import { apply } from '../src/client/index.ts'
import { apply as applyInvariant } from '../src/invariant.ts'
import { apply as applyHost } from '../src/index.ts'

const mockT: TranslateNS<'ui-trellis-browser'> = (key: string): string => key

type MockInputActions = NonNullable<ConvViewProps['inputActions']>

function createMockInputActions(setText: (text: string) => void): MockInputActions {
  return {
    setDraft: setText,
    addImages: () => false,
    removeImage: () => {},
    pruneImages: () => {},
    submit: () => {},
  }
}

describe('TrellisBrowserView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders initial browser toolbar, iframe, and actions', () => {
    render(<TrellisBrowserView t={mockT} />)
    expect(screen.getByTestId('trellis-browser-view')).toBeDefined()
    expect(screen.getByTestId('browser-iframe')).toBeDefined()
    expect(screen.getByRole('button', { name: 'back' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'forward' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'clip_to_trellis' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'open_chrome' })).toBeDefined()
  })

  it('navigates to a new URL on submit and enables back button', () => {
    render(<TrellisBrowserView t={mockT} />)
    const input = screen.getByRole('textbox', { name: 'URL' })
    fireEvent.change(input, { target: { value: 'https://coursera.org' } })
    fireEvent.submit(input)

    const iframe = screen.getByTestId('browser-iframe')
    expect(iframe.getAttribute('src')).toBe('https://coursera.org')
    expect(screen.getByRole('button', { name: 'back' })).toHaveProperty('disabled', false)

    // Click back
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.getByTestId('browser-iframe').getAttribute('src')).toBe('https://en.wikipedia.org/wiki/Computer_science')
    expect(screen.getByRole('button', { name: 'forward' })).toHaveProperty('disabled', false)

    // Click forward
    fireEvent.click(screen.getByRole('button', { name: 'forward' }))
    expect(screen.getByTestId('browser-iframe').getAttribute('src')).toBe('https://coursera.org')
  })

  it('normalizes URLs without protocol prefix', () => {
    render(<TrellisBrowserView t={mockT} />)
    const input = screen.getByRole('textbox', { name: 'URL' })
    fireEvent.change(input, { target: { value: 'ocw.mit.edu/courses' } })
    fireEvent.submit(input)

    expect(screen.getByTestId('browser-iframe').getAttribute('src')).toBe('https://ocw.mit.edu/courses')
  })

  it('toggles between live iframe and MarkItDown reader mode', () => {
    render(<TrellisBrowserView t={mockT} />)
    const readerToggle = screen.getByRole('button', { name: 'reader_mode' })
    fireEvent.click(readerToggle)

    expect(screen.getByTestId('reader-mode-content')).toBeDefined()
    expect(screen.queryByTestId('browser-iframe')).toBeNull()

    const liveToggle = screen.getByRole('button', { name: 'live_mode' })
    fireEvent.click(liveToggle)

    expect(screen.queryByTestId('reader-mode-content')).toBeNull()
    expect(screen.getByTestId('browser-iframe')).toBeDefined()
  })

  it('triggers clip to trellis and updates inputActions text', () => {
    const setText = vi.fn()
    render(<TrellisBrowserView t={mockT} inputActions={createMockInputActions(setText)} />)

    const clipBtn = screen.getByRole('button', { name: 'clip_to_trellis' })
    fireEvent.click(clipBtn)

    expect(setText).toHaveBeenCalledTimes(1)
    expect(setText).toHaveBeenCalledWith(expect.stringContaining('请帮我归档并整理这个网页/课程'))
    expect(screen.getByRole('status').textContent).toBe('clipped')
  })

  it('opens URL in external Chrome browser via window.open', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<TrellisBrowserView t={mockT} />)

    const chromeBtn = screen.getByRole('button', { name: 'open_chrome' })
    fireEvent.click(chromeBtn)

    expect(openSpy).toHaveBeenCalledWith(
      'https://en.wikipedia.org/wiki/Computer_science',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('manages course bookmarks drawer (open, add, click, delete)', () => {
    render(<TrellisBrowserView t={mockT} />)
    const bookmarksBtn = screen.getByRole('button', { name: 'bookmarks' })
    fireEvent.click(bookmarksBtn)

    expect(screen.getByTestId('bookmarks-drawer')).toBeDefined()
    expect(screen.getByText(/CS101/)).toBeDefined()

    // Add new bookmark
    const addBtn = screen.getByRole('button', { name: '+ add_bookmark' })
    fireEvent.click(addBtn)
    expect(screen.getByRole('status').textContent).toBe('bookmarks')

    // Click bookmark to navigate
    fireEvent.click(screen.getByText(/MIT OpenCourseWare/))
    expect(screen.getByTestId('browser-iframe').getAttribute('src')).toBe('https://ocw.mit.edu')

    // Delete bookmark
    const deleteButtons = screen.getAllByRole('button', { name: 'delete_bookmark' })
    const firstDelete = deleteButtons[0]
    if (firstDelete) fireEvent.click(firstDelete)
  })

  it('reloads iframe when reload button is clicked', () => {
    render(<TrellisBrowserView t={mockT} />)
    const reloadBtn = screen.getByRole('button', { name: 'reload' })
    fireEvent.click(reloadBtn)
    expect(screen.getByTestId('browser-iframe')).toBeDefined()
  })

  it('uses fallback zh localization when t prop is omitted', () => {
    render(<TrellisBrowserView />)
    expect(screen.getByRole('button', { name: '后退' })).toBeDefined()
  })
})

describe('Plugin Registration and Invariant', () => {
  it('applies client plugin, registers locale, and registers browser drawer in utilities slot', async () => {
    const ctx = new Context()
    const slots = new SlotRegistry(ctx)
    slots.register({
      name: 'root',
      children: { 'conversation.session.header.utilities': { kind: 'list', scope: 'session' } },
    } as never, () => null)
    const dictionaries: Array<{ namespace: string; value: unknown }> = []
    let dictionariesDisposed = false
    ctx.provide('locale', {
      register(namespace: string, value: unknown) {
        dictionaries.push({ namespace, value })
        return () => { dictionariesDisposed = true }
      },
      bind() {
        return (k: string) => k
      },
    })

    const fiber = ctx.plugin({ inject: ['slots', 'locale'], apply })
    await fiber.await()
    const entries = slots.entries('conversation.session.header.utilities')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options.id).toBe('trellis_browser_drawer')
    expect(entries[0]?.options.order).toBe(10)
    expect(entries[0]?.component).toBe(TrellisBrowserDrawer)
    expect(dictionaries).toHaveLength(1)

    await fiber.dispose()
    expect(slots.entries('conversation.session.header.utilities')).toHaveLength(0)
    expect(dictionariesDisposed).toBe(true)
  })

  it('applies host plugin and invariant without throwing', async () => {
    applyHost()
    const ctx = new Context()
    ctx.provide('invariants', {
      register: vi.fn().mockReturnValue(() => {}),
    })
    const disposer = await applyInvariant(ctx)
    expect(typeof disposer).toBe('function')
  })
})
