"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, Send, ArrowLeft, Loader2, Plus, Search, X } from "lucide-react";

interface Conversation {
  id: string;
  otherUser: { id: string; name: string; avatar: string | null };
  lastMessage: string | null;
  lastMessageAt: string;
  lastMessageIsOwn: boolean;
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  category: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  kreator: "Creator",
  upplevelse: "Experience",
  publik: "User",
};

export default function MessagesPage() {
  const t = useTranslations("messages");
  const tc = useTranslations("common");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [directRecipient, setDirectRecipient] = useState<{ id: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const searchParams = useSearchParams();

  // New conversation search
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchConversations();
    const toUserId = searchParams.get("to");
    if (toUserId) {
      handleDirectMessage(toUserId);
    }
  }, []);

  useEffect(() => {
    if (activeConvo) {
      pollRef.current = setInterval(() => {
        fetchMessages(activeConvo.id, true);
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConvo?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Contact search debounce
  useEffect(() => {
    if (contactSearch.length < 2) {
      setContacts([]);
      return;
    }
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const res = await fetch(`/api/messages/contacts?q=${encodeURIComponent(contactSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts ?? []);
        }
      } catch {
        // ignore
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [contactSearch]);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectMessage(recipientId: string) {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const data = await res.json();
      const convos: Conversation[] = data.conversations ?? [];
      const existing = convos.find((c) => c.otherUser.id === recipientId);
      if (existing) {
        openConversation(existing);
      } else {
        setDirectRecipient({ id: recipientId, name: "..." });
        setActiveConvo({
          id: "",
          otherUser: { id: recipientId, name: t("newConversation"), avatar: null },
          lastMessage: null,
          lastMessageAt: new Date().toISOString(),
          lastMessageIsOwn: false,
          unreadCount: 0,
        });
      }
    } catch {
      // ignore
    }
  }

  function startConversationWith(contact: Contact) {
    setShowNewConvo(false);
    setContactSearch("");
    setContacts([]);
    setActiveConvo({
      id: "",
      otherUser: { id: contact.id, name: contact.name, avatar: contact.avatar },
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
      lastMessageIsOwn: false,
      unreadCount: 0,
    });
  }

  async function fetchMessages(convoId: string, silent = false) {
    if (!silent) setMessagesLoading(true);
    try {
      const res = await fetch(`/api/messages?conversationId=${convoId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // ignore
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }

  function openConversation(convo: Conversation) {
    setActiveConvo(convo);
    setMessages([]);
    fetchMessages(convo.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === convo.id ? { ...c, unreadCount: 0 } : c))
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvo || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    const optimistic: Message = {
      id: "temp-" + Date.now(),
      sender_id: "me",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const body: Record<string, string> = { content };
      if (activeConvo.id) {
        body.conversationId = activeConvo.id;
      } else {
        body.recipientId = activeConvo.otherUser.id;
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        if (!activeConvo.id && data.conversationId) {
          setActiveConvo((prev) => prev ? { ...prev, id: data.conversationId } : prev);
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvo.id
              ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString(), lastMessageIsOwn: true }
              : c
          )
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("now");
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString("sv-SE");
  }

  // Chat view
  if (activeConvo) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col md:max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3 border-b border-[var(--usha-border)] px-4 py-3">
          <button
            onClick={() => {
              setActiveConvo(null);
              fetchConversations();
            }}
            className="rounded-lg p-1.5 text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--usha-card)] text-sm font-bold text-[var(--usha-muted)]">
              {activeConvo.otherUser.avatar ? (
                <img src={activeConvo.otherUser.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                activeConvo.otherUser.name[0]?.toUpperCase() || "?"
              )}
            </div>
            <span className="font-semibold">{activeConvo.otherUser.name}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-[var(--usha-muted)]">{t("startConversation")}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id !== activeConvo.otherUser.id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                        : "bg-[var(--usha-card)] border border-[var(--usha-border)]"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`mt-1 text-[10px] ${isOwn ? "text-black/50" : "text-[var(--usha-muted)]"}`}>
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="border-t border-[var(--usha-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t("placeholder")}
              maxLength={2000}
              className="flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--usha-gold)]/40 transition"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black transition hover:opacity-90 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // New conversation search modal
  if (showNewConvo) {
    return (
      <div className="px-4 py-6 space-y-4 md:max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowNewConvo(false);
              setContactSearch("");
              setContacts([]);
            }}
            className="rounded-lg p-1.5 text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">{t("newMessage")}</h1>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]" />
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder={t("searchContacts")}
            autoFocus
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] pl-10 pr-10 py-3 text-sm outline-none focus:border-[var(--usha-gold)]/40"
          />
          {contactSearch && (
            <button
              onClick={() => { setContactSearch(""); setContacts([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searchingContacts && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[var(--usha-muted)]" />
          </div>
        )}

        {!searchingContacts && contactSearch.length >= 2 && contacts.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--usha-muted)]">
            {t("noContactsFound")}
          </div>
        )}

        {contacts.length > 0 && (
          <div className="space-y-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => startConversationWith(contact)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--usha-card-hover)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--usha-border)] text-sm font-bold text-[var(--usha-muted)]">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    contact.name[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{contact.name}</p>
                  <p className="text-[10px] text-[var(--usha-muted)]">
                    {ROLE_LABELS[contact.role] || contact.role}
                    {contact.category && ` · ${contact.category}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {contactSearch.length < 2 && (
          <div className="py-8 text-center text-sm text-[var(--usha-muted)]">
            {t("searchHint")}
          </div>
        )}
      </div>
    );
  }

  // Conversations list
  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle size={24} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <button
          onClick={() => setShowNewConvo(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black transition hover:opacity-90"
          aria-label={t("newMessage")}
        >
          <Plus size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--usha-border)] py-16 text-center">
          <MessageCircle size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
          <p className="text-sm text-[var(--usha-muted)]">{t("empty")}</p>
          <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("emptyHint")}</p>
          <button
            onClick={() => setShowNewConvo(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black"
          >
            <Plus size={14} />
            {t("newMessage")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => openConversation(convo)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-left transition hover:border-[var(--usha-gold)]/20"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--usha-border)] text-sm font-bold text-[var(--usha-muted)]">
                {convo.otherUser.avatar ? (
                  <img src={convo.otherUser.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  convo.otherUser.name[0]?.toUpperCase() || "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${convo.unreadCount > 0 ? "text-[var(--usha-white)]" : ""}`}>
                    {convo.otherUser.name}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-[var(--usha-muted)]">
                    {timeAgo(convo.lastMessageAt)}
                  </span>
                </div>
                {convo.lastMessage && (
                  <p className={`mt-0.5 truncate text-xs ${convo.unreadCount > 0 ? "text-[var(--usha-white)]/80 font-medium" : "text-[var(--usha-muted)]"}`}>
                    {convo.lastMessageIsOwn ? `${t("you")}: ` : ""}
                    {convo.lastMessage}
                  </p>
                )}
              </div>
              {convo.unreadCount > 0 && (
                <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--usha-gold)] px-1.5 text-[10px] font-bold text-black">
                  {convo.unreadCount}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
