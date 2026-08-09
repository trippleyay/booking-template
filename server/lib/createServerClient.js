import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client safe to construct on any Node version.
 *
 * createClient() always builds a realtime client, and that needs a global
 * WebSocket. Node 20 and below have none, so it throws at import time and the
 * server never starts — which on a host with a healthcheck looks like a 500 on
 * every request, not an obvious crash.
 *
 * This server only makes REST queries (.from()) and verifies admin JWTs
 * (.auth.getUser()); it never opens a realtime channel. Handing realtime a
 * placeholder transport satisfies the constructor without a WebSocket. The
 * placeholder is never instantiated because nothing subscribes.
 *
 * Use this for every server-side client so no caller can reintroduce the crash.
 * Browser code does not need it — browsers have WebSocket natively.
 *
 * If you add realtime on the server, run Node 22+ and pass your own transport.
 */
class UnusedTransport {
  constructor() {
    throw new Error(
      "Realtime is not available on the server. Use REST queries, or run " +
        "Node 22+ and pass a real transport to createServerClient()."
    );
  }
}

export function createServerClient(url, key, options = {}) {
  return createClient(url, key, {
    ...options,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      ...options.auth,
    },
    realtime: {
      transport: UnusedTransport,
      ...options.realtime,
    },
  });
}
