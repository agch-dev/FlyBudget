import { useEffect, useRef, useState } from 'react';

/**
 * The value of a field that saves itself (on blur, like the transaction detail panel's). It
 * follows the server's value (undo, a sync, another device) while the user hasn't changed it,
 * and keeps what the user typed until the server has it: a reload that lands meanwhile, even
 * the one from the field's own earlier save, never wipes newer typing. Opening another record
 * (`recordId`) always shows its value.
 *
 * `same(local, server)` says whether the field shows the server's value (default `Object.is`).
 */
export function useServerValue<T>(
  server: T,
  recordId: string,
  same: (local: T, server: T) => boolean = Object.is,
) {
  const [value, setValue] = useState(server);
  const latest = useRef(server);
  latest.current = server;
  const last = useRef({ recordId, server });
  const serverKey = JSON.stringify(server);

  useEffect(() => {
    const prev = last.current;
    const server = latest.current;
    if (prev.recordId === recordId && JSON.stringify(prev.server) === serverKey) return;
    last.current = { recordId, server };
    setValue((local) =>
      prev.recordId !== recordId || same(local, prev.server) || same(local, server)
        ? server
        : local,
    );
  }, [recordId, serverKey, same]);

  return [value, setValue] as const;
}
