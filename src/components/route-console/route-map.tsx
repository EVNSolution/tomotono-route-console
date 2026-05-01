'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryRoute, RouteStop } from '@/lib/delivery/types';

const fallbackBbox = {
  minLat: 43.45,
  maxLat: 43.85,
  minLon: -79.6,
  maxLon: -79.17,
};

function buildOpenStreetMapEmbedUrl(stops: RouteStop[]) {
  const locatedStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
  if (!locatedStops.length) {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${fallbackBbox.minLon},${fallbackBbox.minLat},${fallbackBbox.maxLon},${fallbackBbox.maxLat}&layer=mapnik&marker=${(fallbackBbox.minLat + fallbackBbox.maxLat) / 2},${(fallbackBbox.minLon + fallbackBbox.maxLon) / 2}`;
  }

  const lats = locatedStops.map((stop) => stop.latitude!);
  const lons = locatedStops.map((stop) => stop.longitude!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latPadding = Math.max(0.01, (maxLat - minLat) * 0.15);
  const lonPadding = Math.max(0.01, (maxLon - minLon) * 0.15);
  const south = Math.max(-85.05112878, minLat - latPadding);
  const north = Math.min(85.05112878, maxLat + latPadding);
  const west = minLon - lonPadding;
  const east = maxLon + lonPadding;
  const first = locatedStops[0];

  return `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${first.latitude},${first.longitude}`;
}

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
  const fallbackMapUrl = buildOpenStreetMapEmbedUrl(stops);

  useEffect(() => {
    if (!apiKey || !hasLocatedStops || !ref.current) return;
    const locatedStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
    const mapRef = ref.current;
    let cancelled = false;

    setOptions({ key: apiKey, v: 'weekly', mapIds: mapId ? [mapId] : undefined });
    void Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled || !mapRef) return;
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

    const fallbackTimer = window.setTimeout(() => {
      if (cancelled || !mapRef) return;
      const hasGoogleError = mapRef.querySelector('.gm-err-container');
      if (hasGoogleError) {
        mapRef.innerHTML = '';
        setLoadFailed(true);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [apiKey, mapId, mapCenter, initialZoom, stops, hasLocatedStops]);

  const statusMessage = loadFailed
    ? 'Google Maps load failed. Check API key, billing, referrer, or browser console for details.'
    : !hasLocatedStops
      ? '좌표 데이터가 없어 임시 미리보기 맵을 표시합니다.'
      : '';

  if (loadFailed || !hasApiKey || !hasLocatedStops) {
    return <div key="route-map-fallback" className="relative h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b] operations-grid">
      <iframe
        src={fallbackMapUrl}
        title="Fallback map"
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-black/35" />
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

  return <div key="route-map-google" ref={ref} className="h-[460px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#090a0b]" />;
}
