const WINDOW_DAYS = 7;
function dateWindows(days = 14) {
  const now = new Date();
  const bufferedNow = new Date(now.getTime() + 86_400_000);
  const windows = [];
  for (let offset = 0; offset < days; offset += WINDOW_DAYS) {
    const to = new Date(bufferedNow.getTime() - offset * 86_400_000);
    const from = new Date(bufferedNow.getTime() - Math.min(offset + WINDOW_DAYS, days) * 86_400_000);
    windows.push({ from: from.toISOString(), to: to.toISOString() });
  }
  return windows;
}
console.log(dateWindows());
