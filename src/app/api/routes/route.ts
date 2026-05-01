import { requireAdminSession } from '@/lib/admin-session';
import { getDeliveryState } from '@/lib/delivery/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const serviceDate = url.searchParams.get('serviceDate');
  const state = await getDeliveryState();
  const routes = state.routes.filter((route) => !serviceDate || route.serviceDate === serviceDate);
  return Response.json({ routes });
}
