import type { ClientBase } from "pg";

/** Independent parameter ACLs can disable trigger enforcement or change cluster
 * settings without any role attribute or membership. Include PUBLIC grants.
 * Ordinary user-settable parameters need no such ACL and remain unaffected. */
export async function stagingParameterPrivilegesSafe(client: ClientBase) {
  const result = await client.query<{ safe: boolean }>(`
    SELECT NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_parameter_acl p
      WHERE pg_catalog.has_parameter_privilege('learli_app', p.parname, 'SET')
        OR pg_catalog.has_parameter_privilege('learli_app', p.parname, 'ALTER SYSTEM')
    ) AS safe
  `);
  return result.rows.length === 1 && result.rows[0].safe === true;
}
