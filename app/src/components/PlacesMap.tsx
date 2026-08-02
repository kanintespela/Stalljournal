import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Place } from '../db/types'

// Ren Leaflet (utan react-leaflet) — färre beroenden, full kontroll.
// CircleMarkers används i stället för bildikoner (som strular med bundlers).

interface Props {
  places: Place[]
  onSelect?: (place: Place) => void
  height?: number
}

export default function PlacesMap({ places, onSelect, height = 320 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { zoomControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    map.setView([59.3, 15.2], 5) // Sverige som utgångsvy
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const located = places.filter((p) => p.lat != null && p.lng != null)
    for (const p of located) {
      // Tooltip-innehållet ges som ett DOM-element (inte en sträng) så Leaflet
      // sätter det via textContent istället för innerHTML — annars kan ett
      // platsnamn med HTML/script i sig köras som XSS i andra användares webbläsare.
      const tooltipEl = document.createElement('span')
      tooltipEl.textContent = p.name
      const marker = L.circleMarker([p.lat!, p.lng!], {
        radius: 10,
        color: '#3d5a3d',
        fillColor: '#3d5a3d',
        fillOpacity: 0.75,
      })
        .bindTooltip(tooltipEl, { permanent: false })
        .addTo(layer)
      if (onSelect) marker.on('click', () => onSelect(p))
    }
    if (located.length > 0) {
      map.fitBounds(L.latLngBounds(located.map((p) => [p.lat!, p.lng!] as [number, number])), {
        padding: [40, 40],
        maxZoom: 15,
      })
    }
  }, [places, onSelect])

  return <div ref={ref} className="map" style={{ height }} />
}
