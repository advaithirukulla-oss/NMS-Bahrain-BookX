# API Documentation Summary

This frontend expects the backend to expose the following production endpoints. Protected endpoints should require a JWT bearer token.

## System

- `GET /`: API metadata and running status.
- `GET /health`: Health check for uptime monitoring.

## Authentication

- `POST /register`: Create a student account.
- `POST /login`: Authenticate and return `access_token` plus `user`.

## Profile

- `GET /dashboard/{user_id}`: Return profile data, trust points, and dashboard counters.

## Books

- `GET /books`: Return available books.
- `POST /books`: Create a new syllabus book listing.
- `GET /books/search?keyword={keyword}`: Search by title or subject.
- `GET /books/owner/{user_id}/requests`: Return a student's posted books with incoming requests.

## Requests

- `POST /requests`: Request a book.
- `GET /requests/user/{user_id}`: Return outgoing requests for a student.
- `PUT /requests/{request_id}`: Approve or reject a request.
- `DELETE /requests/{request_id}`: Cancel a pending request.

## Messages

- `GET /messages/summary/{user_id}`: Return conversation summaries.
- `GET /messages/conversation`: Return conversation messages for two users.
- `POST /messages`: Send a message.
- `PUT /messages/read-conversation`: Mark a conversation as read.

## Community And Admin

- `GET /notifications/{user_id}`: Return notifications and unread count.
- `GET /leaderboard`: Return top trusted students.
- `GET /admin/stats`: Return admin dashboard metrics.

## Response Guidelines

- Return JSON for all endpoints.
- Use `detail` for user-readable errors.
- Use `401` for expired or invalid tokens.
- Use `403` for unauthorized roles.
- Use `422` for validation errors.
- Avoid exposing database errors or secrets in responses.
