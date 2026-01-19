# Google OAuth Screen Recording Checklist for Pulse

> **Last Updated:** January 2025
> **App:** Pulse by Logos Vision LLC
> **URL:** https://pulse.logosvision.org

---

## OAuth Scopes Being Requested

| Scope | API | Purpose |
|-------|-----|---------|
| `email` | OpenID Connect | Identify user account |
| `profile` | OpenID Connect | Display name and photo |
| `calendar.readonly` | Google Calendar API | Read calendar events |
| `calendar.events` | Google Calendar API | Create/edit/delete events |
| `gmail.readonly` | Gmail API | Read email messages |
| `gmail.send` | Gmail API | Send emails |
| `gmail.compose` | Gmail API | Create drafts |
| `gmail.modify` | Gmail API | Manage labels, star, archive |
| `contacts.readonly` | Google People API | Import Google contacts |

---

## Pre-Recording Setup

- [ ] **1.1** Open https://pulse.logosvision.org in Chrome
- [ ] **1.2** Ensure you are SIGNED OUT initially
- [ ] **1.3** Clear any cached Google sessions (optional)
- [ ] **1.4** Have screen recording software ready
- [ ] **1.5** Prepare a test email recipient address

---

## PART 1: OAuth Login Flow

### Scene 1: Initial Sign-In
- [ ] **1.1** Show the app in logged-out state (landing page)
- [ ] **1.2** Click "Sign in with Google" button
- [ ] **1.3** Show Google account selection screen
- [ ] **1.4** Select your Google account
- [ ] **1.5** Show the OAuth consent screen with ALL scopes listed:
  - [ ] See your email address
  - [ ] See your personal info (name, profile photo)
  - [ ] View your calendars
  - [ ] Manage your calendars
  - [ ] Read your emails
  - [ ] Send emails on your behalf
  - [ ] Manage drafts and send emails
  - [ ] Manage email labels
  - [ ] View your contacts
- [ ] **1.6** Click "Allow" / "Continue"
- [ ] **1.7** Show successful redirect back to Pulse (now logged in)

---

## PART 2: Profile & Authentication (email, profile)

### Scene 2: User Profile Display
- [ ] **2.1** Show user avatar in sidebar (from Google profile)
- [ ] **2.2** Show user name displayed correctly
- [ ] **2.3** Show user email address
- [ ] **2.4** Navigate to Settings > Profile
- [ ] **2.5** Show profile information populated from Google

---

## PART 3: Gmail Features (gmail.readonly, gmail.send, gmail.compose, gmail.modify)

### Scene 3: Reading Emails
- [ ] **3.1** Navigate to Email / Inbox section
- [ ] **3.2** Show inbox loading with real Gmail messages
- [ ] **3.3** Click on an email to view full content
- [ ] **3.4** Show email details (from, to, subject, body)
- [ ] **3.5** Navigate through folders: Inbox, Sent, Starred, Trash

### Scene 4: Managing Emails
- [ ] **4.1** **Star** an email (click star icon)
- [ ] **4.2** **Unstar** the email
- [ ] **4.3** **Mark as unread** an email
- [ ] **4.4** **Mark as read** the email
- [ ] **4.5** **Archive** an email
- [ ] **4.6** **Delete** (move to trash) an email

### Scene 5: Composing Emails
- [ ] **5.1** Click **Compose** / **New Email** button
- [ ] **5.2** Fill in recipient email address
- [ ] **5.3** Fill in subject line
- [ ] **5.4** Write email body content
- [ ] **5.5** **Save as Draft** (demonstrates gmail.compose)
- [ ] **5.6** Show draft appears in Drafts folder

### Scene 6: Sending Emails
- [ ] **6.1** Open a draft or compose new email
- [ ] **6.2** Click **Send** button
- [ ] **6.3** Show success confirmation
- [ ] **6.4** Verify email appears in Sent folder

### Scene 7: Replying to Emails
- [ ] **7.1** Open an email from inbox
- [ ] **7.2** Click **Reply** button
- [ ] **7.3** Type reply message
- [ ] **7.4** Send the reply
- [ ] **7.5** Show threaded conversation

---

## PART 4: Google Calendar Features (calendar.readonly, calendar.events)

### Scene 8: Viewing Calendar
- [ ] **8.1** Navigate to **Calendar** section
- [ ] **8.2** Show calendar loading with Google Calendar events
- [ ] **8.3** Click through views (day/week/month)
- [ ] **8.4** Click on an existing event to view details
- [ ] **8.5** Show event information (title, time, location, attendees)

### Scene 9: Creating Events
- [ ] **9.1** Click **Create Event** / **+ Add** button
- [ ] **9.2** Fill in event title
- [ ] **9.3** Set date and time
- [ ] **9.4** Add location (optional)
- [ ] **9.5** Add description (optional)
- [ ] **9.6** Save the event
- [ ] **9.7** Show new event appears on calendar
- [ ] **9.8** (Optional) Verify in calendar.google.com

### Scene 10: Editing Events
- [ ] **10.1** Click on an existing event
- [ ] **10.2** Click **Edit** button
- [ ] **10.3** Modify event details (title, time, etc.)
- [ ] **10.4** Save changes
- [ ] **10.5** Show updated event on calendar

### Scene 11: Deleting Events
- [ ] **11.1** Click on an event you created
- [ ] **11.2** Click **Delete** button
- [ ] **11.3** Confirm deletion
- [ ] **11.4** Show event removed from calendar

---

## PART 5: Google Contacts (contacts.readonly)

### Scene 12: Viewing Contacts
- [ ] **12.1** Navigate to **Contacts** section
- [ ] **12.2** Show contacts synced from Google
- [ ] **12.3** Click on a contact to view details
- [ ] **12.4** Show contact information (name, email, phone, organization)
- [ ] **12.5** Search for a contact by name

### Scene 13: Using Contacts
- [ ] **13.1** Start composing an email
- [ ] **13.2** Show contact suggestions in recipient field
- [ ] **13.3** Select a contact from suggestions
- [ ] **13.4** (Optional) Show contacts in meeting scheduling

---

## PART 6: Account Management (Required by Google)

### Scene 14: Account Menu
- [ ] **14.1** Click on profile picture/account selector in sidebar
- [ ] **14.2** Show account dropdown menu displaying:
  - [ ] User name and email
  - [ ] **Change Account** option
  - [ ] **Add Account** option
  - [ ] **Manage your Google Account** option
  - [ ] **Disconnect Google Account** option
  - [ ] **Revoke Access & Sign Out** option
  - [ ] **Sign Out** option

### Scene 15: Manage Google Account
- [ ] **15.1** Click **Manage your Google Account**
- [ ] **15.2** Show it opens Google Account page in new tab

### Scene 16: Disconnect Google Account
- [ ] **16.1** Click **Disconnect Google Account**
- [ ] **16.2** Show confirmation dialog
- [ ] **16.3** Explain what disconnecting does
- [ ] **16.4** (Either complete or cancel for demo)

### Scene 17: Revoke Access
- [ ] **17.1** Click **Revoke Access & Sign Out**
- [ ] **17.2** Show confirmation dialog explaining:
  - Revokes all Google permissions
  - Signs out completely
  - User must re-authorize to use Google features again

---

## PART 7: Privacy Policy & Documentation

### Scene 18: Privacy Policy
- [ ] **18.1** Navigate to **Privacy Policy** page
- [ ] **18.2** Scroll to show **Section 4: Google API Services**
- [ ] **18.3** Show **4.1 Authentication Permissions** (email, profile)
- [ ] **18.4** Show **4.2 Google Calendar Permissions** (calendar.readonly, calendar.events)
- [ ] **18.5** Show **4.3 Gmail Permissions** (gmail.readonly, gmail.send, gmail.compose, gmail.modify)
- [ ] **18.6** Show **4.4 Data Handling** section
- [ ] **18.7** Show link to Google API Services User Data Policy
- [ ] **18.8** Show **Section 8: Your Rights** with revocation options

---

## PART 8: Sign Out Flow

### Scene 19: Sign Out
- [ ] **19.1** Click on account menu
- [ ] **19.2** Click **Sign Out**
- [ ] **19.3** Show app returns to logged-out state
- [ ] **19.4** (Optional) Show that re-login re-requests permissions

---

## Summary Checklist

### Scopes Demonstrated
- [ ] `email` - User identification
- [ ] `profile` - Name and avatar display
- [ ] `calendar.readonly` - View calendar events
- [ ] `calendar.events` - Create, edit, delete events
- [ ] `gmail.readonly` - Read emails
- [ ] `gmail.send` - Send emails
- [ ] `gmail.compose` - Create drafts
- [ ] `gmail.modify` - Star, archive, mark read/unread
- [ ] `contacts.readonly` - View and search contacts

### Required Pages Shown
- [ ] OAuth consent screen with all scopes
- [ ] Email inbox and management
- [ ] Email composition and sending
- [ ] Calendar view and event management
- [ ] Contacts list and details
- [ ] Account management menu
- [ ] Disconnect/revoke options
- [ ] Privacy Policy with Google API section

---

## Recording Tips

1. **Narrate as you go** - Explain what each feature does
2. **Show real data** - Use actual Gmail/Calendar (blur sensitive info)
3. **Keep it concise** - Aim for 8-12 minutes total
4. **Demonstrate all scopes** - Google needs to see each permission used
5. **Show error states** - If token expires, show re-auth prompt
6. **Highlight privacy controls** - Emphasize disconnect/revoke options

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | OAuth scopes definition |
| `src/services/gmailService.ts` | Gmail API integration |
| `src/services/googleCalendarService.ts` | Calendar API integration |
| `src/services/googleContactsService.ts` | People API integration |
| `src/components/PrivacyPolicy.tsx` | Privacy policy with OAuth disclosure |
| `src/components/GoogleAccountSelector.tsx` | Account management UI |
| `src/components/Email/PulseEmailClient.tsx` | Email client UI |
| `src/components/Calendar.tsx` | Calendar UI |
