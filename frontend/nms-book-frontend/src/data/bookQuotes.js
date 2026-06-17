const bookQuotes = [
  "A book is a dream you hold.",
  "Reading gives knowledge wings.",
  "Books open doors to tomorrow.",
  "One book can change everything.",
  "Read today, lead tomorrow.",
  "Books make minds stronger.",
  "Learning begins with reading.",
  "Books are quiet teachers.",
  "Share books, share knowledge.",
  "A reader is never alone.",
  "Books build better futures.",
  "Reading turns pages into power.",
  "Every book has a journey.",
  "Old books bring new learning.",
  "Knowledge grows when shared."
];

export function getDailyBookQuote(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - startOfYear) / 86400000);
  return bookQuotes[dayOfYear % bookQuotes.length];
}

export default bookQuotes;
