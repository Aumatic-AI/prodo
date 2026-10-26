import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

// Agents and jobs use the service role, which skips RLS. businessDb() gives them a client that
// behaves like a logged-in user of one business: every read, update and delete is filtered to
// that business, every insert and upsert is stamped with it, and every database function gets it
// as p_business_id. The database backs this up: business_id is required on every row, foreign
// keys stay inside one business and a row can never move to another one.

const COLUMN = "business_id";

type Row = Record<string, unknown>;
type Query = ReturnType<SupabaseClient["from"]>;

function stamp(values: Row | Row[], businessId: string): Row | Row[] {
  const one = (row: Row) => ({ ...row, [COLUMN]: businessId });
  return Array.isArray(values) ? values.map(one) : one(values);
}

/** An update never changes the business (the database refuses it too). */
function withoutBusiness(values: Row): Row {
  return Object.fromEntries(Object.entries(values).filter(([key]) => key !== COLUMN));
}

function scopedTable(client: SupabaseClient, table: string, businessId: string) {
  if (table === "businesses") throw new Error("businessDb can't use the businesses table");
  const query = () => client.from(table);
  return {
    select: (...args: Parameters<Query["select"]>) => query().select(...args).eq(COLUMN, businessId),
    insert: (values: Row | Row[], options?: Parameters<Query["insert"]>[1]) => query().insert(stamp(values, businessId), options),
    upsert: (values: Row | Row[], options?: Parameters<Query["upsert"]>[1]) => query().upsert(stamp(values, businessId), options),
    update: (values: Row, options?: Parameters<Query["update"]>[1]) => query().update(withoutBusiness(values), options).eq(COLUMN, businessId),
    delete: (options?: Parameters<Query["delete"]>[0]) => query().delete(options).eq(COLUMN, businessId),
  };
}

/** Service-role client limited to one business. Every agent and job uses it. */
export function businessDb(businessId: string): SupabaseClient {
  if (!businessId) throw new Error("businessDb needs a business id");
  const client = createAdminClient();
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") return (table: string) => scopedTable(target, table, businessId);
      if (prop === "rpc") {
        return (fn: string, args: Row = {}, options?: Parameters<SupabaseClient["rpc"]>[2]) => target.rpc(fn, { ...args, p_business_id: businessId }, options);
      }
      if (prop === "schema") throw new Error("businessDb only covers the public schema");
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Businesses the scheduled jobs (crons) run for: onboarding finished and someone can still log in.
 * The only unscoped read the jobs make.
 */
export async function listActiveBusinessIds(): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("business_profile")
    .select("business_id, business:businesses!inner(owner_id)")
    .eq("onboarding_status", "done")
    .not("business.owner_id", "is", null);
  if (error) throw error;
  return (data ?? []).map((row) => row.business_id as string);
}
