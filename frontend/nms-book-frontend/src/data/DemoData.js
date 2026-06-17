export const DEMO_USER = {
  id: 1,
  name: "Aisha Ahmed",
  email: "aisha@nmsedu.bh",
  grade: "10",
  section: "B",
  role: "admin",
  trust_points: 40,
};

export const DEMO_USERS = [
  DEMO_USER,
  { id: 2, name: "Omar Ali", email: "omar@nmsedu.bh", grade: "11", section: "A", role: "student", trust_points: 70 },
  { id: 3, name: "Sara Khan", email: "sara@nmsedu.bh", grade: "10", section: "C", role: "student", trust_points: 55 },
  { id: 4, name: "Yusuf Hassan", email: "yusuf@nmsedu.bh", grade: "9", section: "A", role: "student", trust_points: 25 },
];

export const DEMO_BOOKS = [
  { id: 1, title: "Cambridge Biology", subject: "Biology", grade: "10", image_url: "", condition: "Good", description: "Clean copy with a few notes.", status: "available", owner_id: 2 },
  { id: 2, title: "IGCSE Mathematics", subject: "Mathematics", grade: "10", image_url: "", condition: "Excellent", description: "Almost new.", status: "reserved", owner_id: 3 },
  { id: 3, title: "English Language Skills", subject: "English", grade: "9", image_url: "", condition: "Used", description: "Useful practice exercises.", status: "available", owner_id: 1 },
  { id: 4, title: "Physics Coursebook", subject: "Physics", grade: "11", image_url: "", condition: "Good", description: "Complete syllabus coursebook.", status: "available", owner_id: 1 },
];

export const DEMO_REQUESTS = [
  { id: 1, book_id: 1, requester_id: 1, status: "pending", created_at: "2026-06-14T09:30:00" },
  { id: 2, book_id: 2, requester_id: 1, status: "approved", created_at: "2026-06-12T12:15:00" },
  { id: 3, book_id: 3, requester_id: 4, status: "pending", created_at: "2026-06-15T08:20:00" },
  { id: 4, book_id: 4, requester_id: 3, status: "rejected", created_at: "2026-06-11T14:05:00" },
];

export const DEMO_MESSAGES = [
  { id: 1, sender_id: 2, receiver_id: 1, message_text: "Hi, the Biology book is still available.", is_read: 0, created_at: "2026-06-15T10:10:00" },
  { id: 2, sender_id: 1, receiver_id: 2, message_text: "Great, thank you!", is_read: 1, created_at: "2026-06-15T10:12:00" },
  { id: 3, sender_id: 3, receiver_id: 1, message_text: "Your Mathematics request was approved.", is_read: 0, created_at: "2026-06-14T16:45:00" },
];

export function getDemoDashboard() {
  const userRequests = DEMO_REQUESTS.filter((request) => request.requester_id === DEMO_USER.id);
  return {
    ...DEMO_USER,
    user_id: DEMO_USER.id,
    books_posted: DEMO_BOOKS.filter((book) => book.owner_id === DEMO_USER.id).length,
    books_requested: userRequests.length,
    books_approved: userRequests.filter((request) => request.status === "approved").length,
  };
}

export function getDemoUserRequests() {
  return DEMO_REQUESTS.filter((request) => request.requester_id === DEMO_USER.id).map((request) => {
    const book = DEMO_BOOKS.find((item) => item.id === request.book_id);
    const owner = DEMO_USERS.find((item) => item.id === book.owner_id);
    return { ...request, book_title: book.title, owner_id: owner.id, owner_name: owner.name, request_date: request.created_at };
  });
}

export function getDemoOwnerBooks() {
  return DEMO_BOOKS.filter((book) => book.owner_id === DEMO_USER.id).map((book) => ({
    ...book,
    requests: DEMO_REQUESTS.filter((request) => request.book_id === book.id).map((request) => ({
      ...request,
      requester_name: DEMO_USERS.find((user) => user.id === request.requester_id)?.name || "Student",
      request_date: request.created_at,
    })),
  }));
}

export function getDemoNotifications() {
  return [
    { id: "demo-1", type: "book_approved", title: "Book request approved", message: 'Your request for "IGCSE Mathematics" was approved.', created_at: "2026-06-14T16:45:00", is_unread: true },
    { id: "demo-2", type: "new_request", title: "New book request", message: 'Yusuf Hassan requested "English Language Skills".', created_at: "2026-06-15T08:20:00", is_unread: true },
    { id: "demo-3", type: "new_message", title: "New message", message: "Omar Ali: Hi, the Biology book is still available.", created_at: "2026-06-15T10:10:00", is_unread: true },
    { id: "demo-4", type: "book_rejected", title: "Book request rejected", message: 'A previous request for "Physics Coursebook" was rejected.', created_at: "2026-06-11T14:05:00", is_unread: false },
  ];
}

export function getDemoMessageSummary() {
  return DEMO_USERS.filter((user) => user.id !== DEMO_USER.id).map((user) => {
    const messages = DEMO_MESSAGES.filter((message) =>
      (message.sender_id === DEMO_USER.id && message.receiver_id === user.id)
      || (message.sender_id === user.id && message.receiver_id === DEMO_USER.id));
    const lastMessage = messages[messages.length - 1];
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      grade: user.grade,
      section: user.section,
      last_message: lastMessage?.message_text || "",
      last_message_created_at: lastMessage?.created_at || null,
      unread_count: messages.filter((message) => message.receiver_id === DEMO_USER.id && !message.is_read).length,
    };
  }).filter((item) => item.last_message);
}

export function getDemoAdminStats() {
  return {
    total_users: DEMO_USERS.length,
    total_books: DEMO_BOOKS.length,
    total_requests: DEMO_REQUESTS.length,
    total_messages: DEMO_MESSAGES.length,
    available_books: DEMO_BOOKS.filter((book) => book.status === "available").length,
    reserved_books: DEMO_BOOKS.filter((book) => book.status === "reserved").length,
    pending_requests: DEMO_REQUESTS.filter((request) => request.status === "pending").length,
    approved_requests: DEMO_REQUESTS.filter((request) => request.status === "approved").length,
  };
}
