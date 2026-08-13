// Blueprint → self-contained HTML renderer (no AI needed).
// Pure logic, no DOM dependency: works in the browser AND in Node (pgg CLI).
//
// Renders the blueprint tree into a single-file HTML where images are
// inlined as base64 data URLs. Opening the file in a browser shows the
// layout with zero external dependencies — no local image files required.

import type { Blueprint, BlueprintElement } from './types'

const SHADOW_CSS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.08)',
  md: '0 4px 12px rgba(0,0,0,0.12)',
  lg: '0 8px 24px rgba(0,0,0,0.16)',
  xl: '0 16px 48px rgba(0,0,0,0.22)',
}

function esc(s: string | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Serialize inline CSS from a BlueprintElement's props + free style. */
function elementCss(e: BlueprintElement): string {
  const p = e.props || {}
  const css: string[] = []
  const pos = e.layout === 'free'
    ? `position:absolute;left:${e.x}px;top:${e.y}px;`
    : ''
  css.push(pos + `width:${e.w}px;height:${e.h}px;z-index:${e.zIndex ?? 0};`)
  if (e.angle) css.push(`transform:rotate(${e.angle}rad);`)

  const box = ['container', 'section', 'card', 'nav', 'button', 'input', 'raw', 'note']
  if (box.includes(e.type)) {
    if (p.bg) css.push(`background-color:${p.bg};`)
    if (p.radius != null) css.push(`border-radius:${p.radius}px;`)
    if (p.padding != null) css.push(`padding:${p.padding}px;`)
    if (p.border) css.push(`border:1px solid ${p.border};`)
    if (p.shadow) css.push(`box-shadow:${SHADOW_CSS[p.shadow] || 'none'};`)
    if (p.color) css.push(`color:${p.color};`)
  }
  if (e.type === 'image' && p.fit) css.push(`object-fit:${p.fit};`)
  if (['heading', 'text', 'link', 'button', 'input'].includes(e.type)) {
    if (p.fontSize != null) css.push(`font-size:${p.fontSize}px;`)
    if (p.fontWeight != null) css.push(`font-weight:${p.fontWeight};`)
    if (p.color) css.push(`color:${p.color};`)
    if (p.align) css.push(`text-align:${p.align};`)
  }
  // User-provided free CSS overrides everything else.
  if (e.style) css.push(e.style)
  return css.join('')
}

function elementHtml(e: BlueprintElement): string {
  const p = e.props || {}
  const css = elementCss(e)
  const id = e.type === 'image' ? 'img' : 'div'
  const children = (e.children || []).map(elementHtml).join('\n')
  const styleAttr = css ? ` style="${esc(css)}"` : ''

  switch (e.type) {
    case 'section':
      return `<section${styleAttr}>${children}</section>`
    case 'heading': {
      const lv = Math.min(6, Math.max(1, Number(p.level) || 1))
      const tag = `h${lv}`
      return `<${tag}${styleAttr}>${esc(p.content ?? p.label ?? '')}</${tag}>`
    }
    case 'text':
      return `<p${styleAttr}>${esc(p.content ?? '')}</p>`
    case 'link':
      return `<a${styleAttr} href="${esc(p.href ?? '#')}">${esc(p.label ?? '')}</a>`
    case 'button':
      return `<button${styleAttr}>${esc(p.label ?? '')}</button>`
    case 'input': {
      const type = p.type === 'password' ? 'password' : p.type === 'number' ? 'number' : p.type === 'email' ? 'email' : 'text'
      return `<input${styleAttr} type="${type}" placeholder="${esc(p.placeholder ?? '')}" />`
    }
    case 'image': {
      const src = p.src || p.imageDataURL || ''
      return `<img${styleAttr} src="${esc(src)}" alt="${esc(p.alt ?? '')}" />`
    }
    case 'raw':
      return String(p.html ?? '')
    case 'note':
      return '' // notes are design intent only — never rendered
    default:
      return `<div${styleAttr}>${children}</div>`
  }
}

/** Layout rules for children based on the parent's layout hint. */
function layoutCss(e: BlueprintElement): string {
  const p = e.props || {}
  const css = elementCss(e)
  const parts = [css]
  switch (e.layout) {
    case 'row': parts.push('display:flex;flex-direction:row;align-items:center;gap:8px;'); break
    case 'column': parts.push('display:flex;flex-direction:column;gap:8px;'); break
    case 'grid': parts.push('display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;'); break
    case 'wrap': parts.push('display:flex;flex-wrap:wrap;gap:8px;'); break
    default: break // free: absolute positioning from x/y
  }
  if (p.align) parts.push(`text-align:${p.align};`)
  return parts.join('')
}

function buildNode(e: BlueprintElement): string {
  // Non-free containers render their children inside a flex/grid wrapper.
  if (e.layout !== 'free' && (e.type === 'container' || e.type === 'section' || e.type === 'card' || e.type === 'nav' || e.type === 'raw')) {
    const css = layoutCss(e)
    const children = (e.children || []).map(buildNode).join('\n')
    const tag = e.type === 'section' ? 'section' : 'div'
    return `<${tag} style="${esc(css)}">${children}</${tag}>`
  }
  return elementHtml(e)
}

/**
 * Convert a blueprint into a self-contained HTML document.
 * Images are inlined as base64, so the output needs NO external files —
 * open it in any browser and the layout (with pictures) just works.
 * @param title 可选页面标题(默认 "Canvas Export")
 */
export function blueprintToHtml(bp: Blueprint, title = 'Canvas Export'): string {
  const body = (bp.elements || []).map(buildNode).join('\n')
  return (
    '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
    '<meta charset="UTF-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<title>' + esc(title) + '</title>\n' +
    '<style>\n' +
    'body { margin:0; background:#f4f6f9; position:relative; }\n' +
    'html,body { min-height:100%; }\n' +
    '</style>\n</head>\n<body>\n' +
    body +
    '\n</body>\n</html>'
  )
}
