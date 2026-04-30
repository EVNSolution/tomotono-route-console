import { parseEasyRoutesCsv, stableId } from './easyroutes-parser';
import { anonymizedSampleCsv } from './sample-data';
import type { DeliveryDay, DeliveryImport, DeliveryRoute, DeliveryState, DeliveryTip, RouteReviewLog, RouteReviewStatus, RouteStop, StopStatus } from './types';
import { prisma } from '@/lib/prisma';

const SAMPLE_SOURCE = 'anonymized-sample.csv';

function sampleState(): DeliveryState {
  return { ...parseEasyRoutesCsv(anonymizedSampleCsv, { sourceFileName: SAMPLE_SOURCE }), tips: [], reviewLogs: [] };
}

export async function getDeliveryState(): Promise<DeliveryState> {
  const importCount = await prisma.deliveryImport.count();
  if (importCount === 0) return sampleState();

  const [latestImport, days, routes, stops, tips, reviewLogs] = await Promise.all([
    prisma.deliveryImport.findFirst({ orderBy: { importedAt: 'desc' } }),
    prisma.deliveryDay.findMany({ orderBy: { serviceDate: 'asc' } }),
    prisma.route.findMany({ include: { driver: true, deliveryDay: true }, orderBy: [{ deliveryDay: { serviceDate: 'asc' } }, { routeName: 'asc' }] }),
    prisma.routeStop.findMany({ include: { order: true, route: true, deliveryDay: true }, orderBy: [{ deliveryDay: { serviceDate: 'asc' } }, { route: { routeName: 'asc' } }, { sequence: 'asc' }] }),
    prisma.deliveryTip.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.routeReviewLog.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const allStops = stops.map(mapStop);
  const deliveryDays = days.map((day): DeliveryDay => {
    const serviceDate = toDateString(day.serviceDate);
    const dayRoutes = routes.filter((route) => route.deliveryDayId === day.id);
    const dayStops = allStops.filter((stop) => stop.deliveryDayId === day.id);
    return { id: day.id, serviceDate, timezone: day.timezone, routeCount: dayRoutes.length, stopCount: dayStops.length, confirmedRouteCount: dayRoutes.filter((route) => route.status === 'confirmed').length };
  });

  const deliveryRoutes = routes.map((route): DeliveryRoute => {
    const routeStops = allStops.filter((stop) => stop.routeId === route.id).sort((a, b) => a.sequence - b.sequence);
    return {
      id: route.id,
      deliveryDayId: route.deliveryDayId,
      serviceDate: toDateString(route.deliveryDay.serviceDate),
      routeName: route.routeName,
      driverName: route.driver?.name ?? 'Unassigned',
      stopCount: routeStops.length,
      reviewedStopCount: routeStops.filter((stop) => stop.status !== 'pending').length,
      status: route.status,
      firstEtaLocal: route.firstEtaLocal ?? routeStops.find((stop) => stop.etaLocal)?.etaLocal,
      lastEtaLocal: route.lastEtaLocal ?? [...routeStops].reverse().find((stop) => stop.etaLocal)?.etaLocal,
    };
  });

  return {
    import: latestImport ? mapImport(latestImport) : sampleState().import,
    deliveryDays,
    routes: deliveryRoutes,
    stops: allStops,
    tips: tips.map(mapTip),
    reviewLogs: reviewLogs.map(mapReviewLog),
  };
}

export async function replaceWithImport(csvText: string, sourceFileName: string): Promise<DeliveryState> {
  const parsed = parseEasyRoutesCsv(csvText, { sourceFileName });

  await prisma.$transaction(async (tx) => {
    await tx.routeReviewLog.deleteMany();
    await tx.deliveryTip.deleteMany();
    await tx.routeStop.deleteMany();
    await tx.route.deleteMany();
    await tx.order.deleteMany();
    await tx.driver.deleteMany();
    await tx.deliveryDay.deleteMany();
    await tx.deliveryImport.deleteMany();

    await tx.deliveryImport.create({ data: { id: parsed.import.id, sourceFileName: parsed.import.sourceFileName, importedAt: new Date(parsed.import.importedAt), rowCount: parsed.import.rowCount, status: parsed.import.status } });
    await tx.deliveryDay.createMany({ data: parsed.deliveryDays.map((day) => ({ id: day.id, serviceDate: toDate(day.serviceDate), timezone: day.timezone })) });

    const drivers = uniqueBy(parsed.routes.map((route) => ({ id: stableId('driver', route.driverName), name: route.driverName })), (driver) => driver.id);
    if (drivers.length) await tx.driver.createMany({ data: drivers, skipDuplicates: true });

    const orders = uniqueBy(parsed.stops.map((stop) => ({ id: orderId(stop.orderNumber), orderNumber: stop.orderNumber, customerName: stop.customerName, itemSummary: stop.itemSummary })), (order) => order.orderNumber);
    if (orders.length) await tx.order.createMany({ data: orders, skipDuplicates: true });

    await tx.route.createMany({
      data: parsed.routes.map((route) => ({
        id: route.id,
        importId: parsed.import.id,
        deliveryDayId: route.deliveryDayId,
        driverId: stableId('driver', route.driverName),
        routeName: route.routeName,
        status: route.status,
        firstEtaLocal: route.firstEtaLocal,
        lastEtaLocal: route.lastEtaLocal,
      })),
    });

    await tx.routeStop.createMany({
      data: parsed.stops.map((stop) => ({
        id: stop.id,
        routeId: stop.routeId,
        deliveryDayId: stop.deliveryDayId,
        orderId: orderId(stop.orderNumber),
        sequence: stop.sequence,
        fullAddress: stop.fullAddress,
        city: stop.city,
        province: stop.province,
        postalCode: stop.postalCode,
        latitude: stop.latitude,
        longitude: stop.longitude,
        etaLocal: stop.etaLocal,
        actualArrivalLocal: stop.actualArrivalLocal,
        timezone: stop.timezone,
        deliveryTip: stop.deliveryTip,
        dispatcherMemo: stop.dispatcherMemo,
        status: stop.status,
      })),
    });
  });

  return getDeliveryState();
}

export async function getRouteDetail(routeId: string) {
  const current = await getDeliveryState();
  const route = current.routes.find((item) => item.id === routeId);
  if (!route) return undefined;
  return { route, stops: current.stops.filter((stop) => stop.routeId === routeId).sort((a, b) => a.sequence - b.sequence), tips: current.tips.filter((tip) => tip.routeId === routeId) };
}

export async function updateStop(stopId: string, patch: { status?: StopStatus; actualArrivalLocal?: string; dispatcherMemo?: string; deliveryTip?: string }) {
  const stop = await prisma.routeStop.update({ where: { id: stopId }, data: { status: patch.status, actualArrivalLocal: patch.actualArrivalLocal, dispatcherMemo: patch.dispatcherMemo, deliveryTip: patch.deliveryTip }, include: { order: true, route: true, deliveryDay: true } }).catch(() => undefined);
  return stop ? mapStop(stop) : undefined;
}

export async function confirmRoute(routeId: string, note?: string, status: RouteReviewStatus = 'confirmed') {
  const result = await prisma.$transaction(async (tx) => {
    const route = await tx.route.update({ where: { id: routeId }, data: { status }, include: { driver: true, deliveryDay: true } }).catch(() => undefined);
    if (!route) return undefined;
    const log = await tx.routeReviewLog.create({ data: { id: stableId('review', routeId, status, new Date().toISOString()), routeId, status, note } });
    return { route, log };
  });
  if (!result) return undefined;
  const current = await getDeliveryState();
  return { route: current.routes.find((route) => route.id === routeId)!, log: mapReviewLog(result.log) };
}

export async function createDeliveryTip(input: { stopId?: string; routeId?: string; body: string; addressFingerprint?: string }) {
  const relatedStop = input.stopId ? await prisma.routeStop.findUnique({ where: { id: input.stopId } }) : undefined;
  const tip = await prisma.deliveryTip.create({
    data: {
      id: stableId('tip', input.stopId ?? '', input.routeId ?? '', input.body, new Date().toISOString()),
      stopId: input.stopId,
      routeId: input.routeId,
      addressFingerprint: input.addressFingerprint ?? relatedStop?.fullAddress.toLowerCase() ?? 'route-note',
      body: input.body,
    },
  });
  if (relatedStop) await prisma.routeStop.update({ where: { id: relatedStop.id }, data: { deliveryTip: input.body } });
  return mapTip(tip);
}

function mapImport(record: { id: string; sourceFileName: string; importedAt: Date; rowCount: number; status: DeliveryImport['status'] }): DeliveryImport {
  return { id: record.id, sourceFileName: record.sourceFileName, importedAt: record.importedAt.toISOString(), rowCount: record.rowCount, status: record.status };
}

function mapStop(stop: { id: string; routeId: string; deliveryDayId: string; sequence: number; fullAddress: string; city: string | null; province: string | null; postalCode: string | null; latitude: unknown; longitude: unknown; etaLocal: string | null; actualArrivalLocal: string | null; timezone: string; deliveryTip: string | null; dispatcherMemo: string | null; status: StopStatus; order?: { orderNumber: string; customerName: string; itemSummary: string | null } | null; route?: { routeName: string } | null; deliveryDay?: { serviceDate: Date } | null }): RouteStop {
  return {
    id: stop.id,
    routeId: stop.routeId,
    deliveryDayId: stop.deliveryDayId,
    serviceDate: stop.deliveryDay ? toDateString(stop.deliveryDay.serviceDate) : '',
    routeName: stop.route?.routeName ?? '',
    sequence: stop.sequence,
    orderNumber: stop.order?.orderNumber ?? '',
    customerName: stop.order?.customerName ?? 'Unknown customer',
    fullAddress: stop.fullAddress,
    city: stop.city ?? undefined,
    province: stop.province ?? undefined,
    postalCode: stop.postalCode ?? undefined,
    latitude: decimalToNumber(stop.latitude),
    longitude: decimalToNumber(stop.longitude),
    etaLocal: stop.etaLocal ?? undefined,
    actualArrivalLocal: stop.actualArrivalLocal ?? undefined,
    timezone: stop.timezone,
    itemSummary: stop.order?.itemSummary ?? undefined,
    deliveryTip: stop.deliveryTip ?? undefined,
    dispatcherMemo: stop.dispatcherMemo ?? undefined,
    status: stop.status,
  };
}

function mapTip(tip: { id: string; stopId: string | null; routeId: string | null; addressFingerprint: string; body: string; createdAt: Date }): DeliveryTip {
  return { id: tip.id, stopId: tip.stopId ?? undefined, routeId: tip.routeId ?? undefined, addressFingerprint: tip.addressFingerprint, body: tip.body, createdAt: tip.createdAt.toISOString() };
}

function mapReviewLog(log: { id: string; routeId: string; status: RouteReviewStatus; note: string | null; createdAt: Date }): RouteReviewLog {
  return { id: log.id, routeId: log.routeId, status: log.status, note: log.note ?? undefined, createdAt: log.createdAt.toISOString() };
}

function orderId(orderNumber: string): string { return stableId('order', orderNumber); }
function toDate(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
function toDateString(value: Date): string { return value.toISOString().slice(0, 10); }
function decimalToNumber(value: unknown): number | undefined { if (value == null) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function uniqueBy<T>(items: T[], key: (item: T) => string): T[] { return [...new Map(items.map((item) => [key(item), item])).values()]; }
