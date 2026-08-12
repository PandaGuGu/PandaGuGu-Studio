import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { getSources, exportSourceAsPng, exportAllAsPng, brandFilename } from '../lib/export'
import type { SourceInfo } from '../lib/export'
import { toBlueprint, downloadJSON } from '../lib/blueprint'
import './FramePicker.css'
import { useI18n } from '../lib/i18n'

interface SourceThumb extends SourceInfo {
  thumbUrl: string | null
}

interface Props {
  editor: ExcalidrawImperativeAPI | null
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onAddFrame: () => void
  canvasVersion: number
  onSave: () => void
  onLoad: () => void
  previewScreenshot: string | null
}

export function FramePicker({ editor, selectedIds, onSelectionChange, onAddFrame, canvasVersion, onSave, onLoad, previewScreenshot }: Props) {
  const t = useI18n()
  const [sources, setSources] = useState<SourceThumb[]>([])
  const [hasDrawing, setHasDrawing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const prevHasFramesRef = useRef(false)
  const prevCountRef = useRef(0)

  const refreshSources = useCallback(async () => {
    if (!editor) return
    const srcs = getSources(editor)
    const thumbs: SourceThumb[] = await Promise.all(
      srcs.map(async (s) => {
        const b64 = await exportSourceAsPng(editor, s.id)
        return {
          ...s,
          thumbUrl: b64 ? 'data:image/png;base64,' + b64 : null,
        }
      })
    )
    setSources(thumbs)

    if (thumbs.length > prevCountRef.current) {
      onSelectionChange(new Set(thumbs.map((s) => s.id)))
    }
    prevCountRef.current = thumbs.length

    const elements = editor.getSceneElements()
    setHasDrawing(elements.length > 0)
  }, [editor, onSelectionChange])

  useEffect(() => { refreshSources() }, [canvasVersion, refreshSources])

  const toggle = useCallback((id: string) => {
    onSelectionChange(
      selectedIds.has(id)
        ? new Set([...selectedIds].filter((x) => x !== id))
        : new Set([...selectedIds, id])
    )
  }, [selectedIds, onSelectionChange])

  const selectAll = useCallback(() => {
    onSelectionChange(new Set(sources.map((s) => s.id)))
  }, [sources, onSelectionChange])

  const selectNone = useCallback(() => {
    onSelectionChange(new Set())
  }, [onSelectionChange])

  const handleExportFrameJson = useCallback((frameId: string) => {
    if (!editor) return
    const bp = toBlueprint(editor, { frameId })
    if (!bp) {
      alert(t('semantic.exportEmpty'))
      return
    }
    downloadJSON(bp, brandFilename('json', 'blueprint'))
  }, [editor, t])

  const hasFrames = sources.some(s => s.kind === 'frame')

  // First time frames appear → auto-expand once so user sees the new frame.
  useEffect(() => {
    if (hasFrames && !prevHasFramesRef.current) setExpanded(true)
    if (!hasFrames) setExpanded(false)
    prevHasFramesRef.current = hasFrames
  }, [hasFrames])

  // ── Collapsed bar (no frames OR user collapsed) ──
  if (!hasFrames || !expanded) {
    return (
      <div className="frame-picker-bar">
        <span className="fpb-status">
          <span className={`fpb-dot ${hasDrawing ? 'on' : ''}`} />
          {hasDrawing ? t('frame.fullCanvas') : t('frame.drawFirst')}
          {hasFrames && (
            <span className="fpb-count"> · {sources.length} {t('frame.frames')}</span>
          )}
        </span>
        {previewScreenshot && (
          <span className="fpb-badge">+ {t('frame.prevOutput')}</span>
        )}
        <div className="fpb-actions">
          {hasFrames && (
            <button className="btn btn-ghost" onClick={() => setExpanded(true)}>
              ▾ {t('frame.expand')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onAddFrame}>+ {t('frame.add')}</button>
          <button className="btn btn-ghost" onClick={onSave}>{t('frame.save')}</button>
          <button className="btn btn-ghost" onClick={onLoad}>{t('frame.load')}</button>
        </div>
      </div>
    )
  }

  // ── Expanded: thumbnail strip ──
  return (
    <div className="frame-picker">
      <div className="frame-picker-header">
        <span className="frame-picker-label">
          {t('frame.sources')}
          <span className="frame-count">{selectedIds.size}/{sources.length}</span>
        </span>
        <div className="frame-picker-actions">
          <button className="btn btn-ghost" onClick={() => setExpanded(false)}>
            ▴ {t('frame.collapse')}
          </button>
          <button className="btn btn-ghost" onClick={onAddFrame}>+ {t('frame.add')}</button>
          <button className="btn btn-ghost" onClick={selectAll}>{t('frame.all')}</button>
          <button className="btn btn-ghost" onClick={selectNone}>{t('frame.none')}</button>
          <span className="fpb-sep" />
          <button className="btn btn-ghost" onClick={onSave}>{t('frame.save')}</button>
          <button className="btn btn-ghost" onClick={onLoad}>{t('frame.load')}</button>
        </div>
      </div>
      <div className="frame-picker-strip">
        {sources.map((s) => (
          <div
            key={s.id}
            className={`frame-thumb-wrap ${selectedIds.has(s.id) ? 'selected' : ''}`}
          >
            <button
              className="frame-thumb"
              onClick={() => toggle(s.id)}
              title={`${s.kind}: ${s.name}`}
            >
              {s.thumbUrl ? (
                <img src={s.thumbUrl} alt={s.name} />
              ) : (
                <div className="frame-thumb-empty" />
              )}
              <span className="frame-thumb-name">
                <span className="frame-thumb-kind">{s.kind === 'image' ? 'IMG' : 'FRM'}</span>
                {s.name}
              </span>
              {selectedIds.has(s.id) && <div className="frame-thumb-check">ok</div>}
            </button>
            {s.kind === 'frame' && (
              <button
                className="frame-thumb-export"
                onClick={(e) => { e.stopPropagation(); handleExportFrameJson(s.id) }}
                title={t('frame.exportJson')}
              >
                ⇩
              </button>
            )}
          </div>
        ))}
        {previewScreenshot && (
          <div className="frame-thumb screenshot-thumb">
            <img src={previewScreenshot} alt="Last output" />
            <span className="frame-thumb-name">
              <span className="frame-thumb-kind">{t('frame.preview')}</span>
              {t('frame.lastOutput')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}