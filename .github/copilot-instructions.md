# Copilot Instructions for Ridely Rider App (Optimized, Oct 2025)

## Project Overview

- **Type:** React Native (Expo) app for motorcycle dispatch riders and regular users
- **Backend:** Supabase (auth, database, RLS, Realtime)
- **Major Features:** Dual user types, real-time delivery tracking (MapboxGL), earnings management, secure authentication, responsive theming, live location sharing (user ↔ rider)

## Key Architecture & Patterns

- **App Structure:**
  - All screens in `app/` (subfolders: auth, rider, tabs, booking, profile)
  - Layout files (`_layout.tsx`) for navigation and shared UI
  - Contexts: `contexts/AuthContext.tsx`, `contexts/ThemeContext.tsx`
  - Custom hooks: `hooks/` (e.g., `useDeliveries.ts`, `useEarnings.ts`)
  - Supabase integration: `lib/supabase.ts`
- **Navigation:**
  - File-based routing (Expo Router)
  - Auth: `app/(auth)/`, Rider: `app/(rider)/`, Tabs: `app/(tabs)/`
- **Data Flow:**
  - All data via Supabase (see `lib/supabase.ts`)
  - RLS policies enforced at DB level (see migrations)
  - Context providers for auth and theme

## Developer Workflows

- **Setup:**
  - Configure `.env` with Supabase URL and anon key
  - Run DB migrations manually in Supabase SQL editor (`supabase/migrations/*.sql`)
  - If adding enum values (e.g., 'nearby' to `delivery_status`), run the enum migration and commit before running dependent migrations (see `20251002120000_add_nearby_to_delivery_status.sql`)
- **Run App:**
  - `npm install`
  - `npm run dev` (starts Expo dev server)
- **Testing:**
  - Manual testing via Expo Go or device/emulator
- **Debugging:**
  - Use Expo/React Native debugging tools
  - Supabase errors surface in the app and console

## Project-Specific Conventions

- **User Types:**
  - See `contexts/AuthContext.tsx` for user type logic
  - Rider-specific logic: `app/(rider)/`
- **Earnings:**
  - 15% Ridely fee auto-deducted (see DB and earnings logic)
- **Theming:**
  - System-aware dark/light mode via `contexts/ThemeContext.tsx`
- **Assets:**
  - Images/illustrations in `assets/`
- **Live Location Sharing:**
  - MapboxGL used for all map screens (see `app/tracking.tsx`, `app/(rider)/active-delivery.tsx`)
  - Pickup/dropoff selection: all users can use map to select locations
  - During delivery, only the assigned user and rider can see each other's live locations (see RLS policy in migration)

## Integration Points

- **Supabase:**
  - All backend logic (auth, DB, RLS, Realtime)
  - Migration files: `supabase/migrations/20250819221355_bitter_lab.sql`, `20251002120000_add_nearby_to_delivery_status.sql`
- **Expo Router:**
  - File-based navigation, layouts, and deep linking

## Examples

- To add a new rider feature: create a screen in `app/(rider)/`, update navigation/layout as needed
- To fetch deliveries: use `hooks/useDeliveries.ts` and Supabase client
- To update auth logic: edit `contexts/AuthContext.tsx`
- To add a new delivery status: create a migration to ALTER the enum, run and commit before using the new value in policies or data
- To update live location logic: see `app/tracking.tsx` (user) and `app/(rider)/active-delivery.tsx` (rider)

---

---

**Recent Additions & Best Practices (Oct 2025):**

- Added 'nearby' to `delivery_status` enum (see migration order above)
- RLS policy for `rider_locations` now restricts SELECT to only the rider or the user assigned to the same delivery
- MapboxGL map is always visible for riders, with pickup/dropoff and live rider marker
- All users can select pickup/dropoff on map, but only delivery participants see live locations
- When updating enums, always run enum migration and commit before using new value in policies or data

For more details, see `README.md` and referenced files above. If a pattern or workflow is unclear, ask for clarification or check the relevant context/provider/hook file.
