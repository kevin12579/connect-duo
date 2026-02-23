export default function ConsultStatus() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const current = hour * 60 + minute;

    const start = 9 * 60 + 30; // 09:30
    const lunchStart = 13 * 60 + 30;
    const lunchEnd = 14 * 60 + 30;
    const end = 18 * 60 + 30;

    if (current >= lunchStart && current < lunchEnd) {
        return <div>🍽 현재 점심시간입니다. 14:30 이후 상담 가능합니다.</div>;
    }

    if (current >= start && current <= end) {
        return <div>🧑‍💼 현재 상담 가능 시간입니다. 상담원을 연결해 드리겠습니다.</div>;
    }

    return <div>⏰ 현재는 상담 가능 시간이 아닙니다. 운영시간: 09:30 ~ 18:30</div>;
}
