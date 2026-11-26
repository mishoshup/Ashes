import type { Env } from "../types";

/**
 * One Durable Object per channel/chat room.
 * WebSocket Hibernation keeps idle rooms cheap; presence/typing is ephemeral.
 * Auth is checked by the Worker before the upgrade is forwarded.
 */
export class RoomDurableObject {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: Env) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (!client || !server) {
      return new Response("WebSocket pair unavailable", { status: 500 });
    }
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const payload = typeof message === "string" ? message : new Uint8Array(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== ws) {
        socket.send(payload);
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // The socket may already be closed by the peer.
    }
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    console.error(
      JSON.stringify({
        level: "error",
        room: "durable_object",
        message: error instanceof Error ? error.message : "Unknown WebSocket error",
      }),
    );
    try {
      ws.close(1011, "WebSocket error");
    } catch {
      // Already closed.
    }
  }
}
