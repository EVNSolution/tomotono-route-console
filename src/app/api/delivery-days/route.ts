import { getDeliveryState } from '@/lib/delivery/store';
export async function GET() { const state = await getDeliveryState(); return Response.json({ deliveryDays: state.deliveryDays }); }
