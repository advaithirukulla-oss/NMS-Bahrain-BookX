import { useEffect, useMemo, useState } from "react";
import { FaArrowRight, FaBookOpen, FaCompass, FaMagic, FaPlus, FaStar } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_BOOKS } from "../data/DemoData";
import { getBookImageUrl } from "../utils/bookImages";
import { formatGrade } from "../utils/grades";

function Home({ onNavigate }) {
  const { demoMode, user } = useUser();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const response = demoMode ? { data: DEMO_BOOKS } : await API.get("/books");
        if (live) setBooks(response.data.filter((book) => book.status === "available"));
      } catch { if (live) setBooks([]); }
      finally { if (live) setLoading(false); }
    };
    load();
    return () => { live = false; };
  }, [demoMode]);

  const gradeBooks = useMemo(() => books.filter((book) => String(book.grade) === String(user?.grade)).slice(0, 6), [books, user?.grade]);
  const freshBooks = books.slice(0, 6);
  const greeting = new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: false }).format(new Date()).slice(0, 2) < 12 ? "Good morning" : "Good afternoon";
  const renderBooks = (items) => loading ? <div className="home-book-row skeleton-row"><span /><span /><span /></div> : items.length ? <div className="home-book-row">{items.map((book) => <button className="home-book" type="button" onClick={() => onNavigate("take")} key={book.id}><span className="home-cover">{book.image_url ? <img src={getBookImageUrl(book.image_url)} alt={`${book.title} cover`} /> : <FaBookOpen />}</span><strong>{book.title}</strong><small>{book.subject} · {formatGrade(book.grade)}</small></button>)}</div> : <div className="home-empty">No books here yet. Be the first to give one a second spin.</div>;

  return <div className="page home-page">
    <section className="home-hero">
      <p className="eyebrow"><FaStar /> BookSpins for students</p>
      <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}.</h1>
      <p>What will you give a second spin today?</p>
      <div className="hero-actions"><button type="button" className="hero-primary" onClick={() => onNavigate("find")}><FaCompass /> Find a Book</button><button type="button" className="hero-secondary" onClick={() => onNavigate("give")}><FaPlus /> Give a Book</button></div>
      <span className="hero-orbit" aria-hidden="true"><FaBookOpen /></span>
    </section>
    <button className="ai-feature-card" type="button" onClick={() => onNavigate("ai")}><span className="ai-feature-icon"><FaMagic /></span><span><small>BOOKSPINS AI</small><strong>Not sure what you need?</strong><em>Describe a book and find your match <FaArrowRight /></em></span></button>
    <section className="home-section"><div className="section-heading"><div><p className="eyebrow">DISCOVER</p><h2>Recently added</h2></div><button type="button" onClick={() => onNavigate("find")}>See all <FaArrowRight /></button></div>{renderBooks(freshBooks)}</section>
    <section className="home-section"><div className="section-heading"><div><p className="eyebrow">FOR YOUR GRADE</p><h2>{formatGrade(user?.grade)} shelf</h2></div><button type="button" onClick={() => onNavigate("find")}>Browse <FaArrowRight /></button></div>{renderBooks(gradeBooks)}</section>
  </div>;
}

export default Home;
