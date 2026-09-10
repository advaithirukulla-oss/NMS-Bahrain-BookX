import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
export default function SavedBooks() {
  const { saved, loading, saveError } = useDiscovery();
  return <div className="page"><header className="page-heading"><div><p className="eyebrow">Come back to a good book</p><h1>Saved Books</h1></div></header>{loading ? <p role="status">Loading Saved Books…</p> : saveError ? <p role="alert">{saveError}</p> : saved.length ? <div className="compact-book-list">{saved.map((book) => <BookCard key={book.id} book={book} />)}</div> : <p className="empty-state">Save books you want to come back to.</p>}</div>;
}
