import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFiles } from "@/providers/storage/remove-files";

// One login, several businesses (business_members, migration 0030): the account menu's list, "Add account" (a new
// business, or an existing one linked by signing in once with its own login) and removing one. The list lives on
// the login, so it's the same on every device; which one is open is picked per device (lib/active-business.ts).
// A business counts as added once its setup is finished (onboarding_status 'done': research done and the Brand
// Bible approved); until then it shows as "Setting up".

export interface AccountView {
  id: string;
  name: string;
  logoKey: string | null;
  /** ready: set up (Brand Bible approved); setting_up: onboarding not finished */
  status: "ready" | "setting_up";
  /** owner: made with or by this login; member: linked with that business's own login */
  role: "owner" | "member";
  /** The business this request is for */
  current: boolean;
}

/** The login's businesses, oldest first. */
export async function listAccounts(db: SupabaseClient): Promise<AccountView[]> {
  const [{ data, error }, { data: current }] = await Promise.all([db.rpc("my_businesses"), db.rpc("current_business_id")]);
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string; logo_key: string | null; onboarding_status: string; role: string }[]).map((b) => ({
    id: b.id,
    name: b.name,
    logoKey: b.logo_key,
    status: b.onboarding_status === "done" ? "ready" : "setting_up",
    role: b.role === "owner" ? "owner" : "member",
    current: b.id === current,
  }));
}

/** "Add account" → a new business: the login's unfinished setup when it has one, else a fresh business it owns. */
export async function createBusiness(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.rpc("create_business");
  if (error) {
    if (/25 businesses/.test(error.message)) throw new AppError("This login already has 25 businesses. Remove one before adding another.", "INVALID_INPUT", false);
    throw error;
  }
  return data as string;
}

/**
 * Adds a business that already has its own login: the owner proves it by signing in with that login once, here on
 * the server. That sign-in is closed straight away; only the link stays. A business still setting up can't be
 * added: it's finished first, from its own login.
 */
export async function linkBusiness(db: SupabaseClient, email: string, password: string): Promise<{ added: string[]; notReady: string[] }> {
  const { data: { user: me } } = await db.auth.getUser();
  if (!me) throw new AppError("Log in again to add an account.", "UNAUTHORIZED", false);

  const auth = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({ email: email.trim(), password });
  if (signInError || !signedIn.user) throw new AppError("That email and password didn't work. Check them and try again.", "INVALID_INPUT", false);
  const other = signedIn.user.id;
  await auth.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (other === me.id) throw new AppError("That's the login you're using now.", "INVALID_INPUT", false);

  // Across logins, so the server does it: RLS only shows a login its own rows
  const admin = createAdminClient();
  const { data: owned, error: ownedError } = await admin.from("business_members").select("business_id").eq("user_id", other).eq("role", "owner");
  if (ownedError) throw ownedError;
  const ids = (owned ?? []).map((r) => r.business_id as string);
  if (!ids.length) throw new AppError("That login has no business yet. Log in with it and set one up first.", "INVALID_INPUT", false);

  const { data: profiles, error: profileError } = await admin.from("business_profile").select("business_id, name, onboarding_status").in("business_id", ids);
  if (profileError) throw profileError;
  const ready = (profiles ?? []).filter((p) => p.onboarding_status === "done");
  const notReady = (profiles ?? []).filter((p) => p.onboarding_status !== "done").map((p) => p.name || "Its business");
  if (!ready.length) {
    throw new AppError(
      `${notReady.join(", ") || "That business"} isn't set up yet. Log in with that account, finish onboarding (research, then approve the Brand Bible), then add it here.`,
      "INVALID_INPUT",
      false
    );
  }
  const { error: linkError } = await admin
    .from("business_members")
    .upsert(ready.map((p) => ({ user_id: me.id, business_id: p.business_id, role: "member" })), { onConflict: "user_id,business_id", ignoreDuplicates: true });
  if (linkError) throw linkError;
  return { added: ready.map((p) => p.name || "Your business"), notReady };
}

/**
 * Takes a business off the login's list. A linked one is only unlinked (it keeps its own login and data). One this
 * login made is deleted with its data and files, but only while it's still setting up and no other login uses it.
 * The login always keeps at least one business.
 */
export async function removeAccount(db: SupabaseClient, businessId: string): Promise<"unlinked" | "deleted"> {
  const { data: { user: me } } = await db.auth.getUser();
  if (!me) throw new AppError("Log in again to change your accounts.", "UNAUTHORIZED", false);

  const admin = createAdminClient();
  const { data: memberships, error } = await admin.from("business_members").select("business_id, role").eq("user_id", me.id);
  if (error) throw error;
  const mine = memberships?.find((m) => m.business_id === businessId);
  if (!mine) throw new AppError("That business isn't on your list.", "INVALID_INPUT", false);
  if ((memberships ?? []).length <= 1) throw new AppError("This is the only business on your login, so it stays.", "INVALID_INPUT", false);

  if (mine.role === "member") {
    const { error: unlinkError } = await admin.from("business_members").delete().eq("user_id", me.id).eq("business_id", businessId);
    if (unlinkError) throw unlinkError;
    return "unlinked";
  }

  const { data: profile, error: profileError } = await admin.from("business_profile").select("onboarding_status, logo_key").eq("business_id", businessId).single();
  if (profileError) throw profileError;
  if (profile.onboarding_status === "done") {
    throw new AppError("A business that's set up can't be removed from here: its posts, plans and history would go with it.", "INVALID_INPUT", false);
  }
  const { count, error: countError } = await admin.from("business_members").select("user_id", { count: "exact", head: true }).eq("business_id", businessId);
  if (countError) throw countError;
  if ((count ?? 0) > 1) throw new AppError("Another login uses this business too, so it can't be removed.", "INVALID_INPUT", false);

  // Its files first (the database rows say where they are), then the business and, with it, every row it owns
  const [assets, kit, media, files] = await Promise.all([
    admin.from("brand_assets").select("storage_key").eq("business_id", businessId),
    admin.from("brand_kit").select("logo_variants").eq("business_id", businessId).maybeSingle(),
    admin.from("media").select("storage_key").eq("business_id", businessId),
    admin.from("media_files").select("storage_key").eq("business_id", businessId),
  ]);
  const variants = (kit.data?.logo_variants ?? {}) as Record<string, string | null>;
  await removeFiles(businessId, [
    profile.logo_key,
    ...Object.values(variants),
    ...(assets.data ?? []).map((a) => a.storage_key),
    ...(media.data ?? []).map((m) => m.storage_key),
    ...(files.data ?? []).map((f) => f.storage_key),
  ]);
  const { error: deleteError } = await admin.from("businesses").delete().eq("id", businessId);
  if (deleteError) throw deleteError;
  return "deleted";
}
