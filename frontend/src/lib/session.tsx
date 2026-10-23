import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { api, post, ApiError, errorText } from './api';

type Home = { id: string; name: string; role: 'Owner' | 'Admin' | 'Viewer'; expires_at?: number };
type SessionState = { user: any; homes: Home[]; home: Home | null; loading: boolean; error: string;
  refresh: () => Promise<void>; choose: (id: string) => void; logout: () => Promise<void> };
const SessionContext = createContext<SessionState>(null!);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [homes, setHomes] = useState<Home[]>([]);
  const [active, setActive] = useState(() => { try { return localStorage.getItem('bulkhead.household') || ''; } catch { return ''; } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setError('');
    try {
      const account = await api('/auth/me');
      const list = await api<Home[]>('/households');
      setUser(account); setHomes(list);
      setActive(previous => list.some(h => h.id === previous) ? previous : list[0]?.id || '');
    } catch (err) {
      setUser(null); setHomes([]);
      if (!(err instanceof ApiError && err.status === 401)) setError(errorText(err));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const revoked = () => { setUser(null); setHomes([]); };
    window.addEventListener('bulkhead:unauthorized', revoked);
    return () => window.removeEventListener('bulkhead:unauthorized', revoked);
  }, [refresh]);
  const choose = (id: string) => { setActive(id); try { localStorage.setItem('bulkhead.household', id); } catch { /* Selection still works without persistent browser storage. */ } };
  const logout = async () => { await post('/auth/logout'); setUser(null); setHomes([]); location.hash = '#/login'; };
  return <SessionContext.Provider value={{ user, homes, home: homes.find(h => h.id === active) || null, loading, error, refresh, choose, logout }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);

type ApplicationState = { state: any; error: string; stream: string; refresh: () => Promise<void>;
  path: (suffix: string) => string; canWrite: boolean };
const ApplicationContext = createContext<ApplicationState>(null!);
export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { home, user, refresh: refreshSession } = useSession();
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState('');
  const [stream, setStream] = useState('Connecting');
  const generation = useRef(0);
  const homeId = home?.id;
  const path = useCallback((suffix: string) => `/households/${homeId}${suffix}`, [homeId]);
  const refresh = useCallback(async () => {
    if (!user || !homeId) return;
    const current = generation.current;
    try {
      const next = await api(path('/state'));
      if (current === generation.current) { setState((prior: any) => !prior || next.sequence >= prior.sequence ? next : prior); setError(''); }
    } catch (err) { if (current === generation.current) setError(errorText(err)); }
  }, [homeId, user?.id, path]);
  useEffect(() => {
    generation.current += 1;
    setState(null); setError(''); setStream('Connecting');
    if (!user || !homeId) return;
    let stopped = false, socket: WebSocket | null = null, timer: ReturnType<typeof setTimeout>, attempt = 0;
    let cursor: number | undefined;
    let lastMessage = Date.now();
    const connect = () => {
      if (stopped) return;
      setStream(attempt ? 'Reconnecting' : 'Connecting');
      const url = new URL(`/api/v1/households/${homeId}/events/ws`, location.href);
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (cursor !== undefined) url.searchParams.set('after', String(cursor));
      socket = new WebSocket(url);
      socket.onopen = () => { attempt = 0; lastMessage = Date.now(); setStream('Live'); };
      socket.onmessage = event => {
        if (stopped) return;
        lastMessage = Date.now();
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'HEARTBEAT') return;
          if (cursor !== undefined && message.sequence <= cursor) return;
          cursor = message.sequence;
          const next = message.type === 'SIM_TICK' ? message.payload.state : message.payload;
          if (next?.household_id === homeId) {
            setState((prior: any) => !prior || next.sequence >= prior.sequence ? next : prior);
            setError('');
          }
        } catch { setError('Could not read an event; reconnecting'); socket?.close(); }
      };
      socket.onerror = () => { if (!stopped) setStream('Disconnected'); };
      socket.onclose = event => {
        if (stopped) return;
        setStream('Disconnected');
        if ([4401, 4403].includes(event.code)) { refreshSession(); return; }
        timer = setTimeout(connect, Math.min(15000, 500 * 2 ** attempt++) + Math.random() * 250);
      };
    };
    refresh(); connect();
    const poll = setInterval(refresh, 10000);
    const watchdog = setInterval(() => { if (Date.now() - lastMessage > 10000) socket?.close(); }, 3000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(poll); clearInterval(watchdog); socket?.close(); };
  }, [homeId, user?.id, path, refresh, refreshSession]);
  return <ApplicationContext.Provider value={{ state, error, stream, refresh, path, canWrite: !!home && home.role !== 'Viewer' }}>{children}</ApplicationContext.Provider>;
}
export const useBulkhead = () => useContext(ApplicationContext);
