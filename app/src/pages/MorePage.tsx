import { Link } from 'react-router-dom'
import { isLoggedIn } from '../sync/client'

export default function MorePage() {
  return (
    <div className="page">
      <h1>Mer</h1>
      <ul className="card-list">
        <li>
          <Link to="/mer/slakt" className="card">
            <div className="card-main">
              <span className="card-title">Slakt</span>
              <span className="card-meta">Planera och registrera slakt, vikter och intäkter</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/slakterier" className="card">
            <div className="card-main">
              <span className="card-title">Slakterier</span>
              <span className="card-meta">Kontaktuppgifter till slakterier</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/rapport" className="card">
            <div className="card-main">
              <span className="card-title">Årsrapport</span>
              <span className="card-meta">Produktionsuppföljning per år — skriv ut eller spara som PDF</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/egenskaper" className="card">
            <div className="card-main">
              <span className="card-title">Avelsegenskaper</span>
              <span className="card-meta">Registrera och jämför egna egenskaper — temperament, exteriör, ullfällning m.m.</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/tillvaxt" className="card">
            <div className="card-main">
              <span className="card-title">Tillväxtjämförelse</span>
              <span className="card-meta">Tillväxt (g/dag) korrigerad för kullstorlek</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/synk" className="card">
            <div className="card-main">
              <span className="card-title">Synkronisering</span>
              <span className="card-meta">Dela data mellan enheter via din egen server</span>
            </div>
            <div className="card-badges">
              <span className="badge">{isLoggedIn() ? 'Ansluten' : 'Ej ansluten'}</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/import" className="card">
            <div className="card-main">
              <span className="card-title">Importera från Excel</span>
              <span className="card-meta">Engångsimport av en Excel-export — tas bort efter användning</span>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  )
}
