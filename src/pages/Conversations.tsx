import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ImagePlus,
  Send,
  Plus,
  ArrowUp,
  CheckCircle2,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import type { Discussion, Post, Reply } from "../../shared/model";
import { useCommunity } from "../context/Community";
import {
  Avatar,
  Badge,
  Empty,
  PageHeader,
  SearchBox,
  UserLine,
  relative,
} from "../components/ui";
import { EntityForm, postFields, threadFields } from "../components/EntityForm";
import { categories } from "../data/demo";
export function PostComposer() {
  const { user, mutate, busy } = useCommunity();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("General");
  const [image, setImage] = useState("");
  const [attach, setAttach] = useState(false);
  return (
    <form
      className="card composer"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await mutate(
            "post.create",
            { text, category, imageUrl: image },
            "Your post is live",
          )
        ) {
          setText("");
          setImage("");
          setAttach(false);
        }
      }}
    >
      <div className="composer-input">
        <Avatar user={user!} />
        <textarea
          aria-label="Write a post"
          placeholder={`What’s on your mind, ${user?.name.split(" ")[0]}?`}
          value={text}
          maxLength={5000}
          required
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
      </div>
      {attach && (
        <input
          aria-label="Post image URL"
          placeholder="https://example.com/image.jpg"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
      )}
      <div className="composer-footer">
        <div>
          <button
            className={`text-button ${attach ? "active" : ""}`}
            type="button"
            onClick={() => setAttach(!attach)}
          >
            <ImagePlus size={17} />
            Photo
          </button>
          <select
            aria-label="Post category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="button small" disabled={busy || !text.trim()}>
          <Send size={15} /> Post
        </button>
      </div>
    </form>
  );
}
export function PostCard({
  post,
  expanded = false,
}: {
  post: Post;
  expanded?: boolean;
}) {
  const { data, user, mutate, busy, confirm, toast } = useCommunity();
  const [open, setOpen] = useState(expanded);
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState(false);
  const author = data.users.find((u) => u.id === post.authorId);
  const comments = data.comments.filter((c) => c.postId === post.id);
  return (
    <article className="card post-card">
      <div className="post-top">
        <UserLine user={author} extra={relative(post.createdAt)} />
        <Badge
          color={
            post.category === "Clubs"
              ? "violet"
              : post.category === "Placements"
                ? "green"
                : "blue"
          }
        >
          {post.category}
        </Badge>
      </div>
      <p className="post-text">{post.text}</p>
      {post.imageUrl && (
        <img
          className="post-image"
          src={post.imageUrl}
          alt="Student post attachment"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.alt = "Image unavailable";
          }}
        />
      )}
      <div className="post-actions">
        <button
          aria-label={`Like post by ${author?.name}`}
          aria-pressed={post.likes.includes(user!.id)}
          disabled={busy}
          className={post.likes.includes(user!.id) ? "liked" : ""}
          onClick={() => mutate("post.like", { id: post.id })}
        >
          <Heart
            size={18}
            fill={post.likes.includes(user!.id) ? "currentColor" : "none"}
          />
          <span>{post.likes.length}</span>
        </button>
        <button
          aria-label={`Comments on post by ${author?.name}`}
          onClick={() => setOpen(!open)}
        >
          <MessageCircle size={18} />
          <span>
            {comments.length}
            <span className="desktop-label"> comments</span>
          </span>
        </button>
        <button
          aria-label="Copy post link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${location.origin}/feed/${post.id}`,
              );
              toast("Post link copied");
            } catch {
              toast(
                "Copy is unavailable in this browser. Open the post and copy its address.",
                true,
              );
            }
          }}
        >
          <Share2 size={17} />
          <span className="desktop-label">Share</span>
        </button>
        <button
          className={`bookmark-button ${post.bookmarks.includes(user!.id) ? "active" : ""}`}
          aria-label="Bookmark post"
          aria-pressed={post.bookmarks.includes(user!.id)}
          disabled={busy}
          onClick={() =>
            mutate(
              "post.bookmark",
              { id: post.id },
              post.bookmarks.includes(user!.id)
                ? "Bookmark removed"
                : "Post bookmarked",
            )
          }
        >
          <Bookmark
            size={18}
            fill={post.bookmarks.includes(user!.id) ? "currentColor" : "none"}
          />
        </button>
        {post.authorId === user!.id && (
          <>
            <button aria-label="Edit post" onClick={() => setEdit(true)}>
              <Pencil size={16} />
            </button>
            <button
              aria-label="Delete post"
              disabled={busy}
              onClick={async () => {
                if (await confirm("Delete this post and its comments?"))
                  await mutate("post.delete", { id: post.id }, "Post deleted");
              }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
      {open && (
        <div className="comments">
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar
                size="sm"
                user={data.users.find((u) => u.id === c.authorId)}
              />
              <div>
                <strong>
                  {data.users.find((u) => u.id === c.authorId)?.name}
                </strong>
                <p>{c.text}</p>
                <small>{relative(c.createdAt)}</small>
              </div>
            </div>
          ))}
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "post.comment",
                  { id: post.id, text: comment },
                  "Comment added",
                )
              )
                setComment("");
            }}
          >
            <input
              aria-label="Write a comment"
              placeholder="Add to the conversation…"
              required
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              aria-label="Send comment"
              className="button small"
              disabled={busy || !comment.trim()}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      {edit && (
        <EntityForm
          title="Edit your post"
          fields={postFields}
          initial={{ id: post.id, text: post.text }}
          action="post.edit"
          close={() => setEdit(false)}
        />
      )}
    </article>
  );
}
export function Feed() {
  const { data, following } = useCommunity();
  const { id } = useParams();
  const focusedId = id || new URLSearchParams(location.search).get("post");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(
    new URLSearchParams(location.search).get("category") || "All",
  );
  const [sort, setSort] = useState("Latest");
  const [limit, setLimit] = useState(8);
  const posts = data.posts
    .filter(
      (p) =>
        !p.hidden &&
        (!focusedId || p.id === focusedId) &&
        (category === "All" || p.category === category) &&
        p.text.toLowerCase().includes(q.toLowerCase()) &&
        (sort !== "Following" || following.includes(p.authorId)),
    )
    .sort((a, b) =>
      sort === "Popular"
        ? b.likes.length - a.likes.length
        : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHeader
        eyebrow="THE CAMPUS COMMON ROOM"
        title="Campus feed"
        text="Ideas, stories, and everything in between."
      />
      {focusedId ? (
        <Link className="back-link" to="/feed">
          <ArrowLeft size={16} />
          Back to feed
        </Link>
      ) : (
        <PostComposer />
      )}
      <div className="filter-row">
        <div className="tabs">
          {["Latest", "Popular", "Following"].map((s) => (
            <button
              key={s}
              className={sort === s ? "selected" : ""}
              onClick={() => {
                setSort(s);
                setLimit(8);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search posts…" />
      </div>
      <div className="chips">
        {["All", ...categories].map((c) => (
          <button
            className={category === c ? "selected" : ""}
            onClick={() => {
              setCategory(c);
              setLimit(8);
            }}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="stack">
        {posts.slice(0, limit).map((p) => (
          <PostCard key={p.id} post={p} expanded={Boolean(focusedId)} />
        ))}
        {!posts.length && (
          <Empty
            title="No posts found"
            text={
              sort === "Following"
                ? "Follow a campus member from their profile to see their posts here."
                : "Try another search or share the first update."
            }
          />
        )}
      </div>
      {posts.length > limit && (
        <button
          className="button secondary load-more"
          onClick={() => setLimit(limit + 8)}
        >
          Load more posts
        </button>
      )}
    </>
  );
}
export function DiscussionCard({ thread }: { thread: Discussion }) {
  const { data, user, mutate, busy } = useCommunity();
  return (
    <article className="card discussion-card">
      <button
        className={`vote-box ${thread.votes.includes(user!.id) ? "selected" : ""}`}
        aria-label={`Upvote ${thread.title}`}
        aria-pressed={thread.votes.includes(user!.id)}
        disabled={busy}
        onClick={() => mutate("discussion.vote", { id: thread.id })}
      >
        <ArrowUp size={18} />
        <strong>{thread.votes.length}</strong>
      </button>
      <div className="discussion-content">
        <div className="discussion-labels">
          <Badge color="gray">{thread.category}</Badge>
          {thread.acceptedReplyId && (
            <span className="solved">
              <CheckCircle2 size={13} />
              Solved
            </span>
          )}
        </div>
        <Link to={`/discussions/${thread.id}`}>
          <h3>{thread.title}</h3>
        </Link>
        <p>{thread.text}</p>
        <div className="discussion-meta">
          <span>
            {data.users.find((u) => u.id === thread.authorId)?.name} ·{" "}
            {relative(thread.createdAt)}
          </span>
          <span>
            <MessageCircle size={14} />
            {
              data.replies.filter((r) => r.discussionId === thread.id).length
            }{" "}
            replies
          </span>
        </div>
        <div className="thread-tags">
          {thread.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
export function Discussions() {
  const { data } = useCommunity();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Latest");
  const [create, setCreate] = useState(false);
  const [limit, setLimit] = useState(8);
  const threads = data.discussions
    .filter(
      (d) =>
        !d.hidden &&
        (category === "All" || d.category === category) &&
        `${d.title} ${d.text} ${d.tags.join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Most Upvoted"
        ? b.votes.length - a.votes.length
        : sort === "Most Discussed"
          ? data.replies.filter((r) => r.discussionId === b.id).length -
            data.replies.filter((r) => r.discussionId === a.id).length
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHeader
        eyebrow="LEARN TOGETHER"
        title="Discussions"
        text="Good questions lead to great conversations."
        action={
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={17} />
            New discussion
          </button>
        }
      />
      <div className="card discussion-banner">
        <MessageCircle size={28} />
        <div>
          <strong>Someone here has been where you are.</strong>
          <p>Ask a question, share what you know, or find your people.</p>
        </div>
      </div>
      <div className="filter-row">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search discussions or tags…"
        />
        <select
          aria-label="Sort discussions"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {["Latest", "Most Upvoted", "Most Discussed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="chips">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="stack">
        {threads.slice(0, limit).map((d) => (
          <DiscussionCard key={d.id} thread={d} />
        ))}
        {!threads.length && (
          <Empty
            title="No discussions found"
            text="Try another search or start a new conversation."
          />
        )}
      </div>
      {threads.length > limit && (
        <button
          className="button secondary load-more"
          onClick={() => setLimit(limit + 8)}
        >
          Load more discussions
        </button>
      )}
      {create && (
        <EntityForm
          title="Start a discussion"
          fields={threadFields}
          action="discussion.create"
          close={() => setCreate(false)}
        />
      )}
    </>
  );
}
function ReplyCard({ reply, thread }: { reply: Reply; thread: Discussion }) {
  const { data, user, mutate, busy } = useCommunity();
  const [nested, setNested] = useState(false);
  const [text, setText] = useState("");
  return (
    <div
      className={`card reply-card ${thread.acceptedReplyId === reply.id ? "accepted" : ""}`}
    >
      <UserLine
        user={data.users.find((u) => u.id === reply.authorId)}
        extra={relative(reply.createdAt)}
      />
      {thread.acceptedReplyId === reply.id && (
        <Badge color="green">Accepted answer</Badge>
      )}
      <p className="post-text">{reply.text}</p>
      <div className="reply-actions">
        <button className="text-button" onClick={() => setNested(!nested)}>
          <MessageCircle size={15} />
          Reply
        </button>
        {thread.authorId === user!.id && (
          <button
            disabled={busy}
            className="text-button"
            onClick={() =>
              mutate(
                "discussion.accept",
                { id: thread.id, replyId: reply.id },
                "Accepted answer updated",
              )
            }
          >
            <CheckCircle2 size={15} />
            {thread.acceptedReplyId === reply.id
              ? "Remove accepted answer"
              : "Accept answer"}
          </button>
        )}
      </div>
      {nested && (
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate(
                "discussion.reply",
                { id: thread.id, text, parentId: reply.id },
                "Reply added",
              )
            ) {
              setText("");
              setNested(false);
            }
          }}
        >
          <input
            required
            aria-label="Write a nested reply"
            value={text}
            maxLength={3000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply to this answer…"
          />
          <button className="button small" disabled={busy}>
            Reply
          </button>
        </form>
      )}
      {data.replies
        .filter((r) => r.parentId === reply.id)
        .map((r) => (
          <ReplyCard key={r.id} reply={r} thread={thread} />
        ))}
    </div>
  );
}
export function ThreadDetail() {
  const { id } = useParams();
  const { data, user, mutate, busy, confirm } = useCommunity();
  const thread = data.discussions.find((d) => d.id === id && !d.hidden);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  if (!thread)
    return (
      <Empty
        title="Discussion unavailable"
        action={
          <Link className="button" to="/discussions">
            Browse discussions
          </Link>
        }
      />
    );
  return (
    <>
      <Link className="back-link" to="/discussions">
        <ArrowLeft size={16} />
        All discussions
      </Link>
      <PageHeader
        title={thread.title}
        text={thread.tags.map((t) => "#" + t).join(" · ")}
      />
      <article className="card thread-detail">
        <UserLine
          user={data.users.find((u) => u.id === thread.authorId)}
          extra={relative(thread.createdAt)}
        />
        <p className="post-text">{thread.text}</p>
        <button
          className={`button secondary ${thread.votes.includes(user!.id) ? "active" : ""}`}
          disabled={busy}
          onClick={() => mutate("discussion.vote", { id: thread.id })}
        >
          <ArrowUp size={17} />
          {thread.votes.length} upvotes
        </button>
        {thread.authorId === user!.id && (
          <div className="owner-actions">
            <button className="text-button" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Edit discussion
            </button>
            <button
              className="text-button"
              onClick={async () => {
                if (
                  await confirm("Delete this discussion and all its replies?")
                )
                  await mutate(
                    "discussion.delete",
                    { id: thread.id },
                    "Discussion deleted",
                  );
              }}
            >
              <Trash2 size={15} />
              Delete discussion
            </button>
          </div>
        )}
      </article>
      <h2 className="section-heading">
        {data.replies.filter((r) => r.discussionId === id).length} replies
      </h2>
      <div className="stack">
        {data.replies
          .filter((r) => r.discussionId === id && !r.parentId)
          .map((r) => (
            <ReplyCard key={r.id} reply={r} thread={thread} />
          ))}
      </div>
      <form
        className="card reply-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate(
              "discussion.reply",
              { id: thread.id, text },
              "Reply added",
            )
          )
            setText("");
        }}
      >
        <h3>Add your perspective</h3>
        <textarea
          aria-label="Your reply"
          placeholder="Share something helpful…"
          value={text}
          required
          rows={4}
          maxLength={3000}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="button" disabled={busy || !text.trim()}>
          <Send size={16} />
          Post reply
        </button>
      </form>
      {editing && (
        <EntityForm
          title="Edit discussion"
          fields={threadFields}
          initial={{
            id: thread.id,
            title: thread.title,
            text: thread.text,
            category: thread.category,
            tags: thread.tags.join(", "),
          }}
          action="discussion.edit"
          close={() => setEditing(false)}
        />
      )}
    </>
  );
}
