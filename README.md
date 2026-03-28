# ✦ AuthorPro — Free Manuscript Formatter for Authors

> Turn your manuscript into a professionally formatted PDF or EPUB — instantly, for free, with no signup required.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-AuthorPro-c9a84c?style=for-the-badge&logo=github)](https://avinashwalton.github.io/AuthorPro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Made in India](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F-India-orange?style=for-the-badge)]()

---

## 🌐 Live Website

**[https://avinashwalton.github.io/AuthorPro/](https://avinashwalton.github.io/AuthorPro/)**

---

## 📖 What is AuthorPro?

**AuthorPro** is a free, browser-based manuscript formatting tool for writers and authors. Whether you're writing your first novel or your tenth, AuthorPro helps you structure, write, and export your book in a professional format — directly from your browser.

No downloads. No subscriptions. No sign-in. Just open and write.

---

## ✨ Features

### 📄 Pre-Built Book Sections (All Optional)
- **Title Page** — Book title, subtitle, author, publisher, year
- **Copyright Page** — Auto-populated with ISBN, year, edition
- **Dedication** — Personalize your dedication
- **Foreword** — Written by someone else? Add it here
- **Preface** — Author's introductory note
- **Acknowledgements** — Thank the people who helped
- **Table of Contents** — Auto-generated from your chapters
- **Introduction** — Opening note before the main content
- **Epilogue / Afterword / Glossary / Bibliography / Index / About the Author / Colophon**

### 🗂️ Units & Chapters
- **Units (Parts/Sections)** — Organize your book into large parts (Unit I, Unit II...) — completely optional
- **Chapters** — Add unlimited chapters, nested under units or standalone
- **Chapter titles** — Editable inline

### ✍️ Rich Text Editor
- Bold, Italic, Underline, Strikethrough, Superscript, Subscript
- Headings (H1–H4), Paragraphs, Blockquotes, Code Blocks
- Align Left / Center / Right / Justify
- Ordered & Unordered Lists
- Text Color & Highlight Color
- Insert Links, Images (by URL), Tables, Horizontal Rules, Page Breaks
- Undo / Redo / Remove Formatting
- Paste from Word / Google Docs with formatting preserved

### 🎨 Page & Style Settings
- **Page Sizes** — A4, A5, Letter, 6×9 (Trade), 5×8 (Pocket)
- **Body Fonts** — Georgia, Palatino, Times New Roman, Garamond, Crimson Pro, Arial, Helvetica
- **Font Size** — 10pt to 14pt
- **Line Spacing** — Compact, Normal, Relaxed, Double
- **Margins** — Narrow, Normal, Wide, Mirror
- **Chapter Heading Styles** — Classic, Modern, Minimal, Ornate
- **Color Themes** — Classic Black, Navy Blue, Sepia, Forest Green

### 📤 Export
- **PDF Export** — Print-ready PDF with running headers (book title on left, chapter title on right), page numbers, professional chapter headings
- **EPUB Export** — HTML-based ebook compatible with Calibre for conversion to true EPUB/MOBI/AZW3

### 🔖 Running Headers in PDF
Book title appears on the left header, current chapter title on the right — exactly like published books.

### 💾 Save & Restore
- **Auto-save** — Automatically saved to browser's localStorage every 60 seconds
- **Manual Save** — Download your project as a `.json` file
- **Load** — Restore any previously saved project instantly
- **Keyboard Shortcuts** — `Ctrl/Cmd+S` to save, `Ctrl/Cmd+P` for preview, `Esc` to close modals

### 📊 Document Statistics
- Total word count across all chapters
- Character count
- Estimated page count
- Novel completion percentage
- Per-chapter word count display

### 📱 Responsive Design
- Works beautifully on phones, tablets, and desktops
- Adaptive layout for small screens

### 🔍 SEO Optimized
- Semantic HTML5, Open Graph, Twitter Cards
- JSON-LD structured data
- Canonical URLs, proper meta descriptions

---

## 🚀 Getting Started

### Option 1: Use Online (Recommended)
Just visit **[https://avinashwalton.github.io/AuthorPro/](https://avinashwalton.github.io/AuthorPro/)** — no installation needed.

### Option 2: Run Locally
```bash
git clone https://github.com/AvinashWalton/AuthorPro.git
cd AuthorPro
# Open index.html in your browser
open index.html
```
No build step, no Node.js, no dependencies — it's pure HTML, CSS, and JavaScript.

---

## 📁 Project Structure

```
AuthorPro/
├── index.html       # Main HTML — full app structure, SEO meta, schema
├── style.css        # All styles — dark theme, editor, responsive
├── script.js        # App logic — editors, export, save/load, units/chapters
├── README.md        # This file
└── LICENSE          # MIT License
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 (Semantic) | Structure & accessibility |
| CSS3 (Custom Properties) | Styling, animations, responsive layout |
| Vanilla JavaScript (ES6+) | All app logic, no frameworks |
| [jsPDF 2.5](https://github.com/parallax/jsPDF) | PDF generation (loaded via CDN) |
| [html2canvas](https://html2canvas.hertzen.com/) | DOM rendering for PDF (loaded via CDN) |
| Google Fonts | Playfair Display, Crimson Pro, Space Mono |
| Browser localStorage | Auto-save functionality |
| `contenteditable` API | Rich text editing |
| `execCommand` API | Text formatting commands |

---

## 🔧 How PDF Export Works

1. All chapter content is extracted from the `contenteditable` editors
2. A new `jsPDF` document is created with the selected page size
3. Front matter pages (title, copyright, dedication, etc.) are rendered
4. Each chapter is paginated with auto page-break detection
5. Running headers are drawn on every page: **Book Title | Chapter Title**
6. Page numbers are inserted at the bottom center
7. The PDF is downloaded directly to your device

---

## 📱 EPUB Export

AuthorPro generates a structured HTML file with all your book's content organized as a single-file ebook. For a true `.epub` file:

1. Download the `.html` export
2. Open [Calibre](https://calibre-ebook.com/) (free)
3. Add book → Convert to EPUB/MOBI/AZW3

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Ideas for Contribution
- [ ] True `.epub` file generation using JSZip
- [ ] Word import (`.docx` to editor)
- [ ] Google Docs import
- [ ] Drag-and-drop chapter reordering
- [ ] Chapter templates (mystery, romance, technical, etc.)
- [ ] Cloud save (Firebase/Supabase)
- [ ] Multi-language support (Hindi, Bengali, Tamil, etc.)
- [ ] Custom CSS/styling per section

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this project for personal or commercial purposes with attribution.

---

## 👨‍💻 Author

**Avinash Walton**

[![YouTube](https://img.shields.io/badge/YouTube-AvinashWalton-red?style=flat-square&logo=youtube)](https://youtube.com/@AvinashWalton)
[![Facebook](https://img.shields.io/badge/Facebook-AvinashWalton-blue?style=flat-square&logo=facebook)](https://facebook.com/AvinashWalton)
[![Twitter](https://img.shields.io/badge/Twitter-AvinashWalton-1da1f2?style=flat-square&logo=twitter)](https://twitter.com/AvinashWalton)
[![Instagram](https://img.shields.io/badge/Instagram-AvinashWalton-e1306c?style=flat-square&logo=instagram)](https://instagram.com/AvinashWalton)
[![Threads](https://img.shields.io/badge/Threads-AvinashWalton-black?style=flat-square&logo=threads)](https://threads.net/@AvinashWalton)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-SonuKumarSuman-0077b5?style=flat-square&logo=linkedin)](https://linkedin.com/in/SonuKumarSuman)

---

## ⭐ Support

If AuthorPro helped your writing journey, please **star this repository** ⭐ and share it with fellow authors!

---

*Made with ❤️ in India by [Avinash Walton](https://youtube.com/@AvinashWalton)*
