import { useEffect, useState } from "react";
import {
  FaBell,
  FaBook,
  FaBookOpen,
  FaChartBar,
  FaClipboardList,
  FaComments,
  FaHandPaper,
  FaLock,
  FaPlusCircle,
  FaRobot,
  FaSearch,
  FaSignOutAlt,
  FaStar,
  FaToggleOff,
  FaToggleOn,
  FaTrophy,
  FaUserCircle,
} from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDailyBookQuote } from "../data/bookQuotes";
import { getDemoDashboard } from "../data/DemoData";
import "./Profile.css";

function Profile({ notificationCount, onNavigate }) {
  const { demoMode, user, logout, toggleDemoMode, updateUser } = useUser();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");

      if (demoMode) {
        setDashboard(getDemoDashboard());
        setIsLoading(false);
        return;
      }

      try {
        const response = await API.get(`/dashboard/${user.id}`);
        if (isMounted) {
          setDashboard(response.data);
          updateUser({
            name: response.data.name,
            email: response.data.email ?? user.email,
            grade: response.data.grade ?? user.grade,
            section: response.data.section ?? user.section,
            trust_points: response.data.trust_points,
          });
        }
      } catch (requestError) {
        if (isMounted) setError(requestError.response?.data?.detail || "Could not load dashboard details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDashboard();
    return () => { isMounted = false; };
  }, [demoMode, updateUser, user.email, user.grade, user.id, user.section]);

  const profile = { ...user, ...dashboard };
  const chartMaximum = Math.max(profile.books_posted ?? 0, profile.books_requested ?? 0, profile.books_approved ?? 0, 1);
  const chartItems = [
    { label: "Posted", value: profile.books_posted ?? 0 },
    { label: "Requested", value: profile.books_requested ?? 0 },
    { label: "Approved", value: profile.books_approved ?? 0 },
  ];
  const dailyQuote = getDailyBookQuote();

  return (
    <div className="page profile-page">
      <header className="profile-header">
        <FaUserCircle className="profile-avatar" aria-hidden="true" />
        <div><p className="eyebrow">NMS Bahrain BookX</p><h1>{profile.name}</h1><p>{demoMode ? "Demo Student" : profile.email}</p></div>
      </header>

      <section className="daily-quote-card" aria-label="Daily book quote">
        <p className="eyebrow">Daily Book Quote</p>
        <blockquote>{dailyQuote}</blockquote>
      </section>

      <button className={`demo-toggle ${demoMode ? "enabled" : ""}`} type="button" onClick={toggleDemoMode}>
        {demoMode ? <FaToggleOn /> : <FaToggleOff />}
        <span><strong>Demo Mode {demoMode ? "ON" : "OFF"}</strong><small>Use sample project data</small></span>
      </button>

      <section className="profile-details" aria-label="Student details">
        <div><span>Grade</span><strong>{profile.grade}</strong></div>
        <div><span>Section</span><strong>{profile.section}</strong></div>
      </section>

      {isLoading ? <p className="status-card">Loading your dashboard...</p> : error ? (
        <p className="status-card error" role="alert">{error}</p>
      ) : (
        <>
          <section className="stats-grid profile-stats" aria-label="Dashboard statistics">
            <article className="stat-card"><FaBook /><strong>{profile.books_posted ?? 0}</strong><span>Books Posted</span></article>
            <article className="stat-card"><FaHandPaper /><strong>{profile.books_requested ?? 0}</strong><span>Requested</span></article>
            <article className="stat-card"><FaClipboardList /><strong>{profile.books_approved ?? 0}</strong><span>Approved</span></article>
            <article className="stat-card"><FaStar /><strong>{profile.trust_points ?? 0}</strong><span>Trust Points</span></article>
          </section>

          <section className="analytics-card">
            <h2><FaChartBar /> Exchange Activity</h2>
            {chartItems.map((item) => (
              <div className="chart-row" key={item.label}>
                <span>{item.label}</span>
                <div className="chart-track"><span style={{ width: `${Math.max((item.value / chartMaximum) * 100, item.value ? 12 : 0)}%` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="quick-action-grid" aria-label="Quick access">
        <button type="button" onClick={() => onNavigate("give")}><FaPlusCircle /><span>Give a Book</span></button>
        <button type="button" onClick={() => onNavigate("find")}><FaSearch /><span>Find Books</span></button>
        <button type="button" onClick={() => onNavigate("requests")}><FaClipboardList /><span>My Requests</span></button>
        <button type="button" onClick={() => onNavigate("my-books")}><FaBook /><span>My Books</span></button>
        <button type="button" onClick={() => onNavigate("messages")}><FaComments /><span>Messages</span></button>
        <button type="button" onClick={() => onNavigate("ai")}><FaRobot /><span>AI Book Finder</span></button>
        <button type="button" onClick={() => onNavigate("notifications")}><FaBell /><span>Notifications</span></button>
        <button type="button" onClick={() => onNavigate("leaderboard")}><FaTrophy /><span>Leaderboard</span></button>
        <button type="button" onClick={() => onNavigate("terms")}><FaBookOpen /><span>Terms</span></button>
      </section>

      <section className="profile-links" aria-label="Manage books and requests">
        <h2>Manage</h2>
        <button type="button" onClick={() => onNavigate("notifications")}>
          <FaBell /><span><strong>Notifications {notificationCount > 0 && <b className="inline-badge">{notificationCount}</b>}</strong><small>Approvals, messages, and requests</small></span>
        </button>
        <button type="button" onClick={() => onNavigate("requests")}><FaClipboardList /><span><strong>My Requests</strong><small>Track and cancel book requests</small></span></button>
        <button type="button" onClick={() => onNavigate("my-books")}><FaBook /><span><strong>My Books</strong><small>Approve or reject incoming requests</small></span></button>
      </section>

      <section className="profile-links" aria-label="More features">
        <h2>Explore</h2>
        <button type="button" onClick={() => onNavigate("ai")}><FaRobot /><span><strong>AI Book Finder</strong><small>Find the closest book match</small></span></button>
        <button type="button" onClick={() => onNavigate("leaderboard")}><FaTrophy /><span><strong>Leaderboard</strong><small>See the top trusted students</small></span></button>
        <button type="button" onClick={() => onNavigate("terms")}><FaClipboardList /><span><strong>Terms &amp; Conditions</strong><small>Read the exchange rules</small></span></button>
        {profile.role === "admin" && <button type="button" onClick={() => onNavigate("admin")}><FaLock /><span><strong>Admin Dashboard</strong><small>Review platform activity</small></span></button>}
      </section>

      <button className="logout-btn" type="button" onClick={logout}><FaSignOutAlt /> Logout</button>
    </div>
  );
}

export default Profile;
