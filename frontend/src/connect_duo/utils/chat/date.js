export function formatDayLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();

    const sameDay =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const yesterday =
        d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();

    if (sameDay) return '오늘';
    if (yesterday) return '어제';

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
}
