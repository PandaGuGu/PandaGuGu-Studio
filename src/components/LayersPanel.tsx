import React, { useEffect, useState, useCallback } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { getSemantic } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './LayersPanel.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  canvasVersion: number
  selectedElementId: string | null
  onAddFrame: () => void
}

interface TreeNode {
  id: string
  label: string
  elType: string
  semantic?: string
  isFrame: boolean
  children: TreeNode[]
}

const TYPE_ICONS: Record<string, string> = {
  rectangle: '▭', ellipse: '⬭', text: 'T', image: '◫',
  container: '▭', section: '▤', card: '▢', nav: '☰',
  heading: 'H', link: '↗',
  button: '⬭', input: '▭',
  raw: '</>', note: '✎',
  frame: '▣',
}

export function LayersPanel({ editor, canvasVersion, selectedElementId, onAddFrame }: Props) {
  const t = useI18n()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!editor) return
    const all = editor.getSceneElements()
    const alive = all.filter((e) => !(e as any).isDeleted)

    const nodeOf = (el: ExcalidrawElement): TreeNode => {
      const sem = getSemantic(el)
      const isFrame = el.type === 'frame'
      return {
        id: el.id,
        label: String(
          isFrame
            ? (el as any).name || 'Section'
            : sem?.props?.label || sem?.type || el.type
        ),
        elType: el.type,
        semantic: sem?.type,
        isFrame,
        children: (isFrame
          ? alive.filter((c) => (c as any).frameId === el.id)
          : alive.filter((c) => (c as any).containerId === el.id)
        ).map(nodeOf),
      }
    }

    const roots = alive.filter(
      (el) =>
        el.type === 'frame' ||
        (getSemantic(el) && !(el as any).containerId && !(el as any).frameId)
    )
    const frameRoots = roots.filter((r) => r.type === 'frame')
    const otherRoots = roots.filter((r) => r.type !== 'frame')
    // Frames first (top of the tree like folders), then other roots by z-order.
    const ordered = [...frameRoots.reverse(), ...otherRoots.reverse()]
    setTree(ordered.map(nodeOf))

    // Auto-expand any frames.
    setExpanded((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const el of alive) {
        if (el.type === 'frame' && !next.has(el.id)) {
          next.add(el.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [editor, canvasVersion])

  const handleSelect = useCallback((id: string) => {
    if (!editor) return
    editor.updateScene({
      appState: { selectedElementIds: { [id]: true } as any },
    })
  }, [editor])

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editor) return
    const elements = editor
      .getSceneElements()
      .filter((el) => el.id !== id)
    editor.updateScene({ elements })
  }, [editor])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isOpen = expanded.has(node.id)
    return (
      <React.Fragment key={node.id}>
        <div
          className={`layer-item ${selectedElementId === node.id ? 'selected' : ''} ${node.isFrame ? 'is-frame' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => handleSelect(node.id)}
        >
          {hasChildren ? (
            <span
              className={`layer-arrow ${isOpen ? 'open' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggle(node.id) }}
            >
              ▾
            </span>
          ) : (
            <span className="layer-arrow-spacer" />
          )}
          <span className="layer-icon">{TYPE_ICONS[node.semantic || node.elType] || '◇'}</span>
          <span className="layer-name">{node.label}</span>
          <span className="layer-type">{node.semantic || node.elType}</span>
          <span
            className="layer-delete"
            onClick={(e) => handleDelete(node.id, e)}
            title={t('layers.delete')}
            role="button"
          >
            −
          </span>
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="layers-title">{t('layers.title')}</span>
        <button
          className="layers-add-btn"
          onClick={onAddFrame}
          title={t('layers.add')}
        >
          +
        </button>
      </div>
      <div className="layers-list">
        {tree.length === 0 && (
          <div className="layers-empty">{t('layers.empty')}</div>
        )}
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  )
}