import { errAsync, okAsync, ResultAsync } from "neverthrow";

class ThrottleError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ThrottleError";
  }
}

interface ThrottledAsync<T extends (...args: any[]) => ResultAsync<any, any>> {
  (
    ...args: Parameters<T>
  ): ReturnType<T> extends ResultAsync<infer V, infer E1> ? ResultAsync<V, E1 | ThrottleError> : never;
}
export function throttleAsync<T extends (...args: any[]) => ResultAsync<any, any>>(func: T, wait: number) {
  let lastTime = 0;
  return function (...args: any[]) {
    const now = new Date().getTime();
    if (now - lastTime >= wait) {
      lastTime = now;
      return func(...args);
    }

    return errAsync(new ThrottleError(`func: ${func.name}`));
  } as ThrottledAsync<T>;
}
