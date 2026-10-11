export function isLoopbackOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
}

export function syntheticEmail(value: string) {
  return /^[^\s@]+@(?:[a-z0-9-]+\.)+test$/i.test(value);
}
