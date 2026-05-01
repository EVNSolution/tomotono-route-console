import { requireAdminSession } from '@/lib/admin-session';
import { getDeliveryState } from '@/lib/delivery/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return auth.response;
  const state = await getDeliveryState();
  return Response.json({ deliveryDays: state.deliveryDays });
}
