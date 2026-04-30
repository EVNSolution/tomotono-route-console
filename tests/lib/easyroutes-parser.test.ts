import { describe, expect, it } from 'vitest';
import { parseEasyRoutesCsv } from '@/lib/delivery/easyroutes-parser';

const sample = `Route,Driver,Stop,Order Name,Customer Name,Address,City,Province,Postal Code,Latitude,Longitude,ETA,Actual Arrival,Items,Delivery Date,Delivery Instructions
Morning A,Jamie Lee,1,#1001,Avery Stone,100 King St W,Toronto,ON,M5X 1A9,43.6487,-79.3815,2026-04-30 09:15,2026-04-30 09:18,Tomatoes x 3,2026-04-30,Leave at concierge
Morning A,Jamie Lee,2,#1002,Robin Park,200 Queen St W,Toronto,ON,M5V 1Z4,43.6509,-79.3900,2026-04-30 09:45,,Basil x 2,2026-04-30,Call on arrival
North B,Sam Rivera,1,#1003,Casey Wong,10 Bloor St W,Toronto,ON,M4W 3E2,43.6708,-79.3868,2026-04-30 11:10,,Salad box x 1,2026-04-30,
`;

describe('parseEasyRoutesCsv', () => {
  it('groups uploaded EasyRoutes rows into delivery days, routes, drivers, and ordered stops', () => {
    const result = parseEasyRoutesCsv(sample, { sourceFileName: 'easyroutes-export.csv' });

    expect(result.import.sourceFileName).toBe('easyroutes-export.csv');
    expect(result.deliveryDays).toHaveLength(1);
    expect(result.routes).toHaveLength(2);
    expect(result.routes[0]).toMatchObject({ routeName: 'Morning A', driverName: 'Jamie Lee', stopCount: 2 });
    expect(result.stops.map((stop) => `${stop.routeName}:${stop.sequence}`)).toEqual([
      'Morning A:1',
      'Morning A:2',
      'North B:1',
    ]);
  });

  it('normalizes Toronto timezone timestamps while preserving address and order metadata', () => {
    const result = parseEasyRoutesCsv(sample, { sourceFileName: 'easyroutes-export.csv' });
    const firstStop = result.stops[0];

    expect(firstStop.orderNumber).toBe('#1001');
    expect(firstStop.fullAddress).toBe('100 King St W, Toronto, ON M5X 1A9');
    expect(firstStop.etaLocal).toBe('2026-04-30 09:15');
    expect(firstStop.actualArrivalLocal).toBe('2026-04-30 09:18');
    expect(firstStop.timezone).toBe('America/Toronto');
    expect(firstStop.latitude).toBe(43.6487);
    expect(firstStop.longitude).toBe(-79.3815);
    expect(firstStop.deliveryTip).toBe('Leave at concierge');
  });

  it('rejects rows without route names', () => {
    const invalid = `Route,Driver,Stop,Order Name,Address,Delivery Date\n,Jamie,1,#1,100 King St W,`;

    expect(() => parseEasyRoutesCsv(invalid, { sourceFileName: 'bad.csv' })).toThrow(/route data/i);
  });

  it('uses a Toronto service-date fallback for EasyRoutes exports without date columns', () => {
    const unscheduledExport = `Route,Driver,Stop,Order,Note (Order),Address,Billing name,Shipping name,Items
Morning A,Jamie Lee,1,#1001,Leave with concierge,100 King St W,Billing Person,Shipping Person,Tomatoes x 3
`;

    const result = parseEasyRoutesCsv(unscheduledExport, {
      sourceFileName: 'easyroutes-export.csv',
      fallbackServiceDate: '2026-04-30',
    });

    expect(result.deliveryDays).toHaveLength(1);
    expect(result.deliveryDays[0].serviceDate).toBe('2026-04-30');
    expect(result.stops[0]).toMatchObject({
      serviceDate: '2026-04-30',
      customerName: 'Shipping Person',
      deliveryTip: 'Leave with concierge',
    });
  });

  it('normalizes split EasyRoutes scheduled and actual EDT date/time columns', () => {
    const scheduledExport = `Route,Driver,Stop,Order,Address,Scheduled date,Scheduled ETA (EDT),Actual arrival date,Actual arrival time (EDT),Shipping name,Items
Morning A,Jamie Lee,1,#1001,100 King St W,4/30/2026,9:15 AM,4/30/2026,10:05 AM,Avery Stone,Tomatoes x 3
`;

    const result = parseEasyRoutesCsv(scheduledExport, { sourceFileName: 'easyroutes-export (1).csv' });

    expect(result.deliveryDays[0].serviceDate).toBe('2026-04-30');
    expect(result.stops[0].etaLocal).toBe('2026-04-30 09:15');
    expect(result.stops[0].actualArrivalLocal).toBe('2026-04-30 10:05');
  });
});
