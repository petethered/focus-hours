export function localDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function attemptCount(attempts, site, date) {
  if (!attempts || attempts.date !== localDateKey(date)) return 0;
  return attempts.counts[site] ?? 0;
}

export function recordAttempt(attempts, site, date) {
  const today = localDateKey(date);
  const counts = attempts?.date === today ? { ...attempts.counts } : {};
  counts[site] = (counts[site] ?? 0) + 1;
  return { attempts: { date: today, counts }, count: counts[site] };
}
