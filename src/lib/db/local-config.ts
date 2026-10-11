/** Parse explicitly so URL query parameters cannot override the validated host. */
export function localDatabaseConfig(
  value: string | undefined,
  testOnly = false,
) {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    const database = url.pathname.slice(1);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.search ||
      url.hash ||
      !["learli_dev", "learli_test"].includes(database) ||
      (testOnly && database !== "learli_test")
    )
      throw new Error();
    const port = Number(url.port || 5432);
    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !url.username ||
      !url.password
    )
      throw new Error();
    return {
      host: url.hostname === "[::1]" ? "::1" : url.hostname,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      ssl: false as const,
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10_000,
    };
  } catch {
    throw new Error(
      "A dedicated local Learli database is required. Connection values omitted.",
    );
  }
}
