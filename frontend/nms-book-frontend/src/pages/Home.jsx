import { useMemo } from "react";
import { FaArrowRight, FaBookOpen, FaCompass, FaMagic, FaPlus, FaStar } from "react-icons/fa";
import BookCard from "../components/BookCard";
import { useDiscovery } from "../context/DiscoveryContext";
import { recommend } from "../utils/discovery";
import { useUser } from "../context/UserContext";
import { formatGrade } from "../utils/grades";

function Home({ onNavigate }) {
  const { user } = useUser();
  const { books: catalog, saved, recent, loading, error, saveError } = useDiscovery();
  const books = catalog.filter((book) => book.status === "available" && book.owner_id !== user.id).sort((a, b) => b.id - a.id);
  const forYou = recommend(catalog, user, saved, recent);
  const gradeBooks = useMemo(() => books.filter((book) => String(book.grade) === String(user?.grade)).slice(0, 6), [books, user?.grade]);
  const freshBooks = books.slice(0, 6);
  const greeting = new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: false }).format(new Date()).slice(0, 2) < 12 ? "Good morning" : "Good afternoon";
  const renderBooks = (items) => <div className="home-book-row">{items.map((book) => <BookCard key={book.id} book={book} shelf />)}</div>;

  return <div className="page home-page">
    <section className="home-hero">
      <p className="eyebrow"><FaStar /> BookSpins for students</p>
      <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}.</h1>
      <p>What will you give a second spin today?</p>
      <div className="hero-actions"><button type="button" className="hero-primary" onClick={() => onNavigate("find")}><FaCompass /> Find a Book</button><button type="button" className="hero-secondary" onClick={() => onNavigate("give")}><FaPlus /> Give a Book</button></div>
      <span className="hero-orbit" aria-hidden="true"><FaBookOpen /></span>
    </section>
    <button className="ai-feature-card" type="button" onClick={() => onNavigate("ai")}><span className="ai-feature-icon"><FaMagic /></span><span><small>BOOKSPINS AI</small><strong>Not sure what you need?</strong><em>Describe a book and find your match <FaArrowRight /></em></span></button>
    {loading && <p role="status">Loading books…</p>}{error && <p role="alert">{error}</p>}{saveError && <p role="alert">{saveError}</p>}
    {forYou.length > 0 && <section className="home-section"><div className="section-heading"><h2>For You</h2></div><div className="home-book-row">{forYou.map(({ book, reason }) => <BookCard key={book.id} book={book} reason={reason} shelf />)}</div></section>}
    {freshBooks.length > 0 && <section className="home-section"><div className="section-heading"><div><p className="eyebrow">DISCOVER</p><h2>Recently added</h2></div><button type="button" onClick={() => onNavigate("find")}>See all <FaArrowRight /></button></div>{renderBooks(freshBooks)}</section>}
    {gradeBooks.length > 0 && <section className="home-section"><div className="section-heading"><div><p className="eyebrow">FOR YOUR GRADE</p><h2>{formatGrade(user?.grade)} shelf</h2></div><button type="button" onClick={() => onNavigate("find")}>Browse <FaArrowRight /></button></div>{renderBooks(gradeBooks)}</section>}
    {recent.length > 0 && <section className="home-section"><div className="section-heading"><h2>Recently Viewed</h2></div>{renderBooks(recent.slice(0, 6))}</section>}
    {saved.length > 0 && <section className="home-section"><div className="section-heading"><h2>Saved Books</h2><button type="button" onClick={() => onNavigate("saved")}>See all <FaArrowRight /></button></div>{renderBooks(saved.slice(0, 6))}</section>}
    <button className="back-link" type="button" onClick={() => onNavigate("saved")}>Open Saved Books</button>
  </div>;
}

export default Home;
