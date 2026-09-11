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
  { key: "completed_requests", label: "Completed Exchanges", icon: FaCheckCircle },
  { key: "declined_requests", label: "Declined Requests", icon: FaClock },
  { key: "cancelled_requests", label: "Cancelled Requests", icon: FaClock },
  { key: "given_books", label: "Books Given", icon: FaBook },
  { key: "total_users", label: "Total Users", icon: FaUsers },
  { key: "total_books", label: "Total Books", icon: FaBook },
  { key: "total_requests", label: "Total Requests", icon: FaExchangeAlt },
  { key: "total_messages", label: "Total Messages", icon: FaComments },
  { key: "available_books", label: "Available Books", icon: FaBookOpen },
  { key: "reserved_books", label: "Reserved Books", icon: FaLock },
  { key: "pending_requests", label: "Pending Requests", icon: FaClock },
  { key: "approved_requests", label: "Accepted Exchanges", icon: FaCheckCircle },
  { key: "open_reports", label: "Open Reports", icon: FaClock },
  { key: "hidden_books", label: "Hidden Books", icon: FaBook },
  { key: "suspended_users", label: "Suspended Users", icon: FaLock },
];

function AdminDashboard({ onBack }) {
  const { demoMode } = useUser();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);

  const loadReports = () => API.get("/admin/reports").then(({ data }) => setReports(data)).catch(() => {});

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
    loadReports();
  }, [demoMode]);

  async function updateReport(id, status) { await API.patch(`/admin/reports/${id}`, { status }); loadReports(); }
  async function moderateBook(id, status) { await API.patch(`/admin/books/${id}/moderation`, { status }); loadReports(); }
  async function moderateUser(id, status) { await API.patch(`/admin/users/${id}/status`, { status }); loadReports(); }

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
      {!demoMode && <section className="moderation-queue" aria-label="Moderation queue"><h2>Moderation queue</h2>{reports.filter((report) => report.status === "open").length === 0 && <p className="empty-state">No open reports.</p>}{reports.filter((report) => report.status === "open").map((report) => <article className="moderation-card" key={report.id}><div><strong>{report.type === "book" ? "Book report" : "User report"}: {report.reason.replaceAll("_", " ")}</strong><p>{report.book?.title || report.reported_user?.name || "Unavailable target"}</p><small>Reported by {report.reporter.name} · {new Date(report.created_at).toLocaleString()}</small>{report.note && <p className="moderation-note">Note: {report.note}</p>}</div><div className="moderation-controls"><button type="button" onClick={() => updateReport(report.id, "reviewed")}>Mark reviewed</button><button type="button" onClick={() => updateReport(report.id, "dismissed")}>Dismiss</button>{report.book && <button type="button" onClick={() => moderateBook(report.book.id, report.book.moderation_status === "hidden" ? "active" : "hidden")}>{report.book.moderation_status === "hidden" ? "Restore book" : "Hide book"}</button>}{report.reported_user && <button type="button" onClick={() => moderateUser(report.reported_user.id, "suspended")}>Suspend user</button>}</div></article>)}</section>}
    </div>
  );
}

export default AdminDashboard;
