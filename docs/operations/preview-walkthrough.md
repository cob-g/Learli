# Exploring Learli step by step

A guided tour of the local preview, one role at a time. Every button and field
name below is written as it appears on screen.

The sample accounts in this guide exist only in the owner's Neon development
database. They were created on 2026-10-14 by private tooling in
`.local/demo-accounts/` and are not part of the repository.

## Before you start

1. Start the preview if it is not running: `npm run dev`.
2. Open <http://127.0.0.1:3000>.
3. Open the private page with the passwords:
   `.local/demo-accounts/accounts.html`. From the project folder you can run
   `open .local/demo-accounts/accounts.html`.
4. Use a normal window for one account and a private window for a second one.
   Several steps below need a parent and a tutor signed in at the same time.

Three things to know before you click around:

- **A booking lasts ten minutes.** A reservation here is a simulation. It holds
  the time for ten minutes, then moves to history as expired. Read the booking
  steps first, then do them in one go.
- **No email is sent.** Messages the app would send are saved on this computer.
  Run `npm run mail:open` to read the latest one.
- **Public pages always show "Sign in" in the header**, even when you are
  signed in. To get back to your own pages, go to
  <http://127.0.0.1:3000/account>.

## The sample accounts

| Account                | Sign in with                       | Used in |
| ---------------------- | ---------------------------------- | ------- |
| Sample Parent          | `demo-parent@learli.test`          | Part 2  |
| Sample Tutor Ben       | `demo-tutor-english@learli.test`   | Part 3  |
| Sample Tutor Maya      | `demo-tutor-math@learli.test`      | Part 3  |
| Sample College Student | `demo-student@learli.test`         | Part 4  |
| Sample Tutor Applicant | `demo-tutor-applicant@learli.test` | Part 5  |
| Sample Admin           | `demo-admin@learli.test`           | Part 5  |

To sign in, go to <http://127.0.0.1:3000/sign-in>, fill in **Test email** and
**Password**, and press **Sign in**. You land on **Your account**.

---

## Part 1: A visitor who is not signed in

This is what a family sees before creating an account.

1. Open the home page. The top of the page has a **What do you need help
   with?** search by subject and level. Scroll down: **Tutors on Learli** lists
   the sample tutors, and further down you see how a lesson comes together.
2. Go to **Find a tutor**. You should see **2 tutors**: Sample Tutor Ben and
   Sample Tutor Maya. The applicant is not listed, because nobody has approved
   that application yet.
3. Narrow the list. Choose a **Subject**, a **Level** or a **Teaching
   language**, then press **Apply filters**. Try Science: only Maya remains.
   Press **Clear filters** to see both again.
4. Press **View profile** on Sample Tutor Maya. The profile shows her subjects
   and levels, teaching languages, introduction and teaching background.
5. In the **Choose a time** panel, pick **Subject** Math and **Level** High
   School, leave **Time zone** as it is, and press **Load open times**. You see
   real dated times built from her weekly availability, shown in your time
   zone.
6. Open Sample Tutor Ben's profile and load his times for English. He teaches
   on New York time, so his hours appear in the early morning in Manila. This
   is the time zone conversion at work.
7. Go to **Get matched**. Answer the three questions:
   - Question 1: choose a level, then **Continue**.
   - Question 2: choose a subject, then **Continue**.
   - Question 3: choose **Any time**, or **Preferred days and times** with
     weekdays and a time of day, then **Show matching tutors**.
8. Go to **Subjects**. Choose a subject or one of the levels beside it to jump
   to the tutors who teach it.

You can load open times without an account. Reserving a time needs one.

---

## Part 2: A parent booking for a child

Sign in as **Sample Parent**.

### See the account and the learners

1. On **Your account**, look at **Profile settings**. The **Time zone** here
   decides how every time is shown to this account. It is set to Manila.
2. Under **Your workspaces**, open **Parent workspace**. The address is
   <http://127.0.0.1:3000/parent>.
3. Choose **Learners** in the workspace menu. You see **Sample learner Ana**
   (Elementary) and **Sample learner Leo** (High School).
4. Press **Create a local learner**. Fill in **Display name**, **Level** and
   **Time zone**, then **Create local learner**. Use a made-up name. Learli
   asks for no birth date, school or address.
5. Press **Edit profile** on a learner, change the level, and **Save profile**.

### Book a lesson

Before you start, sign in as **Sample Tutor Ben** in a private window and leave
it open. You have ten minutes once the reservation is made.

1. In the parent's window, go to **Find a tutor** and open **Sample Tutor
   Ben**.
2. In **Choose a time**, pick **Subject** English and **Level** Elementary,
   then **Load open times**.
3. Choose one of the times, then press **Review simulated booking**. If you
   were signed out, you would be asked to sign in here and brought back to the
   same choice.
4. On the **Simulated booking** page, the tutor, the subject and your
   **Requested time** are already filled in. Under **Choose who this lesson is
   for**, choose **Sample learner Ana · Elementary**.
5. Check the **Subject** box. It clears if you choose a learner at a different
   level from the one you picked on the profile, because a tutor may not teach
   that subject at that level. If it cleared, choose the subject again.
6. Press **Load open times** again. The server checks the tutor's times for
   that learner.
7. Choose a time and press **Create simulated reservation**.
8. You should see **Simulated reservation saved**, with the learner, the tutor,
   the subject and an **Expires at** time. Press **View booking details**.

### Look at the booking

1. **Booking details** shows the lesson time in your time zone and the
   reservation's status.
2. **Test meeting link** says **No test meeting link has been provided.** The
   tutor adds it in Part 3. Leave this page open.
3. **Saved booking history** lists what has happened to this booking so far.
4. Go back to the **Parent workspace**. The reservation is under **Active
   simulated reservations**. Use **Show bookings for** to see one learner's
   bookings only, then press **Show bookings**.

### Move or cancel it

Do this after Part 3 if you want to see the meeting link first.

1. On **Booking details**, under **Change this simulation**, press
   **Reschedule simulation**.
2. Choose another time and press **Move simulated reservation**. The first
   booking is marked as replaced and a new one takes its place. The ten-minute
   deadline does not restart, and the meeting link is not carried over.
3. To cancel instead, press **Cancel simulation** and confirm. The time is
   released and the booking stays in the history.

After ten minutes the reservation shows under **Reservation history** as
expired. That is expected.

---

## Part 3: The tutor's side

Use the private window where **Sample Tutor Ben** is signed in. If it shows
**Your account**, choose **Tutor workspace** under **Your workspaces**. The
address is <http://127.0.0.1:3000/tutor>.

### Answer the booking

1. **Your bookings** shows the parent's reservation under **Next future
   simulation**: the learner's name, the subject, the level and when the
   simulation expires. The tutor sees only what is needed to teach the lesson.
2. Press **View booking**.
3. Under **Test meeting link**, paste a Zoom or Google Meet link from your own
   account into **Zoom or Google Meet test link**, then press **Save test
   meeting link**. Only Zoom and Google Meet addresses are accepted. Try any
   other website to see it refused.
4. Switch to the parent's window. On **Booking details**, press **Reload
   meeting link**. The parent now has a link that opens the meeting in a new
   tab.
5. The link is private to this booking. To check that, copy the booking's
   address into a window signed in as a different account, such as Sample
   College Student. The page says **We can't find that booking on this
   account**.

### Manage the tutor's own details

1. Choose **Availability**. Each weekday has its hours, in the **Teaching time
   zone**. Press **Add time range** on a day, set **Start time** and **End
   time**, then **Save availability**. Open Ben's public profile again and load
   his times: the new hours are there.
2. Choose **Time off**. Fill in **Start date and time** and **End date and
   time** for a day next week, then **Add time off**. That day's times
   disappear from his public profile. Time off cannot overlap a reservation
   that is still live.
3. Choose **Profile**. Change the **Headline**, tick another level under
   **Subjects and levels**, and press **Save profile**. Press **View public
   profile** to see the result.

Sample Tutor Maya works the same way. Her **Simulation history** already holds
a reservation marked **Simulation expired**.

---

## Part 4: A college student who books for themself

Sign in as **Sample College Student**.

1. Under **Your workspaces**, open **Student workspace**. No parent account is
   involved.
2. Choose **Your learners**. There is one profile, the student's own, at
   **College Support**.
3. Go to **Find a tutor** and open **Sample Tutor Maya**.
4. In **Choose a time**, pick **Subject** Math and **Level** College Support,
   then **Load open times**.
5. Choose a time and press **Review simulated booking**.
6. The page says **Booking for you · College Support**. There is no learner to
   choose. Press **Create simulated reservation**.
7. Open the **Student workspace** to see it under **Active simulated
   reservations**.

Try to book the same time as the parent, with the same tutor, from two windows.
Only one of the two reservations is saved.

---

## Part 5: A tutor application and the admin who reviews it

### What an applicant sees

Sign in as **Sample Tutor Applicant** and open <http://127.0.0.1:3000/tutor>.

1. The workspace says **Learli is reviewing your application**.
2. Choose **Profile**. It says **Your profile cannot be booked until it is
   public.** The applicant can still edit the profile and set availability.
3. In another window, check **Find a tutor**. The applicant is not there.

### Set up the admin's authenticator (first time only)

You need an authenticator app on your phone, such as Google Authenticator or
Microsoft Authenticator.

1. Sign in as **Sample Admin** and go to <http://127.0.0.1:3000/admin>.
2. You are sent to **Administrator security**. Enter the admin's password in
   **Current password** and press **Set up authenticator**.
3. A setup key appears. In your authenticator app, add an account by entering a
   key manually, name it Learli, and type the key in. There is no QR code.
4. Enter the six-digit code from the app in **Authenticator code** and press
   **Verify administrator access**.
5. **Save recovery codes privately** appears. Copy the codes somewhere safe.
   They are shown once. Then press **Close recovery codes**.

On later visits you are asked only for the **Authenticator code**. If you lose
the phone, use **Use recovery code**.

### Review the application

1. Go to <http://127.0.0.1:3000/admin>. The work areas are **Tutor review
   queue**, **Subjects**, **Assigned support cases**, **Private synthetic
   reviews**, **Synthetic publication reviews** and **Authorized local
   accounts**.
2. Open **Tutor review queue**. Sample Tutor Applicant is waiting.
3. Open the application and read what the tutor wrote.
4. Press **Approve application** and confirm.
5. Check **Find a tutor** in another window. There are now three tutors.
6. Back in the application, **Suspend tutor** removes the listing again, and
   **Reinstate tutor** restores it.

Approval here is a button for testing. The real screening process for tutors
is not decided yet.

---

## Part 6: Starting from nothing

This is the journey of someone who has never used Learli.

1. Sign out, then go to <http://127.0.0.1:3000/sign-up>.
2. Fill in **Display name**, **Test email** and **Password**, then press
   **Create test account**. The email must end in `.test`, for example
   `newtutor@example.test`. The password needs 12 characters or more.
3. In a terminal in the project folder, run `npm run mail:open`. The
   verification message opens. Follow its link.
4. Sign in with the new account.
5. Go to **Become a tutor** and press **Start tutor application**.
6. Fill in **Headline**, **Introduction**, **Teaching background** and **Time
   zone**, tick at least one level under **Subjects and levels**, and press
   **Submit application**.
7. The new application appears in the admin's **Tutor review queue**.

A new account can apply to teach. It cannot act as a parent or a student: the
app does not let an account give itself those roles, because the rules for
guardian consent are not decided. Use the sample parent and student for those
journeys.

---

## Part 7: Account settings and support

Any signed-in account can do these from **Your account**.

1. **Profile settings**: change the **Display name** or **Time zone**, then
   **Save settings**. Change the time zone and open a booking: the same lesson
   is shown at the new local time.
2. **Change password**: fill in the three fields and press **Change password**.
   Other signed-in sessions are ended.
3. **Manage account sessions**: see where the account is signed in and press
   **End session** on one you do not recognise.
4. **Change account email**: press **Send current-address code**, then read
   the code with `npm run mail:open`.
5. **Forgot password?** on the sign-in page: enter the email, press **Request
   reset link**, and read the message with `npm run mail:open`.
6. **Contact support** and **Report a concern**, in the footer: choose a
   **Category**, write a **Subject** and a **Fictional description**, and press
   **Save fictional report**. See it later under **Your reports**. Use made-up
   details only. Nobody monitors these reports.

---

## What is switched off

These parts are not available in the preview, on purpose. Each one waits for a
business decision.

- **Confirmed lessons.** A reservation never becomes a confirmed lesson.
- **Payment and prices.** There is no checkout and no pricing page.
- **Public reviews and ratings.** Tutor profiles show none.
- **Real tutor screening and guardian consent.** The **Tutor screening** page
  says new screening workflows are disabled.
- **Real email.** Nothing leaves this computer.

## If something goes wrong

- **"Unavailable" or an error page.** The development database sometimes drops
  a connection. Reload the page.
- **A click takes a second or two.** A thin bar runs along the top of the
  window while the next page loads. The first click after about five minutes
  away is the slowest, because the development database has gone to sleep and
  has to wake up.
- **Pages flash and reload over and over, or fields keep clearing.** This came
  from the preview's saved build cache, which is now turned off. If it happens
  anyway, stop `npm run dev`, delete `.next/dev` (`rm -rf .next/dev`) and start
  it again. Nothing in the database changes.
- **The reservation disappeared.** It expired after ten minutes. Look under
  **Reservation history**, then make a new one.
- **A time cannot be reserved.** Someone else holds it, or the tutor has time
  off then. Load the open times again and choose another.
- **The sign-in page rejects the password.** Copy it again from
  `.local/demo-accounts/accounts.html`. Click a password once to select all of
  it.
- **The admin's authenticator is lost and the recovery codes too.** Ask for
  the sample accounts to be created again.
- **You want the starting state back.** Run
  `node --import tsx .local/demo-accounts/seed.mjs` from the project folder.
  It adds only what is missing and never deletes anything.
