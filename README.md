# Grok Prompt Injector — Chrome Extension

Tự động gán nhiều prompt vào phần **Imagine** (tạo ảnh/video) của Grok.  
Mỗi đoạn cách nhau **1 dòng trống** được tính là **1 prompt riêng biệt**.

---

## Cài đặt

### Bước 1 — Tải extension
Giải nén thư mục `grok-prompt-injector` ra máy tính (ví dụ: `C:\Extensions\grok-prompt-injector`).

### Bước 2 — Bật Developer Mode
1. Mở Chrome → gõ vào thanh địa chỉ: `chrome://extensions`
2. Bật công tắc **Developer mode** (góc trên bên phải)

### Bước 3 — Load extension
1. Nhấn nút **Load unpacked**
2. Chọn thư mục `grok-prompt-injector`
3. Extension xuất hiện trong danh sách ✓

### Bước 4 — Ghim lên toolbar
Nhấn biểu tượng 🧩 (Extensions) trên Chrome → nhấn ghim (📌) bên cạnh **Grok Prompt Injector**.

---

## Cách dùng

1. Mở **[grok.com](https://grok.com)** hoặc **[x.com/i/grok](https://x.com/i/grok)**
2. Vào phần **Imagine** (tạo ảnh/video)
3. Nhấn vào icon extension trên toolbar
4. Nhập danh sách prompt — **cách nhau bằng 1 dòng trống**:
   ```
   A futuristic city at sunset, cinematic lighting

   A dragon flying over mountains, fantasy art style

   Portrait of a samurai warrior, oil painting
   ```
5. Chỉnh **Delay** (ms) — thời gian chờ giữa mỗi prompt (khuyến nghị: 1500–3000ms)
6. Bật/tắt **Tự submit** — tự động nhấn Enter sau khi gán
7. Nhấn **▶ Chạy**

---

## Tùy chọn

| Tùy chọn | Mô tả | Mặc định |
|---|---|---|
| Delay (ms) | Thời gian chờ giữa mỗi prompt | 1500ms |
| Tự submit | Tự động nhấn Enter để gửi | Bật |

---

## Lưu ý

- Extension **tự lưu** danh sách prompt khi bạn nhập, không mất khi đóng popup.
- Nếu Grok cập nhật giao diện, selector có thể cần điều chỉnh trong `popup.js`.
- Không dùng delay quá thấp (<1000ms) để tránh bị Grok giới hạn tốc độ.

---

## Cấu trúc file

```
grok-prompt-injector/
├── manifest.json      ← Cấu hình extension
├── popup.html         ← Giao diện popup
├── popup.js           ← Logic chính (injection, UI)
├── content.js         ← Content script chạy trên trang Grok
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
