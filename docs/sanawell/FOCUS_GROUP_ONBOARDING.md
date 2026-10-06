# Controlled onboarding focus group

## Which onboarding an account gets

The server decides it in `GET /api/me` (`onboardingVersion`), so the regular bot button
«Открыть/Ашу» is enough — no special link or `start_param`.

`ONBOARDING_VERSION_MODE` (backend environment, restart required):

| Value | Unfinished accounts |
| --- | --- |
| `v2_all` | new six-step onboarding for everyone |
| `v2_allowlist` (default, also for unset/unknown values) | new onboarding for numeric Telegram IDs in `ONBOARDING_TESTER_IDS`; others keep the legacy flow |
| `paused` | a neutral «временно недоступно» page; no questions, no writes |

Completed accounts (`onboardingAnketaCompleted === true`) always open Home. If they have no
consent to the current document version, they first see only the consent page; answers and the
completion flag are not touched. Nothing is reset automatically.

If `/api/me` fails, the app shows a retry page instead of guessing a flow.

## Consent

Both checkboxes are confirmed with one `POST /api/consents` carrying the document version
from `mini-app/src/lib/legal-documents.json` (the single source of document addresses, also
read by `backend/src/consent.js`). The server records one append-only row per document in
`consent_events` and rejects a stale version (409). Legacy `*_consent_at` timestamps are kept
and filled only when empty; on their own they no longer count as consent.

Every write of personal or wellbeing data (`/profile`, `/menopause-path`, `/anketa/*`,
`POST /checkin`) requires a current consent: 403 `consent_required` otherwise, 503 if the
journal table is missing (fails closed). Language, reminder opt-out and account deletion
requests stay available.

## Before enabling anywhere

Apply `backend/migrations/20261006_consent_events.sql` (and `20260923_onboarding_cycle_mht.sql`)
to the target database before deploying this code. Legal documents retain their MVP draft status.

## Seven screens (first focus-group launch, Russian)

1. Welcome — «Вы не одна. И разбираться во всём самой не нужно», three benefits, «Начать знакомство».
2. Consent — two checkboxes, three documents.
3. Name — optional (blank keeps what is stored).
4. Topics — the six approved wellness areas, multi-select, at least one (`users.focus_topics`).
5. Main priority — one of the chosen topics or «Пока не знаю» (`users.focus_priority`).
6. Review — every answer with «Изменить»; editing returns to the review.
7. Start map — main focus and chosen topics with where they live on Home; then the existing check-in.

Every answer is saved before moving on. Reopening resumes from saved answers: no consent →
welcome; no topics → name; no priority → priority; all saved → review. Completion is set only
from the start map. Name, topics and priority stay editable in the cabinet («Мои темы»).
Age, cycle and MHT are no longer asked; stored answers and translations are kept. Texts live in
`mini-app/src/content/onboardingV2.ts`; lines marked DRAFT still need approval.
Migration: `backend/migrations/20261008_onboarding_topics.sql`.
