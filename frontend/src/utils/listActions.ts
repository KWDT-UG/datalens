export type CsvValue = boolean | number | string | null | undefined;

export function downloadCsv(filename: string, rows: Array<Record<string, CsvValue>>) {
  if (rows.length === 0) {
    return;
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toggleVisibleSelection(current: number[], visible: number[]) {
  const selected = new Set(current);
  const allVisibleSelected = visible.length > 0 && visible.every((id) => selected.has(id));

  visible.forEach((id) => {
    if (allVisibleSelected) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
  });

  return Array.from(selected);
}

export function archivePrompt(itemName: string, count: number) {
  return `Archive ${count} selected ${count === 1 ? itemName : `${itemName}s`}?`;
}

function escapeCsv(value: CsvValue) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
