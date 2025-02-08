class ThrottleError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ThrottleError";
  }
}

export interface ThrottledFunc<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
}
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number) {
  let lastTime = 0;
  return function (...args: any[]) {
    const now = new Date().getTime();
    if (now - lastTime >= wait) {
      lastTime = now;
      return func(...args);
    }

    throw new ThrottleError(`${func.name}`);
  } as ThrottledFunc<T>;
}
