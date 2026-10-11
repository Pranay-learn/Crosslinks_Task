import { useState } from "react";
import type { ActionName, Input } from "../../shared/model";
import { useCommunity } from "../context/Community";
import { Field, Modal } from "./ui";
import { announcementCategories, branches, categories } from "../data/demo";
export interface FormField {
  name: string;
  label: string;
  type?: "textarea" | "number" | "checkbox" | "url" | "time" | "datetime-local";
  options?: string[];
  optional?: boolean;
  max?: number;
  min?: number;
}
export const postFields: FormField[] = [
  { name: "text", label: "What’s on your mind?", type: "textarea", max: 5000 },
];
export const eventFields: FormField[] = [
  { name: "title", label: "Event title", max: 180 },
  { name: "text", label: "Event description", type: "textarea", max: 5000 },
  { name: "location", label: "Event location", max: 120 },
  { name: "startsAt", label: "Starts (IST)", type: "datetime-local" },
  { name: "endsAt", label: "Ends (IST)", type: "datetime-local" },
];
export const threadFields: FormField[] = [
  { name: "title", label: "Discussion title", max: 180 },
  {
    name: "text",
    label: "Start the conversation",
    type: "textarea",
    max: 5000,
  },
  { name: "category", label: "Category", options: categories },
  { name: "tags", label: "Tags (comma separated)", optional: true, max: 200 },
];
export const announcementFields: FormField[] = [
  { name: "title", label: "Title", max: 180 },
  { name: "text", label: "Announcement content", type: "textarea", max: 5000 },
  { name: "authority", label: "Publishing authority", max: 100 },
  { name: "category", label: "Category", options: announcementCategories },
  {
    name: "priority",
    label: "Priority",
    options: ["NORMAL", "IMPORTANT", "URGENT"],
  },
  {
    name: "status",
    label: "Status",
    options: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  },
  {
    name: "pinned",
    label: "Pin this announcement",
    type: "checkbox",
    optional: true,
  },
];
export const timetableFields: FormField[] = [
  { name: "subject", label: "Subject", max: 100 },
  { name: "code", label: "Course code", max: 20 },
  { name: "faculty", label: "Faculty", max: 100 },
  { name: "room", label: "Room", max: 40 },
  {
    name: "day",
    label: "Day (1 Monday – 6 Saturday)",
    type: "number",
    min: 1,
    max: 6,
  },
  { name: "start", label: "Starts at", type: "time" },
  { name: "end", label: "Ends at", type: "time" },
  { name: "branch", label: "Branch", options: branches },
  { name: "semester", label: "Semester", type: "number", min: 1, max: 8 },
  { name: "section", label: "Section", max: 20 },
  {
    name: "color",
    label: "Color",
    options: ["blue", "violet", "green", "orange"],
  },
];
export const profileFields: FormField[] = [
  { name: "name", label: "Full name", max: 100 },
  {
    name: "bio",
    label: "About you",
    type: "textarea",
    optional: true,
    max: 500,
  },
  { name: "branch", label: "Branch", options: branches },
  { name: "year", label: "Academic year", type: "number", min: 1, max: 4 },
  { name: "semester", label: "Semester", type: "number", min: 1, max: 8 },
  { name: "section", label: "Section", max: 20 },
  {
    name: "avatarUrl",
    label: "Avatar URL (HTTPS)",
    type: "url",
    optional: true,
  },
  {
    name: "visibility",
    label: "Profile visibility",
    options: ["CAMPUS", "PUBLIC"],
  },
];
export function EntityForm({
  title,
  fields,
  initial = {},
  action,
  close,
}: {
  title: string;
  fields: FormField[];
  initial?: Input;
  action: ActionName;
  close: () => void;
}) {
  const { mutate, busy } = useCommunity();
  const [values, setValues] = useState<Input>(() => ({
    ...Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.options?.[0] ||
          (f.type === "number"
            ? f.min || 1
            : f.type === "checkbox"
              ? false
              : ""),
      ]),
    ),
    ...initial,
  }));
  return (
    <Modal title={title} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate(action, values, "Changes saved")) close();
        }}
      >
        <div className="form-fields">
          {fields.map((f) => (
            <Field key={f.name} label={f.label}>
              {f.options ? (
                <select
                  value={String(values[f.name])}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                >
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={4}
                  required={!f.optional}
                  maxLength={f.max}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                />
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.checked }))
                  }
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={!f.optional}
                  min={f.min}
                  max={f.type === "number" ? f.max : undefined}
                  maxLength={f.type !== "number" ? f.max : undefined}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.name]:
                        f.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                />
              )}
            </Field>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
