import { useEffect, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import API from "../api/api";
import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
import { useUser } from "../context/UserContext";
import { smartError } from "../utils/smart";

export default function AIBookFinder({ onBack }) {
  const { recent } = useDiscovery();
  const { demoMode } = useUser();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(text) {
    if (text.trim().length < 2) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setQuery(text); setBusy(true); setError(""); setResult(null);
    try {
      if (demoMode) { setError("Switch off Demo Mode to search the real BookSpins catalogue."); return; }
      const { data } = await API.post("/smart/find", { query: text.trim(), recent_ids: recent.map(book => book.id) }, { timeout: 12000, signal: request.signal });
      if (!request.signal.aborted) setResult(data);
    } catch (failure) { if (!request.signal.aborted) setError(smartError(failure)); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  return <div className="page smart-finder">
    <header className="page-heading"><div><p className="eyebrow">GROUNDED IN BOOKSPINS</p><h1>AI Book Finder</h1></div><button className="back-link" type="button" onClick={onBack} aria-label="Close AI Book Finder"><FaTimes /></button></header>
    <p>Describe what you need. We match grades, subjects and words in real listings, with help from your saved and recently viewed books.</p>
    <form className="smart-search form-card" onSubmit={event => { event.preventDefault(); search(query); }}>
      <label htmlFor="smart-query">What would you like to read?</label>
      <textarea id="smart-query" maxLength={500} rows={3} value={query} onChange={event => setQuery(event.target.value)} placeholder="I need an easy science book for Grade 7" />
      <button className="primary-btn" disabled={busy || query.trim().length < 2}><FaSearch /> {busy ? "Checking the catalogue…" : "Find books"}</button>
      <small>Uses catalogue matching. No external AI service receives your query.</small>
    </form>
    <div className="suggestion-row" aria-label="Search ideas">{["Science for Grade 7", "English books for KG 2", "Something adventurous", "Similar to books I saved", "Similar to recently viewed books"].map(text => <button type="button" disabled={busy} key={text} onClick={() => search(text)}>{text}</button>)}</div>
    {busy && <p role="status">Finding real listings and checking their availability…</p>}
    {error && <p role="alert" className="page-message">{error} Find, Give and your exchanges remain available.</p>}
    {result && <section aria-live="polite"><h2>Real BookSpins listings</h2>
      <p>{result.results.length ? `${result.results.length} matching listings. Open a book to check its latest availability.` : "No matching listings right now. Try another subject, grade or theme."}</p>
      {result.note && <p>{result.note}</p>}
      <div className="smart-results">{result.results.map(({ book, reason }) => <BookCard key={book.id} book={book} reason={reason} />)}</div>
      {result.general_suggestions.length > 0 && <aside className="smart-general"><h2>General suggestions</h2><p>Ideas to guide your search — these are not BookSpins listings.</p>{result.general_suggestions.map(idea => <p key={idea}>{idea}</p>)}</aside>}
    </section>}
  </div>;
}
