import { requireAdminSession } from '@/lib/admin-session';
import { confirmRoute } from '@/lib/delivery/store';

export const runtime = 'nodejs';

export async function PATCH(request: Request, context: RouteContext<'/api/routes/[routeId]/confirm'>) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return auth.response;
  const { routeId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const result = await confirmRoute(routeId, body.note, 'confirmed');
  if (!result) return Response.json({ error: 'Route not found.' }, { status: 404 });
  return Response.json(result);
}
