import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { forecastHerd, type WeightForecast } from '../logic/growthForecast'
import { LITTER_SIZE_LABELS } from '../logic/growth'

export default function WeightForecastPage() {
  const [targetWeightKg, setTargetWeightKg] = useState(50)
  const [results, setResults] = useState<WeightForecast[] | null>(null)

  useEffect(() => {
    let cancelled = false
    forecastHerd(targetWeightKg).then((r) => {
      if (!cancelled) setResults(r)
    })
    return () => {
      cancelled = true
    }
  }, [targetWeightKg])

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Viktprognos</h1>
      <p className="muted">
        Uppskattar vilket datum varje djur når målvikten, utifrån dess egna vägningar. Lammtillväxt avtar med
        åldern, så modellen räknar med en avtagande tillväxtkurva (inte en rak linje genom vägningarna) — med minst
        tre vägningar skattas kurvans avtagande utifrån djurets egen data, med bara två används besättningens
        genomsnittliga avtagande istället och märks som mindre säkert. Kullstorlek visas som kontext (konkurrensen
        om di/foder påverkar tillväxten mycket) men påverkar ännu inte själva kurvan.
      </p>

      <div className="form-row">
        <label>
          Målvikt (kg)
          <input
            type="number"
            min={1}
            value={targetWeightKg}
            onChange={(e) => setTargetWeightKg(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="section">
        {results === null ? null : results.length === 0 ? (
          <p className="empty">
            Inga djur att prognostisera. Kräver aktiva djur med känt födelsedatum och minst två registrerade
            vägningar som ännu inte nått målvikten.
          </p>
        ) : (
          <ul className="link-list">
            {results.map((r) => (
              <li key={r.animal.id}>
                <Link to={`/djur/${r.animal.id}`}>
                  {r.animal.tag_number}{r.animal.name && ` (${r.animal.name})`}
                </Link>
                {' — '}
                {r.unreachable ? (
                  <span className="badge badge-warn">Når inte {r.targetWeightKg} kg vid nuvarande tillväxt</span>
                ) : (
                  <strong>{r.predictedDate}</strong>
                )}
                <span className="muted">
                  {' '}(senast vägd {r.last.weightKg} kg, {r.last.ageDays} dagar gammal
                  {r.litterSize && `, ${LITTER_SIZE_LABELS[r.litterSize].toLowerCase()}`})
                </span>
                {!r.reliable && <span className="badge badge-warn"> Osäker prognos</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
