import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionName, Input, Snapshot, User } from "../../shared/model";
import { createDemo } from "../data/demo";
import { applyAction } from "../lib/domain";
import {
  ApiError,
  apiAction,
  getSession,
  getSnapshot,
  request,
} from "../services/api";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
const STORAGE = "nsut-connect-demo-v1";
function stored(): Snapshot {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) || "null");
    return v && Array.isArray(v.users) && Array.isArray(v.timetable)
      ? v
      : createDemo();
  } catch {
    return createDemo();
  }
}
interface Context {
  data: Snapshot;
  user: User | null;
  demo: boolean;
  busy: boolean;
  loading: boolean;
  theme: string;
  following: string[];
  toggleFollow: (id: string) => void;
  toggleTheme: () => void;
  enterDemo: () => void;
  login: (id: string) => void;
  logout: () => Promise<void>;
  mutate: (
    name: ActionName,
    input: Input,
    message?: string,
  ) => Promise<boolean>;
  toast: (text: string, error?: boolean) => void;
  confirm: (text: string) => Promise<boolean>;
}
const Community = createContext<Context | null>(null);
export function CommunityProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(stored);
  const [userId, setUserId] = useState(localStorage.getItem("nsut-demo-user"));
  const [liveUser, setLiveUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(import.meta.env.VITE_APP_MODE !== "live");
  const [loading, setLoading] = useState(
    import.meta.env.VITE_APP_MODE === "live",
  );
  const [busy, setBusy] = useState(false);
  const [csrf, setCsrf] = useState("");
  const [theme, setTheme] = useState(
    localStorage.getItem("nsut-theme") || "light",
  );
  const [followMap, setFollowMap] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("nsut-following") ||
          '{"aarav":["ananya","rohan"]}',
      );
    } catch {
      return {};
    }
  });
  const [messages, setMessages] = useState<
    { id: number; text: string; error: boolean }[]
  >([]);
  const [question, setQuestion] = useState("");
  const resolveConfirm = useRef<((value: boolean) => void) | null>(null);
  const user = demo
    ? (data.users.find((u) => u.id === userId && u.status === "ACTIVE") ?? null)
    : liveUser
      ? (data.users.find((u) => u.id === liveUser.id) ?? liveUser)
      : null;
  function toast(text: string, error = false) {
    const id = Date.now() + Math.random();
    setMessages((m) => [...m.slice(-2), { id, text, error }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 5000);
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nsut-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (demo) localStorage.setItem(STORAGE, JSON.stringify(data));
  }, [data, demo]);
  useEffect(() => {
    localStorage.setItem("nsut-following", JSON.stringify(followMap));
  }, [followMap]);
  useEffect(() => {
    if (import.meta.env.VITE_APP_MODE !== "live") return;
    let stopped = false;
    (async () => {
      try {
        await request("/health");
        try {
          const session = await getSession();
          const snapshot = await getSnapshot();
          if (!stopped) {
            setLiveUser(session.user);
            setCsrf(session.csrfToken);
            setData(snapshot);
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            const auth = await request<{ configured: boolean }>("/auth/status");
            if (!auth.configured && !stopped) {
              setDemo(true);
              setUserId(null);
              toast(
                "Live sign-in is not configured. Explore the simulated demo accounts.",
              );
            }
          } else if (!stopped)
            toast(
              error instanceof Error
                ? error.message
                : "Could not load your session.",
              true,
            );
        }
      } catch {
        if (!stopped) {
          setDemo(true);
          setUserId(null);
          toast(
            "Live service is unavailable. You can explore the working demo instead.",
          );
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);
  async function mutate(name: ActionName, input: Input, message?: string) {
    if (!user || busy) return false;
    setBusy(true);
    try {
      const next = demo
        ? applyAction(data, user, name, input)
        : await apiAction(name, input, data, user, csrf);
      setData(next);
      if (message) toast(message);
      return true;
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
        true,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      if (!demo) await request("/auth/logout", "POST", {}, csrf);
      setUserId(null);
      setLiveUser(null);
      localStorage.removeItem("nsut-demo-user");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Logout failed.", true);
    }
  }
  async function toggleFollow(id: string) {
    if (!user || busy) return;
    if (demo) {
      setFollowMap((m) => ({
        ...m,
        [user.id]: (m[user.id] || []).includes(id)
          ? (m[user.id] || []).filter((v) => v !== id)
          : [...(m[user.id] || []), id],
      }));
      return;
    }
    setBusy(true);
    try {
      await request(
        `/users/${encodeURIComponent(id)}/follow`,
        data.following?.includes(id) ? "DELETE" : "POST",
        {},
        csrf,
      );
      setData(await getSnapshot());
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not update your following list.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  function answer(value: boolean) {
    resolveConfirm.current?.(value);
    resolveConfirm.current = null;
    setQuestion("");
  }
  return (
    <Community.Provider
      value={{
        data,
        user,
        demo,
        busy,
        loading,
        theme,
        following: demo
          ? user
            ? followMap[user.id] || []
            : []
          : data.following || [],
        toggleFollow,
        toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
        enterDemo: () => {
          setData(stored());
          setDemo(true);
          setUserId(null);
          setLiveUser(null);
        },
        login: (id) => {
          setUserId(id);
          localStorage.setItem("nsut-demo-user", id);
        },
        logout,
        mutate,
        toast,
        confirm: (text) =>
          new Promise((resolve) => {
            resolveConfirm.current = resolve;
            setQuestion(text);
          }),
      }}
    >
      {children}
      <div className="toasts" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`toast ${m.error ? "error" : ""}`}>
            {m.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{m.text}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setMessages(messages.filter((x) => x.id !== m.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {question && (
        <div
          className="modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") answer(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="modal"
          >
            <h2 id="confirm-title">Please confirm</h2>
            <p>{question}</p>
            <div className="modal-actions">
              <button
                className="button secondary"
                autoFocus
                onClick={() => answer(false)}
              >
                Cancel
              </button>
              <button className="button danger" onClick={() => answer(true)}>
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </Community.Provider>
  );
}
export function useCommunity() {
  const ctx = useContext(Community);
  if (!ctx) throw new Error("Community provider required");
  return ctx;
}
