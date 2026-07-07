# Rally — Project Context & Plan

> Onboarding doc for Claude Code sessions in this repo. Read this first.
> Written 2026-07-07, at the completion of roadmap step 1.

## What this repo is

**Rally** is a passive nightlife-safety app: it monitors everyone in your friend group (your "rally") during a night out and automatically notifies friends when a combination of signals looks wrong. Motivation: college students going missing or "going too hard" on nights out, including abroad — friends need a way to know someone's in trouble without that person having to ask.

This repo is the **native mobile app** (Expo / React Native, SDK 57, plain JavaScript, React Navigation native-stack). It is the production rewrite of a HooHacks hackathon demo.

## The two repos — do not confuse them

| Repo | Location | Role |
|---|---|---|
| `rally` (this one) | `C:\Users\tyler\rally` · github.com/tyl3rn/rally | The real app. All new work happens here. |
| `hoohacks-proj` | `C:\Users\tyler\OneDrive\Desktop\hoohacks-proj` | The original hackathon demo (static HTML styled as a phone). **Deliberately frozen** — the owner keeps it untouched as the "original repo." Reference it, never modify it. |

The old repo has its own `PROJECT_CONTEXT.md` describing the demo in detail. Useful things still living there that will be ported or reused:

- `server.js` — a real Express backend (port 3001) with a working Anthropic integration. `POST /check-safety` takes `{ gaitPct, noiseShiftType, maxFriendDistMeters, minutesStationary, hourOfNight, batteryPct }`, computes a 0–100 risk score (gait 0–40, noise 0–30, distance 0–30, stationary 0–20, battery +10, × time-of-night multiplier), tiers it (`ok` <60, `heads-up` 60–74, `urgent` 75–89, `emergency` 90+), and calls Claude (`claude-haiku-4-5-20251001`) for a one-sentence blurb when notifying. Falls back to `MOCK_MODE` without `ANTHROPIC_API_KEY`. The demo front end never called it — wiring it up is step 2.
- `js/map.js` — Leaflet map (Stadia dark tiles) centered on UVA/Charlottesville (~38.05, −78.49), hardcoded friends, simulated jitter. Becomes the Rally Map screen (`react-native-maps`).
- `supabaseClient.js` — Supabase auth via browser SDK (public key hardcoded). Basis for step 3.
- HTML pages not yet ported: map (`index.html`), `night-summary`, `past-rallies`, `calibration`, `profile`, `friends`, auth pages.

## The real product concept (important)

The demo UI frames the safety reasoning as "three signals" (gait, proximity, ambient sound). **That is demo dressing.** The intended concept combines four contextual factors:

1. **Phone battery percentage** — a dying phone during a night out is a risk factor
2. **Time of day/night** — a signal at 2am weighs more than at 10pm
3. **Knowledge about the location** — familiar vs. unfamiliar, safe vs. sketchy
4. **The user's own history/patterns** — personal baseline from past rallies (when they usually head home, how far they roam). The most differentiating factor.

Gait/proximity/sound remain useful live signals, but the contextual factors are what make the reasoning smart. Design new features around all of them.

## Current state (step 1 complete)

```
App.js                      # navigation container + dark theme
src/theme.js                # design tokens (ported from the demo's shared.css)
src/logic/safety.js         # ALL safety logic as pure functions — single source of truth
src/screens/HomeScreen.js   # hub; Map/Friends/Profile are "Soon" stubs
src/screens/AlertsScreen.js # core screen: alert banner, Gait/Proximity/Sound/Log tabs
```

- `safety.js` exports: `getSignalTier` (null/heads-up/urgent/emergency), `computeNarrativeScore` (0–100), `getAiContent` (hardcoded branching narrative + one-liner — the "AI"), `getBannerState`, `getSignalReadouts`, gauge/shift helpers, `FRIENDS`, `ENV_INFO`, `DEMO` constants (1:52am, 23 min stationary, 85% battery). Screens only render its output. Everything is still **simulated** by design: sliders and environment buttons drive the signals.
- Notification log persists to AsyncStorage under `rally_notif_log`, one entry per tier change.
- Demo button in the Alerts header pins gait to 59% and hides the slider (for pitching).
- Deps: `@react-native-community/slider`, `react-native-svg`, `@react-native-async-storage/async-storage`, `@react-navigation/native` + `native-stack`, `react-native-web` (web target used for verification).

### Running and verifying

- Phone: `npx expo start`, scan QR with Expo Go.
- Web: `npx expo export --platform web && npx serve dist`.
- Verified via Playwright (Chrome channel, viewport 390×844) against the web export: render both screens, tap "Quiet / Alone" → banner goes Urgent / Friends notified → Log persists an entry; check console errors.
- **Known quirk:** programmatic `fill()` on the web slider does not fire `onValueChange` (real drag works; native slider is a different component). Drive tier changes through the environment buttons in automated tests.
- `AGENTS.md` in this repo warns Expo SDK 57 may differ from training data — check https://docs.expo.dev/versions/v57.0.0/ before using version-sensitive APIs.

## Roadmap

1. ~~**Port UI to Expo**~~ ✅ (this repo)
2. **Wire to the backend.** Bring `server.js` over from the old repo (or rebuild it here under `server/`), deploy it (Railway/Render/Fly), and make `AlertsScreen` POST signal snapshots to `/check-safety` instead of calling the local `getAiContent`. Keep `getAiContent` as offline/demo fallback. This is the moment the AI becomes real.
3. **Real data via Supabase.** Tables: `users`, `rallies`, `rally_members`, `location_pings`, `alerts`. Supabase Realtime for live friend positions. Port auth from the old `supabaseClient.js`. Kill all hardcoded `FRIENDS`.
4. **Real sensors.** `expo-battery`, `expo-location`; gait from `expo-sensors` accelerometer — compute stride-variance against a calibrated sober baseline (port the demo's `calibration.html` concept). Start with a simple variance heuristic, not ML.
5. **Background monitoring + push.** `expo-task-manager` background location task ships periodic snapshots to the backend; backend scores and pushes to the rally via `expo-notifications`. Adaptive sampling (low frequency when calm, high when elevated) to protect battery.
6. **TestFlight → App Store.** Apple Developer account ($99/yr), EAS Build/Submit (no Mac needed). Expect App Review scrutiny of background location — clear purpose strings + onboarding explaining why. Position as "notifies friends," never "prevents harm" or an emergency service (liability + review risk).

### Planned AI-layer architecture (step 2+)

Two deliberate tiers:

- **Tier 1 — deterministic scoring, always on, free.** `computeRiskScore` runs on every snapshot. Predictable and explainable; gates the LLM.
- **Tier 2 — LLM reasoning, only past the concern threshold.** Upgrade from "write a blurb" to an **agent** with tools that investigates before alerting:
  - `get_location_context(lat, lng)` — what kind of place is this?
  - `get_user_history(user_id)` — personal baseline (factor 4)
  - `get_group_state(rally_id)` — is everyone scattered, or just this person?
  - `send_checkin(user_id)` — ping the user first; a thumbs-up cancels escalation
  - `notify_friends(rally_id, message)` — last resort, with reasoning as the message
- Check-in-before-escalation directly attacks the worst product risk: **false positives** (an app that cries wolf at 2am gets deleted). Use Haiku for routine calls, escalate to Sonnet for ambiguous ones. Send the four contextual factors as structured input.

## Owner's goals (why this project exists now)

- **Interviews:** the owner (Tyler, college student) wants to discuss this in depth — design trade-offs, debugging stories, mistakes. Preserve and surface talking points: threshold-gated LLM calls vs. AI-on-everything; false-positive/false-negative tension; battery drain vs. monitoring fidelity (the app burns the battery it treats as a safety signal); privacy vs. safety (retention, rally-scoped sharing); the hackathon lesson that demo shortcuts (hardcoded "AI", duplicated FRIENDS arrays, three-signals framing) become code/pitch drift.
- **Possible startup:** competitors are Life360, Noonlight, Citizen, Apple's Check In. Differentiation: friend-group-scoped, night-out-scoped, *proactive* (notices on its own via personal baseline). Decision deferred until it runs on TestFlight with the real friend group.
- A separate **marketing landing page** (with the old HTML demo embedded as an interactive pitch) is planned but not started.

## Conventions

- Plain JavaScript (owner's comfort zone), not TypeScript.
- Safety logic stays in pure functions under `src/logic/` — screens render, they don't reason.
- Design tokens in `src/theme.js`: bg `#080810`, primary forest green `#355E3B`, accent purple `#7c3aed` ("You"), tier colors green `#10b981` → amber `#f59e0b` → orange `#f97316` → red `#ef4444`.
- Team names appearing in data: Tyler Nguyen, Sophia Ma, Collin Chan, Richard Do.
