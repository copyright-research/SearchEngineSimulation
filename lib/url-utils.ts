interface SearchParamsLike {
  get: (name: string) => string | null;
  entries: () => IterableIterator<[string, string]>;
}

/**
 * 大小写不敏感地获取 URL search 参数
 * @param searchParams URLSearchParams/ReadonlyURLSearchParams 实例
 * @param key 参数名（支持大小写不敏感）
 * @returns 参数值或 null
 */
export function getParamCaseInsensitive(
  searchParams: SearchParamsLike,
  key: string
): string | null {
  // 先尝试直接获取
  const directValue = searchParams.get(key);
  if (directValue !== null) return directValue;

  // 如果直接获取失败，遍历所有参数查找大小写不敏感匹配
  const lowerKey = key.toLowerCase();
  
  for (const [paramKey, paramValue] of searchParams.entries()) {
    if (paramKey.toLowerCase() === lowerKey) {
      return paramValue;
    }
  }

  return null;
}

/**
 * 浏览器端：从 window.location.search 大小写不敏感获取参数
 * @param key 参数名
 * @returns 参数值或 null
 */
export function getUrlParamCaseInsensitive(key: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const searchParams = new URLSearchParams(window.location.search);
  return getParamCaseInsensitive(searchParams, key);
}
