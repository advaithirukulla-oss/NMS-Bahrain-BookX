# BookSpins 2.2

## Lifecycle audit (before implementation)

Production baseline: 1ec1c704a88a1ed319067c66ec6286c09ee60a46.
BookRequest.status is VARCHAR(30), default pending; accepted/rejected decisions store approved/rejected. Only created_at exists. Books use available/reserved. Pending cancellation physically deletes a request. Approval reserves the book, rejects competing pending requests and gives its owner 10 trust points. Decision authorization permits owner/admin; requester/admin can cancel pending requests. Checks and updates lack a per-book database lock, so competing decisions can race. Request creation checks authentication, ownership, availability and prior requests. Notifications are derived from current requests and unread messages; decision dates incorrectly reuse request creation dates. Messages are authorized per user pair without an exchange association. Admin sees raw requests and aggregate counts. My Requests offers pending cancellation; My Books offers pending approve/reject. Neither has completion or a message shortcut.

## 2.2 policy

Preserve pending/approved/rejected, labelled Requested/Accepted/Declined. Add cancelled and completed without rewriting historical records. Pending requester cancellation retains history; cancelled requests may be requested again with a new row. Owner alone completes approved requests; admin visibility does not grant participant actions. Given books remain visible but never requestable. Preserve the existing 10-point approval reward with atomic increment; completion awards no additional points.

Nullable accepted_at, declined_at, cancelled_at and completed_at support actual event times. Historical unknown times remain null. Serialize request creation/decisions/cancellation/completion on the book row before refreshing and validating state. One transaction covers competing-request rejection, status, timestamps and existing trust reward.

Deployment and validation results will be appended after checks. Production success requires a real two-account exchange on bookspins.com.

## Validation and deployment sequence

10 isolated backend integration tests pass, including concurrent conflicting acceptance and duplicate creation, completion authorization/replay rejection, saved given books, derived contribution counts, notifications, and repeated additive migration with unchanged historical fields. 5 frontend tests cover discovery plus labels/actions and missing historical dates. Lint and production build pass.

Local browser owner acceptance, message context, completion confirmation and success state passed. Request cards, chat context, and completion dialog measured at 360/390/430/768/1024/1440px without horizontal overflow. Escape restores focus; completion moves focus to the success heading; reduced motion disables the new animation.

Deploy backend in a separate commit first. Existing Render auto-deploy may rebuild the unchanged 2.1 frontend from that commit. Verify Railway health/schema before pushing the frontend commit, avoiding new frontend calls before backend readiness. ENABLE_DB_INIT=true applies only four nullable timestamp columns through an idempotent migration, with a MySQL advisory lock to serialize migration runners. Existing values are never backfilled. If DB initialization is disabled, run migrate_exchange_timestamps(engine) using the existing deployment connection before starting the 2.2 application. Keep the added columns for rollback; no down migration is needed.
