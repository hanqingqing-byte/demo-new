const TOAST_MS = 2400;
const API_BASE = "";

const app = document.querySelector("#app");

const ui = {
  draft: createEmptyDraft(),
  feedbackDrafts: {},
  modal: null,
  lightbox: null,
  toast: null,
  loading: false,
  dragIndex: null,
  galleryIndex: 0,
  galleryScrollLeft: 0,
  mobileSchemeScrollLeft: 0,
  lastRouteKey: "",
  pageEnter: true,
  uploadDragover: false,
  mobileFeedbackOpen: false,
};

let state = { demos: [], feedback: [] };
let appReady = false;

window.addEventListener("hashchange", () => {
  history.replaceState({}, "", location.hash.slice(1) || "/");
  render();
});
window.addEventListener("popstate", render);
document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("dragstart", handleDragStart);
document.addEventListener("dragover", handleDragOver);
document.addEventListener("drop", handleDrop);
document.addEventListener("dragenter", handleDragEnter);
document.addEventListener("dragleave", handleDragLeave);
document.addEventListener("scroll", handleScroll, true);
document.addEventListener("pointerdown", handlePointerDown);

if (location.hash && location.hash.length > 1) {
  const hashPath = location.hash.slice(1);
  if (hashPath.startsWith("/")) {
    history.replaceState({}, "", hashPath);
  }
}

bootstrap();

function createEmptyDraft() {
  return {
    title: "",
    module: "",
    description: "",
    images: [],
  };
}

function createEmptyFeedbackDraft() {
  return {
    mis: "",
    text: "",
  };
}

async function bootstrap() {
  try {
    state = await apiGet("/api/bootstrap");
  } catch {
    state = { demos: [], feedback: [] };
  }
  appReady = true;
  render();
}

async function apiGet(url) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
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

function getRoute() {
  const parts = location.pathname.split("/").filter(Boolean);

  if (parts[0] === "new") {
    return { name: "new" };
  }
  if (parts[0] === "share" && parts[1]) {
    return { name: "share", id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "feedback" && parts[1]) {
    return { name: "feedback", id: decodeURIComponent(parts[1]) };
  }
  return { name: "home" };
}

function navigate(path) {
  if (location.pathname === path) {
    render();
    return;
  }
  history.pushState({}, "", path);
  render();
}

function render() {
  if (!appReady) {
    app.innerHTML = `
      <div class="app-shell">
        <main class="${pageClass()}">
          <div class="empty-state">正在加载真实数据…</div>
        </main>
      </div>
    `;
    return;
  }
  const route = getRoute();
  const routeKey = `${route.name}:${route.id || ""}`;
  ui.pageEnter = ui.lastRouteKey !== routeKey;
  ui.lastRouteKey = routeKey;
  if (route.name === "share") {
    ui.galleryIndex = clamp(ui.galleryIndex, 0, Math.max(getDemo(route.id)?.images.length - 1 || 0, 0));
  } else {
    ui.galleryIndex = 0;
    ui.mobileFeedbackOpen = false;
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderPage(route)}
    </div>
    ${renderModal()}
    ${renderLightbox()}
    ${renderToast()}
  `;
  syncGalleryProgress();
  syncMobileSchemeScroll();
}

function pageClass(extra = "") {
  return `page ${extra} ${ui.pageEnter ? "page-enter" : ""}`.trim();
}

function renderPage(route) {
  if (route.name === "new") {
    return renderCreatePage();
  }
  if (route.name === "share") {
    return renderSharePage(route.id);
  }
  if (route.name === "feedback") {
    return renderFeedbackPage(route.id);
  }
  return renderDashboard();
}

function renderDashboard() {
  const demos = [...state.demos].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const weeklyFeedbackCount = state.feedback.filter((item) => {
    return Date.now() - Date.parse(item.createdAt) <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return `
    <main class="${pageClass("stack-24")}">
      <div class="topbar">
        ${renderBrand()}
        <button class="button button-primary button-large" data-action="go-new">${renderIcon("plus")}创建Demo</button>
      </div>

      <section class="hero-card">
        <div class="section-head">
          <div>
            <h1 class="hero-headline">反馈管理</h1>
          </div>
        </div>
        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-label">进行中的 Demo</span>
            <strong class="stat-value">${demos.length}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">本周新增反馈</span>
            <strong class="stat-value">${weeklyFeedbackCount} 条</strong>
          </article>
        </div>
      </section>

      <section class="stack-24">
        <div class="section-head">
          <div>
            <h2 class="section-title">我的 Demo</h2>
          </div>
        </div>
        ${
          demos.length
            ? `<div class="demo-list">${demos.map(renderDemoCard).join("")}</div>`
            : `
              <div class="empty-state empty-state-demo">
                <p>还没有 Demo，先创建一个试试。</p>
                <button class="button button-primary button-large" data-action="go-new">${renderIcon("plus")}创建Demo</button>
              </div>
            `
        }
      </section>
    </main>
  `;
}

function renderDemoCard(demo) {
  const unreadCount = getFeedbackForDemo(demo.id).filter((item) => item.isNew).length;

  return `
    <article class="demo-card" data-action="open-feedback" data-demo-id="${escapeAttr(demo.id)}">
      ${renderDemoPreview(demo)}

      <div class="demo-info">
        <div class="demo-copy">
          <div class="card-top">
            <div>
              <h3 class="demo-title">${escapeHtml(demo.title)}</h3>
              <p class="card-meta">关联模块：${escapeHtml(demo.module || "未填写")}</p>
            </div>
            <button class="button button-ghost button-icon delete-icon-btn" title="删除 Demo" data-action="delete-demo" data-demo-id="${escapeAttr(demo.id)}">${renderIcon("trash")}</button>
          </div>
          <p class="demo-description">${escapeHtml(demo.description || "暂无补充说明。")}</p>
        </div>

        <div class="card-foot">
          <span class="card-meta">最近更新：${formatRelative(demo.updatedAt)}</span>
          <div class="card-actions">
            <button
              class="button button-outline button-with-badge"
              data-action="open-feedback"
              data-demo-id="${escapeAttr(demo.id)}"
            >
              查看详情
              ${unreadCount ? `<span class="count-badge">${unreadCount}</span>` : ""}
            </button>
            <button class="button button-primary" data-action="copy-share" data-demo-id="${escapeAttr(demo.id)}">
              分享链接
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderCreatePage() {
  const hasImages = ui.draft.images.length > 0;

  return `
    <main class="${pageClass("stack-24")}">
      <div class="topbar">
        <button class="button button-outline" data-action="go-home">${renderIcon("arrow-left")}返回首页</button>
      </div>

      <div class="page-head">
        <h1 class="page-title">新建 Demo</h1>
      </div>

      <section class="create-layout">
        <div class="create-panel stack-24">
          <div>
            <h2 class="panel-title">Demo 信息</h2>
            ${
              hasImages
                ? `<p class="panel-desc">已补充的说明会随页面素材一起用于串联演示与反馈。</p>`
                : ""
            }
          </div>

          <form id="create-form" class="field-group">
            <div class="field">
              <label for="demo-title">Demo 名称（必填）</label>
              <input class="input" id="demo-title" name="title" placeholder="例如：支付页转化优化" value="${escapeAttr(ui.draft.title)}" />
            </div>
            <div class="field">
              <label for="demo-module">关联模块</label>
              <input class="input" id="demo-module" name="module" placeholder="例如：首页 / 结账 / 搜索" value="${escapeAttr(ui.draft.module)}" />
            </div>
            <div class="field">
              <label for="demo-description">${hasImages ? "补充说明" : "输入测试说明"}</label>
              <textarea class="textarea" id="demo-description" name="description" placeholder="记录你希望这个 Demo 说明的问题、用户场景与预期输出。">${escapeHtml(ui.draft.description)}</textarea>
            </div>
          </form>
        </div>

        <aside class="upload-panel">
          ${
            hasImages
              ? `
                <div>
                  <h2 class="panel-title">上传页面</h2>
                  <p class="panel-desc">已上传 ${ui.draft.images.length} 张页面图</p>
                </div>
                <div class="upload-filled ${ui.uploadDragover ? "is-dragover" : ""}" data-dropzone="upload">
                  <div class="thumb-grid-wrap">
                    <div class="thumb-grid">
                      ${ui.draft.images.map(renderDraftImage).join("")}
                    </div>
                  </div>
                  <label class="button button-outline button-large upload-bottom-button" for="file-input">选择文件</label>
                </div>
              `
              : `
                <div class="upload-empty ${ui.uploadDragover ? "is-dragover" : ""}" data-dropzone="upload">
                  <div>
                    <div class="upload-icon">${renderIcon("upload-board")}</div>
                    <div class="panel-title">上传Demo图片</div>
                    <label class="button button-outline button-large" for="file-input" style="margin-top: 12px;">选择文件</label>
                  </div>
                </div>
              `
          }
          <input class="sr-only" id="file-input" type="file" accept="image/*" multiple />
        </aside>
      </section>

      <div class="form-actions">
        <div class="card-actions">
          <button class="button button-outline" data-action="reset-draft">${hasImages ? "重置" : "取消"}</button>
          <button class="button button-primary" data-action="create-demo" ${ui.loading ? "disabled" : ""}>
            ${ui.loading ? `<span class="button-spinner"></span>创建中` : "完成创建"}
          </button>
        </div>
      </div>
    </main>
  `;
}

function renderDraftImage(image, index) {
  return `
    <div class="thumb-card" draggable="true" data-index="${index}">
      <button class="thumb-preview-btn" data-action="open-image" data-src="${escapeAttr(image)}" data-alt="上传图片 ${index + 1}">
        <img src="${escapeAttr(image)}" alt="上传图片 ${index + 1}" />
      </button>
      <div class="thumb-toolbar">
        <button class="thumb-delete" data-action="remove-image" data-index="${index}" title="删除图片">${renderIcon("close")}</button>
      </div>
    </div>
  `;
}

function renderSharePage(demoId) {
  const demo = getDemo(demoId);
  if (!demo) {
    return renderMissing("这个 Demo 不存在，可能已经被删除。");
  }
  const feedbackDraft = getFeedbackDraft(demo.id);
  const canSubmitFeedback = feedbackDraft.mis.trim() && feedbackDraft.text.trim();

  const gallery = demo.images.length ? demo.images : [makeSampleImage("00", "#efefef", "#dfdfdf")];
  const progressWidth = `${((ui.galleryIndex + 1) / gallery.length) * 100}%`;

  return `
    <main class="${pageClass("stack-28 share-page")}">
      <div class="share-topbar">
        ${renderBrand()}
      </div>

      <section class="share-hero">
        <h1 class="share-title">Demo 版本：${escapeHtml(demo.title)}</h1>
        <div class="hero-note">${escapeHtml(demo.focusPrompt || demo.description || "请重点关注关键链路是否容易理解。")}</div>
      </section>

      <section class="share-gallery-card">
        <div class="gallery-scroll" data-gallery-scroll>
          ${gallery
            .map((image, index) => {
              const serial = String(index + 1).padStart(2, "0");
              return `
                <article class="gallery-card ${index === ui.galleryIndex ? "is-active" : ""}">
                  <button data-action="open-image" data-src="${escapeAttr(image)}" data-alt="${escapeAttr(demo.title)} 第 ${index + 1} 张图">
                    <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 第 ${index + 1} 张图" />
                    <span class="gallery-seq-badge">${serial}</span>
                  </button>
                </article>
              `;
            })
            .join("")}
        </div>
        <div class="gallery-progress" data-gallery-progress><span style="width: ${progressWidth};"></span></div>
      </section>

      <section class="mobile-scheme-stage">
        <div class="mobile-scheme-scroll" data-mobile-scheme-scroll>
        ${gallery
          .map((image, index) => {
            const serial = String(index + 1).padStart(2, "0");
            return `
              <article class="mobile-scheme-frame">
                <button class="mobile-scheme-btn" data-action="open-image" data-src="${escapeAttr(image)}" data-alt="${escapeAttr(demo.title)} 第 ${index + 1} 张图">
                  <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 第 ${index + 1} 张图" />
                  <span class="gallery-seq-badge">${serial}</span>
                </button>
              </article>
            `;
          })
          .join("")}
        </div>
        <div class="mobile-scheme-indicator">方案${ui.galleryIndex + 1}/${gallery.length}</div>
      </section>

      <form class="feedback-form share-feedback-form" id="feedback-form" data-demo-id="${escapeAttr(demo.id)}">
        <h2 class="panel-title">请提交你的建议：</h2>
        <div class="field">
          <label for="mis-input">MIS号</label>
          <input class="input" id="mis-input" name="mis" placeholder="请输入你的昵称" value="${escapeAttr(feedbackDraft.mis)}" />
        </div>
        <div class="field">
          <label for="feedback-text">反馈内容</label>
          <textarea class="textarea" id="feedback-text" name="text" placeholder="请写下你的建议、疑问或感受">${escapeHtml(feedbackDraft.text)}</textarea>
        </div>
        <div class="form-actions">
          <div class="helper-text">建议会立即回收到设计师后台，不会出现在公开页上。</div>
          <button class="button button-primary" type="submit" ${canSubmitFeedback ? "" : "disabled"}>提交反馈</button>
        </div>
      </form>

      <button class="mobile-feedback-fab" data-action="toggle-mobile-feedback" aria-label="打开反馈面板">
        ${renderIcon("feedback-fab")}
      </button>

      <div class="mobile-feedback-backdrop ${ui.mobileFeedbackOpen ? "is-open" : ""}" data-action="close-mobile-feedback">
        <div class="mobile-feedback-sheet ${ui.mobileFeedbackOpen ? "is-open" : ""}">
          <form class="feedback-form mobile-feedback-form" id="mobile-feedback-form" data-demo-id="${escapeAttr(demo.id)}">
            <button class="mobile-sheet-close" type="button" data-action="close-mobile-feedback" aria-label="关闭反馈面板">${renderIcon("close")}</button>
            <h2 class="panel-title">请提交你的建议：</h2>
            <div class="field">
              <label for="mobile-mis-input">MIS号</label>
              <input class="input" id="mobile-mis-input" name="mis" placeholder="请输入你的昵称" value="${escapeAttr(feedbackDraft.mis)}" />
            </div>
            <div class="field">
              <label for="mobile-feedback-text">反馈内容</label>
              <textarea class="textarea" id="mobile-feedback-text" name="text" placeholder="请写下你的建议、疑问或感受">${escapeHtml(feedbackDraft.text)}</textarea>
            </div>
            <div class="form-actions">
              <button class="button button-primary" type="submit" ${canSubmitFeedback ? "" : "disabled"}>提交反馈</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  `;
}

function renderFeedbackPage(demoId) {
  const demo = getDemo(demoId);
  if (!demo) {
    return renderMissing("这个 Demo 不存在，可能已经被删除。");
  }

  const feedback = getFeedbackForDemo(demo.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return `
    <main class="${pageClass("stack-24")}">
      <div class="share-topbar">
        <button class="button button-outline" data-action="go-home">${renderIcon("arrow-left")}返回首页</button>
        <button class="button button-primary" data-action="copy-share" data-demo-id="${escapeAttr(demo.id)}">复制分享</button>
      </div>

      <div class="page-head">
        <h1 class="page-title">${escapeHtml(demo.title)} · V2</h1>
      </div>

      <div class="thumb-strip">
        ${demo.images
          .slice(0, 6)
          .map(
            (image, index) => `
              <div class="thumb-card">
                <button class="thumb-preview-btn" data-action="open-image" data-src="${escapeAttr(image)}" data-alt="${escapeAttr(demo.title)} 缩略图 ${index + 1}">
                  <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 缩略图 ${index + 1}" />
                </button>
              </div>
            `
          )
          .join("")}
      </div>

      <section class="feedback-list-card">
        <div class="section-head feedback-head">
          <div class="feedback-head-title">
            <h2 class="section-title">这条 Demo 收到的全部建议</h2>
          </div>
          <div class="feedback-summary-grid">
            <div class="feedback-summary-item">
              <span class="feedback-summary-label">反馈总数</span>
              <strong class="feedback-summary-value">${feedback.length} 条</strong>
            </div>
            <div class="feedback-summary-item">
              <span class="feedback-summary-label">创建时间</span>
              <strong class="feedback-summary-value">${formatDate(demo.createdAt)}</strong>
            </div>
            <div class="feedback-summary-item">
              <span class="feedback-summary-label">最近分享</span>
              <strong class="feedback-summary-value">${formatDate(demo.updatedAt)}</strong>
            </div>
          </div>
        </div>

        ${
          feedback.length
            ? feedback.map(renderFeedbackItem).join("")
            : `<div class="feedback-empty">还没有收到反馈。把分享链接发出去后，大家提交的建议会出现在这里。</div>`
        }
      </section>
    </main>
  `;
}

function renderFeedbackItem(item) {
  return `
    <article class="feedback-item">
      <div class="feedback-row">
        <h3 class="feedback-name">${escapeHtml(item.mis)}${item.role ? ` · ${escapeHtml(item.role)}` : ""}</h3>
        ${item.isNew ? `<span class="feedback-badge">NEW</span>` : ""}
      </div>
      <p class="feedback-item-body">${escapeHtml(item.text)}</p>
      <span class="feedback-time">${escapeHtml(item.device)} · ${formatDateTime(item.createdAt)}</span>
    </article>
  `;
}

function renderMissing(message) {
  return `
    <main class="${pageClass()}">
      <div class="empty-state">${escapeHtml(message)}</div>
    </main>
  `;
}

function renderBrand() {
  return `
    <div class="brand">
      <div class="logo-mark"></div>
      <div class="brand-text">Demo Feedback</div>
    </div>
  `;
}

function renderModal() {
  if (!ui.modal) {
    return "";
  }

  if (ui.modal.type === "created") {
    const demo = getDemo(ui.modal.demoId);
    if (!demo) {
      return "";
    }
    const link = getShareLink(demo.id);
    return `
      <div class="overlay" data-action="close-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="created-title">
          <h2 id="created-title" class="modal-title">链接已生成</h2>
          <p class="panel-desc">把下面这个链接复制到 IM 工具里，别人就可以在手机和 PC 上查看这条 Demo 并提交反馈。</p>
          <div class="link-box">${escapeHtml(link)}</div>
          <div class="card-actions" style="justify-content: flex-end;">
            <button class="button button-outline" data-action="modal-continue">继续创建</button>
            <button class="button button-outline" data-action="modal-open-feedback" data-demo-id="${escapeAttr(demo.id)}">查看反馈</button>
            <button class="button button-primary" data-action="modal-copy-home" data-demo-id="${escapeAttr(demo.id)}">分享链接</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function renderLightbox() {
  if (!ui.lightbox) {
    return "";
  }
  return `
    <div class="overlay image-overlay" data-action="close-lightbox">
      <div class="image-lightbox">
        <img src="${escapeAttr(ui.lightbox.src)}" alt="${escapeAttr(ui.lightbox.alt || "预览大图")}" />
      </div>
    </div>
  `;
}

function renderDemoPreview(demo) {
  const images = demo.images || [];
  if (!images.length) {
    return `<div class="preview-shell"><div class="preview-placeholder"><span></span><span></span><span></span><span></span><span></span></div></div>`;
  }
  if (images.length === 1) {
    return `
      <div class="preview-shell">
        <img src="${escapeAttr(images[0])}" alt="${escapeAttr(demo.title)} 预览" />
        <span class="preview-index-badge">01</span>
      </div>
    `;
  }
  const stack = images.slice(0, 3);
  return `
    <div class="preview-stack" aria-label="${escapeAttr(demo.title)} 预览叠层">
      ${stack
        .map(
          (image, index) => `
            <div class="preview-stack-layer layer-${index + 1}">
              <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 预览 ${index + 1}" />
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderToast() {
  if (!ui.toast) {
    return "";
  }
  return `<div class="toast">${escapeHtml(ui.toast)}</div>`;
}

async function handleClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger && event.target.closest(".modal")) {
    return;
  }
  if (!trigger) {
    return;
  }

  const action = trigger.dataset.action;

  if (action === "go-home") {
    navigate("/");
    return;
  }
  if (action === "go-new") {
    navigate("/new");
    return;
  }
  if (action === "create-demo") {
    await createDemo();
    return;
  }
  if (action === "reset-draft") {
    ui.draft = createEmptyDraft();
    ui.uploadDragover = false;
    render();
    return;
  }
  if (action === "remove-image") {
    const index = Number(trigger.dataset.index);
    ui.draft.images.splice(index, 1);
    render();
    return;
  }
  if (action === "delete-demo") {
    await deleteDemo(trigger.dataset.demoId);
    return;
  }
  if (action === "copy-share") {
    await copyShareLink(trigger.dataset.demoId);
    return;
  }
  if (action === "open-image") {
    ui.lightbox = {
      src: trigger.dataset.src,
      alt: trigger.dataset.alt || "",
    };
    render();
    return;
  }
  if (action === "open-feedback") {
    await markFeedbackRead(trigger.dataset.demoId);
    ui.modal = null;
    navigate(`/feedback/${encodeURIComponent(trigger.dataset.demoId)}`);
    return;
  }
  if (action === "select-gallery") {
    ui.galleryIndex = Number(trigger.dataset.index) || 0;
    const card = trigger.closest(".gallery-card");
    const scroller = document.querySelector("[data-gallery-scroll]");
    if (card && scroller) {
      ui.galleryScrollLeft = Math.max(0, card.offsetLeft - 4);
    }
    render();
    return;
  }
  if (action === "close-modal") {
    ui.modal = null;
    render();
    return;
  }
  if (action === "modal-continue") {
    ui.modal = null;
    ui.draft = createEmptyDraft();
    ui.uploadDragover = false;
    if (location.pathname === "/new") {
      render();
      return;
    }
    navigate("/new");
    return;
  }
  if (action === "modal-copy-home") {
    await copyShareLink(trigger.dataset.demoId);
    ui.modal = null;
    navigate("/");
    return;
  }
  if (action === "modal-open-feedback") {
    await markFeedbackRead(trigger.dataset.demoId);
    ui.modal = null;
    navigate(`/feedback/${encodeURIComponent(trigger.dataset.demoId)}`);
    return;
  }
  if (action === "close-lightbox") {
    ui.lightbox = null;
    render();
    return;
  }
  if (action === "toggle-mobile-feedback") {
    ui.mobileFeedbackOpen = !ui.mobileFeedbackOpen;
    render();
    return;
  }
  if (action === "close-mobile-feedback") {
    if (event.target.closest(".mobile-feedback-sheet") && !trigger.classList.contains("mobile-sheet-close")) {
      return;
    }
    ui.mobileFeedbackOpen = false;
    render();
  }
}

async function handleSubmit(event) {
  if (event.target.id === "feedback-form" || event.target.id === "mobile-feedback-form") {
    event.preventDefault();
    const source = event.target.id === "mobile-feedback-form" ? "mobile" : "desktop";
    const submitted = await submitFeedback(new FormData(event.target), event.target.dataset.demoId, source);
    if (submitted && source === "mobile") {
      ui.mobileFeedbackOpen = false;
      render();
    }
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (["title", "module", "description"].includes(target.name)) {
    ui.draft[target.name] = target.value;
    return;
  }
  if (["mis", "text"].includes(target.name)) {
    const form = target.closest("form[data-demo-id]");
    if (!form) {
      return;
    }
    const demoId = form.dataset.demoId;
    const draft = getFeedbackDraft(demoId);
    draft[target.name] = target.value;
  }
}

async function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.id !== "file-input") {
    return;
  }
  const files = [...(target.files || [])];
  if (!files.length) {
    return;
  }
  await appendImages(files);
  target.value = "";
}

function handleDragStart(event) {
  const card = event.target.closest(".thumb-card");
  if (!card) {
    return;
  }
  ui.dragIndex = Number(card.dataset.index);
}

function handleDragOver(event) {
  const uploadZone = event.target.closest("[data-dropzone='upload']");
  const card = event.target.closest(".thumb-card");
  if (uploadZone || card) {
    event.preventDefault();
  }
}

function handleDragEnter(event) {
  if (event.target.closest("[data-dropzone='upload']")) {
    ui.uploadDragover = true;
    render();
  }
}

function handleDragLeave(event) {
  if (event.target.closest("[data-dropzone='upload']")) {
    ui.uploadDragover = false;
    render();
  }
}

function handleScroll(event) {
  const scroller = event.target.closest?.("[data-gallery-scroll]");
  if (scroller) {
    ui.galleryScrollLeft = scroller.scrollLeft;
    syncGalleryProgress();
    return;
  }
  const mobileScroller = event.target.closest?.("[data-mobile-scheme-scroll]");
  if (!mobileScroller) {
    return;
  }
  ui.mobileSchemeScrollLeft = mobileScroller.scrollLeft;
  const pageWidth = mobileScroller.clientWidth || 1;
  ui.galleryIndex = clamp(
    Math.round(mobileScroller.scrollLeft / pageWidth),
    0,
    Math.max(mobileScroller.children.length - 1, 0)
  );
  const indicator = document.querySelector(".mobile-scheme-indicator");
  if (indicator) {
    indicator.textContent = `方案${ui.galleryIndex + 1}/${mobileScroller.children.length}`;
  }
}

async function handleDrop(event) {
  const uploadZone = event.target.closest("[data-dropzone='upload']");
  const card = event.target.closest(".thumb-card");

  if (card && Number.isInteger(ui.dragIndex)) {
    event.preventDefault();
    const targetIndex = Number(card.dataset.index);
    reorderDraftImages(ui.dragIndex, targetIndex);
    ui.dragIndex = null;
    return;
  }

  if (!uploadZone) {
    return;
  }

  event.preventDefault();
  ui.uploadDragover = false;
  const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/"));
  if (files.length) {
    await appendImages(files);
  } else {
    render();
  }
}

function reorderDraftImages(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    render();
    return;
  }
  const [moved] = ui.draft.images.splice(fromIndex, 1);
  ui.draft.images.splice(toIndex, 0, moved);
  render();
}

async function appendImages(files) {
  try {
    ui.loading = true;
    render();
    const images = await Promise.all(files.map((file) => compressImage(file)));
    ui.draft.images.push(...images);
  } catch {
    showToast("图片处理失败，请换一张再试。");
  } finally {
    ui.loading = false;
    render();
  }
}

async function createDemo() {
  if (ui.loading) {
    return;
  }
  if (!ui.draft.title.trim()) {
    showToast("先填 Demo 名称。");
    return;
  }
  if (!ui.draft.images.length) {
    showToast("先上传至少一张图片。");
    return;
  }

  ui.loading = true;
  render();

  try {
    const payload = {
      title: ui.draft.title.trim(),
      module: ui.draft.module.trim(),
      description: ui.draft.description.trim(),
      focusPrompt: ui.draft.description.trim() || "请重点关注信息层级、主要操作入口和确认动作是否明确。",
      images: [...ui.draft.images],
    };
    const result = await apiRequest("/api/demos", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (result?.demo) {
      state.demos.unshift(result.demo);
      ui.modal = { type: "created", demoId: result.demo.id };
      ui.draft = createEmptyDraft();
      showDelightToast("created");
    }
  } catch (error) {
    showToast(error.message || "创建失败，请稍后再试。");
  } finally {
    ui.loading = false;
    render();
  }
}

async function submitFeedback(formData, demoId, source = "desktop") {
  const mis = String(formData.get("mis") || "").trim();
  const text = String(formData.get("text") || "").trim();
  if (!mis || !text) {
    showToast("MIS号和反馈内容都要填写。");
    return false;
  }

  try {
    const result = await apiRequest(`/api/demos/${encodeURIComponent(demoId)}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        mis,
        text,
        device: detectDeviceName(),
      }),
    });

    if (result?.feedback) {
      state.feedback.unshift(result.feedback);
      const demo = state.demos.find((item) => item.id === demoId);
      if (demo && result.demo?.updatedAt) {
        demo.updatedAt = result.demo.updatedAt;
      }
      ui.feedbackDrafts[demoId] = createEmptyFeedbackDraft();
      ui.mobileFeedbackOpen = false;
      render();
      showToast(source === "mobile" ? "提交成功" : "反馈已提交");
      return true;
    }
  } catch (error) {
    showToast(error.message || "提交失败，请稍后再试。");
  }
  return false;
}

async function deleteDemo(demoId) {
  const demo = getDemo(demoId);
  if (!demo) {
    return false;
  }
  const confirmed = window.confirm(`确认删除「${demo.title}」吗？该 Demo 和全部反馈都会一起删除。`);
  if (!confirmed) {
    return false;
  }
  try {
    await apiRequest(`/api/demos/${encodeURIComponent(demoId)}`, {
      method: "DELETE",
    });
    state.demos = state.demos.filter((item) => item.id !== demoId);
    state.feedback = state.feedback.filter((item) => item.demoId !== demoId);
    showToast("Demo 已删除。");
    render();
    return true;
  } catch (error) {
    showToast(error.message || "删除失败，请稍后再试。");
    return false;
  }
}

async function copyShareLink(demoId) {
  const link = getShareLink(demoId);
  try {
    await navigator.clipboard.writeText(link);
    showDelightToast("copied");
  } catch {
    window.prompt("复制下面这个链接", link);
  }
}

function getShareLink(demoId) {
  return `${location.origin}/share/${encodeURIComponent(demoId)}`;
}

function getDemo(demoId) {
  return state.demos.find((item) => item.id === demoId);
}

function getFeedbackForDemo(demoId) {
  return state.feedback.filter((item) => item.demoId === demoId);
}

function getFeedbackDraft(demoId) {
  if (!ui.feedbackDrafts[demoId]) {
    ui.feedbackDrafts[demoId] = createEmptyFeedbackDraft();
  }
  return ui.feedbackDrafts[demoId];
}

async function markFeedbackRead(demoId) {
  const changedItems = state.feedback.filter((item) => item.demoId === demoId && item.isNew);
  if (!changedItems.length) {
    return;
  }
  changedItems.forEach((item) => {
    item.isNew = false;
  });
  try {
    await apiRequest(`/api/demos/${encodeURIComponent(demoId)}/feedback/mark-read`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // Local state already updated so the UI remains responsive.
  }
  render();
}

function ensureUniqueDemoId(baseId) {
  return baseId;
}

function showToast(message) {
  ui.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, TOAST_MS);
}

function showDelightToast(kind) {
  const messages = {
    created: ["链接已生成，可直接分享", "发布成功，已生成分享地址", "新 Demo 已就绪"],
    copied: ["分享链接已复制", "链接复制完成", "已复制，可直接发送"],
    feedback: ["反馈已提交", "收到你的建议", "建议已同步到后台"],
  };
  const list = messages[kind] || [kind];
  showToast(list[Math.floor(Math.random() * list.length)]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatRelative(value) {
  const diff = Date.now() - Date.parse(value);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    return "刚刚";
  }
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function formatDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function detectDeviceName() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone/.test(ua)) {
    return "iPhone";
  }
  if (/android/.test(ua)) {
    return "Android";
  }
  if (/mac os/.test(ua)) {
    return "MacBook";
  }
  if (/windows/.test(ua)) {
    return "Windows";
  }
  return "Web";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function handlePointerDown(event) {
  const button = event.target.closest(".button");
  if (!button || button.disabled) {
    return;
  }
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  button.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 700);
}

function syncGalleryProgress() {
  const scroller = document.querySelector("[data-gallery-scroll]");
  const progress = document.querySelector("[data-gallery-progress]");
  if (!scroller || !progress) {
    return;
  }
  if (ui.galleryScrollLeft > 0) {
    scroller.scrollLeft = ui.galleryScrollLeft;
  }
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  progress.style.display = max > 0 ? "block" : "none";
  const thumb = progress.querySelector("span");
  const railWidth = progress.clientWidth || 360;
  const thumbWidth = Math.max(88, Math.min(220, railWidth * (scroller.clientWidth / Math.max(scroller.scrollWidth, 1))));
  const x = max > 0 ? (scroller.scrollLeft / max) * (railWidth - thumbWidth) : 0;
  ui.galleryScrollLeft = scroller.scrollLeft;
  thumb.style.width = `${thumbWidth}px`;
  thumb.style.transform = `translateX(${x}px)`;
}

function syncMobileSchemeScroll() {
  const scroller = document.querySelector("[data-mobile-scheme-scroll]");
  if (!scroller) {
    return;
  }
  const pageWidth = scroller.clientWidth || 1;
  const targetLeft = ui.galleryIndex * pageWidth;
  if (Math.abs(scroller.scrollLeft - targetLeft) > 2) {
    scroller.scrollLeft = ui.mobileSchemeScrollLeft > 0 ? ui.mobileSchemeScrollLeft : targetLeft;
  }
  const total = scroller.children.length || 1;
  const indicator = document.querySelector(".mobile-scheme-indicator");
  if (indicator) {
    indicator.textContent = `方案${clamp(ui.galleryIndex + 1, 1, total)}/${total}`;
  }
}

function renderIcon(name) {
  const icons = {
    plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.25v9.5M3.25 8h9.5" /></svg>',
    upload: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11V3.75M5.25 6.5 8 3.75l2.75 2.75M3.5 12.5h9" /></svg>',
    "upload-board":
      '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M962.5 773.125l-119.375 0 0-119.375c0-16.25-13.125-29.375-29.375-29.375-16.25 0-29.375 13.125-29.375 29.375l0 119.375-119.375 0c-16.25 0-29.375 13.125-29.375 29.375 0 16.25 13.125 29.375 29.375 29.375l119.375 0 0 119.375c0 16.25 13.125 29.375 29.375 29.375 16.25 0 29.375-13.125 29.375-29.375l0-119.375L962.5 831.875c16.25 0 29.375-13.125 29.375-29.375C991.875 786.25 978.75 773.125 962.5 773.125zM699.375 288.125c0-67.5-55-122.5-122.5-122.5-67.5 0-122.5 55-122.5 122.5s55 122.5 122.5 122.5C644.375 410.625 699.375 355.625 699.375 288.125zM508.75 288.125c0-37.5 30.625-68.125 68.125-68.125 37.5 0 68.125 30.625 68.125 68.125 0 37.5-30.625 68.125-68.125 68.125C539.375 356.25 508.75 325.625 508.75 288.125zM743.125 873.125 182.5 873.125c-30 0-54.375-24.375-54.375-54.375L128.125 166.25c0-30 24.375-54.375 54.375-54.375l653.125 0c30 0 54.375 24.375 54.375 54.375l0 566.875 54.375 0 0-566.875c0-60-48.75-108.75-108.75-108.75L182.5 57.5c-60 0-108.75 48.75-108.75 108.75L73.75 818.75c0 60 48.75 108.75 108.75 108.75l560.625 0L743.125 873.125 743.125 873.125zM793.125 569.375c5 3.125 10 4.375 15 4.375 8.75 0 17.5-4.375 22.5-11.875 8.125-12.5 5-29.375-7.5-37.5l-81.875-54.375c-10-6.875-23.125-5.625-31.875 1.875l0-0.625L580 575 388.125 442.5c0 0 0 0 0 0-2.5-1.25-5-2.5-7.5-3.125-0.625 0-1.875-0.625-2.5-1.25-2.5-0.625-5 0-6.875 0-1.25 0-2.5 0-3.125 0-1.25 0-2.5 1.25-3.125 1.25-2.5 0.625-4.375 1.25-6.25 2.5 0 0 0 0 0 0L194.375 551.25c-12.5 8.125-15.625 25-7.5 37.5 5 8.125 13.75 11.875 22.5 11.875 5 0 10.625-1.25 15-4.375l148.125-98.75 287.5 196.25c5 3.125 10 5 15.625 5 8.75 0 16.875-4.375 22.5-11.875 8.75-12.5 5.625-29.375-6.875-38.125l-63.75-43.125 101.25-80.625L793.125 569.375z" /></svg>',
    "feedback-fab":
      '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M579.887407 446.994963a32.274963 32.274963 0 0 1 0-45.511111l268.894815-268.894815c12.515556-12.515556 32.995556-12.515556 45.511111 0 12.515556 12.515556 12.515556 32.616296 0 45.131852l-268.894814 269.274074c-12.515556 12.515556-32.995556 12.515556-45.511112 0zM307.579259 319.981037a32.237037 32.237037 0 0 0-32.237037 32.237037c0 17.445926 14.411852 31.857778 32.237037 31.857778h191.146667a32.047407 32.047407 0 0 0 0-64.094815h-191.146667z m0 320.208593h409.220741a32.047407 32.047407 0 0 0 0-64.094815H307.541333a32.237037 32.237037 0 0 0-32.237037 32.237037c0 17.445926 14.411852 31.857778 32.237037 31.857778zM947.730963 90.642963c10.24 5.688889 22.376296 5.688889 32.237037 0 10.24-5.688889 16.308148-16.308148 16.308148-27.685926 0-11.757037-6.068148-22.376296-16.308148-28.065185a32.57837 32.57837 0 0 0-32.237037 0c-9.860741 5.688889-15.928889 16.308148-15.928889 28.065185 0 11.377778 6.068148 21.997037 15.928889 27.685926z" /><path d="M222.01837 894.748444c-34.891852 0-63.715556-28.823704-63.715555-64.094814V191.981037c0-35.271111 28.823704-64.094815 63.715555-64.094815h482.417778a32.047407 32.047407 0 0 0-0.379259-64.094815h-477.866667c-70.542222 0-128.18963 57.647407-128.189629 128.18963v639.431111c0 70.542222 57.647407 128.18963 128.189629 128.18963h573.819259c70.542222 0 97.848889-57.647407 97.848889-128.18963v-444.871111c0.379259-0.758519 0.379259-1.517037 0.37926-2.275556a32.237037 32.237037 0 1 0-64.474074 0h-0.37926v446.388149c0 35.271111-28.823704 64.094815-64.094815 64.094814H222.01837z" /></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>',
    trash:
      '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M800 384C782.08 384 768 398.08 768 416L768 832c0 35.2-28.8 64-64 64l-64 0L640 416C640 398.08 625.92 384 608 384 590.08 384 576 398.08 576 416L576 896 448 896 448 416C448 398.08 433.92 384 416 384 398.08 384 384 398.08 384 416L384 896 320 896c-35.2 0-64-28.8-64-64L256 416C256 398.08 241.92 384 224 384 206.08 384 192 398.08 192 416L192 832c0 70.4 57.6 128 128 128l384 0c70.4 0 128-57.6 128-128L832 416C832 398.08 817.92 384 800 384zM864 256l-704 0C142.08 256 128 270.08 128 288 128 305.92 142.08 320 160 320l704 0C881.92 320 896 305.92 896 288 896 270.08 881.92 256 864 256zM352 192l320 0C689.92 192 704 177.92 704 160 704 142.08 689.92 128 672 128l-320 0C334.08 128 320 142.08 320 160 320 177.92 334.08 192 352 192z" /></svg>',
    "arrow-left": '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 8h-9M6.5 4 3 8l3.5 4" /></svg>',
  };
  return `<span class="icon icon-${name}">${icons[name] || ""}</span>`;
}

async function compressImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
