# SanaWell AI — Home Specification

Status: APPROVED FOR IMPLEMENTATION

## Goal

Home must give the user immediate access to approximately 80% of the most important SanaWell AI experience.

It should feel calm, simple and useful — not like a medical dashboard.

Target mobile widths:
- 360 px
- 390 px
- 430 px

Prioritize fitting the key Home experience into the first mobile viewport while preserving readable typography and usable tap targets.

Do not add a large hero image or large decorative image of a woman.

---

## 1. Header

Use the official SanaWell AI logo asset.

Greeting:

“Добрый день, Надира!”

The real implementation should use the available user display name with safe fallback behavior.

Do not redesign or recreate the official logo.

---

## 2. Моё состояние

Compact primary card.

Title:
“Моё состояние”

Show:
- current self-reported state
- small personal dynamics visualization
- short period indicator such as “7 дней”

Any displayed value must come from real user data.

Never fabricate demo values in production.

Do not call this:
- Health Score
- menopause score
- hormone score
- diagnostic score

Comparison must be based on the user’s own history only.

If there is not enough history, show a neutral empty/new-user state.

---

## 3. Primary CTA

Prominent button:

“Отметить самочувствие”

This opens the existing/new approved 360° check-in flow.

If today’s check-in is already completed, the UI should eventually support:

“✓ Сегодня отмечено”

with a secondary action:

“Изменить”

Preserve existing check-in backend behavior unless a separate backend task changes it.

---

## 4. Мы заметили

Compact insight card.

Title:
“Мы заметили”

Only show observations supported by actual tracked user data.

No invented correlations.
No medical causal claims.
No diagnosis.

If there is insufficient data, use a neutral state rather than generating an insight.

---

## 5. Сегодня для вас

Compact recommendation/action card.

Title:
“Сегодня для вас”

Show ONE useful wellness action at a time.

It must not dominate the screen.

No large photo.

---

## 6. Six wellness areas

Show six compact cards in a 3 × 2 grid where mobile width allows.

Areas:

1. Питание
2. Движение
3. Сон
4. Менопауза 360°
5. Эмоции
6. Окружение

These map to the approved full areas:

- Питание и обмен веществ
- Движение и сила
- Сон и восстановление
- Гормональная и интимная гигиена / Менопауза 360°
- Эмоциональное здоровье
- Окружение и смысл

Cards must be compact and clearly tappable.

Do not create large illustrations for these cards.

---

## 7. Bottom navigation

Fixed bottom navigation:

1. SanaWell
2. Динамика
3. Поддержка
4. Профиль

The SanaWell tab uses the official SanaWell AI brand/logo asset.

Do NOT put AI Assistant in the primary bottom navigation.

---

## 8. Visual system

Use the already approved SanaWell AI visual direction.

Base palette:

Background:
#FBF7F2

Primary card:
#FFFFFF

Secondary surface:
#F7F2EC

Primary text:
#24211D

Secondary text:
#6F6A63

Sage:
#3F7563

Sage interaction:
#356655

Sage soft:
#E7F0EB

Peach:
#F3DDD3

Blush:
#EBCFC7

Warm tan:
#D9B89C

Do not introduce a new palette.

Use:
- rounded cards
- subtle borders
- extremely subtle shadows
- generous but space-efficient spacing
- readable typography
- strong visual hierarchy

Avoid:
- excessive gradients
- excessive glassmorphism
- tiny text
- medical dashboard styling
- decorative clutter
- oversized cards
- large stock photography

---

## 9. Data integrity

Production Home must never display fabricated wellness information.

For missing data:
use empty states, onboarding states or neutral messages.

Never fabricate:
- scores
- trends
- percentages
- correlations
- AI observations

---

## 10. Existing application protection

Implementation must reuse existing SanaWell functionality where possible.

Do not break:
- onboarding
- consent
- questionnaire
- authentication
- API calls
- check-in persistence
- 24-hour edit behavior
- Telegram integration
- haptics
- existing navigation infrastructure

Backend/API changes require a separate explicit task.

---

## 11. Responsive requirement

Verify Home at:

360 px
390 px
430 px

The primary information hierarchy must remain clear on all three widths.

The target order is:

Header
→ Моё состояние
→ Отметить самочувствие
→ Мы заметили
→ Сегодня для вас
→ 6 wellness areas
→ fixed bottom navigation

Avoid unnecessary scrolling, but do not sacrifice accessibility just to force everything into one viewport.

---

## Implementation rule

This specification controls implementation.

The coding agent must reproduce this structure mechanically and must not independently redesign the Home.

Last updated: 2026-09-22
