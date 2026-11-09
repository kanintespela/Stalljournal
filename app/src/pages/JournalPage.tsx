import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { MOVEMENT_DIRECTION_LABELS } from '../db/types'

interface Event {
  date: string // YYYY-MM-DD
  category: string
  text: string
  link: string
  /** Gemener, det som fritextsökningen matchar mot (kategori + text + djurnamn). */
  search: string
}

type Period = '7' | '30' | 'ar' | 'eget'

/** Fasta kategorier i den ordning chipsen visas; anteckningskategorier (fritext) kommer efter. */
const BUILT_IN_CATEGORIES = [
  'Vägning',
  'Behandling',
  'Lamning',
  'Betäckning',
  'Hull',
  'Provtagning',
  'Foder',
  'Flytt',
  'Extern flytt',
]

/** Nyans (HSL) per kategori så att typen syns i en snabb skanning. Anteckningar är grå. */
const CATEGORY_HUE: Record<string, number> = {
  Vägning: 205,
  Behandling: 5,
  Lamning: 95,
  Betäckning: 330,
  Hull: 38,
  Provtagning: 270,
  Foder: 60,
  Flytt: 150,
  'Extern flytt': 175,
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '7', label: '7 dagar' },
  { value: '30', label: '30 dagar' },
  { value: 'ar', label: 'I år' },
  { value: 'eget', label: 'Eget intervall' },
]

function localIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localIso(d)
}

function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  const s = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  const s = d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function eventsLabel(n: number): string {
  return n === 1 ? '1 händelse' : `${n} händelser`
}

function categorySort(a: string, b: string): number {
  const ia = BUILT_IN_CATEGORIES.indexOf(a)
  const ib = BUILT_IN_CATEGORIES.indexOf(b)
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  return a.localeCompare(b, 'sv')
}

function categoryStyle(category: string): CSSProperties | undefined {
  const hue = CATEGORY_HUE[category]
  return hue === undefined ? undefined : ({ '--h': hue, '--s': '45%' } as CSSProperties)
}

export default function JournalPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  // Månader användaren själv fällt ut/ihop (månadsnyckel → öppen). Nollställs när filtren ändras.
  const [monthOverride, setMonthOverride] = useState<Record<string, boolean>>({})

  const selectedCats = params.getAll('kat')
  const periodParam = params.get('p')
  const period: Period | null = PERIODS.some((p) => p.value === periodParam) ? (periodParam as Period) : null
  const from = params.get('fran') ?? ''
  const till = params.get('till') ?? ''

  const events = useLiveQuery(async () => {
    const [weighings, treatments, moves, lambings, matings, conditions, samples, feedings, movements, notes] = await Promise.all([
      db.weighings.filter((r) => r.deleted_at === null).toArray(),
      db.treatments.filter((r) => r.deleted_at === null).toArray(),
      db.group_moves.filter((r) => r.deleted_at === null).toArray(),
      db.lambings.filter((r) => r.deleted_at === null).toArray(),
      db.matings.filter((r) => r.deleted_at === null).toArray(),
      db.body_conditions.filter((r) => r.deleted_at === null).toArray(),
      db.parasite_samples.filter((r) => r.deleted_at === null).toArray(),
      db.feedings.filter((r) => r.deleted_at === null).toArray(),
      db.animal_movements.filter((r) => r.deleted_at === null).toArray(),
      db.journal_notes.filter((r) => r.deleted_at === null).toArray(),
    ])
    const animalIds = new Set([
      ...weighings.map((w) => w.animal_id),
      ...treatments.map((t) => t.animal_id),
      ...lambings.map((l) => l.ewe_id),
      ...matings.flatMap((m) => [m.ewe_id, m.ram_id]),
      ...conditions.map((c) => c.animal_id),
      ...samples.map((s) => s.animal_id).filter((x): x is string => Boolean(x)),
      ...movements.map((m) => m.animal_id),
      ...notes.map((n) => n.animal_id).filter((x): x is string => Boolean(x)),
    ])
    const animals = new Map(
      (await db.animals.bulkGet([...animalIds])).filter(Boolean).map((a) => [a!.id, a!]),
    )
    const groupIds = new Set([
      ...moves.map((m) => m.group_id),
      ...feedings.map((f) => f.group_id),
      ...samples.map((s) => s.group_id).filter((x): x is string => Boolean(x)),
      ...notes.map((n) => n.group_id).filter((x): x is string => Boolean(x)),
    ])
    const groups = new Map(
      (await db.herd_groups.bulkGet([...groupIds])).filter(Boolean).map((g) => [g!.id, g!]),
    )
    const places = new Map(
      (await db.places.bulkGet(moves.map((m) => m.place_id))).filter(Boolean).map((p) => [p!.id, p!]),
    )
    const tag = (id: string) => animals.get(id)?.tag_number ?? '?'
    const name = (id: string | null) => (id ? animals.get(id)?.name ?? '' : '')
    const mk = (date: string, category: string, text: string, link: string, extra = ''): Event => ({
      date: date.slice(0, 10),
      category,
      text,
      link,
      search: `${category} ${text} ${extra}`.toLowerCase(),
    })
    const all: Event[] = [
      ...weighings.map((w) =>
        mk(w.date, 'Vägning', `${tag(w.animal_id)}: ${w.weight_kg} kg`, `/djur/${w.animal_id}`, name(w.animal_id)),
      ),
      ...treatments.map((t) =>
        mk(
          t.date,
          'Behandling',
          `${tag(t.animal_id)}: ${t.drug}${t.withdrawal_days > 0 ? ` (karens ${t.withdrawal_days} d)` : ''}`,
          `/djur/${t.animal_id}`,
          name(t.animal_id),
        ),
      ),
      ...moves.map((m) =>
        mk(
          m.moved_on,
          'Flytt',
          `${groups.get(m.group_id)?.name ?? '?'} → ${places.get(m.place_id)?.name ?? '?'}`,
          `/grupper/${m.group_id}`,
        ),
      ),
      ...lambings.map((l) =>
        mk(
          l.date,
          'Lamning',
          `${tag(l.ewe_id)}: ${l.live_count} lamm${l.dead_count > 0 ? ` (${l.dead_count} döda)` : ''}`,
          `/djur/${l.ewe_id}`,
          name(l.ewe_id),
        ),
      ),
      ...matings.map((m) =>
        mk(
          m.start_date,
          'Betäckning',
          `${tag(m.ewe_id)} × ${tag(m.ram_id)}`,
          `/djur/${m.ewe_id}`,
          `${name(m.ewe_id)} ${name(m.ram_id)}`,
        ),
      ),
      ...conditions.map((c) =>
        mk(c.date, 'Hull', `${tag(c.animal_id)}: hull ${c.score}`, `/djur/${c.animal_id}`, name(c.animal_id)),
      ),
      ...samples.map((s) =>
        mk(
          s.date,
          'Provtagning',
          `${s.animal_id ? tag(s.animal_id) : groups.get(s.group_id!)?.name ?? '?'}: ${s.type}${s.result ? ` — ${s.result}` : ''}`,
          s.animal_id ? `/djur/${s.animal_id}` : `/grupper/${s.group_id}`,
          name(s.animal_id),
        ),
      ),
      ...feedings.map((f) =>
        mk(
          f.date,
          'Foder',
          `${groups.get(f.group_id)?.name ?? '?'}: ${f.feed_type}${f.amount ? ` (${f.amount})` : ''}`,
          `/grupper/${f.group_id}`,
        ),
      ),
      ...movements.map((m) =>
        mk(
          m.date,
          'Extern flytt',
          `${tag(m.animal_id)}: ${MOVEMENT_DIRECTION_LABELS[m.direction]} — ${m.counterparty_type} (${m.counterparty_se_number})`,
          `/djur/${m.animal_id}`,
          name(m.animal_id),
        ),
      ),
      ...notes.map((n) =>
        mk(
          n.date,
          n.category,
          `${n.animal_id ? tag(n.animal_id) : groups.get(n.group_id!)?.name ?? '?'}: ${n.text}`,
          n.animal_id ? `/djur/${n.animal_id}` : `/grupper/${n.group_id}`,
          name(n.animal_id),
        ),
      ),
    ]
    all.sort((a, b) => b.date.localeCompare(a.date))
    return all
  }, [])

  const query = q.trim().toLowerCase()
  const hasFilter = selectedCats.length > 0 || query !== '' || period !== null

  /** Skriv om URL-parametrarna (replace → ingen historikspam) och nollställ manuella månadsval. */
  function updateParams(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    mutate(next)
    setParams(next, { replace: true })
    setMonthOverride({})
  }

  function setQuery(value: string) {
    setQ(value)
    updateParams((p) => {
      if (value.trim()) p.set('q', value)
      else p.delete('q')
    })
  }

  function setPeriod(value: Period | null) {
    updateParams((p) => {
      p.delete('p')
      p.delete('fran')
      p.delete('till')
      if (value) p.set('p', value)
    })
  }

  function setRange(key: 'fran' | 'till', value: string) {
    updateParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
    })
  }

  function toggleCategory(category: string) {
    updateParams((p) => {
      const cur = p.getAll('kat')
      p.delete('kat')
      const next = cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category]
      next.forEach((c) => p.append('kat', c))
    })
  }

  function clearFilters() {
    setQ('')
    setParams(new URLSearchParams(), { replace: true })
    setMonthOverride({})
  }

  // Alla kategorier som finns i datan (inte bara i det filtrerade urvalet, så chips inte försvinner).
  const allCategories = useMemo(() => {
    const set = new Set<string>(selectedCats)
    for (const e of events ?? []) set.add(e.category)
    return [...set].sort(categorySort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, params])

  // Urval efter period + fritext; kategorifiltret läggs ovanpå så chipräknarna blir "fasetterade".
  const base = useMemo(() => {
    if (!events) return []
    let lo = ''
    let hi = ''
    if (period === '7') lo = daysAgoIso(7)
    else if (period === '30') lo = daysAgoIso(30)
    else if (period === 'ar') lo = `${new Date().getFullYear()}-01-01`
    else if (period === 'eget') {
      lo = from
      hi = till
    }
    return events.filter(
      (e) => (!lo || e.date >= lo) && (!hi || e.date <= hi) && (!query || e.search.includes(query)),
    )
  }, [events, period, from, till, query])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of base) m.set(e.category, (m.get(e.category) ?? 0) + 1)
    return m
  }, [base])

  const filtered = useMemo(
    () => (selectedCats.length === 0 ? base : base.filter((e) => selectedCats.includes(e.category))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, params],
  )

  // Månad → dag → händelser. `filtered` är redan sorterat nyast först.
  const months = useMemo(() => {
    const out: { key: string; count: number; days: { date: string; items: Event[] }[] }[] = []
    for (const e of filtered) {
      const key = e.date.slice(0, 7)
      let month = out[out.length - 1]
      if (!month || month.key !== key) {
        month = { key, count: 0, days: [] }
        out.push(month)
      }
      let day = month.days[month.days.length - 1]
      if (!day || day.date !== e.date) {
        day = { date: e.date, items: [] }
        month.days.push(day)
      }
      day.items.push(e)
      month.count++
    }
    return out
  }, [filtered])

  // Standard: innevarande månad + senaste månaden med händelser öppna, äldre hopfällda.
  // Söker man (text eller kategori) är allt öppet — då letar man efter något specifikt.
  const currentMonthKey = localIso(new Date()).slice(0, 7)
  const newestMonthKey = months[0]?.key
  function isMonthOpen(key: string): boolean {
    if (key in monthOverride) return monthOverride[key]
    if (query !== '' || selectedCats.length > 0) return true
    return key === currentMonthKey || key === newestMonthKey
  }
  function toggleMonth(key: string) {
    setMonthOverride((prev) => ({ ...prev, [key]: !isMonthOpen(key) }))
  }

  return (
    <div className="page">
      <h1>Journal</h1>

      <div className="action-grid">
        <Link to="/journal/vagning" className="btn btn-primary">Vägning</Link>
        <Link to="/journal/behandling" className="btn btn-primary">Behandling</Link>
        <Link to="/journal/lamning" className="btn btn-primary">Lamning</Link>
        <Link to="/journal/betackning" className="btn">Betäckning</Link>
        <Link to="/journal/hull" className="btn">Hullbedömning</Link>
        <Link to="/journal/trackprov" className="btn">Träckprov</Link>
        <Link to="/journal/foder" className="btn">Utfodring</Link>
        <Link to="/journal/anteckning" className="btn">Anteckning</Link>
        <Link to="/journal/flytt" className="btn">Extern flytt</Link>
        <Link to="/grupper" className="btn">Flytta grupp</Link>
      </div>

      <section className="section">
        <h2>Händelser</h2>

        <div className="toolbar">
          <input
            type="search"
            placeholder="Sök djur, preparat, anteckning…"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-chips" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`chip${period === p.value ? ' chip-active' : ''}`}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(period === p.value ? null : p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'eget' && (
          <div className="date-range">
            <label>
              Från
              <input type="date" value={from} max={till || undefined} onChange={(e) => setRange('fran', e.target.value)} />
            </label>
            <label>
              Till
              <input type="date" value={till} min={from || undefined} onChange={(e) => setRange('till', e.target.value)} />
            </label>
          </div>
        )}

        <div className="filter-chips" role="group" aria-label="Typ av händelse">
          {allCategories.map((c) => {
            const active = selectedCats.includes(c)
            return (
              <button
                key={c}
                type="button"
                className={`chip${active ? ' chip-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleCategory(c)}
              >
                {c} <span className="chip-count">{categoryCounts.get(c) ?? 0}</span>
              </button>
            )
          })}
        </div>

        {events && events.length > 0 && (
          <p className="journal-summary muted">
            Visar {filtered.length} av {events.length}
            {hasFilter && (
              <>
                {' · '}
                <button type="button" className="text-btn" onClick={clearFilters}>Rensa filter</button>
              </>
            )}
          </p>
        )}

        {!events || events.length === 0 ? (
          <p className="muted">Inga registreringar ännu.</p>
        ) : filtered.length === 0 ? (
          <p className="muted">Inga händelser matchar filtren.</p>
        ) : (
          months.map((m) => {
            const open = isMonthOpen(m.key)
            return (
              <div key={m.key} className="journal-month">
                <button
                  type="button"
                  className="journal-month-header"
                  aria-expanded={open}
                  onClick={() => toggleMonth(m.key)}
                >
                  <span className="journal-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
                  <span className="journal-month-name">{monthLabel(m.key)}</span>
                  <span className="muted journal-month-count">{eventsLabel(m.count)}</span>
                </button>
                {open &&
                  m.days.map((d) => (
                    <div key={d.date} className="journal-day">
                      <h3 className="journal-day-header">{dayLabel(d.date)}</h3>
                      <ul className="journal-list">
                        {d.items.map((e, i) => (
                          <li key={i}>
                            <span className="journal-cat" style={categoryStyle(e.category)}>{e.category}</span>{' '}
                            <Link to={e.link}>{e.text}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
