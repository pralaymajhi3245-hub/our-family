OUR FAMILY — STARTER APP

IMPORTANT
- Use ONLY your Supabase Project URL and Publishable key in app.js.
- Never put a Supabase Secret key or service_role key in app.js.
- This app relies on Supabase Row Level Security (RLS) and Storage policies. Do not disable RLS.

NEXT SETUP
1. Open app.js in Notepad.
2. Replace PASTE_YOUR_PROJECT_URL_HERE with your Project URL.
3. Replace PASTE_YOUR_PUBLISHABLE_KEY_HERE with your Publishable key.
4. Save the file.
5. Upload these files to a static HTTPS host (we will do that together in the next steps).

CURRENT BEHAVIOUR
- Admin can publish text and photos.
- Approved family members can view messages and photos.
- New sign-ups are created as pending members by the database trigger.
- Admin can approve pending members or revoke approval.
- Photos are uploaded to the private family-photos bucket and displayed using temporary signed URLs.

LIMITATIONS / SECURITY NOTES
- "Keep pending" does not delete a request; it leaves the account unapproved.
- "Revoke access" turns approval off; it does not delete the person's Supabase login.
- The app does not expose a service_role key.
- Keep the Supabase RLS and Storage policies enabled.
- Email confirmation settings can affect whether a new user can sign in immediately.
- The app requires internet access to load family data and photos.
