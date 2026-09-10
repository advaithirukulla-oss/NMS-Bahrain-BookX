import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
export default function Take() {
  const { books, loading, error } = useDiscovery();
  return <div className="page"><header className="page-heading"><h1>Book catalogue</h1></header>{loading && <p role="status">Loading books…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && !books.length && <p className="empty-state">No books are available yet.</p>}<div className="compact-book-list">{books.map((book) => <BookCard key={book.id} book={book} />)}</div></div>;
}
