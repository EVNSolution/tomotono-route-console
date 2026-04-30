import { createDeliveryTip, getDeliveryState } from '@/lib/delivery/store';

export async function GET() { const state = await getDeliveryState(); return Response.json({ tips: state.tips }); }
export async function POST(request: Request) {
  const body = await request.json();
  if (!body.body || typeof body.body !== 'string') return Response.json({ error: 'Tip body is required.' }, { status: 400 });
  const tip = await createDeliveryTip({ stopId: body.stopId, routeId: body.routeId, body: body.body, addressFingerprint: body.addressFingerprint });
  return Response.json({ tip });
}
