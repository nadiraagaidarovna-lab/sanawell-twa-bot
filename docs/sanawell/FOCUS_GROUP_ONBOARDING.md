# Controlled onboarding focus group

This does not enable the new onboarding for all unfinished accounts.

## Opt-in (configuration is not applied by this change)

1. Set the backend environment variable `ONBOARDING_TESTER_IDS` to a comma-separated list of explicitly approved numeric Telegram user IDs. Do not put IDs in Vite variables, source code or shared links. Unset/empty allows nobody. Backend restart is needed when changing this server configuration.
2. An allowlisted tester opens the existing authenticated Mini App with `?onboarding=focus-group` appended to its `/checkin/` URL, or with Telegram Mini App `startapp=onboarding_focus_group` (received in signed initData as `start_param`). Use the actual existing app/bot link; no new bot is created.
3. Both the allowlist and launch opt-in are required. `onboardingAnketaCompleted === true` always preserves the existing path, including the existing consent gate. Unfinished accounts outside the group retain legacy onboarding.

## Completion and return visits

The last step reads `/api/me`, saves missing `onboardingWelcomeSeen` first via `/api/onboarding-welcome-seen`, then `onboardingAnketaCompleted` via `/api/anketa/complete`. Both must succeed before leaving. Failures stay on the final step; retry reads the flags again, preserving partial success and lost-response writes.

The app removes onboarding from navigation history, opens normal Check-in, and uses the normal Map/Home/Progress handlers. Completed testers return through the existing app gate even if the opt-in remains in their link. To resume an unfinished new flow, use the same opt-in link while still allowlisted; saved answers hydrate, but step position itself is not stored.

No `onboarded` routing or `menopause_path` writes are introduced. Disabling the allowlist restores legacy routing for unfinished users without changing saved data.

## Before a later rollout

The previously implemented Cycle/MHT endpoints and explicit migration must be available. This task does not run that migration, configure Render, or deploy. The existing `OnboardingFlow.css` is still an untracked preview dependency and must be included in any eventual rollout; it is not changed here. Legal documents retain their MVP draft status.
