import { useMemo, useState } from "react";
import { FaMagic, FaPaperPlane, FaRobot, FaTimes } from "react-icons/fa";
import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
import { useUser } from "../context/UserContext";
import { formatGrade } from "../utils/grades";

import { findIntent } from "../utils/finder";

function AIBookFinder({ onBack }) {
  const { user } = useUser();
  const { books, loading: isLoading, error } = useDiscovery();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
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
          reasons.push(`matches ${intent.subject}`);
        }
        if (intent.grade && grade === intent.grade) {
          score += 3;
              reasons.push(`is for ${formatGrade(book.grade)}`);
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
      .filter((match) => match.score > 0 && match.book.status === "available" && match.book.owner_id !== user.id && (!intent.grade || String(match.book.grade).toLowerCase() === intent.grade) && (!intent.subject || `${match.book.title} ${match.book.subject}`.toLowerCase().includes(intent.subject)))
      .sort((a, b) => b.score - a.score);
  }, [books, submittedQuery, user.id]);

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
        <div><strong>AI Book Finder</strong><span><FaMagic aria-hidden="true" /> Matches from real listings</span></div>
        <button type="button" onClick={onBack} aria-label="Close AI Book Finder"><FaTimes /></button>
      </header>

      <main className="ai-thread">
        <div className="assistant-message ai-bubble-with-icon">
          <span className="assistant-badge"><FaRobot aria-hidden="true" /></span>
          <span><strong>What are you looking for?</strong><br />Tell me the title, subject, or grade you need. I match your words with real listings using grade and keyword rules.</span>
        </div>

        {!submittedQuery && (
          <div className="suggestion-row">
            {["Science for Grade 7", "Easy English reading", "Books for KG 2", "Math practice"].map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => chooseSuggestion(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}

        {submittedQuery && <div className="user-message">{submittedQuery}</div>}
        {isLoading && <div className="assistant-message ai-loading"><span /><span /><span /> Checking the available books...</div>}
        {error && <div className="assistant-message error">{error}</div>}
        {submittedQuery && !isLoading && matches.length === 0 && (
          <div className="assistant-message">I could not find a close match. Try adding a subject, grade, or title.</div>
        )}
        {submittedQuery && !isLoading && matches.length > 0 && (
          <div className="assistant-message">I found {matches.length} available {matches.length === 1 ? "match" : "matches"}, ordered by relevance.</div>
        )}
        {matches.map(({ book, reasons }) => <BookCard key={book.id} book={book} reason={`Available on BookSpins · ${reasons.length ? reasons.join(", ") : "Matches your keywords"}`} />)}
      </main>

      <form className="ai-composer" onSubmit={submitQuery}>
        <input name="ai-book-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What book do you need?" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Book request" />
        <button type="submit" disabled={!query.trim()} aria-label="Search"><FaPaperPlane /></button>
      </form>
    </div>
  );
}

export default AIBookFinder;
