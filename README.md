# APIScan Ai: AI Key Sentinel 🛡️

**APIScan Ai** is a hyper-fast, reliable desktop application built to scan, validate, and audit bulk API keys from top AI providers. Built with **Rust** and **Tauri** for maximum performance, and beautifully crafted using **React** and modern Glassmorphism design principles.

<p align="center">
  <em>"Elite validation.. for performance without boundaries."</em>
</p>

---

## 🚀 Core Features

- **Limit-Breaker Engine:** Custom-built CSV and XLSX streaming parser. Capable of handling over 50,000+ API keys (15MB+ files) without crashing or freezing the UI.
- **Auto-Detect AI:** Intelligently detects the AI provider (OpenAI, Anthropic, Gemini, Groq, xAI, etc.) directly from the key format.
- **Flagship Detection:** Instantly identifies if a key has access to "Flagship" elite models (e.g., GPT-4o, Claude 3.5 Sonnet).
- **Secure Architecture:** Operates 100% locally on your machine. Keys are NEVER sent to an intermediary server. Your digital assets remain yours.
- **Bilingual Interface:** Full support for both English (EN) and Arabic (AR) dynamically.

## 🛠️ Technical Stack

- **Core:** Rust (Tauri Backend)
- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS + Vanilla CSS (Custom Glassmorphism)
- **Parsers:** `csv` with flexible dimensions, `quick-xml` & `zip` for large Excel parsing.

## 📦 How to Build from Source

### Prerequisites
- Node.js (v18+)
- Rust (Latest stable)
- MSVC / C++ Build Tools (Windows)

### Running Locally
```bash
npm install
npm run tauri dev
```

### Build Production Release
```bash
npm run tauri build
```
The executable will be generated inside `src-tauri/target/release/bundle/nsis/`.

---

# مشروع APIScan Ai: المنظومة المتكاملة لتدقيق المفاتيح

**APIScan Ai** ليس مجرد أداة فحص، بل هو "محرك النخبة" المصمم ليكون المنصة الأساسية لفحص مفاتيح الـ API. يتميز التطبيق بقدرته الخارقة على معالجة قواعد بيانات ضخمة في ثوانٍ معدودة.

### الميزات الجوهرية:
* **محرك الاختراق للقيود:** خوارزميات مخصصة لقراءة ملفات Excel و CSV العملاقة بأسلوب الـ Streaming لتوفير استهلاك الذاكرة.
* **التعرف الذكي:** نظام يتعرف تلقائياً على مزود الخدمة.
* **فحص الـ Flagship:** تصنيف المفاتيح بناءً على الوصول للنماذج الرائدة لتحديد "نخبوية" المفتاح.
* **بنية آمنة:** فحص محلي ١٠٠٪ بدون خوادم وسيطة.

### ترخيص المشروع (License)
This project is open-source and available under the terms of the MIT License.
