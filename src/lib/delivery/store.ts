import { parseEasyRoutesCsv, stableId } from './easyroutes-parser';
import { anonymizedSampleCsv } from './sample-data';
import type { DeliveryState, RouteReviewStatus, StopStatus } from './types';

const initial = parseEasyRoutesCsv(anonymizedSampleCsv, { sourceFileName: 'anonymized-sample.csv' });

const globalForDelivery = globalThis as unknown as { __tomotonoDeliveryState?: DeliveryState };

function state(): DeliveryState {
  globalForDelivery.__tomotonoDeliveryState ??= { ...initial, tips: [], reviewLogs: [] };
  return globalForDelivery.__tomotonoDeliveryState;
}

export function getDeliveryState(): DeliveryState { return state(); }

export function replaceWithImport(csvText: string, sourceFileName: string): DeliveryState {
  const parsed = parseEasyRoutesCsv(csvText, { sourceFileName });
  globalForDelivery.__tomotonoDeliveryState = { ...parsed, tips: [], reviewLogs: [] };
  return globalForDelivery.__tomotonoDeliveryState;
}

export function getRouteDetail(routeId: string) {
  const current = state();
  const route = current.routes.find((item) => item.id === routeId);
  if (!route) return undefined;
  return { route, stops: current.stops.filter((stop) => stop.routeId === routeId).sort((a, b) => a.sequence - b.sequence), tips: current.tips.filter((tip) => tip.routeId === routeId) };
}

export function updateStop(stopId: string, patch: { status?: StopStatus; actualArrivalLocal?: string; dispatcherMemo?: string; deliveryTip?: string }) {
  const current = state();
  const stop = current.stops.find((item) => item.id === stopId);
  if (!stop) return undefined;
  Object.assign(stop, patch);
  const route = current.routes.find((item) => item.id === stop.routeId);
  if (route) route.reviewedStopCount = current.stops.filter((item) => item.routeId === route.id && item.status !== 'pending').length;
  return stop;
}

export function confirmRoute(routeId: string, note?: string, status: RouteReviewStatus = 'confirmed') {
  const current = state();
  const route = current.routes.find((item) => item.id === routeId);
  if (!route) return undefined;
  route.status = status;
  current.deliveryDays.forEach((day) => {
    if (day.id === route.deliveryDayId) day.confirmedRouteCount = current.routes.filter((candidate) => candidate.deliveryDayId === day.id && candidate.status === 'confirmed').length;
  });
  const log = { id: stableId('review', routeId, status, new Date().toISOString()), routeId, status, note, createdAt: new Date().toISOString() };
  current.reviewLogs.unshift(log);
  return { route, log };
}

export function createDeliveryTip(input: { stopId?: string; routeId?: string; body: string; addressFingerprint?: string }) {
  const current = state();
  const relatedStop = input.stopId ? current.stops.find((stop) => stop.id === input.stopId) : undefined;
  const tip = { id: stableId('tip', input.stopId ?? '', input.routeId ?? '', input.body, new Date().toISOString()), stopId: input.stopId, routeId: input.routeId, addressFingerprint: input.addressFingerprint ?? relatedStop?.fullAddress.toLowerCase() ?? 'route-note', body: input.body, createdAt: new Date().toISOString() };
  current.tips.unshift(tip);
  if (relatedStop) relatedStop.deliveryTip = input.body;
  return tip;
}
