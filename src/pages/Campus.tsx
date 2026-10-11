import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Bell,
  MapPin,
  Plus,
  Pin,
  Check,
  Megaphone,
  GraduationCap,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { Announcement } from "../../shared/model";
import { colorName } from "../lib/colors";
import { useCommunity } from "../context/Community";
import {
  Badge,
  Empty,
  PageHeader,
  SearchBox,
  SectionTitle,
  dayNames,
  relative,
} from "../components/ui";
import { PostCard } from "./Conversations";
import { announcementCategories, branches } from "../data/demo";
import { EntityForm, announcementFields } from "../components/EntityForm";
export function campusNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
}
function CampusIllustration() {
  return (
    <svg
      className="campus-illustration"
      viewBox="0 0 310 210"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="238" cy="52" r="28" fill="#4783f1" opacity=".4" />
      <path
        d="M32 177H290M45 177V89H113V177M54 88L79 64L106 88M117 177V59H228V177M128 59L173 26L218 59M229 177V108H275V177"
        stroke="#8db5ff"
        strokeWidth="2"
      />
      <path
        d="M126 68H220M136 76V122M155 76V122M174 76V122M193 76V122M212 76V122M131 135H216M132 142H215M132 150H215M132 158H215M58 100H74V117H58V100ZM85 100H101V117H85V100ZM59 132H74V149H59V132ZM85 132H101V149H85V132ZM239 123H265M239 143H265"
        stroke="#8db5ff"
        strokeWidth="2"
        opacity=".65"
      />
      <path d="M162 177V144H185V177" stroke="#C6D9FF" strokeWidth="2" />
      <path
        d="M22 176V141M11 151C5 139 16 126 23 127C41 131 42 146 30 155"
        stroke="#68bdb1"
        strokeWidth="2"
      />
      <circle cx="286" cy="93" r="3" fill="#bdd2fb" />
      <path
        d="M287 28V38M282 33H292M43 32V42M38 37H48"
        stroke="#8db5ff"
        strokeWidth="2"
      />
    </svg>
  );
}
export function AnnouncementCard({ item }: { item: Announcement }) {
  const { user, mutate, busy, demo } = useCommunity();
  const read = item.readBy.includes(user!.id);
  return (
    <article className={`card announcement-card ${!read ? "unread" : ""}`}>
      <div className="announcement-icon">
        <Megaphone size={21} />
      </div>
      <div className="announcement-content">
        <div className="announcement-labels">
          <Badge color={item.priority === "URGENT" ? "red" : "blue"}>
            {item.category}
          </Badge>
          {item.pinned && (
            <span className="muted">
              <Pin size={13} />
              Pinned
            </span>
          )}
          {item.priority !== "NORMAL" && (
            <Badge color={item.priority === "URGENT" ? "red" : "orange"}>
              {item.priority.toLowerCase()}
            </Badge>
          )}
        </div>
        <Link to={`/announcements/${item.id}`}>
          <h3>{item.title}</h3>
        </Link>
        <p>{item.text}</p>
        <div className="announcement-bottom">
          <small>
            {item.authority} · {relative(item.createdAt)}
            {demo && " · Demo content"}
          </small>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => mutate("announcement.read", { id: item.id })}
          >
            {read && <Check size={13} />}Mark {read ? "unread" : "read"}
          </button>
        </div>
      </div>
    </article>
  );
}
export function Dashboard() {
  const { data, user, demo } = useCommunity();
  const now = campusNow();
  const weekday = now.getDay() || 1;
  const classes = data.timetable
    .filter(
      (t) =>
        t.branch === user!.branch &&
        t.semester === user!.semester &&
        t.section === user!.section &&
        t.day === weekday,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const notices = data.announcements
    .filter((a) => a.status === "PUBLISHED")
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const discussions = data.discussions
    .filter((d) => !d.hidden)
    .sort((a, b) => b.votes.length - a.votes.length);
  return (
    <>
      <PageHeader
        eyebrow={now
          .toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
          .toUpperCase()}
        title={`Hello, ${user!.name.split(" ")[0]} 👋`}
        text="Here’s what’s happening in your campus community."
      />
      <section className="welcome-card">
        <div>
          <Badge color="hero">
            <span className="status-dot" /> YOUR CAMPUS, CONNECTED
          </Badge>
          <h2>
            A little more connected.
            <br />A lot more possibilities.
          </h2>
          <p>
            Your next idea, study buddy, or campus memory
            <br className="desktop-label" /> could start right here.
          </p>
          <Link className="button light" to="/feed">
            Explore the community
            <ArrowRight size={16} />
          </Link>
        </div>
        <CampusIllustration />
      </section>
      <div className="stat-grid">
        <Link to="/discussions" className="card mini-stat">
          <span className="stat-icon blue">
            <MessageIcon />
          </span>
          <span>
            <strong>{discussions.length}</strong>
            <small>Open conversations</small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link to="/announcements" className="card mini-stat">
          <span className="stat-icon orange">
            <Bell size={20} />
          </span>
          <span>
            <strong>
              {notices.filter((a) => !a.readBy.includes(user!.id)).length}
            </strong>
            <small>Unread announcements</small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link to="/timetable" className="card mini-stat">
          <span className="stat-icon green">
            <BookOpen size={20} />
          </span>
          <span>
            <strong>{classes.length}</strong>
            <small>Classes on your schedule</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      </div>
      <SectionTitle title="Campus updates" to="/announcements" />
      <div className="stack compact">
        {notices.slice(0, 2).map((a) => (
          <AnnouncementCard key={a.id} item={a} />
        ))}
        {!notices.length && (
          <Empty
            title="You’re all caught up"
            text="Published campus announcements will appear here."
          />
        )}
      </div>
      <div className="dashboard-duo">
        <section>
          <SectionTitle title="On your schedule" to="/timetable" />
          <div className="card schedule-card">
            <div className="schedule-heading">
              <CalendarDays size={17} />
              {dayNames[weekday - 1]}{" "}
              <Badge color="gray">
                {demo ? "Demo schedule" : "Weekly schedule"}
              </Badge>
            </div>
            {classes.slice(0, 3).map((t) => (
              <Link key={t.id} to="/timetable" className="class-row">
                <span className={`class-color ${colorName(t.color)}`} />
                <div>
                  <strong>{t.subject}</strong>
                  <small>
                    <MapPin size={12} />
                    {t.room}
                  </small>
                </div>
                <span className="class-time">
                  {t.start}
                  <small>{t.end}</small>
                </span>
              </Link>
            ))}
            {!classes.length && (
              <Empty
                title="A little breathing room"
                text="No classes match your profile today. Check your timetable filters for another batch."
              />
            )}
          </div>
        </section>
        <section>
          <SectionTitle title="In the common room" to="/discussions" />
          <div className="card trending-card">
            {discussions.slice(0, 3).map((d, i) => (
              <Link
                className="trending-row"
                key={d.id}
                to={`/discussions/${d.id}`}
              >
                <span className="trend-number">0{i + 1}</span>
                <div>
                  <strong>{d.title}</strong>
                  <small>
                    {d.votes.length} upvotes ·{" "}
                    {data.replies.filter((r) => r.discussionId === d.id).length}{" "}
                    replies
                  </small>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
            {!discussions.length && <Empty title="Start the conversation" />}
          </div>
        </section>
      </div>
      <SectionTitle title="From the community" to="/feed" />
      <div className="stack">
        {data.posts
          .filter((p) => !p.hidden)
          .slice(0, 2)
          .map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        {!data.posts.some((p) => !p.hidden) && (
          <Empty
            title="A fresh start"
            action={
              <Link className="button" to="/feed">
                Share an update
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
function MessageIcon() {
  return <Sparkles size={20} />;
}
export function Announcements() {
  const { data, user, demo } = useCommunity();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Newest first");
  const [create, setCreate] = useState(false);
  const notices = data.announcements
    .filter(
      (a) =>
        a.status === "PUBLISHED" &&
        (category === "All" || a.category === category) &&
        `${a.title} ${a.text}`.toLowerCase().includes(q.toLowerCase()) &&
        (sort !== "Unread only" || !a.readBy.includes(user!.id)),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "Oldest first"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)),
    );
  return (
    <>
      <PageHeader
        eyebrow="STAY IN THE LOOP"
        title="Announcements"
        text="The important updates, all in one place."
        action={
          user!.role === "ADMIN" && (
            <button className="button" onClick={() => setCreate(true)}>
              <Plus size={16} />
              New announcement
            </button>
          )
        }
      />
      {demo && (
        <div className="info-banner">
          <Bell size={18} />
          All notices below are fictional demo content. Consult official NSUT
          channels for real updates.
        </div>
      )}
      <div className="filter-row">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search announcements…"
        />
        <select
          aria-label="Sort announcements"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {["Newest first", "Oldest first", "Unread only"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="chips">
        {["All", ...announcementCategories].map((c) => (
          <button
            className={category === c ? "selected" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="stack">
        {notices.map((a) => (
          <AnnouncementCard key={a.id} item={a} />
        ))}
        {!notices.length && (
          <Empty
            title="No announcements found"
            text="Try a different filter or check back for new updates."
          />
        )}
      </div>
      {create && (
        <EntityForm
          title="Create announcement"
          action="announcement.save"
          fields={announcementFields}
          initial={{ authority: "Campus Administration", status: "DRAFT" }}
          close={() => setCreate(false)}
        />
      )}
    </>
  );
}
export function AnnouncementDetail() {
  const { id } = useParams();
  const { data, user, mutate, busy, demo } = useCommunity();
  const item = data.announcements.find(
    (a) => a.id === id && a.status === "PUBLISHED",
  );
  if (!item)
    return (
      <Empty
        title="Announcement unavailable"
        action={
          <Link className="button" to="/announcements">
            All announcements
          </Link>
        }
      />
    );
  return (
    <>
      <Link className="back-link" to="/announcements">
        <ArrowLeft size={16} />
        All announcements
      </Link>
      <PageHeader
        title={item.title}
        text={`${item.authority} · ${new Date(item.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`}
      />
      <article className="card detail-card">
        <div className="chips">
          <Badge>{item.category}</Badge>
          <Badge color="orange">{item.priority}</Badge>
          {demo && <Badge color="gray">Fictional demo notice</Badge>}
        </div>
        <p className="post-text">{item.text}</p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => mutate("announcement.read", { id: item.id })}
        >
          <Check size={17} />
          Mark as {item.readBy.includes(user!.id) ? "unread" : "read"}
        </button>
      </article>
    </>
  );
}
export function Timetable() {
  const { data, user, demo } = useCommunity();
  const now = campusNow();
  const [branch, setBranch] = useState(user!.branch || "CSE");
  const [semester, setSemester] = useState(user!.semester || 5);
  const [section, setSection] = useState(user!.section || "A");
  const [view, setView] = useState("Week");
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState(now.getDay() || 1);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + week * 7);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const entries = data.timetable
    .filter(
      (t) =>
        t.branch === branch && t.semester === semester && t.section === section,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const startHour = Math.min(
    9,
    ...entries.map((t) => Number(t.start.slice(0, 2))),
  );
  const endHour = Math.max(
    17,
    ...entries.map((t) =>
      Math.ceil((Number(t.end.slice(0, 2)) * 60 + Number(t.end.slice(3))) / 60),
    ),
  );
  const time = now.getHours() * 60 + now.getMinutes();
  const options = [
    ...new Set(["A", "B", ...data.timetable.map((t) => t.section)]),
  ];
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE STRUCTURE HELPS"
        title="Your timetable"
        text="Know what’s next. Make room for everything else."
      />
      {demo && (
        <div className="info-banner">
          <GraduationCap size={18} />
          This recurring sample schedule is demo data, not an official NSUT
          timetable.
        </div>
      )}
      <div className="card timetable-controls">
        <div className="timetable-filters">
          <label>
            Branch
            <select
              aria-label="Timetable branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Semester
            <select
              aria-label="Timetable semester"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Section
            <select
              aria-label="Timetable section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {options.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="tabs">
          {["Week", "Day"].map((v) => (
            <button
              className={view === v ? "selected" : ""}
              key={v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="week-navigation">
        <button
          className="icon-button"
          aria-label="Previous week"
          onClick={() => setWeek(week - 1)}
        >
          <ChevronLeft size={19} />
        </button>
        <strong>
          {monday.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {saturday.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </strong>
        <button
          className="icon-button"
          aria-label="Next week"
          onClick={() => setWeek(week + 1)}
        >
          <ChevronRight size={19} />
        </button>
        <button
          className="text-button"
          onClick={() => {
            setWeek(0);
            setDay(now.getDay() || 1);
          }}
        >
          Today
        </button>
      </div>
      {!entries.length ? (
        <Empty
          title="No timetable for this batch"
          text="Try CSE, semester 5, section A for the demo schedule, or choose another batch."
        />
      ) : (
        <>
          <div className={`card week-grid ${view === "Day" ? "hidden" : ""}`}>
            <div className="time-column">
              <div className="grid-header">IST</div>
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <div className="time-slot" key={i}>
                  {String(i + startHour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {dayNames.map((d, i) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + i);
              return (
                <div
                  className={`day-column ${week === 0 && now.getDay() === i + 1 ? "today" : ""}`}
                  key={d}
                >
                  <button
                    className="grid-header"
                    onClick={() => {
                      setDay(i + 1);
                      setView("Day");
                    }}
                  >
                    {d.slice(0, 3)}
                    <strong>{date.getDate()}</strong>
                  </button>
                  <div
                    className="day-slots"
                    style={{ height: (endHour - startHour) * 88 }}
                  >
                    {entries
                      .filter((t) => t.day === i + 1)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setDay(t.day);
                            setView("Day");
                          }}
                          title={`${t.subject} · ${t.faculty} · ${t.room}`}
                          className={`class-block ${colorName(t.color)}`}
                          style={{
                            top:
                              ((Number(t.start.slice(0, 2)) * 60 +
                                Number(t.start.slice(3)) -
                                startHour * 60) /
                                60) *
                              88,
                            height:
                              ((Number(t.end.slice(0, 2)) * 60 +
                                Number(t.end.slice(3)) -
                                Number(t.start.slice(0, 2)) * 60 -
                                Number(t.start.slice(3))) /
                                60) *
                                88 -
                              5,
                          }}
                        >
                          <small>
                            {t.start} – {t.end}
                          </small>
                          <strong>{t.subject}</strong>
                          <span>{t.code}</span>
                          <small>{t.room}</small>
                          <small>{t.faculty}</small>
                        </button>
                      ))}
                    {week === 0 &&
                      now.getDay() === i + 1 &&
                      time >= startHour * 60 &&
                      time <= endHour * 60 && (
                        <span
                          className="current-time-line"
                          style={{ top: ((time - startHour * 60) / 60) * 88 }}
                        />
                      )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`day-view ${view === "Day" ? "visible" : ""}`}>
            <div className="chips">
              {dayNames.map((d, i) => (
                <button
                  key={d}
                  className={day === i + 1 ? "selected" : ""}
                  onClick={() => setDay(i + 1)}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
            <div className="stack">
              {entries
                .filter((t) => t.day === day)
                .map((t) => (
                  <article
                    className={`card day-class ${colorName(t.color)}`}
                    key={t.id}
                  >
                    <div>
                      <Badge color={colorName(t.color)}>{t.code}</Badge>
                      <h3>{t.subject}</h3>
                      <p>{t.faculty}</p>
                      <small>
                        <MapPin size={14} />
                        {t.room}
                      </small>
                    </div>
                    <span>
                      <Clock size={17} />
                      {t.start} – {t.end}
                    </span>
                  </article>
                ))}
              {!entries.some((t) => t.day === day) && (
                <Empty
                  title="No classes this day"
                  text="A little space for your own plans."
                />
              )}
            </div>
          </div>
        </>
      )}
      <div className="timetable-note">
        <span className="status-dot" />
        All class times shown in India Standard Time · Weekly recurring classes
      </div>
    </>
  );
}
export function CampusSidebar() {
  const { data, demo, mutate, busy } = useCommunity();
  const events = data.events
    .filter((event) => new Date(event.endsAt).getTime() > Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  return (
    <aside className="campus-sidebar">
      <div className="card side-card campus-calendar">
        <SectionTitle title="Campus calendar" />
        <p className="side-caption">
          {demo ? "Fictional demo events" : "Upcoming campus events · IST"}
        </p>
        {events.map((e) => (
          <div className="event-row" key={e.id}>
            <span className="event-date blue">
              <strong>
                {new Date(e.startsAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}
              </strong>
              <small>
                {new Date(e.startsAt)
                  .toLocaleDateString("en-IN", {
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  })
                  .toUpperCase()}
              </small>
            </span>
            <div>
              <strong>{e.title}</strong>
              <small>
                {e.location} ·{" "}
                {new Date(e.startsAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}
              </small>
              <small>{e.attendeeCount} attending</small>
              <button
                className="text-button"
                disabled={busy}
                aria-label={`${e.attending ? "Leave" : "Join"} ${e.title}`}
                onClick={() =>
                  mutate(
                    "event.rsvp",
                    { id: e.id, attending: !e.attending },
                    e.attending ? "RSVP removed" : "RSVP saved",
                  )
                }
              >
                {e.attending
                  ? "Joined · Undo"
                  : demo
                    ? "Join demo event"
                    : "Join event"}
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ))}
        {!events.length && (
          <p className="side-caption">No upcoming events yet.</p>
        )}
      </div>
      <div className="card side-card">
        <SectionTitle title="Worth a conversation" />
        {data.discussions
          .filter((d) => !d.hidden)
          .slice(0, 3)
          .map((d) => (
            <Link
              className="side-discussion"
              key={d.id}
              to={`/discussions/${d.id}`}
            >
              <span>#{d.tags[0] || d.category}</span>
              <strong>{d.title}</strong>
              <small>{d.votes.length} upvotes</small>
            </Link>
          ))}
      </div>
      <div className="community-note">
        <span className="stat-icon blue">
          <GraduationCap size={24} />
        </span>
        <h3>Better, together.</h3>
        <p>A space for every branch, every year, and every curious mind.</p>
        <Link to="/search?type=Users">
          Meet your community
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="useful-links">
        <a href="https://www.nsut.ac.in/" target="_blank" rel="noreferrer">
          Official NSUT website
          <ExternalLink size={13} />
        </a>
        <Link to="/timetable">
          Academic schedule
          <ArrowRight size={13} />
        </Link>
        <small>
          NSUT Connect {new Date().getFullYear()}
          <br />
          {demo ? "Student community demo" : "Student community"} · Built for
          belonging.
        </small>
      </div>
    </aside>
  );
}
