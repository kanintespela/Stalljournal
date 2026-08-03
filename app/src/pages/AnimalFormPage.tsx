import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'
import type { Animal, AnimalStatus, Sex } from '../db/types'
import { ANIMAL_STATUS_LABELS, MOVEMENT_COUNTERPARTY_TYPE_SUGGESTIONS } from '../db/types'
import { createAnimalMovements } from '../logic/movements'

const EMPTY: Omit<Animal, 'id' | 'updated_at' | 'deleted_at'> = {
  tag_number: '',
  se_number: '',
  name: '',
  birth_date: null,
  sex: 'okänt',
  breed: '',
  mother_id: null,
  father_id: null,
  status: 'active',
  entry_date: todayStr(),
  exit_date: null,
  exit_reason: '',
  photo_path: null,
  notes: '',
  lambing_id: null,
  slaughter_status: '',
  planned_slaughter_date: null,
}

export default function AnimalFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState({ ...EMPTY })
  const [loaded, setLoaded] = useState(!isEdit)
  const [error, setError] = useState('')
  const [fromOutside, setFromOutside] = useState(false)
  const [originType, setOriginType] = useState('')
  const [originName, setOriginName] = useState('')
  const [originSeNumber, setOriginSeNumber] = useState('')

  useEffect(() => {
    if (!id) return
    db.animals.get(id).then((a) => {
      if (a) {
        setForm({ ...a })
        setLoaded(true)
      }
    })
  }, [id])

  // Möjliga föräldrar: tackor som mor, baggar som far
  const ewes = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.sex === 'tacka' && a.id !== id).toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, [id]) ?? []
  const rams = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.sex === 'bagge' && a.id !== id).toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, [id]) ?? []

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tag_number.trim()) {
      setError('Märkning måste anges.')
      return
    }
    const dup = await db.animals
      .where('tag_number').equals(form.tag_number.trim())
      .filter((a) => a.deleted_at === null && a.id !== id)
      .first()
    if (dup) {
      setError(`Det finns redan ett djur med märkning ${form.tag_number.trim()}.`)
      return
    }
    if (!isEdit && fromOutside) {
      if (!originType.trim()) {
        setError('Ange varifrån djuret kommer (typ).')
        return
      }
      if (!originSeNumber.trim()) {
        setError('Ange avsändarens SE-nummer/registreringsnummer — krävs för smittspårning.')
        return
      }
    }
    const now = nowIso()
    if (isEdit && id) {
      const exitFields = form.status === 'active' ? { exit_date: null, exit_reason: '' } : {}
      await db.animals.update(id, { ...form, ...exitFields, tag_number: form.tag_number.trim(), updated_at: now })
      navigate(`/djur/${id}`)
    } else {
      const animalId = newId()
      const newAnimal = {
        ...form,
        tag_number: form.tag_number.trim(),
        id: animalId,
        updated_at: now,
        deleted_at: null,
      }
      if (fromOutside) {
        await db.transaction('rw', db.animals, db.animal_movements, db.group_memberships, async () => {
          await db.animals.add(newAnimal)
          await createAnimalMovements([animalId], {
            direction: 'in',
            date: form.entry_date ?? todayStr(),
            counterparty_type: originType.trim(),
            counterparty_name: originName.trim(),
            counterparty_se_number: originSeNumber.trim(),
            note: '',
            transporter_vehicle_reg: '',
            transporter_permit_number: '',
          })
        })
      } else {
        await db.animals.add(newAnimal)
      }
      navigate(`/djur/${animalId}`)
    }
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={isEdit ? `/djur/${id}` : '/'} className="back">‹ Avbryt</Link>
      </header>
      <h1>{isEdit ? 'Redigera djur' : 'Nytt djur'}</h1>

      <form onSubmit={save} className="form">
        <label>
          Märkning *
          <input
            value={form.tag_number}
            onChange={(e) => set('tag_number', e.target.value)}
            placeholder="t.ex. 21501"
            autoFocus={!isEdit}
          />
        </label>

        <label>
          Namn
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>

        <label>
          SE-nummer
          <input value={form.se_number} onChange={(e) => set('se_number', e.target.value)} placeholder="SE-produktionsplatsnummer" />
        </label>

        <div className="form-row">
          <label>
            Kön
            <select value={form.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
              <option value="okänt">Okänt</option>
              <option value="tacka">Tacka</option>
              <option value="bagge">Bagge</option>
            </select>
          </label>
          <label>
            Ras
            <input value={form.breed} onChange={(e) => set('breed', e.target.value)} />
          </label>
        </div>

        <div className="form-row">
          <label>
            Födelsedatum
            <input type="date" value={form.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} />
          </label>
          <label>
            Ingångsdatum
            <input type="date" value={form.entry_date ?? ''} onChange={(e) => set('entry_date', e.target.value || null)} />
          </label>
        </div>

        {!isEdit && (
          <>
            <label>
              <input type="checkbox" checked={fromOutside} onChange={(e) => setFromOutside(e.target.checked)} />
              {' '}Djuret kommer utifrån (köpt/mottaget från en annan anläggning)
            </label>
            {fromOutside && (
              <>
                <p className="muted">
                  Registrerar samtidigt en extern flytt (in) för djuret — krävs för smittspårning enligt djurhälsolagen.
                </p>
                <div className="form-row">
                  <label>
                    Avsändarens typ *
                    <input
                      value={originType}
                      onChange={(e) => setOriginType(e.target.value)}
                      list="origin-types"
                      placeholder="t.ex. Annan besättning"
                    />
                    <datalist id="origin-types">
                      {MOVEMENT_COUNTERPARTY_TYPE_SUGGESTIONS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Avsändarens namn
                    <input value={originName} onChange={(e) => setOriginName(e.target.value)} placeholder="t.ex. gårdens namn" />
                  </label>
                </div>
                <label>
                  Avsändarens SE-nummer/registreringsnummer *
                  <input
                    value={originSeNumber}
                    onChange={(e) => setOriginSeNumber(e.target.value)}
                    placeholder="SE-produktionsplatsnummer eller transportörens registreringsnummer"
                  />
                </label>
              </>
            )}
          </>
        )}

        <div className="form-row">
          <label>
            Mor
            <select value={form.mother_id ?? ''} onChange={(e) => set('mother_id', e.target.value || null)}>
              <option value="">—</option>
              {ewes.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
          <label>
            Far
            <select value={form.father_id ?? ''} onChange={(e) => set('father_id', e.target.value || null)}>
              <option value="">—</option>
              {rams.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Status
          <select value={form.status} onChange={(e) => set('status', e.target.value as AnimalStatus)}>
            {Object.entries(ANIMAL_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        {form.status !== 'active' && (
          <div className="form-row">
            <label>
              Utgångsdatum
              <input type="date" value={form.exit_date ?? ''} onChange={(e) => set('exit_date', e.target.value || null)} />
            </label>
            <label>
              Orsak
              <input value={form.exit_reason} onChange={(e) => set('exit_reason', e.target.value)} />
            </label>
          </div>
        )}

        <label>
          Anteckningar
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Spara ändringar' : 'Lägg till djur'}
        </button>
      </form>
    </div>
  )
}
