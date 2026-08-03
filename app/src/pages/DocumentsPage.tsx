import { Link } from 'react-router-dom'
import DocumentList from '../components/DocumentList'

export default function DocumentsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Dokument</h1>
      <p className="muted">
        Foderanalyser, träckprovsanalyser, ansökningar och andra handlingar — sparade lokalt som
        PDF eller Excel-fil, valfritt kopplade till ett djur eller en grupp.
      </p>
      <section className="section">
        <h2>Alla dokument</h2>
        <DocumentList />
      </section>
    </div>
  )
}
