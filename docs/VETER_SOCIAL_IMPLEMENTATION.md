# Veter Social implementation plan

## Product scope

Veter Social is a global conversation product on the Veter website. The intended release sequence is:

1. Responsive product surface and navigation.
2. Authentication: Firebase Google sign-in and phone OTP.
3. User profiles stored in Supabase Postgres.
4. Real-time one-to-one text conversations and random matching.
5. Safety controls: block, report, rate limits, moderation queue, and account suspension.
6. Voice/video only after text chat, moderation, and operational monitoring are stable.

The current `social.html` is still a staged product surface. Firebase sign-in is wired in the browser and profile synchronization targets Supabase, but the Firebase-to-Supabase trust integration and trusted chat functions must be configured and tested before real messaging is enabled.

## Backend architecture

- **Firebase Authentication:** Google sign-in and phone OTP only. Firebase remains the identity provider.
- **Supabase Postgres:** The application database for public profiles, conversations, messages, blocks, and reports.
- **Supabase Realtime:** Add only after authenticated conversation subscriptions and RLS authorization are verified.
- **Supabase Edge Functions or a trusted server:** Conversation creation, matchmaking, message writes, rate limits, block enforcement, and moderation workflows.
- **GitHub:** Website source code.
- **Render:** Static website hosting.

Do not use Firestore as the Veter Social application database. The Firebase project may remain for Authentication; any Firestore database created during setup is currently unused.

## Firebase Auth with Supabase

The Supabase project is `Veter Social` (region `ap-south-1`). Its Firebase third-party auth integration must be configured with Firebase project ID `veter-social` before browser database requests can succeed.

The website obtains the current Firebase ID token and supplies it to `supabase-js` through the `accessToken` callback. Supabase RLS policies validate the Firebase issuer, audience, and subject. Current Firebase tokens without a `role` claim are treated as the `anon` Postgres role; the initial schema therefore grants that role only narrowly scoped privileges, with RLS enforcing the identity checks. Never grant broad anonymous access.

The Supabase publishable key may be present in browser code. Never expose a Supabase secret/service-role key, Firebase service-account JSON, private signing key, or database password in the website repository.

## Database schema currently created

- `user_profiles/{uid}` (Postgres `public.user_profiles`): public profile fields only — Firebase UID, display name, avatar URL, country, languages, timestamps. No email or phone number.
- `conversations/{id}` (Postgres `public.conversations`): two participant UIDs, state, creation and last-message timestamps. Client reads are participant-only. Creation and updates are server-only.
- `messages/{id}` (Postgres `public.messages`): conversation, sender UID, bounded body, timestamp. Client reads are participant-only. Direct client inserts, edits, and deletes are disabled; trusted server code must write messages.
- `blocks` (Postgres `public.blocks`): block relationships. A user can read and manage only their own block list.
- `reports` (Postgres `public.reports`): user-submitted reports tied to a conversation. Report status is server-managed.

RLS is enabled on all five tables. The Data API has explicit minimum grants; RLS remains the row-level authorization layer. The Supabase security advisor returned no security findings at the last check.

## Required remaining setup

1. In Supabase Dashboard, configure Authentication → Third-Party Auth → Firebase with project ID `veter-social`.
2. Confirm Google and Phone providers are enabled in Firebase Authentication and `theveter.in` is an authorized domain.
3. Test Firebase sign-in, token forwarding, and profile upsert from the production website.
4. Build trusted server functions for matching, conversation creation, message writes, block enforcement, report review, rate limiting, and abuse handling.
5. Enable Realtime only after confirming conversation-level authorization.
6. Add account deletion/export, privacy policy, terms, moderation procedures, and operational monitoring before public launch.

## Safety and privacy requirements

- Launch with an adult-only service unless a separately reviewed child-safety programme, age assurance, staffing, and legal requirements are in place. Do not expose minors to random adult stranger matching.
- Never reveal email addresses or phone numbers to chat partners.
- Block/report/leave controls must be present before public chat launch.
- Apply per-account and per-IP throttling, message length limits, spam detection, and queue expiry.
- Do not expose global user lists, private profiles, or the matchmaking queue.
- Report review status and conversation participant assignment must be server-managed.
- Voice/video requires consent, abuse reporting, operational moderation, and additional privacy review.

## Current status

The Supabase project and initial secure schema are created. Firebase-to-Supabase third-party auth still needs one dashboard configuration step. The website can attempt to synchronize profiles after sign-in, but live chat, matchmaking, and message writes remain disabled until trusted server logic and safety controls are implemented and tested.
