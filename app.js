const STORAGE_KEY = "demo-feedback-store-v1";
const TOAST_MS = 2400;

const app = document.querySelector("#app");

const ui = {
  draft: createEmptyDraft(),
  feedbackDrafts: {},
  modal: null,
  toast: null,
  loading: false,
  dragIndex: null,
  galleryIndex: 0,
  galleryScrollLeft: 0,
  uploadDragover: false,
};

const state = loadState();
seedIfNeeded(state);
saveState();

window.addEventListener("hashchange", render);
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

render();

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { demos: [], feedback: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      demos: Array.isArray(parsed.demos) ? parsed.demos : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch {
    return { demos: [], feedback: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedIfNeeded(current) {
  if (current.demos.length > 0) {
    return;
  }

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

  current.demos.push(demoA, demoB);
  current.feedback.push(
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
    }
  );
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
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path] = raw.split("?");
  const parts = path.split("/").filter(Boolean);

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

function render() {
  const route = getRoute();
  if (route.name === "share") {
    ui.galleryIndex = clamp(ui.galleryIndex, 0, Math.max(getDemo(route.id)?.images.length - 1 || 0, 0));
  } else {
    ui.galleryIndex = 0;
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderPage(route)}
    </div>
    ${renderModal()}
    ${renderToast()}
  `;
  syncGalleryProgress();
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
    <main class="page stack-24">
      <div class="topbar">
        ${renderBrand()}
        <button class="button button-primary button-large" data-action="go-new">${renderIcon("plus")}创建Demo</button>
      </div>

      <section class="hero-card">
        <div class="section-head">
          <div>
            <h1 class="hero-headline">反馈管理</h1>
            <p class="hero-subtitle">其中包含设计师 Demo 的状态总览、图片管理与分享反馈流。</p>
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
            <p class="section-desc">按反馈处理阶段聚合，优先关注待补素材与待确认的页面。</p>
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
  const preview = demo.images[0];

  return `
    <article class="demo-card">
      <div class="preview-shell">
        ${
          preview
            ? `<img src="${escapeAttr(preview)}" alt="${escapeAttr(demo.title)} 预览" />`
            : `<div class="preview-placeholder"><span></span><span></span><span></span><span></span><span></span></div>`
        }
      </div>

      <div class="demo-info">
        <div class="stack-24" style="gap: 12px;">
          <div class="card-top">
            <div>
              <h3 class="demo-title">${escapeHtml(demo.title)}</h3>
              <p class="card-meta">关联模块：${escapeHtml(demo.module || "未填写")}</p>
            </div>
            <button class="button button-ghost button-icon" title="删除 Demo" data-action="delete-demo" data-demo-id="${escapeAttr(demo.id)}">${renderIcon("trash")}</button>
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
    <main class="page stack-24">
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
                  <label class="button button-outline button-large upload-bottom-button" for="file-input">${renderIcon("upload")}选择文件</label>
                </div>
              `
              : `
                <div class="upload-empty ${ui.uploadDragover ? "is-dragover" : ""}" data-dropzone="upload">
                  <div>
                    <div class="upload-icon">${renderIcon("upload")}</div>
                    <div class="panel-title">上传Demo图片</div>
                    <label class="button button-outline button-large" for="file-input" style="margin-top: 12px;">${renderIcon("upload")}选择文件</label>
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
      <img src="${escapeAttr(image)}" alt="上传图片 ${index + 1}" />
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

  const gallery = demo.images.length ? demo.images : [makeSampleImage("00", "#efefef", "#dfdfdf")];
  const progressWidth = `${((ui.galleryIndex + 1) / gallery.length) * 100}%`;

  return `
    <main class="page stack-28">
      <div class="share-topbar">
        ${renderBrand()}
      </div>

      <section class="share-hero">
        <h1 class="share-title">Demo 版本：${escapeHtml(demo.title)}</h1>
        <div class="hero-note">${escapeHtml(demo.focusPrompt || demo.description || "请重点关注关键链路是否容易理解。")}</div>
      </section>

      <section class="stack-24">
        <div class="gallery-scroll" data-gallery-scroll>
          ${gallery
            .map((image, index) => {
              return `
                <article class="gallery-card ${index === ui.galleryIndex ? "is-active" : ""}">
                  <button data-action="select-gallery" data-index="${index}">
                    <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 第 ${index + 1} 张图" />
                  </button>
                </article>
              `;
            })
            .join("")}
        </div>
        <div class="gallery-progress" data-gallery-progress><span style="width: ${progressWidth};"></span></div>
      </section>

      <form class="feedback-form" id="feedback-form" data-demo-id="${escapeAttr(demo.id)}">
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
          <button class="button button-primary" type="submit">提交反馈</button>
        </div>
      </form>
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
    <main class="page stack-24">
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
                <img src="${escapeAttr(image)}" alt="${escapeAttr(demo.title)} 缩略图 ${index + 1}" />
              </div>
            `
          )
          .join("")}
      </div>

      <section class="feedback-list-card">
        <div class="section-head">
          <div>
            <span class="feedback-badge">反馈列表</span>
            <h2 class="section-title" style="margin-top: 8px;">这条 Demo 收到的全部建议</h2>
            <div class="feedback-meta">
              <span class="feedback-caption">${feedback.length} 条</span>
              <span class="feedback-caption">创建于 ${formatDate(demo.createdAt)}</span>
              <span class="feedback-caption">分享于 ${formatDate(demo.updatedAt)}</span>
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
    <main class="page">
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
            <button class="button button-outline" data-action="close-modal">继续创建</button>
            <button class="button button-outline" data-action="open-feedback" data-demo-id="${escapeAttr(demo.id)}">查看反馈</button>
            <button class="button button-primary" data-action="copy-share" data-demo-id="${escapeAttr(demo.id)}">复制链接</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function renderToast() {
  if (!ui.toast) {
    return "";
  }
  return `<div class="toast">${escapeHtml(ui.toast)}</div>`;
}

function handleClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger && event.target.closest(".modal")) {
    return;
  }
  if (!trigger) {
    return;
  }

  const action = trigger.dataset.action;

  if (action === "go-home") {
    location.hash = "/";
    return;
  }
  if (action === "go-new") {
    location.hash = "/new";
    return;
  }
  if (action === "create-demo") {
    createDemo();
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
    deleteDemo(trigger.dataset.demoId);
    return;
  }
  if (action === "copy-share") {
    copyShareLink(trigger.dataset.demoId);
    return;
  }
  if (action === "open-feedback") {
    markFeedbackRead(trigger.dataset.demoId);
    location.hash = `/feedback/${encodeURIComponent(trigger.dataset.demoId)}`;
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
  }
}

function handleSubmit(event) {
  if (event.target.id === "feedback-form") {
    event.preventDefault();
    submitFeedback(new FormData(event.target), event.target.dataset.demoId);
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
    const form = target.closest("#feedback-form");
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
  if (!scroller) {
    return;
  }
  ui.galleryScrollLeft = scroller.scrollLeft;
  syncGalleryProgress();
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

  const id = slugify(ui.draft.title) || crypto.randomUUID();
  const now = new Date().toISOString();
  const demo = {
    id: ensureUniqueDemoId(id),
    title: ui.draft.title.trim(),
    module: ui.draft.module.trim(),
    description: ui.draft.description.trim(),
    focusPrompt: ui.draft.description.trim() || "请重点关注信息层级、主要操作入口和确认动作是否明确。",
    images: [...ui.draft.images],
    createdAt: now,
    updatedAt: now,
  };

  state.demos.unshift(demo);
  saveState();

  ui.loading = false;
  ui.modal = { type: "created", demoId: demo.id };
  ui.draft = createEmptyDraft();
  showDelightToast("created");
  render();
}

function submitFeedback(formData, demoId) {
  const mis = String(formData.get("mis") || "").trim();
  const text = String(formData.get("text") || "").trim();
  if (!mis || !text) {
    showToast("MIS号和反馈内容都要填写。");
    return;
  }

  const feedback = {
    id: crypto.randomUUID(),
    demoId,
    mis,
    role: "",
    text,
    device: detectDeviceName(),
    createdAt: new Date().toISOString(),
    isNew: true,
  };

  state.feedback.push(feedback);
  const demo = getDemo(demoId);
  if (demo) {
    demo.updatedAt = feedback.createdAt;
  }
  ui.feedbackDrafts[demoId] = createEmptyFeedbackDraft();
  saveState();
  showDelightToast("feedback");
  render();
}

function deleteDemo(demoId) {
  const demo = getDemo(demoId);
  if (!demo) {
    return;
  }
  const confirmed = window.confirm(`确认删除「${demo.title}」吗？本地反馈也会一起删除。`);
  if (!confirmed) {
    return;
  }
  state.demos = state.demos.filter((item) => item.id !== demoId);
  state.feedback = state.feedback.filter((item) => item.demoId !== demoId);
  saveState();
  showToast("Demo 已删除。");
  render();
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
  return `${location.href.split("#")[0]}#/share/${encodeURIComponent(demoId)}`;
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

function markFeedbackRead(demoId) {
  let changed = false;
  state.feedback.forEach((item) => {
    if (item.demoId === demoId && item.isNew) {
      item.isNew = false;
      changed = true;
    }
  });
  if (changed) {
    saveState();
  }
}

function ensureUniqueDemoId(baseId) {
  if (!getDemo(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (getDemo(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
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

function renderIcon(name) {
  const icons = {
    plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.25v9.5M3.25 8h9.5" /></svg>',
    upload: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11V3.75M5.25 6.5 8 3.75l2.75 2.75M3.5 12.5h9" /></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.25 3.5h3.5M2.75 4.5h10.5M5.25 6.25v4.5M8 6.25v4.5M10.75 6.25v4.5M4 4.5l.5 8h7l.5-8" /></svg>',
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
