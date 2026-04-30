import { getDeliveryState } from '@/lib/delivery/store';
export async function GET() { return Response.json({ deliveryDays: getDeliveryState().deliveryDays }); }
