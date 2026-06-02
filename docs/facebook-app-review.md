# Facebook App Review Checklist — Creators Marketplace (App ID 2239652853105067)

This document contains everything needed to submit the "Creators Marketplace" (Usch-Ja!) Facebook app for review and get **Advanced Access** on the permissions required for public users to connect their Facebook Pages.

Reviewer-facing text is in **English** (Meta reviewers don't read Swedish).
All copy-paste blocks are marked with `>>> COPY <<<` so you can drop them straight into the form.

---

## 0. Pre-flight checklist

Verify in https://developers.facebook.com/apps/2239652853105067/

- [ ] App is in **Live** mode (toggle top right)
- [ ] **Settings → Basic**:
  - App Domains: `usha.se`
  - Privacy Policy URL: `https://usha.se/privacy`
  - Terms of Service URL: `https://usha.se/terms`
  - User data deletion: `https://usha.se/api/facebook/data-deletion` *(needs to be created — see §1)*
  - Category: Business and Pages
  - Contact email: a monitored address (pablo.aztk@gmail.com is current — change to pablo.acosta@usha.se if you want company branding)
- [ ] **Facebook Login for Business → Settings**:
  - Client OAuth Login: **Yes**
  - Web OAuth Login: **Yes**
  - Enforce HTTPS: **Yes**
  - Use Strict Mode for redirect URIs: **Yes**
  - **Valid OAuth Redirect URIs** contains BOTH:
    - `https://usha.se/api/facebook/callback`
    - `https://usha.se/api/instagram/callback`
- [ ] **App roles**: Add a Meta-test-account-friendly user (see §6) or be ready to share test credentials via the review form
- [ ] **Business Verification** completed (Meta requires this before App Review for business apps — check https://business.facebook.com/settings/security)

---

## 1. Create Facebook data-deletion endpoint

Meta requires a URL that handles user-data-deletion-requests when the user deletes their Facebook account or revokes the app. We already have `/api/instagram/data-deletion`. Create the Facebook version (same logic, just for the Facebook data we store).

**File to create:** `src/app/api/facebook/data-deletion/route.ts`

The endpoint should:
1. Accept POST with Facebook's signed_request body
2. Verify the signed_request using FACEBOOK_APP_SECRET
3. Delete rows from `social_connections` where `facebook_page_id` matches the user's Facebook user ID
4. Return JSON: `{ url, confirmation_code }` where `url` is a status page and `confirmation_code` is a short hash

The Instagram endpoint already does this — copy its structure, swap Instagram-specific fields for Facebook.

Status page to create: `src/app/data-deletion/[code]/page.tsx` — just confirms "Your Facebook data was deleted on [date]".

After deploy, register the URL in Settings → Basic → User data deletion: `https://usha.se/api/facebook/data-deletion`

---

## 2. Permissions to request — exact submission text

Submit these together in **App Review → Permissions and Features** at https://developers.facebook.com/apps/2239652853105067/app-review/permissions/

### 2.1 `public_profile` (Advanced Access)

>>> COPY — "How is your App using this permission/feature?" <<<
```
Creators Marketplace (Usch-Ja!) is a Swedish marketplace where dance instructors, event organizers, and experience providers can list their services and sell tickets/bookings. We use public_profile during the Facebook Login flow to display the creator's name and profile photo in our own app UI immediately after they authenticate, so they can confirm they connected the correct Facebook account before proceeding to select which Page to link.

We do not store the public_profile data outside of the user's active session. The display name and avatar shown during the post-login confirmation screen come directly from the access token response and are never persisted to our database. We persist only the Page ID, Page name, and Page access token (in the social_connections table, row-level-security-protected so only the owning user can read it).

We chose Facebook Login for Business because our app is targeted at professional creators who manage Facebook Pages for their business, not at consumer-facing social features. public_profile is mandatory for this product per Meta's documentation.
```

>>> COPY — Why advanced access is needed <<<
```
Standard access blocks Facebook Login for Business entirely. Any creator who registers on usha.se and clicks "Connect Facebook" sees a hard error in the OAuth dialog. Without advanced access on public_profile, the feature cannot launch publicly.
```

---

### 2.2 `pages_show_list`

>>> COPY — How are you using this permission? <<<
```
After a creator completes Facebook Login on usha.se, our callback at https://usha.se/api/facebook/callback calls GET /me/accounts to retrieve the list of Pages the user manages. We display this list in a "Choose your Page" UI (/app/events/select-page) so the creator can pick which Page to connect to their Usch-Ja! profile. If they manage only one Page, we skip the picker and connect it automatically.

This permission is required because creators frequently manage multiple Pages (one for each studio, one personal brand, etc.). We can't pre-select a Page on their behalf — they must consciously choose which Page Usch-Ja! is allowed to post to.

The retrieved Page IDs, names, and Page access tokens are stored in our social_connections table (row-level-security-protected per user). We do not transmit the list of Pages to any third party.
```

---

### 2.3 `pages_manage_posts`

>>> COPY — How are you using this permission? <<<
```
This is the core integration that creators sign up for. When a creator publishes an event in Usch-Ja! (for example, "Privat danslektion, 90 min, 800 SEK, Stockholm"), they can click "Sync to Facebook" on the event card. Our backend at https://usha.se/api/facebook/sync-event:

1. Reads the event from our database
2. Composes a post with the event title, description, price, and a link to the booking page on usha.se
3. If the event has an image, calls POST /{page-id}/photos with the image URL and message
4. If no image, calls POST /{page-id}/feed with just the message
5. Saves the returned Facebook post ID back to our database so subsequent edits update the same post (POST /{post-id} with updated message)

This permission is what makes Usch-Ja! valuable to creators — they list their events once on our platform and reach both their existing Facebook Page followers and the new audience discovering them through our marketplace. Without pages_manage_posts the entire posting workflow is impossible.

We post only to Pages the creator has explicitly connected. Each post is initiated by an explicit user action (clicking "Sync" on an event in our dashboard). We never auto-post without user intent.
```

---

### 2.4 `pages_read_engagement`

>>> COPY — How are you using this permission? <<<
```
This permission is bundled with pages_manage_posts by Meta — Facebook requires it for the publish flow to work end-to-end. After publishing an event post via /{page-id}/photos or /{page-id}/feed, we read the post ID from the response so we can:

1. Display a "Posted to Facebook ✓" badge in our event dashboard with a link to the live Facebook post
2. Update the same post later if the creator edits the event in Usch-Ja!
3. Track which events have been synced (vs which are still drafts)

We do not aggregate engagement metrics, do not show like/comment counts in our UI, and do not export this data anywhere. The permission is used purely to enable the publish/update flow.
```

---

### 2.5 `pages_read_user_content`

>>> COPY — How are you using this permission? <<<
```
Creators who already maintain a Facebook Page with upcoming events frequently ask us to import those events into Usch-Ja! instead of re-typing them. Our endpoint at https://usha.se/api/facebook/import-events calls GET /{page-id}/events?time_filter=upcoming to fetch the next 25 upcoming events from the creator's Page, then creates draft listings in Usch-Ja! for any that aren't already imported (deduplicated by the Facebook event ID we store in listings.facebook_event_id).

The creator triggers this manually via "Import from Facebook" in our event dashboard. We do not run periodic background syncs. We read only events on Pages the creator owns — we never read posts, comments, or any other user-generated content from the Page.

This permission saves creators 5-15 minutes per event setup and is a major reason they pay for our platform.
```

---

## 3. Screencast scripts — one per permission

Meta requires a **screencast (video, max 5 min each)** showing the permission in actual use end-to-end. Record one combined video for all 5 permissions if you can fit it in 5 min, otherwise split per permission.

Record using QuickTime (Cmd+Shift+5 → Record Selected Portion). Use a clean browser window with no other tabs visible. Use the test creator account (§6) so reviewers can re-do the flow themselves.

### Universal opening (first 15 seconds of every recording)

```
[Screen: usha.se home page]
Narrator (or on-screen caption): "This is Usch-Ja! (creators-platform), a Swedish marketplace for dance instructors and event organizers. I'm logged in as a test creator. I'll now demonstrate how we use [PERMISSION_NAME]."
```

### Script for `public_profile` + `pages_show_list` (record together — same flow)

```
1. Navigate to https://usha.se/app/events
2. Click "Anslut Facebook" (Connect Facebook)
3. [Browser redirects to Facebook OAuth dialog]
4. Show the permissions Facebook is asking for — point at "your name and profile picture" and "list of Pages you manage"
5. Click "Continue as [Name]"
6. [Browser redirects to usha.se/app/events/select-page IF creator manages multiple Pages, OR directly back to /app/events with the Page auto-selected]
7. If multiple Pages: show the "Choose your Page" UI listing all Pages, click one to confirm
8. Back in /app/events, the Facebook-sync panel now shows "Sida: [Page Name]" — this confirms public_profile + pages_show_list were used to display the user's name and Page list during the connect flow
9. End recording
```

### Script for `pages_manage_posts` + `pages_read_engagement` (record together)

```
1. From /app/events, click "Skapa nytt evenemang" (Create new event)
2. Fill in: Title="Dance workshop test", Description="Test description for App Review", Date=tomorrow, Price=200
3. Upload an image
4. Click "Save"
5. Back in /app/events, find the new event card, click the three-dots menu, click "Sync to Facebook" (or the FB-sync icon)
6. Show the success toast: "Posted to Facebook"
7. Click the "View on Facebook" link → opens the Facebook post in a new tab
8. Show that the post exists on the connected Page with the event title, description, price, and the usha.se booking link
9. Back in /app/events, click "Sync to Facebook" again on the same event after editing the description
10. Show that the same Facebook post is now updated (not a new post) — this demonstrates pages_read_engagement reading the stored post_id to update
11. End recording
```

### Script for `pages_read_user_content`

```
1. Pre-requisite: the connected Facebook Page must have at least one upcoming event scheduled (create one manually on Facebook before recording)
2. Navigate to /app/events
3. Click "Import from Facebook" (button in the Facebook-sync panel)
4. Show the loading state
5. Show the success toast: "Imported 1 event"
6. Scroll down the events list — show the newly imported event with the title, description, and a "Imported from Facebook" badge
7. End recording
```

---

## 4. Test instructions for the reviewer

Meta reviewers need to be able to reproduce the flow themselves. Provide:

>>> COPY — Test instructions <<<
```
Test environment: https://usha.se (production)

Test account credentials:
  Email: [CREATE A NEW TEST ACCOUNT — SEE §6]
  Password: [SET A PASSWORD AND PASTE HERE]

Step-by-step:
1. Open https://usha.se/login in an incognito window
2. Sign in with the credentials above
3. You will land on /app — switch to the "Creator" role in the top-right pill if not already selected
4. Click "More" (bottom nav) → "Events" (or navigate directly to https://usha.se/app/events)
5. Click "Anslut Facebook" (Connect Facebook). NOTE: The test account is pre-linked to a test Facebook user that manages one test Page.
6. After OAuth completes you'll be back on /app/events with the Page connected — this demonstrates public_profile + pages_show_list
7. Click "Skapa nytt evenemang", fill in any test data, save — you'll have a new event card
8. On the event card, click the three-dots menu → "Sync to Facebook"
9. Click the resulting "View on Facebook" link to verify the post was created — demonstrates pages_manage_posts + pages_read_engagement
10. On the Facebook-sync panel, click "Import from Facebook" — this fetches upcoming events from the connected Page and imports any new ones — demonstrates pages_read_user_content

If you have questions, contact us at pablo.acosta@usha.se.
```

---

## 5. Business Verification

Meta requires Business Verification before granting Advanced Access for Pages permissions. Check status at:
https://business.facebook.com/settings/security?business_id=<your-business-id>

If not done:
1. Go to Meta Business Suite → Settings → Business Info → Verify
2. Upload Usha AB company documents:
   - **Org.nr 559401-8326** (Swedish corporate number)
   - **Bolagsverket-utdrag** (Companies Registry extract) — fresh, under 90 days old
   - **Address proof** — utility bill or bank statement with company address
3. Wait 2-5 business days for Meta to verify
4. **You must complete Business Verification before App Review can be approved.** If it's not done, start it today in parallel.

---

## 6. Create a test creator account for the reviewer

Meta reviewers need a test account that they can log in to without 2FA, BankID, or other Swedish-only auth gates.

In our system:
1. On https://usha.se/signup, create a fresh account with a throwaway email like `meta-review-2026@usha.se` (or use a real Meta-provided test user — see https://developers.facebook.com/apps/2239652853105067/roles/test-users/)
2. Set role = "creator" via Supabase (since BankID can't be done remotely by the reviewer):
   ```sql
   UPDATE public.profiles SET role = 'creator', bankid_verified_at = now(),
   bankid_name = 'Meta Test User', bankid_personal_number = 'mock-meta-review-hash'
   WHERE email = 'meta-review-2026@usha.se';
   ```
   (Note: bankid_personal_number is hashed and unique-indexed — use a clearly fake value that won't collide.)
3. Create a Meta Test Facebook User at https://developers.facebook.com/apps/2239652853105067/roles/test-users/ (these are sandboxed users that can be Page-admin without affecting real Facebook accounts)
4. Connect that Test User to a Test Page (auto-created with the Test User)
5. Add a couple of upcoming Test Events to the Test Page so the import flow has data
6. Log into usha.se with the test account, run through the Connect Facebook flow once to make sure it works end-to-end with the Test User/Test Page
7. Paste the credentials (Usch-Ja! login + reminder that Facebook Test User is auto-detected) into the App Review form's Test Account section

---

## 7. Submission flow

1. Go to https://developers.facebook.com/apps/2239652853105067/app-review/permissions/
2. For each permission, click "Request" or "Submit for Review"
3. Paste the corresponding §2.x text into "How is your App using this permission/feature?"
4. Upload the screencast video for that permission (§3)
5. Paste the §4 test instructions into "Test Instructions"
6. Mark the form as ready and submit
7. Submit all 5 permissions in **one batch** — Meta processes them together and a partial submission gets rejected

Expected timeline:
- Submission queued: same day
- First reviewer response: 3-7 business days
- If they request changes: respond within 7 days or the submission is closed
- Typical full cycle: 1-3 weeks

---

## 8. Common rejection reasons (and how we already address them)

| Rejection reason | Why we're safe |
|---|---|
| "App doesn't have a clear use case" | Our use case is concrete (dance/event marketplace) and the permissions map 1:1 to specific features in the UI |
| "Screencast doesn't show actual usage" | §3 scripts show end-to-end flows including the Facebook side (the post existing on the Page, the event being imported) |
| "No privacy policy" | https://usha.se/privacy is live |
| "Missing data deletion endpoint" | §1 — we're creating /api/facebook/data-deletion before submitting |
| "Business not verified" | §5 — start Business Verification today |
| "Test account doesn't work" | §6 — we provide working credentials + pre-linked Test Page |
| "Asking for more permissions than needed" | We only request the 5 that are actually used in code (verified against `src/app/api/facebook/*`) |

---

## 9. Until App Review is approved — public users will see…

Without Advanced Access, public creators (non-admin, non-tester) attempting to connect Facebook will see one of:
- "App not active for your account" error in the OAuth dialog
- Permissions screen but the resulting access token returns empty `data` on /me/accounts
- The connection flow silently completes but no Page is stored

Mitigation while waiting for review:
- Add ~5-10 friendly creators as **Testers** under App roles (https://developers.facebook.com/apps/2239652853105067/roles/) — they can use the full flow without App Review
- Don't promote the Facebook integration on the marketing site until review is approved
- Have a fallback path for non-FB creators (already in place — they just don't see the sync panel)

---

## 10. Action items in order

- [ ] **Today (1h):** Create `/api/facebook/data-deletion` endpoint + status page (§1)
- [ ] **Today (5 min):** Add the URL in Settings → Basic → User data deletion
- [ ] **Today (5 min):** Add `https://usha.se/api/facebook/callback` to Valid OAuth Redirect URIs and click Save (the immediate fix)
- [ ] **Today (10 min):** Start Business Verification on Meta Business Suite (§5) — this runs in parallel
- [ ] **This week (1 day):** Record 3 screencasts (§3)
- [ ] **This week (30 min):** Create test creator account (§6)
- [ ] **This week (15 min):** Submit all 5 permissions together (§7)
- [ ] **In parallel (this week):** Add 5-10 friendly creators as Testers under App roles so they can pilot the Facebook sync feature while review is pending
