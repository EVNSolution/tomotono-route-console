import { updateStop } from '@/lib/delivery/store';
import type { StopStatus } from '@/lib/delivery/types';

export async function PATCH(request: Request, context: RouteContext<'/api/stops/[stopId]'>) {
  const { stopId } = await context.params;
  const body = await request.json();
  const stop = updateStop(stopId, { status: body.status as StopStatus | undefined, actualArrivalLocal: body.actualArrivalLocal, dispatcherMemo: body.dispatcherMemo, deliveryTip: body.deliveryTip });
  if (!stop) return Response.json({ error: 'Stop not found.' }, { status: 404 });
  return Response.json({ stop });
}
