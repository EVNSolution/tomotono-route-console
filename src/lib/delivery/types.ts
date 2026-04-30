export const DEFAULT_TIMEZONE = 'America/Toronto';
export const DEFAULT_AWS_REGION = 'ca-central-1';

export type ImportStatus = 'parsed' | 'failed';
export type RouteReviewStatus = 'draft' | 'in_review' | 'confirmed';
export type StopStatus = 'pending' | 'arrived' | 'skipped' | 'issue';

export interface DeliveryImport { id: string; sourceFileName: string; importedAt: string; rowCount: number; status: ImportStatus; }
export interface DeliveryDay { id: string; serviceDate: string; timezone: string; routeCount: number; stopCount: number; confirmedRouteCount: number; }
export interface DeliveryRoute { id: string; deliveryDayId: string; serviceDate: string; routeName: string; driverName: string; stopCount: number; reviewedStopCount: number; status: RouteReviewStatus; firstEtaLocal?: string; lastEtaLocal?: string; }
export interface RouteStop { id: string; routeId: string; deliveryDayId: string; serviceDate: string; routeName: string; sequence: number; orderNumber: string; customerName: string; fullAddress: string; city?: string; province?: string; postalCode?: string; latitude?: number; longitude?: number; etaLocal?: string; actualArrivalLocal?: string; timezone: string; itemSummary?: string; deliveryTip?: string; dispatcherMemo?: string; status: StopStatus; }
export interface DeliveryTip { id: string; stopId?: string; routeId?: string; addressFingerprint: string; body: string; createdAt: string; }
export interface RouteReviewLog { id: string; routeId: string; status: RouteReviewStatus; note?: string; createdAt: string; }
export interface ParsedDeliveryData { import: DeliveryImport; deliveryDays: DeliveryDay[]; routes: DeliveryRoute[]; stops: RouteStop[]; }
export interface DeliveryState extends ParsedDeliveryData { tips: DeliveryTip[]; reviewLogs: RouteReviewLog[]; }
