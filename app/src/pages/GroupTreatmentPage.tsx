import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { activeMembersWithAnimals, treatGroupMembers } from '../logic/herd'

export default function GroupTreatmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [date, setDate] = useState(todayStr())
  const [drug, setDrug] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('')
  const [treatedBy, setTreatedBy] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [veterinarian, setVeterinarian] = useState('')
  const [withdrawalDays, setWithdrawalDays] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const group = useLiveQuery(() => (id ? db.herd_groups.get(id) : undefined), [id])
  const members = useLiveQuery(() => (id ? activeMembersWithAnimals(id) : []), [id])
  const activeCount = (members ?? []).filter((m) => m.animal.status === 'active').length

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!drug.trim()) {
      setError('Ange läkemedel/preparat.')
      return
    }
    if (activeCount === 0) {
      setError('Gruppen har inga aktiva djur.')
      return
    }
    const n = await treatGroupMembers(id, {
      date,
      drug: drug.trim(),
      dose,
      route,
      treated_by: treatedBy,
      diagnosis,
      veterinarian,
      withdrawal_days: withdrawalDays,
      note,
      photo_path: null,
    })
    alert(`Behandling registrerad för ${n} djur.`)
    navigate(`/grupper/${id}`)
  }

  if (!group) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={`/grupper/${id}`} className="back">‹ Avbryt</Link>
      </header>
      <h1>Behandla {group.name}</h1>
      <p className="muted">
        Skapar en journalrad för vart och ett av gruppens <strong>{activeCount}</strong> aktiva djur.
      </p>

      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Läkemedel *
            <input value={drug} onChange={(e) => setDrug(e.target.value)} placeholder="t.ex. Ivomec" autoFocus />
          </label>
        </div>
        <div className="form-row">
          <label>
            Dosering
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="t.ex. 1 ml/50 kg" />
          </label>
          <label>
            Administration
            <input value={route} onChange={(e) => setRoute(e.target.value)} list="routes" placeholder="t.ex. oralt" />
            <datalist id="routes">
              <option value="Oralt" />
              <option value="Injektion" />
              <option value="Pour-on" />
              <option value="Intramammärt" />
            </datalist>
          </label>
        </div>
        <label>
          Orsak/diagnos
          <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="t.ex. avmaskning" />
        </label>
        <div className="form-row">
          <label>
            Behandlande person
            <input value={treatedBy} onChange={(e) => setTreatedBy(e.target.value)} />
          </label>
          <label>
            Veterinär
            <input value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} />
          </label>
        </div>
        <label>
          Karens (dagar)
          <input
            type="number"
            min={0}
            value={withdrawalDays}
            onChange={(e) => setWithdrawalDays(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Anteckning
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          Registrera för {activeCount} djur
        </button>
      </form>
    </div>
  )
}
