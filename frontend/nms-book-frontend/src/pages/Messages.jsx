import { useCallback, useEffect, useState } from "react";
import { FaComments, FaUserCircle } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import ChatConversation from "./ChatConversation";
import { getDemoMessageSummary } from "../data/DemoData";

function formatSummaryTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return new Intl.DateTimeFormat("en-BH", isToday
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function Messages() {
  const { demoMode, user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (demoMode) {
      setConversations(getDemoMessageSummary());
      setError("");
      setIsLoading(false);
      return;
    }
    try {
      const response = await API.get(`/messages/summary/${user.id}`);
      setConversations(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not load messages.");
    } finally {
      setIsLoading(false);
    }
  }, [demoMode, user.id]);

  useEffect(() => {
    const initialLoad = setTimeout(loadConversations, 0);
    const interval = setInterval(loadConversations, 5000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadConversations]);

  if (selectedConversation) {
    return <ChatConversation conversationUser={selectedConversation} onBack={() => {
      setSelectedConversation(null);
      loadConversations();
    }} />;
  }

  return (
    <div className="page messages-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Direct messages</p>
          <h1>Messages</h1>
        </div>
        <FaComments aria-hidden="true" />
      </header>

      {isLoading && <p className="status-card">Loading conversations...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && !error && conversations.length === 0 && (
        <p className="empty-state">Your conversations will appear here.</p>
      )}

      <div className="conversation-list">
        {conversations.map((conversation) => (
          <button
            type="button"
            className="conversation-card"
            key={conversation.user_id}
            onClick={() => setSelectedConversation(conversation)}
          >
            <FaUserCircle className="conversation-avatar" aria-hidden="true" />
            <div className="conversation-copy">
              <div>
                <strong>{conversation.name}</strong>
                <time>{formatSummaryTime(conversation.last_message_created_at)}</time>
              </div>
              <p className={conversation.unread_count ? "unread" : ""}>
                {conversation.last_message || "Start a conversation"}
              </p>
            </div>
            {conversation.unread_count > 0 && (
              <span className="unread-badge">{conversation.unread_count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Messages;
