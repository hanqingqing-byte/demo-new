import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const MAX_BODY = 60 * 1024 * 1024;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "";
const SUPABASE_PUBLIC_URL = process.env.SUPABASE_PUBLIC_URL || SUPABASE_URL;
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || "";
const REMOTE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_BUCKET);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

let store = null;

await ensureStore();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await handleAssetOrSpa(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Demo Feedback server running at http://127.0.0.1:${PORT}`);
});

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    sendJson(res, 200, {
      demos: store.demos,
      feedback: store.feedback,
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/demos") {
    sendJson(res, 200, { demos: store.demos });
    return;
  }

  const demoMatch = pathname.match(/^\/api\/demos\/([^/]+)$/);
  if (demoMatch && req.method === "GET") {
    const demoId = decodeURIComponent(demoMatch[1]);
    const demo = store.demos.find((item) => item.id === demoId);
    if (!demo) {
      sendJson(res, 404, { error: "Demo not found" });
      return;
    }
    sendJson(res, 200, {
      demo,
      feedback: store.feedback.filter((item) => item.demoId === demoId),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/demos") {
    const body = await readJson(req);
    const title = String(body.title || "").trim();
    if (!title) {
      sendJson(res, 400, { error: "title_required" });
      return;
    }
    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length) {
      sendJson(res, 400, { error: "images_required" });
      return;
    }

    const id = ensureUniqueDemoId(slugify(title) || crypto.randomUUID());
    const now = new Date().toISOString();
    const demoDir = path.join(UPLOADS_DIR, id);
    await fs.mkdir(demoDir, { recursive: true });

    const savedImages = [];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const saved = await saveDataUrlImage(image, demoDir, `${String(index + 1).padStart(2, "0")}`);
      if (saved) {
        savedImages.push(saved);
      }
    }

    const demo = {
      id,
      title,
      module: String(body.module || "").trim(),
      description: String(body.description || "").trim(),
      focusPrompt:
        String(body.focusPrompt || "").trim() ||
        String(body.description || "").trim() ||
        "请重点关注信息层级、主要操作入口和确认动作是否明确。",
      images: savedImages,
      createdAt: now,
      updatedAt: now,
    };

    store.demos.unshift(demo);
    await persistStore();
    sendJson(res, 201, { demo });
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/demos\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const demoId = decodeURIComponent(deleteMatch[1]);
    const demo = store.demos.find((item) => item.id === demoId);
    const beforeCount = store.demos.length;
    store.demos = store.demos.filter((item) => item.id !== demoId);
    store.feedback = store.feedback.filter((item) => item.demoId !== demoId);
    if (store.demos.length === beforeCount) {
      sendJson(res, 404, { error: "Demo not found" });
      return;
    }
    if (REMOTE_ENABLED && demo) {
      await Promise.all(
        (demo.images || [])
          .map(extractObjectPath)
          .filter(Boolean)
          .map((objectPath) =>
            fetch(
              `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${objectPath
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
              {
                method: "DELETE",
                headers: {
                  apikey: SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
              }
            ).catch(() => null)
          )
      );
    }
    await persistStore();
    sendJson(res, 200, { ok: true });
    return;
  }

  const feedbackMatch = pathname.match(/^\/api\/demos\/([^/]+)\/feedback$/);
  if (feedbackMatch && req.method === "POST") {
    const demoId = decodeURIComponent(feedbackMatch[1]);
    const demo = store.demos.find((item) => item.id === demoId);
    if (!demo) {
      sendJson(res, 404, { error: "Demo not found" });
      return;
    }

    const body = await readJson(req);
    const mis = String(body.mis || "").trim();
    const text = String(body.text || "").trim();
    if (!mis || !text) {
      sendJson(res, 400, { error: "validation_error" });
      return;
    }

    const createdAt = new Date().toISOString();
    const feedback = {
      id: crypto.randomUUID(),
      demoId,
      mis,
      role: String(body.role || "").trim(),
      text,
      device: String(body.device || "Web").trim() || "Web",
      createdAt,
      isNew: true,
    };

    store.feedback.unshift(feedback);
    demo.updatedAt = createdAt;
    await persistStore();
    sendJson(res, 201, { feedback, demo });
    return;
  }

  const markReadMatch = pathname.match(/^\/api\/demos\/([^/]+)\/feedback\/mark-read$/);
  if (markReadMatch && req.method === "POST") {
    const demoId = decodeURIComponent(markReadMatch[1]);
    let changed = false;
    for (const item of store.feedback) {
      if (item.demoId === demoId && item.isNew) {
        item.isNew = false;
        changed = true;
      }
    }
    if (changed) {
      await persistStore();
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function handleAssetOrSpa(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${safePath}`);

  if (await exists(filePath) && (await fs.stat(filePath)).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": ext === ".js" || ext === ".css" ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
    return;
  }

  const routePrefix = pathname.split("/").filter(Boolean)[0];
  if (!pathname.startsWith("/api/") && ["share", "feedback", "new"].includes(routePrefix) || pathname === "/") {
    const indexHtml = await fs.readFile(path.join(ROOT, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(indexHtml);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  if (store) {
    return;
  }
  if (REMOTE_ENABLED) {
    try {
      store = await loadRemoteStore();
      if (store.demos.length || store.feedback.length) {
        return;
      }
      store = createSeedStore();
      await persistStore();
      return;
    } catch (error) {
      console.warn("Failed to load remote store, falling back to local file store:", error.message);
    }
  }
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    store = JSON.parse(raw);
    store.demos = Array.isArray(store.demos) ? store.demos : [];
    store.feedback = Array.isArray(store.feedback) ? store.feedback : [];
    return;
  } catch {
    store = createSeedStore();
    await persistStore();
  }
}

async function persistStore() {
  if (REMOTE_ENABLED) {
    await syncRemoteStore(store);
    return;
  }
  await fs.writeFile(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function loadRemoteStore() {
  const [demoRows, feedbackRows] = await Promise.all([
    supabaseRest("demos?select=*&order=updated_at.desc"),
    supabaseRest("feedback?select=*&order=created_at.desc"),
  ]);

  return {
    demos: demoRows.map(rowToDemo),
    feedback: feedbackRows.map(rowToFeedback),
  };
}

async function syncRemoteStore(currentStore) {
  await supabaseRest("feedback", {
    method: "DELETE",
  });
  await supabaseRest("demos", {
    method: "DELETE",
  });

  if (currentStore.demos.length) {
    await supabaseRest("demos", {
      method: "POST",
      body: JSON.stringify(currentStore.demos.map(demoToRow)),
    });
  }

  if (currentStore.feedback.length) {
    await supabaseRest("feedback", {
      method: "POST",
      body: JSON.stringify(currentStore.feedback.map(feedbackToRow)),
    });
  }
}

async function supabaseRest(pathname, options = {}) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase REST failed (${response.status}): ${message || response.statusText}`);
  }

  if (response.status === 204) {
    return [];
  }

  const text = await response.text();
  if (!text) {
    return [];
  }
  return JSON.parse(text);
}

function rowToDemo(row) {
  return {
    id: row.id,
    title: row.title,
    module: row.module || "",
    description: row.description || "",
    focusPrompt: row.focus_prompt || row.description || "请重点关注信息层级、主要操作入口和确认动作是否明确。",
    images: Array.isArray(row.images) ? row.images : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFeedback(row) {
  return {
    id: row.id,
    demoId: row.demo_id,
    mis: row.mis,
    role: row.role || "",
    text: row.text,
    device: row.device || "Web",
    createdAt: row.created_at,
    isNew: row.is_new ?? true,
  };
}

function demoToRow(demo) {
  return {
    id: demo.id,
    title: demo.title,
    module: demo.module || "",
    description: demo.description || "",
    focus_prompt: demo.focusPrompt || demo.description || "",
    images: Array.isArray(demo.images) ? demo.images : [],
    created_at: demo.createdAt,
    updated_at: demo.updatedAt,
  };
}

function feedbackToRow(item) {
  return {
    id: item.id,
    demo_id: item.demoId,
    mis: item.mis,
    role: item.role || "",
    text: item.text,
    device: item.device || "Web",
    created_at: item.createdAt,
    is_new: Boolean(item.isNew),
  };
}

function getPublicObjectUrl(objectPath) {
  const base = SUPABASE_PUBLIC_URL.replace(/\/$/, "");
  const bucket = encodeURIComponent(SUPABASE_BUCKET);
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function extractObjectPath(imageUrl) {
  try {
    const url = new URL(imageUrl, "http://localhost");
    const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {
    // fall through
  }
  return null;
}

function createSeedStore() {
  const demoA = {
    id: "checkout-v2",
    title: "支付页转化优化",
    module: "首页 / 结账 / 支付",
    description:
      "重点反馈集中在入口文案、表单校验与支付确认页的决策落差，建议先补齐关键页面截图。",
    focusPrompt:
      "请重点关注：信息层级是否清晰、关键按钮是否容易识别，以及提交前确认步骤是否足够明确。",
    images: [
      makeSampleImage("01", "#dfe7ff", "#f9d2e7"),
      makeSampleImage("02", "#f6f7fb", "#b8d6ff"),
      makeSampleImage("03", "#ffcd4d", "#ff8c00"),
      makeSampleImage("04", "#d6f0d3", "#70a85d"),
    ],
    createdAt: "2026-03-16T08:12:00+08:00",
    updatedAt: "2026-03-16T10:23:00+08:00",
  };

  const demoB = {
    id: "onboarding-refresh",
    title: "新手引导流程优化",
    module: "登录 / 欢迎页 / 设置",
    description:
      "当前反馈主要集中在动线跳转和文案理解成本，建议先收集首屏图片与关键按钮状态。",
    focusPrompt:
      "请重点看：首屏是否知道下一步做什么，跳过按钮是否容易找到，以及确认文案是否让人有把握。",
    images: [
      makeSampleImage("A1", "#efe5ff", "#b9a1ff"),
      makeSampleImage("A2", "#fff1d4", "#ffc66c"),
      makeSampleImage("A3", "#d4fff0", "#76dfbb"),
    ],
    createdAt: "2026-03-15T18:20:00+08:00",
    updatedAt: "2026-03-16T09:41:00+08:00",
  };

  return {
    demos: [demoA, demoB],
    feedback: [
      {
        id: crypto.randomUUID(),
        demoId: demoA.id,
        mis: "Alice",
        role: "产品经理",
        text: "建议把“确认支付”前的金额摘要再突出一些，目前滚动后很容易忽略。",
        device: "iPhone",
        createdAt: "2026-03-16T10:23:00+08:00",
        isNew: true,
      },
      {
        id: crypto.randomUUID(),
        demoId: demoA.id,
        mis: "Kevin",
        role: "运营",
        text: "优惠券输入和地址确认都在同一屏，建议增加一步提示，降低误操作。",
        device: "MacBook",
        createdAt: "2026-03-16T09:41:00+08:00",
        isNew: true,
      },
      {
        id: crypto.randomUUID(),
        demoId: demoA.id,
        mis: "Mina",
        role: "设计师",
        text: "建议在顶部增加“反馈目标”一句话，让外部用户更快理解这次评审重点。",
        device: "Web",
        createdAt: "2026-03-16T08:55:00+08:00",
        isNew: true,
      },
      {
        id: crypto.randomUUID(),
        demoId: demoB.id,
        mis: "Rex",
        role: "研发",
        text: "跳过引导的按钮目前太弱了，第一次看会担心点错。",
        device: "Windows",
        createdAt: "2026-03-16T09:18:00+08:00",
        isNew: true,
      },
    ],
  };
}

function makeSampleImage(label, start, end) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${start}" />
          <stop offset="1" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="960" height="720" rx="48" fill="url(#bg)" />
      <rect x="110" y="86" width="250" height="548" rx="34" fill="#ffffff" opacity="0.95" />
      <rect x="145" y="124" width="180" height="20" rx="10" fill="#ececec" />
      <rect x="145" y="176" width="180" height="120" rx="18" fill="#f3f3f3" />
      <rect x="145" y="330" width="180" height="14" rx="7" fill="#ececec" />
      <rect x="145" y="360" width="180" height="14" rx="7" fill="#ececec" />
      <rect x="145" y="390" width="126" height="14" rx="7" fill="#ececec" />
      <rect x="450" y="120" width="360" height="480" rx="36" fill="#171717" opacity="0.08" />
      <rect x="498" y="168" width="264" height="364" rx="28" fill="#171717" opacity="0.1" />
      <text x="480" y="610" font-size="72" font-family="Inter, Arial" font-weight="700" fill="#171717" opacity="0.9">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function saveDataUrlImage(dataUrl, demoDir, suffix) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return null;
  }
  const match = dataUrl.match(/^data:([^;]+)(;charset=[^;]+)?(;base64)?,(.*)$/s);
  if (!match) {
    return null;
  }
  const mime = match[1];
  const isBase64 = Boolean(match[3]);
  const payload = match[4];
  const extension = mimeToExtension(mime);
  const filename = `${suffix}${extension}`;
  const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");

  if (REMOTE_ENABLED) {
    const objectPath = `${toStoragePathSegment(path.basename(demoDir))}/${filename}`;
    const uploadUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${objectPath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": mime,
        "x-upsert": "true",
      },
      body: buffer,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Storage upload failed (${response.status}): ${message || response.statusText}`);
    }
    return getPublicObjectUrl(`${path.basename(demoDir)}/${filename}`);
  }

  const filePath = path.join(demoDir, filename);
  await fs.writeFile(filePath, buffer);
  return `/uploads/${path.basename(demoDir)}/${filename}`;
}

function toStoragePathSegment(value) {
  const raw = String(value || "").trim();
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) {
    return ascii;
  }
  const bytes = Buffer.from(raw || crypto.randomUUID(), "utf8");
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
    if (hex.length >= 24) {
      break;
    }
  }
  if (hex) {
    return `demo-${hex}`;
  }
  return `demo-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueDemoId(baseId) {
  let id = baseId || crypto.randomUUID();
  let suffix = 2;
  while (store?.demos.some((demo) => demo.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function mimeToExtension(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };
  return map[mime] || ".bin";
}
