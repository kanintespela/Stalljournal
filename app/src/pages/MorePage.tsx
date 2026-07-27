import { Link } from 'react-router-dom'

export default function MorePage() {
  return (
    <div className="page">
      <h1>Mer</h1>
      <ul className="card-list">
        <li>
          <Link to="/mer/slakt" className="card">
            <div className="card-main">
              <span className="card-title">🥩 Slakt</span>
              <span className="card-meta">Planera och registrera slakt, vikter och intäkter</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/slakterier" className="card">
            <div className="card-main">
              <span className="card-title">🏭 Slakterier</span>
              <span className="card-meta">Kontaktuppgifter till slakterier</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/rapport" className="card">
            <div className="card-main">
              <span className="card-title">📊 Årsrapport</span>
              <span className="card-meta">Produktionsuppföljning per år — skriv ut eller spara som PDF</span>
            </div>
          </Link>
        </li>
      </ul>
      <p className="muted form-hint">Moln-synk och inställningar kommer i fas 5.</p>
    </div>
  )
}
