import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FaUser, FaBookOpen, FaPlusCircle, FaSearch, FaClipboardList, FaBell } from "react-icons/fa";
import API from "./api/api";
import { useUser } from "./context/UserContext";
import { getDemoNotifications } from "./data/DemoData";
import { DiscoveryProvider } from "./context/DiscoveryContext";
import Login from "./pages/Login";
import Register from "./pages/Register";

const SavedBooks = lazy(() => import("./pages/SavedBooks"));
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
const Home = lazy(() => import("./pages/Home"));

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: FaBookOpen },
  { id: "find", label: "Find", icon: FaSearch },
  { id: "give", label: "Give", icon: FaPlusCircle },
  { id: "requests", label: "Requests", icon: FaClipboardList },
  { id: "profile", label: "Profile", icon: FaUser },
];

function PageFallback() {
  return (
    <div className="page" aria-live="polite">
      <p className="loading-label">Loading BookSpins...</p>
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
  const [activeTab, setActiveTab] = useState("home");
  const [destination, setDestination] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);

  const navigate = useCallback((tab, detail = null) => { setDestination(detail); setActiveTab(tab); }, []);

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

    const timeout = setTimeout(() => setActiveTab("home"), 0);
    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  const page = useMemo(() => {
    if (activeTab === "saved") return <SavedBooks />;
    if (activeTab === "home") return <Home onNavigate={navigate} />;
    if (activeTab === "profile") return <Profile notificationCount={notificationCount} onNavigate={navigate} />;
    if (activeTab === "take") return <Take />;
    if (activeTab === "give") return <Give />;
    if (activeTab === "find") return <Find />;
    if (activeTab === "messages") return <Messages onNavigate={navigate} initialConversation={destination?.conversation} />;
    if (activeTab === "ai") return <AIBookFinder onBack={() => navigate("profile")} />;
    if (activeTab === "admin") return <AdminDashboard onBack={() => navigate("profile")} />;
    if (activeTab === "leaderboard") return <Leaderboard onBack={() => navigate("profile")} />;
    if (activeTab === "terms") return <Terms onBack={() => navigate("profile")} />;
    if (activeTab === "requests") return <RequestsPage onNavigate={navigate} selectedRequestId={destination?.request_id} onBack={() => navigate("profile")} />;
    if (activeTab === "my-books") return <MyBooks onNavigate={navigate} selectedBookId={destination?.book_id} onBack={() => navigate("profile")} />;
    if (activeTab === "notifications") return <Notifications onNavigate={navigate} onBack={() => navigate("profile")} />;
    return <Home onNavigate={navigate} />;
  }, [activeTab, navigate, notificationCount, destination]);

  if (!isAuthenticated) {
    if (authMode === "login") {
      return <Login onRegisterClick={() => setAuthMode("register")} />;
    }

    return <Register onLoginClick={() => setAuthMode("login")} />;
  }

  return (
    <DiscoveryProvider><div className="app" data-version="2.2">
      <header className="app-topbar">
        <button className="brand-lockup" type="button" onClick={() => navigate("home")} aria-label="Go to BookSpins home">
          <span className="brand-mark"><FaBookOpen aria-hidden="true" /></span>
          <span>BookSpins</span>
        </button>
        <div className="topbar-actions"><span className="app-status">Giving Books a Second Spin</span><button type="button" onClick={() => navigate("notifications")} aria-label="View notifications" className="topbar-icon"><FaBell />{notificationCount > 0 && <b>{notificationCount}</b>}</button></div>
      </header>
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
              {item.id === "requests" && notificationCount > 0 && <span className="nav-badge">{notificationCount}</span>}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div></DiscoveryProvider>
  );
}

export default App;
