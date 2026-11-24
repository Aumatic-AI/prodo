// Makes an admin login for the admin panel (/admin). An admin has no business: the database sees
// app_metadata.role = 'admin' on the new login and lists it in public.admins instead (migration 0032).
// The password is printed once; change it later in Supabase → Authentication → Users. Free.
// Usage: npm run smoke scripts/setup/admin.ts <email> [password]
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const [email, given] = process.argv.slice(2);
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error("Usage: npm run smoke scripts/setup/admin.ts <email> [password]");
  process.exit(1);
}

// No look-alike characters, so it can be read out or typed
const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = given ?? Array.from(randomBytes(16), (n) => CHARS[n % CHARS.length]).join("");
if (password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}

const db = createAdminClient();
const { data, error } = await db.auth.admin.createUser({ email: email.toLowerCase(), password, email_confirm: true, app_metadata: { role: "admin" } });
if (error) {
  console.error(`Couldn't make the login: ${error.message}`);
  process.exit(1);
}

// After 0032 the database lists it by itself; this covers a login made before 0032 ran
const { error: listError } = await db.from("admins").upsert({ user_id: data.user.id });
if (listError) console.log(`Not in the admins list yet (${listError.message}). Run migration 0032: it lists every login made with the admin role.`);

console.log(`Admin login ready\n  Email:    ${data.user.email}\n  Password: ${password}\n  Open /login, then /admin.`);
