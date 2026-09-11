import { useEffect, useRef, useState } from "react";
import { FaBookOpen, FaBookmark, FaRegBookmark } from "react-icons/fa";
import { statusLabel } from "../utils/exchanges";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { useDiscovery } from "../context/DiscoveryContext";
import { getBookImageUrl } from "../utils/bookImages";
import { formatGrade } from "../utils/grades";
import { ReportButton } from "./SafetyActions";

export function BookCover({ book }) {
  return book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} loading="lazy" /> : <FaBookOpen aria-hidden="true" />;
}
export function SaveButton({ book }) {
  const { saved, busy, toggleSave, savedReady } = useDiscovery();
  const [message, setMessage] = useState("");
  const isSaved = saved.some((item) => item.id === book.id);
  async function save() {
    try { setMessage(await toggleSave(book)); }
    catch (error) { setMessage(error.response?.data?.detail || "Could not update Saved Books. Try again."); }
  }
  return <div className="save-control"><button type="button" className="save-button" aria-pressed={isSaved} aria-label={`${isSaved ? "Remove" : "Save"} ${book.title}${isSaved ? " from Saved Books" : " for later"}`} disabled={!savedReady || busy.includes(book.id)} onClick={save}>{isSaved ? <FaBookmark /> : <FaRegBookmark />}{isSaved ? "Saved" : "Save"}</button><span className="save-feedback" role="status">{message}</span></div>;
}
function RequestButton({ book, onRequested, existingRequest }) {
  const { user, demoMode } = useUser();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const own = book.owner_id === user.id;
  async function request() {
    setPending(true);
    try {
      if (!demoMode) await API.post("/requests", { book_id: book.id });
      setSent(true); setMessage(demoMode ? "Demo request created." : "Request sent. Track it in Requests.");
      onRequested?.();
    } catch (error) { setMessage(error.response?.data?.detail || "Could not request this book."); }
    finally { setPending(false); }
  }
  return <div><button type="button" className="primary-btn request-book-btn" disabled={own || book.status !== "available" || pending || sent || existingRequest} onClick={request}>{own ? "Your listing" : sent || existingRequest ? "Already requested" : pending ? "Requesting…" : book.status !== "available" ? "Unavailable" : "Request Book"}</button><p role="status">{message}</p></div>;
}
export function BookDetails({ book, onClose }) {
  const dialog = useRef(null);
  const { demoMode } = useUser();
  const { viewed, updateBook, removeMissing } = useDiscovery();
  const [current, setCurrent] = useState(book);
  const [activity, setActivity] = useState([]);
  const [ready, setReady] = useState(demoMode);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    let live = true;
    if (demoMode) viewed(book.id);
    else API.get(`/books/${book.id}`).then(({ data }) => {
      if (!live) return;
      setCurrent(data.book); setActivity(data.activity); setReady(true); updateBook(data.book); viewed(book.id);
    }).catch((failure) => {
      if (!live) return;
      setError(failure.response?.status === 404 ? "This listing has been deleted." : "Could not refresh this listing. Close and try again.");
      if (failure.response?.status === 404) removeMissing(book.id);
    });
    return () => { live = false; element.close(); previous?.focus(); };
    // Open once; context changes must not reopen the dialog or repeat history writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, demoMode]);

  return <dialog ref={dialog} className="discovery-dialog" aria-labelledby={`detail-${book.id}`} onCancel={onClose} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    <button type="button" className="dialog-close" aria-label="Close book details" onClick={onClose}>×</button>
    <div className="dialog-image"><BookCover book={current} /></div>
    <div className="book-detail-copy"><h2 id={`detail-${book.id}`}>{current.title}</h2><p>{current.author || "Author not provided"}</p><div className="detail-chips"><span>{current.subject}</span><span>{formatGrade(current.grade)}</span><span>{current.condition}</span><span>{statusLabel(current.status)}</span></div><p>{current.description}</p>
      {error ? <p role="alert">{error}</p> : !ready ? <p role="status">Checking availability…</p> : <><SaveButton book={current} /><RequestButton book={current} existingRequest={activity.some(item => item.status !== "cancelled")} onRequested={() => setActivity((items) => [{ status: "pending" }, ...items])} /><ReportButton type="book" targetId={current.id} /><h3>Book activity</h3><ul><li>Listed</li>{activity.map((item, index) => <li key={index}>{statusLabel(item.status)}</li>)}</ul></>}
    </div>
  </dialog>;
}
export default function BookCard({ book, shelf = false, reason }) {
  const [open, setOpen] = useState(false);
  return <article className={shelf ? "home-book discovery-book" : "compact-book-card discovery-book"}>
    <button type="button" className={shelf ? "home-cover book-open" : "book-thumb book-open"} aria-label={`Open ${book.title}`} onClick={() => setOpen(true)}><BookCover book={book} /></button>
    <div className="discovery-copy"><button className="book-title" type="button" onClick={() => setOpen(true)}>{book.title}</button><p>{book.author || "Author not provided"}</p><small>{book.subject} · {formatGrade(book.grade)}</small><p className={`status-pill ${book.status}`}>{statusLabel(book.status)}</p>{reason && <p className="recommendation-reason">{reason}</p>}<SaveButton book={book} /><button type="button" className="back-link" onClick={() => setOpen(true)}>Open details</button></div>
    {open && <BookDetails book={book} onClose={() => setOpen(false)} />}
  </article>;
}
