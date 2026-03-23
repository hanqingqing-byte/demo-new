const MIME_MAP = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

export async function onRequest(context) {
  const { request } = context;
  const method = request.method || "GET";
  const segments = normalizeSegments(context.params?.path);

  if (segments.length === 0 && method === "GET") {
    return jsonResponse(200, { ok: true, scope: "demo-feedback-api" });
  }

  try {
    if (method === "GET" && segments.length === 1 && segments[0] === "bootstrap") {
      return await handleBootstrap(context);
    }

    if (method === "GET" && segments.length === 1 && segments[0] === "demos") {
      const demos = await listDemos(context.env);
      return jsonResponse(200, { demos });
    }

    if (segments[0] === "demos" && segments[1]) {
      const demoId = decodeURIComponent(segments[1]);

      if (method === "GET" && segments.length === 2) {
        return await handleGetDemo(context.env, demoId);
      }

      if (method === "DELETE" && segments.length === 2) {
        return await handleDeleteDemo(context.env, demoId);
      }

      if (method === "POST" && segments.length === 3 && segments[2] === "feedback") {
        return await handleCreateFeedback(context.env, demoId, request);
      }

      if (method === "POST" && segments.length === 4 && segments[2] === "feedback" && segments[3] === "mark-read") {
        return await handleMarkRead(context.env, demoId);
      }
    }

    if (method === "POST" && segments.length === 1 && segments[0] === "demos") {
      return await handleCreateDemo(context.env, request);
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    return jsonResponse(500, { error: error?.message || "Internal server error" });
  }
}

async function handleBootstrap(context) {
  const env = context.env;
  let [demos, feedback] = await Promise.all([listDemos(env), listFeedback(env)]);

  if (!demos.length && !feedback.length) {
    await seedDemoData(env);
    [demos, feedback] = await Promise.all([listDemos(env), listFeedback(env)]);
  }

  return jsonResponse(200, { demos, feedback });
}

async function handleGetDemo(env, demoId) {
  const demo = await getDemo(env, demoId);
  if (!demo) {
    return jsonResponse(404, { error: "Demo not found" });
  }
  const feedback = (await listFeedback(env)).filter((item) => item.demoId === demoId);
  return jsonResponse(200, { demo, feedback });
}

async function handleCreateDemo(env, request) {
  assertStorageEnv(env);
  const body = await readJson(request);
  const title = String(body.title || "").trim();
  if (!title) {
    return jsonResponse(400, { error: "title_required" });
  }

  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length) {
    return jsonResponse(400, { error: "images_required" });
  }

  const existingIds = await listDemoIds(env);
  const id = ensureUniqueDemoId(slugify(title) || crypto.randomUUID(), existingIds);
  const now = new Date().toISOString();
  const savedImages = [];

  for (let index = 0; index < images.length; index += 1) {
    const saved = await uploadDataUrlImage(env, images[index], id, `${String(index + 1).padStart(2, "0")}`);
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

  await supabaseRest(env, "demos", {
    method: "POST",
    body: JSON.stringify([demoToRow(demo)]),
  });

  return jsonResponse(201, { demo });
}

async function handleDeleteDemo(env, demoId) {
  const demo = await getDemo(env, demoId);
  if (!demo) {
    return jsonResponse(404, { error: "Demo not found" });
  }

  await supabaseRest(env, `feedback?demo_id=eq.${encodeURIComponent(demoId)}`, {
    method: "DELETE",
  });
  await supabaseRest(env, `demos?id=eq.${encodeURIComponent(demoId)}`, {
    method: "DELETE",
  });

  await Promise.all((demo.images || []).map((url) => deletePublicImage(env, url)).filter(Boolean));
  return jsonResponse(200, { ok: true });
}

async function handleCreateFeedback(env, demoId, request) {
  const demo = await getDemo(env, demoId);
  if (!demo) {
    return jsonResponse(404, { error: "Demo not found" });
  }

  const body = await readJson(request);
  const mis = String(body.mis || "").trim();
  const text = String(body.text || "").trim();
  if (!mis || !text) {
    return jsonResponse(400, { error: "validation_error" });
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

  await supabaseRest(env, "feedback", {
    method: "POST",
    body: JSON.stringify([feedbackToRow(feedback)]),
  });

  await supabaseRest(env, "demos", {
    method: "PATCH",
    body: JSON.stringify({ updated_at: createdAt }),
  }, `id=eq.${encodeURIComponent(demoId)}`);

  return jsonResponse(201, { feedback, demo: { ...demo, updatedAt: createdAt } });
}

async function handleMarkRead(env, demoId) {
  const rows = await listFeedback(env);
  const unreadIds = rows.filter((item) => item.demoId === demoId && item.isNew).map((item) => item.id);
  if (unreadIds.length) {
    await Promise.all(
      unreadIds.map((id) =>
        supabaseRest(env, `feedback?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ is_new: false }),
        })
      )
    );
  }
  return jsonResponse(200, { ok: true });
}

async function seedDemoData(env) {
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

  await createDemoRecord(env, demoA, [
    { mis: "Alice", role: "产品经理", text: "建议把“确认支付”前的金额摘要再突出一些，目前滚动后很容易忽略。", device: "iPhone", createdAt: "2026-03-16T10:23:00+08:00", isNew: true },
    { mis: "Kevin", role: "运营", text: "优惠券输入和地址确认都在同一屏，建议增加一步提示，降低误操作。", device: "MacBook", createdAt: "2026-03-16T09:41:00+08:00", isNew: true },
    { mis: "Mina", role: "设计师", text: "建议在顶部增加“反馈目标”一句话，让外部用户更快理解这次评审重点。", device: "Web", createdAt: "2026-03-16T08:55:00+08:00", isNew: true },
  ]);

  await createDemoRecord(env, demoB, [
    { mis: "Rex", role: "研发", text: "跳过引导的按钮目前太弱了，第一次看会担心点错。", device: "Windows", createdAt: "2026-03-16T09:18:00+08:00", isNew: true },
  ]);
}

async function createDemoRecord(env, demo, feedbackItems = []) {
  const savedImages = [];
  for (let index = 0; index < demo.images.length; index += 1) {
    const saved = await uploadDataUrlImage(env, demo.images[index], demo.id, `${String(index + 1).padStart(2, "0")}`);
    if (saved) {
      savedImages.push(saved);
    }
  }
  await supabaseRest(env, "demos", {
    method: "POST",
    body: JSON.stringify([
      demoToRow({
        ...demo,
        images: savedImages,
      }),
    ]),
  });
  if (feedbackItems.length) {
    await supabaseRest(env, "feedback", {
      method: "POST",
      body: JSON.stringify(
        feedbackItems.map((item) =>
          feedbackToRow({
            id: crypto.randomUUID(),
            demoId: demo.id,
            ...item,
          })
        )
      ),
    });
  }
}

async function listDemos(env) {
  const rows = await supabaseRest(env, "demos?select=*&order=updated_at.desc");
  return rows.map(rowToDemo);
}

async function listDemoIds(env) {
  const rows = await supabaseRest(env, "demos?select=id");
  return rows.map((row) => row.id);
}

async function listFeedback(env) {
  const rows = await supabaseRest(env, "feedback?select=*&order=created_at.desc");
  return rows.map(rowToFeedback);
}

async function getDemo(env, demoId) {
  const rows = await supabaseRest(env, `demos?select=*&id=eq.${encodeURIComponent(demoId)}`);
  return rows[0] ? rowToDemo(rows[0]) : null;
}

async function supabaseRest(env, pathname, options = {}, extraQuery = "") {
  assertCoreEnv(env);
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}${buildQuerySuffix(pathname, extraQuery)}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase REST failed (${response.status}): ${message || response.statusText}`);
  }

  if (response.status === 204) {
    return [];
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function buildQuerySuffix(pathname, extraQuery) {
  if (!extraQuery) {
    return "";
  }
  return pathname.includes("?") ? `&${extraQuery}` : `?${extraQuery}`;
}

async function uploadDataUrlImage(env, dataUrl, demoId, suffix) {
  assertStorageEnv(env);
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
  const extension = MIME_MAP[mime] || ".bin";
  const fileName = `${suffix}${extension}`;
  const objectPath = `${toStoragePathSegment(demoId)}/${fileName}`;
  const bytes = isBase64 ? base64ToBytes(payload) : new TextEncoder().encode(decodeURIComponent(payload));
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(env.SUPABASE_BUCKET)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Storage upload failed (${response.status}): ${message || response.statusText}`);
  }

  return getPublicObjectUrl(env, objectPath);
}

async function deletePublicImage(env, imageUrl) {
  assertStorageEnv(env);
  const objectPath = extractObjectPath(env, imageUrl);
  if (!objectPath) {
    return null;
  }
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(env.SUPABASE_BUCKET)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).catch(() => null);
  return null;
}

function getPublicObjectUrl(env, objectPath) {
  const base = env.SUPABASE_PUBLIC_URL || env.SUPABASE_URL;
  const bucket = encodeURIComponent(env.SUPABASE_BUCKET);
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function extractObjectPath(env, imageUrl) {
  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${env.SUPABASE_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {
    return null;
  }
  return null;
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

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueDemoId(baseId, existingIds) {
  let id = baseId || crypto.randomUUID();
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
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
  const bytes = new TextEncoder().encode(raw || crypto.randomUUID());
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

function normalizeSegments(pathValue) {
  if (!pathValue) {
    return [];
  }
  if (Array.isArray(pathValue)) {
    return pathValue.filter(Boolean).map(String);
  }
  return String(pathValue)
    .split("/")
    .filter(Boolean)
    .map(String);
}

async function readJson(request) {
  const raw = await request.text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function assertCoreEnv(env) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required Supabase environment variables");
  }
}

function assertStorageEnv(env) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY || !env?.SUPABASE_BUCKET) {
    throw new Error("Missing required Supabase environment variables");
  }
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
