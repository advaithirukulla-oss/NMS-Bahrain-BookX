import { useEffect, useRef, useState } from "react";
import { FaBan, FaFlag } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";

const REASONS = {
  book: [["wrong_details", "Wrong book or details"], ["inappropriate_image", "Inappropriate image"], ["spam", "Spam"], ["not_school_related", "Not school-related"], ["already_exchanged", "Already exchanged but still listed"], ["other", "Other"]],
  user: [["inappropriate_messages", "Inappropriate messages"], ["spam", "Spam"], ["harassment", "Harassment"], ["fake_listings", "Fake listings"], ["unsafe_behavior", "Unsafe behavior"], ["other", "Other"]],
};

export function ReportButton({ type, targetId, label }) {
  const { demoMode } = useUser(); const dialog = useRef(null); const [reason, setReason] = useState(REASONS[type][0][0]); const [note, setNote] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => () => dialog.current?.close(), []);
  async function submit(event) { event.preventDefault(); try { if (!demoMode) await API.post(`/reports/${type === "book" ? "books" : "users"}/${targetId}`, { reason, note: note.trim() || null }); setMessage("Report sent to school administrators."); setTimeout(() => dialog.current?.close(), 700); } catch (error) { setMessage(error.response?.data?.detail || "Could not send this report."); } }
  return <><button type="button" className="safety-link" onClick={() => { setMessage(""); dialog.current?.showModal(); }}><FaFlag aria-hidden="true" /> {label || `Report ${type}`}</button><dialog ref={dialog} className="safety-dialog" aria-labelledby={`report-${type}-${targetId}`}><form onSubmit={submit}><button type="button" className="dialog-close" aria-label="Close report dialog" onClick={() => dialog.current?.close()}>×</button><h2 id={`report-${type}-${targetId}`}>Report this {type}</h2><p>Reports are reviewed by school administrators. The other student will not see who reported them.</p><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}>{REASONS[type].map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label><label>Short note <span>(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="300" /></label>{message && <p role="alert">{message}</p>}<button className="primary-btn" type="submit">Send report</button></form></dialog></>;
}

export function UserSafetyActions({ userId }) {
  const { demoMode, user } = useUser(); const [blocked, setBlocked] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { if (!demoMode) API.get("/blocks").then(({ data }) => setBlocked(data.some((item) => item.id === userId))).catch(() => {}); }, [demoMode, userId]);
  if (userId === user.id) return null;
  async function toggle() { try { if (!demoMode) { if (blocked) await API.delete(`/blocks/${userId}`); else await API.post(`/blocks/${userId}`); } setBlocked(!blocked); setMessage(blocked ? "User unblocked. Historic messages remain." : "User blocked. New messages and requests are unavailable."); } catch (error) { setMessage(error.response?.data?.detail || "Could not update block settings."); } }
  return <div className="safety-actions"><ReportButton type="user" targetId={userId} label="Report user" /><button type="button" className="safety-link" aria-pressed={blocked} onClick={toggle}><FaBan aria-hidden="true" />{blocked ? "Unblock user" : "Block user"}</button>{message && <span role="status">{message}</span>}</div>;
}
