import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FaUser, FaBookOpen, FaPlusCircle, FaSearch, FaComments } from "react-icons/fa";
import API from "./api/api";
import { useUser } from "./context/UserContext";
import { getDemoNotifications } from "./data/DemoData";
import Login from "./pages/Login";
import Register from "./pages/Register";

const Profile = lazy(() => import("./pages/Profile"));
const Take = lazy(() => import("./pages/Take"));
const Give = lazy(() => import("./pages/Give"));
const Find = lazy(() => import("./pages/Find"));
const Messages = lazy(() => import("./pages/Messages"));
const AIBookFinder = lazy(() => import("./pages/AIBookFinder"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Terms = lazy(() => import("./pages/Terms"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const MyBooks = lazy(() => import("./pages/MyBooks"));
const Notifications = lazy(() => import("./pages/Notifications"));

const NAV_ITEMS = [
  { id: "profile", label: "Profile", icon: FaUser },
  { id: "take", label: "Take", icon: FaBookOpen },
  { id: "give", label: "Give", icon: FaPlusCircle },
  { id: "find", label: "Find", icon: FaSearch },
  { id: "messages", label: "DMs", icon: FaComments },
];

function PageFallback() {
  return (
    <div className="page" aria-live="polite">
      <p className="loading-label">Loading NMS Bahrain BookX...</p>
      <div className="skeleton-header">
        <span />
        <div>
          <span />
          <span />
        </div>
      </div>
      <div className="skeleton-card" />
      <div className="skeleton-card short" />
    </div>
  );
}

function App() {
  const { demoMode, isAuthenticated, user } = useUser();
  const [authMode, setAuthMode] = useState("login");
  const [activeTab, setActiveTab] = useState("profile");
  const [notificationCount, setNotificationCount] = useState(0);

  const navigate = useCallback((tab) => setActiveTab(tab), []);

  useEffect(() => {
    if (!isAuthenticated) {
      const timeout = setTimeout(() => setNotificationCount(0), 0);
      return () => clearTimeout(timeout);
    }

    if (demoMode) {
      const timeout = setTimeout(() => {
        setNotificationCount(getDemoNotifications().filter((item) => item.is_unread).length);
      }, 0);
      return () => clearTimeout(timeout);
    }

    const loadNotificationCount = () => {
      API.get(`/notifications/${user.id}`)
        .then((response) => setNotificationCount(response.data.unread_count))
        .catch(() => setNotificationCount(0));
    };

    const timeout = setTimeout(loadNotificationCount, 0);
    const interval = setInterval(loadNotificationCount, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [demoMode, isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated) return undefined;

    const timeout = setTimeout(() => setActiveTab("profile"), 0);
    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  const page = useMemo(() => {
    if (activeTab === "profile") return <Profile notificationCount={notificationCount} onNavigate={navigate} />;
    if (activeTab === "take") return <Take />;
    if (activeTab === "give") return <Give />;
    if (activeTab === "find") return <Find />;
    if (activeTab === "messages") return <Messages />;
    if (activeTab === "ai") return <AIBookFinder onBack={() => navigate("profile")} />;
    if (activeTab === "admin") return <AdminDashboard onBack={() => navigate("profile")} />;
    if (activeTab === "leaderboard") return <Leaderboard onBack={() => navigate("profile")} />;
    if (activeTab === "terms") return <Terms onBack={() => navigate("profile")} />;
    if (activeTab === "requests") return <RequestsPage onBack={() => navigate("profile")} />;
    if (activeTab === "my-books") return <MyBooks onBack={() => navigate("profile")} />;
    if (activeTab === "notifications") return <Notifications onBack={() => navigate("profile")} />;
    return <Profile notificationCount={notificationCount} onNavigate={navigate} />;
  }, [activeTab, navigate, notificationCount]);

  if (!isAuthenticated) {
    if (authMode === "login") {
      return <Login onRegisterClick={() => setAuthMode("register")} />;
    }

    return <Register onLoginClick={() => setAuthMode("login")} />;
  }

  return (
    <div className="app">
      <main className="page-content">
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button type="button" onClick={() => navigate(item.id)} className={activeTab === item.id ? "active" : ""} key={item.id}>
              <span className="nav-icon-wrap">
                <Icon />
                {item.id === "profile" && notificationCount > 0 && <span className="nav-badge">{notificationCount}</span>}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
