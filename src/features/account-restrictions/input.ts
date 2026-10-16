import { z } from "zod";
export const accessStatuses = ["active", "suspended"] as const;
export const localReasons = [
  "local_access_test",
  "local_review_test",
  "local_restore_test",
] as const;
export const reasonLabels: Record<(typeof localReasons)[number], string> = {
  local_access_test: "Local access test",
  local_review_test: "Local review test",
  local_restore_test: "Local restoration test",
};
export function restrictionReasonLabel(
  reason: (typeof localReasons)[number],
  privateWorkflow = false,
) {
  return privateWorkflow
    ? {
        local_access_test: "Fictional access test",
        local_review_test: "Fictional review test",
        local_restore_test: "Fictional restoration test",
      }[reason]
    : reasonLabels[reason];
}
export const targetIdInput = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const pageInput = z.coerce.number().int().min(1).max(1000);
export const accountRoles = ["parent", "student", "tutor"] as const;
export const privateAccountQueryInput = z.strictObject({
  q: z.string().trim().max(100).default(""),
  role: z.union([z.enum(accountRoles), z.literal("")]).default(""),
  status: z.union([z.enum(accessStatuses), z.literal("")]).default(""),
  page: pageInput.default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(20),
});
export const privateAccountDetailQueryInput = privateAccountQueryInput.extend({
  historyPage: pageInput.default(1),
});
export type AccountQuery = z.infer<typeof privateAccountQueryInput>;

/** Exact query keys and one value each; a query never grants target authority. */
export function accountQueryFromSearch(
  params: URLSearchParams,
  detail = false,
) {
  const input = Object.fromEntries(params);
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "Choose one value per account filter.",
      },
    ]);
  return detail
    ? privateAccountDetailQueryInput.parse(input)
    : privateAccountQueryInput.parse(input);
}
export function accountSearchParams(
  input: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  return params;
}
export function accountQueryParams(query: AccountQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  return params;
}
export function accountListHref(query: AccountQuery, page = query.page) {
  const params = accountQueryParams({ ...query, page });
  return `/admin/accounts${params.size ? `?${params}` : ""}`;
}
export function accountTargetHref(
  targetId: string,
  query: AccountQuery,
  historyPage = 1,
) {
  const params = accountQueryParams(query);
  if (historyPage !== 1) params.set("historyPage", String(historyPage));
  return `/admin/accounts/${encodeURIComponent(targetId)}${params.size ? `?${params}` : ""}`;
}
export const changeInput = z
  .strictObject({
    revision: z.number().int().min(0).max(2147483646),
    status: z.enum(accessStatuses),
    reason: z.enum(localReasons),
    requestKey: z.uuid(),
  })
  .superRefine((v, ctx) => {
    if ((v.status === "active") !== (v.reason === "local_restore_test"))
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Choose a reason for this local action.",
      });
  });
export function invalidInput(error: z.ZodError) {
  return {
    message: "Check the local action fields.",
    errors: Object.fromEntries(
      error.issues.map((i) => [
        String(i.path[0] ?? "form"),
        i.path[0] === "reason"
          ? "Choose a reason for this local action."
          : "Reload the account and choose valid local action fields.",
      ]),
    ),
  };
}
