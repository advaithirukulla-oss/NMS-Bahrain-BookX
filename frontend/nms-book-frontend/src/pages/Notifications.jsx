import { useEffect, useState } from "react";
import { FaBell, FaBook, FaCheckCircle, FaComment, FaTimesCircle } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { getDemoNotifications } from "../data/DemoData";

const ICONS = {
  book_approved: FaCheckCircle,
  book_rejected: FaTimesCircle,
  new_message: FaComment,
  new_request: FaBook,
};

function formatTime(value) {
  return new Intl.DateTimeFormat("en-BH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Notifications({ onBack }) {
  const { user, demoMode } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      const timeout = setTimeout(() => {
        setNotifications(getDemoNotifications());
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeout);
    }

    API.get(`/notifications/${user.id}`)
      .then((response) => setNotifications(response.data.notifications))
      .catch((requestError) => setError(requestError.response?.data?.detail || "Could not load notifications."))
      .finally(() => setIsLoading(false));
  }, [demoMode, user.id]);

  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Recent activity</p><h1>Notifications</h1></div>
        <FaBell aria-hidden="true" />
      </header>

      {isLoading && <p className="status-card">Loading notifications...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && notifications.length === 0 && <p className="empty-state">You are all caught up.</p>}

      <section className="notification-list">
        {notifications.map((notification) => {
          const Icon = ICONS[notification.type] || FaBell;
          return (
            <article className={`notification-card ${notification.type} ${notification.is_unread ? "unread" : ""}`} key={notification.id}>
              <div className="notification-icon"><Icon aria-hidden="true" /></div>
              <div><strong>{notification.title}</strong><p>{notification.message}</p><time>{formatTime(notification.created_at)}</time></div>
              {notification.is_unread && <span className="notification-dot" aria-label="Unread" />}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default Notifications;
