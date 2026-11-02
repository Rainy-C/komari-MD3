import "./live-number";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import { html, render, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { api, ApiError, LiveClient } from "./api";
import {
  bytes,
  capacity,
  aggregate,
  duration,
  percent,
  normalizeReport,
  unpackLive,
  number,
} from "./model.mjs";
import { applyTheme, stored, save } from "./theme";
import { icon } from "./icons";
import type {
  NodeInfo,
  Report,
  Settings,
  HistoryRecord,
  PingTask,
} from "./types";
import "./style.css";
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

const app = document.querySelector<HTMLDivElement>("#app")!;
let nodes: NodeInfo[] = [],
  reports: Record<string, Report> = {},
  online = new Set<string>();
let settings: Settings = {},
  appearance = stored("appearance") || "system",
  seed = "#446b9e";
let booting = false;
let loading = true,
  error = "",
  connection = "connecting",
  lastUpdate = 0,
  query = "",
  group = "",
  filter = "all",
  page = "overview";
let live: LiveClient | undefined,
  selected = decodeURIComponent(location.hash.slice(1)),
  hours = 4,
  historyLoading = false,
  historyError = "",
  pingError = "";
let loadRecords: HistoryRecord[] = [],
  pingRecords: HistoryRecord[] = [],
  pingTasks: PingTask[] = [],
  historyRequest = 0;
let loggedIn = false,
  loginOpen = false,
  loginBusy = false,
  loginError = "",
  siteTitle = "Komari",
  loginFocus: HTMLElement | null = null;
let passwordEnabled = true,
  oauthEnabled = false;
const charts: Chart[] = [];
const isFresh = () => connection === "live" && Date.now() - lastUpdate < 45000;
const isOnline = (id: string) => isFresh() && online.has(id);
const current = () => nodes.find((n) => n.uuid === selected);
const flag = (region?: string) =>
  region && /^[A-Z]{2}$/i.test(region)
    ? region
        .toUpperCase()
        .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    : "";
const pct = (n: number | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);
const rate = (n: number | undefined) => (n == null ? "—" : bytes(n) + "/s");
const liveValue = (n: number | undefined, format = rate) =>
  html`<live-number .value=${n} .format=${format}></live-number>`;
let motionDirection = 0;
let renderedView = "";
const failure = (e: unknown) =>
  e instanceof Error ? e.message : "请求失败，请重试";
function apply() {
  charts.splice(0).forEach((c) => c.destroy());
  applyTheme(seed, appearance);
}
function setAppearance(value: string) {
  appearance = value;
  save("appearance", value);
  apply();
  draw();
}
apply();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (appearance === "system") {
    apply();
    draw();
  }
});
window.addEventListener("hashchange", () => {
  selected = decodeURIComponent(location.hash.slice(1));
  page = "overview";
  draw();
  window.scrollTo({ top: 0 });
  document.getElementById("main")?.focus({ preventScroll: true });
  if (current()) void fetchHistory();
});
window.addEventListener("online", () => {
  if (!loading && !error) live?.start();
});
window.addEventListener("pagehide", () => live?.stop());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    live?.stop();
    connection = "paused";
    draw();
  } else if (!error && !loading) live?.start();
});
function openNode(id: string) {
  motionDirection = 1;
  location.hash = encodeURIComponent(id);
}
function overview() {
  motionDirection = -1;
  if (location.hash) location.hash = "";
  selected = "";
  page = "overview";
  draw();
}
function preferences() {
  motionDirection = 1;
  selected = "";
  if (location.hash)
    history.replaceState(null, "", location.pathname + location.search);
  page = "settings";
  draw();
}
function setLogin(open: boolean) {
  loginOpen = open;
  loginError = "";
  draw();
  const dialog = document.querySelector<HTMLDialogElement>("#login");
  if (open) {
    loginFocus = document.activeElement as HTMLElement;
    dialog?.showModal();
  } else {
    dialog?.close();
    loginFocus?.focus();
  }
}
async function boot() {
  if (booting) return;
  booting = true;
  loading = true;
  error = "";
  connection = "connecting";
  live?.stop();
  draw();
  try {
    const pub = await api<Record<string, unknown>>("/api/public");
    settings = (
      pub.theme_settings && typeof pub.theme_settings === "object"
        ? pub.theme_settings
        : {}
    ) as Settings;
    seed =
      typeof settings.seed_color === "string" ? settings.seed_color : "#446b9e";
    if (!stored("appearance"))
      appearance = ["system", "light", "dark"].includes(
        settings.default_appearance || "",
      )
        ? settings.default_appearance!
        : "system";
    siteTitle = String(pub.sitename || pub.site_name || "Komari");
    passwordEnabled = pub.disable_password_login !== true;
    oauthEnabled =
      pub.oauth_enable === true ||
      pub.oAuthEnabled === true ||
      pub.oauth_enabled === true;
    apply();
    const me = await api<{ logged_in: boolean }>("/api/me");
    loggedIn = me.logged_in;
    const data = await api<NodeInfo[]>("/api/nodes");
    if (!Array.isArray(data)) throw new Error("节点列表格式不兼容");
    nodes = data.sort((a, b) => number(b.weight) - number(a.weight));
    online = new Set();
    reports = {};
    lastUpdate = 0;
    loading = false;
    live = new LiveClient(
      Math.max(2, Math.min(30, number(settings.refresh_seconds) || 3)),
      (value) => {
        const result = unpackLive(value);
        online = result.online;
        reports = result.reports;
        lastUpdate = Date.now();
      },
      (state) => {
        connection = state;
        draw();
      },
    );
    live.start();
    draw();
    if (current()) void fetchHistory();
  } catch (e) {
    loading = false;
    error = failure(e);
    if (
      e instanceof ApiError &&
      (e.status === 401 || e.status === 403 || /private site/i.test(e.message))
    )
      error = "这是私有站点，请登录后查看节点。";
    draw();
  } finally {
    booting = false;
  }
}
function stat(label: string, value: unknown, sub: string) {
  return html`<div class="stat">
    <span>${label}</span><strong>${value}</strong><small>${sub}</small>
  </div>`;
}
function meter(label: string, value: number | undefined, detail: string) {
  return html`<div class="meter">
    <div><span>${label}</span><span>${liveValue(value, pct)}</span></div>
    <div
      class="usage-track ${value != null && value > 90 ? "critical" : ""}"
      role="progressbar"
      aria-label=${`${label}使用率`}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${value == null ? nothing : value}
      aria-valuetext=${value == null ? "暂无上报" : pct(value)}
    >
      <span
        style=${`transform:scaleX(${value == null ? 0 : Math.max(0, Math.min(1, value / 100))})`}
      ></span>
    </div>
    <small>${detail}</small>
  </div>`;
}
function nodeCard(n: NodeInfo) {
  const r = reports[n.uuid],
    on = isOnline(n.uuid),
    known = isFresh(),
    show = on && r;
  const ramTotal = r?.ram_total || n.mem_total || 0,
    diskTotal = r?.disk_total || n.disk_total || 0;
  return html`<article class="node-card km-node-card">
    <div class="node-heading">
      <div class="node-name">
        <h3>${n.name}</h3>
        <span
          >${flag(n.region)} ${n.region || n.group || "未分组"} ·
          ${n.os || "系统未知"}</span
        >
      </div>
      <span class="status ${on ? "online" : known ? "offline" : "unknown"}"
        ><i></i>${on ? "在线" : known ? "离线" : "未知"}</span
      >
    </div>
    <p class="hardware">
      ${n.cpu_cores ? `${n.cpu_cores} 核 · ` : ""}${bytes(n.mem_total)}
      内存${n.arch ? ` · ${n.arch}` : ""}
    </p>
    <div class="meters">
      ${meter("CPU", show ? r.cpu : undefined, n.cpu_cores ? `${n.cpu_cores} 核心` : "处理器")}${meter("内存", show && ramTotal && r.ram != null ? percent(r.ram, ramTotal) : undefined, capacity(show ? r.ram : undefined, ramTotal))}${meter("磁盘", show && diskTotal && r.disk != null ? percent(r.disk, diskTotal) : undefined, capacity(show ? r.disk : undefined, diskTotal))}
    </div>
    <div class="network">
      <span
        >${icon("down")}<span
          ><small>下载</small>${liveValue(show ? r.net_in : undefined)}</span
        ></span
      ><span
        >${icon("up")}<span
          ><small>上传</small>${liveValue(show ? r.net_out : undefined)}</span
        ></span
      >
    </div>
    ${settings.show_traffic !== false ? html`<div class="card-note">累计流量 <span>↓ ${show ? bytes(r.net_total_down) : "—"} / ↑ ${show ? bytes(r.net_total_up) : "—"}</span></div>` : nothing}
    <div class="card-bottom">
      <span
        >${settings.show_uptime !== false ? `运行 ${show ? duration(r.uptime) : "—"}` : n.group || ""}</span
      ><button
        type="button"
        class="text-button"
        @click=${() => openNode(n.uuid)}
        aria-label=${`查看 ${n.name} 详情`}
      >
        查看详情 ${icon("chevron")}
      </button>
    </div>
  </article>`;
}
function overviewContent() {
  const connected = isFresh(),
    active = nodes.filter((n) => isOnline(n.uuid));
  const visible = nodes.filter(
    (n) =>
      (!group || (n.group || "未分组") === group) &&
      (!query ||
        [n.name, n.os, n.region, n.group, n.tags].some((x) =>
          x?.toLowerCase().includes(query.toLowerCase()),
        )) &&
      (filter === "all" ||
        (filter === "online"
          ? isOnline(n.uuid)
          : connected && !online.has(n.uuid))),
  );
  const groups = [...new Set(nodes.map((n) => n.group || "未分组"))];
  return html`<div class="page-heading">
      <div>
        <h1>${settings.headline || "服务器概览"}</h1>
        ${settings.description && settings.description !== "所有节点的运行状态，尽在一处。" ? html`<p>${settings.description}</p>` : nothing}
      </div>
      <button
        type="button"
        class="soft-button"
        aria-label="重新连接"
        @click=${boot}
      >
        ${icon("refresh")}<span>重新连接</span>
      </button>
    </div>
    <section class="summary" aria-label="节点统计">
      ${stat("在线节点", connected ? `${active.length} / ${nodes.length}` : "—", connected ? `${nodes.length - active.length} 个离线` : "等待实时连接")}${stat(
        "平均 CPU",
        connected && active.length
          ? liveValue(
              aggregate(
                reports,
                active.map((n) => n.uuid),
                "cpu",
                true,
              ),
              pct,
            )
          : "—",
        "在线节点使用率",
      )}${stat(
        "总下载",
        connected
          ? liveValue(
              aggregate(
                reports,
                active.map((n) => n.uuid),
                "net_in",
              ),
            )
          : "—",
        "实时入站速率",
      )}${stat(
        "总上传",
        connected
          ? liveValue(
              aggregate(
                reports,
                active.map((n) => n.uuid),
                "net_out",
              ),
            )
          : "—",
        "实时出站速率",
      )}
    </section>
    <div class="list-toolbar">
      <label class="field search"
        ><span>搜索节点</span
        ><input
          type="search"
          placeholder="搜索节点"
          name="search"
          .value=${query}
          @input=${(e: Event) => {
            query = (e.target as HTMLInputElement).value;
            draw();
          }}
      /></label>
      <div class="segments" role="group" aria-label="在线状态筛选">
        ${[
          ["all", "全部"],
          ["online", "在线"],
          ["offline", "离线"],
        ].map(
          ([v, t]) =>
            html`<button
              type="button"
              aria-pressed=${filter === v}
              @click=${() => {
                filter = v;
                draw();
              }}
            >
              ${filter === v ? icon("check") : nothing}${t}
            </button>`,
        )}
      </div>
    </div>
    ${
      groups.length > 1
        ? html`<div class="group-chips" role="group" aria-label="节点分组">
            <button
              type="button"
              aria-pressed=${!group}
              @click=${() => {
                group = "";
                draw();
              }}
            >
              所有分组</button
            >${groups.map(
              (g) =>
                html`<button
                  type="button"
                  aria-pressed=${group === g}
                  @click=${() => {
                    group = group === g ? "" : g;
                    draw();
                  }}
                >
                  ${g}
                </button>`,
            )}
          </div>`
        : nothing
    }
    <div class="section-label">
      <h2>节点</h2>
      <span
        >${visible.length}
        个${query || group || filter !== "all" ? "匹配" : ""}</span
      >
    </div>
    ${
      visible.length
        ? html`<section class="node-grid" aria-label="服务器节点">
            ${repeat(visible, (n) => n.uuid, nodeCard)}
          </section>`
        : html`<section class="empty">
            ${icon("server")}
            <h2>${nodes.length ? "没有匹配的节点" : "暂无节点"}</h2>
            <p>
              ${nodes.length ? "试试其他关键词或筛选条件。" : "添加 Agent 后，节点将在这里显示。"}
            </p>
            ${
              nodes.length
                ? html`<button
                    type="button"
                    class="text-button"
                    @click=${() => {
                      query = "";
                      group = "";
                      filter = "all";
                      draw();
                    }}
                  >
                    清除筛选
                  </button>`
                : nothing
            }
          </section>`
    }`;
}
async function fetchHistory() {
  const n = current();
  if (!n) return;
  const request = ++historyRequest;
  historyLoading = true;
  historyError = "";
  pingError = "";
  loadRecords = [];
  pingRecords = [];
  draw();
  const results = await Promise.allSettled([
    api<{ records: HistoryRecord[] }>(
      `/api/records/load?uuid=${encodeURIComponent(n.uuid)}&hours=${hours}&load_type=all`,
    ),
    api<{ records: HistoryRecord[]; tasks?: PingTask[] }>(
      `/api/records/ping?uuid=${encodeURIComponent(n.uuid)}&hours=${hours}`,
    ),
    api<PingTask[]>("/api/task/ping"),
  ]);
  if (request !== historyRequest || selected !== n.uuid) return;
  if (results[0].status === "fulfilled")
    loadRecords = (results[0].value.records || [])
      .slice()
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  else historyError = failure(results[0].reason);
  if (results[1].status === "fulfilled")
    pingRecords = (results[1].value.records || [])
      .slice()
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  else pingError = failure(results[1].reason);
  pingTasks =
    results[2].status === "fulfilled" && Array.isArray(results[2].value)
      ? results[2].value
      : [];
  historyLoading = false;
  draw();
}
function detailContent(n: NodeInfo) {
  const r = reports[n.uuid],
    on = isOnline(n.uuid);
  return html`<button type="button" class="text-button back" @click=${overview}>
      ${icon("back")} 返回概览
    </button>
    <div class="page-heading">
      <div>
        <div class="title-line">
          <h1>${n.name}</h1>
          <span
            class="status ${on ? "online" : isFresh() ? "offline" : "unknown"}"
            ><i></i>${on ? "在线" : isFresh() ? "离线" : "未知"}</span
          >
        </div>
        <p>
          ${flag(n.region)} ${n.region || "地区未知"} · ${n.group || "未分组"}
        </p>
      </div>
      <select
        name="hours"
        aria-label="历史范围"
        .value=${String(hours)}
        @change=${(e: Event) => {
          hours = Number((e.target as HTMLSelectElement).value);
          void fetchHistory();
        }}
      >
        ${[1, 4, 12, 24].map((h) => html`<option value=${String(h)}>最近 ${h} 小时</option>`)}
      </select>
    </div>
    <section class="summary">
      ${stat("CPU", on && r ? pct(r.cpu) : "—", n.cpu_name || "处理器")}${stat("内存", on && r ? bytes(r.ram) : "—", `${bytes(n.mem_total)} 总容量`)}${stat("运行时间", on && r ? duration(r.uptime) : "—", "自最近一次启动")}${stat("负载", on && r ? (r.load == null ? "—" : r.load.toFixed(2)) : "—", "1 分钟平均负载")}
    </section>
    <section class="specs">
      <h2>节点信息</h2>
      <dl>
        ${[
          ["操作系统", n.os],
          ["处理器", n.cpu_name],
          ["架构", n.arch],
          ["核心数", n.cpu_cores],
          ["内核", n.kernel_version],
          ["虚拟化", n.virtualization],
          ["内存容量", bytes(n.mem_total)],
          ["磁盘容量", bytes(n.disk_total)],
        ].map(
          ([k, v]) =>
            html`<div>
              <dt>${k}</dt>
              <dd>${v || "—"}</dd>
            </div>`,
        )}
      </dl>
      ${n.public_remark ? html`<p class="remark">${n.public_remark}</p>` : nothing}
    </section>
    ${
      historyLoading
        ? html`<div class="history-loading">
            <progress
              max="1"
              indeterminate
              aria-label="加载历史记录"
            ></progress>
            <p>正在加载历史记录…</p>
          </div>`
        : html` ${historyError ? html`<div class="notice error">${icon("error")}<span>负载历史：${historyError}</span><button type="button" class="text-button" @click=${fetchHistory}>重试</button></div>` : nothing}
            ${pingError ? html`<div class="notice error">${icon("error")}<span>延迟历史：${pingError}</span><button type="button" class="text-button" @click=${fetchHistory}>重试</button></div>` : nothing}
            <div class="chart-grid">
              ${chartPanel("CPU 与内存", "load-chart", loadRecords.length > 0, "百分比 · 内存使用率按记录总量计算")}${chartPanel("网络速率", "network-chart", loadRecords.length > 0, "下载与上传 · KiB/s")}${chartPanel("延迟监测", "ping-chart", pingRecords.length > 0, "公开 Ping 任务 · ms")}
            </div>`
    }`;
}
function chartPanel(
  title: string,
  id: string,
  hasData: boolean,
  subtitle: string,
) {
  return html`<section class="chart-panel">
    <h2>${title}</h2>
    <p>${subtitle}</p>
    ${hasData ? html`<div class="canvas-wrap"><canvas id=${id} role="img" aria-label=${`${title}，最近 ${hours} 小时趋势图`}></canvas></div>` : html`<div class="chart-empty">当前时间范围暂无记录</div>`}
  </section>`;
}
function settingsContent() {
  return html`<button type="button" class="text-button back" @click=${overview}>
      ${icon("back")} 返回概览
    </button>
    <div class="page-heading">
      <div>
        <h1>外观</h1>
        <p>选择适合你的显示方式，设置仅保存在当前浏览器。</p>
      </div>
    </div>
    <section class="preferences">
      <h2>明暗主题</h2>
      <div class="appearance-options" role="group" aria-label="外观模式">
        ${(
          [
            ["system", "system", "跟随系统"],
            ["light", "sun", "浅色"],
            ["dark", "moon", "深色"],
          ] as const
        ).map(
          ([v, i, t]) =>
            html`<button
              type="button"
              aria-pressed=${appearance === v}
              @click=${() => setAppearance(v)}
            >
              ${icon(i)}<span>${t}</span>${appearance === v ? icon("check") : nothing}
            </button>`,
        )}
      </div>
      <div class="preference-row">
        <div>
          <h2>新拟态</h2>
          <p>柔和的浮起表面与内凹控件，主色由站点管理员设置。</p>
        </div>
        <span
          class="color-swatch"
          style=${`background:var(--color-primary)`}
        ></span>
      </div>
      <div class="preference-row">
        <div>
          <h2>主题版本</h2>
          <p>Komari Neumorph · 0.2.1</p>
        </div>
        <a
          class="text-button"
          href="https://github.com/Rainy-C/komari-MD3"
          target="_blank"
          rel="noopener"
          >源代码</a
        >
      </div>
    </section>`;
}
function login() {
  return html`<dialog
    id="login"
    aria-label="登录站点"
    @cancel=${() => {
      loginOpen = false;
      draw();
    }}
  >
    <div class="dialog-heading">
      <span>登录站点</span
      ><button
        class="icon-button"
        type="button"
        aria-label="关闭登录"
        @click=${() => setLogin(false)}
      >
        ${icon("close")}
      </button>
    </div>
    <form @submit=${submitLogin}>
      <p>使用 Komari 账号访问私有监控数据。</p>
      ${passwordEnabled ? html`<label class="field "><span>用户名</span><input name="username" autocomplete="username" autofocus required /></label><label class="field "><span>密码</span><input name="password" type="password" autocomplete="current-password" required /></label><label class="field "><span>两步验证码（如已启用）</span><input name="2fa_code" inputmode="numeric" autocomplete="one-time-code" /></label>` : nothing}${loginError ? html`<p class="form-error" role="alert">${loginError}</p>` : nothing}
      <div class="dialog-actions">
        ${oauthEnabled ? html`<a class="soft-button" type="button" href="/api/oauth">单点登录</a>` : nothing}${passwordEnabled ? html`<button class="primary-button" type="submit" ?disabled=${loginBusy}>${loginBusy ? "登录中…" : "登录"}</button>` : nothing}${!passwordEnabled && !oauthEnabled ? html`<p>密码登录已关闭，请通过管理员配置的登录入口访问。</p>` : nothing}
      </div>
    </form>
  </dialog>`;
}
async function submitLogin(e: Event) {
  e.preventDefault();
  if (loginBusy) return;
  const form = e.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  loginBusy = true;
  loginError = "";
  draw();
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    setLogin(false);
    await boot();
  } catch (e) {
    loginError = failure(e);
  } finally {
    loginBusy = false;
    draw();
  }
}
function draw() {
  const n = current();
  const view = page + ":" + selected;
  const direction = motionDirection;
  const animate = !!renderedView && view !== renderedView && direction !== 0;
  renderedView = view;
  motionDirection = 0;
  render(
    html`<a
        class="skip-link"
        href="#main"
        @click=${(e: Event) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        >跳到主要内容</a
      >
      <header class="topbar km-navbar">
        <a class="brand" href="/" aria-label="Komari 首页"
          ><span>${siteTitle}</span><span class="brand-label">Monitor</span></a
        >
        <div class="top-actions">
          <span class="live-label" role="status"
            ><i class=${isFresh() ? "live-dot" : "waiting-dot"}></i
            >${({ live: "实时更新", connecting: "连接中", retrying: "重连中", paused: "已暂停", error: "数据异常" } as Record<string, string>)[connection] || "连接中"}</span
          ><button
            type="button"
            class="icon-button"
            aria-label="外观设置"
            @click=${preferences}
          >
            ${icon(appearance === "dark" ? "moon" : "sun")}</button
          >${loggedIn ? html`<a class="text-button" href="/admin">管理后台</a>` : html`<button type="button" class="text-button" @click=${() => setLogin(true)}>登录</button>`}
        </div>
      </header>
      <div class="layout km-layout">
        <main id="main" class="km-main" tabindex="-1">
          ${
            loading
              ? html`<section class="empty">
                  <span
                    class="spinner"
                    role="status"
                    aria-label="加载节点"
                  ></span>
                  <h2>正在连接监控站点</h2>
                </section>`
              : error
                ? html`<section class="empty error-state">
                    ${icon("error")}
                    <h1>暂时无法查看节点</h1>
                    <p role="alert">${error}</p>
                    <div>
                      <button
                        type="button"
                        class="soft-button"
                        aria-label="重新连接"
                        @click=${boot}
                      >
                        重试</button
                      ><button
                        type="button"
                        class="primary-button"
                        @click=${() => setLogin(true)}
                      >
                        登录
                      </button>
                    </div>
                  </section>`
                : html`${!isFresh() ? html`<div class="notice" role="status">${icon("refresh")}<span>实时连接${connection === "paused" ? "已暂停" : "尚未就绪"}，节点状态暂不可确认。${lastUpdate ? "上次更新 " + new Date(lastUpdate).toLocaleTimeString("zh-CN") : ""}</span></div>` : nothing}${
                    page === "settings"
                      ? settingsContent()
                      : selected && !n
                        ? html`<section class="empty">
                            <h1>节点不存在或不可见</h1>
                            <button
                              type="button"
                              class="text-button"
                              @click=${overview}
                            >
                              返回概览
                            </button>
                          </section>`
                        : n
                          ? detailContent(n)
                          : overviewContent()
                  }`
          }
        </main>
      </div>
      ${login()}`,
    app,
  );
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const main = document.getElementById("main");
    main?.getAnimations().forEach((a) => a.cancel());
    main?.animate(
      [
        { opacity: 0.5, transform: `translateX(${direction * 10}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" },
    );
  }
  queueMicrotask(drawCharts);
}
function drawCharts() {
  if (!current() || historyLoading || page === "settings") {
    charts.splice(0).forEach((c) => c.destroy());
    return;
  }
  const ids = ["load-chart", "network-chart", "ping-chart"];
  const canvases = ids.map(
    (id) => document.getElementById(id) as HTMLCanvasElement | null,
  );
  if (canvases.every((c) => !c || Chart.getChart(c))) return;
  charts.splice(0).forEach((c) => c.destroy());
  const css = getComputedStyle(document.documentElement),
    color = (role: string) => css.getPropertyValue("--color-" + role).trim();
  const palette = [
    color("primary"),
    color("tertiary"),
    color("secondary"),
    color("error"),
  ];
  const time = (s: string) =>
    new Date(s).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  function create(
    index: number,
    labels: string[],
    datasets: { label: string; data: (number | null)[]; borderColor: string }[],
    unit: string,
    max?: number,
  ) {
    const canvas = canvases[index];
    if (!canvas) return;
    charts.push(
      new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: datasets.map((d) => ({
            ...d,
            pointRadius: 0,
            pointHitRadius: 8,
            borderWidth: 2,
            tension: 0.15,
            spanGaps: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              labels: {
                color: color("on-surface-variant"),
                usePointStyle: true,
                boxWidth: 8,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: color("on-surface-variant"),
                maxTicksLimit: 6,
                maxRotation: 0,
              },
            },
            y: {
              min: 0,
              max,
              grid: { color: color("outline-variant") },
              ticks: {
                color: color("on-surface-variant"),
                callback: (v) => `${v}${unit}`,
              },
            },
          },
        },
      }),
    );
  }
  const sorted = loadRecords;
  create(
    0,
    sorted.map((r) => time(r.time)),
    [
      {
        label: "CPU",
        data: sorted.map((r) => (r.cpu == null ? null : number(r.cpu))),
        borderColor: palette[0],
      },
      {
        label: "内存",
        data: sorted.map((r) =>
          r.ram == null
            ? null
            : percent(r.ram, r.ram_total || current()?.mem_total || 0),
        ),
        borderColor: palette[1],
      },
    ],
    "%",
    100,
  );
  create(
    1,
    sorted.map((r) => time(r.time)),
    [
      {
        label: "下载",
        data: sorted.map((r) =>
          r.net_in == null ? null : number(r.net_in) / 1024,
        ),
        borderColor: palette[0],
      },
      {
        label: "上传",
        data: sorted.map((r) =>
          r.net_out == null ? null : number(r.net_out) / 1024,
        ),
        borderColor: palette[1],
      },
    ],
    "",
  );
  const times = [...new Set(pingRecords.map((r) => r.time))].sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  );
  const taskIds = [...new Set(pingRecords.map((r) => r.task_id))];
  create(
    2,
    times.map(time),
    taskIds.map((id, i) => {
      const values = new Map(
        pingRecords
          .filter((r) => r.task_id === id)
          .map((r) => [r.time, r.value]),
      );
      return {
        label: pingTasks.find((t) => t.id === id)?.name || `任务 ${id}`,
        data: times.map((t) => {
          const v = values.get(t);
          return v == null || v < 0 ? null : number(v);
        }),
        borderColor: palette[i % palette.length],
      };
    }),
    " ms",
  );
}
void boot();
