DM SHOP MANAGER — SETUP GUIDE

Is ZIP mein mobile-friendly installable web app hai. App ka naam DM Shop Manager hai.
Features: private login, daily income/expense, category, date, recent records, today's total and net balance.

IMPORTANT: Supabase credentials is ZIP mein jaan-bujhkar blank hain. Apni key kisi ko chat mein mat bhejna.

STEP 1 — Supabase project details
1. Supabase Dashboard mein apna project kholo.
2. Project URL copy karo.
3. Project Settings > API Keys mein Publishable key (ya legacy anon public key) copy karo.
4. ZIP extract karke config.js file ko text editor mein kholo.
5. PASTE_SUPABASE_PROJECT_URL_HERE aur PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE ko apni values se replace karo.
6. Service role / secret key kabhi bhi config.js mein mat daalna.

STEP 2 — Database banana
1. Supabase Dashboard > SQL Editor > New query kholo.
2. supabase_setup.sql ka poora code paste karke Run karo.
3. Table Editor mein transactions table dikhni chahiye.

STEP 3 — Invite-only login
1. Supabase > Authentication > Settings mein public sign-ups / Allow new users to sign up OFF karo.
2. Authentication > Users > Add user se owner aur staff ke email accounts invite/create karo.
3. Har user ko apna login email/password do. Public registration app mein nahi hai.

STEP 4 — App host karna
PWA ko install karne ke liye HTTPS hosting chahiye. Extracted folder ko Netlify par deploy karo (manual deploy / drag-and-drop), ya kisi static HTTPS host par upload karo.
Note: config.js mein credentials add karne ke BAAD hi deploy karo. Agar baad mein config badlo, updated folder dobara deploy karo.

STEP 5 — Android par install
1. Deployed HTTPS link Chrome mein kholo.
2. Chrome menu (⋮) > Install app / Add to Home screen.
3. DM Shop Manager icon home screen par aa jayega.

CURRENT LIMITATIONS
- This starter version tracks income and expenses; inventory, repair job cards, customer details, PDF reports, edit/delete and staff roles are not included yet.
- Today's dashboard totals are calculated from the records loaded (latest 100). For a full accounting ledger, add pagination/reporting before relying on it for formal accounts.
- All authenticated invited staff can view all transactions. Insert records are tied to the signed-in user.
