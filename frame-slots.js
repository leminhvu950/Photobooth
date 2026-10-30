"use strict";

// Tiện ích dùng chung cho cả photobooth và trang quản trị.
// Nhiệm vụ: đọc file frame (PNG/WebP) và tự dò ra các "vùng ảnh" —
// tức những khoảng trong suốt nằm bên trong thẻ frame, không dính mép ảnh.
(function (global) {
  const ALPHA_THRESHOLD = 24; // pixel được coi là trong suốt khi alpha thấp hơn ngưỡng này
  const MIN_AREA_RATIO = 0.004; // vùng nhỏ hơn 0,4% diện tích frame bị bỏ qua
  const MIN_SIDE_RATIO = 0.05; // cạnh ngắn hơn 5% kích thước frame bị bỏ qua
  const MAX_COVER_RATIO = 0.9; // vùng phủ trên 90% frame được coi là nền, không phải ô ảnh
  const ANALYSIS_MAX_SIZE = 900; // giới hạn cạnh dài khi phân tích để không tốn bộ nhớ

  function sortSlots(slots) {
    const sorted = [...slots].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
    const rows = [];

    sorted.forEach((slot) => {
      const center = slot.y + slot.h / 2;
      const row = rows.find((item) => Math.abs(item.center - center) < Math.max(item.height, slot.h) * 0.6);
      if (row) {
        row.slots.push(slot);
        row.height = Math.max(row.height, slot.h);
        row.center = row.slots.reduce((sum, item) => sum + item.y + item.h / 2, 0) / row.slots.length;
      } else {
        rows.push({ center, height: slot.h, slots: [slot] });
      }
    });

    return rows
      .sort((a, b) => a.center - b.center)
      .flatMap((row) => row.slots.sort((a, b) => a.x - b.x));
  }

  function findSlots(data, width, height, isCandidate) {
    const total = width * height;
    const candidates = new Uint8Array(total);
    let countCandidates = 0;

    for (let index = 0; index < total; index += 1) {
      if (isCandidate(index)) {
        candidates[index] = 1;
        countCandidates += 1;
      }
    }

    if (countCandidates === 0) return [];

    // Loại vùng dính mép ảnh (thường là nền ngoài của thẻ frame).
    const visited = new Uint8Array(total);
    const stack = [];

    const pushBorderPixels = () => {
      for (let x = 0; x < width; x += 1) {
        stack.push(x, (height - 1) * width + x);
      }
      for (let y = 0; y < height; y += 1) {
        stack.push(y * width, y * width + width - 1);
      }
    };

    pushBorderPixels();
    while (stack.length) {
      const index = stack.pop();
      if (visited[index] || !candidates[index]) continue;
      visited[index] = 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) stack.push(index - 1);
      if (x < width - 1) stack.push(index + 1);
      if (y > 0) stack.push(index - width);
      if (y < height - 1) stack.push(index + width);
    }

    // Các vùng còn lại chính là cửa sổ ảnh.
    const minArea = total * MIN_AREA_RATIO;
    const minWidth = width * MIN_SIDE_RATIO;
    const minHeight = height * MIN_SIDE_RATIO;
    const slots = [];

    for (let start = 0; start < total; start += 1) {
      if (visited[start] || !candidates[start]) continue;
      let count = 0;
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      stack.push(start);

      while (stack.length) {
        const index = stack.pop();
        if (visited[index] || !candidates[index]) continue;
        visited[index] = 1;
        count += 1;
        const x = index % width;
        const y = (index - x) / width;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x > 0) stack.push(index - 1);
        if (x < width - 1) stack.push(index + 1);
        if (y > 0) stack.push(index - width);
        if (y < height - 1) stack.push(index + width);
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      if (count < minArea || boxWidth < minWidth || boxHeight < minHeight) continue;
      if ((boxWidth * boxHeight) / total > MAX_COVER_RATIO) continue;
      if (count / (boxWidth * boxHeight) < 0.5) continue; // vùng phải đặc, không phải viền mỏng

      slots.push({
        x: minX / width,
        y: minY / height,
        w: boxWidth / width,
        h: boxHeight / height,
      });
    }

    return slots;
  }

  function boxesOverlap(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);
    if (x2 <= x1 || y2 <= y1) return 0;
    return ((x2 - x1) * (y2 - y1)) / Math.min(a.w * a.h, b.w * b.h);
  }

  function detectFromImageData(imageData, width, height) {
    const { data } = imageData;

    // Một file frame có thể vừa có ô trong suốt vừa có ô đục (trắng/đen) do
    // cách xuất PDF/PNG. Vì vậy phải dò bằng cả ba cách rồi gộp lại, nếu chỉ
    // dùng cách dò đầu tiên thì các ô còn lại sẽ bị bỏ sót và thiếu ảnh khi ghép.
    const criteria = [
      // 1. Ô trong suốt (Alpha < Threshold)
      (i) => data[i * 4 + 3] < ALPHA_THRESHOLD,
      // 2. Ô màu trắng đặc (R,G,B > 245)
      (i) => data[i * 4] > 245 && data[i * 4 + 1] > 245 && data[i * 4 + 2] > 245 && data[i * 4 + 3] > 200,
      // 3. Ô màu đen đặc (R,G,B < 15)
      (i) => data[i * 4] < 15 && data[i * 4 + 1] < 15 && data[i * 4 + 2] < 15 && data[i * 4 + 3] > 200,
    ];

    const boxes = [];
    criteria.forEach((isCandidate) => {
      findSlots(data, width, height, isCandidate).forEach((slot) => boxes.push(slot));
    });

    // Cùng một vùng có thể thoả nhiều tiêu chí — chỉ giữ lại một ô cho mỗi vùng.
    const unique = [];
    boxes.forEach((slot) => {
      if (!unique.some((item) => boxesOverlap(item, slot) > 0.6)) unique.push(slot);
    });

    return sortSlots(unique);
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Không thể đọc file frame."));
      image.src = source;
    });
  }

  async function detectFromSource(source) {
    const image = await loadImage(source);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) return [];

    const scale = Math.min(1, ANALYSIS_MAX_SIZE / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    return detectFromImageData(context.getImageData(0, 0, width, height), width, height);
  }

  function round(slots, digits = 4) {
    const factor = 10 ** digits;
    return slots.map((slot) => ({
      x: Math.round(slot.x * factor) / factor,
      y: Math.round(slot.y * factor) / factor,
      w: Math.round(slot.w * factor) / factor,
      h: Math.round(slot.h * factor) / factor,
    }));
  }

  global.SnapJoySlots = { detectFromSource, detectFromImageData, sortSlots, round };
})(window);
