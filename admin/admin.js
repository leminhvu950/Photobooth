"use strict";

const DATABASE = {
  name: "snapjoy-admin",
  version: 2,
  frames: "custom-frames",
  sessions: "sessions",
};

const STORAGE_KEYS = {
  preferences: "snapjoy-preferences-v1",
  settings: "snapjoy-app-settings-v1",
  credentials: "snapjoy-admin-auth-v1",
  authenticated: "snapjoy-admin-authenticated",
};

const DEFAULT_SETTINGS = {
  boothName: "SnapJoy Photobooth",
  pricePerSession: 0,
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  adminApp: document.querySelector("#adminApp"),
  authForm: document.querySelector("#authForm"),
  authEyebrow: document.querySelector("#authEyebrow"),
  authTitle: document.querySelector("#authTitle"),
  authDescription: document.querySelector("#authDescription"),
  authPasswordLabel: document.querySelector("#authPasswordLabel"),
  authPassword: document.querySelector("#authPassword"),
  authConfirmGroup: document.querySelector("#authConfirmGroup"),
  authPasswordConfirm: document.querySelector("#authPasswordConfirm"),
  authMessage: document.querySelector("#authMessage"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  logoutButton: document.querySelector("#logoutButton"),
  dashboardTotalSessions: document.querySelector("#dashboardTotalSessions"),
  dashboardRevenue: document.querySelector("#dashboardRevenue"),
  dashboardTodaySessions: document.querySelector("#dashboardTodaySessions"),
  dashboardTotalFrames: document.querySelector("#dashboardTotalFrames"),
  todayRevenue: document.querySelector("#todayRevenue"),
  activityChart: document.querySelector("#activityChart"),
  summaryBoothName: document.querySelector("#summaryBoothName"),
  summaryPrice: document.querySelector("#summaryPrice"),
  dashboardGreeting: document.querySelector("#dashboardGreeting"),
  recentSessionsBody: document.querySelector("#recentSessionsBody"),
  recentSessionsEmpty: document.querySelector("#recentSessionsEmpty"),
  sessionsTotal: document.querySelector("#sessionsTotal"),
  sessionsRevenue: document.querySelector("#sessionsRevenue"),
  sessionsUnpaid: document.querySelector("#sessionsUnpaid"),
  allSessionsBody: document.querySelector("#allSessionsBody"),
  allSessionsEmpty: document.querySelector("#allSessionsEmpty"),
  sessionStatusFilter: document.querySelector("#sessionStatusFilter"),
  clearSessionsButton: document.querySelector("#clearSessionsButton"),
  frameUploadForm: document.querySelector("#frameUploadForm"),
  customFrameName: document.querySelector("#customFrameName"),
  customFrameLayout: document.querySelector("#customFrameLayout"),
  customFrameFile: document.querySelector("#customFrameFile"),
  uploadDropzone: document.querySelector("#uploadDropzone"),
  adminFramePreview: document.querySelector("#adminFramePreview"),
  adminPreviewImage: document.querySelector("#adminPreviewImage"),
  previewDimensions: document.querySelector("#previewDimensions"),
  fileFeedback: document.querySelector("#fileFeedback"),
  saveFrameButton: document.querySelector("#saveFrameButton"),
  resetFormButton: document.querySelector("#resetFormButton"),
  adminFrameList: document.querySelector("#adminFrameList"),
  libraryCount: document.querySelector("#libraryCount"),
  focusUploadButton: document.querySelector("#focusUploadButton"),
  emptyUploadButton: document.querySelector("#emptyUploadButton"),
  uploadPanel: document.querySelector("#uploadPanel"),
  appSettingsForm: document.querySelector("#appSettingsForm"),
  boothNameInput: document.querySelector("#boothNameInput"),
  pricePerSessionInput: document.querySelector("#pricePerSessionInput"),
  changePasswordForm: document.querySelector("#changePasswordForm"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  confirmNewPasswordInput: document.querySelector("#confirmNewPasswordInput"),
  passwordMessage: document.querySelector("#passwordMessage"),
  toast: document.querySelector("#toast"),
};

const state = {
  frames: [],
  sessions: [],
  pendingFrame: null,
  settings: { ...DEFAULT_SETTINGS },
  setupMode: false,
  toastTimer: null,
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      return;
    }

    const request = indexedDB.open(DATABASE.name, DATABASE.version);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DATABASE.frames)) {
        database.createObjectStore(DATABASE.frames, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(DATABASE.sessions)) {
        const sessions = database.createObjectStore(DATABASE.sessions, { keyPath: "id" });
        sessions.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không thể mở dữ liệu SnapJoy."));
  });
}

async function getAllRecords(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error("Không thể đọc dữ liệu."));
    };
  });
}

async function putRecord(storeName, record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Không thể lưu dữ liệu."));
    };
  });
}

async function deleteRecord(storeName, id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Không thể xóa dữ liệu."));
    };
  });
}

async function clearStore(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Không thể xóa dữ liệu."));
    };
  });
}

function readJson(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPassword(password, salt) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

function readCredentials() {
  return readJson(STORAGE_KEYS.credentials, null);
}

function setAuthMessage(message, type = "error") {
  elements.authMessage.textContent = message;
  elements.authMessage.className = `form-message${message ? ` is-${type}` : ""}`;
}

function configureAuthScreen() {
  const credentials = readCredentials();
  state.setupMode = !credentials?.hash || !credentials?.salt;
  elements.authPassword.type = "password";
  elements.authPasswordConfirm.type = "password";
  elements.authConfirmGroup.hidden = !state.setupMode;
  elements.authPasswordConfirm.required = state.setupMode;
  elements.authPassword.autocomplete = state.setupMode ? "new-password" : "current-password";
  elements.authEyebrow.textContent = state.setupMode ? "Thiết lập lần đầu" : "Đăng nhập quản trị";
  elements.authTitle.textContent = state.setupMode ? "Tạo mật khẩu admin" : "Chào mừng trở lại";
  elements.authDescription.textContent = state.setupMode
    ? "Tạo mật khẩu tối thiểu 6 ký tự để bảo vệ dashboard trên thiết bị này."
    : "Nhập mật khẩu để mở dashboard SnapJoy.";
  elements.authPasswordLabel.textContent = state.setupMode ? "Mật khẩu mới" : "Mật khẩu";
  elements.authSubmitButton.textContent = state.setupMode ? "Tạo mật khẩu & tiếp tục" : "Đăng nhập";
  elements.authForm.reset();
  setAuthMessage("");
}

async function submitAuth(event) {
  event.preventDefault();
  const password = elements.authPassword.value;
  if (password.length < 6) {
    setAuthMessage("Mật khẩu phải có ít nhất 6 ký tự.");
    return;
  }

  elements.authSubmitButton.disabled = true;
  try {
    if (state.setupMode) {
      if (password !== elements.authPasswordConfirm.value) {
        setAuthMessage("Hai mật khẩu chưa trùng khớp.");
        return;
      }
      const salt = createSalt();
      writeJson(STORAGE_KEYS.credentials, { salt, hash: await hashPassword(password, salt), updatedAt: Date.now() });
    } else {
      const credentials = readCredentials();
      const hash = await hashPassword(password, credentials.salt);
      if (hash !== credentials.hash) {
        setAuthMessage("Mật khẩu không đúng. Vui lòng thử lại.");
        return;
      }
    }
    sessionStorage.setItem(STORAGE_KEYS.authenticated, "true");
    await unlockAdmin();
  } catch (error) {
    console.error(error);
    setAuthMessage("Không thể xác thực trên trình duyệt này.");
  } finally {
    elements.authSubmitButton.disabled = false;
  }
}

async function unlockAdmin() {
  elements.authScreen.hidden = true;
  elements.adminApp.hidden = false;
  await loadAdminData();
  showView("dashboard");
}

function logout() {
  sessionStorage.removeItem(STORAGE_KEYS.authenticated);
  elements.adminApp.hidden = true;
  elements.authScreen.hidden = false;
  configureAuthScreen();
  elements.authPassword.focus();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function layoutName(layout) {
  return { all: "Mọi bố cục", single: "1 ảnh", strip: "Dải 3 ảnh", grid: "Lưới 4 ảnh" }[layout] || "1 ảnh";
}

function paymentLabel(status) {
  return { received: "Đã thu", pending: "Chưa thu", free: "Miễn phí" }[status] || "Chưa thu";
}

function isToday(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function receivedRevenue(sessions = state.sessions) {
  return sessions.filter((session) => session.paymentStatus === "received").reduce((sum, session) => sum + (Number(session.amount) || 0), 0);
}

function createStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${status || "pending"}`;
  badge.textContent = paymentLabel(status);
  return badge;
}

function createSessionRow(session, editable = false) {
  const row = document.createElement("tr");
  if (editable) {
    const code = document.createElement("td");
    code.className = "session-code";
    code.textContent = `#${session.id.slice(-8).toUpperCase()}`;
    row.append(code);
  }

  const time = document.createElement("td");
  time.textContent = formatDateTime(session.createdAt);
  const layout = document.createElement("td");
  layout.textContent = layoutName(session.layout);
  const frame = document.createElement("td");
  frame.textContent = session.frameName || "Tối giản";
  row.append(time, layout, frame);

  if (editable) {
    const photos = document.createElement("td");
    photos.textContent = String(session.photoCount || 1);
    row.append(photos);
  }

  const status = document.createElement("td");
  if (editable) {
    const select = document.createElement("select");
    select.className = "payment-select";
    [
      ["received", "Đã thu"],
      ["pending", "Chưa thu"],
      ["free", "Miễn phí"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = session.paymentStatus === value;
      select.append(option);
    });
    select.addEventListener("change", () => updatePaymentStatus(session, select.value));
    status.append(select);
  } else {
    status.append(createStatusBadge(session.paymentStatus));
  }

  const amount = document.createElement("td");
  amount.className = "amount";
  amount.textContent = session.paymentStatus === "free" ? "0 ₫" : formatCurrency(session.amount);
  row.append(status, amount);
  return row;
}

function renderDashboard() {
  const today = state.sessions.filter((session) => isToday(session.createdAt));
  elements.dashboardTotalSessions.textContent = String(state.sessions.length);
  elements.dashboardRevenue.textContent = formatCurrency(receivedRevenue());
  elements.dashboardTodaySessions.textContent = String(today.length);
  elements.todayRevenue.textContent = `${formatCurrency(receivedRevenue(today))} doanh thu`;
  elements.dashboardTotalFrames.textContent = String(state.frames.length);
  elements.summaryBoothName.textContent = state.settings.boothName;
  elements.summaryPrice.textContent = formatCurrency(state.settings.pricePerSession);
  elements.dashboardGreeting.textContent = state.settings.boothName || DEFAULT_SETTINGS.boothName;
  renderActivityChart();
  renderRecentSessions();
}

function renderActivityChart() {
  elements.activityChart.replaceChildren();
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const count = state.sessions.filter((session) => session.createdAt >= date.getTime() && session.createdAt < next.getTime()).length;
    days.push({ date, count });
  }
  const maximum = Math.max(1, ...days.map((day) => day.count));
  days.forEach((day) => {
    const column = document.createElement("div");
    column.className = "chart-column";
    const value = document.createElement("strong");
    value.textContent = String(day.count);
    const bar = document.createElement("span");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(4, (day.count / maximum) * 125)}px`;
    const label = document.createElement("small");
    label.textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit" }).format(day.date);
    column.append(value, bar, label);
    elements.activityChart.append(column);
  });
}

function renderRecentSessions() {
  elements.recentSessionsBody.replaceChildren();
  state.sessions.slice(0, 5).forEach((session) => elements.recentSessionsBody.append(createSessionRow(session, false)));
  elements.recentSessionsEmpty.hidden = state.sessions.length > 0;
}

function renderSessions() {
  elements.sessionsTotal.textContent = String(state.sessions.length);
  elements.sessionsRevenue.textContent = formatCurrency(receivedRevenue());
  elements.sessionsUnpaid.textContent = String(state.sessions.filter((session) => session.paymentStatus === "pending").length);
  const filter = elements.sessionStatusFilter.value;
  const visible = filter === "all" ? state.sessions : state.sessions.filter((session) => session.paymentStatus === filter);
  elements.allSessionsBody.replaceChildren();
  visible.forEach((session) => elements.allSessionsBody.append(createSessionRow(session, true)));
  elements.allSessionsEmpty.hidden = visible.length > 0;
}

async function updatePaymentStatus(session, paymentStatus) {
  session.paymentStatus = paymentStatus;
  try {
    await putRecord(DATABASE.sessions, session);
    renderDashboard();
    renderSessions();
    showToast("Đã cập nhật trạng thái thanh toán.");
  } catch (error) {
    console.error(error);
    showToast("Không thể cập nhật lượt chụp.");
  }
}

async function clearSessions() {
  if (!state.sessions.length) return;
  if (!window.confirm("Xóa toàn bộ lịch sử lượt chụp và doanh thu? Thao tác này không thể hoàn tác.")) return;
  try {
    await clearStore(DATABASE.sessions);
    state.sessions = [];
    renderDashboard();
    renderSessions();
    showToast("Đã xóa toàn bộ lịch sử lượt chụp.");
  } catch (error) {
    console.error(error);
    showToast("Không thể xóa lịch sử.");
  }
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function renderFrames() {
  elements.adminFrameList.replaceChildren();
  elements.libraryCount.textContent = `${state.frames.length} frame`;
  state.frames.forEach((frame) => {
    const item = document.createElement("article");
    item.className = "frame-item";
    const thumbnail = document.createElement("span");
    thumbnail.className = "frame-thumb";
    const image = document.createElement("img");
    image.src = frame.dataUrl;
    image.alt = "";
    thumbnail.append(image);
    const body = document.createElement("div");
    body.className = "frame-item-body";
    const name = document.createElement("strong");
    name.textContent = frame.name;
    const meta = document.createElement("small");
    meta.textContent = `${layoutName(frame.layout)} · ${frame.width}×${frame.height}px`;
    const actions = document.createElement("div");
    actions.className = "frame-item-actions";
    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "use-frame-button";
    useButton.textContent = "Chọn & mở booth";
    useButton.addEventListener("click", () => useFrame(frame));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-frame-button";
    deleteButton.textContent = "×";
    deleteButton.title = "Xóa frame";
    deleteButton.setAttribute("aria-label", `Xóa frame ${frame.name}`);
    deleteButton.addEventListener("click", () => removeFrame(frame));
    actions.append(useButton, deleteButton);
    body.append(name, meta, actions);
    item.append(thumbnail, body);
    elements.adminFrameList.append(item);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Không thể đọc file."));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("File ảnh không hợp lệ."));
    image.src = dataUrl;
  });
}

function ratioWarning(width, height, layout) {
  const ratios = { single: 1500 / 1000, strip: 800 / 2400, grid: 1100 / 1650 };
  if (layout === "all" || !ratios[layout]) return "";
  return Math.abs(width / height - ratios[layout]) > 0.04
    ? `Tỷ lệ file chưa khớp với ${layoutName(layout)}; frame có thể bị kéo giãn.`
    : "";
}

function setFileFeedback(message, type = "") {
  elements.fileFeedback.textContent = message;
  elements.fileFeedback.className = "file-feedback";
  if (type) elements.fileFeedback.classList.add(`is-${type}`);
}

function clearFilePreview() {
  state.pendingFrame = null;
  elements.adminPreviewImage.removeAttribute("src");
  elements.adminFramePreview.classList.remove("has-image");
  elements.previewDimensions.textContent = "";
  setFileFeedback("");
}

async function prepareFrameFile(file) {
  clearFilePreview();
  if (!file) return;

  // Cập nhật tỷ lệ khung preview dựa trên layout đã chọn
  elements.adminFramePreview.parentElement.classList.remove("preview-single", "preview-strip", "preview-grid", "preview-all");
  elements.adminFramePreview.parentElement.classList.add(`preview-${elements.customFrameLayout.value}`);

  if (!["image/png", "image/webp"].includes(file.type)) {
    setFileFeedback("Chỉ chấp nhận file PNG hoặc WebP.", "error");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setFileFeedback("File lớn hơn 8 MB. Hãy giảm kích thước rồi thử lại.", "error");
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await getImageDimensions(dataUrl);
    state.pendingFrame = { dataUrl, ...dimensions };
    elements.adminPreviewImage.src = dataUrl;
    elements.adminFramePreview.classList.add("has-image");
    elements.previewDimensions.textContent = `${dimensions.width} × ${dimensions.height}px`;
    const warning = ratioWarning(dimensions.width, dimensions.height, elements.customFrameLayout.value);
    setFileFeedback(warning || `${file.name} · ${formatBytes(file.size)}`, warning ? "warning" : "");
  } catch (error) {
    setFileFeedback(error.message, "error");
  }
}

function resetFrameForm() {
  elements.frameUploadForm.reset();
  clearFilePreview();
  elements.customFrameName.focus();
}

async function saveFrame(event) {
  event.preventDefault();
  const name = elements.customFrameName.value.trim();
  if (!name || !state.pendingFrame) {
    setFileFeedback("Hãy nhập tên và chọn file frame trước khi lưu.", "error");
    return;
  }
  const frame = {
    id: window.crypto?.randomUUID?.() || `frame-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    layout: elements.customFrameLayout.value,
    dataUrl: state.pendingFrame.dataUrl,
    width: state.pendingFrame.width,
    height: state.pendingFrame.height,
    createdAt: Date.now(),
  };
  elements.saveFrameButton.disabled = true;
  elements.saveFrameButton.textContent = "Đang lưu…";
  try {
    await putRecord(DATABASE.frames, frame);
    state.frames.unshift(frame);
    renderFrames();
    renderDashboard();
    resetFrameForm();
    showToast(`Đã thêm frame “${frame.name}”.`);
  } catch (error) {
    console.error(error);
    setFileFeedback("Không thể lưu frame. Bộ nhớ trình duyệt có thể đã đầy.", "error");
  } finally {
    elements.saveFrameButton.disabled = false;
    elements.saveFrameButton.textContent = "Lưu vào thư viện";
  }
}

async function removeFrame(frame) {
  if (!window.confirm(`Xóa frame “${frame.name}” khỏi thiết bị này?`)) return;
  try {
    await deleteRecord(DATABASE.frames, frame.id);
    state.frames = state.frames.filter((item) => item.id !== frame.id);
    const preferences = readJson(STORAGE_KEYS.preferences, {});
    if (preferences.customFrameId === frame.id) {
      preferences.customFrameId = null;
      preferences.frameStyle = "minimal";
      writeJson(STORAGE_KEYS.preferences, preferences);
    }
    renderFrames();
    renderDashboard();
    showToast("Đã xóa frame khỏi thiết bị.");
  } catch (error) {
    console.error(error);
    showToast("Không thể xóa frame.");
  }
}

function useFrame(frame) {
  const preferences = readJson(STORAGE_KEYS.preferences, {});
  preferences.customFrameId = frame.id;
  if (frame.layout !== "all") preferences.layout = frame.layout;
  writeJson(STORAGE_KEYS.preferences, preferences);
  window.location.href = "../";
}

function loadSettings() {
  state.settings = { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEYS.settings, {}) };
  state.settings.pricePerSession = Math.max(0, Number(state.settings.pricePerSession) || 0);
  elements.boothNameInput.value = state.settings.boothName;
  elements.pricePerSessionInput.value = String(state.settings.pricePerSession);
}

function saveAppSettings(event) {
  event.preventDefault();
  state.settings = {
    boothName: elements.boothNameInput.value.trim() || DEFAULT_SETTINGS.boothName,
    pricePerSession: Math.max(0, Number(elements.pricePerSessionInput.value) || 0),
  };
  writeJson(STORAGE_KEYS.settings, state.settings);
  renderDashboard();
  showToast("Đã lưu cài đặt phần mềm.");
}

function setPasswordMessage(message, type = "error") {
  elements.passwordMessage.textContent = message;
  elements.passwordMessage.className = `form-message${message ? ` is-${type}` : ""}`;
}

async function changePassword(event) {
  event.preventDefault();
  const current = elements.currentPasswordInput.value;
  const next = elements.newPasswordInput.value;
  const confirm = elements.confirmNewPasswordInput.value;
  if (next.length < 6) {
    setPasswordMessage("Mật khẩu mới phải có ít nhất 6 ký tự.");
    return;
  }
  if (next !== confirm) {
    setPasswordMessage("Hai mật khẩu mới chưa trùng khớp.");
    return;
  }
  try {
    const credentials = readCredentials();
    if ((await hashPassword(current, credentials.salt)) !== credentials.hash) {
      setPasswordMessage("Mật khẩu hiện tại không đúng.");
      return;
    }
    const salt = createSalt();
    writeJson(STORAGE_KEYS.credentials, { salt, hash: await hashPassword(next, salt), updatedAt: Date.now() });
    elements.changePasswordForm.reset();
    elements.currentPasswordInput.type = "password";
    elements.newPasswordInput.type = "password";
    elements.confirmNewPasswordInput.type = "password";
    setPasswordMessage("Đã cập nhật mật khẩu admin.", "success");
  } catch (error) {
    console.error(error);
    setPasswordMessage("Không thể cập nhật mật khẩu.");
  }
}

function showView(name) {
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminView === name));
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const active = panel.dataset.viewPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function focusUpload() {
  showView("frames");
  window.setTimeout(() => {
    elements.uploadPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.customFrameName.focus();
  }, 150);
}

async function loadAdminData() {
  loadSettings();
  try {
    const [frames, sessions] = await Promise.all([getAllRecords(DATABASE.frames), getAllRecords(DATABASE.sessions)]);
    state.frames = frames.sort((a, b) => b.createdAt - a.createdAt);
    state.sessions = sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error(error);
    showToast("Không thể tải đầy đủ dữ liệu quản trị.");
  }
  renderFrames();
  renderDashboard();
  renderSessions();
}

function togglePassword(button) {
  const input = document.querySelector(`#${button.dataset.togglePassword}`);
  if (!input) return;
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.setAttribute("aria-label", visible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function bindEvents() {
  elements.authForm.addEventListener("submit", submitAuth);
  elements.logoutButton.addEventListener("click", logout);
  document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => togglePassword(button)));
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.adminView)));
  document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.openView)));
  elements.sessionStatusFilter.addEventListener("change", renderSessions);
  elements.clearSessionsButton.addEventListener("click", clearSessions);
  elements.frameUploadForm.addEventListener("submit", saveFrame);
  elements.resetFormButton.addEventListener("click", resetFrameForm);
  elements.customFrameFile.addEventListener("change", (event) => prepareFrameFile(event.target.files[0]));
  elements.customFrameLayout.addEventListener("change", () => {
    // Cập nhật tỷ lệ khung preview khi đổi layout
    elements.adminFramePreview.parentElement.classList.remove("preview-single", "preview-strip", "preview-grid", "preview-all");
    elements.adminFramePreview.parentElement.classList.add(`preview-${elements.customFrameLayout.value}`);

    if (!state.pendingFrame) return;
    const warning = ratioWarning(state.pendingFrame.width, state.pendingFrame.height, elements.customFrameLayout.value);
    setFileFeedback(warning || `Kích thước ${state.pendingFrame.width}×${state.pendingFrame.height}px phù hợp.`, warning ? "warning" : "");
  });
  elements.focusUploadButton.addEventListener("click", focusUpload);
  elements.emptyUploadButton.addEventListener("click", focusUpload);
  elements.appSettingsForm.addEventListener("submit", saveAppSettings);
  elements.changePasswordForm.addEventListener("submit", changePassword);

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.uploadDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadDropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    elements.uploadDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadDropzone.classList.remove("is-dragging");
    });
  });
  elements.uploadDropzone.addEventListener("drop", (event) => prepareFrameFile(event.dataTransfer.files[0]));
}

async function initialize() {
  bindEvents();
  const credentials = readCredentials();
  if (credentials && sessionStorage.getItem(STORAGE_KEYS.authenticated) === "true") {
    await unlockAdmin();
  } else {
    configureAuthScreen();
    elements.authPassword.focus();
  }
}

initialize();
