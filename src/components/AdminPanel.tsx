import React, { useState } from "react";
import { motion } from "motion/react";
import { RefreshCcw, Search, Trash2, Edit2, X, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocale } from "../lib/locale";

interface Message {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

export const AdminPanel: React.FC = () => {
  const { language, t } = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    "X-Admin-Password": password,
  };

  const fetchMessages = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const response = await fetch("/api/messages", {
        headers: { "X-Admin-Password": password },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setIsAuthorized(true);
      } else {
        alert(t("密碼錯誤！", "Incorrect password."));
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (id: number) => {
    if (!confirm(t("確定要刪除這筆留言嗎？", "Delete this message?"))) return;
    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": password },
      });
      if (response.ok) {
        setMessages(messages.filter((m) => m.id !== id));
      } else {
        alert(t("刪除失敗！", "Could not delete the message."));
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const updateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage) return;
    try {
      const response = await fetch(`/api/messages/${editingMessage.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          name: editingMessage.name,
          email: editingMessage.email,
          message: editingMessage.message,
        }),
      });
      if (response.ok) {
        setMessages(messages.map((m) => (m.id === editingMessage.id ? editingMessage : m)));
        setEditingMessage(null);
      } else {
        alert(t("更新失敗！", "Could not update the message."));
      }
    } catch (error) {
      console.error("Failed to update message:", error);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="panel w-full max-w-md p-8 text-center"
        >
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: "2px solid var(--brand)" }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand)" }} />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-semibold">{t("管理員登入", "Admin sign in")}</h2>
          <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>HPC Lab Admin Console</p>
          <input
            type="password"
            placeholder={t("請輸入管理密碼", "Enter admin password")}
            className="mb-4 w-full rounded-xl p-3.5 text-center text-base transition-colors focus:outline-none"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchMessages()}
          />
          <button
            onClick={fetchMessages}
            disabled={loading || !password}
            className="w-full rounded-xl p-3.5 text-base font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            {loading ? t("驗證中…", "Checking…") : t("登入查看留言", "View messages")}
          </button>
          <Link
            to="/"
            className="mt-6 block text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-faint)" }}
          >
            {t("← 返回首頁", "← Back to home")}
          </Link>
        </motion.div>
      </div>
    );
  }

  const filteredMessages = messages.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-panel relative min-h-screen p-4 md:p-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-semibold">{t("管理控制台", "Admin dashboard")}</h1>
            <p className="text-sm font-medium" style={{ color: "var(--text-faint)" }}>HPC Lab Visitor Messages</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/members" className="chip px-4 py-2 text-sm font-semibold">{t("成員名冊 →", "Member directory →")}</Link>
            <span className="text-sm" style={{ color: "var(--text-dim)" }}>
              {t("共", "Showing")} {filteredMessages.length} / {messages.length} {t("筆", "messages")}
            </span>
            <button
              onClick={fetchMessages}
              disabled={loading}
              className="chip flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("重新整理", "Refresh")}
            </button>
          </div>
        </header>

        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              placeholder={t("搜尋姓名、信箱或內容…", "Search names, email or messages…")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl py-3.5 pl-12 pr-4 text-base transition-colors focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="text-sm font-semibold" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-dim)" }}>
                  <th className="px-6 py-4">{t("日期", "Date")}</th>
                  <th className="px-6 py-4">{t("姓名", "Name")}</th>
                  <th className="px-6 py-4">{t("聯絡信箱", "Email")}</th>
                  <th className="px-6 py-4">{t("留言內容", "Message")}</th>
                  <th className="px-6 py-4 text-right">{t("操作", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="h-16 px-6 py-8" style={{ background: "var(--surface-2)" }} />
                    </tr>
                  ))
                ) : filteredMessages.length > 0 ? (
                  filteredMessages.map((msg) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={msg.id}
                      className="group"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="whitespace-nowrap px-6 py-4 tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                        {new Date(msg.created_at).toLocaleString(language)}
                      </td>
                      <td className="px-6 py-4 font-semibold">{msg.name}</td>
                      <td className="px-6 py-4" style={{ color: "var(--text-dim)" }}>{msg.email}</td>
                      <td className="max-w-md px-6 py-4 leading-relaxed">
                        <div className="line-clamp-2 hover:line-clamp-none">{msg.message}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setEditingMessage(msg)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "var(--text-dim)" }}
                            title={t("編輯", "Edit")}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "var(--critical)" }}
                            title={t("刪除", "Delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center" style={{ color: "var(--text-faint)" }}>
                      {searchTerm ? t("找不到符合的留言", "No matching messages") : t("目前沒有留言記錄", "No messages yet")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel relative w-full max-w-lg p-6"
          >
            <button
              onClick={() => setEditingMessage(null)}
              className="absolute right-4 top-4 rounded-full p-2 transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="mb-6 text-xl font-semibold">{t("編輯留言資料", "Edit message")}</h2>

            <form onSubmit={updateMessage} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{t("姓名", "Name")}</label>
                <input
                  type="text"
                  value={editingMessage.name}
                  onChange={(e) => setEditingMessage({ ...editingMessage, name: e.target.value })}
                  className="w-full rounded-xl p-3 text-base focus:outline-none"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{t("信箱", "Email")}</label>
                <input
                  type="email"
                  value={editingMessage.email}
                  onChange={(e) => setEditingMessage({ ...editingMessage, email: e.target.value })}
                  className="w-full rounded-xl p-3 text-base focus:outline-none"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{t("留言內容", "Message")}</label>
                <textarea
                  value={editingMessage.message}
                  onChange={(e) => setEditingMessage({ ...editingMessage, message: e.target.value })}
                  className="h-32 w-full resize-none rounded-xl p-3 text-base focus:outline-none"
                  style={inputStyle}
                  required
                />
              </div>
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingMessage(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "var(--text-dim)" }}
                >
                  {t("取消", "Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ background: "var(--brand)", color: "var(--ink)" }}
                >
                  <Check className="h-4 w-4" />
                  {t("儲存變更", "Save changes")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="fixed bottom-8 left-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--text-faint)" }}
        >
          {t("← 返回首頁", "← Back to home")}
        </Link>
      </div>
    </div>
  );
};
