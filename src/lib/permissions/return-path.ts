export function safeReturnPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded))
      return "/account";
    const url = new URL(value, "http://learli.invalid");
    if (
      url.origin !== "http://learli.invalid" ||
      /^\/(?:api|sign-in|sign-up|verify-email|forgot-password|reset-password|two-factor)(?:\/|$)/.test(
        url.pathname,
      )
    )
      return "/account";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/account";
  }
}
