# BookSpins 2.3

## Audit and scope

Baseline: 9fe450e. The old AI Finder used frontend grade/subject/keyword rules over the catalogue; it had no external provider or backend AI endpoint. Railway's existing production backend has eight configured variable names (database, authentication, CORS/frontend, environment, initialization, docs and port); no AI provider credentials are configured. Values were kept masked. No external provider is integrated in 2.3.

Books already contain title, subject, grade, condition, description, syllabus flag, status, owner and optional image URL. Give posts JSON or multipart to the existing authenticated books endpoint. Image upload retains JPG/PNG/WEBP validation and its 5MB limit. No author, AI logging table or schema change is added. Search, Saved Books, account-scoped local recent history and deterministic For You remain intact.

## Implementation

Authenticated POST /smart/find extracts structured intent and filters real database books before ranking at most 200 candidates and returning at most 20. Grade and subject constrain matches; availability defaults to available and owners are excluded. Explicit unavailable/all queries preserve actual backend status. Reading-level evidence is described as listing wording, never independently verified difficulty. Save and Open use the normal BookCard; details refresh availability before enabling requests. General ideas are separate plain text with no inventory actions.

Saved similarity loads only authenticated-user saves. Recent IDs are bounded catalogue references from this account's browser history, not evidence about another user. Profile grade influences ranking. No messages, email or credentials enter assistance inputs. No query/catalogue data is sent externally. Smart validation logging omits submitted text.

Authenticated POST /smart/listing returns text-derived drafts only. Title is extracted only when explicitly marked/quoted; condition only when explicitly described. Description assistance combines entered fields without invented condition, author or edition. The optional collapsed Smart Assist panel previews each field with Apply/Dismiss, warns when applying replaces existing text, and leaves posting to the existing explicit submit action. Suggestions remain editable. Images remain ordinary listing uploads; image analysis is unavailable and explicitly labelled.

GET /smart/capabilities reports deterministic text matching and vision=false. The two work endpoints share a thread-safe in-process 20 requests/user/minute limit, bounded to 10,000 active user entries. It resets on restart and is per process, not a distributed quota. Existing deployment has one replica; there are no provider charges. Client timeout is 12 seconds and unmount cancels requests. Provider SDKs, credentials and new dependencies are absent. Future provider integration needs separate configuration, structured validation, server timeout and production vision verification; setting an unused provider key alone does not enable it.

## Validation

14 isolated backend integration tests passed, including previous 2.2 concurrency/lifecycle tests and new extraction, grounding, availability, owner exclusion, saved/recent privacy, invalid input/image payload rejection, missing-provider deterministic operation, no automatic posting and rate-limit checks. Nine frontend tests passed. Lint/build passed. Both AI Finder and Give/expanded suggestions measured without horizontal overflow at 360/390/430/768/1024/1440. Mobile visual review and explicit apply/dismiss/edit passed. Stopping the isolated API produced the requested unavailable message while manual fields remained editable. No external provider failure was simulated because no provider call exists.

Finder and Give are lazy-loaded through the existing router. Finder is roughly 1.5KB gzipped; Give including assist roughly 3.25KB gzipped. No provider SDK or large dependency was added. Existing service worker bookspins-static-v3, manifest, exchange lifecycle, and unrelated Capacitor/package modifications are preserved.

## Release strategy

Commit/push backend first to the existing Railway service and verify health/capabilities before committing/pushing frontend to the existing Render service. Verify normal custom-domain and Render-domain assets after propagation. Use only the two dedicated temporary QA accounts and new clearly labelled disposable listing data. Final production evidence is recorded separately after live QA; this document alone is not a production-success claim.
