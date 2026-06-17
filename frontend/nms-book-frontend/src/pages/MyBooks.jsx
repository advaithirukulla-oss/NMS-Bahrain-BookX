import { useCallback, useEffect, useState } from "react";
import { FaBook, FaCheck, FaTimes } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoOwnerBooks } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-BH", { dateStyle: "medium" }).format(new Date(value));
}

function MyBooks({ onBack }) {
  const { user, demoMode } = useUser();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
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
    return () => clearTimeout(timeout);
  }, [loadBooks]);

  const updateRequest = async (requestId, status) => {
    if (demoMode) {
      setBooks((current) => current.map((book) => ({
        ...book,
        status: status === "approved" && book.requests.some((request) => request.id === requestId) ? "reserved" : book.status,
        requests: book.requests.map((request) => request.id === requestId ? { ...request, status } : request),
      })));
      return;
    }

    try {
      await API.put(`/requests/${requestId}`, { status });
      await loadBooks();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not update this request.");
    }
  };

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
          <article className="owner-book-card" key={book.id}>
            <div className="request-card-heading">
              <div className="owner-book-summary">
                <div className="book-thumb">
                  {book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBook />}
                </div>
                <div>
                  <h2>{book.title}</h2>
                  <div className="tag-row">
                    <span>{book.subject}</span>
                    <span>Grade {book.grade}</span>
                  </div>
                </div>
              </div>
              <span className={`status-pill ${book.status}`}>{book.status}</span>
            </div>
            <h3>Incoming Requests</h3>
            {book.requests.length === 0 && <p className="muted-text">No requests for this book yet.</p>}
            {book.requests.map((request) => (
              <div className="incoming-request" key={request.id}>
                <div>
                  <strong>{request.requester_name}</strong>
                  <span>{formatDate(request.request_date)}</span>
                </div>
                <span className={`status-pill ${request.status}`}>{request.status}</span>
                {request.status === "pending" && (
                  <div className="request-actions">
                    <button type="button" className="approve-btn" onClick={() => updateRequest(request.id, "approved")}><FaCheck /> Approve</button>
                    <button type="button" className="reject-btn" onClick={() => updateRequest(request.id, "rejected")}><FaTimes /> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}

export default MyBooks;
