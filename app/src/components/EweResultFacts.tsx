import { Link } from 'react-router-dom'
import { fatLabel, gradeLabel, MIN_RELIABLE_SLAUGHTERED, perLambing, type EweResult } from '../logic/eweResults'

// Tackfacit för en tacka: nyckeltal + avkommelista. Används både på
// Tackfacit-sidan och på tackans djurkort. perYear = visa summor som snitt per år.

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`
const kg = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kg`
const num = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })
/** "1 slaktad" / "2 slaktade" — singular bara för exakt 1. */
const pl = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`

export default function EweResultFacts({ r, perYear = false, showOffspring = true }: {
  r: EweResult
  perYear?: boolean
  showOffspring?: boolean
}) {
  const y = perYear ? r.years : 1
  const kgPerLambing = perLambing(r.carcassKg, r)
  const krPerLambing = perLambing(r.value, r)

  return (
    <>
      {perYear && r.yearSpan && (
        <p className="muted">
          Snitt per år över {r.years} år ({r.yearSpan[0]}–{r.yearSpan[1]}).
        </p>
      )}
      <dl className="facts">
        <dt>Slaktvärde (brutto)</dt>
        <dd>
          <strong>{kr(r.value / y)}</strong>
          {krPerLambing !== null && <span className="muted"> · {kr(krPerLambing)} per lamning</span>}
        </dd>
        <dt>Slaktkropp</dt>
        <dd>
          <strong>{kg(r.carcassKg / y)}</strong>
          {kgPerLambing !== null && <span className="muted"> · {kg(kgPerLambing)} per lamning</span>}
        </dd>
        <dt>Klassning</dt>
        <dd>
          {r.grades.length === 0
            ? '—'
            : r.grades.map(([g, n]) => `${g} ${n}`).join(' · ')}
          {r.avgGradeScore !== null && <span className="muted"> (medel ≈ {gradeLabel(r.avgGradeScore)})</span>}
        </dd>
        <dt>Fettgrupp, medel</dt>
        <dd>{r.avgFatScore !== null ? `≈ ${fatLabel(r.avgFatScore)}` : '—'}</dd>
        <dt>Medelslaktvikt</dt>
        <dd>{r.weighedCount > 0 ? kg(r.carcassKg / r.weighedCount) : '—'}</dd>
        <dt>Ålder vid slakt, medel</dt>
        <dd>{r.avgAgeAtSlaughterDays !== null ? `${Math.round(r.avgAgeAtSlaughterDays)} dagar` : '—'}</dd>
        <dt>Lamning</dt>
        <dd>
          {pl(r.lambings / y, 'lamning', 'lamningar')} · {pl(r.liveBorn / y, 'levande född', 'levande födda')}
          {r.deadBorn > 0 && `, ${pl(r.deadBorn / y, 'död', 'döda')}`}
        </dd>
        <dt>Avkommor</dt>
        <dd>
          {pl(r.slaughtered / y, 'slaktad', 'slaktade')}
          {r.kept > 0 && ` · ${pl(r.kept / y, 'behållen', 'behållna')}`}
          {r.pending > 0 && ` · ${pl(r.pending / y, 'ej avgjord', 'ej avgjorda')}`}
          {r.other > 0 && ` · ${num(r.other / y)} sålda/döda/övrigt`}
        </dd>
      </dl>

      <p className="chips">
        {r.slaughtered < MIN_RELIABLE_SLAUGHTERED && (
          <span className="badge badge-warn">Få slaktade avkommor — osäkert underlag</span>
        )}
        {r.missingValue > 0 && (
          <span className="badge badge-warn">{r.missingValue} slakt saknar vikt eller kilopris</span>
        )}
      </p>

      {showOffspring && r.offspring.length > 0 && (
        <ul className="link-list">
          {r.offspring.map((o) => (
            <li key={o.animal.id}>
              <Link to={`/djur/${o.animal.id}`}>
                {o.animal.tag_number}{o.animal.name && ` (${o.animal.name})`}
              </Link>
              {o.birthDate && <span className="muted"> f. {o.birthDate}</span>}
              {' — '}
              {o.slaughter ? (
                <>
                  slaktad {o.slaughter.date}
                  {o.slaughter.carcass_weight != null && `, ${kg(o.slaughter.carcass_weight)}`}
                  {o.slaughter.grade && `, ${o.slaughter.grade}`}
                  {o.slaughter.fat_class && `/${o.slaughter.fat_class}`}
                  {o.value !== null && `, ${kr(o.value)}`}
                </>
              ) : o.outcome === 'kept' ? (
                'behållen'
              ) : o.outcome === 'pending' ? (
                'ej avgjord'
              ) : (
                <span className="muted">utgången utan slaktpost</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
