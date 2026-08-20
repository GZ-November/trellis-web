/**
 * Knowledge Canvas: a draggable, pannable, zoomable map of Trellis knowledge
 * documents and their evidence-backed relations.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client/KnowledgeCanvas
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import css from './KnowledgeCanvas.module.css'

/** Minimal document shape consumed by the canvas. */
export interface CanvasDocument {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: string
  readonly tags: readonly string[]
}

/** One directed relation between two documents. */
export interface CanvasEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly kind: string
  readonly label?: string
  readonly evidence: string
  readonly confidence: number
}

/** Props for the knowledge canvas. */
export interface KnowledgeCanvasProps {
  readonly documents: readonly CanvasDocument[]
  readonly edges: readonly CanvasEdge[]
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Camera {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

const CARD_WIDTH = 300
const CARD_HEIGHT = 168
const CARD_GAP_X = 340
const CARD_GAP_Y = 200
const POSITIONS_KEY = 'trellis:canvas-positions:v1'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

function loadPositions(): Map<string, Point> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY)
    if (raw === null) return new Map()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Map()
    const result = new Map<string, Point>()
    for (const rawEntry of parsed) {
      if (!Array.isArray(rawEntry) || rawEntry.length < 2 || typeof rawEntry[0] !== 'string') continue
      const entry = rawEntry as [string, unknown]
      const point = entry[1]
      if (typeof point !== 'object' || point === null) continue
      const { x, y } = point as { x?: unknown; y?: unknown }
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue
      result.set(entry[0], { x, y })
    }
    return result
  } catch {
    return new Map()
  }
}

function savePositions(positions: ReadonlyMap<string, Point>): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify([...positions]))
  } catch {
    // Private browsing may disable local storage.
  }
}

function positionFor(index: number): Point {
  return {
    x: 48 + (index % 4) * CARD_GAP_X,
    y: 48 + Math.floor(index / 4) * CARD_GAP_Y,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Knowledge Canvas component.
 * @param props - documents, edges, and selection callbacks.
 * @returns the pannable/zoomable canvas.
 */
export function KnowledgeCanvas(props: KnowledgeCanvasProps): ReactElement {
  const { documents, edges, selectedId, onSelect } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [positions, setPositions] = useState<Map<string, Point>>(loadPositions)
  const [camera, setCamera] = useState<Camera>({ x: 24, y: 24, zoom: 1 })
  const dragRef = useRef<{
    kind: 'card' | 'canvas'
    id?: string
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    setPositions((prev) => {
      const missing = documents.filter(doc => !prev.has(doc.id))
      if (missing.length === 0) return prev
      const next = new Map(prev)
      missing.forEach((doc, index) => {
        next.set(doc.id, positionFor(index))
      })
      return next
    })
  }, [documents])

  const edgeLines = useMemo(() => {
    return edges.flatMap((edge) => {
      const source = positions.get(edge.source)
      const target = positions.get(edge.target)
      if (source === undefined || target === undefined) return []
      return [{
        ...edge,
        x1: source.x + CARD_WIDTH / 2,
        y1: source.y + CARD_HEIGHT / 2,
        x2: target.x + CARD_WIDTH / 2,
        y2: target.y + CARD_HEIGHT / 2,
      }]
    })
  }, [edges, positions])

  const persistPositions = useCallback((next: ReadonlyMap<string, Point>) => {
    savePositions(next)
  }, [])

  const updatePosition = useCallback((id: string, point: Point) => {
    setPositions((prev) => {
      const next = new Map(prev)
      next.set(id, point)
      return next
    })
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.1 : 0.9
    setCamera((prev) => {
      const zoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      return { ...prev, zoom }
    })
  }, [])

  const handleCardMouseDown = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation()
    const point = positions.get(id)
    if (point === undefined) return
    dragRef.current = {
      kind: 'card',
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: point.x,
      originY: point.y,
      moved: false,
    }
  }, [positions])

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.target !== event.currentTarget) return
    dragRef.current = {
      kind: 'canvas',
      startX: event.clientX,
      startY: event.clientY,
      originX: camera.x,
      originY: camera.y,
      moved: false,
    }
  }, [camera.x, camera.y])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === null) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
      if (drag.kind === 'card' && drag.id !== undefined) {
        updatePosition(drag.id, {
          x: drag.originX + dx,
          y: drag.originY + dy,
        })
      } else if (drag.kind === 'canvas') {
        setCamera(prev => ({
          ...prev,
          x: drag.originX + dx,
          y: drag.originY + dy,
        }))
      }
    }

    const handleMouseUp = (_event: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === null) return
      dragRef.current = null
      if (drag.kind === 'card' && drag.id !== undefined) {
        setPositions((prev) => {
          persistPositions(prev)
          return prev
        })
        if (!drag.moved) onSelect(drag.id)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onSelect, persistPositions, updatePosition])

  const zoomBy = useCallback((factor: number) => {
    setCamera((prev) => {
      const zoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      return { ...prev, zoom }
    })
  }, [])

  const fit = useCallback(() => {
    if (documents.length === 0) return
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const doc of documents) {
      const point = positions.get(doc.id) ?? positionFor(0)
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x + CARD_WIDTH)
      maxY = Math.max(maxY, point.y + CARD_HEIGHT)
    }
    const el = containerRef.current
    if (el === null) return
    const width = el.clientWidth
    const height = el.clientHeight
    const zoom = clamp(Math.min(width / (maxX - minX + 80), height / (maxY - minY + 80)), MIN_ZOOM, MAX_ZOOM)
    setCamera({
      x: 40 - minX * zoom,
      y: 40 - minY * zoom,
      zoom,
    })
  }, [documents, positions])

  return (
    <div
      ref={containerRef}
      className={css.canvas}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      data-testid="knowledge-canvas"
    >
      <div
        className={css.viewport}
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
      >
        <svg className={css.edges} width="12000" height="12000" aria-hidden="true">
          {edgeLines.map(edge => (
            <g key={edge.id}>
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                className={css.edgeLine}
              />
              <circle cx={(edge.x1 + edge.x2) / 2} cy={(edge.y1 + edge.y2) / 2} r="3" className={css.edgeDot} />
            </g>
          ))}
        </svg>

        {documents.map((doc) => {
          const point = positions.get(doc.id) ?? positionFor(0)
          const active = doc.id === selectedId
          return (
            <button
              key={doc.id}
              type="button"
              className={`${css.card} ${active ? css.cardActive : ''}`}
              style={{ left: point.x, top: point.y, width: CARD_WIDTH, height: CARD_HEIGHT }}
              onMouseDown={(event) => { handleCardMouseDown(event, doc.id) }}
            >
              <span className={css.cardKind}>{doc.kind}</span>
              <span className={css.cardTitle}>{doc.title}</span>
              <span className={css.cardSummary}>{doc.summary}</span>
              <span className={css.cardTags}>{doc.tags.slice(0, 4).join(' · ')}</span>
            </button>
          )
        })}
      </div>

      <div className={css.controls}>
        <button type="button" onClick={() => { zoomBy(1.25) }} aria-label="放大">+</button>
        <button type="button" onClick={() => { zoomBy(0.8) }} aria-label="缩小">−</button>
        <button type="button" onClick={fit} aria-label="适应画布">⛶</button>
      </div>
    </div>
  )
}
