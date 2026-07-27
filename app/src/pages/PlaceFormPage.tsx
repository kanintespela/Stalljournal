import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId, nowIso } from '../db/db'
import PositionPicker from '../components/PositionPicker'

export default function PlaceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(!isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.places.get(id).then((p) => {
      if (p) {
        setName(p.name)
        setType(p.type)
        setDescription(p.description)
        setActive(p.active)
        setLat(p.lat)
        setLng(p.lng)
        setLoaded(true)
      }
    })
  }, [id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Platsen måste ha ett namn.')
      return
    }
    const now = nowIso()
    const data = { name: name.trim(), type, description, active, lat, lng, updated_at: now }
    if (isEdit && id) {
      await db.places.update(id, data)
    } else {
      await db.places.add({ ...data, id: newId(), deleted_at: null })
    }
    navigate('/platser')
  }

  async function remove() {
    if (!id) return
    if (!confirm(`Ta bort platsen ${name}?`)) return
    await db.places.update(id, { deleted_at: nowIso(), updated_at: nowIso() })
    navigate('/platser')
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/platser" className="back">‹ Avbryt</Link>
      </header>
      <h1>{isEdit ? 'Redigera plats' : 'Ny plats'}</h1>
      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Namn *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Södra betet" autoFocus={!isEdit} />
          </label>
          <label>
            Typ
            <input value={type} onChange={(e) => setType(e.target.value)} list="place-types" placeholder="t.ex. Bete" />
            <datalist id="place-types">
              <option value="Bete" />
              <option value="Hage" />
              <option value="Stall" />
              <option value="Karantän" />
            </datalist>
          </label>
        </div>
        <label>
          Beskrivning
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktiv plats
        </label>

        <div>
          <span className="form-section-label">Position (för kartan)</span>
          <PositionPicker
            lat={lat}
            lng={lng}
            onChange={(la, ln) => {
              setLat(la)
              setLng(ln)
            }}
          />
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Spara ändringar' : 'Skapa plats'}
        </button>
        {isEdit && (
          <button type="button" className="btn btn-danger" onClick={remove}>Ta bort plats</button>
        )}
      </form>
    </div>
  )
}
