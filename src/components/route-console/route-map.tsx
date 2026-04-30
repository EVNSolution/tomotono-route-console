'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useEffect, useRef, useState } from 'react';
import type { DeliveryRoute, RouteStop } from '@/lib/delivery/types';

export function RouteMap({ route, stops }: { route: DeliveryRoute; stops: RouteStop[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const hasLocatedStops = stops.some((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !ref.current) return;
    const locatedStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
    if (locatedStops.length === 0) return;
    setOptions({ key: apiKey, v: 'weekly', mapIds: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ? [process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID] : undefined });
    void Promise.all([importLibrary('maps'), importLibrary('marker')]).then(([{ Map }, { AdvancedMarkerElement }]) => {
      const center = { lat: locatedStops[0].latitude!, lng: locatedStops[0].longitude! };
      const map = new Map(ref.current!, { center, zoom: 11, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID, backgroundColor: '#08090a', disableDefaultUI: true, zoomControl: true });
      locatedStops.forEach((stop) => new AdvancedMarkerElement({ map, position: { lat: stop.latitude!, lng: stop.longitude! }, title: `${stop.sequence}. ${stop.orderNumber}` }));
    }).catch(() => setLoadFailed(true));
  }, [stops]);

  if (loadFailed || !hasApiKey || !hasLocatedStops) return <div className="relative h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b] operations-grid">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_45%,rgba(113,112,255,0.16),transparent_18rem)]" />
    {stops.map((stop, index) => <div key={stop.id} className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(94,106,210,0.88)] text-xs font-[590] text-white shadow-[0_0_22px_rgba(94,106,210,0.45)]" style={{ left: `${18 + (index % 3) * 26}%`, top: `${18 + index * 12}%` }}>{stop.sequence}</div>)}
    <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.88)] p-3 backdrop-blur"><p className="text-sm font-[510]">{route.routeName} / Google Maps preview</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to render live Google Maps. Marker sequence is shown with anonymized coordinates when available.</p></div>
  </div>;
  return <div ref={ref} className="h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b]" />;
}
