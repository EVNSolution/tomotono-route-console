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
  const mapCenter = useMemo(() => {
    const firstLocatedStop = stops.find((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
    return firstLocatedStop
      ? { lat: firstLocatedStop.latitude!, lng: firstLocatedStop.longitude! }
      : { lat: 43.6532, lng: -79.3832 };
  }, [stops]);
  const initialZoom = 10;
  const resolvedMapId = mapId?.trim() || undefined;

  useEffect(() => {
    if (!apiKey || !ref.current) {
      setLoadFailed(!apiKey);
      return;
    }
    setLoadFailed(false);
    const locatedStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
    const mapRef = ref.current;
    let cancelled = false;

    setOptions({ key: apiKey, v: 'weekly', mapIds: resolvedMapId ? [resolvedMapId] : undefined });
    void Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled || !mapRef) return;
        const map = new Map(ref.current!, {
          center: mapCenter,
          zoom: initialZoom,
          ...(resolvedMapId ? { mapId: resolvedMapId } : undefined),
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
        mapRef.dataset['googleMapInitialized'] = 'true';
      })
      .catch(() => {
        if (!cancelled) {
          if (mapRef) {
            mapRef.innerHTML = '';
          }
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, resolvedMapId, mapCenter, initialZoom, stops]);

  const statusMessage = loadFailed
    ? 'Google Maps load failed. Check API key, billing, referrer, or browser console for details.'
    : 'Google Maps is ready.';

  if (loadFailed || !hasApiKey) {
    return <div key="route-map-fallback" className="relative h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b]">
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(15,16,17,0.9)] p-4 text-sm text-[var(--text-secondary)]">
          <p className="text-sm font-[510] text-white">{route.routeName} / Google Maps</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{statusMessage}</p>
        </div>
      </div>
    </div>;
  }

  return <div key="route-map-google" ref={ref} className="h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b]" />;
}
