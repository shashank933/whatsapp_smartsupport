import express from "express";
import { createServer as createHttpServer } from "http";
import net from "net";
import path from "path";
import { createServer as createViteServer } from "vite";

// Load environment variables
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const app = express();
const httpServer = createHttpServer(app);
app.use(express.json());

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port += 1;
  }
  return port;
}

// -------------------------------------------------------------
// VITE DEV SERVER AND PRODUCTION ASSET HANDLERS
// -------------------------------------------------------------
async function bootstrapServer() {
  const port = await findAvailablePort(DEFAULT_PORT);

  // Import routes only after dotenv has populated process.env.
  const [{ knowledgeRouter }, { adminRouter }, { threadRouter }, { webhookRouter }] = await Promise.all([
    import("./backend/routes/knowledgeRoutes"),
    import("./backend/routes/adminRoutes"),
    import("./backend/routes/threadRoutes"),
    import("./backend/routes/webhookRoutes"),
  ]);

  app.use("/api", knowledgeRouter);
  app.use("/api", adminRouter);
  app.use("/api", threadRouter);
  app.use("/api", webhookRouter);

  if (process.env.NODE_ENV !== "production") {
    const viteInstance = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
    console.log("Vite dev server middleware added.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static server route configured.");
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`WhatsApp agent backend online & listening on port ${port}`);
    if (port !== DEFAULT_PORT) {
      console.log(`Port ${DEFAULT_PORT} was busy, so the app started on ${port}.`);
    }
  });
}

bootstrapServer().catch((e) => {
  console.error("Uncaught server startup exception:", e);
});
