import { useRouteError } from 'react-router-dom'

export default function RouteError() {
  const error = useRouteError()
  console.error(error)

  return (
    <div className="page">
      <h1>Något gick fel</h1>
      <p className="empty">
        Appen kunde inte ladda en del av sidan. Det händer oftast när appen har uppdaterats i bakgrunden medan
        den varit öppen — ladda om sidan för att hämta den senaste versionen.
      </p>
      <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
        Ladda om
      </button>
    </div>
  )
}
