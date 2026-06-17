import { useEffect, useState } from "react";
import {
  FaBook,
  FaBookOpen,
  FaCheckCircle,
  FaClock,
  FaComments,
  FaExchangeAlt,
  FaLock,
  FaUsers,
} from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoAdminStats } from "../data/DemoData";

const STAT_ITEMS = [
  { key: "total_users", label: "Total Users", icon: FaUsers },
  { key: "total_books", label: "Total Books", icon: FaBook },
  { key: "total_requests", label: "Total Requests", icon: FaExchangeAlt },
  { key: "total_messages", label: "Total Messages", icon: FaComments },
  { key: "available_books", label: "Available Books", icon: FaBookOpen },
  { key: "reserved_books", label: "Reserved Books", icon: FaLock },
  { key: "pending_requests", label: "Pending Requests", icon: FaClock },
  { key: "approved_requests", label: "Approved Requests", icon: FaCheckCircle },
];

function AdminDashboard({ onBack }) {
  const { demoMode } = useUser();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) {
      const timeout = setTimeout(() => setStats(getDemoAdminStats()), 0);
      return () => clearTimeout(timeout);
    }
    API.get("/admin/stats")
      .then((response) => setStats(response.data))
      .catch((requestError) => {
        setError(requestError.response?.data?.detail || "Could not load admin statistics.");
      });
  }, [demoMode]);

  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Admin overview</p><h1>Dashboard</h1></div>
        <FaLock aria-hidden="true" />
      </header>

      {!stats && !error && <p className="status-card">Loading platform statistics...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}

      {stats && (
        <section className="admin-stats-grid" aria-label="Platform statistics">
          {STAT_ITEMS.map(({ key, label, icon: Icon }) => (
            <article className="admin-stat-card" key={key}>
              <Icon aria-hidden="true" /><strong>{stats[key] ?? 0}</strong><span>{label}</span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default AdminDashboard;
