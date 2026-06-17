import { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaPaperPlane, FaUserCircle } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_MESSAGES } from "../data/DemoData";

function formatMessageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-BH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ChatConversation({ conversationUser, onBack }) {
  const { demoMode, user } = useUser();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef(null);

  const loadConversation = useCallback(async () => {
    if (demoMode) {
      setMessages(DEMO_MESSAGES.filter((message) =>
        (message.sender_id === user.id && message.receiver_id === conversationUser.user_id)
        || (message.sender_id === conversationUser.user_id && message.receiver_id === user.id)));
      setError("");
      return;
    }
    try {
      const [conversationResponse] = await Promise.all([
        API.get("/messages/conversation", {
          params: { user1_id: user.id, user2_id: conversationUser.user_id },
        }),
        API.put("/messages/read-conversation", null, {
          params: { current_user_id: user.id, other_user_id: conversationUser.user_id },
        }),
      ]);
      setMessages(conversationResponse.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not load this conversation.");
    }
  }, [conversationUser.user_id, demoMode, user.id]);

  useEffect(() => {
    const initialLoad = setTimeout(loadConversation, 0);
    const interval = setInterval(loadConversation, 3000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    try {
      if (demoMode) {
        setMessages((current) => [...current, {
          id: `demo-${Date.now()}`,
          sender_id: user.id,
          receiver_id: conversationUser.user_id,
          message_text: trimmedMessage,
          created_at: new Date().toISOString(),
        }]);
        setMessageText("");
        return;
      }
      await API.post("/messages", {
        sender_id: user.id,
        receiver_id: conversationUser.user_id,
        message_text: trimmedMessage,
      });
      setMessageText("");
      await loadConversation();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button type="button" onClick={onBack} aria-label="Back to messages"><FaArrowLeft /></button>
        <FaUserCircle aria-hidden="true" />
        <div>
          <strong>{conversationUser.name}</strong>
          <span>Grade {conversationUser.grade} | {conversationUser.section}</span>
        </div>
      </header>

      <main className="message-thread">
        {error && <p className="form-message error" role="alert">{error}</p>}
        {messages.length === 0 && !error && <p className="empty-state">Start the conversation.</p>}
        {messages.map((message) => {
          const isMine = message.sender_id === user.id;
          return (
            <div className={`message-row ${isMine ? "mine" : ""}`} key={message.id}>
              <div className="message-bubble">
                <p>{message.message_text}</p>
                <span>{formatMessageTime(message.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>

      <form className="message-composer" onSubmit={sendMessage}>
        <input
          type="text"
          name="chat-message"
          placeholder="Message..."
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength="1000"
          aria-label="Message"
        />
        <button type="submit" disabled={!messageText.trim() || isSending} aria-label="Send message">
          <FaPaperPlane />
        </button>
      </form>
    </div>
  );
}

export default ChatConversation;
