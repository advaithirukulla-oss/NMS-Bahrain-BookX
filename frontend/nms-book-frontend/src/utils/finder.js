const SUBJECTS = [
  "biology", "chemistry", "physics", "science", "math", "mathematics",
  "english", "arabic", "history", "geography", "computer", "ict",
];

export function findIntent(query) {
  const normalized = query.toLowerCase();
  const kgMatch = normalized.match(/kg\s*([12])/i);
  const gradeMatch = normalized.match(/(?:grade|class|year)\s*(\d{1,2})/i);
  const subject = SUBJECTS.find((item) => normalized.includes(item));
  const ignored = new Set(["i", "need", "a", "an", "the", "book", "looking", "for", "please", "want", "grade", "class", "year", "me", "show", "books", "an", "easy", "suitable", "help", "finding", "kg", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] );
  const keywords = normalized.split(/[^a-z0-9-]+/).filter((word) => word && !ignored.has(word));

  return { grade: kgMatch ? `kg ${kgMatch[1]}` : gradeMatch?.[1] || "", subject, keywords };
}
