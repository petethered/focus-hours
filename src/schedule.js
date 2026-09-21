const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function parseTime(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeOnDate(hhmm, date) {
  const minutes = parseTime(hhmm);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  );
}

export function isBlockedNow(schedule, date) {
  if (!schedule.days.includes(date.getDay())) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return parseTime(schedule.start) <= minutes && minutes < parseTime(schedule.end);
}

// The next moment strictly after `date` at which isBlockedNow can change.
export function nextBoundary(schedule, date) {
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    if (!schedule.days.includes(day.getDay())) continue;
    for (const hhmm of [schedule.start, schedule.end]) {
      const candidate = timeOnDate(hhmm, day);
      if (candidate > date) return candidate;
    }
  }
  return null;
}

export function validateSchedule(schedule) {
  if (schedule.days.length === 0) return 'Pick at least one day.';
  if (!TIME_PATTERN.test(schedule.start) || !TIME_PATTERN.test(schedule.end)) {
    return 'Enter a start and end time.';
  }
  if (parseTime(schedule.start) >= parseTime(schedule.end)) {
    return 'Start time must be before end time.';
  }
  return null;
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
