// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrellisHome } from '../src/client/TrellisHome.tsx'
import type { TrellisHomeProps } from '../src/client/TrellisHome.tsx'
import { zh } from '../src/client/locales.ts'

const mockT = (key: keyof typeof zh): string => zh[key]

const baseProps = {
  t: mockT,
  capture: vi.fn(),
  analyze: vi.fn(),
  useTrellisSession: (() => null) as unknown as TrellisHomeProps['useTrellisSession'],
  useSessions: (() => null) as unknown as TrellisHomeProps['useSessions'],
  useWorkspaces: (() => null) as unknown as TrellisHomeProps['useWorkspaces'],
} as unknown as TrellisHomeProps

describe('TrellisHome Component', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the full-screen knowledge surface', () => {
    render(<TrellisHome {...baseProps} />)
    expect(screen.getByTestId('trellis-home')).toBeDefined()
    expect(screen.getByText('知识库')).toBeDefined()
    expect(screen.getByText('还没有内容。粘贴链接或拖入文件开始收集。')).toBeDefined()
  })

  it('opens and closes the companion browser drawer', () => {
    render(<TrellisHome {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览器' }))
    expect(screen.getByTestId('trellis-browser-drawer')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '关闭浏览器' }))
    expect(screen.queryByTestId('trellis-browser-drawer')).toBeNull()
  })
})
