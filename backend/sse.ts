import { Response } from "express";

const clients: Set<Response> = new Set();

export function sseConnect(res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(":\n\n");

  clients.add(res);

  res.on("close", () => {
    clients.delete(res);
  });
}

export function sseEmit(event: string, data?: any): void {
  const payload = data ? `data: ${JSON.stringify(data)}\n\n` : "data: {}\n\n";
  const message = `event: ${event}\n${payload}`;

  clients.forEach((res) => {
    try {
      res.write(message);
    } catch {
      clients.delete(res);
    }
  });
}
