import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export function getLocalDate(time?: number) {
    const date = time ? new Date(time) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatDurationTime(duration: number): string {
    const durationObj = dayjs.duration(duration);
    const hours = durationObj.hours();
    const minutes = durationObj.minutes();
    const seconds = durationObj.seconds();
    const ms = durationObj.milliseconds();

    if (hours > 0) {
        return `${hours} hours ${minutes} min ${seconds} sec`;
    } else if (minutes > 0 && seconds > 0) {
        return `${minutes} min ${seconds} sec`;
    } else if (minutes > 0) {
        return `${minutes} min`;
    } else if (seconds < 1) {
        return `${ms} ms`;
    } else {
        return `${seconds} sec`;
    }
}
