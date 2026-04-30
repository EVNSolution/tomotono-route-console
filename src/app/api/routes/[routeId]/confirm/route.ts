import { confirmRoute } from '@/lib/delivery/store';

export async function PATCH(request: Request, context: RouteContext<'/api/routes/[routeId]/confirm'>) {
  const { routeId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const result = confirmRoute(routeId, body.note, 'confirmed');
  if (!result) return Response.json({ error: 'Route not found.' }, { status: 404 });
  return Response.json(result);
}
