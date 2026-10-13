import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { eweResults, gradeLabel, lambingYears, MIN_RELIABLE_SLAUGHTERED, perLambing, type EwePeriod, type EweResult } from '../logic/eweResults'
import EweResultFacts from '../components/EweResultFacts'

type SortKey = 'value' | 'valuePerLambing' | 'kg' | 'kgPerLambing' | 'grade' | 'slaughtered'

const SORT_LABELS: Record<SortKey, string> = {
  valuePerLambing: 'Slaktvärde per lamning',
  value: 'Slaktvärde totalt',
  kgPerLambing: 'Kg slaktkropp per lamning',
  kg: 'Kg slaktkropp totalt',
  grade: 'Medelklassning',
  slaughtered: 'Antal slaktade',
}

function sortValue(r: EweResult, key: SortKey): number {
  switch (key) {
    case 'value': return r.value / r.years
    case 'valuePerLambing': return perLambing(r.value, r) ?? -1
    case 'kg': return r.carcassKg / r.years
    case 'kgPerLambing': return perLambing(r.carcassKg, r) ?? -1
    case 'grade': return r.avgGradeScore ?? -1
    case 'slaughtered': return r.slaughtered / r.years
  }
}

export default function EweResultsPage() {
  const [periodValue, setPeriodValue] = useState('life')
  const [sortKey, setSortKey] = useState<SortKey>('valuePerLambing')
  const [showExited, setShowExited] = useState(false)

  const period: EwePeriod =
    periodValue === 'life' ? { kind: 'life' }
    : periodValue === 'perYear' ? { kind: 'perYear' }
    : { kind: 'year', year: Number(periodValue) }

  const years = useLiveQuery(() => lambingYears(), [])
  const results = useLiveQuery(() => eweResults(period), [periodValue])

  const perYear = period.kind === 'perYear'
  const shown = (results ?? [])
    .filter((r) => showExited || r.ewe.status === 'active')
    .sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey)
      || a.ewe.tag_number.localeCompare(b.ewe.tag_number, 'sv', { numeric: true }))

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Tackfacit</h1>
      <p className="muted">
        Vad varje tackas avkommor har gett vid slakt: slaktkroppsvikt, EUROP-klassning och slaktvärde
        (bruttobelopp, kilopris × slaktvikt). Avkommor räknas till sitt födelseår. Lamm som behållits i
        besättningen längre än ett år räknas som behållna (rekrytering) och yngre levande lamm som ej avgjorda —
        ingetdera drar ner tackans resultat, men ger heller inget slaktvärde ännu.
      </p>

      <div className="toolbar">
        <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
          <option value="life">Hela livet</option>
          <option value="perYear">Snitt per år</option>
          {(years ?? []).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </div>
      <div className="toolbar">
        <label className="toggle">
          <input type="checkbox" checked={showExited} onChange={(e) => setShowExited(e.target.checked)} />
          Visa även tackor som lämnat besättningen
        </label>
      </div>

      {results === undefined ? null : shown.length === 0 ? (
        <p className="empty">
          Inga tackor med lamningar eller avkommor {period.kind === 'year' ? `födda ${period.year}` : 'ännu'}.
        </p>
      ) : (
        shown.map((r, i) => (
          <details key={r.ewe.id} className="section ewe-result">
            <summary>
              <strong>{i + 1}. {r.ewe.tag_number}{r.ewe.name && ` (${r.ewe.name})`}</strong>
              <span className="muted">
                {' — '}{Math.round(r.value / r.years).toLocaleString('sv-SE')} kr
                {' · '}{(r.carcassKg / r.years).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kg
                {perYear && ' per år'}
                {r.avgGradeScore !== null && ` · ≈ ${gradeLabel(r.avgGradeScore)}`}
                {' · '}{r.slaughtered} {r.slaughtered === 1 ? 'slaktad' : 'slaktade'}
              </span>
              {r.ewe.status !== 'active' && <span className="badge"> Utgången</span>}
              {r.slaughtered < MIN_RELIABLE_SLAUGHTERED && <span className="badge badge-warn"> Få slaktade</span>}
            </summary>
            <div className="details-body">
              <p><Link to={`/djur/${r.ewe.id}`}>Till djurkortet ›</Link></p>
              <EweResultFacts r={r} perYear={perYear} />
            </div>
          </details>
        ))
      )}
    </div>
  )
}
