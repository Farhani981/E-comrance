import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { readGuest, guestBatch, requestShopping } from '../utils/shopping';
import { normalizeProduct } from '../utils/catalog';

export default function useShoppingStore(kind) {
  const key = `shophub_${kind}`;
  const { user } = useAuth();
  const token = user?.token;
  const active = useRef(token);
  useLayoutEffect(() => { active.current = token; return () => { active.current = null; }; }, [token]);
  const [guest, setGuestState] = useState(() => readGuest(localStorage, key));
  const [remote, setRemote] = useState({ token: null, items: [], ready: false, error: '' });
  const queue = useRef(Promise.resolve());
  const reload = useCallback(() => {
    const task = async () => {
    if (!token) return;
    if (active.current !== token) return;
    try {
      const batch = guestBatch(localStorage, key, kind);
      const data = await requestShopping(token, kind, batch);
      if (active.current !== token) return;
      if (batch && localStorage.getItem(`${key}_merge_id`) === batch.mergeId) {
        localStorage.removeItem(key); localStorage.removeItem(`${key}_merge_id`); setGuestState([]);
      }
      setRemote({ token, items: data.items.map(normalizeProduct), ready: true, error: '', notices: data.notices });
    } catch (error) { if (active.current === token) setRemote({ items: [], token, ready: false, error: error.message }); }
    };
    queue.current = queue.current.then(task, task); return queue.current;
  }, [token, key, kind]);
  useEffect(() => { void reload(); }, [reload]);
  const setGuest = update => {
    if (token) return;
    const next = typeof update === 'function' ? update(readGuest(localStorage, key)) : update;
    try { localStorage.setItem(key, JSON.stringify(next)); localStorage.removeItem(`${key}_merge_id`); setGuestState(next); return true; }
    catch { window.alert('Unable to save items in browser storage. Please free some space and try again.'); return false; }
  };
  const mutate = body => {
    const task = async () => {
      if (active.current !== token || !token) return false;
      if (remote.token !== token || !remote.ready) { window.alert('Your saved items are still loading. Please retry synchronization.'); return false; }
      try {
        const data = await requestShopping(token, kind, body);
        if (active.current !== token) return false;
        setRemote({ token, items: data.items.map(normalizeProduct), ready: true, error: '', notices: data.notices }); return true;
      } catch (error) { if (active.current === token) window.alert(error.message); return false; }
    };
    queue.current = queue.current.then(task, task); return queue.current;
  };
  return { items: token ? remote.token === token ? remote.items : [] : guest, authenticated: !!token,
    loading: !!token && (remote.token !== token || (!remote.ready && !remote.error)),
    error: token && remote.token === token ? remote.error : '', notices: token && remote.token === token ? remote.notices || [] : [], reload, mutate, setGuest };
}
