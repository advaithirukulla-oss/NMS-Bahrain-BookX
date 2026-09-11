import { useEffect, useRef, useState } from "react";
import { FaBookOpen } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { BookCover, BookDetails } from "./BookCard";
import { eventDate, permittedActions, requestTimeline, statusLabel } from "../utils/exchanges";

function CompletionDialog({ onClose, onConfirm, onNavigate, busy, complete, error }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const card = previous?.closest("article");
    const element = ref.current;
    element.showModal();
    return () => { element.close(); (previous?.isConnected ? previous : card)?.focus(); };
  }, []);
  useEffect(() => { if (complete) ref.current?.querySelector("h2")?.focus(); }, [complete]);
  return <dialog ref={ref} className="exchange-dialog" aria-labelledby="completion-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}>
    <div className={complete ? "second-spin complete" : "second-spin"}><FaBookOpen aria-hidden="true" /></div>
    <h2 id="completion-title" tabIndex={-1}>{complete ? "Another book got a second spin." : "Has the book been handed over?"}</h2>
    <p role="status">{complete ? "This exchange is complete." : "Mark complete only after the requester has received the book. This closes the exchange."}</p>
    {error && <p role="alert" className="form-message error">{error}</p>}
    <div className="exchange-actions">{complete ? <>
      <button type="button" className="primary-btn" onClick={() => onNavigate("home")}>Back to Home</button>
      <button type="button" className="secondary-btn" onClick={() => onNavigate("find")}>Find Another Book</button>
      <button type="button" className="back-link" onClick={onClose}>View completed exchange</button>
    </> : <>
      <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{busy ? "Completing…" : "Confirm handoff"}</button>
      <button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>Not yet</button>
    </>}</div>
  </dialog>;
}

export default function ExchangeCard({ request, book, owner = false, onRefresh, onNavigate }) {
  const { demoMode } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(false);
  const [completion, setCompletion] = useState(false);
  const [completed, setCompleted] = useState(false);
  const actions = permittedActions(request.status, owner);
  const participant = owner ? request.requester_name : request.owner_name;
  async function act(action) {
    if (busy) return;
    if (demoMode) { setError("Exchange actions are available when you sign in with real listings."); return; }
    setBusy(true); setError("");
    try {
      if (action === "completed") await API.post(`/requests/${request.id}/complete`);
      else if (action === "cancelled") await API.delete(`/requests/${request.id}`);
      else await API.put(`/requests/${request.id}`, { status: action });
      if (action === "completed") setCompleted(true);
      window.dispatchEvent(new Event("bookspins:catalog-updated"));
      await onRefresh();
    } catch (failure) { setError(failure.response?.data?.detail || "Could not update this exchange. Refresh and try again."); }
    finally { setBusy(false); }
  }
  return <article className="request-card exchange-card" id={`request-${request.id}`} tabIndex={-1}>
    <div className="request-card-heading"><div className="owner-book-summary"><div className="book-thumb"><BookCover book={book} /></div><div><h2>{book.title}</h2><p>{owner ? "Requested by" : "Owner"}: {participant}</p></div></div><span className={`status-pill ${request.status}`}>{statusLabel(request.status)}</span></div>
    {request.status === "approved" && <p className="exchange-note">Exchange accepted. Coordinate the handoff in Messages.{!owner && " The owner will mark the exchange complete after handoff."}</p>}
    {request.status === "completed" && <p className="exchange-note">Another book got a second spin. This exchange is complete.</p>}
    <ol className="exchange-timeline" aria-label="Exchange timeline">{requestTimeline(request).map((event) => <li key={event.status}><strong>{statusLabel(event.status)}</strong><time dateTime={event.at}>{eventDate(event.at)}</time></li>)}</ol>
    {error && !completion && <p role="alert" className="form-message error">{error}</p>}
    <div className="exchange-actions">
      <button type="button" className="secondary-btn" onClick={() => setDetails(true)}>View book</button>
      {["approved", "completed"].includes(request.status) && <button type="button" className="secondary-btn" onClick={() => onNavigate("messages", { conversation: { user_id: owner ? request.requester_id : request.owner_id, name: participant, exchange_id: request.id } })}>Messages</button>}
      {actions.map((action) => <button key={action} type="button" disabled={busy} className={action === "approved" || action === "completed" ? "approve-btn" : "danger-outline-btn"} onClick={() => action === "completed" ? setCompletion(true) : act(action)}>{({ approved: "Accept", rejected: "Decline", cancelled: "Cancel Request", completed: "Mark complete" })[action]}</button>)}
    </div>
    {details && <BookDetails book={book} onClose={() => setDetails(false)} />}
    {completion && <CompletionDialog onClose={() => setCompletion(false)} onConfirm={() => act("completed")} onNavigate={onNavigate} busy={busy} complete={completed} error={error} />}
  </article>;
}
