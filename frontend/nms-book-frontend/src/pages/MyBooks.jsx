import { useCallback, useEffect, useState } from "react";
import { FaBook } from "react-icons/fa";
import ExchangeCard from "../components/ExchangeCard";
import { statusLabel } from "../utils/exchanges";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoOwnerBooks } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";
import { formatGrade } from "../utils/grades";

function MyBooks({ onBack, selectedBookId, onNavigate }) {
  const { user, demoMode } = useUser();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadBooks = useCallback(async () => {
    setError("");

    if (demoMode) {
      setBooks(getDemoOwnerBooks());
      setIsLoading(false);
      return;
    }

    try {
      const response = await API.get(`/books/owner/${user.id}/requests`);
      setBooks(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not load your posted books.");
    } finally {
      setIsLoading(false);
    }
  }, [demoMode, user.id]);

  useEffect(() => {
    const timeout = setTimeout(loadBooks, 0);
    const interval = setInterval(loadBooks, 10000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [loadBooks]);

  useEffect(() => { if (!isLoading && selectedBookId) document.getElementById(`owner-book-${selectedBookId}`)?.focus(); }, [isLoading, selectedBookId]);

  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Owner controls</p><h1>My Books</h1></div>
        <FaBook aria-hidden="true" />
      </header>

      {isLoading && <p className="status-card">Loading your books...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && books.length === 0 && <p className="empty-state">You have not posted any books yet.</p>}

      <section className="owner-book-list">
        {books.map((book) => (
          <article className="owner-book-card" id={`owner-book-${book.id}`} tabIndex={-1} key={book.id}>
            <div className="request-card-heading">
              <div className="owner-book-summary">
                <div className="book-thumb">
                  {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBook />}
                </div>
                <div>
                  <h2>{book.title}</h2>
                  <div className="tag-row">
                    <span>{book.subject}</span>
                    <span>{formatGrade(book.grade)}</span>
                  </div>
                </div>
              </div>
              <span className={`status-pill ${book.status}`}>{statusLabel(book.status)}</span>
            </div>
            <h3>Incoming Requests</h3>
            {book.requests.length === 0 && <p className="muted-text">No requests for this book yet.</p>}
            {book.requests.map((request) => <ExchangeCard key={request.id} request={request} book={book} owner onRefresh={loadBooks} onNavigate={onNavigate} />)}
          </article>
        ))}
      </section>
    </div>
  );
}

export default MyBooks;
