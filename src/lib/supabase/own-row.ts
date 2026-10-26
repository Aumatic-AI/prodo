/**
 * The settings tables (business_profile, app_settings, brand_kit) hold one row per business, and the
 * client only ever sees its own business's row (RLS, or businessDb for jobs). The API refuses an
 * UPDATE with no filter at all, so updates of those rows go through this one.
 */
export function ownRow<Q extends { not: (column: string, operator: string, value: null) => Q }>(query: Q): Q {
  return query.not("business_id", "is", null);
}
