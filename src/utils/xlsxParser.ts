import * as xlsx from 'xlsx';
import type { TransUnit } from './xliffParser';

export function parseXlsx(arrayBuffer: ArrayBuffer) {
  const workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = xlsx.utils.sheet_to_json<any>(worksheet);
  
  const items: TransUnit[] = jsonData.map((row: any) => ({
    id: String(row.ID || ''),
    source: String(row.Source || ''),
    target: String(row.Target || ''),
    state: String(row.State || 'needs-translation')
  }));
  return { items };
}

export function buildXlsx(items: TransUnit[], updates: Record<string, {target: string, state: string}>): ArrayBuffer {
  const json = items.map(item => ({
    ID: item.id,
    Source: item.source,
    Target: updates[item.id]?.target ?? item.target,
    State: updates[item.id]?.state ?? item.state
  }));
  const worksheet = xlsx.utils.json_to_sheet(json);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Translations");
  return xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
}
