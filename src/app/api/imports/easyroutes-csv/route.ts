import { requireAdminSession } from '@/lib/admin-session';
import { replaceWithImport } from '@/lib/delivery/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return auth.response;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    let csvText = '';
    let sourceFileName = 'upload.csv';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return Response.json({ error: 'CSV file is required.' }, { status: 400 });
      csvText = await file.text();
      sourceFileName = file.name;
    } else {
      const body = await request.json();
      csvText = body.csvText;
      sourceFileName = body.sourceFileName ?? sourceFileName;
    }
    const state = await replaceWithImport(csvText, sourceFileName);
    return Response.json({ import: state.import, deliveryDays: state.deliveryDays, routes: state.routes });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'CSV import failed.' }, { status: 400 });
  }
}
