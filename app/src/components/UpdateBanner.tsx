import { useRegisterSW } from 'virtual:pwa-register/react'

// Webbläsaren letar annars bara efter en ny version när appen startas, och en
// installerad app på mobilen återupptas oftast från bakgrunden i stället för
// att startas om. Därför letar vi även varje timme och när appen visas igen.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine && document.visibilityState === 'visible') registration.update().catch(() => {})
      }
      setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', check)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-banner no-print" role="status">
      <span>En ny version av appen finns.</span>
      <div className="update-banner-actions">
        <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>Senare</button>
        <button type="button" className="btn btn-primary" onClick={() => updateServiceWorker(true)}>Uppdatera</button>
      </div>
    </div>
  )
}
