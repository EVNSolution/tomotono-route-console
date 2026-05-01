import { requireAdminSession } from '@/lib/admin-session';
import { getRouteDetail } from '@/lib/delivery/store';

export const runtime = 'nodejs';

export async function GET(request: Request, context: RouteContext<'/api/routes/[routeId]'>) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return auth.response;
  const { routeId } = await context.params;
  const detail = await getRouteDetail(routeId);
  if (!detail) return Response.json({ error: 'Route not found.' }, { status: 404 });
  return Response.json(detail);
}
