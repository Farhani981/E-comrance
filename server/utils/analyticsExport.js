const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const safeCell = value => typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
export function exportReport(format, report, title, period) {
  const { columns, rows } = report;
  const description = `${title} | ${period.start} to ${period.end} | PKR monetary fields; explicit order currency retained | Database calendar time`;
  if (format === 'csv') {
    const cell = value => `"${String(safeCell(value) ?? '').replace(/"/g,'""')}"`;
    return { mime: 'text/csv; charset=utf-8', extension: 'csv', body: '\uFEFF' + [columns, ...rows.map(row => columns.map(c => row[c]))].map(row => row.map(cell).join(',')).join('\r\n') };
  }
  if (format === 'excel') {
    const cell = value => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${escape(value)}</Data></Cell>`;
    return { mime: 'application/vnd.ms-excel; charset=utf-8', extension: 'xml', body: `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table><Row>${cell(description)}</Row><Row>${columns.map(cell).join('')}</Row>${rows.map(row => `<Row>${columns.map(c => cell(row[c])).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>` };
  }
  if (format === 'print') return { mime: 'text/html; charset=utf-8', extension: 'html', body: `<!doctype html><html><head><meta charset="utf-8"><title>${escape(description)}</title><style>body{font:12px Arial;color:#172033}table{border-collapse:collapse;width:100%}td,th{padding:7px;border:1px solid #ddd;text-align:left}thead{display:table-header-group}@page{size:landscape;margin:12mm}</style></head><body><h1>${escape(title)}</h1><p>${escape(description)}</p><p>Use your browser Print command to save this complete filtered report as PDF. Inventory is a current snapshot; refunds are assigned to original order dates. Blank values mean unavailable.</p><table><thead><tr>${columns.map(c => `<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${escape(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>` };
  throw Object.assign(new Error('Unsupported export format.'), { status: 400 });
}
