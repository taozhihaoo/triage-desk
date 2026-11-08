/* TriageDesk UI — vanilla ES2020, no dependencies, no build step.
   Structure: helpers → state → api → boot → inbox → detail → actions → pages → modals. */
(() => {
  "use strict";

  // ── helpers ────────────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ICONS = {
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    sparkle: '<path d="M12 3l1.9 4.7L18.6 9.6 13.9 11.5 12 16.2 10.1 11.5 5.4 9.6l4.7-1.9L12 3z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><path d="M12 3c2.5 2.4 3.8 5.5 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3z"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M21 4v5h-5"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v3h20v-3a3 3 0 0 1 0-6V6H2z"/><path d="M13 6v2M13 11v2M13 16v2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
  };

  // 16px default size keeps stray icons from blowing up; CSS refines per context.
  const icon = (name, cls = "") =>
    `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${ICONS[name] || ""}</svg>`;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

  const AVATAR_TONES = ["c1", "c2", "c3", "c4", "c5"];
  const toneFor = (seed) => {
    let hash = 0;
    for (const ch of String(seed || "?")) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    return AVATAR_TONES[hash % AVATAR_TONES.length];
  };
  const initials = (name) =>
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "?";

  const avatar = (name, size = "") =>
    `<span class="avatar ${toneFor(name)} ${size}">${esc(initials(name))}</span>`;

  const debounce = (fn, ms = 260) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  // ── state ──────────────────────────────────────────────────────────────────
  const PREFS_KEY = "triagedesk.prefs";
  const DEFAULT_TRANSITIONS = {
    open: ["pending", "resolved", "closed"],
    pending: ["open", "resolved"],
    resolved: ["open", "closed"],
    closed: ["open"],
  };

  const state = {
    lang: "en",
    theme: "light",
    agentId: null,
    identity: null,          // {id, name, role}
    agents: [],              // dev identities + team list merged
    provider: null,
    model: null,
    route: "inbox",
    tab: "conversation",
    tickets: [],
    tags: [],
    customers: [],
    filters: { status: "all", priority: "", assignee: "", tag: "", search: "" },
    selectedId: null,
    detail: null,
    notes: [],
    history: [],
    aiBusy: false,
    loading: false,
  };

  const prefs = {
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
        if (raw.lang) state.lang = raw.lang;
        if (raw.theme) state.theme = raw.theme;
        if (raw.agentId) state.agentId = raw.agentId;
      } catch { /* ignore corrupt prefs */ }
    },
    save() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
          lang: state.lang, theme: state.theme, agentId: state.agentId,
        }));
      } catch { /* storage may be unavailable */ }
    },
  };

  // ── i18n ───────────────────────────────────────────────────────────────────
  const t = (key) => (window.I18N[state.lang] || window.I18N.en)[key] ?? key;
  const locale = () => (window.LOCALES[state.lang] || window.LOCALES.en).locale;

  const STATUS_KEYS = { open: "statusOpen", pending: "statusPending", resolved: "statusResolved", closed: "statusClosed" };
  const PRIO_KEYS = { low: "prioLow", normal: "prioNormal", high: "prioHigh", urgent: "prioUrgent" };
  const SENT_KEYS = { positive: "sentPositive", neutral: "sentNeutral", negative: "sentNegative" };
  const CAT_KEYS = {
    Sales: "catSales", "Technical Support": "catSupport", Billing: "catBilling", "General Question": "catGeneral",
  };
  const EVENT_KEYS = {
    ticket_created: "evTicketCreated", status_changed: "evStatusChanged",
    priority_changed: "evPriorityChanged", assigned: "evAssigned", unassigned: "evUnassigned",
    tag_added: "evTagAdded", tag_removed: "evTagRemoved", note_added: "evNoteAdded",
    message_added: "evMessageAdded", ai_analyzed: "evAiAnalyzed",
    ai_reply_generated: "evAiReply", customer_created: "evCustomerCreated",
    agent_created: "evAgentCreated", tag_created: "evTagCreated",
  };

  const statusLabel = (s) => t(STATUS_KEYS[s] || "statusOpen");
  const prioLabel = (p) => t(PRIO_KEYS[p] || "prioNormal");
  const sentimentLabel = (s) => t(SENT_KEYS[s] || "sentNeutral");
  const catLabel = (c) => (CAT_KEYS[c] ? t(CAT_KEYS[c]) : (c || "—"));
  const eventLabel = (type) => t(EVENT_KEYS[type] || type);

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale(), {
      dateStyle: "medium", timeStyle: "short",
    }).format(date);
  }

  function relTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const diff = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
    if (abs < 60) return rtf.format(Math.round(diff), "second");
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
    return new Intl.DateTimeFormat(locale(), { dateStyle: "medium" }).format(date);
  }

  // ── api ────────────────────────────────────────────────────────────────────
  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = "GET", body } = {}) {
    const headers = {};
    if (state.agentId) headers["X-Agent-Id"] = state.agentId;
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(path, { method, headers, body: payload });
    } catch {
      throw new ApiError("network", 0, "network_error");
    }
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      const info = (data && data.error) || {};
      throw new ApiError(info.message || response.statusText, response.status, info.code);
    }
    return data;
  }

  function errorText(error) {
    if (!(error instanceof ApiError)) return t("failed");
    if (error.status === 401) return t("unauthorized");
    if (error.status === 403) return t("forbidden");
    if (error.code === "conflict") return t("duplicateTicket");
    if (error.code === "validation_error" || error.code === "invalid_status") return t("requiredFields");
    if (error.code === "provider_error" || error.code === "provider_rate_limited") return t("providerError");
    if (error.status === 0) return t("genericError");
    return error.message || t("genericError");
  }

  // ── toasts ─────────────────────────────────────────────────────────────────
  function toast(message, kind = "ok") {
    const root = $("#toasts");
    const node = document.createElement("div");
    node.className = `toast ${kind}`;
    node.innerHTML = `<span class="bar"></span><span>${esc(message)}</span>`;
    root.appendChild(node);
    setTimeout(() => {
      node.style.transition = "opacity .2s, transform .2s";
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      setTimeout(() => node.remove(), 220);
    }, 3200);
  }

  // ── theme / language ───────────────────────────────────────────────────────
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    const btn = $("#theme-icon");
    if (btn) btn.innerHTML = icon(state.theme === "dark" ? "sun" : "moon");
  }

  function applyStaticI18n() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    $$("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    const langLabel = $("#lang-label");
    if (langLabel) langLabel.textContent = state.lang === "en" ? "EN" : "中文";
    document.title = state.lang === "zh" ? "TriageDesk · 客服工单台" : "TriageDesk · Support desk";
  }

  function mountIcons(root = document) {
    $$("[data-icon]", root).forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  }

  // ── boot ───────────────────────────────────────────────────────────────────
  async function boot() {
    prefs.load();
    applyTheme();
    applyStaticI18n();
    mountIcons();

    let session = null;
    try {
      session = await api("/auth/dev/agents");
    } catch {
      document.body.innerHTML =
        `<div class="detail-empty" style="height:100vh">${icon("bolt")}` +
        `<h3>API unreachable</h3><p>Start the server with <code>uvicorn src.api:app</code>.</p></div>`;
      return;
    }
    state.agents = session.items || [];
    state.provider = session.provider;
    state.model = session.model;
    const badge = $("#provider-badge");
    if (badge) badge.textContent = state.provider || "mock";

    const known = state.agents.find((agent) => agent.id === state.agentId);
    if (!known) {
      state.agentId = null;
      showGate();
      return;
    }
    state.identity = known;
    await start();
  }

  function showGate() {
    const gate = $("#gate");
    const app = $("#app");
    app.hidden = true;
    gate.hidden = false;
    const choices = $("#agent-choices");
    choices.innerHTML = state.agents.length
      ? state.agents.map((agent) => `
        <button class="agent-choice" data-action="pick-identity" data-id="${agent.id}">
          ${avatar(agent.name)}
          <span>
            <strong>${esc(agent.name)}</strong><br>
            <small>${state.lang === "zh" && agent.role === "admin" ? t("roleAdmin") : agent.role === "admin" ? t("roleAdmin") : t("roleAgent")}</small>
          </span>
        </button>`).join("")
      : `<p class="muted">No agents found. Seed demo data: <code>python -m src.desk.seed</code></p>`;
  }

  async function pickIdentity(id) {
    state.agentId = id;
    state.identity = state.agents.find((agent) => agent.id === id) || null;
    prefs.save();
    $("#gate").hidden = true;
    await start();
  }

  async function start() {
    $("#app").hidden = false;
    $("#agent-name").textContent = state.identity?.name || "—";
    $("#agent-role").textContent = state.identity?.role === "admin" ? t("roleAdmin") : t("roleAgent");
    const av = $("#agent-avatar");
    av.className = `avatar ${toneFor(state.identity?.name)}`;
    av.textContent = initials(state.identity?.name);
    $("#nav-audit").classList.toggle("hidden", state.identity?.role !== "admin");

    await refreshReferenceData();
    await routeFromHash();
  }

  async function refreshReferenceData() {
    try {
      const [tags, agents, customers] = await Promise.all([
        api("/tags"), api("/agents"), api("/customers?limit=200"),
      ]);
      state.tags = tags.items;
      state.customers = customers.items;
      const team = agents.items;
      const byId = new Map(state.agents.map((agent) => [agent.id, agent]));
      team.forEach((agent) => byId.set(agent.id, { id: agent.id, name: agent.name, role: agent.role }));
      state.agents = Array.from(byId.values());
      if (!state.identity) {
        state.identity = state.agents.find((agent) => agent.id === state.agentId) || null;
      }
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
    }
  }

  // ── routing ────────────────────────────────────────────────────────────────
  const ROUTES = ["inbox", "customers", "team", "audit"];

  function routeFromHash() {
    const name = (location.hash.replace(/^#\/?/, "") || "inbox").split("?")[0];
    const route = ROUTES.includes(name) ? name : "inbox";
    if (route === "audit" && state.identity?.role !== "admin") {
      state.route = "audit";
    } else {
      state.route = route;
    }
    renderRoute();
  }

  function navigate(route) {
    location.hash = `#/${route}`;
  }

  function renderRoute() {
    $$(".view").forEach((view) => { view.hidden = view.id !== `view-${state.route}`; });
    $$(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.route === state.route);
    });
    if (state.route === "inbox") renderInbox();
    if (state.route === "customers") renderCustomers();
    if (state.route === "team") renderTeam();
    if (state.route === "audit") renderAudit();
  }

  // ── inbox ──────────────────────────────────────────────────────────────────
  function filterQuery() {
    const params = new URLSearchParams();
    if (state.filters.status !== "all") params.set("status", state.filters.status);
    if (state.filters.priority) params.set("priority", state.filters.priority);
    if (state.filters.assignee) params.set("assignee", state.filters.assignee);
    if (state.filters.tag) params.set("tag", state.filters.tag);
    if (state.filters.search) params.set("search", state.filters.search);
    params.set("limit", "150");
    return params.toString();
  }

  async function loadTickets() {
    state.loading = true;
    renderTicketList();
    try {
      const data = await api(`/tickets?${filterQuery()}`);
      state.tickets = data.items;
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
      state.tickets = [];
    } finally {
      state.loading = false;
      renderTicketList();
    }
  }

  function renderInbox() {
    renderFilterControls();
    if (!state.tickets.length && !state.loading) {
      loadTickets();
    } else {
      renderTicketList();
    }
    renderDetail();
  }

  function renderFilterControls() {
    const statuses = [
      ["all", t("statusAll")],
      ["open", statusLabel("open")],
      ["pending", statusLabel("pending")],
      ["resolved", statusLabel("resolved")],
      ["closed", statusLabel("closed")],
    ];
    $("#status-chips").innerHTML = statuses.map(([value, label]) => `
      <button class="chip ${state.filters.status === value ? "active" : ""}"
              data-action="filter-status" data-value="${value}">${esc(label)}</button>
    `).join("");

    const priority = $("#filter-priority");
    priority.innerHTML = [`<option value="">${esc(t("priorityAll"))}</option>`]
      .concat(["urgent", "high", "normal", "low"].map((p) =>
        `<option value="${p}" ${state.filters.priority === p ? "selected" : ""}>${esc(prioLabel(p))}</option>`))
      .join("");

    const assignee = $("#filter-assignee");
    assignee.innerHTML = [
      `<option value="">${esc(t("assigneeAll"))}</option>`,
      `<option value="none" ${state.filters.assignee === "none" ? "selected" : ""}>${esc(t("assigneeNone"))}</option>`,
    ].concat(state.agents.map((agent) =>
      `<option value="${agent.id}" ${state.filters.assignee === agent.id ? "selected" : ""}>${esc(agent.name)}</option>`))
      .join("");

    const tag = $("#filter-tag");
    tag.innerHTML = [`<option value="">${esc(t("tagAll"))}</option>`]
      .concat(state.tags.map((item) =>
        `<option value="${esc(item.name)}" ${state.filters.tag === item.name ? "selected" : ""}>${esc(item.name)}</option>`))
      .join("");
  }

  function renderTicketList() {
    const list = $("#ticket-list");
    const count = $("#ticket-count");
    if (count) count.textContent = String(state.tickets.length);
    const openCount = state.tickets.filter((tk) => tk.status === "open" || tk.status === "pending").length;
    const navCount = $("#nav-count-inbox");
    if (navCount) navCount.textContent = openCount ? String(openCount) : "";

    if (state.loading) {
      list.innerHTML = Array.from({ length: 5 }, () => `<div class="skeleton sk-row"></div>`).join("");
      return;
    }
    if (!state.tickets.length) {
      list.innerHTML = `
        <div class="empty">
          ${icon("inbox")}
          <div>${esc(t("emptyInbox"))}</div>
          <div class="muted" style="margin-top:4px">${esc(t("emptyInboxHint"))}</div>
        </div>`;
      return;
    }
    list.innerHTML = state.tickets.map((ticket) => {
      const agent = state.agents.find((item) => item.id === ticket.assignee_id);
      const customer = state.customers.find((item) => item.id === ticket.customer_id);
      const customerName = customer?.name || "—";
      return `
        <button class="ticket-row ${ticket.id === state.selectedId ? "active" : ""}"
                data-action="select-ticket" data-id="${ticket.id}">
          <div class="row-top">
            ${avatar(customerName, "sm")}
            <span class="row-subject">${esc(ticket.subject)}</span>
            <span class="row-time" title="${esc(fmtDateTime(ticket.updated_at))}">${esc(relTime(ticket.updated_at))}</span>
          </div>
          <div class="row-sub">
            <span class="name">${esc(customerName)}</span>
            <span class="pill ${ticket.status}"><span class="dot"></span>${esc(statusLabel(ticket.status))}</span>
            <span class="pill p-${ticket.priority}">${esc(prioLabel(ticket.priority))}</span>
            <span class="name muted" style="margin-left:auto">${esc(agent ? agent.name : t("unassigned"))}</span>
          </div>
          ${ticket.ai_summary ? `<div class="row-snippet">${esc(ticket.ai_summary)}</div>` : ""}
        </button>`;
    }).join("");
  }

  async function selectTicket(id) {
    state.selectedId = id;
    state.tab = "conversation";
    $("#view-inbox").classList.add("show-detail");
    renderTicketList();
    $("#detail-pane").innerHTML = `<div class="detail-empty"><div class="skeleton" style="width:260px;height:120px"></div></div>`;
    await loadDetail();
    renderDetail();
  }

  async function loadDetail() {
    if (!state.selectedId) return;
    try {
      const [detail, notes, history] = await Promise.all([
        api(`/tickets/${state.selectedId}`),
        api(`/tickets/${state.selectedId}/notes`),
        api(`/tickets/${state.selectedId}/history`),
      ]);
      state.detail = detail;
      state.notes = notes.items;
      state.history = history.items;
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
      state.detail = null;
    }
  }

  function renderDetail() {
    const pane = $("#detail-pane");
    if (!state.selectedId || !state.detail) {
      pane.innerHTML = `
        <div class="detail-empty">
          <div class="art">${icon("ticket")}</div>
          <h3>${esc(t("selectTicket"))}</h3>
          <p>${esc(t("selectTicketHint"))}</p>
        </div>`;
      return;
    }
    pane.innerHTML = renderDetailHead() + renderDetailBody();
  }

  function renderDetailHead() {
    const { ticket, customer, assignee } = state.detail;
    const allowed = DEFAULT_TRANSITIONS[ticket.status] || [];
    const canModify = state.identity?.role === "admin"
      || !ticket.assignee_id || ticket.assignee_id === state.identity?.id;

    const statusOptions = allowed.map((status) =>
      `<option value="${status}">${esc(statusLabel(status))}</option>`).join("");
    const priorityOptions = ["low", "normal", "high", "urgent"].map((p) =>
      `<option value="${p}" ${ticket.priority === p ? "selected" : ""}>${esc(prioLabel(p))}</option>`).join("");
    const assigneeOptions = [`<option value="">${esc(t("unassigned"))}</option>`]
      .concat(state.agents.map((agent) =>
        `<option value="${agent.id}" ${ticket.assignee_id === agent.id ? "selected" : ""}>${esc(agent.name)}</option>`))
      .join("");

    return `
      <header class="detail-head">
        <div class="crumb">
          <code>#${esc(ticket.id.slice(0, 8))}</code>
          <span class="sep">•</span>
          <span title="${esc(fmtDateTime(ticket.created_at))}">${esc(relTime(ticket.created_at))}</span>
          ${ticket.ai_analyzed_at ? `<span class="pill ai">${icon("sparkle")}AI</span>` : ""}
        </div>
        <h2>${esc(ticket.subject)}</h2>
        <div class="detail-meta">
          <span class="who">${avatar(customer?.name || "?", "sm")}${esc(customer?.name || "—")}</span>
          <span>${esc(customer?.email || "")}</span>
          <span class="pill ${ticket.status}"><span class="dot"></span>${esc(statusLabel(ticket.status))}</span>
          <span class="pill p-${ticket.priority}">${esc(prioLabel(ticket.priority))}</span>
          <span>${esc(assignee?.name || t("unassigned"))}</span>
        </div>
        <div class="detail-actions">
          <label class="mini-field" title="${esc(t("status"))}">
            <span class="mini-k">${esc(t("status"))}</span>
            <select class="mini-select" data-select="status" ${canModify && allowed.length ? "" : "disabled"}>
              <option value="">${esc(t("moveTo"))}</option>${statusOptions}
            </select>
          </label>
          <label class="mini-field" title="${esc(t("priority"))}">
            <span class="mini-k">${esc(t("priority"))}</span>
            <select class="mini-select" data-select="priority" ${canModify ? "" : "disabled"}>${priorityOptions}</select>
          </label>
          <label class="mini-field" title="${esc(t("assignee"))}">
            <span class="mini-k">${esc(t("assignee"))}</span>
            <select class="mini-select" data-select="assignee" ${canModify ? "" : "disabled"}>${assigneeOptions}</select>
          </label>
          <button class="btn sm" data-action="open-tag-picker" ${canModify ? "" : "disabled"}>
            ${icon("tag")}<span>${esc(t("addTag"))}</span>
          </button>
          <span style="flex:1"></span>
          <button class="btn sm soft" data-action="ai-analyze" ${state.aiBusy ? "disabled" : ""}>
            ${icon("sparkle")}<span>${esc(ticket.ai_analyzed_at ? t("aiReanalyze") : t("aiAnalyze"))}</span>
          </button>
          <button class="btn sm" data-action="ai-draft" ${state.aiBusy ? "disabled" : ""}>
            ${icon("message")}<span>${esc(ticket.ai_reply ? t("aiRedraft") : t("aiDraft"))}</span>
          </button>
        </div>
      </header>`;
  }

  function renderDetailBody() {
    const tabs = [
      ["conversation", t("tabConversation"), state.detail.messages.length],
      ["notes", t("tabNotes"), state.notes.length],
      ["activity", t("tabActivity"), state.history.length],
    ];
    return `
      <div class="detail-grid">
        <div class="detail-main">
          <div class="tabs">
            ${tabs.map(([key, label, count]) => `
              <button class="tab ${state.tab === key ? "active" : ""}" data-action="set-tab" data-value="${key}">
                ${esc(label)}<span class="badge">${count}</span>
              </button>`).join("")}
          </div>
          ${state.tab === "conversation" ? renderConversation() : ""}
          ${state.tab === "notes" ? renderNotes() : ""}
          ${state.tab === "activity" ? renderActivity() : ""}
        </div>
        <aside class="detail-side">
          ${renderAiCard()}
          ${renderProperties()}
        </aside>
      </div>`;
  }

  function renderConversation() {
    const messages = state.detail.messages;
    const thread = messages.length
      ? messages.map((msg) => `
          <div class="msg ${msg.author_type}">
            ${avatar(msg.author_name, "sm")}
            <div class="msg-body">
              <div class="msg-top">
                <strong>${esc(msg.author_name)}</strong>
                ${msg.author_type === "agent" ? `<span class="who-badge">${esc(t("roleAgent"))}</span>` : ""}
                <span class="when" title="${esc(fmtDateTime(msg.created_at))}">${esc(relTime(msg.created_at))}</span>
              </div>
              <div class="msg-text">${esc(msg.body)}</div>
            </div>
          </div>`).join("")
      : `<div class="empty">${icon("message")}<div>${esc(t("activityEmpty"))}</div></div>`;

    return `
      <div class="thread">${thread}</div>
      <div class="composer">
        <textarea id="reply-body" placeholder="${esc(t("replyPlaceholder"))}"></textarea>
        <div class="composer-bar">
          <span class="hint">${esc(t("replyHint"))}</span>
          <button class="btn primary sm" data-action="add-message">${icon("send")}${esc(t("addReply"))}</button>
        </div>
      </div>`;
  }

  function renderNotes() {
    const list = state.notes.length
      ? state.notes.map((note) => `
          <div class="note">
            <div class="note-top">
              <strong>${esc(note.author_name)}</strong>
              <span title="${esc(fmtDateTime(note.created_at))}">${esc(relTime(note.created_at))}</span>
            </div>
            <p>${esc(note.body)}</p>
          </div>`).join("")
      : `<div class="empty">${icon("note")}<div>${esc(t("notesEmpty"))}</div></div>`;

    return `
      <div>${list}</div>
      <div class="composer">
        <textarea id="note-body" placeholder="${esc(t("notePlaceholder"))}"></textarea>
        <div class="composer-bar">
          <span class="hint"></span>
          <button class="btn primary sm" data-action="add-note">${icon("note")}${esc(t("addNote"))}</button>
        </div>
      </div>`;
  }

  function describeEvent(event) {
    const meta = event.metadata || {};
    switch (event.event_type) {
      case "status_changed":
        return `${statusLabel(meta.from)} → ${statusLabel(meta.to)}`;
      case "priority_changed":
        return `${prioLabel(meta.from)} → ${prioLabel(meta.to)}`;
      case "assigned": {
        const agent = state.agents.find((item) => item.id === meta.assignee_id);
        return agent ? agent.name : "";
      }
      case "tag_added":
      case "tag_removed":
        return meta.tag || "";
      case "ai_analyzed":
        return [catLabel(meta.category), prioLabel(meta.urgency), sentimentLabel(meta.sentiment)]
          .filter(Boolean).join(" · ");
      case "ticket_created":
        return meta.subject ? `“${meta.subject}”` : "";
      default:
        return "";
    }
  }

  function renderActivity() {
    if (!state.history.length) {
      return `<div class="empty">${icon("clock")}<div>${esc(t("activityEmpty"))}</div></div>`;
    }
    return `
      <div class="timeline">
        ${state.history.slice().reverse().map((event) => {
          const actor = state.agents.find((item) => item.id === event.actor_id);
          const detail = describeEvent(event);
          return `
            <div class="tl-item ${event.event_type.startsWith("ai_") ? "on" : ""}">
              <strong>${esc(eventLabel(event.event_type))}</strong>${detail ? ` — ${esc(detail)}` : ""}
              <span class="when">${esc(actor ? actor.name : "system")} · ${esc(fmtDateTime(event.created_at))}</span>
            </div>`;
        }).join("")}
      </div>`;
  }

  function renderAiCard() {
    const ticket = state.detail.ticket;
    const analyzed = Boolean(ticket.ai_analyzed_at);
    const body = analyzed
      ? `
        <p class="ai-summary">${esc(ticket.ai_summary || "")}</p>
        ${ticket.ai_key_points?.length ? `
          <ul class="ai-points">
            ${ticket.ai_key_points.map((point) => `<li>${esc(point)}</li>`).join("")}
          </ul>` : ""}
        <div class="ai-chips">
          <span class="pill plain">${esc(t("category"))}: ${esc(catLabel(ticket.ai_category))}</span>
          <span class="pill plain">${esc(t("urgency"))}: ${esc(prioLabel(ticket.ai_urgency))}</span>
          <span class="pill plain">${esc(t("sentiment"))}: ${esc(sentimentLabel(ticket.ai_sentiment))}</span>
        </div>
        ${ticket.ai_suggested_priority && ticket.ai_suggested_priority !== ticket.priority ? `
          <div class="ai-foot">
            <span>${esc(t("suggestedPriority"))}: <strong>${esc(prioLabel(ticket.ai_suggested_priority))}</strong></span>
            <button class="btn sm soft" data-action="apply-priority" data-value="${ticket.ai_suggested_priority}"
                    style="margin-left:auto">${icon("check")}${esc(t("apply"))}</button>
          </div>` : ""}
        ${ticket.ai_reply ? `
          <div style="margin-top:14px">
            <div class="mini-label">${esc(t("draftLabel"))}</div>
            <div class="draft-box">${esc(ticket.ai_reply)}</div>
            <div class="ai-foot" style="border-top:0;padding-top:8px">
              <span>${esc(t("draftHint"))}</span>
              <button class="icon-btn" data-action="copy-draft" title="${esc(t("copy"))}" style="margin-left:auto">${icon("copy")}</button>
            </div>
          </div>` : ""}
        <div class="ai-foot">
          <span>${esc(t("aiAnalyzedBy"))} ${esc(ticket.ai_provider || "—")}${ticket.ai_model ? ` / ${esc(ticket.ai_model)}` : ""} · ${esc(t("aiAdvisory"))}</span>
        </div>`
      : `
        <div class="ai-empty">
          <p>${esc(t("aiEmptyText"))}</p>
          <button class="btn soft sm" data-action="ai-analyze" ${state.aiBusy ? "disabled" : ""}>
            ${icon("sparkle")}${esc(state.aiBusy ? t("saving") : t("aiAnalyze"))}
          </button>
        </div>`;

    return `
      <div class="ai-card">
        <div class="ai-head">
          <span class="spark">${icon("sparkle")}</span>
          <h3>${esc(t("aiTitle"))}</h3>
          <span class="spacer"></span>
          ${analyzed ? `<span class="pill ai">${esc(relTime(ticket.ai_analyzed_at))}</span>` : ""}
        </div>
        <div class="ai-body">${body}</div>
      </div>`;
  }

  function renderProperties() {
    const { ticket, customer, tags } = state.detail;
    return `
      <div class="card">
        <div class="card-head">${icon("ticket")}<h3>${esc(t("properties"))}</h3></div>
        <div class="card-body">
          <div class="prop"><span class="k">${esc(t("customer"))}</span>
            <span class="v">${esc(customer?.name || "—")}</span></div>
          <div class="prop"><span class="k">${esc(t("created"))}</span>
            <span class="v">${esc(fmtDateTime(ticket.created_at))}</span></div>
          <div class="prop"><span class="k">${esc(t("updated"))}</span>
            <span class="v">${esc(fmtDateTime(ticket.updated_at))}</span></div>
          ${ticket.resolved_at ? `<div class="prop"><span class="k">${esc(t("resolved"))}</span>
            <span class="v">${esc(fmtDateTime(ticket.resolved_at))}</span></div>` : ""}
          <div class="prop"><span class="k">${esc(t("tags"))}</span>
            <span class="v">
              ${tags.length
                ? tags.map((tag) => `
                    <span class="tag-pill">${esc(tag.name)}
                      <button class="icon-btn" style="width:16px;height:16px;display:inline-grid"
                              data-action="remove-tag" data-id="${tag.id}"
                              title="x">×</button>
                    </span>`).join("")
                : `<span class="muted">${esc(t("noTags"))}</span>`}
              <button class="btn sm ghost" data-action="open-tag-picker">${icon("plus")}</button>
            </span></div>
        </div>
      </div>`;
  }

  // ── ticket actions ─────────────────────────────────────────────────────────
  async function guard(fn) {
    try {
      await fn();
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
    }
  }

  async function refreshTicket(full = true) {
    if (!state.selectedId) return;
    if (full) await loadDetail();
    renderDetail();
    await loadTickets();
  }

  async function setStatus(status) {
    if (!status) return;
    await guard(async () => {
      await api(`/tickets/${state.selectedId}`, { method: "PATCH", body: { status } });
      toast(t("updatedOk"));
      await refreshTicket();
    });
  }

  async function setPriority(priority) {
    await guard(async () => {
      await api(`/tickets/${state.selectedId}`, { method: "PATCH", body: { priority } });
      toast(t("updatedOk"));
      await refreshTicket();
    });
  }

  async function setAssignee(agentId) {
    await guard(async () => {
      if (agentId) {
        await api(`/tickets/${state.selectedId}/assign`, { method: "POST", body: { agent_id: agentId } });
      } else {
        await api(`/tickets/${state.selectedId}/unassign`, { method: "POST" });
      }
      toast(t("updatedOk"));
      await refreshTicket();
    });
  }

  async function addMessage() {
    const box = $("#reply-body");
    if (!box || !box.value.trim()) return;
    await guard(async () => {
      await api(`/tickets/${state.selectedId}/messages`, { method: "POST", body: { body: box.value.trim() } });
      box.value = "";
      toast(t("savedOk"));
      await refreshTicket();
    });
  }

  async function addNote() {
    const box = $("#note-body");
    if (!box || !box.value.trim()) return;
    await guard(async () => {
      await api(`/tickets/${state.selectedId}/notes`, { method: "POST", body: { body: box.value.trim() } });
      box.value = "";
      toast(t("savedOk"));
      await refreshTicket();
    });
  }

  async function runAi(kind) {
    if (!state.selectedId || state.aiBusy) return;
    state.aiBusy = true;
    renderDetail();
    await guard(async () => {
      await api(`/tickets/${state.selectedId}/ai/${kind}`, { method: "POST" });
      toast(t("savedOk"));
    });
    state.aiBusy = false;
    await loadDetail();
    renderDetail();
    await loadTickets();
  }

  async function applySuggestedPriority(priority) {
    await setPriority(priority);
  }

  async function copyDraft() {
    const draft = state.detail?.ticket?.ai_reply;
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      toast(t("copied"));
    } catch {
      toast(t("failed"), "error");
    }
  }

  async function toggleTag(tagId, on) {
    await guard(async () => {
      if (on) {
        await api(`/tickets/${state.selectedId}/tags`, { method: "POST", body: { tag_id: tagId } });
      } else {
        await api(`/tickets/${state.selectedId}/tags/${tagId}`, { method: "DELETE" });
      }
      await loadDetail();
      renderDetail();
      renderTagPicker();
    });
  }

  // ── modals ─────────────────────────────────────────────────────────────────
  function closeModal() {
    $("#modal-root").innerHTML = "";
  }

  function openModal({ title, iconName = "plus", body, submit = null, onSubmit = null, wide = false }) {
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" data-action="backdrop-close">
        <form class="modal" ${wide ? 'style="width:min(620px,100%)"' : ""} novalidate>
          <header>
            ${icon(iconName)}
            <h2>${esc(title)}</h2>
            <button type="button" class="icon-btn" data-action="close-modal">${icon("x")}</button>
          </header>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button type="button" class="btn" data-action="close-modal">${esc(t("cancel"))}</button>
            ${submit ? `<button type="submit" class="btn primary">${esc(submit)}</button>` : ""}
          </div>
        </form>
      </div>`;
    mountIcons(root);
    const form = root.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!onSubmit) return closeModal();
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = t("saving"); }
      try {
        await onSubmit(new FormData(form));
        closeModal();
      } catch (error) {
        if (error.status === 401) return showGate();
        toast(errorText(error), "error");
      } finally {
        if (button && submit) { button.disabled = false; button.textContent = submit; }
      }
    });
    const first = form.querySelector("input, textarea, select");
    if (first) first.focus();
  }

  function openNewTicket() {
    if (!state.customers.length) {
      toast(t("customersEmpty"), "warn");
      return;
    }
    const options = state.customers.map((customer) =>
      `<option value="${customer.id}">${esc(customer.name)} · ${esc(customer.email)}</option>`).join("");
    const priorities = ["normal", "low", "high", "urgent"].map((p) =>
      `<option value="${p}">${esc(prioLabel(p))}</option>`).join("");
    openModal({
      title: t("newTicket"),
      iconName: "ticket",
      submit: t("create"),
      wide: true,
      body: `
        <div class="field"><label>${esc(t("fieldCustomer"))}</label>
          <select name="customer_id" required>${options}</select></div>
        <div class="field"><label>${esc(t("fieldSubject"))}</label>
          <input name="subject" required maxlength="300" autocomplete="off"></div>
        <div class="field"><label>${esc(t("fieldMessage"))}</label>
          <textarea name="message" required></textarea>
          <span class="help">${esc(t("newTicketHint"))}</span></div>
        <div class="field"><label>${esc(t("fieldPriority"))}</label>
          <select name="priority">${priorities}</select></div>`,
      onSubmit: async (data) => {
        const ticket = await api("/tickets", {
          method: "POST",
          body: {
            customer_id: data.get("customer_id"),
            subject: String(data.get("subject") || "").trim(),
            message: String(data.get("message") || "").trim(),
            priority: data.get("priority") || "normal",
          },
        });
        toast(t("createdOk"));
        await loadTickets();
        state.selectedId = ticket.id;
        await loadDetail();
        renderDetail();
        renderTicketList();
      },
    });
  }

  function openNewCustomer() {
    openModal({
      title: t("newCustomer"),
      iconName: "user",
      submit: t("create"),
      body: `
        <div class="field"><label>${esc(t("fieldName"))}</label>
          <input name="name" required maxlength="200" autocomplete="off"></div>
        <div class="field"><label>${esc(t("fieldEmail"))}</label>
          <input name="email" type="email" required maxlength="320" autocomplete="off"></div>`,
      onSubmit: async (data) => {
        await api("/customers", {
          method: "POST",
          body: {
            name: String(data.get("name") || "").trim(),
            email: String(data.get("email") || "").trim(),
          },
        });
        toast(t("createdOk"));
        await refreshReferenceData();
        renderCustomers();
      },
    });
  }

  function openNewAgent() {
    openModal({
      title: t("newAgent"),
      iconName: "user",
      submit: t("create"),
      body: `
        <div class="field"><label>${esc(t("fieldName"))}</label>
          <input name="name" required maxlength="200" autocomplete="off"></div>
        <div class="field"><label>${esc(t("fieldEmail"))}</label>
          <input name="email" type="email" required maxlength="320" autocomplete="off"></div>
        <div class="field"><label>${esc(t("fieldRole"))}</label>
          <select name="role"><option value="agent">${esc(t("roleAgent"))}</option>
            <option value="admin">${esc(t("roleAdmin"))}</option></select></div>`,
      onSubmit: async (data) => {
        await api("/agents", {
          method: "POST",
          body: {
            name: String(data.get("name") || "").trim(),
            email: String(data.get("email") || "").trim(),
            role: data.get("role") || "agent",
          },
        });
        toast(t("createdOk"));
        await refreshReferenceData();
        renderTeam();
      },
    });
  }

  function openNewTag() {
    openModal({
      title: t("newTag"),
      iconName: "tag",
      submit: t("create"),
      body: `<div class="field"><label>${esc(t("fieldTagName"))}</label>
        <input name="name" required maxlength="100" autocomplete="off"></div>`,
      onSubmit: async (data) => {
        await api("/tags", { method: "POST", body: { name: String(data.get("name") || "").trim() } });
        toast(t("createdOk"));
        await refreshReferenceData();
        renderTeam();
      },
    });
  }

  function renderTagPicker() {
    const box = $("#tag-picker-body");
    if (!box || !state.detail) return;
    const current = new Set(state.detail.tags.map((tag) => tag.id));
    box.innerHTML = state.tags.length
      ? `<div class="tag-picker">${state.tags.map((tag) => `
          <button type="button" class="tag-option ${current.has(tag.id) ? "on" : ""}"
                  data-action="toggle-tag" data-id="${tag.id}">
            ${current.has(tag.id) ? icon("check") : icon("plus")}${esc(tag.name)}
          </button>`).join("")}</div>`
      : `<p class="muted">${esc(t("noTags"))}</p>`;
    mountIcons(box);
  }

  function openTagPicker() {
    if (!state.detail) return;
    openModal({
      title: t("tags"),
      iconName: "tag",
      body: `<div id="tag-picker-body"></div>`,
    });
    renderTagPicker();
  }

  // ── customers page ─────────────────────────────────────────────────────────
  function renderCustomers() {
    const body = $("#customers-body");
    body.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(t("customersTitle"))}</h1>
          <p>${esc(t("customersSub"))}</p>
        </div>
        <div class="grow">
          <div class="search" style="min-width:260px">
            ${icon("search")}
            <input id="customer-search" type="search" placeholder="${esc(t("searchCustomers"))}"
                   value="${esc(state.customerSearch || "")}">
          </div>
          <button class="btn primary sm" data-action="new-customer">${icon("plus")}${esc(t("newCustomer"))}</button>
        </div>
      </div>
      <div class="panel">
        <table>
          <thead><tr>
            <th>${esc(t("colName"))}</th><th>${esc(t("colEmail"))}</th><th>${esc(t("colCreated"))}</th><th></th>
          </tr></thead>
          <tbody id="customer-rows"></tbody>
        </table>
      </div>`;
    mountIcons(body);
    const search = $("#customer-search");
    search.addEventListener("input", debounce(() => {
      state.customerSearch = search.value;
      loadCustomers();
    }, 240));
    loadCustomers();
  }

  async function loadCustomers() {
    const rows = $("#customer-rows");
    if (!rows) return;
    try {
      const query = state.customerSearch ? `&search=${encodeURIComponent(state.customerSearch)}` : "";
      const data = await api(`/customers?limit=200${query}`);
      state.customers = data.items;
      rows.innerHTML = data.items.length
        ? data.items.map((customer) => `
            <tr class="clickable" data-action="customer-tickets" data-id="${customer.id}"
                data-name="${esc(customer.name)}" data-email="${esc(customer.email)}">
              <td><div class="who">${avatar(customer.name, "sm")}
                <strong>${esc(customer.name)}</strong></div></td>
              <td class="muted">${esc(customer.email)}</td>
              <td class="num">${esc(fmtDateTime(customer.created_at))}</td>
              <td style="text-align:right"><span class="btn sm ghost">${esc(t("viewTickets"))} →</span></td>
            </tr>`).join("")
        : `<tr><td colspan="4"><div class="empty">${icon("users")}<div>${esc(t("customersEmpty"))}</div></div></td></tr>`;
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
    }
  }

  // ── team page ──────────────────────────────────────────────────────────────
  async function renderTeam() {
    const body = $("#team-body");
    const isAdmin = state.identity?.role === "admin";
    let agents = [];
    try {
      agents = (await api("/agents")).items;
    } catch (error) {
      if (error.status === 401) return showGate();
    }
    state.agents = agents.map((agent) => ({ id: agent.id, name: agent.name, role: agent.role }));

    body.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(t("teamTitle"))}</h1>
          <p>${esc(t("teamSub"))}</p>
        </div>
      </div>
      <div class="panel">
        <header>${icon("users")}<h2>${esc(t("agentsTitle"))}</h2>
          <span class="spacer"></span>
          <span class="grow">${isAdmin
            ? `<button class="btn primary sm" data-action="new-agent">${icon("plus")}${esc(t("newAgent"))}</button>`
            : ""}</span>
        </header>
        <table>
          <thead><tr><th>${esc(t("colName"))}</th><th>${esc(t("colEmail"))}</th>
            <th>${esc(t("colRole"))}</th><th></th></tr></thead>
          <tbody>
            ${agents.map((agent) => `
              <tr>
                <td><div class="who">${avatar(agent.name, "sm")}<strong>${esc(agent.name)}</strong></div></td>
                <td class="muted">${esc(agent.email)}</td>
                <td><span class="pill ${agent.role === "admin" ? "ai" : "plain"}">${esc(agent.role === "admin" ? t("roleAdmin") : t("roleAgent"))}</span></td>
                <td class="muted" style="text-align:right">${agent.active ? esc(t("active")) : esc(t("inactive"))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <header>${icon("tag")}<h2>${esc(t("tagsTitle"))}</h2>
          <span class="spacer"></span>
          <span class="grow">${isAdmin
            ? `<button class="btn primary sm" data-action="new-tag">${icon("plus")}${esc(t("newTag"))}</button>`
            : ""}</span>
        </header>
        <div class="panel-body">
          <div class="tag-cloud">
            ${state.tags.length
              ? state.tags.map((tag) => `<span class="tag-chip">${esc(tag.name)}</span>`).join("")
              : `<span class="muted">${esc(t("noTags"))}</span>`}
          </div>
          <p class="help" style="margin-top:12px;font-size:11px">${esc(t("tagUsage"))}</p>
        </div>
      </div>`;
    mountIcons(body);
  }

  // ── audit page ─────────────────────────────────────────────────────────────
  async function renderAudit() {
    const body = $("#audit-body");
    if (state.identity?.role !== "admin") {
      body.innerHTML = `
        <div class="page-head"><div><h1>${esc(t("auditTitle"))}</h1>
          <p>${esc(t("auditSub"))}</p></div></div>
        <div class="panel"><div class="empty">${icon("shield")}<div>${esc(t("auditAdminOnly"))}</div></div></div>`;
      return;
    }
    body.innerHTML = `
      <div class="page-head">
        <div><h1>${esc(t("auditTitle"))}</h1><p>${esc(t("auditSub"))}</p></div>
        <div class="grow">
          <button class="btn sm" data-action="reload-audit">${icon("refresh")}${esc(t("refresh"))}</button>
        </div>
      </div>
      <div class="panel"><div id="audit-table"><div class="empty">${esc(t("loading"))}</div></div></div>`;
    mountIcons(body);
    try {
      const data = await api("/audit?limit=120");
      const table = $("#audit-table");
      if (!table) return;
      table.innerHTML = data.items.length
        ? `<table><thead><tr>
             <th>${esc(t("colTime"))}</th><th>${esc(t("colActor"))}</th>
             <th>${esc(t("colAction"))}</th><th>${esc(t("colEntity"))}</th><th>Metadata</th>
           </tr></thead>
           <tbody>${data.items.map((entry) => {
             const actor = state.agents.find((item) => item.id === entry.actor_id);
             const meta = JSON.stringify(entry.metadata || {});
             return `<tr>
               <td class="num">${esc(fmtDateTime(entry.created_at))}</td>
               <td>${esc(actor ? actor.name : "system")}</td>
               <td><span class="pill plain">${esc(eventLabel(entry.action))}</span></td>
               <td class="muted">${esc(entry.entity_type)} <code>${esc(String(entry.entity_id).slice(0, 8))}</code></td>
               <td class="meta"><code title="${esc(meta)}">${esc(meta)}</code></td>
             </tr>`;
           }).join("")}</tbody></table>`
        : `<div class="empty">${icon("shield")}<div>${esc(t("auditEmpty"))}</div></div>`;
    } catch (error) {
      if (error.status === 401) return showGate();
      toast(errorText(error), "error");
    }
  }

  // ── event wiring ───────────────────────────────────────────────────────────
  const actions = {
    "select-ticket": (el) => selectTicket(el.dataset.id),
    "filter-status": (el) => {
      state.filters.status = el.dataset.value;
      loadTickets();
      renderFilterControls();
    },
    "set-tab": (el) => { state.tab = el.dataset.value; renderDetail(); },
    "open-tag-picker": () => openTagPicker(),
    "toggle-tag": (el) => {
      const on = !el.classList.contains("on");
      toggleTag(el.dataset.id, on);
    },
    "remove-tag": (el) => toggleTag(el.dataset.id, false),
    "add-note": () => addNote(),
    "add-message": () => addMessage(),
    "ai-analyze": () => runAi("analyze"),
    "ai-draft": () => runAi("suggest-reply"),
    "apply-priority": (el) => applySuggestedPriority(el.dataset.value),
    "copy-draft": () => copyDraft(),
    "new-ticket": () => openNewTicket(),
    "new-customer": () => openNewCustomer(),
    "new-agent": () => openNewAgent(),
    "new-tag": () => openNewTag(),
    "reload-audit": () => renderAudit(),
    "close-modal": () => closeModal(),
    "backdrop-close": (el, event) => { if (event.target === el) closeModal(); },
    "pick-identity": (el) => pickIdentity(el.dataset.id),
    "switch-agent": () => showGate(),
    "toggle-lang": () => {
      state.lang = state.lang === "en" ? "zh" : "en";
      prefs.save();
      applyStaticI18n();
      renderRoute();
    },
    "toggle-theme": () => {
      state.theme = state.theme === "light" ? "dark" : "light";
      prefs.save();
      applyTheme();
    },
    "customer-tickets": (el) => {
      state.filters.search = el.dataset.email;
      state.filters.status = "all";
      if ($("#search-input")) $("#search-input").value = el.dataset.email;
      state.tickets = [];
      state.selectedId = null;
      navigate("inbox");
      loadTickets();
    },
  };

  const selects = {
    status: (el) => { const value = el.value; if (value) setStatus(value); },
    priority: (el) => setPriority(el.value),
    assignee: (el) => setAssignee(el.value),
  };

  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const handler = actions[el.dataset.action];
    if (!handler) return;
    // The modal backdrop also wraps the form, so clicks inside a modal resolve to
    // it: never preventDefault there or form submission dies with it.
    if (el.dataset.action !== "backdrop-close") event.preventDefault();
    handler(el, event);
  });

  document.addEventListener("change", (event) => {
    const el = event.target.closest("[data-select]");
    if (!el) return;
    const handler = selects[el.dataset.select];
    if (handler) handler(el);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      const search = $("#search-input");
      if (search && !$("#view-inbox").hidden) {
        event.preventDefault();
        search.focus();
      }
    }
  });

  $("#search-input").addEventListener("input", debounce((event) => {
    state.filters.search = event.target.value.trim();
    loadTickets();
  }, 260));

  $("#filter-priority").addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
    loadTickets();
  });
  $("#filter-assignee").addEventListener("change", (event) => {
    state.filters.assignee = event.target.value;
    loadTickets();
  });
  $("#filter-tag").addEventListener("change", (event) => {
    state.filters.tag = event.target.value;
    loadTickets();
  });

  $("#agent-card").addEventListener("click", () => showGate());
  $("#lang-toggle").addEventListener("click", () => actions["toggle-lang"]());
  $("#theme-toggle").addEventListener("click", () => actions["toggle-theme"]());
  $("#new-ticket-btn").addEventListener("click", () => openNewTicket());

  window.addEventListener("hashchange", () => {
    if ($("#app").hidden) return;
    routeFromHash();
  });

  boot();
})();
