import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Mail,
  Pencil,
  UserPlus,
  UserCheck,
  Bell,
  CheckCheck,
  Clock,
  Search as SearchIcon,
  MessageCircle,
  Heart,
  Bookmark,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useCommunity } from "../context/Community";
import {
  Avatar,
  Badge,
  Empty,
  PageHeader,
  SearchBox,
  relative,
} from "../components/ui";
import { EntityForm, profileFields } from "../components/EntityForm";
import { PostCard, DiscussionCard } from "./Conversations";
import { googleLogin } from "../services/api";
export function Login() {
  const { demo, login, user, loading, authError, signInReady } = useCommunity();
  const navigate = useNavigate();
  const location = useLocation();
  const error = new URLSearchParams(location.search).get("error");
  useEffect(() => {
    if (user) navigate(location.state?.from || "/", { replace: true });
  }, [user, navigate, location.state]);
  return (
    <main className="login-page">
      <section className="login-story">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <GraduationCap size={24} />
          </span>
          <span>
            NSUT<span className="brand-light">Connect</span>
          </span>
        </Link>
        <div className="login-story-content">
          <Badge color="hero">MADE FOR YOUR CAMPUS</Badge>
          <h1>
            Your campus.
            <br />
            Your community.
          </h1>
          <p>
            The conversations that spark ideas.
            <br />
            The people who make campus feel like home.
            <br />
            Find them all, right here.
          </p>
          <div className="login-art" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="art-center">
              <GraduationCap size={52} />
            </span>
            <span className="art-node node-one">
              <MessageCircle size={27} />
            </span>
            <span className="art-node node-two">
              <BookIcon />
            </span>
            <span className="art-node node-three">
              <Sparkles size={26} />
            </span>
            <span className="art-note">
              <span className="status-dot" />A place to belong
            </span>
          </div>
          <div className="login-values">
            <span>
              <ShieldCheck size={18} />
              Campus-only community
            </span>
            <span>
              <Heart size={18} />
              Built around students
            </span>
          </div>
        </div>
        <small>An independent student community project.</small>
      </section>
      <section className="login-form-side">
        <div className="login-box">
          <span className="stat-icon blue large">
            <GraduationCap size={30} />
          </span>
          <p className="eyebrow">WELCOME TO NSUT CONNECT</p>
          <h2>
            A familiar place.
            <br />A fresh conversation.
          </h2>
          <p>Sign in to find your people and stay connected to campus life.</p>
          {error && (
            <div className="info-banner error">
              Sign-in failed: {error.replaceAll("_", " ")}. Please try again.
            </div>
          )}
          {!demo && authError && (
            <div className="info-banner error" role="alert">
              {authError}
            </div>
          )}
          <button
            className="google-button"
            disabled={loading || (!demo && !signInReady)}
            onClick={() => (demo ? login("aarav") : googleLogin())}
          >
            <span className="google-g" aria-hidden="true">
              G
            </span>
            {loading ? "Connecting…" : "Continue with Google"}
            <ArrowRight size={18} />
          </button>
          <div className="login-restriction">
            <LockKeyhole size={15} />
            <span>
              Live access is restricted to verified <strong>@nsut.ac.in</strong>{" "}
              Google accounts.
            </span>
          </div>
          {demo && (
            <div className="demo-login">
              <Badge color="orange">DEMO MODE</Badge>
              <p>
                Authentication is simulated. Explore as Aarav, a sample student,
                or try the administrator experience.
              </p>
              <div>
                <button
                  className="button secondary"
                  onClick={() => login("aarav")}
                >
                  Student demo
                </button>
                <button className="text-button" onClick={() => login("admin")}>
                  Admin demo
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          {!demo && authError && (
            <button
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
          <p className="login-footnote">
            Be kind. Stay curious. Make this community yours.
          </p>
        </div>
      </section>
    </main>
  );
}
function BookIcon() {
  return <Bookmark size={26} />;
}
export function Profile() {
  const { id } = useParams();
  const { data, user, following, toggleFollow, busy } = useCommunity();
  const profile = data.users.find((u) => u.id === (id || user!.id));
  const [tab, setTab] = useState("Posts");
  const [edit, setEdit] = useState(false);
  useEffect(() => setTab("Posts"), [id]);
  if (!profile || profile.status !== "ACTIVE")
    return (
      <Empty
        title="Profile unavailable"
        text="This member’s profile is not available."
      />
    );
  const own = profile.id === user!.id;
  const posts = data.posts.filter(
    (p) => !p.hidden && p.authorId === profile.id,
  );
  const threads = data.discussions.filter(
    (d) => !d.hidden && d.authorId === profile.id,
  );
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE MAKE THE CAMPUS"
        title={own ? "Your profile" : "Campus profile"}
        text="A little about the person behind the conversations."
      />
      <section className="card profile-card">
        <div className="profile-cover">
          <span>NSUT CONNECT</span>
          <div className="cover-circles" />
        </div>
        <div className="profile-main">
          <Avatar user={profile} size="xl" />
          <div className="profile-actions">
            {own ? (
              <button
                className="button secondary"
                onClick={() => setEdit(true)}
              >
                <Pencil size={15} />
                Edit profile
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => toggleFollow(profile.id)}
              >
                {following.includes(profile.id) ? (
                  <UserCheck size={16} />
                ) : (
                  <UserPlus size={16} />
                )}{" "}
                {following.includes(profile.id) ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <h1>{profile.name}</h1>
          <div className="profile-badges">
            <Badge>{profile.branch}</Badge>
            <Badge color="gray">
              Year {profile.year} · Semester {profile.semester}
            </Badge>
            {profile.role === "ADMIN" && (
              <Badge color="violet">Administrator</Badge>
            )}
          </div>
          <p>{profile.bio || "This student is still writing their story."}</p>
          <div className="profile-details">
            {own && (
              <span>
                <Mail size={15} />
                {profile.email}
              </span>
            )}
            <span>
              <Clock size={15} />
              Joined{" "}
              {new Date(profile.createdAt).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              })}
            </span>
            <span>
              <LockKeyhole size={15} />
              {profile.visibility === "CAMPUS"
                ? "Visible to campus members"
                : "Public profile"}
            </span>
          </div>
          <div className="profile-stats">
            <span>
              <strong>{posts.length}</strong> posts
            </span>
            <span>
              <strong>{threads.length}</strong> discussions
            </span>
            <span>
              <strong>
                {data.replies.filter((r) => r.authorId === profile.id).length}
              </strong>{" "}
              replies
            </span>
          </div>
        </div>
      </section>
      <div className="tabs profile-tabs">
        {[
          "Posts",
          "Discussions",
          ...(own ? ["Bookmarks"] : []),
          "Activity",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="stack">
        {tab === "Posts" && posts.map((p) => <PostCard key={p.id} post={p} />)}
        {tab === "Discussions" &&
          threads.map((t) => <DiscussionCard key={t.id} thread={t} />)}
        {tab === "Bookmarks" &&
          data.posts
            .filter((p) => !p.hidden && p.bookmarks.includes(user!.id))
            .map((p) => <PostCard key={p.id} post={p} />)}
        {tab === "Activity" &&
          [
            ...posts.map((p) => ({
              id: p.id,
              text: "Shared an update in " + p.category,
              to: "/feed/" + p.id,
              date: p.createdAt,
            })),
            ...threads.map((t) => ({
              id: t.id,
              text: "Started “" + t.title + "”",
              to: "/discussions/" + t.id,
              date: t.createdAt,
            })),
            ...data.replies
              .filter((r) => r.authorId === profile.id)
              .map((r) => ({
                id: r.id,
                text: "Added a reply to a discussion",
                to: "/discussions/" + r.discussionId,
                date: r.createdAt,
              })),
          ]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => (
              <Link key={a.id} className="card activity-row" to={a.to}>
                <span className="stat-icon blue">
                  <MessageCircle size={18} />
                </span>
                <span>
                  {a.text}
                  <small>{relative(a.date)}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
        {((tab === "Posts" && !posts.length) ||
          (tab === "Discussions" && !threads.length) ||
          (tab === "Bookmarks" &&
            !data.posts.some(
              (p) => !p.hidden && p.bookmarks.includes(user!.id),
            )) ||
          (tab === "Activity" &&
            !posts.length &&
            !threads.length &&
            !data.replies.some((r) => r.authorId === profile.id))) && (
          <Empty
            title={`No ${tab.toLowerCase()} yet`}
            text={
              tab === "Bookmarks"
                ? "Save a post with the bookmark button to find it here."
                : "Your contributions will appear here as you join in."
            }
          />
        )}
      </div>
      {edit && (
        <EntityForm
          title="Edit your profile"
          fields={profileFields}
          initial={{
            name: profile.name,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            branch: profile.branch,
            year: profile.year,
            semester: profile.semester,
            section: profile.section,
            visibility: profile.visibility,
          }}
          action="profile.edit"
          close={() => setEdit(false)}
        />
      )}
    </>
  );
}
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  return i < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}
export function Search() {
  const { data } = useCommunity();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const type = params.get("type") || "All";
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const groups = [
    {
      label: "Posts",
      items: data.posts
        .filter((p) => !p.hidden && match(p.text))
        .map((p) => ({
          id: p.id,
          title: p.text.slice(0, 140),
          sub: `${p.category} · ${relative(p.createdAt)}`,
          to: `/feed/${p.id}`,
        })),
    },
    {
      label: "Discussions",
      items: data.discussions
        .filter(
          (d) =>
            !d.hidden && match(d.title + " " + d.text + " " + d.tags.join(" ")),
        )
        .map((d) => ({
          id: d.id,
          title: d.title,
          sub: d.tags.join(" · "),
          to: `/discussions/${d.id}`,
        })),
    },
    {
      label: "Announcements",
      items: data.announcements
        .filter(
          (a) => a.status === "PUBLISHED" && match(a.title + " " + a.text),
        )
        .map((a) => ({
          id: a.id,
          title: a.title,
          sub: a.authority,
          to: `/announcements/${a.id}`,
        })),
    },
    {
      label: "Users",
      items: data.users
        .filter(
          (u) =>
            u.status === "ACTIVE" &&
            match(u.name + " " + u.branch + " " + u.bio),
        )
        .map((u) => ({
          id: u.id,
          title: u.name,
          sub: `${u.branch} · Year ${u.year}`,
          to: `/profile/${u.id}`,
        })),
    },
  ].filter((g) => type === "All" || g.label === type);
  const count = groups.reduce((sum, g) => sum + g.items.length, 0);
  return (
    <>
      <PageHeader
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="Search campus"
        text="Find a conversation, a resource, or someone new."
      />
      <SearchBox
        value={q}
        onChange={(v) => setParams({ q: v, type }, { replace: true })}
        placeholder="Search posts, discussions, announcements, or people…"
      />
      <div className="chips search-tabs">
        {["All", "Posts", "Discussions", "Announcements", "Users"].map((t) => (
          <button
            key={t}
            className={type === t ? "selected" : ""}
            onClick={() => setParams({ q, type: t })}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="result-count">
        {count} results {q && <>for “{q}”</>}
      </p>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.label} className="search-group">
            <h2>
              {g.label}
              <Badge color="gray">{g.items.length}</Badge>
            </h2>
            <div className="card">
              {g.items.map((item) => (
                <Link className="search-result" key={item.id} to={item.to}>
                  <span className="stat-icon blue">
                    <SearchIcon size={18} />
                  </span>
                  <div>
                    <strong>
                      <Highlight text={item.title} query={q} />
                    </strong>
                    <small>{item.sub}</small>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      {!count && (
        <Empty
          title="No matches yet"
          text="Try a broader keyword or a different category."
        />
      )}
    </>
  );
}
export function Notifications() {
  const { data, user, mutate, busy } = useCommunity();
  const navigate = useNavigate();
  const [tab, setTab] = useState("All");
  const notifications = data.notifications
    .filter((n) => n.userId === user!.id && (tab !== "Unread" || !n.read))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeader
        eyebrow="YOUR CAMPUS CONNECTIONS"
        title="Notifications"
        text="Keep up with the conversations that include you."
        action={
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              mutate(
                "notification.readAll",
                {},
                "All notifications marked as read",
              )
            }
          >
            <CheckCheck size={17} />
            Mark all as read
          </button>
        }
      />
      <div className="tabs notification-tabs">
        {["All", "Unread"].map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="card notification-list">
        {notifications.map((n) => (
          <div
            className={`notification-row ${!n.read ? "unread" : ""}`}
            key={n.id}
          >
            <span className="stat-icon blue">
              <Bell size={20} />
            </span>
            <button
              className="notification-body"
              onClick={async () => {
                if (await mutate("notification.read", { id: n.id }))
                  navigate(n.link);
              }}
            >
              <strong>{n.text}</strong>
              <small>{relative(n.createdAt)}</small>
            </button>
            {!n.read && (
              <button
                aria-label="Mark notification as read"
                className="icon-button"
                disabled={busy}
                onClick={() => mutate("notification.read", { id: n.id })}
              >
                <span className="unread-dot" />
              </button>
            )}
          </div>
        ))}
        {!notifications.length && (
          <Empty
            title="A quiet moment"
            text="Replies, comments, and campus updates will show up here."
          />
        )}
      </div>
    </>
  );
}
