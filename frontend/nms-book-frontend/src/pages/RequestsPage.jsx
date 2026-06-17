import { useCallback, useEffect, useState } from "react";
import { FaClipboardList, FaTimes } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoUserRequests } from "../data/DemoData";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-BH", { dateStyle: "medium" }).format(new Date(value));
}

function RequestsPage({ onBack }) {
  const { user, demoMode } = useUser();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");

    if (demoMode) {
      setRequests(getDemoUserRequests());
      setIsLoading(false);
      return;
    }

    try {
      const response = await API.get(`/requests/user/${user.id}`);
      setRequests(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not load your requests.");
    } finally {
      setIsLoading(false);
    }
  }, [demoMode, user.id]);

  useEffect(() => {
    const timeout = setTimeout(loadRequests, 0);
    return () => clearTimeout(timeout);
  }, [loadRequests]);

  const cancelRequest = async (requestId) => {
    if (demoMode) {
      setRequests((current) => current.filter((request) => request.id !== requestId));
      return;
    }

    try {
      await API.delete(`/requests/${requestId}`);
      setRequests((current) => current.filter((request) => request.id !== requestId));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not cancel this request.");
    }
  };

  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Request management</p><h1>My Requests</h1></div>
        <FaClipboardList aria-hidden="true" />
      </header>

      {isLoading && <p className="status-card">Loading requests...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && requests.length === 0 && <p className="empty-state">You have not requested any books yet.</p>}

      <section className="request-list">
        {requests.map((request) => (
          <article className="request-card" key={request.id}>
            <div className="request-card-heading">
              <h2>{request.book_title}</h2>
              <span className={`status-pill ${request.status}`}>{request.status}</span>
            </div>
            <p><strong>Owner:</strong> {request.owner_name}</p>
            <p><strong>Requested:</strong> {formatDate(request.request_date)}</p>
            {request.status === "pending" && (
              <button className="danger-outline-btn" type="button" onClick={() => cancelRequest(request.id)}>
                <FaTimes aria-hidden="true" /> Cancel Request
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

export default RequestsPage;
