import { useCallback, useEffect, useState } from "react";
import { FaBookOpen, FaSyncAlt } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";

function Take() {
  const { demoMode, user } = useUser();

  const [books, setBooks] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [requestingBookId, setRequestingBookId] = useState(null);

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
        book_id: bookId,
        requester_id: user.id
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
            <div className="book-image-placeholder">
              {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBookOpen aria-hidden="true" />}
            </div>

            <h2>{book.title}</h2>
            <div className="tag-row">
              <span>{book.subject}</span>
              <span>Grade {book.grade}</span>
              <span>{book.condition}</span>
              <span className={`status-pill ${book.status}`}>{book.status}</span>
            </div>

            <p>
              {book.description}
            </p>

            <button
              className="primary-btn"
              type="button"
              disabled={book.status === "reserved" || requestingBookId === book.id}
              onClick={() => requestBook(book.id)}
            >
              {requestingBookId === book.id ? "Requesting..." : book.status === "reserved" ? "Reserved" : "Request Book"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Take;
