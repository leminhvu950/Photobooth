import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import QRCode from "qrcode";

await import("./build-static.mjs");

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const staticRoot = path.join(projectRoot, "dist");
const shareRoot = path.join(projectRoot, ".snapjoy-shares");
const configuredPort = Number.parseInt(process.env.PORT || process.env.SNAPJOY_PORT || "8080", 10);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 8080;
const shareLifetimeMs = 30 * 60 * 1000;
const maxPhotoBytes = 25 * 1024 * 1024;
const maxVideoBytes = 150 * 1024 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function findLanAddress() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  return addresses.find((address) => (
    address.startsWith("192.168.")
    || address.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  )) || addresses[0] || "";
}

function normalizeConfiguredHost(value) {
  const cleanValue = value.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(cleanValue)) return cleanValue;
  return `http://${cleanValue}${cleanValue.includes(":") ? "" : `:${port}`}`;
}

const lanAddress = findLanAddress();
const configuredBaseUrl = (
  process.env.SNAPJOY_PUBLIC_URL
  || process.env.SNAPJOY_SHARE_HOST
  || process.env.RENDER_EXTERNAL_URL
  || ""
).trim();
const hostedPublicly = Boolean(configuredBaseUrl);
const publicBaseUrl = hostedPublicly
  ? normalizeConfiguredHost(configuredBaseUrl)
  : `http://${lanAddress || "localhost"}:${port}`;
const phoneReady = hostedPublicly || Boolean(lanAddress);
const allowedOrigins = (process.env.SNAPJOY_ALLOWED_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  const allowAll = allowedOrigins.includes("*");
  if (!allowAll && !allowedOrigins.includes(origin.replace(/\/$/, ""))) return;
  response.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : origin);
  if (!allowAll) response.setHeader("Vary", "Origin");
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendHtml(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function readJsonBody(request, maxBytes = 16 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error("BODY_TOO_LARGE"), { code: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sessionDirectory(id) {
  return path.join(shareRoot, id);
}

function metadataPath(id) {
  return path.join(sessionDirectory(id), "metadata.json");
}

async function readMetadata(id) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(metadataPath(id), "utf8"));
  } catch {
    return null;
  }
}

function videoExtension(type) {
  return type.includes("mp4") ? "mp4" : "webm";
}

function createSizeLimiter(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(Object.assign(new Error("FILE_TOO_LARGE"), { code: "FILE_TOO_LARGE" }));
        return;
      }
      callback(null, chunk);
    },
  });
}

async function writeUpload(request, destination, maxBytes) {
  const temporaryPath = `${destination}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await pipeline(request, createSizeLimiter(maxBytes), createWriteStream(temporaryPath, { flags: "wx" }));
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function createShare(request, response) {
  if (!phoneReady) {
    sendJson(response, 503, { error: "Không tìm thấy địa chỉ mạng Wi-Fi của máy photobooth." });
    return;
  }

  let input;
  try {
    input = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "Dữ liệu tạo phiên chia sẻ không hợp lệ." });
    return;
  }

  const id = randomBytes(16).toString("hex");
  const createdAt = Date.now();
  const hasVideo = input.hasVideo === true;
  const suppliedVideoType = typeof input.videoType === "string" ? input.videoType.toLowerCase() : "";
  const savedVideoType = suppliedVideoType.includes("mp4") ? "video/mp4" : "video/webm";
  const metadata = {
    id,
    createdAt,
    expiresAt: createdAt + shareLifetimeMs,
    hasVideo,
    videoType: savedVideoType,
    videoExtension: videoExtension(savedVideoType),
    complete: false,
  };

  await mkdir(sessionDirectory(id), { recursive: true });
  await writeFile(metadataPath(id), JSON.stringify(metadata), "utf8");
  sendJson(response, 201, {
    id,
    photoUploadUrl: `/api/shares/${id}/photo`,
    videoUploadUrl: hasVideo ? `/api/shares/${id}/video` : null,
    completeUrl: `/api/shares/${id}/complete`,
  });
}

async function uploadShareFile(request, response, id, kind) {
  const metadata = await readMetadata(id);
  if (!metadata || metadata.expiresAt <= Date.now()) {
    sendJson(response, 404, { error: "Phiên chia sẻ không tồn tại hoặc đã hết hạn." });
    return;
  }

  if (kind === "video" && !metadata.hasVideo) {
    sendJson(response, 400, { error: "Phiên này không có video." });
    return;
  }

  const expectedType = kind === "photo" ? "image/png" : metadata.videoType;
  const suppliedType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (suppliedType !== expectedType) {
    sendJson(response, 415, { error: `Định dạng ${kind === "photo" ? "ảnh" : "video"} không hợp lệ.` });
    return;
  }

  const filename = kind === "photo" ? "photo.png" : `video.${metadata.videoExtension}`;
  const maximum = kind === "photo" ? maxPhotoBytes : maxVideoBytes;
  try {
    await writeUpload(request, path.join(sessionDirectory(id), filename), maximum);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    const tooLarge = error?.code === "FILE_TOO_LARGE";
    sendJson(response, tooLarge ? 413 : 500, {
      error: tooLarge ? "Tệp vượt quá giới hạn dung lượng." : "Không thể lưu tệp trên máy photobooth.",
    });
  }
}

async function completeShare(response, id) {
  const metadata = await readMetadata(id);
  if (!metadata || metadata.expiresAt <= Date.now()) {
    sendJson(response, 404, { error: "Phiên chia sẻ không tồn tại hoặc đã hết hạn." });
    return;
  }

  const hasPhotoFile = await fileExists(path.join(sessionDirectory(id), "photo.png"));
  const hasVideoFile = !metadata.hasVideo
    || await fileExists(path.join(sessionDirectory(id), `video.${metadata.videoExtension}`));
  if (!hasPhotoFile || !hasVideoFile) {
    sendJson(response, 409, { error: "Ảnh hoặc video chưa được tải lên đầy đủ." });
    return;
  }

  metadata.complete = true;
  await writeFile(metadataPath(id), JSON.stringify(metadata), "utf8");
  const downloadUrl = `${publicBaseUrl}/share/${id}`;
  const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#211e1c", light: "#ffffff" },
  });
  sendJson(response, 200, {
    downloadUrl,
    qrDataUrl,
    expiresAt: metadata.expiresAt,
  });
}

function sharePage(metadata) {
  const expiresAt = new Date(metadata.expiresAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const videoBlock = metadata.hasVideo
    ? `<section class="asset"><h2>Video tạo dáng</h2><video controls playsinline preload="metadata" src="/share/${metadata.id}/video"></video><a class="button secondary" href="/share/${metadata.id}/video?download=1">Tải video</a></section>`
    : "";
  const notice = hostedPublicly
    ? `Liên kết tự hết hạn lúc ${expiresAt}.`
    : `Liên kết chỉ hoạt động trong cùng mạng Wi-Fi và tự hết hạn lúc ${expiresAt}.`;

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Khoảnh khắc SnapJoy</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #292421; background: #fff9f4; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; padding: 24px 16px 42px; background: radial-gradient(circle at top, #ffe2d4, transparent 26rem), #fff9f4; }
      main { width: min(720px, 100%); margin: 0 auto; }
      header { padding: 18px 0 26px; text-align: center; }
      .brand { color: #ec6737; font-size: .75rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 10px 0 8px; font-family: Georgia, serif; font-size: clamp(2rem, 9vw, 3.5rem); font-weight: 400; }
      p { margin: 0; color: #746760; line-height: 1.6; }
      .asset { margin-bottom: 18px; padding: 15px; border: 1px solid #eadfd5; border-radius: 22px; background: rgba(255,255,255,.92); box-shadow: 0 18px 50px rgba(72,48,36,.1); }
      h2 { margin: 0 0 12px; font-size: .82rem; letter-spacing: .04em; }
      img, video { display: block; width: 100%; max-height: 72vh; border-radius: 14px; background: #211e1c; object-fit: contain; }
      .button { display: flex; min-height: 50px; align-items: center; justify-content: center; margin-top: 13px; border-radius: 14px; color: white; background: #eb6737; font-size: .85rem; font-weight: 850; text-decoration: none; }
      .button.secondary { color: #292421; background: #f4ece6; }
      .notice { margin-top: 22px; padding: 14px; border-radius: 14px; background: #fff0e9; font-size: .76rem; text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <header><div class="brand">SnapJoy Photobooth</div><h1>Khoảnh khắc của bạn ✦</h1><p>Tải ảnh và video xuống điện thoại trước khi liên kết hết hạn.</p></header>
      <section class="asset"><h2>Ảnh photobooth</h2><img src="/share/${metadata.id}/photo" alt="Ảnh photobooth của bạn" /><a class="button" href="/share/${metadata.id}/photo?download=1">Tải ảnh PNG</a></section>
      ${videoBlock}
      <p class="notice">${notice}</p>
    </main>
  </body>
</html>`;
}

async function serveSharePage(response, id) {
  const metadata = await readMetadata(id);
  if (!metadata || !metadata.complete || metadata.expiresAt <= Date.now()) {
    sendHtml(response, 404, "<h1>Liên kết không tồn tại hoặc đã hết hạn.</h1>");
    return;
  }
  sendHtml(response, 200, sharePage(metadata));
}

async function serveShareAsset(requestUrl, response, id, kind) {
  const metadata = await readMetadata(id);
  if (!metadata || !metadata.complete || metadata.expiresAt <= Date.now()) {
    sendJson(response, 404, { error: "Tệp không tồn tại hoặc đã hết hạn." });
    return;
  }

  const isPhoto = kind === "photo";
  if (!isPhoto && !metadata.hasVideo) {
    sendJson(response, 404, { error: "Phiên này không có video." });
    return;
  }
  const filename = isPhoto ? "photo.png" : `video.${metadata.videoExtension}`;
  const filePath = path.join(sessionDirectory(id), filename);
  let details;
  try {
    details = await stat(filePath);
  } catch {
    sendJson(response, 404, { error: "Không tìm thấy tệp." });
    return;
  }

  const download = requestUrl.searchParams.get("download") === "1";
  response.writeHead(200, {
    "Cache-Control": "private, max-age=60",
    "Content-Type": isPhoto ? "image/png" : metadata.videoType,
    "Content-Length": details.size,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="snapjoy-${id.slice(0, 8)}.${isPhoto ? "png" : metadata.videoExtension}"`,
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

async function serveStatic(requestUrl, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendJson(response, 400, { error: "Đường dẫn không hợp lệ." });
    return;
  }

  if (pathname === "/admin") {
    response.writeHead(302, { Location: "/admin/" });
    response.end();
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.resolve(staticRoot, `.${pathname}`);
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    sendJson(response, 403, { error: "Không được phép truy cập." });
    return;
  }

  let details;
  try {
    details = await stat(filePath);
    if (!details.isFile()) throw new Error("NOT_A_FILE");
  } catch {
    sendJson(response, 404, { error: "Không tìm thấy tài nguyên." });
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": details.size,
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

async function cleanupExpiredShares() {
  let entries = [];
  try {
    entries = await readdir(shareRoot, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const metadata = await readMetadata(entry.name);
    if (!metadata || metadata.expiresAt <= Date.now()) {
      await rm(sessionDirectory(entry.name), { recursive: true, force: true });
    }
  }));
}

await mkdir(shareRoot, { recursive: true });
await cleanupExpiredShares();
setInterval(() => cleanupExpiredShares().catch(console.error), 5 * 60 * 1000).unref();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  try {
    applyCors(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      });
      response.end();
      return;
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/api/config") {
      sendJson(response, 200, {
        localSharing: true,
        phoneReady,
        publicBaseUrl,
        hosted: hostedPublicly,
        expiresInMinutes: shareLifetimeMs / 60_000,
      });
      return;
    }
    if (request.method === "POST" && pathname === "/api/shares") {
      await createShare(request, response);
      return;
    }

    const uploadMatch = pathname.match(/^\/api\/shares\/([a-f0-9]{32})\/(photo|video)$/);
    if (request.method === "PUT" && uploadMatch) {
      await uploadShareFile(request, response, uploadMatch[1], uploadMatch[2]);
      return;
    }
    const completeMatch = pathname.match(/^\/api\/shares\/([a-f0-9]{32})\/complete$/);
    if (request.method === "POST" && completeMatch) {
      await completeShare(response, completeMatch[1]);
      return;
    }

    const sharePageMatch = pathname.match(/^\/share\/([a-f0-9]{32})\/?$/);
    if ((request.method === "GET" || request.method === "HEAD") && sharePageMatch) {
      await serveSharePage(response, sharePageMatch[1]);
      return;
    }
    const shareAssetMatch = pathname.match(/^\/share\/([a-f0-9]{32})\/(photo|video)$/);
    if ((request.method === "GET" || request.method === "HEAD") && shareAssetMatch) {
      await serveShareAsset(requestUrl, response, shareAssetMatch[1], shareAssetMatch[2]);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(requestUrl, response);
      return;
    }
    sendJson(response, 405, { error: "Phương thức không được hỗ trợ." });
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "Máy chủ chia sẻ gặp lỗi." });
    else response.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SnapJoy booth: http://localhost:${port}`);
  if (hostedPublicly) {
    console.log(`Phone download link base: ${publicBaseUrl}`);
    console.log("Khách quét mã QR bằng điện thoại có internet, không cần cùng mạng Wi-Fi.");
  } else if (phoneReady) {
    console.log(`Phone download link base: ${publicBaseUrl}`);
    console.log("Điện thoại cần kết nối cùng mạng Wi-Fi với máy photobooth.");
  } else {
    console.log("Không tìm thấy địa chỉ Wi-Fi. Hãy đặt SNAPJOY_SHARE_HOST theo địa chỉ IP của máy.");
  }
});
