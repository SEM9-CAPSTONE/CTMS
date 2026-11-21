const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const time = new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" });
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

export const formatDateTime = (value: string) => dateTime.format(new Date(value));
export const formatTime = (value: string) => time.format(new Date(value));
export const formatDate = (value: string) => date.format(new Date(value));
