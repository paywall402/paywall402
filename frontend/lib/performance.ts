/**
 * Performance optimization utilities for PayWall402 frontend
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Debounce hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRun.current >= limit) {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }
    }, limit - (Date.now() - lastRun.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  buffer: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
  );

  const visibleItems = items.slice(startIndex, endIndex);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  };
}

/**
 * Image preloader
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Batch image preloader
 */
export async function preloadImages(
  urls: string[],
  options?: {
    parallel?: number;
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<void> {
  const { parallel = 3, onProgress } = options || {};
  let loaded = 0;

  const loadBatch = async (batch: string[]) => {
    await Promise.all(
      batch.map(async (url) => {
        try {
          await preloadImage(url);
        } catch (error) {
          console.error(`Failed to preload image: ${url}`, error);
        }
        loaded++;
        onProgress?.(loaded, urls.length);
      })
    );
  };

  // Process in batches
  for (let i = 0; i < urls.length; i += parallel) {
    const batch = urls.slice(i, i + parallel);
    await loadBatch(batch);
  }
}

/**
 * Memoization utility
 */
export function memoize<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => TResult,
  options?: {
    maxSize?: number;
    ttl?: number;
  }
): (...args: TArgs) => TResult {
  const { maxSize = 100, ttl = Infinity } = options || {};
  const cache = new Map<string, { value: TResult; timestamp: number }>();

  return (...args: TArgs): TResult => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, timestamp: Date.now() });

    // Limit cache size
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    return result;
  };
}

/**
 * Request Animation Frame hook
 */
export function useAnimationFrame(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const animate = useCallback(
    (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    },
    [callback]
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);
}

/**
 * Lazy component loader with loading state
 */
export function lazyWithPreload<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  let preloadedModule: { default: T } | null = null;
  let preloadPromise: Promise<{ default: T }> | null = null;

  const load = () => {
    if (preloadedModule) {
      return Promise.resolve(preloadedModule);
    }

    if (preloadPromise) {
      return preloadPromise;
    }

    preloadPromise = importFn().then((module) => {
      preloadedModule = module;
      return module;
    });

    return preloadPromise;
  };

  const LazyComponent = React.lazy(load);

  return {
    Component: LazyComponent,
    preload: load,
  };
}

/**
 * Web Worker hook
 */
export function useWebWorker<TInput, TOutput>(
  workerFunction: (input: TInput) => TOutput
) {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const workerCode = `
      self.onmessage = function(e) {
        const fn = ${workerFunction.toString()};
        const result = fn(e.data);
        self.postMessage(result);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);

    return () => {
      workerRef.current?.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  const run = useCallback(
    (input: TInput): Promise<TOutput> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        workerRef.current.onmessage = (e) => resolve(e.data);
        workerRef.current.onerror = reject;
        workerRef.current.postMessage(input);
      });
    },
    []
  );

  return run;
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  mark(name: string) {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string) {
    const measureName = `${name}_measure`;
    performance.measure(
      measureName,
      startMark,
      endMark || `${startMark}_end`
    );

    const measure = performance.getEntriesByName(measureName)[0];
    if (measure) {
      const metrics = this.metrics.get(name) || [];
      metrics.push(measure.duration);
      this.metrics.set(name, metrics);

      // Keep only last 100 measurements
      if (metrics.length > 100) {
        metrics.shift();
      }
    }
  }

  getMetrics(name: string) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;

    const sorted = [...metrics].sort((a, b) => a - b);
    const sum = metrics.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / metrics.length,
      p50: sorted[Math.floor(metrics.length * 0.5)],
      p95: sorted[Math.floor(metrics.length * 0.95)],
      p99: sorted[Math.floor(metrics.length * 0.99)],
    };
  }

  getAllMetrics() {
    const results: Record<string, any> = {};
    for (const [name, _] of this.metrics) {
      results[name] = this.getMetrics(name);
    }
    return results;
  }

  clear() {
    this.metrics.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }
}

/**
 * Resource hints for preloading
 */
export function addResourceHint(
  url: string,
  type: 'prefetch' | 'preload' | 'preconnect' | 'dns-prefetch'
) {
  const link = document.createElement('link');
  link.rel = type;
  link.href = url;

  if (type === 'preload') {
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
}

/**
 * Batch DOM updates
 */
export function batchDOMUpdates(updates: (() => void)[]) {
  requestAnimationFrame(() => {
    updates.forEach((update) => update());
  });
}

/**
 * Memory usage monitor
 */
export function getMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
}

/**
 * FPS monitor hook
 */
export function useFPSMonitor() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useAnimationFrame(() => {
    frameCount.current++;
    const currentTime = performance.now();
    const delta = currentTime - lastTime.current;

    if (delta >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / delta));
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });

  return fps;
}

export default {
  useDebounce,
  useThrottle,
  useIntersectionObserver,
  useVirtualScroll,
  preloadImage,
  preloadImages,
  memoize,
  useAnimationFrame,
  lazyWithPreload,
  useWebWorker,
  PerformanceMonitor,
  addResourceHint,
  batchDOMUpdates,
  getMemoryUsage,
  useFPSMonitor,
};