import { getRouteDetail } from '@/lib/delivery/store';

export async function GET(_request: Request, context: RouteContext<'/api/routes/[routeId]'>) {
  const { routeId } = await context.params;
  const detail = await getRouteDetail(routeId);
  if (!detail) return Response.json({ error: 'Route not found.' }, { status: 404 });
  return Response.json(detail);
}
