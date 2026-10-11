import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import { rupiah } from '../lib/format'
import { Photo, RatingInline } from './ui'

const SOLO_CENTER = [-7.5666, 110.8243]

function priceIcon(label, active) {
  return L.divIcon({
    className: `price-pin${active ? ' active' : ''}`,
    html: `<span>${label}</span>`,
    iconSize: [0, 0],
  })
}

function pinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);color:#ff385c;filter:drop-shadow(0 2px 4px rgb(0 0 0 / .3))"><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.6 2 4 5.4 4 9.7 4 15.3 11 21.6 11.3 21.8c.4.3 1 .3 1.4 0 .3-.2 7.3-6.5 7.3-12.1C20 5.4 16.4 2 12 2Zm0 10.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg></div>`,
    iconSize: [0, 0],
  })
}

function shortPrice(n) {
  if (!n) return 'Gratis'
  return n >= 1000 ? `Rp${Math.round(n / 1000)}rb` : rupiah(n)
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [48, 48], maxZoom: 15 })
    else if (points.length === 1) map.setView(points[0], 15)
  }, [map, points])
  return null
}

/** Peta hasil pencarian dengan pin harga ala Airbnb. */
export function ResultsMap({ items, activeId, className = '' }) {
  const points = useMemo(() => items.map((d) => [d.lat, d.lng]), [items])
  return (
    <MapContainer center={SOLO_CENTER} zoom={13} scrollWheelZoom className={`z-0 ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {items.map((d) => (
        <Marker
          key={d.id}
          position={[d.lat, d.lng]}
          icon={priceIcon(shortPrice(d.minPrice), d.id === activeId)}
          zIndexOffset={d.id === activeId ? 1000 : 0}
        >
          <Popup closeButton={false} minWidth={240} maxWidth={240}>
            <Link to={`/destinasi/${d.slug}`} className="block !text-ink no-underline">
              <Photo src={d.photos[0]?.src} alt={d.name} className="-mx-5 -mt-3.5 mb-2 aspect-[3/2] w-[calc(100%+40px)] max-w-none rounded-t-xl" />
              <div className="flex justify-between gap-2 font-semibold">
                <span className="line-clamp-1">{d.name}</span>
                <RatingInline rating={d.rating} count={d.reviewCount} showCount={false} />
              </div>
              <div className="text-muted">{d.area}</div>
              <div className="mt-1 font-semibold">{d.minPrice ? `${rupiah(d.minPrice)} / orang` : 'Gratis'}</div>
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

/** Peta satu lokasi (detail destinasi, form pengelola). */
export function LocationMap({ lat, lng, className = '', onPick }) {
  const pos = lat && lng ? [lat, lng] : SOLO_CENTER
  return (
    <MapContainer center={pos} zoom={15} scrollWheelZoom={false} className={`z-0 ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter pos={pos} />
      {onPick && <ClickToPick onPick={onPick} />}
      {lat && lng && <Marker position={[lat, lng]} icon={pinIcon()} />}
    </MapContainer>
  )
}

function Recenter({ pos }) {
  const map = useMap()
  const [a, b] = pos
  useEffect(() => {
    map.setView([a, b])
  }, [map, a, b])
  return null
}

function ClickToPick({ onPick }) {
  const map = useMap()
  useEffect(() => {
    const handler = (e) => onPick(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6))
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [map, onPick])
  return null
}
