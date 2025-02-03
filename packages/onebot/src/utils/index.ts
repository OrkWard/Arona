export function isObject(item: unknown) {
  return item && typeof item === "object" && !Array.isArray(item);
}

export function mergeDeep<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]) {
  if (!sources.length) return target;
  const source = sources.shift();

  for (const key in source) {
    if (isObject(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      mergeDeep(target[key]!, source[key]!);
    } else {
      Object.assign(target, { [key]: source[key] });
    }
  }

  return mergeDeep(target, ...sources);
}
