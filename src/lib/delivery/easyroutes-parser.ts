import { parse } from 'csv-parse/sync';
import { DEFAULT_TIMEZONE, type DeliveryDay, type DeliveryImport, type DeliveryRoute, type ParsedDeliveryData, type RouteStop } from './types';

interface ParseOptions { sourceFileName: string; timezone?: string; }
type CsvRow = Record<string, string | undefined>;

const routeHeaders = ['Route', 'Route Name', 'Route name', 'route'];
const driverHeaders = ['Driver', 'Driver Name', 'Driver name'];
const stopHeaders = ['Stop', 'Stop Number', 'Stop #', 'Sequence', 'Order'];
const orderHeaders = ['Order Name', 'Order', 'Order Number', 'Order #', 'Name'];
const customerHeaders = ['Customer Name', 'Customer', 'Recipient'];
const addressHeaders = ['Address', 'Shipping Address', 'Street', 'Address 1'];
const cityHeaders = ['City', 'Shipping City'];
const provinceHeaders = ['Province', 'State', 'Shipping Province'];
const postalHeaders = ['Postal Code', 'Zip', 'ZIP', 'Shipping Zip'];
const latitudeHeaders = ['Latitude', 'Lat', 'Stop Latitude'];
const longitudeHeaders = ['Longitude', 'Lng', 'Lon', 'Stop Longitude'];
const etaHeaders = ['ETA', 'Estimated Arrival', 'Estimated arrival time'];
const actualHeaders = ['Actual Arrival', 'Actual arrival', 'Arrived At', 'Delivered At'];
const itemsHeaders = ['Items', 'Products', 'Item Summary', 'Lineitems'];
const dateHeaders = ['Delivery Date', 'Date', 'Service Date', 'Scheduled Date'];
const tipHeaders = ['Delivery Instructions', 'Instructions', 'Notes', 'Delivery Tip'];

export function parseEasyRoutesCsv(csvText: string, options: ParseOptions): ParsedDeliveryData {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as CsvRow[];
  if (rows.length === 0) throw new Error('CSV contains no delivery rows.');

  const deliveryDaysByDate = new Map<string, DeliveryDay>();
  const routesByKey = new Map<string, DeliveryRoute>();
  const stops: RouteStop[] = [];

  rows.forEach((row, rowIndex) => {
    const routeName = getValue(row, routeHeaders);
    const serviceDate = normalizeDate(getValue(row, dateHeaders) || getValue(row, etaHeaders));
    if (!routeName || !serviceDate) throw new Error(`Every delivery row must include route and delivery date. Row ${rowIndex + 2} is missing route and delivery date data.`);

    const driverName = getValue(row, driverHeaders) || 'Unassigned';
    const deliveryDayId = stableId('day', serviceDate);
    const routeId = stableId('route', serviceDate, routeName, driverName);
    const sequence = Number.parseInt(getValue(row, stopHeaders) || `${rowIndex + 1}`, 10);
    const city = getValue(row, cityHeaders);
    const province = getValue(row, provinceHeaders);
    const postalCode = getValue(row, postalHeaders);
    const street = getValue(row, addressHeaders);
    const fullAddress = buildAddress(street, city, province, postalCode);
    const etaLocal = normalizeLocalDateTime(getValue(row, etaHeaders));
    const actualArrivalLocal = normalizeLocalDateTime(getValue(row, actualHeaders));

    if (!deliveryDaysByDate.has(serviceDate)) deliveryDaysByDate.set(serviceDate, { id: deliveryDayId, serviceDate, timezone, routeCount: 0, stopCount: 0, confirmedRouteCount: 0 });
    if (!routesByKey.has(routeId)) routesByKey.set(routeId, { id: routeId, deliveryDayId, serviceDate, routeName, driverName, stopCount: 0, reviewedStopCount: 0, status: 'draft' });

    stops.push({
      id: stableId('stop', routeId, String(sequence), getValue(row, orderHeaders) || String(rowIndex)),
      routeId, deliveryDayId, serviceDate, routeName, sequence: Number.isFinite(sequence) ? sequence : rowIndex + 1,
      orderNumber: getValue(row, orderHeaders) || `ROW-${rowIndex + 2}`,
      customerName: getValue(row, customerHeaders) || 'Unknown customer', fullAddress, city, province, postalCode,
      latitude: parseOptionalNumber(getValue(row, latitudeHeaders)), longitude: parseOptionalNumber(getValue(row, longitudeHeaders)),
      etaLocal, actualArrivalLocal, timezone, itemSummary: getValue(row, itemsHeaders), deliveryTip: getValue(row, tipHeaders),
      status: actualArrivalLocal ? 'arrived' : 'pending',
    });
  });

  stops.sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.routeName.localeCompare(b.routeName) || a.sequence - b.sequence);
  for (const route of routesByKey.values()) {
    const routeStops = stops.filter((stop) => stop.routeId === route.id).sort((a, b) => a.sequence - b.sequence);
    route.stopCount = routeStops.length;
    route.reviewedStopCount = routeStops.filter((stop) => stop.status !== 'pending').length;
    route.firstEtaLocal = routeStops.find((stop) => stop.etaLocal)?.etaLocal;
    route.lastEtaLocal = [...routeStops].reverse().find((stop) => stop.etaLocal)?.etaLocal;
  }
  for (const day of deliveryDaysByDate.values()) {
    const dayRoutes = [...routesByKey.values()].filter((route) => route.deliveryDayId === day.id);
    day.routeCount = dayRoutes.length;
    day.stopCount = stops.filter((stop) => stop.deliveryDayId === day.id).length;
    day.confirmedRouteCount = dayRoutes.filter((route) => route.status === 'confirmed').length;
  }

  const deliveryImport: DeliveryImport = { id: stableId('import', options.sourceFileName, String(rows.length)), sourceFileName: options.sourceFileName, importedAt: new Date().toISOString(), rowCount: rows.length, status: 'parsed' };
  return { import: deliveryImport, deliveryDays: [...deliveryDaysByDate.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)), routes: [...routesByKey.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.routeName.localeCompare(b.routeName)), stops };
}

function getValue(row: CsvRow, candidates: string[]): string | undefined {
  for (const key of candidates) { const value = row[key]?.trim(); if (value) return value; }
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value?.trim()]));
  for (const key of candidates) { const value = normalized.get(normalizeHeader(key)); if (value) return value; }
  return undefined;
}
function normalizeHeader(header: string): string { return header.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function normalizeDate(value?: string): string | undefined { return normalizeLocalDateTime(value)?.slice(0, 10); }
function normalizeLocalDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const isoLike = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
  if (isoLike) return `${isoLike[1]} ${isoLike[2].padStart(5, '0')}`;
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return `${dateOnly[1]} 00:00`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  return trimmed;
}
function buildAddress(street?: string, city?: string, province?: string, postalCode?: string): string { const locality = [city, province].filter(Boolean).join(', '); const region = [locality, postalCode].filter(Boolean).join(' '); return [street, region].filter(Boolean).join(', ') || 'Address unavailable'; }
function parseOptionalNumber(value?: string): number | undefined { if (!value) return undefined; const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : undefined; }
export function stableId(...parts: string[]): string { const input = parts.join('|'); let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `${parts[0]}_${(hash >>> 0).toString(16)}`; }
