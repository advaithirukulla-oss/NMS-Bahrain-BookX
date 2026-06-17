# Final Testing Checklist

Run this checklist before deployment and after any backend endpoint changes.

## Authentication

- [ ] Registration accepts a valid `@nmsedu.bh` student email.
- [ ] Registration rejects non-NMS email addresses.
- [ ] Login succeeds with valid credentials.
- [ ] Login shows a clear error for invalid credentials.
- [ ] Logout clears the session and returns to login.
- [ ] Expired JWTs automatically return the user to login.
- [ ] Private app pages are not visible when logged out.

## Profile

- [ ] Profile loads name, email, grade, section, trust points, and counters.
- [ ] Daily Book Quote appears.
- [ ] Demo Mode can be entered and exited.
- [ ] Notification badge updates.

## Books

- [ ] Give Book posts a valid syllabus book.
- [ ] Give Book validates title, subject, grade, description, and syllabus confirmation.
- [ ] Take Books loads available books.
- [ ] Request Book creates a request and disables duplicate in-progress clicks.
- [ ] Find Books searches by title or subject.
- [ ] Find Books filters by grade and search text.
- [ ] Empty states appear when no books match.

## Requests And Messaging

- [ ] My Requests lists outgoing requests.
- [ ] Pending requests can be cancelled.
- [ ] My Books lists incoming requests.
- [ ] Owners can approve and reject incoming requests.
- [ ] Messages list conversations.
- [ ] A conversation can be opened.
- [ ] Messages can be sent.
- [ ] Read status updates after opening a conversation.

## AI, Community, Admin

- [ ] AI Book Finder loads available books.
- [ ] AI Book Finder returns relevant matches.
- [ ] Leaderboard loads trusted students.
- [ ] Admin dashboard loads for admin users.
- [ ] Admin link is hidden for non-admin users.
- [ ] Notifications list unread and read items.
- [ ] Terms & Conditions page is reachable.

## Mobile Responsiveness

- [ ] Layout works at 320px width.
- [ ] Bottom navigation labels fit without overlap.
- [ ] Forms remain usable on mobile keyboards.
- [ ] Cards and message bubbles do not overflow.
- [ ] Loading skeletons and empty states render cleanly.

## Deployment

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Backend `/health` returns `status: ok`.
- [ ] Production `CORS_ORIGINS` contains only trusted frontend URLs.
- [ ] Frontend `VITE_API_BASE_URL` points to the production backend.
