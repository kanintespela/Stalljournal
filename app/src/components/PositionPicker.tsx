import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Kartväljare för en plats position: tryck i kartan eller använd GPS.

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
}

export default function PositionPicker({ lat, lng, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const [gpsStatus, setGpsStatus] = useState('')

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    if (lat != null && lng != null) map.setView([lat, lng], 14)
    else map.setView([59.3, 15.2], 5)
    map.on('click', (e: L.LeafletMouseEvent) => {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)))
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    if (lat != null && lng != null) {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#3d5a3d',
        fillColor: '#3d5a3d',
        fillOpacity: 0.75,
      }).addTo(map)
    }
  }, [lat, lng])

  function useGps() {
    if (!navigator.geolocation) {
      setGpsStatus('GPS stöds inte i den här webbläsaren.')
      return
    }
    setGpsStatus('Hämtar position…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos.coords.latitude.toFixed(6))
        const ln = Number(pos.coords.longitude.toFixed(6))
        onChange(la, ln)
        mapRef.current?.setView([la, ln], 15)
        setGpsStatus('')
      },
      () => setGpsStatus('Kunde inte hämta position (tillåt platsåtkomst).'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="position-picker">
      <div className="position-row">
        <button type="button" className="btn" onClick={useGps}>📍 Använd min position</button>
        {lat != null && lng != null ? (
          <span className="muted">
            {lat.toFixed(5)}, {lng.toFixed(5)}{' '}
            <button type="button" className="link-btn" onClick={() => onChange(null, null)}>Rensa</button>
          </span>
        ) : (
          <span className="muted">Tryck i kartan för att sätta position</span>
        )}
      </div>
      {gpsStatus && <p className="muted">{gpsStatus}</p>}
      <div ref={ref} className="map" style={{ height: 260 }} />
    </div>
  )
}
