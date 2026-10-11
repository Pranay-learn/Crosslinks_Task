import { useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Megaphone,
  CalendarDays,
  UserRound,
  ShieldCheck,
  GraduationCap,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ArrowRight,
  ChevronsUpDown,
} from "lucide-react";
import { useCommunity } from "./context/Community";
import { Avatar, Badge, Empty } from "./components/ui";
import {
  CampusSidebar,
  Dashboard,
  Announcements,
  AnnouncementDetail,
  Timetable,
  campusNow,
} from "./pages/Campus";
import { Feed, Discussions, ThreadDetail } from "./pages/Conversations";
import {
  Login,
  Profile,
  Search as SearchPage,
  Notifications,
} from "./pages/People";
import { Admin } from "./pages/Admin";
const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/feed", label: "Campus feed", icon: MessageSquare },
  { to: "/discussions", label: "Discussions", icon: MessagesSquare },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/profile", label: "My profile", icon: UserRound },
  { to: "/search", label: "Search campus", icon: Search },
];
function Shell() {
  const {
    user,
    loading,
    demo,
    theme,
    toggleTheme,
    logout,
    data,
    login,
    toast,
  } = useCommunity();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  if (loading)
    return (
      <div className="app-loading">
        <GraduationCap size={40} />
        <h2>Connecting to your campus…</h2>
        <div className="loading-bar" />
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  const unread = data.notifications.filter(
    (n) => n.userId === user.id && !n.read,
  ).length;
  const title =
    navigation.find((n) => n.to !== "/" && location.pathname.startsWith(n.to))
      ?.label ||
    (location.pathname.startsWith("/admin")
      ? "Admin workspace"
      : location.pathname.startsWith("/search")
        ? "Search campus"
        : location.pathname.startsWith("/notifications")
          ? "Notifications"
          : "Dashboard");
  const wide =
    location.pathname.startsWith("/timetable") ||
    location.pathname.startsWith("/admin");
  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${menu ? "visible" : ""}`}
        onClick={() => setMenu(false)}
      />
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            <GraduationCap size={23} />
          </span>
          <span>
            NSUT<span className="brand-light">Connect</span>
          </span>
        </Link>
        <button
          className="sidebar-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">THE CAMPUS COMMON ROOM</div>
        <nav>
          {navigation.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              onClick={() => setMenu(false)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.to === "/announcements" &&
                data.announcements.some(
                  (a) =>
                    a.status === "PUBLISHED" && !a.readBy.includes(user.id),
                ) && <span className="nav-dot" />}
            </NavLink>
          ))}
          {user.role === "ADMIN" && (
            <NavLink to="/admin" onClick={() => setMenu(false)}>
              <ShieldCheck size={19} />
              Admin workspace
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-invite">
            <span>
              <SparkleIcon />
            </span>
            <strong>Your people are here.</strong>
            <p>
              Say hello. Ask a question.
              <br />
              Start something good.
            </p>
            <Link to="/discussions" onClick={() => setMenu(false)}>
              Join the conversation
              <ArrowRight size={14} />
            </Link>
          </div>
          {demo && (
            <div className="demo-indicator">
              <Badge color="orange">DEMO</Badge>
              <span>Fictional campus content</span>
            </div>
          )}
          <Link to="/profile" className="sidebar-user">
            <Avatar user={user} />
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.branch} · Year {user.year}
              </small>
            </span>
          </Link>
          {demo && (
            <button
              className="switch-role"
              onClick={() => {
                login(user.role === "ADMIN" ? "aarav" : "admin");
                toast("Switched simulated demo role");
                navigate("/");
              }}
            >
              <ChevronsUpDown size={14} />
              Switch demo role
            </button>
          )}
          <button className="logout-button" onClick={() => logout()}>
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>
              Community<span className="breadcrumb-slash">/</span>
              <strong>{title}</strong>
            </span>
          </div>
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?q=${encodeURIComponent(query)}`);
              setQuery("");
            }}
          >
            <Search size={16} />
            <input
              aria-label="Global search"
              placeholder="Search campus…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <Link
              className="icon-button notification-link"
              to="/notifications"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={20} />
              {unread > 0 && <span />}
            </Link>
            <Link to="/profile" aria-label="Your profile">
              <Avatar user={user} size="sm" />
            </Link>
          </div>
        </header>
        <div className={`content-layout ${wide ? "wide" : ""}`}>
          <main className="main-content">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
            <footer className="page-footer">
              <span>Thoughtfully made for the NSUT community.</span>
              <span>
                {campusNow().getFullYear()} ·{" "}
                {demo ? "Demo experience" : "Campus community"}
              </span>
            </footer>
          </main>
          {!wide && <CampusSidebar />}
        </div>
      </div>
    </div>
  );
}
function SparkleIcon() {
  return <GraduationCap size={19} />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="feed" element={<Feed />} />
        <Route path="feed/:id" element={<Feed />} />
        <Route path="discussions" element={<Discussions />} />
        <Route path="discussions/:id" element={<ThreadDetail />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="announcements/:id" element={<AnnouncementDetail />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/:id" element={<Profile />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
        <Route
          path="*"
          element={
            <Empty
              title="Page not found"
              action={
                <Link className="button" to="/">
                  Back to campus
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
