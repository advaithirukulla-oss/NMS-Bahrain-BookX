import { useEffect, useRef, useState } from "react";
import API from "../api/api";
import { smartError } from "../utils/smart";

export default function SmartAssist({ details, onApply, demoMode }) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function suggest(mode) {
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage(""); setSuggestions(null);
    try {
      if (demoMode) { setMessage("Switch off Demo Mode to use Smart Assist. You can continue manually."); return; }
      const { data } = await API.post("/smart/listing", { text, ...details, mode }, { timeout: 12000, signal: controller.signal });
      if (!controller.signal.aborted) { setSuggestions(data.suggestions); setMessage(Object.keys(data.suggestions).length ? data.note : "Add a subject, grade or a few book details to get suggestions."); }
    } catch (error) { if (!controller.signal.aborted) setMessage(smartError(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function dismiss(field) { setSuggestions(items => Object.fromEntries(Object.entries(items).filter(([key]) => key !== field))); }
  return <details className="smart-assist">
    <summary>Smart Assist <small>Optional · suggest listing details</small></summary>
    <p>Turn a few details into a draft. You review, apply and post.</p>
    <label htmlFor="listing-notes">What do you know about the book?</label>
    <textarea id="listing-notes" rows={3} maxLength={500} value={text} onChange={event => setText(event.target.value)} placeholder="Grade 7 science textbook, good condition, a few pencil marks" />
    <div className="smart-actions"><button type="button" disabled={busy || text.trim().length < 2} onClick={() => suggest("text")}>{busy ? "Preparing suggestions…" : "Suggest listing details"}</button><button type="button" disabled={busy} onClick={() => suggest("description")}>Help me write the description</button></div>
    <p className="smart-image-note">Image suggestions are unavailable. Your photo can still be included in the listing; add its details manually or use text assistance.</p>
    <p role="status">{message}</p>
    {suggestions && Object.entries(suggestions).map(([field, value]) => <div className="smart-suggestion" key={field}>
      <strong>Suggested {field}</strong><p>{value}</p>
      {details[field] && details[field] !== value && <small>Applying replaces your current {field}: “{details[field]}”</small>}
      <div className="smart-actions"><button type="button" onClick={() => { onApply(field, value); dismiss(field); setMessage(`Suggested ${field} applied. You can edit it below before posting.`); }}>Apply {field}</button><button type="button" onClick={() => dismiss(field)}>Dismiss {field}</button></div>
    </div>)}
    {suggestions && Object.keys(suggestions).length > 0 && <button type="button" className="back-link" onClick={() => { setSuggestions(null); setMessage("Suggestions dismissed. Your form has not changed."); }}>Dismiss all suggestions</button>}
  </details>;
}
