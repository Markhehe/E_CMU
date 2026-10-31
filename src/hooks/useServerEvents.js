import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';

const subscribers = new Set();
let eventSource = null;
let retryTimer = null;
let retryAttempt = 0;
let visibilityListenerAttached = false;
let stableConnectionTimer = null;

function flushSubscriber(subscriber) {
  subscriber.timer = null;
  const events = [...subscriber.pending.values()];
  subscriber.pending.clear();
  if (events.length > 0) subscriber.callback(events);
}

function queueEvent(subscriber, event) {
  if (event.resource !== '*' && !subscriber.resources.has('*') && !subscriber.resources.has(event.resource)) {
    return;
  }

  const key = event.resync ? 'resync' : `${event.resource}:${event.entityId || ''}`;
  subscriber.pending.set(key, event);
  if (subscriber.timer === null) {
    subscriber.timer = window.setTimeout(() => flushSubscriber(subscriber), 150);
  }
}

function dispatchEvent(event) {
  subscribers.forEach((subscriber) => queueEvent(subscriber, event));
}

function closeEventSource() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function connect() {
  if (
    eventSource ||
    subscribers.size === 0 ||
    document.visibilityState === 'hidden'
  ) return;

  const connection = new EventSource(`${API_BASE_URL}/events`, { withCredentials: true });
  eventSource = connection;
  connection.addEventListener('open', () => {
    if (eventSource !== connection) return;
    if (stableConnectionTimer !== null) window.clearTimeout(stableConnectionTimer);
    stableConnectionTimer = window.setTimeout(() => {
      retryAttempt = 0;
      stableConnectionTimer = null;
    }, 30000);
    dispatchEvent({ resource: '*', resync: true });
  });
  connection.addEventListener('data-change', (message) => {
    if (eventSource !== connection) return;
    try {
      const event = JSON.parse(message.data);
      if (typeof event.resource === 'string' && typeof event.userId === 'string') {
        dispatchEvent(event);
      }
    } catch (error) {
      console.error('Unable to parse a server data-change event.', error);
    }
  });
  connection.addEventListener('error', () => {
    if (eventSource !== connection) return;
    connection.close();
    eventSource = null;
    if (stableConnectionTimer !== null) {
      window.clearTimeout(stableConnectionTimer);
      stableConnectionTimer = null;
    }
    if (document.visibilityState === 'hidden' || retryTimer !== null) return;

    const baseDelay = Math.min(1000 * (2 ** retryAttempt), 30000);
    const jitteredDelay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    retryAttempt += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, jitteredDelay);
  });
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    closeEventSource();
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (stableConnectionTimer !== null) {
      window.clearTimeout(stableConnectionTimer);
      stableConnectionTimer = null;
    }
    return;
  }

  retryAttempt = 0;
  connect();
}

function subscribe(resources, callback) {
  const subscriber = {
    resources: new Set(resources),
    callback,
    pending: new Map(),
    timer: null,
  };
  subscribers.add(subscriber);

  if (!visibilityListenerAttached) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerAttached = true;
  }
  connect();

  return () => {
    subscribers.delete(subscriber);
    if (subscriber.timer !== null) window.clearTimeout(subscriber.timer);
    if (subscribers.size === 0) {
      closeEventSource();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (stableConnectionTimer !== null) {
        window.clearTimeout(stableConnectionTimer);
        stableConnectionTimer = null;
      }
      if (visibilityListenerAttached) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        visibilityListenerAttached = false;
      }
    }
  };
}

export function useServerEvents(resources, callback, enabled = true) {
  const callbackRef = useRef(callback);
  const resourceKey = Array.isArray(resources) ? resources.join(',') : resources;

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(resourceKey.split(',').filter(Boolean), (events) => callbackRef.current(events));
  }, [enabled, resourceKey]);
}
