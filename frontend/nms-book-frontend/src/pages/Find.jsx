import { useEffect, useMemo, useState } from "react";
import { FaBookOpen, FaFilter, FaSearch } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";

function Find() {
  const { demoMode } = useUser();
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        if (demoMode) {
          setBooks(DEMO_BOOKS);
          return;
        }
        let endpoint = "/books";
        const trimmedQuery = query.trim();

        if (trimmedQuery) {
          endpoint = `/books/search?keyword=${encodeURIComponent(trimmedQuery)}`;
        }

        const response = await API.get(endpoint, { signal: controller.signal });
        setBooks(response.data);
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") {
          setBooks([]);
          setError(requestError.response?.data?.detail || "Could not load books.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [demoMode, query]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedGrade = grade.trim().toLowerCase();

    return books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        book.title.toLowerCase().includes(normalizedQuery) ||
        book.subject.toLowerCase().includes(normalizedQuery);
      const matchesGrade =
        !normalizedGrade || book.grade.toLowerCase().includes(normalizedGrade);

      return matchesQuery && matchesGrade;
    });
  }, [books, grade, query]);

  return (
    <div className="page find-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Book catalogue</p>
          <h1>Find Books</h1>
        </div>
        <FaSearch aria-hidden="true" />
      </header>

      <section className="filter-panel" aria-label="Book filters">
        <label className="search-field">
          <FaSearch aria-hidden="true" />
          <input
            type="search"
            name="find-query"
            placeholder="Search title or subject"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <div className="filter-row single">
          <label>
            <span>Grade</span>
            <input
              type="text"
              name="find-grade"
              placeholder="e.g. 10"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        </div>

        <p className="result-count"><FaFilter /> {filteredBooks.length} matching books</p>
      </section>

      {isLoading && <p className="status-card">Searching books...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && !error && filteredBooks.length === 0 && (
        <p className="empty-state">No books match those filters.</p>
      )}

      <div className="compact-book-list">
        {filteredBooks.map((book) => (
          <article className="compact-book-card" key={book.id}>
            <div className="book-thumb">
              {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBookOpen />}
            </div>
            <div>
              <h2>{book.title}</h2>
              <div className="tag-row">
                <span>{book.subject}</span>
                <span>Grade {book.grade}</span>
                <span>{book.condition}</span>
                <span className={`status-pill ${book.status}`}>{book.status}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default Find;
