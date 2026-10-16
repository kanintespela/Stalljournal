import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'
import { GESTATION_DAYS, expectedLambingDate } from '../db/types'
import { groupsForAnimal } from '../logic/herd'
import { describeKinship, kinshipCoefficient } from '../logic/pedigree'

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Den enda aktiva baggen som går i någon av tackans grupper, annars null. */
async function ramInEweGroups(eweId: string): Promise<string | null> {
  const groups = await groupsForAnimal(eweId)
  const ms = await db.group_memberships
    .where('group_id')
    .anyOf(groups.map((g) => g.group.id))
    .filter((m) => m.deleted_at === null && m.removed_on === null)
    .toArray()
  const animals = await db.animals.bulkGet([...new Set(ms.map((m) => m.animal_id))])
  const rams = animals.filter((a) => a && a.deleted_at === null && a.status === 'active' && a.sex === 'bagge')
  return rams.length === 1 ? rams[0]!.id : null
}

// Öppnas antingen från journalen (betäckningsperiod) eller från tackans djurkort
// med ?tacka=<id> ("Märkt av bagge"): då är tackan förvald, datumet är märkdatumet
// och man kommer tillbaka till djurkortet efteråt.
export default function MatingFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetEwe = params.get('tacka')
  const marking = presetEwe !== null
  const backTo = marking ? `/djur/${presetEwe}` : '/journal'

  const [eweId, setEweId] = useState(presetEwe ?? '')
  const [ramId, setRamId] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const ewes = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && a.sex === 'tacka')
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []
  const rams = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && a.sex === 'bagge')
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  // Förvälj baggen om det går entydigt att se vilken bagge som går med tackan.
  useEffect(() => {
    if (!presetEwe) return
    let cancelled = false
    ramInEweGroups(presetEwe).then((id) => {
      if (!cancelled && id) setRamId((cur) => cur || id)
    })
    return () => {
      cancelled = true
    }
  }, [presetEwe])

  const expected = startDate ? fmtDate(expectedLambingDate({ start_date: startDate })) : null

  const kinshipF = useLiveQuery(
    () => (eweId && ramId ? kinshipCoefficient(eweId, ramId) : null),
    [eweId, ramId],
  )
  const kinship = kinshipF != null ? describeKinship(kinshipF) : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!eweId || !ramId) {
      setError('Välj både tacka och bagge.')
      return
    }
    await db.matings.add({
      id: newId(),
      ewe_id: eweId,
      ram_id: ramId,
      start_date: startDate,
      end_date: marking ? null : endDate || null,
      updated_at: nowIso(),
      deleted_at: null,
    })
    navigate(backTo)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to={backTo} className="back">‹ Avbryt</Link>
      </header>
      <h1>{marking ? 'Märkt av bagge' : 'Registrera betäckning'}</h1>
      {marking && (
        <p className="muted">
          Ange dagen tackan blev märkt av baggen. Beräknad lamning räknas från märkdatumet. Blir hon
          märkt igen (omlöpning) registrerar du bara en ny märkning — den senaste gäller.
        </p>
      )}

      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Tacka *
            <select value={eweId} onChange={(e) => setEweId(e.target.value)}>
              <option value="">Välj tacka…</option>
              {ewes.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
          <label>
            Bagge *
            <select value={ramId} onChange={(e) => setRamId(e.target.value)}>
              <option value="">Välj bagge…</option>
              {rams.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            {marking ? 'Märkdatum' : 'Startdatum'}
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          {!marking && (
            <label>
              Slutdatum
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          )}
        </div>
        {expected && (
          <p className="chips">
            <span className="badge">Beräknad lamning: {expected} ({GESTATION_DAYS} dagar)</span>
          </p>
        )}
        {kinship && (
          <p className="chips">
            <span className={kinship.severity === 'none' ? 'badge' : 'badge badge-warn'}>
              Väntad inavelskoefficient: {kinship.pct.toFixed(1)} %
            </span>
          </p>
        )}
        {kinship && kinship.severity === 'high' && <div className="alert">{kinship.label}.</div>}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">{marking ? 'Spara märkning' : 'Spara betäckning'}</button>
      </form>
    </div>
  )
}
