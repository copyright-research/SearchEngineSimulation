import { useEffect, useRef } from 'react';

/**
 * Debug hook to track dependency changes in useEffect
 * 用于调试 useEffect 的依赖项变化
 * 
 * @example
 * ```tsx
 * useDebugDeps('MyComponent', { query, results, user });
 * ```
 */
export function useDebugDeps(
  componentName: string,
  dependencies: Record<string, any>
) {
  const previousDeps = useRef<Record<string, any>>({});
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    const changes: string[] = [];

    Object.keys(dependencies).forEach((key) => {
      const currentValue = dependencies[key];
      const previousValue = previousDeps.current[key];

      // 检查是否发生变化
      if (currentValue !== previousValue) {
        // 对于对象和数组，显示更详细的信息
        if (typeof currentValue === 'object' && currentValue !== null) {
          if (Array.isArray(currentValue)) {
            changes.push(
              `  📦 ${key}: Array changed\n` +
              `     Previous: ${previousValue ? `[${previousValue.length} items]` : 'undefined'}\n` +
              `     Current:  [${currentValue.length} items]\n` +
              `     Reference changed: ${previousValue !== currentValue}`
            );
          } else {
            changes.push(
              `  📦 ${key}: Object changed\n` +
              `     Previous: ${previousValue ? JSON.stringify(previousValue).substring(0, 100) : 'undefined'}\n` +
              `     Current:  ${JSON.stringify(currentValue).substring(0, 100)}\n` +
              `     Reference changed: ${previousValue !== currentValue}`
            );
          }
        } else {
          changes.push(
            `  📝 ${key}: ${JSON.stringify(previousValue)} → ${JSON.stringify(currentValue)}`
          );
        }
      }
    });

    if (changes.length > 0) {
      console.group(
        `🔍 [${componentName}] Render #${renderCount.current} - Dependencies Changed`
      );
      console.log('⚠️ Changed dependencies:');
      changes.forEach((change) => console.log(change));
      console.log('\n📊 All current values:');
      Object.entries(dependencies).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          console.log(`  ${key}: Array[${value.length}]`, value);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`  ${key}: Object`, value);
        } else {
          console.log(`  ${key}:`, value);
        }
      });
      console.groupEnd();
    } else {
      console.log(
        `✅ [${componentName}] Render #${renderCount.current} - No dependency changes (possible Strict Mode re-render)`
      );
    }

    // 更新 previous deps
    previousDeps.current = { ...dependencies };
  });
}

/**
 * Advanced debug hook with deep comparison for objects/arrays
 * 高级调试 hook，支持对象/数组的深度比较
 */
export function useDebugDepsDeep(
  componentName: string,
  dependencies: Record<string, any>
) {
  const previousDeps = useRef<Record<string, any>>({});
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    const changes: string[] = [];

    Object.keys(dependencies).forEach((key) => {
      const currentValue = dependencies[key];
      const previousValue = previousDeps.current[key];

      // 引用比较
      const referenceChanged = currentValue !== previousValue;
      
      // 深度比较（仅用于展示，不影响 React 的行为）
      let deepEqual = false;
      try {
        deepEqual = JSON.stringify(currentValue) === JSON.stringify(previousValue);
      } catch (e) {
        deepEqual = false;
      }

      if (referenceChanged) {
        if (typeof currentValue === 'object' && currentValue !== null) {
          if (Array.isArray(currentValue)) {
            changes.push(
              `  📦 ${key}: Array reference changed\n` +
              `     Length: ${previousValue?.length || 0} → ${currentValue.length}\n` +
              `     Deep equal: ${deepEqual ? '✅ YES (content same)' : '❌ NO (content different)'}\n` +
              `     ⚠️ This will trigger useEffect re-run!`
            );
          } else {
            changes.push(
              `  📦 ${key}: Object reference changed\n` +
              `     Deep equal: ${deepEqual ? '✅ YES (content same)' : '❌ NO (content different)'}\n` +
              `     ⚠️ This will trigger useEffect re-run!`
            );
          }
        } else {
          changes.push(
            `  📝 ${key}: ${JSON.stringify(previousValue)} → ${JSON.stringify(currentValue)}`
          );
        }
      }
    });

    if (changes.length > 0) {
      console.group(
        `🔍 [${componentName}] Render #${renderCount.current} - Dependencies Changed`
      );
      console.log('⚠️ Changed dependencies:');
      changes.forEach((change) => console.log(change));
      
      console.log('\n💡 Tips:');
      console.log('  - If "Deep equal: YES" but reference changed, consider using useMemo/useCallback');
      console.log('  - Arrays/Objects created inline will always have new references');
      console.log('  - Check parent component for unnecessary re-renders');
      
      console.groupEnd();
    } else {
      console.log(
        `✅ [${componentName}] Render #${renderCount.current} - No dependency changes (likely React Strict Mode)`
      );
    }

    previousDeps.current = { ...dependencies };
  });
}

