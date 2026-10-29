"use strict";

// Địa chỉ máy chủ chia sẻ QR khi web chạy tách rời khỏi máy chủ đó.
// Đang trỏ tới service Render của photobooth khi chạy trên GitHub Pages.
// Để trống "" khi photobooth và máy chủ chia sẻ chạy cùng origin (npm start).
const SHARE_API_BASE = "https://photobooth-9hn6.onrender.com";

function shareApiUrl(path) {
  return SHARE_API_BASE ? `${SHARE_API_BASE}${path}` : path;
}

const LAYOUTS = {
  single: { label: "1 ảnh", count: 1 },
  strip: { label: "Dải 3 ảnh", count: 3 },
  grid: { label: "Lưới 4 ảnh", count: 4 },
};

const FILTERS = {
  normal: "none",
  warm: "sepia(0.18) saturate(1.22) contrast(1.03)",
  mono: "grayscale(1) contrast(1.12)",
  dream: "brightness(1.08) saturate(0.8) contrast(0.92)",
};

const FRAME_STYLES = ["minimal", "film", "love", "party"];

const FRAME_NAMES = {
  minimal: "Tối giản",
  film: "Cuộn film",
  love: "Tình yêu",
  party: "Lễ hội",
};

const FRAME_DATABASE = {
  name: "snapjoy-admin",
  version: 2,
  store: "custom-frames",
  sessionsStore: "sessions",
};

const STORAGE_KEY = "snapjoy-preferences-v1";
const APP_SETTINGS_KEY = "snapjoy-app-settings-v1";
const DEFAULT_APP_SETTINGS = {
  boothName: "SnapJoy Photobooth",
  pricePerSession: 0,
};

const elements = {
  booth: document.querySelector(".booth"),
  intro: document.querySelector(".intro"),
  boothBrandName: document.querySelector("#boothBrandName"),
  boothFooterName: document.querySelector("#boothFooterName"),
  layoutStep: document.querySelector("#layoutStep"),
  frameStep: document.querySelector("#frameStep"),
  captureStep: document.querySelector("#captureStep"),
  selectedLayoutLabel: document.querySelector("#selectedLayoutLabel"),
  continueToFrameButton: document.querySelector("#continueToFrameButton"),
  backToLayoutButton: document.querySelector("#backToLayoutButton"),
  frameLayoutContext: document.querySelector("#frameLayoutContext"),
  builtInFrameGallery: document.querySelector("#builtInFrameGallery"),
  customFrameGallery: document.querySelector("#customFrameGallery"),
  selectedFrameLabel: document.querySelector("#selectedFrameLabel"),
  continueToCaptureButton: document.querySelector("#continueToCaptureButton"),
  changeLayoutButton: document.querySelector("#changeLayoutButton"),
  changeFrameButton: document.querySelector("#changeFrameButton"),
  captureLayoutPreview: document.querySelector("#captureLayoutPreview"),
  captureLayoutName: document.querySelector("#captureLayoutName"),
  captureLayoutMeta: document.querySelector("#captureLayoutMeta"),
  captureFrameName: document.querySelector("#captureFrameName"),
  captureFrameMeta: document.querySelector("#captureFrameMeta"),
  selectedFrameMini: document.querySelector("#selectedFrameMini"),
  cameraStage: document.querySelector("#cameraStage"),
  video: document.querySelector("#cameraVideo"),
  welcomeOverlay: document.querySelector("#welcomeOverlay"),
  startButton: document.querySelector("#startButton"),
  cameraStatus: document.querySelector("#cameraStatus"),
  cameraStatusText: document.querySelector("#cameraStatusText"),
  cameraSelect: document.querySelector("#cameraSelect"),
  cameraError: document.querySelector("#cameraError"),
  cameraErrorText: document.querySelector("#cameraErrorText"),
  retryCameraButton: document.querySelector("#retryCameraButton"),
  mirrorButton: document.querySelector("#mirrorButton"),
  countdown: document.querySelector("#countdown"),
  flash: document.querySelector("#flash"),
  recordingIndicator: document.querySelector("#recordingIndicator"),
  poseStatus: document.querySelector("#poseStatus"),
  poseStatusText: document.querySelector("#poseStatusText"),
  poseProgress: document.querySelector("#poseProgress"),
  layoutLabel: document.querySelector("#layoutLabel"),
  frameColor: document.querySelector("#frameColor"),
  captureButton: document.querySelector("#captureButton"),
  captureHint: document.querySelector("#captureHint"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  resultView: document.querySelector("#resultView"),
  resultCanvas: document.querySelector("#resultCanvas"),
  poseVideoCard: document.querySelector("#poseVideoCard"),
  poseVideoPreview: document.querySelector("#poseVideoPreview"),
  downloadButton: document.querySelector("#downloadButton"),
  downloadVideoButton: document.querySelector("#downloadVideoButton"),
  qrShareButton: document.querySelector("#qrShareButton"),
  qrShareButtonLabel: document.querySelector("#qrShareButtonLabel"),
  qrSharePanel: document.querySelector("#qrSharePanel"),
  qrCodeImage: document.querySelector("#qrCodeImage"),
  qrDownloadLink: document.querySelector("#qrDownloadLink"),
  qrExpiryText: document.querySelector("#qrExpiryText"),
  shareButton: document.querySelector("#shareButton"),
  printButton: document.querySelector("#printButton"),
  retakeButton: document.querySelector("#retakeButton"),
  printImage: document.querySelector("#printImage"),
  toast: document.querySelector("#toast"),
  brand: document.querySelector(".brand"),
};

const state = {
  stream: null,
  layout: "single",
  timer: 3,
  filter: "normal",
  frameStyle: "minimal",
  customFrameId: null,
  customFrames: [],
  frameColor: "#fffaf3",
  mirrored: true,
  busy: false,
  cancelled: false,
  photos: [],
  mediaRecorder: null,
  recordedVideoChunks: [],
  poseVideoBlob: null,
  poseVideoUrl: null,
  localSharingConfig: null,
  sessionRecorded: false,
  appSettings: { ...DEFAULT_APP_SETTINGS },
  toastTimer: null,
};

function loadPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return;

    if (LAYOUTS[stored.layout]) state.layout = stored.layout;
    if ([3, 5, 10].includes(Number(stored.timer))) state.timer = Number(stored.timer);
    if (FILTERS[stored.filter]) state.filter = stored.filter;
    if (FRAME_STYLES.includes(stored.frameStyle)) state.frameStyle = stored.frameStyle;
    if (typeof stored.customFrameId === "string") state.customFrameId = stored.customFrameId;
    if (/^#[0-9a-f]{6}$/i.test(stored.frameColor)) state.frameColor = stored.frameColor;
    if (typeof stored.mirrored === "boolean") state.mirrored = stored.mirrored;
  } catch {
    // localStorage có thể bị chặn ở chế độ riêng tư; ứng dụng vẫn hoạt động bình thường.
  }
}

function savePreferences() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layout: state.layout,
        timer: state.timer,
        filter: state.filter,
        frameStyle: state.frameStyle,
        customFrameId: state.customFrameId,
        frameColor: state.frameColor,
        mirrored: state.mirrored,
      }),
    );
  } catch {
    // Không bắt buộc phải lưu tùy chọn để chụp ảnh.
  }
}

function layoutName(layout) {
  return {
    all: "Mọi bố cục",
    single: "1 ảnh",
    strip: "Dải 3 ảnh",
    grid: "Lưới 4 ảnh",
  }[layout] || "Mọi bố cục";
}

function getSelectedCustomFrame() {
  return state.customFrames.find((frame) => frame.id === state.customFrameId) || null;
}

function openFrameDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Trình duyệt không hỗ trợ lưu khung cục bộ."));
      return;
    }

    const request = indexedDB.open(FRAME_DATABASE.name, FRAME_DATABASE.version);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FRAME_DATABASE.store)) {
        database.createObjectStore(FRAME_DATABASE.store, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FRAME_DATABASE.sessionsStore)) {
        const sessions = database.createObjectStore(FRAME_DATABASE.sessionsStore, { keyPath: "id" });
        sessions.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không thể mở thư viện khung."));
  });
}

async function readCustomFrames() {
  const database = await openFrameDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FRAME_DATABASE.store, "readonly");
    const request = transaction.objectStore(FRAME_DATABASE.store).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error("Không thể đọc thư viện khung."));
    };
  });
}

async function storeCaptureSession(session) {
  const database = await openFrameDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FRAME_DATABASE.sessionsStore, "readwrite");
    transaction.objectStore(FRAME_DATABASE.sessionsStore).put(session);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Không thể ghi nhận lượt chụp."));
    };
  });
}

function readAppSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY));
    const settings = stored && typeof stored === "object" ? stored : {};
    return {
      boothName: String(settings.boothName || DEFAULT_APP_SETTINGS.boothName).trim() || DEFAULT_APP_SETTINGS.boothName,
      pricePerSession: Math.max(0, Number(settings.pricePerSession) || 0),
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function shortBoothName(name) {
  return name.replace(/\s+photobooth$/i, "").trim() || name;
}

function applyAppSettings() {
  state.appSettings = readAppSettings();
  elements.boothBrandName.textContent = shortBoothName(state.appSettings.boothName);
  elements.boothFooterName.textContent = state.appSettings.boothName;
  document.title = state.appSettings.boothName;
}

async function recordCompletedSession() {
  if (state.sessionRecorded) return;
  state.sessionRecorded = true;
  const customFrame = getSelectedCustomFrame();
  const settings = readAppSettings();
  const amount = Math.max(0, Number(settings.pricePerSession) || 0);

  await storeCaptureSession({
    id: window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    layout: state.layout,
    photoCount: LAYOUTS[state.layout].count,
    frameId: customFrame?.id || null,
    frameName: customFrame?.name || FRAME_NAMES[state.frameStyle] || FRAME_NAMES.minimal,
    amount,
    paymentStatus: amount > 0 ? "received" : "free",
  });
}

function makeFramePreview(frame) {
  const preview = document.createElement("span");
  preview.className = "gallery-frame-preview";
  const photo = document.createElement("span");
  photo.className = "gallery-photo";
  const image = document.createElement("img");
  image.className = "custom-frame-art";
  image.src = frame.dataUrl;
  image.alt = "";
  preview.append(photo, image);
  return preview;
}

function renderCustomFrameGallery() {
  elements.customFrameGallery.replaceChildren();

  state.customFrames
    .filter((frame) => frame.layout === "all" || frame.layout === state.layout)
    .forEach((frame) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frame-card";
    button.dataset.customFrameId = frame.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");

    const info = document.createElement("span");
    info.className = "frame-card-info";
    const name = document.createElement("strong");
    name.textContent = frame.name;
    const meta = document.createElement("small");
    meta.textContent = `Khung riêng · ${layoutName(frame.layout)}`;
    info.append(name, meta);

    const check = document.createElement("span");
    check.className = "frame-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    button.append(makeFramePreview(frame), info, check);
    elements.customFrameGallery.append(button);
  });
}

function renderFrameLibraries() {
  renderCustomFrameGallery();
  syncControls();
}

async function loadCustomFrames() {
  try {
    state.customFrames = await readCustomFrames();
    if (state.customFrameId && !getSelectedCustomFrame()) state.customFrameId = null;
    const selectedFrame = getSelectedCustomFrame();
    if (selectedFrame && selectedFrame.layout !== "all" && selectedFrame.layout !== state.layout) {
      state.customFrameId = null;
    }
  } catch (error) {
    console.error(error);
    state.customFrames = [];
    state.customFrameId = null;
    showToast("Không thể mở thư viện khung trên thiết bị này.");
  }
  renderFrameLibraries();
}

function selectBuiltInFrame(style) {
  if (!FRAME_STYLES.includes(style)) return;
  state.frameStyle = style;
  state.customFrameId = null;
  savePreferences();
  syncControls();
}

function selectCustomFrame(id) {
  const frame = state.customFrames.find((item) => item.id === id);
  if (!frame) return;
  state.customFrameId = frame.id;
  if (frame.layout !== "all") state.layout = frame.layout;
  savePreferences();
  syncControls();
}

function syncControls() {
  document.querySelectorAll("[data-layout]").forEach((button) => {
    const selected = button.dataset.layout === state.layout;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  document.querySelectorAll("[data-timer]").forEach((button) => {
    const selected = Number(button.dataset.timer) === state.timer;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = button.dataset.filter === state.filter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  document.querySelectorAll("[data-frame-style]").forEach((button) => {
    const selected = button.dataset.frameStyle === state.frameStyle;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  document.querySelectorAll("[data-frame-choice]").forEach((button) => {
    const selected = !state.customFrameId && button.dataset.frameChoice === state.frameStyle;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  document.querySelectorAll("[data-custom-frame-id]").forEach((button) => {
    const selected = button.dataset.customFrameId === state.customFrameId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  let hasPresetFrame = false;
  document.querySelectorAll("[data-color]").forEach((button) => {
    const selected = button.dataset.color.toLowerCase() === state.frameColor.toLowerCase();
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    hasPresetFrame ||= selected;
  });
  elements.frameColor.value = state.frameColor;
  elements.frameColor.setAttribute("aria-checked", String(!hasPresetFrame));

  elements.layoutLabel.textContent = LAYOUTS[state.layout].label;
  elements.selectedLayoutLabel.textContent = LAYOUTS[state.layout].label;
  elements.frameLayoutContext.textContent = LAYOUTS[state.layout].label;
  elements.captureLayoutName.textContent = LAYOUTS[state.layout].label;
  elements.captureLayoutMeta.textContent = {
    single: "1 lần chụp · tỷ lệ 4:5",
    strip: "3 lần chụp · tỷ lệ 1:2",
    grid: "4 lần chụp · tỷ lệ 3:4",
  }[state.layout];
  elements.captureLayoutPreview.className = `layout-preview layout-${state.layout}`;
  elements.captureLayoutPreview.replaceChildren(
    ...Array.from({ length: LAYOUTS[state.layout].count }, () => document.createElement("i")),
  );
  elements.captureHint.textContent = `${LAYOUTS[state.layout].count} ảnh · đếm ngược ${state.timer} giây`;
  elements.video.style.filter = FILTERS[state.filter];
  elements.video.classList.toggle("is-unmirrored", !state.mirrored);
  elements.mirrorButton.setAttribute("aria-pressed", String(state.mirrored));

  const customFrame = getSelectedCustomFrame();
  const frameName = customFrame?.name || FRAME_NAMES[state.frameStyle] || FRAME_NAMES.minimal;
  elements.selectedFrameLabel.textContent = frameName;
  elements.captureFrameName.textContent = frameName;
  elements.captureFrameMeta.textContent = customFrame
    ? `Khung tùy chỉnh · ${layoutName(customFrame.layout)}`
    : "Khung có sẵn · Mọi bố cục";

  elements.selectedFrameMini.className = "selected-frame-mini";
  elements.selectedFrameMini.style.removeProperty("--custom-frame-image");
  if (customFrame) {
    elements.selectedFrameMini.classList.add("is-custom");
    elements.selectedFrameMini.style.setProperty("--custom-frame-image", `url(${JSON.stringify(customFrame.dataUrl)})`);
  } else {
    elements.selectedFrameMini.classList.add(`gallery-${state.frameStyle}`);
  }

  document.querySelectorAll("[data-layout]").forEach((button) => {
    if (!state.busy) button.disabled = false;
  });
}

function setCameraStatus(isLive, text) {
  elements.cameraStatus.classList.toggle("is-live", isLive);
  elements.cameraStatusText.textContent = text;
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  elements.video.srcObject = null;
  elements.video.classList.remove("is-live");
  elements.cameraStage.classList.remove("is-live");
  elements.welcomeOverlay.classList.remove("is-hidden");
  elements.captureButton.disabled = true;
  setCameraStatus(false, "Chưa kết nối");
}

async function startCamera(deviceId = "") {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError(
      "Trình duyệt này không hỗ trợ camera. Hãy mở ứng dụng bằng Chrome, Edge hoặc Safari qua HTTPS/localhost.",
    );
    return;
  }

  elements.startButton.disabled = true;
  elements.retryCameraButton.disabled = true;
  elements.cameraError.classList.remove("is-visible");
  stopCamera();
  setCameraStatus(false, "Đang kết nối…");

  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1440 },
    aspectRatio: { ideal: 4 / 3 },
  };

  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
  } else {
    videoConstraints.facingMode = "user";
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    elements.video.srcObject = state.stream;
    await elements.video.play();

    elements.welcomeOverlay.classList.add("is-hidden");
    elements.video.classList.add("is-live");
    elements.cameraStage.classList.add("is-live");
    elements.captureButton.disabled = false;
    setCameraStatus(true, "Camera đang hoạt động");
    await updateCameraList();
  } catch (error) {
    stopCamera();
    showCameraError(cameraErrorMessage(error));
  } finally {
    elements.startButton.disabled = false;
    elements.retryCameraButton.disabled = false;
  }
}

function cameraErrorMessage(error) {
  const messages = {
    NotAllowedError: "Bạn chưa cấp quyền camera. Hãy cho phép camera trong cài đặt của trình duyệt rồi thử lại.",
    NotFoundError: "Không tìm thấy camera trên thiết bị này. Hãy kết nối camera rồi thử lại.",
    NotReadableError: "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.",
    OverconstrainedError: "Camera được chọn không hỗ trợ cấu hình này. Hãy chọn camera khác.",
    SecurityError: "Camera chỉ hoạt động trên HTTPS hoặc localhost. Hãy chạy ứng dụng qua một máy chủ cục bộ.",
  };
  return messages[error?.name] || "Không thể mở camera. Hãy kiểm tra kết nối và quyền truy cập rồi thử lại.";
}

function showCameraError(message) {
  elements.cameraErrorText.textContent = message;
  elements.cameraError.classList.add("is-visible");
  elements.welcomeOverlay.classList.add("is-hidden");
  setCameraStatus(false, "Lỗi camera");
}

async function updateCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentTrack = state.stream?.getVideoTracks()[0];
    const currentId = currentTrack?.getSettings().deviceId || "";

    elements.cameraSelect.replaceChildren();
    cameras.forEach((camera, index) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      option.selected = camera.deviceId === currentId;
      elements.cameraSelect.append(option);
    });

    if (!cameras.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Camera mặc định";
      elements.cameraSelect.append(option);
    }
  } catch {
    // Không ảnh hưởng đến camera đang hoạt động.
  }
}

function setChoice(selector, callback) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", () => {
      if (state.busy) return;
      callback(button);
      syncControls();
      savePreferences();
    });
  });
}

function setCaptureControlsDisabled(disabled) {
  document.querySelectorAll(
    ".control-card button, .control-card input, .control-card select, .stage-toolbar button, .stage-toolbar select",
  ).forEach((control) => {
    control.disabled = disabled;
  });
  elements.captureButton.disabled = disabled || !state.stream;
  if (!disabled) syncControls();
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function beep(frequency = 660, duration = 0.08) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = beep.context || (beep.context = new AudioContext());
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // Âm thanh là tín hiệu phụ, không được phép cản quá trình chụp.
  }
}

function preferredVideoMimeType() {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";

  return [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function clearQrShare() {
  elements.qrSharePanel.hidden = true;
  elements.qrCodeImage.removeAttribute("src");
  elements.qrDownloadLink.removeAttribute("href");
  elements.qrExpiryText.textContent = "";
  elements.qrShareButton.disabled = false;
}

function clearPoseVideo() {
  clearQrShare();
  if (state.poseVideoUrl) URL.revokeObjectURL(state.poseVideoUrl);
  state.poseVideoBlob = null;
  state.poseVideoUrl = null;

  elements.poseVideoPreview.pause();
  elements.poseVideoPreview.removeAttribute("src");
  elements.poseVideoPreview.load();
  elements.poseVideoCard.hidden = true;
  elements.downloadVideoButton.hidden = true;
  elements.qrShareButtonLabel.textContent = "Tạo QR tải ảnh";
}

function showPoseVideo(blob) {
  if (state.poseVideoUrl) URL.revokeObjectURL(state.poseVideoUrl);
  state.poseVideoBlob = blob;
  state.poseVideoUrl = URL.createObjectURL(blob);
  elements.poseVideoPreview.src = state.poseVideoUrl;
  elements.poseVideoCard.hidden = false;
  elements.downloadVideoButton.hidden = false;
  elements.qrShareButtonLabel.textContent = "Tạo QR tải ảnh & video";
}

function startPoseRecording() {
  clearPoseVideo();
  if (!window.MediaRecorder || !state.stream?.active) return false;

  try {
    const mimeType = preferredVideoMimeType();
    const recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);
    state.recordedVideoChunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) state.recordedVideoChunks.push(event.data);
    });
    recorder.start(250);
    state.mediaRecorder = recorder;
    elements.recordingIndicator.hidden = false;
    return true;
  } catch (error) {
    console.warn("Không thể bắt đầu quay video tạo dáng.", error);
    state.mediaRecorder = null;
    state.recordedVideoChunks = [];
    elements.recordingIndicator.hidden = true;
    return false;
  }
}

async function stopPoseRecording({ discard = false } = {}) {
  const recorder = state.mediaRecorder;
  if (!recorder) {
    elements.recordingIndicator.hidden = true;
    if (discard) clearPoseVideo();
    return null;
  }

  if (recorder.state !== "inactive") {
    await new Promise((resolve) => {
      const finish = () => resolve();
      recorder.addEventListener("stop", finish, { once: true });
      recorder.addEventListener("error", finish, { once: true });
      recorder.stop();
    });
  }

  const chunks = state.recordedVideoChunks;
  const type = recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || "video/webm";
  state.mediaRecorder = null;
  state.recordedVideoChunks = [];
  elements.recordingIndicator.hidden = true;

  if (discard || !chunks.length) {
    if (discard) clearPoseVideo();
    return null;
  }

  const blob = new Blob(chunks, { type });
  showPoseVideo(blob);
  return blob;
}

async function runCountdown(seconds) {
  elements.countdown.classList.add("is-visible");

  for (let remaining = seconds; remaining > 0; remaining -= 1) {
    if (state.cancelled) throw new Error("capture-cancelled");
    elements.countdown.textContent = String(remaining);
    elements.countdown.classList.remove("is-pulsing");
    void elements.countdown.offsetWidth;
    elements.countdown.classList.add("is-pulsing");
    beep(remaining === 1 ? 880 : 660);
    await sleep(1000);
  }

  elements.countdown.classList.remove("is-visible", "is-pulsing");
  elements.countdown.textContent = "";
}

function createProgress(total) {
  elements.poseProgress.replaceChildren();
  for (let i = 0; i < total; i += 1) {
    elements.poseProgress.append(document.createElement("i"));
  }
}

function markProgress(index) {
  elements.poseProgress.children[index]?.classList.add("is-done");
}

function triggerFlash() {
  elements.flash.classList.remove("is-active");
  void elements.flash.offsetWidth;
  elements.flash.classList.add("is-active");
  beep(1040, 0.12);
}

function captureFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const context = canvas.getContext("2d");
  context.save();
  context.filter = FILTERS[state.filter];

  if (state.mirrored) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  drawCover(
    context,
    elements.video,
    0,
    0,
    canvas.width,
    canvas.height,
    elements.video.videoWidth,
    elements.video.videoHeight,
  );
  context.restore();
  return canvas;
}

async function startCapture() {
  if (state.busy || !state.stream || elements.video.readyState < 2) return;

  state.busy = true;
  state.cancelled = false;
  state.sessionRecorded = false;
  state.photos = [];
  const total = LAYOUTS[state.layout].count;
  createProgress(total);
  elements.poseStatus.classList.add("is-visible");
  setCaptureControlsDisabled(true);
  const recordingStarted = startPoseRecording();
  if (!recordingStarted) {
    showToast("Trình duyệt này chưa hỗ trợ quay video — phiên chụp vẫn tiếp tục với ảnh.");
  }

  try {
    for (let index = 0; index < total; index += 1) {
      elements.poseStatusText.textContent = `Ảnh ${index + 1}/${total} · Chuẩn bị tạo dáng`;
      await runCountdown(state.timer);
      if (state.cancelled) throw new Error("capture-cancelled");

      triggerFlash();
      state.photos.push(captureFrame());
      markProgress(index);
      elements.poseStatusText.textContent = index + 1 === total ? "Đã chụp xong!" : "Đẹp lắm! Đổi dáng nhé";

      if (index + 1 < total) await sleep(1050);
    }

    await stopPoseRecording();
    await composeResult();
    await sleep(300);
    showResult();
  } catch (error) {
    await stopPoseRecording({ discard: true });
    if (error?.message === "capture-cancelled") {
      showToast("Đã hủy phiên chụp.");
    } else {
      console.error(error);
      showToast("Có lỗi khi tạo ảnh. Vui lòng thử lại.");
    }
  } finally {
    elements.countdown.classList.remove("is-visible", "is-pulsing");
    elements.poseStatus.classList.remove("is-visible");
    elements.recordingIndicator.hidden = true;
    state.busy = false;
    setCaptureControlsDisabled(false);
  }
}

function drawCover(context, source, x, y, width, height, sourceWidth = source.width, sourceHeight = source.height) {
  if (!sourceWidth || !sourceHeight) return;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(source, sx, sy, sw, sh, x, y, width, height);
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
  context.closePath();
}

function drawPhoto(context, photo, x, y, width, height, radius = 12) {
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  drawCover(context, photo, x, y, width, height);
  context.restore();
}

function isDarkColor(hex) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 145;
}

function drawFooter(context, canvas, footerTop, frameColor) {
  const darkFrame = isDarkColor(frameColor);
  const ink = darkFrame ? "#fffaf3" : "#27221f";
  const muted = darkFrame ? "rgba(255,250,243,.68)" : "#756c66";
  const center = canvas.width / 2;
  const footerHeight = canvas.height - footerTop;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = ink;
  context.font = `${Math.round(canvas.width * 0.058)}px "DM Serif Display", Georgia, serif`;
  context.fillText(shortBoothName(readAppSettings().boothName), center, footerTop + footerHeight * 0.38, canvas.width * 0.72);

  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  context.fillStyle = muted;
  context.font = `600 ${Math.round(canvas.width * 0.019)}px "Be Vietnam Pro", sans-serif`;
  context.fillText(`KHOẢNH KHẮC CỦA CHÚNG TA  ·  ${date}`, center, footerTop + footerHeight * 0.68);

  context.fillStyle = darkFrame ? "#f9a8b8" : "#f26b38";
  context.beginPath();
  context.arc(center - canvas.width * 0.17, footerTop + footerHeight * 0.37, canvas.width * 0.008, 0, Math.PI * 2);
  context.arc(center + canvas.width * 0.17, footerTop + footerHeight * 0.37, canvas.width * 0.008, 0, Math.PI * 2);
  context.fill();
}

function drawHeart(context, x, y, size, color, rotation = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(size / 32, size / 32);
  context.beginPath();
  context.moveTo(0, 9);
  context.bezierCurveTo(-17, -5, -25, 12, 0, 29);
  context.bezierCurveTo(25, 12, 17, -5, 0, 9);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawFilmDecoration(context, canvas) {
  const railWidth = Math.max(26, canvas.width * 0.03);
  const holeWidth = railWidth * 0.38;
  const holeHeight = Math.max(22, canvas.height * 0.018);
  const step = holeHeight * 2.05;

  context.save();
  context.fillStyle = "#171717";
  context.fillRect(0, 0, railWidth, canvas.height);
  context.fillRect(canvas.width - railWidth, 0, railWidth, canvas.height);
  context.fillStyle = "#fffaf3";

  for (let y = holeHeight * 0.55; y < canvas.height; y += step) {
    roundedRect(context, (railWidth - holeWidth) / 2, y, holeWidth, holeHeight, holeWidth / 2);
    context.fill();
    roundedRect(context, canvas.width - (railWidth + holeWidth) / 2, y, holeWidth, holeHeight, holeWidth / 2);
    context.fill();
  }
  context.restore();
}

function drawLoveDecoration(context, canvas, frameColor) {
  const darkFrame = isDarkColor(frameColor);
  const pink = darkFrame ? "#f9a8b8" : "#e85d83";
  const coral = darkFrame ? "#ffd4bd" : "#f26b38";
  const width = canvas.width;
  const height = canvas.height;

  drawHeart(context, width * 0.055, height * 0.028, width * 0.042, pink, -0.18);
  drawHeart(context, width * 0.92, height * 0.04, width * 0.026, coral, 0.2);
  drawHeart(context, width * 0.075, height * 0.925, width * 0.024, coral, 0.15);
  drawHeart(context, width * 0.91, height * 0.91, width * 0.044, pink, -0.12);

  context.save();
  context.fillStyle = darkFrame ? "rgba(255,255,255,.75)" : "rgba(232,93,131,.42)";
  context.beginPath();
  context.arc(width * 0.115, height * 0.022, width * 0.006, 0, Math.PI * 2);
  context.arc(width * 0.875, height * 0.075, width * 0.008, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function drawPartyDecoration(context, canvas) {
  const random = seededRandom(canvas.width * 13 + canvas.height);
  const colors = ["#f26b38", "#f9a8b8", "#ffd166", "#5ab49a", "#7c67c7"];
  const sideZone = canvas.width * 0.045;
  const topZone = canvas.height * 0.035;

  context.save();
  for (let index = 0; index < 44; index += 1) {
    const zone = index % 3;
    let x;
    let y;
    if (zone === 0) {
      x = random() * canvas.width;
      y = random() * topZone;
    } else {
      x = zone === 1 ? random() * sideZone : canvas.width - random() * sideZone;
      y = random() * canvas.height;
    }

    const size = canvas.width * (0.006 + random() * 0.007);
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.fillStyle = colors[index % colors.length];
    if (index % 5 === 0) {
      context.beginPath();
      context.arc(0, 0, size * 0.58, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(-size / 2, -size, size, size * 2);
    }
    context.restore();
  }
  context.restore();
}

function drawFrameDecoration(context, canvas, style, frameColor) {
  if (style === "film") drawFilmDecoration(context, canvas);
  if (style === "love") drawLoveDecoration(context, canvas, frameColor);
  if (style === "party") drawPartyDecoration(context, canvas);
}

function loadCanvasImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể đọc ảnh khung tùy chỉnh."));
    image.src = source;
  });
}

async function composeResult() {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = elements.resultCanvas;
  const context = canvas.getContext("2d");
  const frame = state.frameColor;
  let footerTop;

  if (state.layout === "single") {
    canvas.width = 1200;
    canvas.height = 1500;
    const margin = 58;
    const photoHeight = 1120;
    context.fillStyle = frame;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawPhoto(context, state.photos[0], margin, margin, canvas.width - margin * 2, photoHeight, 18);
    footerTop = margin + photoHeight;
  } else if (state.layout === "strip") {
    canvas.width = 900;
    canvas.height = 1800;
    const margin = 46;
    const gap = 24;
    const footerHeight = 226;
    const photoHeight = (canvas.height - margin * 2 - gap * 2 - footerHeight) / 3;
    context.fillStyle = frame;
    context.fillRect(0, 0, canvas.width, canvas.height);
    state.photos.forEach((photo, index) => {
      drawPhoto(context, photo, margin, margin + index * (photoHeight + gap), canvas.width - margin * 2, photoHeight, 12);
    });
    footerTop = canvas.height - footerHeight;
  } else {
    canvas.width = 1200;
    canvas.height = 1600;
    const margin = 50;
    const gap = 24;
    const footerHeight = 240;
    const photoWidth = (canvas.width - margin * 2 - gap) / 2;
    const photoHeight = (canvas.height - margin * 2 - gap - footerHeight) / 2;
    context.fillStyle = frame;
    context.fillRect(0, 0, canvas.width, canvas.height);
    state.photos.forEach((photo, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      drawPhoto(
        context,
        photo,
        margin + column * (photoWidth + gap),
        margin + row * (photoHeight + gap),
        photoWidth,
        photoHeight,
        14,
      );
    });
    footerTop = canvas.height - footerHeight;
  }

  drawFooter(context, canvas, footerTop, frame);
  const customFrame = getSelectedCustomFrame();
  if (customFrame) {
    const frameImage = await loadCanvasImage(customFrame.dataUrl);
    context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  } else {
    drawFrameDecoration(context, canvas, state.frameStyle, frame);
  }
}

function activateFlowSlide(target, direction = "forward") {
  document.querySelectorAll(".flow-slide").forEach((slide) => {
    slide.hidden = slide !== target;
    slide.classList.remove("is-active", "slide-forward", "slide-backward");
  });
  target.hidden = false;
  void target.offsetWidth;
  target.classList.add("is-active", direction === "backward" ? "slide-backward" : "slide-forward");
}

function showLayoutSelection() {
  if (state.busy) return;
  stopCamera();
  clearPoseVideo();
  elements.resultView.classList.remove("is-visible");
  activateFlowSlide(elements.layoutStep, "backward");
  syncControls();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFrameSelection(direction = "forward") {
  if (state.busy) return;
  stopCamera();
  const customFrame = getSelectedCustomFrame();
  if (customFrame && customFrame.layout !== "all" && customFrame.layout !== state.layout) {
    state.customFrameId = null;
  }
  elements.resultView.classList.remove("is-visible");
  
  // Áp dụng lớp layout để frame preview hiển thị đúng tỷ lệ
  elements.frameStep.classList.remove("active-layout-single", "active-layout-strip", "active-layout-grid");
  elements.frameStep.classList.add(`active-layout-${state.layout}`);

  activateFlowSlide(elements.frameStep, direction);
  renderFrameLibraries();
  savePreferences();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function continueToCapture() {
  const customFrame = getSelectedCustomFrame();
  if (customFrame?.layout && customFrame.layout !== "all") state.layout = customFrame.layout;
  elements.resultView.classList.remove("is-visible");
  activateFlowSlide(elements.captureStep, "forward");
  syncControls();
  savePreferences();
  window.scrollTo({ top: 0, behavior: "smooth" });
  await startCamera(elements.cameraSelect.value);
}

function showResult() {
  stopCamera();
  elements.resultView.classList.add("is-visible");
  activateFlowSlide(elements.resultView, "forward");
  elements.resultView.scrollIntoView({ behavior: "smooth", block: "start" });
  recordCompletedSession().catch((error) => {
    state.sessionRecorded = false;
    console.error(error);
  });
}

async function retake() {
  if (state.busy) return;
  elements.resultView.classList.remove("is-visible");
  activateFlowSlide(elements.captureStep, "backward");
  state.photos = [];
  clearPoseVideo();
  window.scrollTo({ top: 0, behavior: "smooth" });
  await startCamera(elements.cameraSelect.value);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không thể xuất ảnh."))), "image/png", 1);
  });
}

function photoFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `snapjoy-${stamp}.png`;
}

function poseVideoFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const extension = state.poseVideoBlob?.type.includes("mp4") ? "mp4" : "webm";
  return `snapjoy-tao-dang-${stamp}.${extension}`;
}

async function downloadResult() {
  try {
    const blob = await canvasToBlob(elements.resultCanvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = photoFilename();
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Đã tải ảnh xuống thiết bị.");
  } catch {
    showToast("Không thể tải ảnh. Vui lòng thử lại.");
  }
}

function downloadPoseVideo() {
  if (!state.poseVideoBlob) {
    showToast("Chưa có video tạo dáng để tải xuống.");
    return;
  }

  const url = URL.createObjectURL(state.poseVideoBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = poseVideoFilename();
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Đã tải video tạo dáng xuống thiết bị.");
}

async function readApiResponse(response, fallbackMessage) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Máy chủ có thể trả về trang lỗi HTML; dùng thông báo dễ hiểu bên dưới.
  }
  if (!response.ok) throw new Error(data?.error || fallbackMessage);
  return data;
}

async function detectLocalSharing() {
  if (SHARE_API_BASE) elements.qrShareButton.hidden = false;
  try {
    const response = await fetch(shareApiUrl("/api/config"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
    const config = await response.json();
    if (!config.localSharing || !config.phoneReady) return;
    state.localSharingConfig = config;
    elements.qrShareButton.hidden = false;
  } catch {
    // Không có máy chủ chia sẻ: chỉ hiện nút QR khi đã cấu hình SHARE_API_BASE.
  }
}

async function createQrShare() {
  if (!state.localSharingConfig) {
    elements.qrShareButton.disabled = true;
    elements.qrShareButtonLabel.textContent = "Đang kết nối máy chia sẻ…";
    await detectLocalSharing();
  }
  if (!state.localSharingConfig) {
    elements.qrShareButton.disabled = false;
    elements.qrShareButtonLabel.textContent = state.poseVideoBlob
      ? "Tạo QR tải ảnh & video"
      : "Tạo QR tải ảnh";
    showToast(SHARE_API_BASE
      ? "Không kết nối được máy chủ chia sẻ. Kiểm tra lại địa chỉ trong SHARE_API_BASE."
      : "Hãy chạy SnapJoy bằng máy chủ chia sẻ cục bộ để tạo mã QR.");
    return;
  }

  clearQrShare();
  elements.qrShareButton.disabled = true;
  elements.qrShareButtonLabel.textContent = "Đang chuẩn bị mã QR…";

  try {
    const photoBlob = await canvasToBlob(elements.resultCanvas);
    const createResponse = await fetch(shareApiUrl("/api/shares"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hasVideo: Boolean(state.poseVideoBlob),
        videoType: state.poseVideoBlob?.type || "",
      }),
    });
    const session = await readApiResponse(createResponse, "Không thể tạo phiên chia sẻ.");

    const uploads = [
      fetch(shareApiUrl(session.photoUploadUrl), {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: photoBlob,
      }),
    ];
    if (state.poseVideoBlob && session.videoUploadUrl) {
      uploads.push(fetch(shareApiUrl(session.videoUploadUrl), {
        method: "PUT",
        headers: { "Content-Type": state.poseVideoBlob.type || "video/webm" },
        body: state.poseVideoBlob,
      }));
    }

    const uploadResponses = await Promise.all(uploads);
    for (const response of uploadResponses) {
      await readApiResponse(response, "Không thể gửi ảnh hoặc video tới máy chia sẻ.");
    }

    const completeResponse = await fetch(shareApiUrl(session.completeUrl), { method: "POST" });
    const completed = await readApiResponse(completeResponse, "Không thể hoàn tất mã QR.");
    const expiresAt = new Date(completed.expiresAt);
    elements.qrCodeImage.src = completed.qrDataUrl;
    elements.qrDownloadLink.href = completed.downloadUrl;
    elements.qrExpiryText.textContent = `Có hiệu lực đến ${expiresAt.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    elements.qrSharePanel.hidden = false;
    showToast(state.localSharingConfig.hosted
      ? "Mã QR đã sẵn sàng — khách quét mã bằng điện thoại."
      : "Mã QR đã sẵn sàng — điện thoại cần dùng cùng mạng Wi-Fi.");
  } catch (error) {
    console.error(error);
    showToast(error?.message || "Không thể tạo mã QR. Vui lòng thử lại.");
  } finally {
    elements.qrShareButton.disabled = false;
    elements.qrShareButtonLabel.textContent = state.poseVideoBlob
      ? "Tạo QR tải ảnh & video"
      : "Tạo QR tải ảnh";
  }
}

async function shareResult() {
  try {
    const blob = await canvasToBlob(elements.resultCanvas);
    const file = new File([blob], photoFilename(), { type: "image/png" });
    const boothName = readAppSettings().boothName;

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `Ảnh từ ${boothName}`,
        text: `Khoảnh khắc của mình tại ${shortBoothName(boothName)} ✦`,
        files: [file],
      });
      return;
    }

    await downloadResult();
    showToast("Thiết bị chưa hỗ trợ chia sẻ trực tiếp — ảnh đã được tải xuống.");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Không thể chia sẻ ảnh. Vui lòng thử lại.");
  }
}

function printResult() {
  elements.printImage.src = elements.resultCanvas.toDataURL("image/png", 1);
  window.requestAnimationFrame(() => window.print());
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    showToast("Trình duyệt không cho phép bật toàn màn hình.");
  }
}

function bindEvents() {
  elements.continueToFrameButton.addEventListener("click", () => showFrameSelection("forward"));
  elements.backToLayoutButton.addEventListener("click", showLayoutSelection);
  elements.continueToCaptureButton.addEventListener("click", continueToCapture);
  elements.changeLayoutButton.addEventListener("click", showLayoutSelection);
  elements.changeFrameButton.addEventListener("click", () => showFrameSelection("backward"));
  elements.builtInFrameGallery.addEventListener("click", (event) => {
    const card = event.target.closest("[data-frame-choice]");
    if (card) selectBuiltInFrame(card.dataset.frameChoice);
  });
  elements.customFrameGallery.addEventListener("click", (event) => {
    const card = event.target.closest("[data-custom-frame-id]");
    if (card) selectCustomFrame(card.dataset.customFrameId);
  });

  elements.startButton.addEventListener("click", () => startCamera());
  elements.retryCameraButton.addEventListener("click", () => startCamera(elements.cameraSelect.value));
  elements.cameraSelect.addEventListener("change", (event) => startCamera(event.target.value));
  elements.captureButton.addEventListener("click", startCapture);
  elements.downloadButton.addEventListener("click", downloadResult);
  elements.downloadVideoButton.addEventListener("click", downloadPoseVideo);
  elements.shareButton.addEventListener("click", shareResult);
  elements.qrShareButton.addEventListener("click", createQrShare);
  elements.printButton.addEventListener("click", printResult);
  elements.retakeButton.addEventListener("click", retake);
  elements.fullscreenButton.addEventListener("click", toggleFullscreen);

  elements.mirrorButton.addEventListener("click", () => {
    if (state.busy) return;
    state.mirrored = !state.mirrored;
    syncControls();
    savePreferences();
  });

  elements.frameColor.addEventListener("input", (event) => {
    if (state.busy) return;
    state.frameColor = event.target.value;
    syncControls();
    savePreferences();
  });

  elements.brand.addEventListener("click", (event) => {
    event.preventDefault();
    showLayoutSelection();
  });

  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement);
    elements.fullscreenButton.setAttribute("aria-label", active ? "Thoát toàn màn hình" : "Bật toàn màn hình");
    elements.fullscreenButton.title = active ? "Thoát toàn màn hình" : "Toàn màn hình";
  });

  document.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    if (event.code === "Space" && !["BUTTON", "SELECT", "INPUT"].includes(activeTag)) {
      event.preventDefault();
      startCapture();
    }
    if (event.key === "Escape" && state.busy) state.cancelled = true;
  });

  window.addEventListener("beforeunload", stopCamera);

  setChoice("[data-layout]", (button) => {
    state.layout = button.dataset.layout;
    const customFrame = getSelectedCustomFrame();
    if (customFrame && customFrame.layout !== "all" && customFrame.layout !== state.layout) {
      state.customFrameId = null;
    }
    renderCustomFrameGallery();
  });
  setChoice("[data-timer]", (button) => {
    state.timer = Number(button.dataset.timer);
  });
  setChoice("[data-filter]", (button) => {
    state.filter = button.dataset.filter;
  });
  setChoice("[data-color]", (button) => {
    state.frameColor = button.dataset.color;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline là tính năng tăng cường, ứng dụng vẫn chạy nếu không đăng ký được.
      });
    });
  }
}

async function initializeApp() {
  loadPreferences();
  applyAppSettings();
  bindEvents();
  await loadCustomFrames();
  syncControls();
  detectLocalSharing();
  registerServiceWorker();
}

initializeApp();
