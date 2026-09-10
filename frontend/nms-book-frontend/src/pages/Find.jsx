import { useEffect, useMemo, useState } from "react";
import { FaFilter, FaSearch } from "react-icons/fa";
import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
import { readLocal, writeLocal } from "../utils/discovery";
import { useUser } from "../context/UserContext";
import { GRADE_OPTIONS, gradeSortValue } from "../utils/grades";

function Find() {
  const { user, demoMode } = useUser();
  const key = 'bookspins:find:' + (demoMode ? 'demo' : user.id);
  const [initial] = useState(() => readLocal(key, {}));
  const { books, loading: isLoading, error } = useDiscovery();
  const [query, setQuery] = useState(typeof initial?.query === 'string' ? initial.query : '');
  const [grade, setGrade] = useState(typeof initial?.grade === 'string' ? initial.grade : '');
  const [subject, setSubject] = useState(typeof initial?.subject === 'string' ? initial.subject : '');
  const [availability, setAvailability] = useState(initial?.availability ?? 'available');
  const [sortBy, setSortBy] = useState(initial?.sortBy ?? 'newest');
  useEffect(() => { writeLocal(key, { query: query.slice(0, 120), grade, subject, availability, sortBy }); }, [key, query, grade, subject, availability, sortBy]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedGrade = grade.trim().toLowerCase();

    return books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        book.title.toLowerCase().includes(normalizedQuery) ||
        book.subject.toLowerCase().includes(normalizedQuery);
      const matchesGrade =
        !normalizedGrade || String(book.grade).toLowerCase() === normalizedGrade;
      const matchesSubject = !subject || book.subject.toLowerCase() === subject.toLowerCase();
      const matchesAvailability = !availability || book.status === availability;

      return matchesQuery && matchesGrade && matchesSubject && matchesAvailability;
    }).sort((first, second) => {
      if (sortBy === "title") return first.title.localeCompare(second.title);
      if (sortBy === "grade") return gradeSortValue(first.grade) - gradeSortValue(second.grade);
      return Number(second.id) - Number(first.id);
    });
  }, [availability, books, grade, query, sortBy, subject]);

  const subjects = useMemo(
    () => [...new Set(books.map((book) => book.subject).filter(Boolean))].sort((first, second) => first.localeCompare(second)),
    [books],
  );
  const clearFilters = () => { setQuery(""); setGrade(""); setSubject(""); setAvailability("available"); setSortBy("newest"); };
  const hasActiveFilters = Boolean(query || grade || subject || availability !== "available" || sortBy !== "newest");

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
            aria-label="Search title or subject"
            placeholder="Search title or subject"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <div className="filter-row">
          <label>
            <span>Grade</span>
            <select name="find-grade" value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{GRADE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label>
            <span>Subject</span>
            <select name="find-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Availability</span>
            <select name="find-availability" value={availability} onChange={(event) => setAvailability(event.target.value)}>
              <option value="">All books</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select name="find-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
              <option value="grade">Grade</option>
            </select>
          </label>
        </div>

        <p className="result-count"><FaFilter /> {filteredBooks.length} matching books {hasActiveFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</p>
      </section>

      {isLoading && <p className="status-card">Searching books...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && !error && filteredBooks.length === 0 && (
        <div className="empty-state"><strong>No match yet.</strong><p>Try changing your filters, or ask BookSpins AI for help.</p><button type="button" onClick={clearFilters}>Clear Filters</button></div>
      )}

      <div className="compact-book-list">
        {filteredBooks.map((book) => <BookCard key={book.id} book={book} />)}
      </div>
    </div>
  );
}

export default Find;
