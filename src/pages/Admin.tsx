import { useState } from "react";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Users,
  MessageCircle,
  Megaphone,
  CalendarDays,
} from "lucide-react";
import type { ActionName, Input } from "../../shared/model";
import { colorName } from "../lib/colors";
import { useCommunity } from "../context/Community";
import {
  Avatar,
  Badge,
  Empty,
  PageHeader,
  SearchBox,
  dayNames,
  relative,
} from "../components/ui";
import {
  EntityForm,
  announcementFields,
  timetableFields,
  type FormField,
} from "../components/EntityForm";
export function Admin() {
  const { data, user, mutate, busy, confirm, demo } = useCommunity();
  const [tab, setTab] = useState("Announcements");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{
    title: string;
    fields: FormField[];
    action: ActionName;
    initial: Input;
  } | null>(null);
  if (user!.role !== "ADMIN")
    return (
      <Empty
        title="Administrator access required"
        text="This area is available to authorized campus administrators."
      />
    );
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const remove = async (action: ActionName, id: string, text: string) => {
    if (await confirm(text)) await mutate(action, { id }, "Record deleted");
  };
  const editAnnouncement = (id?: string) => {
    const a = data.announcements.find((a) => a.id === id);
    setForm({
      title: a ? "Edit announcement" : "Create announcement",
      fields: announcementFields,
      action: "announcement.save",
      initial: a
        ? {
            id: a.id,
            title: a.title,
            text: a.text,
            authority: a.authority,
            category: a.category,
            priority: a.priority,
            pinned: a.pinned,
            status: a.status,
          }
        : {
            authority: demo
              ? "Campus Administration · Demo"
              : "Campus Administration",
            status: "DRAFT",
          },
    });
  };
  const editTimetable = (id?: string) => {
    const t = data.timetable.find((t) => t.id === id);
    setForm({
      title: t ? "Edit class" : "Add class",
      fields: timetableFields,
      action: "timetable.save",
      initial: t
        ? { ...t, color: colorName(t.color) }
        : {
            branch: "CSE",
            semester: 5,
            section: "A",
            start: "09:00",
            end: "10:00",
          },
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY STEWARDSHIP"
        title="Admin workspace"
        text="Keep your campus community useful, safe, and informed."
      />
      <div className="info-banner">
        <ShieldCheck size={18} />
        {demo
          ? "Simulated administrator controls. Demo changes stay in this browser."
          : "Every administrative action is authorized by the server and recorded in the audit log."}
      </div>
      <div className="stat-grid admin-stats">
        {[
          { label: "Members", count: data.users.length, icon: Users },
          { label: "Posts", count: data.posts.length, icon: MessageCircle },
          {
            label: "Announcements",
            count: data.announcements.length,
            icon: Megaphone,
          },
          {
            label: "Classes",
            count: data.timetable.length,
            icon: CalendarDays,
          },
        ].map((s) => (
          <div className="card mini-stat" key={s.label}>
            <span className="stat-icon blue">
              <s.icon size={19} />
            </span>
            <span>
              <strong>{s.count}</strong>
              <small>{s.label}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="tabs admin-tabs">
        {["Announcements", "Timetable", "Moderation", "Users", "Audit log"].map(
          (t) => (
            <button
              className={tab === t ? "selected" : ""}
              key={t}
              onClick={() => {
                setTab(t);
                setQ("");
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div className="filter-row">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={`Search ${tab.toLowerCase()}…`}
        />
        {(tab === "Announcements" || tab === "Timetable") && (
          <button
            className="button"
            onClick={() =>
              tab === "Announcements" ? editAnnouncement() : editTimetable()
            }
          >
            <Plus size={16} />
            {tab === "Announcements" ? "New announcement" : "Add class"}
          </button>
        )}
      </div>
      <div className="card admin-list">
        {tab === "Announcements" &&
          data.announcements
            .filter((a) => match(a.title + " " + a.status + " " + a.category))
            .map((a) => (
              <div className="admin-row" key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.category} · {a.priority} {a.pinned ? "· Pinned" : ""}
                  </small>
                </div>
                <Badge color={a.status === "PUBLISHED" ? "green" : "gray"}>
                  {a.status.toLowerCase()}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`Edit ${a.title}`}
                  onClick={() => editAnnouncement(a.id)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${a.title}`}
                  disabled={busy}
                  onClick={() =>
                    remove(
                      "announcement.delete",
                      a.id,
                      "Delete this announcement permanently?",
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        {tab === "Timetable" &&
          data.timetable
            .filter((t) =>
              match(
                t.subject + " " + t.branch + " " + t.faculty + " " + t.room,
              ),
            )
            .map((t) => (
              <div className="admin-row" key={t.id}>
                <div>
                  <strong>{t.subject}</strong>
                  <small>
                    {t.branch} · Semester {t.semester} · {dayNames[t.day - 1]}{" "}
                    {t.start}–{t.end} · {t.room}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Edit class ${t.id}`}
                  onClick={() => editTimetable(t.id)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete class ${t.id}`}
                  disabled={busy}
                  onClick={() =>
                    remove(
                      "timetable.delete",
                      t.id,
                      "Delete this timetable entry?",
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        {tab === "Moderation" &&
          [
            ...data.posts.map((p) => ({
              ...p,
              kind: "post",
              title: p.text.slice(0, 120),
            })),
            ...data.discussions.map((d) => ({ ...d, kind: "discussion" })),
          ]
            .filter((p) => match(p.title + " " + p.kind))
            .map((p) => (
              <div className="admin-row" key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <small>
                    {p.kind} ·{" "}
                    {data.users.find((u) => u.id === p.authorId)?.name}
                  </small>
                </div>
                <Badge color={p.hidden ? "orange" : "green"}>
                  {p.hidden ? "Hidden" : "Visible"}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`${p.hidden ? "Restore" : "Hide"} ${p.kind}`}
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirm(
                        `${p.hidden ? "Restore" : "Hide"} this ${p.kind}?`,
                      )
                    )
                      await mutate(
                        "admin.moderate",
                        { id: p.id, kind: p.kind },
                        "Moderation saved",
                      );
                  }}
                >
                  {p.hidden ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
            ))}
        {tab === "Users" &&
          data.users
            .filter((u) => match(u.name + " " + u.branch + " " + u.status))
            .map((u) => (
              <div className="admin-row" key={u.id}>
                <Avatar user={u} size="sm" />
                <div>
                  <strong>{u.name}</strong>
                  <small>
                    {u.branch} · {u.role.toLowerCase()}
                  </small>
                </div>
                <Badge color={u.status === "ACTIVE" ? "green" : "red"}>
                  {u.status.toLowerCase()}
                </Badge>
                {u.id !== user!.id && u.role !== "ADMIN" && (
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirm(
                          `${u.status === "ACTIVE" ? "Suspend" : "Reactivate"} ${u.name}’s account?`,
                        )
                      )
                        await mutate(
                          "admin.userStatus",
                          { id: u.id },
                          "Account status updated",
                        );
                    }}
                  >
                    {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                  </button>
                )}
              </div>
            ))}
        {tab === "Audit log" &&
          data.auditLogs
            .filter((a) => match(a.action + " " + a.targetId))
            .map((a) => (
              <div className="admin-row" key={a.id}>
                <span className="stat-icon blue">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <strong>{a.action}</strong>
                  <small>
                    {data.users.find((u) => u.id === a.actorId)?.name} ·{" "}
                    {relative(a.createdAt)} · {a.targetId}
                  </small>
                </div>
              </div>
            ))}
        {((tab === "Announcements" &&
          !data.announcements.some((a) =>
            match(a.title + " " + a.status + " " + a.category),
          )) ||
          (tab === "Timetable" &&
            !data.timetable.some((t) =>
              match(
                t.subject + " " + t.branch + " " + t.faculty + " " + t.room,
              ),
            )) ||
          (tab === "Audit log" &&
            !data.auditLogs.some((a) => match(a.action + " " + a.targetId))) ||
          (tab === "Users" &&
            !data.users.some((u) =>
              match(u.name + " " + u.branch + " " + u.status),
            )) ||
          (tab === "Moderation" &&
            ![
              ...data.posts.map((p) => p.text),
              ...data.discussions.map((d) => d.title),
            ].some(match))) && (
          <Empty
            title="No matching records"
            text="Try another search. Administrative changes are recorded here."
          />
        )}
      </div>
      {form && <EntityForm {...form} close={() => setForm(null)} />}
    </>
  );
}
