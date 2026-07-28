import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { growthRateComparison, LITTER_SIZE_LABELS, type GrowthResult } from '../logic/growth'

const PRESETS = [
  { label: 'Digiperiod (dag 0–60)', minAgeDays: 0, maxAgeDays: 60 },
  { label: 'Grovfoderperiod (dag 60–150)', minAgeDays: 60, maxAgeDays: 150 },
]

export default function GrowthComparisonPage() {
  const [minAgeDays, setMinAgeDays] = useState(PRESETS[0].minAgeDays)
  const [maxAgeDays, setMaxAgeDays] = useState(PRESETS[0].maxAgeDays)
  const [results, setResults] = useState<GrowthResult[] | null>(null)

  useEffect(() => {
    let cancelled = false
    growthRateComparison(minAgeDays, maxAgeDays).then((r) => {
      if (!cancelled) setResults(r)
    })
    return () => {
      cancelled = true
    }
  }, [minAgeDays, maxAgeDays])

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Tillväxtjämförelse</h1>
      <p className="muted">
        Jämför tillväxt (g/dag) mellan djur i samma åldersfönster, korrigerat för kullstorlek — ett djur jämförs
        bara mot andra ensamfödda, tvillingar respektive trillingar+, eftersom konkurrensen om di/foder annars
        gör talen missvisande. Metoden är en kontemporärgruppsjämförelse (djurets tillväxt delat med gruppens
        medeltillväxt) — den kräver ingen data från andra besättningar, men är bara en jämförelse inom din egen
        besättning.
      </p>

      <div className="toolbar">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="btn"
            onClick={() => { setMinAgeDays(p.minAgeDays); setMaxAgeDays(p.maxAgeDays) }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="form-row">
        <label>
          Från dag (sedan födsel)
          <input
            type="number"
            min={0}
            value={minAgeDays}
            onChange={(e) => setMinAgeDays(Number(e.target.value))}
          />
        </label>
        <label>
          Till dag (sedan födsel)
          <input
            type="number"
            min={minAgeDays + 1}
            value={maxAgeDays}
            onChange={(e) => setMaxAgeDays(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="section">
        {results === null ? null : results.length === 0 ? (
          <p className="empty">
            Inga djur har vägningar som täcker det här åldersfönstret (kräver kända födelsedatum, känd kullstorlek
            via lamningsregistreringen, och minst två vägningar inom fönstret).
          </p>
        ) : (
          <ul className="link-list">
            {results.map((r, i) => (
              <li key={r.animal.id}>
                {i + 1}.{' '}
                <Link to={`/djur/${r.animal.id}`}>
                  {r.animal.tag_number}{r.animal.name && ` (${r.animal.name})`}
                </Link>
                {' — '}
                <strong>{r.adgGramPerDay.toFixed(0)} g/dag</strong>
                <span className="muted">
                  {' '}({r.ratioPct.toFixed(0)} % av snittet för {LITTER_SIZE_LABELS[r.litterSize].toLowerCase()},
                  {' '}{r.groupSize} djur)
                </span>
                {!r.reliable && <span className="badge badge-warn"> Få jämförelsedjur</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
