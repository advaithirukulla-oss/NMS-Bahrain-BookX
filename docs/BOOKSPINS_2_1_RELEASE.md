# BookSpins 2.1 release notes

## Audit and scope

Started from local and fetched origin/main `69cf8197a211ef9bf05685de41f9ae0337bda467`.
Reviewed User, Book, BookRequest and Message, startup database initialization, authentication, request authorization, derived notifications, Home, Find, Take and the deterministic finder. There is no Notification table, author field, listing timestamp, or completed-exchange state.

Preserved the existing design, authentication, PWA/service worker, MySQL setup, services, domains, and unrelated Capacitor/package edits.

## Implementation

- Saved Books: authenticated GET /saved-books, POST /saved-books/{book_id}, DELETE /saved-books/{book_id}. Identity comes only from the bearer token. Saves and removals are idempotent. A database uniqueness constraint covers concurrent duplicate saves. Reserved books remain saved; physically deleted listings are excluded, with cascading foreign keys preventing orphaned saves.
- One additive saved_books table: integer primary key, non-null user_id and book_id foreign keys, unique (user_id, book_id), book_id index and server-created timestamp. The composite unique index supports per-user lookups.
- Recently Viewed: up to 15 positive listing IDs, deduplicated and newest first, stored locally per account/demo namespace. Display resolves against current catalogue data; missing books are skipped. No book descriptions or sensitive account data are stored in history.
- For You: available listings from other owners only. Grade match +3, viewed subject +2, saved subject +4, descending listing ID as the recency tie-breaker. Reasons identify actual grade/subject signals; no popularity or machine learning claims.
- Finder: retains deterministic real-catalogue matching, adds exact numbered grades and KG support, excludes own/unavailable listings, uses shared cards and account saves. No fabricated/general generated books or false request actions are introduced.
- Find: existing title/subject search and availability/sort filters, exact grade selection including KG, locally remembered query/filters, clear filters. No search history sent to backend.
- Activity: authenticated detail endpoint refreshes book availability and returns only the reader's own requests, or all requests for the owner. Shows Listed, Requested, Accepted and Declined from actual records.
- Notifications: retains derived events and stable IDs; adds relevant book/request/conversation destinations and accepted/declined wording. Request event dates still reflect the existing request creation timestamps; no fabricated update timestamps.
- Shared BookCard, BookCover, SaveButton, BookDetails and request controls across Home/Find/Take/finder/Saved. Native modal provides keyboard trapping/Escape and restores focus. Save state uses text, icon and aria-pressed. Request protections remain enforced server-side, and known existing requests are disabled in details.
- Shared account-scoped catalogue cache avoids fetching the same catalogue on every discovery navigation. Refreshes on window focus and successful listing/request-status changes. Images remain lazy loaded. No runtime dependency added.

## Migration and deployment strategy

The existing backend startup calls Base.metadata.create_all when ENABLE_DB_INIT=true (the repository default and documented deployment setting). Registering SavedBook extends that same strategy with a CREATE TABLE only when missing. No new migration framework, database reset, destructive SQL, service, or volume is introduced. If database initialization is disabled on the existing Railway service, create only SavedBook.__table__ with checkfirst=True using the existing deployment database connection before enabling the frontend feature. Do not reset MySQL or mysql-volume.

Upgrade verification used a disposable legacy schema: existing table definitions and populated book/trust values remained unchanged after two initialization passes. Production database credentials were not accessed during development. Rollback can restore application code while retaining saved_books and its data for a subsequent release.

## Validation before deployment

- Backend: 5 integration tests passed in isolated SQLite databases with foreign keys enabled. Covers additive/repeated migration, register/login, authenticated saves/details, missing books, duplicate saves and DB uniqueness, forged browser user IDs, cross-account isolation, save/remove persistence, reserved-book retention, own/duplicate/unavailable requests, owner authorization, private activity, notification targets/uniqueness/access, KG profile edits, messaging permissions, multipart listing upload.
- Frontend: 3 Node tests passed covering history bounds/deduplication/order/malformed input, recommendation exclusion/ranking/reasons and KG/numbered finder intent.
- Browser against isolated local backend: login, save, full refresh persistence, shared saved state, details availability, finder KG results and save, native dialog Escape and focus restoration. Demo and real account state remain separate.
- Responsive: Home, Find, detail dialogs and finder measured at 360, 390, 430, 768, 1024, 1440px with no page/dialog horizontal overflow. Save targets are at least 44px high. Visual inspection caught/fixed narrow-screen greeting decoration overlap; tablets use three-column shelves, desktop Find uses two-column cards/four-column filters.
- npm run lint and npm run build passed. No service-worker or manifest changes.

## Deliberately postponed

Author capture (existing schema has none; cards say Author not provided), completed-exchange tracking, AI-generated general suggestions, persistent notification read state/true update timestamps, and all payment, multi-school, gamification, major messaging, automatic promotion and Play publishing work excluded by the brief.

Production status and live asset verification are recorded in the task's final report after deployment; these notes alone do not claim deployment success.
