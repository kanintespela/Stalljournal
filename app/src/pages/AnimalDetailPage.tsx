import { Suspense, lazy } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso } from '../db/db'
import { ANIMAL_STATUS_LABELS, MOVEMENT_DIRECTION_LABELS, expectedLambingDate, isInWithdrawal, withdrawalUntil } from '../db/types'
import { groupsForAnimal } from '../logic/herd'
import { activePregnancy } from '../logic/breeding'
import { describeKinship, kinshipCoefficient } from '../logic/pedigree'
import PhotoGallery from '../components/PhotoGallery'
import AnimalTraits from '../components/AnimalTraits'
import DocumentList from '../components/DocumentList'

const WeightChart = lazy(() => import('../components/WeightChart'))

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const animal = useLiveQuery(() => (id ? db.animals.get(id) : undefined), [id])
  const mother = useLiveQuery(
    () => (animal?.mother_id ? db.animals.get(animal.mother_id) : undefined),
    [animal?.mother_id],
  )
  const father = useLiveQuery(
    () => (animal?.father_id ? db.animals.get(animal.father_id) : undefined),
    [animal?.father_id],
  )
  const offspring = useLiveQuery(async () => {
    if (!id) return []
    const asMother = await db.animals.where('mother_id').equals(id).toArray()
    const asFather = await db.animals.where('father_id').equals(id).toArray()
    return [...asMother, ...asFather].filter((a) => a.deleted_at === null)
  }, [id])
  const treatments = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.treatments.where('animal_id').equals(id).toArray()
    return rows.filter((t) => t.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const weighings = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.weighings.where('animal_id').equals(id).toArray()
    return rows.filter((w) => w.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const groups = useLiveQuery(() => (id ? groupsForAnimal(id) : []), [id])
  const lambings = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.lambings.where('ewe_id').equals(id).toArray()
    const live = rows.filter((l) => l.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
    return Promise.all(
      live.map(async (l) => ({
        lambing: l,
        lambs: (await db.animals.where('lambing_id').equals(l.id).toArray()).filter((a) => a.deleted_at === null),
      })),
    )
  }, [id])
  const conditions = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.body_conditions.where('animal_id').equals(id).toArray()
    return rows.filter((c) => c.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const pregnancy = useLiveQuery(
    async () => (id && animal?.sex === 'tacka' ? activePregnancy(id) : undefined),
    [id, animal?.sex],
  )
  const matings = useLiveQuery(async () => {
    if (!id) return []
    const [asEwe, asRam] = await Promise.all([
      db.matings.where('ewe_id').equals(id).toArray(),
      db.matings.where('ram_id').equals(id).toArray(),
    ])
    const rows = [...asEwe, ...asRam]
      .filter((m) => m.deleted_at === null)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
    const partners = new Map(
      (await db.animals.bulkGet(rows.map((m) => (m.ewe_id === id ? m.ram_id : m.ewe_id))))
        .filter(Boolean)
        .map((a) => [a!.id, a!]),
    )
    return rows.map((m) => ({ mating: m, partner: partners.get(m.ewe_id === id ? m.ram_id : m.ewe_id) }))
  }, [id])
  const ownF = useLiveQuery(
    () => (animal?.mother_id && animal?.father_id ? kinshipCoefficient(animal.mother_id, animal.father_id) : null),
    [animal?.mother_id, animal?.father_id],
  )
  const slaughters = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.slaughters.where('animal_id').equals(id).toArray()
    return rows.filter((s) => s.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const movements = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.animal_movements.where('animal_id').equals(id).toArray()
    return rows.filter((m) => m.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])

  if (animal === undefined) return null
  if (!animal || animal.deleted_at) {
    return (
      <div className="page">
        <p className="empty">Djuret hittades inte.</p>
        <Link to="/" className="btn">Till djurlistan</Link>
      </div>
    )
  }

  const activeWithdrawals = (treatments ?? []).filter((t) => isInWithdrawal(t))

  async function remove() {
    if (!animal) return
    if (!confirm(`Ta bort ${animal.tag_number}? Djuret döljs men kan återställas av support.`)) return
    await db.animals.update(animal.id, { deleted_at: nowIso(), updated_at: nowIso() })
    navigate('/')
  }

  // Ångra en felregistrerad journalrad (soft delete). Djurets status/grupper
  // återställs inte automatiskt — det sägs i bekräftelsen när det är relevant.
  async function removeRow(
    table: 'weighings' | 'treatments' | 'body_conditions' | 'animal_movements' | 'lambings' | 'matings',
    id: string,
    label: string,
    extra = '',
  ) {
    if (!confirm(`Ta bort ${label}?${extra ? ` ${extra}` : ''}`)) return
    const now = nowIso()
    await db[table].update(id, { deleted_at: now, updated_at: now })
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="back">‹ Djur</Link>
        <Link to={`/djur/${animal.id}/redigera`} className="btn">Redigera</Link>
      </header>

      <h1>
        {animal.tag_number}
        {animal.name && <span className="muted"> · {animal.name}</span>}
      </h1>
      <p className="chips">
        <span className="badge">{ANIMAL_STATUS_LABELS[animal.status]}</span>
        {animal.sex !== 'okänt' && <span className="badge">{animal.sex === 'tacka' ? 'Tacka' : 'Bagge'}</span>}
        {activeWithdrawals.length > 0 && <span className="badge badge-warn">Karens pågår</span>}
        {pregnancy && (
          <span className="badge">Beräknad lamning {fmtDate(expectedLambingDate(pregnancy))}</span>
        )}
      </p>

      {activeWithdrawals.length > 0 && (
        <div className="alert">
          Karens t.o.m.{' '}
          <strong>
            {fmtDate(
              activeWithdrawals
                .map((t) => withdrawalUntil(t)!)
                .reduce((a, b) => (a > b ? a : b)),
            )}
          </strong>{' '}
          ({activeWithdrawals[0].drug}). Djuret får inte slaktas under karensen.
        </div>
      )}

      <div className="action-grid">
        <Link to={`/journal/vagning?djur=${animal.id}`} className="btn">Väg</Link>
        <Link to={`/journal/behandling?djur=${animal.id}`} className="btn">Behandla</Link>
        {animal.sex === 'tacka' && animal.status === 'active' && (
          <Link to={`/journal/lamning?tacka=${animal.id}`} className="btn">Lamning</Link>
        )}
        <Link to={`/journal/hull?djur=${animal.id}`} className="btn">Hull</Link>
        <Link to={`/journal/flytt?djur=${animal.id}`} className="btn">Extern flytt</Link>
      </div>

      <PhotoGallery animalId={animal.id} />

      <section className="section">
        <h2>Dokument</h2>
        <DocumentList animalId={animal.id} />
      </section>

      <section className="section">
        <h2>Uppgifter</h2>
        <dl className="facts">
          {animal.se_number && (<><dt>SE-nummer</dt><dd>{animal.se_number}</dd></>)}
          {animal.breed && (<><dt>Ras</dt><dd>{animal.breed}</dd></>)}
          {animal.birth_date && (<><dt>Född</dt><dd>{animal.birth_date}</dd></>)}
          {animal.entry_date && (<><dt>Ingång</dt><dd>{animal.entry_date}</dd></>)}
          {animal.exit_date && (<><dt>Utgång</dt><dd>{animal.exit_date}{animal.exit_reason && ` (${animal.exit_reason})`}</dd></>)}
          {animal.notes && (<><dt>Anteckningar</dt><dd>{animal.notes}</dd></>)}
        </dl>
      </section>

      {movements && movements.length > 0 && (
        <section className="section">
          <h2>Förflyttningar ({movements.length})</h2>
          <ul className="link-list">
            {movements.map((m) => (
              <li key={m.id}>
                {m.date}: <strong>{MOVEMENT_DIRECTION_LABELS[m.direction]}</strong>
                {` — ${m.counterparty_type}`}
                {m.counterparty_name && ` ${m.counterparty_name}`}
                {` (SE-nr ${m.counterparty_se_number})`}
                {m.note && <span className="muted"> — {m.note}</span>}
                <button
                  className="link-btn"
                  onClick={() =>
                    removeRow(
                      'animal_movements',
                      m.id,
                      `flytten ${m.date}`,
                      'Djurets status och grupper återställs inte automatiskt — ändra dem via Redigera om flytten hann markera djuret som utgånget.',
                    )
                  }
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Härstamning</h2>
          <Link to={`/djur/${animal.id}/slaktrad`} className="btn">Släktträd</Link>
        </div>
        <dl className="facts">
          <dt>Mor</dt>
          <dd>{mother ? <Link to={`/djur/${mother.id}`}>{mother.tag_number}{mother.name && ` (${mother.name})`}</Link> : '—'}</dd>
          <dt>Far</dt>
          <dd>{father ? <Link to={`/djur/${father.id}`}>{father.tag_number}{father.name && ` (${father.name})`}</Link> : '—'}</dd>
          {ownF != null && (
            <>
              <dt>Inavelskoefficient</dt>
              <dd>{describeKinship(ownF).pct.toFixed(1)} %</dd>
            </>
          )}
        </dl>
        {offspring && offspring.length > 0 && (
          <>
            <h3>Avkommor ({offspring.length})</h3>
            <ul className="link-list">
              {offspring.map((o) => (
                <li key={o.id}>
                  <Link to={`/djur/${o.id}`}>{o.tag_number}{o.name && ` (${o.name})`}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {groups && groups.length > 0 && (
        <section className="section">
          <h2>Grupper</h2>
          <ul className="link-list">
            {groups.map(({ membership, group }) => (
              <li key={membership.id}>
                <Link to={`/grupper/${group.id}`}>{group.name}</Link>
                <span className="muted"> sedan {membership.added_on}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Vägningar {weighings && weighings.length > 0 && `(${weighings.length})`}</h2>
        {!weighings || weighings.length === 0 ? (
          <p className="muted">Inga vägningar registrerade.</p>
        ) : (
          <>
            {weighings.length >= 2 && (
              <Suspense fallback={<div className="chart" style={{ height: 200 }} />}>
                <WeightChart weighings={weighings} />
              </Suspense>
            )}
            <ul className="link-list">
              {weighings.slice(0, 5).map((w) => (
                <li key={w.id}>
                  {w.date}: <strong>{w.weight_kg} kg</strong>{w.type && ` (${w.type})`}
                  <button className="link-btn" onClick={() => removeRow('weighings', w.id, `vägningen ${w.date} (${w.weight_kg} kg)`)}>
                    Ta bort
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {matings && matings.length > 0 && (
        <section className="section">
          <h2>Betäckningar ({matings.length})</h2>
          <ul className="link-list">
            {matings.map(({ mating, partner }) => (
              <li key={mating.id}>
                {mating.start_date}
                {mating.end_date && `–${mating.end_date}`}
                {': '}
                {partner ? (
                  <Link to={`/djur/${partner.id}`}>
                    {partner.tag_number}{partner.name && ` (${partner.name})`}
                  </Link>
                ) : '?'}
                <button
                  className="link-btn"
                  onClick={() =>
                    removeRow(
                      'matings',
                      mating.id,
                      `betäckningen ${mating.start_date}`,
                      'Om betäckningen redan använts vid en lamning ändras inte lammens far i efterhand.',
                    )
                  }
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lambings && lambings.length > 0 && (
        <section className="section">
          <h2>Lamningar ({lambings.length})</h2>
          <ul className="link-list">
            {lambings.map(({ lambing, lambs }) => (
              <li key={lambing.id}>
                {lambing.date}: <strong>{lambing.live_count} lamm</strong>
                {lambing.dead_count > 0 && ` (${lambing.dead_count} döda)`}
                {lambs.length > 0 && (
                  <>
                    {' — '}
                    {lambs.map((l, i) => (
                      <span key={l.id}>
                        {i > 0 && ', '}
                        <Link to={`/djur/${l.id}`}>{l.tag_number}</Link>
                      </span>
                    ))}
                  </>
                )}
                {lambing.note && <span className="muted"> — {lambing.note}</span>}
                <button
                  className="link-btn"
                  onClick={() =>
                    removeRow(
                      'lambings',
                      lambing.id,
                      `lamningen ${lambing.date}`,
                      lambs.length > 0
                        ? 'Lammen som skapades tas inte bort automatiskt — hantera dem själv via djurkortet om det behövs.'
                        : '',
                    )
                  }
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {conditions && conditions.length > 0 && (
        <section className="section">
          <h2>Hullbedömningar ({conditions.length})</h2>
          <ul className="link-list">
            {conditions.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.date}: <strong>{c.score}</strong>
                {c.note && <span className="muted"> — {c.note}</span>}
                <button className="link-btn" onClick={() => removeRow('body_conditions', c.id, `hullbedömningen ${c.date}`)}>
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnimalTraits animalId={animal.id} />

      <section className="section">
        <h2>Behandlingar {treatments && treatments.length > 0 && `(${treatments.length})`}</h2>
        {!treatments || treatments.length === 0 ? (
          <p className="muted">Inga behandlingar registrerade.</p>
        ) : (
          <ul className="link-list">
            {treatments.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.date}: <strong>{t.drug}</strong>
                {t.withdrawal_days > 0 && ` — karens ${t.withdrawal_days} d`}
                {isInWithdrawal(t) && ' (pågår)'}
                <button
                  className="link-btn"
                  onClick={() =>
                    removeRow(
                      'treatments',
                      t.id,
                      `behandlingen ${t.date} (${t.drug})`,
                      isInWithdrawal(t) ? 'OBS: karensvakten för den här behandlingen försvinner också.' : '',
                    )
                  }
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {slaughters && slaughters.length > 0 && (
        <section className="section">
          <h2>Slakt</h2>
          <ul className="link-list">
            {slaughters.map((s) => (
              <li key={s.id}>
                <Link to={`/mer/slakt/${s.id}`}>
                  {s.date}: {s.status === 'done' ? 'Slaktad' : s.status === 'reported' ? 'Anmäld' : 'Planerad'}
                  {s.carcass_weight != null && ` — ${s.carcass_weight} kg`}
                  {s.grade && ` ${s.grade}${s.fat_class ? `/${s.fat_class}` : ''}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <button className="btn btn-danger" onClick={remove}>Ta bort djur</button>
      </section>
    </div>
  )
}
