/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import API from "../api/api";
import { useUser } from "./UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { readLocal, writeLocal, recentIds, recordView } from "../utils/discovery";

const DiscoveryContext = createContext(null);
export const useDiscovery = () => useContext(DiscoveryContext);

// Remount on account/demo changes so no account data crosses sessions.
export function DiscoveryProvider({ children }) {
  const { user, demoMode } = useUser();
  return <DiscoverySession key={`${user?.id}:${demoMode}`} >{children}</DiscoverySession>;
}
function DiscoverySession({ children }) {
  const { user, demoMode } = useUser();
  const historyKey = `bookspins:recent:${demoMode ? "demo" : user.id}`;
  const [books, setBooks] = useState([]);
  const [saved, setSaved] = useState([]);
  const [history, setHistory] = useState(() => recentIds(readLocal(historyKey, [])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedReady, setSavedReady] = useState(false);
  const [busy, setBusy] = useState([]);
  const pending = useRef(new Set());
  useEffect(() => {
    let live = true;
    Promise.allSettled([demoMode ? Promise.resolve({ data: DEMO_BOOKS }) : API.get("/books"), demoMode ? Promise.resolve({ data: [] }) : API.get("/saved-books")]).then(([catalog, bookmarks]) => {
      if (!live) return;
      if (catalog.status === "fulfilled") setBooks(catalog.value.data);
      else setError("Could not load books. Please reload to try again.");
      if (bookmarks.status === "fulfilled") { setSaved(bookmarks.value.data); setSavedReady(true); }
      else setSaveError("Could not load Saved Books. Please reload to try again.");
      setLoading(false);
    });
    return () => { live = false; };
  }, [demoMode]);
  useEffect(() => {
    if (demoMode) return;
    let live = true;
    async function refresh() {
      const [catalog, bookmarks] = await Promise.allSettled([API.get("/books"), API.get("/saved-books")]);
      if (!live) return;
      if (catalog.status === "fulfilled") { setBooks(catalog.value.data); setError(""); }
      if (bookmarks.status === "fulfilled") { setSaved(bookmarks.value.data); setSavedReady(true); setSaveError(""); }
    }
    window.addEventListener("bookspins:catalog-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => { live = false; window.removeEventListener("bookspins:catalog-updated", refresh); window.removeEventListener("focus", refresh); };
  }, [demoMode]);
  async function toggleSave(book) {
    if (!savedReady || pending.current.has(book.id)) return;
    pending.current.add(book.id); setBusy([...pending.current]);
    const exists = saved.some((item) => item.id === book.id);
    try {
      if (!demoMode) await API[exists ? "delete" : "post"](`/saved-books/${book.id}`);
      setSaved((items) => exists ? items.filter((item) => item.id !== book.id) : [book, ...items]);
      return exists ? "Removed from Saved." : demoMode ? "Saved for this demo session." : "Saved for later.";
    } finally { pending.current.delete(book.id); setBusy([...pending.current]); }
  }
  function viewed(id) { setHistory((ids) => { const next = recordView(ids, id); writeLocal(historyKey, next); return next; }); }
  function updateBook(book) {
    setBooks((items) => items.map((item) => item.id === book.id ? book : item));
    setSaved((items) => items.map((item) => item.id === book.id ? book : item));
  }
  function removeMissing(id) {
    setBooks((items) => items.filter((book) => book.id !== id));
    setHistory((ids) => { const next = ids.filter((item) => item !== id); writeLocal(historyKey, next); return next; });
    setSaved((items) => items.filter((book) => book.id !== id));
  }
  const recent = history.map((id) => books.find((book) => book.id === id)).filter(Boolean);
  return <DiscoveryContext.Provider value={{ books, saved, recent, loading, error, saveError, savedReady, busy, toggleSave, viewed, updateBook, removeMissing }}>{children}</DiscoveryContext.Provider>;
}
