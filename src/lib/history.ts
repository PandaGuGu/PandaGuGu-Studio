/** Generation history — persisted in localStorage. */

export interface HistoryItem {
  id: string
  ts: number
  html: string
  prompt?: string
}

const STORAGE_KEY = 'pandagugu.history'
const MAX_ITEMS = 50

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // storage full or unavailable — ignore
  }
}

export function appendHistory(item: { html: string; prompt?: string }): HistoryItem[] {
  const items = loadHistory()
  const entry: HistoryItem = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    html: item.html,
    prompt: item.prompt,
  }
  const next = [entry, ...items].slice(0, MAX_ITEMS)
  persist(next)
  return next
}

export function removeHistory(id: string): HistoryItem[] {
  const next = loadHistory().filter((i) => i.id !== id)
  persist(next)
  return next
}

export function clearHistory(): HistoryItem[] {
  persist([])
  return []
}
