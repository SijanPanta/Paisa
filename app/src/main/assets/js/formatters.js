// ── FORMATTERS ─────────────────────────────────────────────────
function formatCurrency(amount) {
  const sym = state.settings.currency || 'Rs.';
  const formatted = Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `${sym} ${formatted}`;
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function reminderDateParts(reminder) {
  const parts = String((reminder && reminder.date) || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return [year, month, day];
}

function reminderTimeParts(reminder) {
  const parts = String((reminder && reminder.time) || '09:00').split(':').map(Number);
  return [parts[0] || 0, parts[1] || 0];
}

function reminderTimeLabel(time) {
  const [hour, minute] = reminderTimeParts({ time });
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function reminderScheduleLabel(reminder) {
  const time = reminderTimeLabel(reminder.time);
  const repeat = reminder.repeat || 'none';
  const parts = reminderDateParts(reminder);
  if (!parts) return `Invalid schedule · ${time}`;
  const [year, month, day] = parts;
  if (repeat === 'daily') return `Every day · ${time}`;
  if (repeat === 'weekly') {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(year, month - 1, day).getDay()];
    return `Every ${weekday} · ${time}`;
  }
  if (repeat === 'monthly') return `Monthly on ${day} · ${time}`;
  const label = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `On ${label} · ${time}`;
}

function nextReminderDate(reminder, now = new Date()) {
  const parts = reminderDateParts(reminder);
  if (!parts) return null;
  const [year, month, day] = parts;
  const [hour, minute] = reminderTimeParts(reminder);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  const repeat = reminder.repeat || 'none';

  if (repeat === 'daily') {
    while (result <= now) result.setDate(result.getDate() + 1);
  } else if (repeat === 'weekly') {
    while (result <= now) result.setDate(result.getDate() + 7);
  } else if (repeat === 'monthly') {
    while (result <= now) {
      result.setDate(1);
      result.setMonth(result.getMonth() + 1);
      result.setDate(Math.min(day, daysInMonth(result.getFullYear(), result.getMonth())));
    }
  } else if (result <= now) {
    return null;
  }
  return result;
}

function nextReminderLabel(reminder) {
  const next = nextReminderDate(reminder);
  if (!next) return 'Past reminder';
  const time = reminderTimeLabel(reminder.time);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(next, today)) return `Today, ${time}`;
  if (sameDay(next, tomorrow)) return `Tomorrow, ${time}`;
  return `${next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}
