import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * useFetch — GETs `url` on mount / whenever `url` or `deps` change.
 *
 * PERF FIX: requests are now cancelled via AbortController when the
 * component unmounts or when `url`/`deps` change again before the previous
 * request resolves. Previously an in-flight request had no way to be
 * cancelled, which meant:
 *   1. Wasted network/CPU — a request for a filter/page the user already
 *      navigated away from kept running to completion anyway.
 *   2. Race conditions — if a fast second request resolved before a slower
 *      first one, the first request's (now stale) response could land
 *      afterwards and silently overwrite the correct data on screen.
 *   3. "Can't perform a React state update on an unmounted component"
 *      warnings/memory-leak risk if the response arrived after unmount.
 * The public API (data/loading/error/refetch) is unchanged, so no caller
 * needs to be touched.
 */
export function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    // Cancel any request still in flight for this hook instance before
    // starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await api.get(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setData(res.data);
      setError('');
    } catch (e) {
      if (controller.signal.aborted || e.code === 'ERR_CANCELED') return;
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  // eslint-disable-next-line
  }, [url, ...deps]);

  useEffect(() => {
    fetch();
    return () => abortRef.current?.abort();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useForm(initial) {
  const [form, setForm] = useState(initial);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const reset = () => setForm(initial);

  return { form, setForm, onChange, reset };
}

/**
 * useDebouncedValue — returns a copy of `value` that only updates after
 * `delayMs` of no further changes. Use this to wrap live search/filter
 * inputs so expensive filter/sort work (and re-renders of large lists)
 * only happens once the user pauses typing, instead of on every keystroke.
 *
 * Usage:
 *   const [searchQ, setSearchQ] = useState('');
 *   const debouncedSearchQ = useDebouncedValue(searchQ, 250);
 *   // filter using debouncedSearchQ, not searchQ
 */
export function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}