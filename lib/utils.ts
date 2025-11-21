export function generateCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit random
}

export function addHoursToNow(hours: number): Date {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return now;
}