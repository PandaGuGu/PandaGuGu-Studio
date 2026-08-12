// Alignment & distribution operations (嘉立创-style).
// Operates purely on coordinates — never touches visuals.

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type AlignOp =
  | 'left' | 'hcenter' | 'right'
  | 'top' | 'vcenter' | 'bottom'
  | 'hdistribute' | 'vdistribute'

interface Box {
  el: ExcalidrawElement
  x: number
  y: number
  w: number
  h: number
}

export function alignElements(
  elements: ExcalidrawElement[],
  op: AlignOp
): ExcalidrawElement[] {
  if (elements.length < 2) return elements

  const boxes: Box[] = elements.map((el) => ({
    el,
    x: el.x,
    y: el.y,
    w: el.width || 0,
    h: el.height || 0,
  }))

  const minX = Math.min(...boxes.map((b) => b.x))
  const maxX = Math.max(...boxes.map((b) => b.x + b.w))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxY = Math.max(...boxes.map((b) => b.y + b.h))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  const set = (b: Box, x?: number, y?: number): ExcalidrawElement => ({
    ...b.el,
    x: x ?? b.el.x,
    y: y ?? b.el.y,
  })

  switch (op) {
    case 'left':
      return boxes.map((b) => set(b, minX))
    case 'hcenter':
      return boxes.map((b) => set(b, centerX - b.w / 2))
    case 'right':
      return boxes.map((b) => set(b, maxX - b.w))
    case 'top':
      return boxes.map((b) => set(b, undefined, minY))
    case 'vcenter':
      return boxes.map((b) => set(b, undefined, centerY - b.h / 2))
    case 'bottom':
      return boxes.map((b) => set(b, undefined, maxY - b.h))
    case 'hdistribute': {
      const sorted = [...boxes].sort((a, b) => a.x - b.x)
      const totalW = sorted.reduce((s, b) => s + b.w, 0)
      const gap = (maxX - minX - totalW) / (sorted.length - 1)
      let cursor = minX
      return sorted.map((b) => {
        const next = set(b, cursor)
        cursor += b.w + gap
        return next
      })
    }
    case 'vdistribute': {
      const sorted = [...boxes].sort((a, b) => a.y - b.y)
      const totalH = sorted.reduce((s, b) => s + b.h, 0)
      const gap = (maxY - minY - totalH) / (sorted.length - 1)
      let cursor = minY
      return sorted.map((b) => {
        const next = set(b, undefined, cursor)
        cursor += b.h + gap
        return next
      })
    }
  }
}