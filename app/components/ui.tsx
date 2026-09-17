'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

/* ---------------- formatacao ---------------- */

export function money(cents: number | null | undefined, currency = 'BRL') {
  const v = (Number(cents) || 0) / 100
  return v.toLocaleString(currency === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency })
}

export function pct(v: number | null | undefined, digits = 1) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

export function num(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString('pt-BR')
}

export function ratio(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toFixed(2)
}

/* ---------------- contexto de periodo + dashboard ---------------- */

type Ctx = {
  dashboardId: string
  setDashboardId: (id: string) => void
  from: string
  to: string
  setRange: (from: string, to: string) => void
  dashboards: any[]
  currency: string
}

const PanelContext = createContext<Ctx | null>(null)
export const usePanel = () => {
  const c = useContext(PanelContext)
  if (!c) throw new Error('usePanel fora do provider')
  return c
}

const todayLocal = (tz = -3) => new Date(Date.now() + tz * 3600 * 1000).toISOString().slice(0, 10)

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [dashboards, setDashboards] = useState<any[]>([])
  const [dashboardId, setDashboardId] = useState('')
  const [from, setFrom] = useState(todayLocal())
  const [to, setTo] = useState(todayLocal())

  useEffect(() => {
    fetch('/api/dashboards')
      .then((r) => r.json())
      .then((j) => {
        setDashboards(j.dashboards || [])
        const saved = localStorage.getItem('rt_dashboard')
        const first = j.dashboards?.[0]?.id
        setDashboardId(j.dashboards?.some((d: any) => d.id === saved) ? saved! : first || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (dashboardId) localStorage.setItem('rt_dashboard', dashboardId)
  }, [dashboardId])

  const currency = dashboards.find((d) => d.id === dashboardId)?.currency || 'BRL'

  return (
    <PanelContext.Provider
      value={{ dashboardId, setDashboardId, from, to, setRange: (f, t) => { setFrom(f); setTo(t) }, dashboards, currency }}
    >
      {children}
    </PanelContext.Provider>
  )
}

/** Notifica (toast do Windows via Notification API) quando entra venda aprovada nova. */
export function SaleWatcher() {
  const { dashboardId, currency } = usePanel()
  const seenIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!dashboardId || !('Notification' in window)) return
    if (Notification.permission === 'default') Notification.requestPermission()
    seenIds.current = null

    async function poll() {
      try {
        const r = await fetch(`/api/orders?dashboardId=${dashboardId}&status=approved&limit=10`)
        const { orders } = await r.json()
        if (!orders) return
        if (seenIds.current === null) {
          seenIds.current = new Set(orders.map((o: any) => o.id))
          return
        }
        for (const o of orders) {
          if (seenIds.current.has(o.id)) continue
          seenIds.current.add(o.id)
          if (Notification.permission === 'granted') {
            new Notification('Nova venda!', { body: `${o.products || 'Produto'} — ${money(o.net_cents, currency)}` })
          }
        }
      } catch {}
    }

    poll()
    const id = setInterval(poll, 20000)
    return () => clearInterval(id)
  }, [dashboardId, currency])

  return null
}

/** Monta a querystring padrao das rotas de metrica. */
export function useQuery() {
  const { dashboardId, from, to } = usePanel()
  return dashboardId ? `dashboardId=${dashboardId}&from=${from}&to=${to}` : ''
}

/* ---------------- componentes ---------------- */

export function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-white'
  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-muted text-xs mt-1">{hint}</div>}
    </div>
  )
}

export function RangePicker() {
  const { from, to, setRange } = usePanel()

  function preset(days: number) {
    const end = new Date()
    const start = new Date(end.getTime() - (days - 1) * 864e5)
    setRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={from} onChange={(e) => setRange(e.target.value, to)}
             className="bg-panel border border-line rounded-lg px-3 py-1.5 text-sm" />
      <span className="text-muted">ate</span>
      <input type="date" value={to} onChange={(e) => setRange(from, e.target.value)}
             className="bg-panel border border-line rounded-lg px-3 py-1.5 text-sm" />
      {[
        ['Hoje', 1],
        ['7 dias', 7],
        ['30 dias', 30],
      ].map(([label, days]) => (
        <button key={label as string} onClick={() => preset(days as number)}
                className="text-xs px-3 py-1.5 rounded-lg border border-line hover:border-brand text-muted hover:text-white">
          {label as string}
        </button>
      ))}
    </div>
  )
}

export function Table({ columns, rows, empty }: { columns: { key: string; label: string; align?: 'right'; render?: (row: any) => React.ReactNode }[]; rows: any[]; empty?: string }) {
  if (!rows.length) return <p className="text-muted text-sm py-8 text-center">{empty || 'Nada nesse periodo.'}</p>
  return (
    <div className="overflow-x-auto border border-line rounded-xl">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-panel">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2.5 font-medium text-muted text-xs uppercase tracking-wide ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.objectId ?? i} className="border-t border-line hover:bg-panel/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
