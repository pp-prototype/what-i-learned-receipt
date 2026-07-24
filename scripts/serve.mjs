import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = 8000;
const publicDirectory = resolve("dist");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const sendText = (response, statusCode, message) => {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(message);
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(publicDirectory, relativePath);

    if (filePath !== publicDirectory && !filePath.startsWith(`${publicDirectory}${sep}`)) {
      sendText(response, 403, "Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }
    console.error(error);
    sendText(response, 500, "Internal server error");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`포트 ${port}가 이미 사용 중입니다. 기존 로컬 서버를 종료한 뒤 다시 실행해주세요.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`로컬 앱: http://localhost:${port}/`);
  console.log("종료하려면 Ctrl+C를 누르세요.");
});
