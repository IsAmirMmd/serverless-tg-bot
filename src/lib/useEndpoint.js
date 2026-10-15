import { useCallback, useEffect, useRef, useState } from 'react';
import { callEndpoint } from './serverless.js';

// Calls an endpoint whenever `name` or `input` changes; stale responses are dropped.
// → { data, error, loading, reload }
export function useEndpoint(name, input = {}) {
  const key = JSON.stringify(input);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, error: null, loading: true }));
    callEndpoint(name, JSON.parse(key)).then(
      (data) => id === latest.current && setState({ data, error: null, loading: false }),
      (error) => id === latest.current && setState({ data: null, error, loading: false }),
    );
  }, [name, key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
