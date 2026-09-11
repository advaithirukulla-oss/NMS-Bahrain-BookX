import { useCallback, useEffect, useState } from "react";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoUserRequests, getDemoOwnerBooks } from "../data/DemoData";
import ExchangeCard from "../components/ExchangeCard";

export default function RequestsPage({ onBack, onNavigate, selectedRequestId }) {
  const { user, demoMode } = useUser();
  const [mine, setMine] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [tab, setTab] = useState("mine");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [requests, books] = demoMode ? [getDemoUserRequests(), getDemoOwnerBooks()] : await Promise.all([
        API.get(`/requests/user/${user.id}`).then(r => r.data), API.get(`/books/owner/${user.id}/requests`).then(r => r.data),
      ]);
      setMine(requests); setIncoming(books.flatMap(book => book.requests.map(request => ({ ...request, book })))); setError("");
    } catch (failure) { setError(failure.response?.data?.detail || "Could not load exchanges."); }
    finally { setLoading(false); }
  }, [demoMode, user.id]);
  useEffect(() => {
    const timeout = setTimeout(load, 0);
    const interval = setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => { clearTimeout(timeout); clearInterval(interval); window.removeEventListener("focus", load); };
  }, [load]);
  useEffect(() => { if (!loading && selectedRequestId) document.getElementById(`request-${selectedRequestId}`)?.focus(); }, [loading, selectedRequestId]);
  const rows = tab === "mine" ? mine : incoming;
  return <div className="page utility-page">
    <button type="button" className="back-link" onClick={onBack}>Back to Profile</button>
    <header className="page-heading"><div><p className="eyebrow">From request to second spin</p><h1>Exchanges</h1></div></header>
    <div className="exchange-tabs" aria-label="Exchange view">{[["mine", "Requested by Me"], ["incoming", "Requests for My Books"]].map(([value, label]) => <button type="button" aria-pressed={tab === value} key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {loading && <p role="status">Loading exchanges…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && rows.length === 0 && <p className="empty-state">No exchanges here yet.</p>}
    <section className="request-list">{rows.map(request => <ExchangeCard key={request.id} request={request} owner={tab === "incoming"} book={request.book || { id: request.book_id, title: request.book_title, image_url: request.image_url }} onRefresh={load} onNavigate={onNavigate} />)}</section>
  </div>;
}
