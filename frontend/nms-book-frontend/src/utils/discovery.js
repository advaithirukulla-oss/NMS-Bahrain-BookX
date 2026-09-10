export function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Device history is optional. */ }
}
export function recentIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 15) : [];
}
export function recordView(ids, id) { return recentIds([id, ...ids]); }
export function recommend(books, user, saved, recent) {
  const savedSubjects = new Set(saved.map((book) => book.subject).filter(Boolean));
  const viewedSubjects = new Set(recent.map((book) => book.subject).filter(Boolean));
  return books.filter((book) => book.status === "available" && book.owner_id !== user?.id).map((book) => {
    let score = 0;
    let reason = "Available on BookSpins";
    if (String(book.grade) === String(user?.grade)) { score += 3; reason = `For ${String(book.grade).startsWith("KG") ? book.grade : `Grade ${book.grade}`}`; }
    if (viewedSubjects.has(book.subject)) { score += 2; reason = `Because you viewed ${book.subject} books`; }
    if (savedSubjects.has(book.subject)) { score += 4; reason = "Similar to books you saved"; }
    return { book, score, reason };
  }).sort((a, b) => b.score - a.score || b.book.id - a.book.id).slice(0, 6);
}
