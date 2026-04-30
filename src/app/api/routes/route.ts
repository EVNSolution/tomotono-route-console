import { getDeliveryState } from '@/lib/delivery/store';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const serviceDate = url.searchParams.get('serviceDate');
  const state = await getDeliveryState();
  const routes = state.routes.filter((route) => !serviceDate || route.serviceDate === serviceDate);
  return Response.json({ routes });
}
