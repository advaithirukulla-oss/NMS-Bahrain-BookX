import { useEffect, useMemo, useState } from "react";
import { FaBookOpen, FaPaperPlane, FaRobot, FaTimes } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";

const SUBJECTS = [
  "biology", "chemistry", "physics", "science", "math", "mathematics",
  "english", "arabic", "history", "geography", "computer", "ict",
];

function findIntent(query) {
  const normalized = query.toLowerCase();
  const gradeMatch = normalized.match(/(?:grade|class|year)\s*(\d{1,2})/i);
  const subject = SUBJECTS.find((item) => normalized.includes(item));
  const ignored = new Set(["i", "need", "a", "an", "the", "book", "looking", "for", "please", "want", "grade", "class", "year"]);
  const keywords = normalized.split(/[^a-z0-9-]+/).filter((word) => word && !ignored.has(word));

  return { grade: gradeMatch?.[1] || "", subject, keywords };
}

function AIBookFinder({ onBack }) {
  const { demoMode } = useUser();
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) {
      const timeout = setTimeout(() => {
        setBooks(DEMO_BOOKS);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
    API.get("/books")
      .then((response) => setBooks(response.data))
      .catch((requestError) => setError(requestError.response?.data?.detail || "Could not load books."))
      .finally(() => setIsLoading(false));
  }, [demoMode]);

  const matches = useMemo(() => {
    if (!submittedQuery) return [];
    const intent = findIntent(submittedQuery);

    return books
      .map((book) => {
        const title = book.title.toLowerCase();
        const subject = book.subject.toLowerCase();
        const grade = String(book.grade).toLowerCase();
        const reasons = [];
        let score = 0;

        if (intent.subject && (subject.includes(intent.subject) || title.includes(intent.subject))) {
          score += 4;
          reasons.push(`matches ${book.subject}`);
        }
        if (intent.grade && grade.includes(intent.grade)) {
          score += 3;
          reasons.push(`is for Grade ${book.grade}`);
        }
        intent.keywords.forEach((keyword) => {
          if (title.includes(keyword)) {
            score += 2;
            reasons.push(`title includes "${keyword}"`);
          } else if (subject.includes(keyword)) {
            score += 1;
          }
        });

        return { book, score, reasons: [...new Set(reasons)] };
      })
      .filter((match) => match.score > 0 && match.book.status === "available")
      .sort((a, b) => b.score - a.score);
  }, [books, submittedQuery]);

  const submitQuery = (event) => {
    event.preventDefault();
    if (query.trim()) setSubmittedQuery(query.trim());
  };

  const chooseSuggestion = (suggestion) => {
    setQuery(suggestion);
    setSubmittedQuery(suggestion);
  };

  return (
    <div className="ai-page">
      <header className="ai-header">
        <div className="ai-avatar"><FaRobot /></div>
        <div><strong>AI Book Finder</strong><span>Rule-based matching | no external AI</span></div>
        <button type="button" onClick={onBack} aria-label="Close AI Book Finder"><FaTimes /></button>
      </header>

      <main className="ai-thread">
        <div className="assistant-message">
          Hi! Tell me the title, subject, or grade you need. I will match your request with available books.
        </div>

        {!submittedQuery && (
          <div className="suggestion-row">
            {["Grade 10 Biology", "Math", "English"].map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => chooseSuggestion(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}

        {submittedQuery && <div className="user-message">{submittedQuery}</div>}
        {isLoading && <div className="assistant-message">Checking the available books...</div>}
        {error && <div className="assistant-message error">{error}</div>}
        {submittedQuery && !isLoading && matches.length === 0 && (
          <div className="assistant-message">I could not find a close match. Try adding a subject, grade, or title.</div>
        )}
        {submittedQuery && !isLoading && matches.length > 0 && (
          <div className="assistant-message">I found {matches.length} available {matches.length === 1 ? "match" : "matches"}, ordered by relevance.</div>
        )}
        {matches.map(({ book, reasons }) => (
          <article className="ai-result-card" key={book.id}>
            <div className="book-thumb small">
              {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBookOpen />}
            </div>
            <div>
              <h2>{book.title}</h2>
              <p>{book.subject} | Grade {book.grade}</p>
              <strong>Why it matches:</strong>
              <span>{reasons.length ? reasons.join(", ") : "title or subject keywords match your request"}.</span>
            </div>
          </article>
        ))}
      </main>

      <form className="ai-composer" onSubmit={submitQuery}>
        <input name="ai-book-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What book do you need?" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Book request" />
        <button type="submit" disabled={!query.trim()} aria-label="Search"><FaPaperPlane /></button>
      </form>
    </div>
  );
}

export default AIBookFinder;
