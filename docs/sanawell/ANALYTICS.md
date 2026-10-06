# Interaction analytics (first-party)

Stored in our own database, table `app_events` (migration `backend/migrations/20261007_app_events.sql`).
No third-party service, no screen recording.

## What is recorded

| Event | Fields | When |
| --- | --- | --- |
| `onboarding_step_view` | `step` 1–7 | an onboarding screen is shown |
| `onboarding_step_done` | `step` 1–7 | the screen's answer is saved and the woman moves on |
| `onboarding_error` | `step`, `error_kind` (network / server / consent / validation) | a save fails |
| `onboarding_completed` | — | completion from the start map |
| `section_open` | `section` (fixed list of screens) | a section is opened |
| `section_active_time` | `section`, `seconds` 1–3600 | the section is left, hidden or closed |
| `legal_doc_open` | `doc` (terms / privacy / dataConsent) | a document link is opened |

Active time counts only while the page is visible and Telegram reports the Mini App as active;
background, minimized and closed time is excluded.

## What is never recorded

Answers, topics or priority values, names, symptoms, check-in scores, comments, any text or field
value, IP address, device data. The table has no free-form column, and the server rejects any
event with an extra or unknown field.

## Consent and identifier

Events are accepted only with a current consent; nothing is sent or buffered before it (so
onboarding steps 1–2 are not visible), and nothing after a withdrawal.
`pseudonym` is a **pseudonymous identifier** — HMAC-SHA256 of the Telegram ID with a server secret
(`ANALYTICS_PSEUDONYM_SECRET`, otherwise derived from `BOT_TOKEN`). It is not anonymous data: with
the secret it can be linked back. Changing the secret or the bot token changes all pseudonyms.

Retention period: **not set** — needs a separate decision.

## Queries (read-only)

Onboarding funnel (women who completed each step):

```sql
SELECT step, count(DISTINCT pseudonym) AS women
FROM app_events WHERE event = 'onboarding_step_done' GROUP BY step ORDER BY step;
SELECT count(DISTINCT pseudonym) AS completed FROM app_events WHERE event = 'onboarding_completed';
```

Errors by step:

```sql
SELECT step, error_kind, count(*) AS errors, count(DISTINCT pseudonym) AS women
FROM app_events WHERE event = 'onboarding_error' GROUP BY step, error_kind ORDER BY step, errors DESC;
```

Sections: opens and active time:

```sql
SELECT section,
       count(*) FILTER (WHERE event = 'section_open') AS opens,
       count(DISTINCT pseudonym) AS women,
       round(sum(seconds) FILTER (WHERE event = 'section_active_time') / 60.0, 1) AS active_minutes
FROM app_events WHERE event IN ('section_open', 'section_active_time')
GROUP BY section ORDER BY opens DESC;
```

Document opens:

```sql
SELECT doc, count(*) AS opens, count(DISTINCT pseudonym) AS women
FROM app_events WHERE event = 'legal_doc_open' GROUP BY doc;
```
