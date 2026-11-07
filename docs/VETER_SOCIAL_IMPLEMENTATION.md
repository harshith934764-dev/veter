# Veter Social implementation plan

## Product scope

Veter Social is a global conversation product on the Veter website. The intended release sequence is:

1. Responsive product surface and navigation.
2. Authentication: Google OAuth and phone OTP using a managed identity provider.
3. User profiles with minimal public fields and private account fields.
4. Real-time one-to-one text conversations and random matching.
5. Safety controls: block, report, rate limits, moderation queue, and account suspension.
6. Voice/video only after text chat, moderation, and operational monitoring are stable.

The current `social.html` is a product preview. It does not authenticate users, create accounts, match strangers, or send messages. The preview deliberately says so; do not remove that notice until the backend is deployed and tested.

## Recommended backend

Use Firebase Authentication for Google sign-in and phone verification, Cloud Firestore for profiles/conversations/messages, and Cloud Functions (or a separately hosted trusted API) for matchmaking, abuse throttling, and moderation actions.

Do not implement OTP generation or verification in browser code. Do not trust a client-supplied user ID, match partner, role, report status, or moderation decision. Server code must derive identity from a verified Firebase ID token.

## Required setup before enabling authentication

1. Create a Firebase project owned by the Veter operator.
2. Register the production web domain and configure the Firebase web app.
3. Enable Google and Phone providers in Firebase Authentication.
4. Configure authorized domains, SMS region policy, abuse protection, and billing/quotas.
5. Add the Firebase web configuration to the site's deployment environment/build process. Web API keys are identifiers, not service-account secrets; never publish service-account JSON or private keys.
6. Deploy and test Firestore rules and trusted server functions before enabling any client writes.
7. Verify email/phone flows, account deletion, session revocation, rate limits, and moderation before inviting the public.

## Initial data model

- `users/{uid}`: public profile only (displayName, photoURL, country, languages, createdAt, status).
- `userPrivate/{uid}`: private preferences and provider metadata; never publicly readable.
- `conversations/{conversationId}`: participant UIDs, state, createdAt, lastMessageAt.
- `conversations/{conversationId}/messages/{messageId}`: sender UID, bounded text, createdAt.
- `blocks/{uid}/users/{blockedUid}`: block relationship.
- `reports/{reportId}`: reporter UID, reported UID, conversation reference, reason, review status; create through trusted server validation where possible.
- `matchQueue/{uid}`: server-managed queue entries with expiry and matching state. Clients must not read the global queue.

## Safety and privacy requirements

- Launch with an adult-only service unless a separately reviewed child-safety programme, age assurance, staffing, and legal requirements are in place. Do not expose minors to random adult stranger matching.
- Never reveal email addresses or phone numbers to chat partners.
- Add block/report/leave controls before public chat launch.
- Apply per-account and per-IP throttling, message length limits, spam detection, and queue expiry.
- Do not expose global user lists, private profiles, or the matchmaking queue.
- Add deletion/export workflows and a clear privacy policy/terms before launch.
- Voice/video requires consent, abuse reporting, operational moderation, and additional privacy review.

## Current status

The repository currently contains a static website. This preview page is not a deployed chat service. Hosting and a managed backend must be configured separately; merging static files alone cannot activate sign-in, OTP, live messaging, or calls.
