const DAY = 86400000;
export const analyticsError = message => { throw Object.assign(new Error(message), { status: 400 }); };
const iso = date => date.toISOString().slice(0, 10);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) analyticsError('Use dates in YYYY-MM-DD format.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+parsed) || iso(parsed) !== value) analyticsError('Invalid calendar date.');
  return parsed;
}
export function analyticsRange(query, today) {
  const now = date(today), y = now.getUTCFullYear(), m = now.getUTCMonth();
  const calendar = (year, month, day = 1) => new Date(Date.UTC(year, month, day));
  let start, end = now;
  switch (query.range || 'last30') {
    case 'today': start = now; break;
    case 'yesterday': start = end = new Date(+now - DAY); break;
    case 'last7': start = new Date(+now - 6 * DAY); break;
    case 'last30': start = new Date(+now - 29 * DAY); break;
    case 'month': start = calendar(y, m); break;
    case 'lastMonth': start = calendar(y, m - 1); end = calendar(y, m, 0); break;
    case 'year': start = calendar(y, 0); break;
    case 'custom': start = date(query.start); end = date(query.end); break;
    default: analyticsError('Invalid date range.');
  }
  if (start > end || (+end - +start) / DAY > 3660 || start.getUTCFullYear() < 1970 || end > now) analyticsError('Select an ordered date range of at most ten years ending no later than today.');
  let previousEnd = new Date(+start - DAY), previousStart = new Date(+start - (+end - +start + DAY));
  if (query.compare === 'month') {
    start = calendar(y, m); end = now; previousStart = calendar(y, m - 1); previousEnd = calendar(y, m, 0);
  } else if (query.compare === 'year') {
    start = calendar(y, 0); end = now; previousStart = calendar(y - 1, 0); previousEnd = calendar(y, 0, 0);
  } else if (query.compare && query.compare !== 'previous') analyticsError('Invalid comparison.');
  const bucket = query.bucket || 'daily';
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(bucket)) analyticsError('Invalid trend interval.');
  return { start: iso(start), end: iso(end), until: iso(new Date(+end + DAY)), previousStart: iso(previousStart), previousEnd: iso(previousEnd), previousUntil: iso(new Date(+previousEnd + DAY)), bucket, timezone: 'Database session calendar time', comparison: query.compare || 'previous' };
}
export const growth = (current, previous) => previous === 0 ? current === 0 ? 0 : null : Math.round((current - previous) / Math.abs(previous) * 10000) / 100;
