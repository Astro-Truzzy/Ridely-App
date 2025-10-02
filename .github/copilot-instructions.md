# Copilot Instructions for Ridely Rider App

## Project Overview

- **Type:** React Native (Expo) app for motorcycle dispatch riders and regular users
- **Backend:** Supabase (auth, database, RLS)
- **Major Features:** Dual user types, real-time delivery tracking, earnings management, secure authentication, responsive theming

## Key Architecture & Patterns

- **App Structure:**
  - All screens are in `app/` (with subfolders for auth, rider, tabs, booking, profile)
  - Layout files (`_layout.tsx`) define navigation and shared UI for each section
  - Contexts for auth and theming in `contexts/`
  - Custom hooks in `hooks/` for data fetching and business logic
  - Supabase integration in `lib/supabase.ts`
- **Navigation:**
  - Uses file-based routing (Expo Router)
  - Auth screens: `app/(auth)/`
  - Rider screens: `app/(rider)/`
  - Tabbed navigation: `app/(tabs)/`
- **Data Flow:**
  - All data access via Supabase (see `lib/supabase.ts`)
  - RLS policies enforced at the DB level (see migration SQL)
  - Use context providers for auth and theme state

## Developer Workflows

- **Setup:**
  - Configure `.env` with Supabase URL and anon key
  - Run DB migrations manually in Supabase SQL editor (`supabase/migrations/*.sql`)
- **Run App:**
  - `npm install`
  - `npm run dev` (starts Expo dev server)
- **Testing:**
  - No formal test suite; manual testing via Expo Go or device/emulator
- **Debugging:**
  - Use Expo/React Native debugging tools
  - Supabase errors surface in the app and console

## Project-Specific Conventions

- **User Types:**
  - Check `contexts/AuthContext.tsx` for user type logic
  - Rider-specific logic in `app/(rider)/`
- **Earnings:**
  - 15% Ridely fee auto-deducted (see DB and earnings logic)
- **Theming:**
  - System-aware dark/light mode via `contexts/ThemeContext.tsx`
- **Assets:**
  - Images/illustrations in `assets/`

## Integration Points

- **Supabase:**
  - All backend logic (auth, DB, RLS)
  - Migration file: `supabase/migrations/20250819221355_bitter_lab.sql`
- **Expo Router:**
  - File-based navigation, layouts, and deep linking

## Examples

- To add a new rider feature: create a screen in `app/(rider)/`, update navigation/layout as needed
- To fetch deliveries: use `hooks/useDeliveries.ts` and Supabase client
- To update auth logic: edit `contexts/AuthContext.tsx`

---

For more details, see `README.md` and referenced files above. If a pattern or workflow is unclear, ask for clarification or check the relevant context/provider/hook file.
