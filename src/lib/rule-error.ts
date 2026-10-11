/** An expected business-rule refusal. Its message is safe to show to the user. */
export class RuleError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message);
  }
}
