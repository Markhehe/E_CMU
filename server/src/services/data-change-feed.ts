import type { Request, Response } from "express";
import pg from "pg";
import type { AuthenticatedUser } from "../middleware/auth.js";

type DataChange = {
  resource: string;
  userId: string;
  entityId?: string;
  registrarOnly?: boolean;
};

type Subscriber = {
  response: Response;
  userId: string;
  isRegistrar: boolean;
};

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

const subscribers = new Set<Subscriber>();
let listenerClient: pg.Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;
let isConnecting = false;

function publishChange(change: DataChange) {
  const message = `event: data-change\ndata: ${JSON.stringify(change)}\n\n`;

  for (const subscriber of subscribers) {
    if (subscriber.isRegistrar || (!change.registrarOnly && subscriber.userId === change.userId)) {
      subscriber.response.write(message);
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectListener();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

async function connectListener() {
  if (listenerClient || isConnecting) return;
  isConnecting = true;
  let client: pg.Client | null = null;
  let isClosed = false;

  try {
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    listenerClient = client;
    const closeClient = () => {
      if (isClosed) return;
      isClosed = true;
      void client?.end().catch((error) => {
        console.error("Unable to close the portal data-change listener.", error);
      });
    };
    client.on("notification", (notification) => {
      if (notification.channel !== "portal_data_changed" || !notification.payload) return;
      try {
        publishChange(JSON.parse(notification.payload) as DataChange);
      } catch (error) {
        console.error("Unable to parse a portal data-change notification.", error);
      }
    });
    const handleDisconnect = (error?: Error) => {
      if (listenerClient !== client) return;
      listenerClient = null;
      closeClient();
      if (error) console.error("Portal data-change listener disconnected.", error);
      else console.error("Portal data-change listener connection ended.");
      scheduleReconnect();
    };
    client.on("error", handleDisconnect);
    client.on("end", () => handleDisconnect());
    await client.connect();
    await client.query("LISTEN portal_data_changed");
    reconnectDelay = 1000;
    for (const subscriber of subscribers) {
      subscriber.response.write(
        `event: data-change\ndata: ${JSON.stringify({
          resource: "*",
          userId: subscriber.userId,
          resync: true,
        })}\n\n`,
      );
    }
  } catch (error) {
    if (client) {
      if (listenerClient === client) listenerClient = null;
      if (!isClosed) {
        isClosed = true;
        void client.end().catch((closeError) => {
          console.error("Unable to close the portal data-change listener.", closeError);
        });
      }
    }
    console.error("Unable to start the portal data-change listener.", error);
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

export function startDataChangeFeed() {
  return connectListener();
}

export function streamDataChanges(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).end();
    return;
  }

  const roles = req.user.roles.map((role) => role.toLowerCase());
  const subscriber: Subscriber = {
    response: res,
    userId: String(req.user.id),
    isRegistrar: roles.some((role) =>
      ["registrar", "administrator", "admin", "saso"].includes(role),
    ),
  };

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  subscribers.add(subscriber);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  let isCleanedUp = false;
  const cleanupSubscriber = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    clearInterval(heartbeat);
    subscribers.delete(subscriber);
  };

  req.on("close", () => {
    if (res.destroyed || res.writableEnded) cleanupSubscriber();
  });
  res.on("close", cleanupSubscriber);
}
