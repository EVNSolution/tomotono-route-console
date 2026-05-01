'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryRoute, RouteStop } from '@/lib/delivery/types';

export function RouteMap({
  route,
  stops,
  apiKey,
  mapId,
}: {
  route: DeliveryRoute;
  stops: RouteStop[];
  apiKey?: string | null;
  mapId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasApiKey = Boolean(apiKey);
  const hasLocatedStops = stops.some((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
  const mapCenter = useMemo(() => {
    const firstLocatedStop = stops.find((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
    return firstLocatedStop
      ? { lat: firstLocatedStop.latitude!, lng: firstLocatedStop.longitude! }
      : { lat: 43.6532, lng: -79.3832 };
  }, [stops]);
  const initialZoom = hasLocatedStops ? 11 : 10;

  useEffect(() => {
    if (!apiKey || !ref.current) return;
    const locatedStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');

    setOptions({ key: apiKey, v: 'weekly', mapIds: mapId ? [mapId] : undefined });
    void Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        const map = new Map(ref.current!, {
          center: mapCenter,
          zoom: initialZoom,
          mapId,
          backgroundColor: '#08090a',
          disableDefaultUI: true,
          zoomControl: true,
        });
        if (locatedStops.length) {
          locatedStops.forEach((stop) => {
            new AdvancedMarkerElement({
              map,
              position: { lat: stop.latitude!, lng: stop.longitude! },
              title: `${stop.sequence}. ${stop.orderNumber}`,
            });
          });
        }
      })
      .catch(() => setLoadFailed(true));
  }, [apiKey, mapId, mapCenter, initialZoom, stops]);

  const statusMessage = loadFailed
    ? 'Google Maps load failed. Check API key, billing, referrer, or browser console for details.'
    : !hasLocatedStops
      ? '지도는 표시되지만 좌표 데이터가 없어 마커는 비워집니다. CSV 업로드에서 위도/경도를 확보해 주세요.'
      : '';

  if (loadFailed || !hasApiKey) {
    return <div className="relative h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b] operations-grid">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_45%,rgba(113,112,255,0.16),transparent_18rem)]" />
      {stops.map((stop, index) => (
        <div
          key={stop.id}
          className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(94,106,210,0.88)] text-xs font-[590] text-white shadow-[0_0_22px_rgba(94,106,210,0.45)]"
          style={{ left: `${18 + (index % 3) * 26}%`, top: `${18 + index * 12}%` }}
        >
          {stop.sequence}
        </div>
      ))}
      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.88)] p-3 backdrop-blur">
        <p className="text-sm font-[510]">{route.routeName} / Google Maps preview</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{statusMessage}</p>
      </div>
    </div>;
  }

  return <div ref={ref} className="h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b]" />;
}
