# Rally

Passive safety app for nights out. Rally monitors everyone in your group ("rally") and automatically notifies friends when a combination of signals looks wrong — so nobody has to remember to check in.

This repo is the **native mobile app** (Expo / React Native), the production rewrite of the original HooHacks demo that was built as static HTML.

## How it works

Rally combines passive signals into a tiered assessment (All Clear → Heads Up → Concern → Urgent → Emergency) and only escalates to friends past a threshold:

- **Gait** — deviation from your calibrated sober walking baseline
- **Proximity** — distance from the rest of your rally
- **Ambient sound** — sudden environment shifts (loud venue → total silence)
- **Context** — time of night, how long you've been stationary, battery level, and your own past-rally patterns

An AI reasoning layer explains *why* a tier was raised in plain language, and that explanation is what gets sent to friends.

## Running it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on your phone
```

Web preview: `npx expo export --platform web && npx serve dist`

## Project structure

```
App.js                      # navigation + theme
src/theme.js                # design tokens
src/logic/safety.js         # pure safety logic: tiers, scoring, AI narrative
src/screens/HomeScreen.js   # hub
src/screens/AlertsScreen.js # core screen: banner, gait/proximity/sound/log tabs
```

All safety reasoning lives in `src/logic/safety.js` as pure functions — screens only render its output.

## Status / roadmap

Signals are currently **simulated** (sliders + environment buttons drive the demo). Roadmap to real:

1. ~~Port UI to Expo~~ ✅
2. Wire to the safety backend (Express + Claude) for live AI reasoning
3. Real users/groups/live location via Supabase
4. Real sensors: accelerometer gait, GPS, battery
5. Background monitoring + push notifications
6. TestFlight → App Store
