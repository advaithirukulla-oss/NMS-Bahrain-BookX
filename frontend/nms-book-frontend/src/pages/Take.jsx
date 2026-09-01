import { useCallback, useEffect, useState } from "react";
import { FaBookOpen, FaCheckCircle, FaExpandAlt, FaGraduationCap, FaLayerGroup, FaSyncAlt, FaTag, FaTimes } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";
import { formatGrade } from "../utils/grades";

function Take() {
  const { demoMode, user } = useUser();

  const [books, setBooks] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [requestingBookId, setRequestingBookId] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setMessage("");

    if (demoMode) {
      setBooks(DEMO_BOOKS);
      setIsLoading(false);
      return;
    }

    try {
      const response = await API.get("/books");
      setBooks(response.data);
    } catch (requestError) {
      setBooks([]);
      setError(requestError.response?.data?.detail || "Could not load available books.");
    } finally {
      setIsLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    const timeout = setTimeout(loadBooks, 0);
    return () => clearTimeout(timeout);
  }, [loadBooks]);

  const requestBook = async (bookId) => {
    if (!user) {
      setMessage("Please login first.");
      return;
    }

    try {
      setRequestingBookId(bookId);
      setError("");
      if (demoMode) {
        setMessage("Demo request created successfully!");
        return;
      }
      await API.post("/requests", {
        book_id: bookId
      });

      setMessage("Book requested successfully!");
    } catch (err) {
      setMessage(
        err.response?.data?.detail || "Could not request this book."
      );
    } finally {
      setRequestingBookId(null);
    }
  };

  return (
    <div className="page">
      <header className="page-heading">
        <div><p className="eyebrow">Student catalogue</p><h1>Available Books</h1></div>
        <FaBookOpen aria-hidden="true" />
      </header>

      {message && (
        <p className="page-message">
          {message}
        </p>
      )}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {isLoading && <p className="status-card"><FaSyncAlt aria-hidden="true" /> Loading available books...</p>}

      {!isLoading && !error && books.length === 0 && (
        <p className="empty-state">No books are available yet. Check back soon or post one from Give.</p>
      )}

      <div className="book-list" aria-live="polite">
        {books.map((book) => (
          <div className="book-card" key={book.id}>
            <button className="book-image-placeholder image-viewer-trigger" type="button" onClick={() => setSelectedBook(book)} aria-label={`View ${book.title} details`}>
              {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBookOpen aria-hidden="true" />}
              <span className={`cover-status ${book.status}`}><FaCheckCircle aria-hidden="true" /> {book.status}</span>
              <span className="expand-image"><FaExpandAlt aria-hidden="true" /> View</span>
            </button>

            <div className="book-card-copy">
              <h2>{book.title}</h2>
              <p className="book-meta-line"><FaTag aria-hidden="true" /> {book.condition || "Good condition"}</p>
            </div>
            <div className="tag-row">
              <span><FaLayerGroup aria-hidden="true" /> {book.subject}</span>
              <span><FaGraduationCap aria-hidden="true" /> {formatGrade(book.grade)}</span>
              <span className={`status-pill ${book.status}`}>{book.status}</span>
            </div>

            <p>
              {book.description}
            </p>

            <button
              className="primary-btn request-book-btn"
              type="button"
              disabled={book.status !== "available" || book.owner_id === user?.id || requestingBookId === book.id}
              onClick={() => requestBook(book.id)}
            >
              {requestingBookId === book.id ? "Requesting..." : book.owner_id === user?.id ? "Your Book" : book.status !== "available" ? "Reserved" : "Request Book"}
            </button>
          </div>
        ))}
      </div>
      {selectedBook && (
        <div className="image-dialog-backdrop" role="presentation" onMouseDown={() => setSelectedBook(null)}>
          <section className="image-dialog" role="dialog" aria-modal="true" aria-label={`${selectedBook.title} details`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setSelectedBook(null)} aria-label="Close book details"><FaTimes /></button>
            <div className="dialog-image">
              {selectedBook.image_url ? <img src={getBookImageUrl(selectedBook.image_url)} alt={`${selectedBook.title} cover`} /> : <FaBookOpen aria-hidden="true" />}
            </div>
            <div className="dialog-copy"><h2>{selectedBook.title}</h2><p>{selectedBook.subject} · {formatGrade(selectedBook.grade)} · {selectedBook.condition || "Good condition"}</p><p>{selectedBook.description}</p></div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Take;
