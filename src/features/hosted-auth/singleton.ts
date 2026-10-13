import { HostedAuthError } from "./config";

export interface SingletonState<T> {
  fingerprint?: string;
  pending?: Promise<T>;
  value?: T;
  retryAfter?: number;
  closing?: Promise<void>;
}
export function selectHostedSingleton<T>(
  state: SingletonState<T>,
  fingerprint: string,
  initialize: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  if (state.closing || (state.fingerprint && state.fingerprint !== fingerprint))
    return Promise.reject(new HostedAuthError("configuration"));
  if (state.value) return Promise.resolve(state.value);
  if (state.pending) return state.pending;
  if ((state.retryAfter ?? 0) > now)
    return Promise.reject(new HostedAuthError("unavailable"));
  state.fingerprint = fingerprint;
  const attempt = Promise.resolve()
    .then(initialize)
    .then(
      (value) => {
        state.value = value;
        if (state.pending === attempt) state.pending = undefined;
        return value;
      },
      () => {
        if (state.pending === attempt) {
          state.pending = undefined;
          state.retryAfter = Date.now() + 1000;
        }
        throw new HostedAuthError("unavailable");
      },
    );
  state.pending = attempt;
  return attempt;
}
export function closeHostedSingleton<T extends { close(): Promise<void> }>(
  state: SingletonState<T>,
) {
  state.closing ??= (async () => {
    const value = state.value ?? (await state.pending?.catch(() => undefined));
    if (value) await value.close();
  })();
  return state.closing;
}
