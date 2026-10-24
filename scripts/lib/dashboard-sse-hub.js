/** @typedef {{ send: (event: string, data: string) => void, ping: () => void, close: () => void }} SseClient */

/** @type {Set<SseClient>} */
const clients = new Set();

/** @returns {Response} */
export function createSseResponse() {
  /** @type {SseClient | undefined} */
  let clientRef;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      clientRef = {
        send(event, data) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        },
        ping() {
          controller.enqueue(encoder.encode(": ping\n\n"));
        },
        close() {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      };
      clients.add(clientRef);
      clientRef.send("connected", "{}");
    },
    cancel() {
      if (clientRef) clients.delete(clientRef);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** @returns {number} clients notified */
export function broadcastDashboardReload() {
  for (const client of clients) {
    try {
      client.send("reload", "{}");
    } catch {
      client.close();
      clients.delete(client);
    }
  }
  return clients.size;
}

/** @returns {number} */
export function sseClientCount() {
  return clients.size;
}
