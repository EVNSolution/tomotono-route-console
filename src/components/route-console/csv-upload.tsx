'use client';

import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function CsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('Anonymized sample data is loaded. Upload EasyRoutes CSV to replace the current board.');
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/imports/easyroutes-csv', { method: 'POST', body: form });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(payload.error ?? 'Import failed.'); return; }
    setMessage(`Imported ${payload.import.rowCount} stops from ${payload.import.sourceFileName}. Refreshing board…`);
    window.location.reload();
  }

  return <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-sm font-[510] text-[var(--text-primary)]">CSV Upload</p><p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{message}</p></div>
      <input ref={inputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}><UploadCloud size={15} />{busy ? 'Importing…' : 'Upload EasyRoutes CSV'}</Button>
    </div>
  </div>;
}
