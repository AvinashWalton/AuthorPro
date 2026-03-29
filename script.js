/* ============================================================
   AuthorPro – script.js  v2.2
   Bug Fixes:
   B1: updateChapterTitle no longer calls renderChapterList() → no focus loss
   B2: Cover image type auto-detected (PNG/JPEG/GIF/WEBP)
   B3: startFirstChapter() — no hardcoded tab ID
   New fixes:
   F1: Title page, Copyright page, TOC page — NO running header
   F2: Ornate style — ASCII-safe chars + doc.line() (no broken Unicode)
   F3: Copyright page is editable with auto-fill button
   F4: Watermark removed permanently from all PDF/EPUB output
   F5: Colophon is now editable (no auto-text)
   ============================================================ */
'use strict';

const state = {
  chapters: [],
  units: [],
  activeTab: 'welcome',
  exportFormat: 'pdf',
  autoSaveTimer: null,
  chapterCounter: 0,
  unitCounter: 0,
  coverImageDataUrl: null,
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  initAutoSave();
  loadFromLocalStorage();
  updateWordCount();
});

// ===== NAV =====
function scrollToFormatter() { document.getElementById('formatter').scrollIntoView({ behavior: 'smooth' }); }
function closeMobileMenu() { document.getElementById('mobileMenu').classList.remove('open'); }
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ===== COLLAPSIBLE BLOCKS =====
function toggleBlock(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const header = body.previousElementSibling;
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden');
  if (header) header.classList.toggle('collapsed', !isHidden);
}

// ===== FRONT/BACK MATTER EDITORS =====
function toggleFrontEditor(wrapId, show) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.classList.toggle('visible', show);
  if (show) {
    const editor = wrap.querySelector('.front-editor');
    if (editor) setTimeout(() => editor.focus(), 50);
  }
}

// F3: Copyright editor — shows editor and auto-fills if empty
function toggleCopyrightEditor(show) {
  toggleFrontEditor('copyrightEditorWrap', show);
  if (show) {
    const editor = document.getElementById('copyrightEditor');
    if (editor && !editor.innerHTML.trim()) {
      autofillCopyrightEditor();
    }
  }
}

// F3: Auto-fill copyright content from book details
function autofillCopyrightEditor() {
  const editor = document.getElementById('copyrightEditor');
  if (!editor) return;
  const author    = document.getElementById('authorName').value || 'Author';
  const year      = document.getElementById('pubYear').value || new Date().getFullYear();
  const publisher = document.getElementById('publisherName').value || '';
  const isbn      = document.getElementById('isbnNum').value || '';
  let html = `<p>Copyright &copy; ${year} ${author}</p>`;
  html += `<p>All rights reserved.</p>`;
  html += `<p>No part of this publication may be reproduced, distributed, or transmitted in any form without the prior written permission of the publisher.</p>`;
  if (publisher) html += `<p>Published by ${publisher}</p>`;
  if (isbn)      html += `<p>ISBN: ${isbn}</p>`;
  editor.innerHTML = html;
}

// ===== COVER IMAGE =====
function onCoverImageChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    state.coverImageDataUrl = e.target.result;
    document.getElementById('coverPreview').src = e.target.result;
    document.getElementById('coverPreviewWrap').style.display = 'block';
    scheduleAutoSave();
  };
  reader.readAsDataURL(file);
}

function removeCover() {
  state.coverImageDataUrl = null;
  document.getElementById('coverImage').value = '';
  document.getElementById('coverPreviewWrap').style.display = 'none';
  document.getElementById('coverPreview').src = '';
  scheduleAutoSave();
}

// B2: Auto-detect image type
function getImageType(dataUrl) {
  if (!dataUrl) return 'JPEG';
  if (dataUrl.startsWith('data:image/png'))  return 'PNG';
  if (dataUrl.startsWith('data:image/gif'))  return 'GIF';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

// ===== UNIT MODE =====
function toggleUnitMode() {
  const use = document.getElementById('useUnits').checked;
  document.getElementById('addUnitBtn').style.display = use ? 'inline-flex' : 'none';
  document.getElementById('unitsContainer').innerHTML = '';
  if (use && state.units.length === 0) {
    addUnit();
  } else if (!use) {
    state.units = [];
    renderChapterList();
  }
}

// ===== UNITS =====
function addUnit() {
  const id = 'u' + (++state.unitCounter);
  state.units.push({ id, title: '' });
  renderUnits();
}

function removeUnit(unitId) {
  if (!confirm('Delete this unit? Chapters under it will become unassigned.')) return;
  state.units = state.units.filter(u => u.id !== unitId);
  state.chapters.forEach(ch => { if (ch.unitId === unitId) ch.unitId = null; });
  renderUnits();
  renderChapterList();
  scheduleAutoSave();
}

function renderUnits() {
  const container = document.getElementById('unitsContainer');
  if (!container) return;
  container.innerHTML = state.units.map((unit, i) => `
    <div class="unit-block" id="unitBlock_${unit.id}">
      <div class="unit-header">
        <span class="unit-label">Unit ${i + 1}</span>
        <input class="unit-title-input" type="text" placeholder="Unit title…"
          value="${escHtml(unit.title)}"
          oninput="updateUnitTitle('${unit.id}', this.value)" />
        <button class="btn-delete-unit" title="Delete Unit" onclick="removeUnit('${unit.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

function updateUnitTitle(unitId, val) {
  const unit = state.units.find(u => u.id === unitId);
  if (unit) unit.title = val;
  renderChapterList();
  scheduleAutoSave();
}

// ===== CHAPTERS =====

// B3: Safe helper — welcome button uses this
function startFirstChapter() {
  const ch = addChapter(null);
  switchTab(ch.id);
}

function addChapter(unitId) {
  const id = 'ch_' + (state.chapterCounter++);
  const ch = { id, title: 'Chapter ' + (state.chapters.length + 1), content: '', unitId: unitId || null };
  state.chapters.push(ch);
  renderChapterList();
  createEditorTab(ch);
  switchTab(id);
  return ch;
}

function removeChapter(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this chapter? Content will be lost.')) return;
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  const tabContent = document.getElementById(`tab-${id}`);
  if (tabBtn) tabBtn.remove();
  if (tabContent) tabContent.remove();
  state.chapters = state.chapters.filter(ch => ch.id !== id);
  renderChapterList();
  if (state.activeTab === id) {
    switchTab(state.chapters.length > 0 ? state.chapters[state.chapters.length - 1].id : 'welcome');
  }
  scheduleAutoSave();
}

function renderChapterList() {
  const container = document.getElementById('chaptersContainer');
  if (!container) return;
  const useUnits = document.getElementById('useUnits').checked;
  if (useUnits && state.units.length > 0) {
    let html = '';
    state.units.forEach((unit, ui) => {
      const unitChs = state.chapters.filter(ch => ch.unitId === unit.id);
      html += `<div class="unit-group-label">▸ ${escHtml(unit.title || `Unit ${ui + 1}`)}</div>`;
      html += unitChs.map(ch => chapterItemHTML(ch)).join('');
      html += `<button class="btn-add" style="margin:3px 0 7px 14px;font-size:0.74rem;" onclick="addChapter('${unit.id}')">+ Add Chapter</button>`;
    });
    const unassigned = state.chapters.filter(ch => !ch.unitId);
    if (unassigned.length > 0) {
      html += `<div class="unit-group-label" style="margin-top:6px;">Unassigned</div>`;
      html += unassigned.map(ch => chapterItemHTML(ch)).join('');
    }
    container.innerHTML = html;
  } else {
    container.innerHTML = state.chapters.map(ch => chapterItemHTML(ch)).join('');
  }
}

function chapterItemHTML(ch) {
  const isActive = state.activeTab === ch.id;
  const chIdx = state.chapters.indexOf(ch) + 1;
  return `
    <div class="chapter-item${isActive ? ' active' : ''}" id="chItem_${ch.id}" onclick="switchTab('${ch.id}')">
      <span class="chapter-num">Ch.${chIdx}</span>
      <input type="text" class="chapter-title-edit" value="${escHtml(ch.title)}"
        onclick="event.stopPropagation()"
        oninput="updateChapterTitle('${ch.id}', this.value)"
        onfocus="switchTab('${ch.id}')"
        placeholder="Chapter title…"
      />
      <button class="btn-delete-chapter" title="Delete" onclick="removeChapter('${ch.id}',event)">✕</button>
    </div>`;
}

// ===== EDITOR TABS =====
function createEditorTab(ch) {
  const tabsRow = document.getElementById('editorTabs');
  const editorContent = document.getElementById('editorContent');
  const tabBtn = document.createElement('button');
  tabBtn.className = 'tab-btn';
  tabBtn.dataset.tab = ch.id;
  tabBtn.title = ch.title;
  tabBtn.textContent = ch.title || 'Ch.';
  tabBtn.onclick = () => switchTab(ch.id);
  tabsRow.appendChild(tabBtn);

  const tabDiv = document.createElement('div');
  tabDiv.className = 'tab-content';
  tabDiv.id = `tab-${ch.id}`;
  tabDiv.innerHTML = `
    <div class="rich-editor-wrap">
      <div class="chapter-heading-bar">
        <span class="ch-heading-label">Chapter Title:</span>
        <input class="ch-title-input" type="text" placeholder="Enter chapter title…"
          value="${escHtml(ch.title)}"
          oninput="updateChapterTitle('${ch.id}', this.value)"
          style="color:#1a1228 !important;"
        />
      </div>
      <div class="rich-editor" id="editor_${ch.id}"
        contenteditable="true"
        lang="hi"
        dir="auto"
        data-placeholder="Start writing or paste your content here… (Hindi/English both supported)"
        oninput="onEditorInput('${ch.id}')"
      >${ch.content}</div>
    </div>`;
  editorContent.appendChild(tabDiv);
}

function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  const tabContent = document.getElementById(`tab-${id}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');
  state.activeTab = id;
  document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  const chItem = document.getElementById(`chItem_${id}`);
  if (chItem) { chItem.classList.add('active'); chItem.scrollIntoView({ block: 'nearest' }); }
  updateWordCount();
}

// B1: NO renderChapterList() — only surgical DOM updates to prevent focus loss
function updateChapterTitle(id, val) {
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  ch.title = val;

  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  if (tabBtn) { tabBtn.textContent = val || 'Ch.'; tabBtn.title = val; }

  const sideInput = document.querySelector(`#chItem_${id} .chapter-title-edit`);
  if (sideInput && document.activeElement !== sideInput) sideInput.value = val;

  const headInput = document.querySelector(`#tab-${id} .ch-title-input`);
  if (headInput && document.activeElement !== headInput) headInput.value = val;

  scheduleAutoSave();
}

function onEditorInput(id) {
  const editor = document.getElementById(`editor_${id}`);
  if (!editor) return;
  const ch = state.chapters.find(c => c.id === id);
  if (ch) ch.content = editor.innerHTML;
  updateWordCount();
  scheduleAutoSave();
}

// ===== RICH TEXT COMMANDS =====
function execFormat(cmd, val) {
  document.execCommand(cmd, false, val || null);
  focusActiveEditor();
}
function focusActiveEditor() {
  const active = document.querySelector('.tab-content.active .rich-editor');
  if (active) active.focus();
}
function insertLink() {
  const url = prompt('Enter URL:', 'https://');
  if (url) execFormat('createLink', url);
}
function insertImageUrl() {
  const url = prompt('Enter image URL:');
  if (url) execFormat('insertImage', url);
}
function insertTable() {
  const rows = parseInt(prompt('Number of rows:', '3') || '3');
  const cols = parseInt(prompt('Number of columns:', '3') || '3');
  if (isNaN(rows) || isNaN(cols)) return;
  let tbl = '<table><tbody>';
  for (let r = 0; r < rows; r++) {
    tbl += '<tr>';
    for (let c = 0; c < cols; c++) tbl += r === 0 ? '<th>Header</th>' : '<td>Cell</td>';
    tbl += '</tr>';
  }
  tbl += '</tbody></table><p></p>';
  execFormat('insertHTML', tbl);
}
function insertPageBreak() {
  execFormat('insertHTML', '<div class="page-break"></div><p></p>');
}

// ===== WORD COUNT =====
function updateWordCount() {
  const active = document.querySelector('.tab-content.active .rich-editor');
  const text = active ? (active.innerText || '') : '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const el1 = document.getElementById('wordCountDisplay');
  const el2 = document.getElementById('charCountDisplay');
  if (el1) el1.textContent = `Words: ${words.toLocaleString()}`;
  if (el2) el2.textContent = `Characters: ${text.length.toLocaleString()}`;
}

function showWordCount() {
  let totalWords = 0, totalChars = 0;
  state.chapters.forEach(ch => {
    const tmp = document.createElement('div');
    tmp.innerHTML = ch.content;
    const t = tmp.innerText || '';
    totalWords += t.trim() ? t.trim().split(/\s+/).length : 0;
    totalChars += t.length;
  });
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-item"><div class="stat-num">${state.chapters.length}</div><div class="stat-label">Chapters</div></div>
    <div class="stat-item"><div class="stat-num">${state.units.length}</div><div class="stat-label">Units</div></div>
    <div class="stat-item"><div class="stat-num">${totalWords.toLocaleString()}</div><div class="stat-label">Total Words</div></div>
    <div class="stat-item"><div class="stat-num">${totalChars.toLocaleString()}</div><div class="stat-label">Characters</div></div>
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords / 250)}</div><div class="stat-label">Est. Pages</div></div>
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords / 70000 * 100)}%</div><div class="stat-label">Novel Progress</div></div>
  `;
  document.getElementById('wordCountModal').classList.add('active');
}

// ===== FORMAT =====
function setFormat(fmt) {
  state.exportFormat = fmt;
  document.getElementById('fmtPDF').classList.toggle('active', fmt === 'pdf');
  document.getElementById('fmtEPUB').classList.toggle('active', fmt === 'epub');
  document.getElementById('exportBtnText').textContent = fmt === 'pdf' ? 'Generate PDF' : 'Generate EPUB';
}

// ===== PREVIEW =====
function togglePreview() {
  const modal = document.getElementById('previewModal');
  if (!modal.classList.contains('active')) buildPreview();
  modal.classList.toggle('active');
}

function buildPreview() {
  const previewBody = document.getElementById('previewBody');
  const bookTitle = document.getElementById('bookTitle').value || 'Untitled Book';
  const subtitle  = document.getElementById('bookSubtitle').value;
  const author    = document.getElementById('authorName').value || 'Author';
  const showHeader = document.getElementById('showRunningHeader').checked;
  let html = '';
  let pageNum = 0;

  // F1: suppressHeader = true for title/copyright/TOC pages
  function pageWrap(content, chapterTitle, suppressHeader = false) {
    pageNum++;
    const isEven = pageNum % 2 === 0;
    let headerBar = '';
    if (showHeader && !suppressHeader) {
      headerBar = isEven
        ? `<div class="preview-header-bar"><span>${escHtml(bookTitle)}</span><span></span></div>`
        : `<div class="preview-header-bar"><span></span><span>${escHtml(chapterTitle)}</span></div>`;
    }
    return `<div class="preview-page">${headerBar}${content}</div>`;
  }

  if (state.coverImageDataUrl) {
    html += `<div class="preview-page" style="padding:0;overflow:hidden;"><img src="${state.coverImageDataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Cover" /></div>`;
    pageNum++;
  }
  if (document.getElementById('hasTitlePage').checked) {
    html += pageWrap(`<div class="preview-title-page"><div class="preview-book-title">${escHtml(bookTitle)}</div>${subtitle ? `<div class="preview-book-subtitle">${escHtml(subtitle)}</div>` : ''}<div class="preview-author">— ${escHtml(author)} —</div></div>`, 'Title Page', true);
  }
  if (document.getElementById('hasCopyrightPage').checked) {
    const edEl = document.getElementById('copyrightEditor');
    html += pageWrap(`<div class="preview-chapter-title">Copyright</div><div>${edEl ? edEl.innerHTML : ''}</div>`, 'Copyright', true);
  }
  const frontSecs = [
    { key:'hasDedication',      label:'Dedication',       edId:'dedicationEditor' },
    { key:'hasForeword',        label:'Foreword',         edId:'forewordEditor' },
    { key:'hasPreface',         label:'Preface',          edId:'prefaceEditor' },
    { key:'hasAcknowledgements',label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction',    label:'Introduction',     edId:'introEditor' },
  ];
  frontSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    html += pageWrap(`<div class="preview-chapter-title">${escHtml(sec.label)}</div><div>${edEl ? edEl.innerHTML : ''}</div>`, sec.label);
  });
  if (document.getElementById('hasTOC').checked) {
    let toc = '<div class="preview-chapter-title">Table of Contents</div><ul>';
    state.chapters.forEach((ch, i) => { toc += `<li>Chapter ${i + 1} — ${escHtml(ch.title)}</li>`; });
    toc += '</ul>';
    html += pageWrap(toc, 'Table of Contents', true);
  }
  state.chapters.forEach((ch, i) => {
    html += pageWrap(`<div class="preview-chapter-num">Chapter ${i + 1}</div><div class="preview-chapter-title">${escHtml(ch.title || 'Untitled')}</div><div>${ch.content || '<p><em>No content yet</em></p>'}</div>`, ch.title || `Chapter ${i + 1}`);
  });
  const backSecs = [
    { key:'hasEpilogue',    label:'Epilogue',         edId:'epilogueEditor' },
    { key:'hasAfterword',   label:'Afterword',        edId:'afterwordEditor' },
    { key:'hasGlossary',    label:'Glossary',         edId:'glossaryEditor' },
    { key:'hasBibliography',label:'Bibliography',     edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author', edId:'aboutEditor' },
    { key:'hasColophon',    label:'Colophon',         edId:'colophonEditor' },
  ];
  backSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    html += pageWrap(`<div class="preview-chapter-title">${escHtml(sec.label)}</div><div>${edEl ? edEl.innerHTML : ''}</div>`, sec.label);
  });
  previewBody.innerHTML = html || '<p style="color:#888;padding:40px;text-align:center;">No content to preview yet.</p>';
}

// ===== FULLSCREEN =====
function toggleFullscreen() {
  const panel = document.getElementById('panelRight');
  if (!panel._fs) {
    panel._fs = true;
    panel.style.cssText = 'position:fixed;inset:0;z-index:999;border-radius:0;max-height:100vh;';
  } else {
    panel._fs = false;
    panel.style.cssText = '';
  }
}

// ===== EXPORT =====
async function exportBook() {
  const title  = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('authorName').value.trim();
  if (!title)  { showToast('⚠️ Please enter a Book Title (required)', 'error');  document.getElementById('bookTitle').focus();  return; }
  if (!author) { showToast('⚠️ Please enter an Author Name (required)', 'error'); document.getElementById('authorName').focus(); return; }

  document.getElementById('exportBtnText').textContent = 'Generating…';
  document.getElementById('exportSpinner').style.display = 'inline';
  try {
    if (state.exportFormat === 'pdf') await exportPDF();
    else exportEPUB();
  } catch (err) {
    console.error(err);
    showToast('Export failed. See console for details.', 'error');
  }
  document.getElementById('exportBtnText').textContent = state.exportFormat === 'pdf' ? 'Generate PDF' : 'Generate EPUB';
  document.getElementById('exportSpinner').style.display = 'none';
}

// ===== PDF EXPORT =====
async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const pageSizeMap = { A4:[210,297], A5:[148,210], Letter:[215.9,279.4], '6x9':[152.4,228.6], '5x8':[127,203.2] };
  const [pw, ph] = pageSizeMap[document.getElementById('pageSize').value] || [148, 210];
  const doc = new jsPDF({ unit:'mm', format:[pw,ph], orientation:'portrait' });

  const bookTitle    = document.getElementById('bookTitle').value || 'Untitled Book';
  const subtitle     = document.getElementById('bookSubtitle').value || '';
  const author       = document.getElementById('authorName').value || '';
  const publisher    = document.getElementById('publisherName').value || '';
  const year         = document.getElementById('pubYear').value || new Date().getFullYear();
  const isbn         = document.getElementById('isbnNum').value || '';
  const edition      = document.getElementById('editionNum').value || '';
  const fontSize     = parseInt(document.getElementById('fontSize').value) || 11;
  const lineSpacing  = parseFloat(document.getElementById('lineSpacing').value) || 1.5;
  const showHeader   = document.getElementById('showRunningHeader').checked;
  const showPageNums = document.getElementById('showPageNumbers').checked;
  const chNewPage    = document.getElementById('chapterNewPage').checked;
  const margin       = parseInt(document.getElementById('marginSize').value) || 20;
  const chStyle      = document.getElementById('chapterStyle').value;
  const themeMap     = { black:'#1a1228', navy:'#1a2744', sepia:'#3d2b1f', forest:'#1a2e1a' };
  const headingColor = themeMap[document.getElementById('colorTheme').value] || '#1a1228';
  const lineH        = fontSize * lineSpacing * 0.352778;
  let pageNum = 0;
  let currentChapterTitle = '';
  // F1: suppress header on specific pages (title, copyright, TOC, unit dividers)
  let suppressHeader = false;

  function newPage(isFirst = false) {
    if (!isFirst) doc.addPage([pw, ph]);
    pageNum++;
  }

  // F1: Header only drawn when suppressHeader = false
  function drawRunningHeader() {
    if (!showHeader || suppressHeader) return;
    doc.setFont('times', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    if (pageNum % 2 === 0) {
      doc.text(bookTitle, margin, margin - 5, { maxWidth: pw - 2 * margin });
    } else {
      doc.text(currentChapterTitle, pw - margin, margin - 5, { align:'right', maxWidth: pw - 2 * margin });
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, margin - 3, pw - margin, margin - 3);
  }

  function drawPageNum() {
    if (!showPageNums) return;
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(String(pageNum), pw / 2, ph - 7, { align:'center' });
  }

  function getTopY() { return margin + (showHeader && !suppressHeader ? 10 : 4); }

  function writeLines(text, x, y, opts = {}) {
    if (!text || !text.trim()) return y;
    const maxW = opts.maxWidth || (pw - 2 * margin);
    const sz   = opts.size  || fontSize;
    const fam  = opts.font  || 'times';
    const sty  = opts.style || 'normal';
    doc.setFont(fam, sty);
    doc.setFontSize(sz);
    doc.setTextColor(opts.color || '#222222');
    const lines = doc.splitTextToSize(text, maxW);
    const lh = sz * lineSpacing * 0.352778;
    for (const line of lines) {
      if (y > ph - margin - 10) { drawPageNum(); newPage(); y = getTopY(); drawRunningHeader(); }
      doc.text(line, x, y);
      y += lh;
    }
    return y;
  }

  function htmlToPlainText(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    el.querySelectorAll('p,br,div,h1,h2,h3,h4,li').forEach(n => { n.prepend('\n'); });
    return el.innerText || el.textContent || '';
  }

  // B2: COVER — full page, no header, no page number
  if (state.coverImageDataUrl) {
    newPage(true);
    suppressHeader = true;
    doc.addImage(state.coverImageDataUrl, getImageType(state.coverImageDataUrl), 0, 0, pw, ph, '', 'FAST');
    suppressHeader = false;
  }

  // TITLE PAGE — F1: no running header
  if (document.getElementById('hasTitlePage').checked) {
    if (pageNum === 0) newPage(true); else newPage();
    suppressHeader = true; // F1
    let ty = ph / 3;
    doc.setFont('times', 'bold');
    doc.setFontSize(Math.min(24, pw / 6.5));
    doc.setTextColor(headingColor);
    doc.text(bookTitle, pw / 2, ty, { align:'center', maxWidth: pw - 2 * margin });
    ty += 11;
    if (subtitle) {
      doc.setFont('times', 'italic');
      doc.setFontSize(13);
      doc.setTextColor(100, 80, 60);
      doc.text(subtitle, pw / 2, ty, { align:'center', maxWidth: pw - 2 * margin });
      ty += 8;
    }
    if (author) {
      ty += 10;
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text(author, pw / 2, ty, { align:'center' });
    }
    if (publisher || year) {
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text(`${publisher}${publisher && year ? ' · ' : ''}${year}`, pw / 2, ph - margin - 10, { align:'center' });
    }
    if (edition) {
      doc.setFontSize(8.5);
      doc.text(edition, pw / 2, ph - margin - 4, { align:'center' });
    }
    drawPageNum();
    suppressHeader = false;
  }

  // COPYRIGHT PAGE — F1: no header; F3: use editor content; F4: no watermark
  if (document.getElementById('hasCopyrightPage').checked) {
    newPage();
    suppressHeader = true; // F1
    let cy = getTopY();
    const copyrightEditorEl = document.getElementById('copyrightEditor');
    const copyrightText = htmlToPlainText(copyrightEditorEl ? copyrightEditorEl.innerHTML : '');
    if (copyrightText.trim()) {
      // F3: Use user's editable content
      const paras = copyrightText.split(/\n\n+/).filter(p => p.trim());
      for (const para of paras) {
        cy = writeLines(para.trim(), margin, cy, { size: 9 });
        cy += 2;
      }
    } else {
      // Fallback if editor is empty — F4: no watermark
      const lines = [
        `Copyright © ${year} ${author || 'Author'}`,
        'All rights reserved.',
        '',
        isbn ? `ISBN: ${isbn}` : null,
        '',
        'No part of this publication may be reproduced without written permission.',
        publisher ? `\nPublished by ${publisher}` : null,
      ].filter(l => l !== null);
      for (const line of lines) {
        cy = writeLines(line, margin, cy, { size: 9 });
        if (!line) cy += 2;
      }
    }
    drawPageNum();
    suppressHeader = false;
  }

  // FRONT MATTER SECTIONS
  const frontSecs = [
    { key:'hasDedication',       label:'Dedication',       edId:'dedicationEditor' },
    { key:'hasForeword',         label:'Foreword',         edId:'forewordEditor' },
    { key:'hasPreface',          label:'Preface',          edId:'prefaceEditor' },
    { key:'hasAcknowledgements', label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction',     label:'Introduction',     edId:'introEditor' },
  ];
  for (const sec of frontSecs) {
    if (!document.getElementById(sec.key)?.checked) continue;
    newPage();
    suppressHeader = false;
    currentChapterTitle = sec.label;
    drawRunningHeader();
    let sy = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text(sec.label, pw / 2, sy, { align:'center' });
    sy += 10;
    const editorEl = document.getElementById(sec.edId);
    const content = htmlToPlainText(editorEl ? editorEl.innerHTML : '');
    for (const para of content.split(/\n\n+/).filter(p => p.trim())) {
      sy = writeLines(para.trim(), margin, sy);
      sy += lineH * 0.3;
    }
    drawPageNum();
  }

  // TABLE OF CONTENTS — F1: no running header
  if (document.getElementById('hasTOC').checked && state.chapters.length > 0) {
    newPage();
    suppressHeader = true; // F1
    let ty = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text('Table of Contents', pw / 2, ty, { align:'center' });
    ty += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(fontSize);
    state.chapters.forEach((ch, i) => {
      ty = writeLines(`Chapter ${i + 1}  —  ${ch.title || 'Untitled'}`, margin, ty);
    });
    drawPageNum();
    suppressHeader = false;
  }

  // CHAPTERS
  for (let i = 0; i < state.chapters.length; i++) {
    const ch = state.chapters[i];

    // Unit divider page — no header
    if (document.getElementById('useUnits').checked && ch.unitId) {
      const unit = state.units.find(u => u.id === ch.unitId);
      const isFirstOfUnit = state.chapters.filter(c => c.unitId === ch.unitId).indexOf(ch) === 0;
      if (isFirstOfUnit && unit) {
        newPage();
        suppressHeader = true;
        let uy = ph / 2 - 20;
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 150, 80);
        const unitIdx = state.units.indexOf(unit);
        doc.text(`UNIT ${unitIdx + 1}`, pw / 2, uy - 12, { align:'center' });
        doc.setFontSize(22);
        doc.setTextColor(headingColor);
        doc.text(unit.title || `Unit ${unitIdx + 1}`, pw / 2, uy, { align:'center', maxWidth: pw - 2 * margin });
        suppressHeader = false;
      }
    }

    if (chNewPage || i === 0) newPage(pageNum === 0);
    suppressHeader = false;
    currentChapterTitle = ch.title || `Chapter ${i + 1}`;
    drawRunningHeader();
    let cy = getTopY();
    doc.setTextColor(headingColor);

    // F2: All 4 heading styles — ASCII-safe, no broken Unicode chars
    if (chStyle === 'classic') {
      doc.setFont('times', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(150, 140, 120);
      doc.text(`CHAPTER ${i + 1}`, pw / 2, cy, { align:'center' });
      cy += 7;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(18, pw / 8));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i + 1}`, pw / 2, cy, { align:'center', maxWidth: pw - 2 * margin });
      cy += 12;
      doc.setDrawColor(200, 180, 120);
      doc.setLineWidth(0.4);
      doc.line(margin + pw * 0.2, cy, pw - margin - pw * 0.2, cy);
      cy += 8;

    } else if (chStyle === 'modern') {
      doc.setFont('times', 'bold');
      doc.setFontSize(52);
      doc.setTextColor(220, 200, 160);
      doc.text(String(i + 1), margin, cy + 14);
      doc.setFontSize(Math.min(14, pw / 11));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i + 1}`, margin + 28, cy + 8, { maxWidth: pw - margin - 36 });
      cy += 22;
      doc.setDrawColor(200, 190, 150);
      doc.setLineWidth(0.3);
      doc.line(margin, cy, pw - margin, cy);
      cy += 8;

    } else if (chStyle === 'minimal') {
      cy += 8;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(16, pw / 9));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i + 1}`, pw / 2, cy, { align:'center', maxWidth: pw - 2 * margin });
      cy += 16;

    } else if (chStyle === 'ornate') {
      // F2: Use ASCII-safe decoration + doc.line() — no broken Unicode
      doc.setDrawColor(200, 160, 80);
      doc.setLineWidth(0.5);
      const cx = pw / 2;
      // Top decorative line with center gap
      doc.line(margin + 10, cy + 2, cx - 12, cy + 2);
      doc.line(cx + 12, cy + 2, pw - margin - 10, cy + 2);
      // Center diamond drawn with filled rect rotated — use text asterisk safely
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 160, 80);
      doc.text('*', cx - 1.5, cy + 4);
      cy += 9;
      doc.setFontSize(8);
      doc.setTextColor(150, 130, 80);
      doc.text(`CHAPTER ${i + 1}`, pw / 2, cy, { align:'center' });
      cy += 7;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(16, pw / 9));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i + 1}`, pw / 2, cy, { align:'center', maxWidth: pw - 2 * margin });
      cy += 8;
      // Bottom decorative line
      doc.setDrawColor(200, 160, 80);
      doc.setLineWidth(0.5);
      doc.line(margin + 10, cy, cx - 12, cy);
      doc.line(cx + 12, cy, pw - margin - 10, cy);
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 160, 80);
      doc.text('*', cx - 1.5, cy + 2);
      cy += 10;
    }

    // Chapter content
    const plainText = htmlToPlainText(ch.content || '');
    doc.setTextColor('#222222');
    for (const para of plainText.split(/\n\n+/).filter(p => p.trim())) {
      cy = writeLines(para.replace(/\n/g, ' ').trim(), margin, cy);
      cy += lineH * 0.3;
    }
    drawPageNum();
  }

  // BACK MATTER
  const backSecs = [
    { key:'hasEpilogue',    label:'Epilogue',                  edId:'epilogueEditor' },
    { key:'hasAfterword',   label:'Afterword',                 edId:'afterwordEditor' },
    { key:'hasGlossary',    label:'Glossary',                  edId:'glossaryEditor' },
    { key:'hasBibliography',label:'Bibliography / References', edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author',          edId:'aboutEditor' },
  ];
  for (const sec of backSecs) {
    if (!document.getElementById(sec.key)?.checked) continue;
    newPage();
    suppressHeader = false;
    currentChapterTitle = sec.label;
    drawRunningHeader();
    let sy = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text(sec.label, pw / 2, sy, { align:'center' });
    sy += 10;
    const editorEl = document.getElementById(sec.edId);
    const content = htmlToPlainText(editorEl ? editorEl.innerHTML : '');
    for (const para of content.split(/\n\n+/).filter(p => p.trim())) {
      sy = writeLines(para.trim(), margin, sy);
      sy += lineH * 0.3;
    }
    drawPageNum();
  }

  // INDEX
  if (document.getElementById('hasIndex')?.checked) {
    newPage();
    suppressHeader = false;
    currentChapterTitle = 'Index';
    drawRunningHeader();
    let iy = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text('Index', pw / 2, iy, { align:'center' });
    iy += 12;
    state.chapters.forEach((ch, i) => {
      iy = writeLines(`Chapter ${i + 1}: ${ch.title || 'Untitled'}`, margin, iy, { size: 9 });
    });
    drawPageNum();
  }

  // COLOPHON — F4/F5: user's content only, no auto watermark
  if (document.getElementById('hasColophon')?.checked) {
    newPage();
    suppressHeader = false;
    currentChapterTitle = 'Colophon';
    drawRunningHeader();
    let col = getTopY();
    const colEditor = document.getElementById('colophonEditor');
    const colText = htmlToPlainText(colEditor ? colEditor.innerHTML : '');
    if (colText.trim()) {
      for (const para of colText.split(/\n\n+/).filter(p => p.trim())) {
        col = writeLines(para.trim(), margin, col, { size: 9, style: 'normal' });
        col += lineH * 0.3;
      }
    }
    drawPageNum();
  }

  const safeTitle = bookTitle.replace(/[^a-zA-Z0-9 _\u0900-\u097F-]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_AuthorPro.pdf`);
  showToast('✅ PDF downloaded successfully!', 'success');
}

// ===== EPUB EXPORT — F4: no watermark =====
function exportEPUB() {
  const bookTitle = document.getElementById('bookTitle').value || 'Untitled Book';
  const author    = document.getElementById('authorName').value || 'Unknown Author';
  const publisher = document.getElementById('publisherName').value || '';
  const year      = document.getElementById('pubYear').value || new Date().getFullYear();
  const isbn      = document.getElementById('isbnNum').value || '';

  const css = `
    body{font-family:'Noto Serif','Noto Sans',Georgia,serif;font-size:1em;line-height:1.8;margin:2em 1.5em;color:#1a1228;}
    h1{font-size:1.9em;text-align:center;margin:1em 0 0.6em;}
    h2{font-size:1.4em;margin:0.8em 0 0.4em;}
    h3{font-size:1.1em;}
    .chapter-num{font-size:0.72em;text-transform:uppercase;letter-spacing:0.15em;color:#888;text-align:center;margin-bottom:0.3em;}
    .title-page{text-align:center;padding:4em 0;}
    blockquote{border-left:3px solid #c9a84c;padding-left:1em;font-style:italic;color:#555;}
    p{margin:0 0 0.9em;}
    table{width:100%;border-collapse:collapse;}
    td,th{border:1px solid #ddd;padding:0.4em 0.7em;}
    .page-break{page-break-after:always;}
  `;

  let fullHtml = `<!DOCTYPE html>
<html lang="hi" xml:lang="hi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(bookTitle)}</title>
<meta name="author" content="${escHtml(author)}"/>
${isbn ? `<meta name="isbn" content="${escHtml(isbn)}"/>` : ''}
<style>${css}</style>
</head>
<body>`;

  if (state.coverImageDataUrl) {
    fullHtml += `<div class="page-break" style="text-align:center;"><img src="${state.coverImageDataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" alt="Cover"/></div>`;
  }
  if (document.getElementById('hasTitlePage').checked) {
    fullHtml += `<div class="title-page page-break"><h1>${escHtml(bookTitle)}</h1>`;
    const sub = document.getElementById('bookSubtitle').value;
    if (sub) fullHtml += `<p><em>${escHtml(sub)}</em></p>`;
    fullHtml += `<p>— ${escHtml(author)} —</p>`;
    if (publisher) fullHtml += `<p>${escHtml(publisher)}</p>`;
    fullHtml += `<p>${year}</p>`;
    if (isbn) fullHtml += `<p>ISBN: ${escHtml(isbn)}</p>`;
    fullHtml += `</div>`;
  }
  // F3/F4: Copyright — use editor content, no watermark
  if (document.getElementById('hasCopyrightPage').checked) {
    const edEl = document.getElementById('copyrightEditor');
    const content = edEl && edEl.innerHTML.trim() ? edEl.innerHTML : `<p>Copyright &copy; ${year} ${escHtml(author)}</p><p>All rights reserved.</p>`;
    fullHtml += `<div class="page-break"><h1>Copyright</h1>${content}</div>`;
  }
  const frontSecs = [
    { key:'hasDedication',       label:'Dedication',       edId:'dedicationEditor' },
    { key:'hasForeword',         label:'Foreword',         edId:'forewordEditor' },
    { key:'hasPreface',          label:'Preface',          edId:'prefaceEditor' },
    { key:'hasAcknowledgements', label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction',     label:'Introduction',     edId:'introEditor' },
  ];
  frontSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    fullHtml += `<div class="page-break"><h1>${escHtml(sec.label)}</h1>${edEl ? edEl.innerHTML : ''}</div>`;
  });
  if (document.getElementById('hasTOC').checked && state.chapters.length > 0) {
    fullHtml += `<div class="page-break"><h1>Table of Contents</h1><ul>`;
    state.chapters.forEach((ch, i) => { fullHtml += `<li>Chapter ${i + 1} — ${escHtml(ch.title || 'Untitled')}</li>`; });
    fullHtml += `</ul></div>`;
  }
  state.chapters.forEach((ch, i) => {
    fullHtml += `<div class="page-break"><p class="chapter-num">Chapter ${i + 1}</p><h1>${escHtml(ch.title || `Chapter ${i + 1}`)}</h1>${ch.content || '<p></p>'}</div>`;
  });
  const backSecs = [
    { key:'hasEpilogue',    label:'Epilogue',         edId:'epilogueEditor' },
    { key:'hasAfterword',   label:'Afterword',        edId:'afterwordEditor' },
    { key:'hasGlossary',    label:'Glossary',         edId:'glossaryEditor' },
    { key:'hasBibliography',label:'Bibliography',     edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author', edId:'aboutEditor' },
  ];
  backSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    fullHtml += `<div class="page-break"><h1>${escHtml(sec.label)}</h1>${edEl ? edEl.innerHTML : ''}</div>`;
  });
  // F4/F5: Colophon — user content only, no AuthorPro text
  if (document.getElementById('hasColophon')?.checked) {
    const colEl = document.getElementById('colophonEditor');
    if (colEl && colEl.innerHTML.trim()) {
      fullHtml += `<div class="page-break"><h1>Colophon</h1>${colEl.innerHTML}</div>`;
    }
  }
  fullHtml += '</body></html>';

  const blob = new Blob([fullHtml], { type:'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = bookTitle.replace(/[^a-zA-Z0-9 \u0900-\u097F_-]/g, '').replace(/\s+/g, '_');
  a.href = url; a.download = `${safeTitle}_AuthorPro_ebook.html`; a.click();
  URL.revokeObjectURL(url);
  showToast('📱 EPUB (HTML) downloaded! Import into Calibre to convert to .epub/.mobi', 'success');
}

// ===== SAVE / LOAD =====
function saveProgress() {
  syncEditorsToState();
  const data = {
    version: '2.2', savedAt: new Date().toISOString(),
    meta: {
      bookTitle:     document.getElementById('bookTitle').value,
      bookSubtitle:  document.getElementById('bookSubtitle').value,
      authorName:    document.getElementById('authorName').value,
      publisherName: document.getElementById('publisherName').value,
      pubYear:       document.getElementById('pubYear').value,
      isbnNum:       document.getElementById('isbnNum').value,
      editionNum:    document.getElementById('editionNum').value,
    },
    sections: {
      hasTitlePage:        document.getElementById('hasTitlePage').checked,
      hasCopyrightPage:    document.getElementById('hasCopyrightPage').checked,
      hasDedication:       document.getElementById('hasDedication').checked,
      hasForeword:         document.getElementById('hasForeword').checked,
      hasPreface:          document.getElementById('hasPreface').checked,
      hasAcknowledgements: document.getElementById('hasAcknowledgements').checked,
      hasTOC:              document.getElementById('hasTOC').checked,
      hasIntroduction:     document.getElementById('hasIntroduction').checked,
      hasEpilogue:         document.getElementById('hasEpilogue').checked,
      hasAfterword:        document.getElementById('hasAfterword').checked,
      hasGlossary:         document.getElementById('hasGlossary').checked,
      hasBibliography:     document.getElementById('hasBibliography').checked,
      hasIndex:            document.getElementById('hasIndex').checked,
      hasAboutAuthor:      document.getElementById('hasAboutAuthor').checked,
      hasColophon:         document.getElementById('hasColophon').checked,
    },
    frontEditors: {
      copyright:  document.getElementById('copyrightEditor')?.innerHTML  || '',
      dedication: document.getElementById('dedicationEditor')?.innerHTML || '',
      foreword:   document.getElementById('forewordEditor')?.innerHTML   || '',
      preface:    document.getElementById('prefaceEditor')?.innerHTML    || '',
      ack:        document.getElementById('ackEditor')?.innerHTML        || '',
      intro:      document.getElementById('introEditor')?.innerHTML      || '',
      epilogue:   document.getElementById('epilogueEditor')?.innerHTML   || '',
      afterword:  document.getElementById('afterwordEditor')?.innerHTML  || '',
      glossary:   document.getElementById('glossaryEditor')?.innerHTML   || '',
      bib:        document.getElementById('bibEditor')?.innerHTML        || '',
      about:      document.getElementById('aboutEditor')?.innerHTML      || '',
      colophon:   document.getElementById('colophonEditor')?.innerHTML   || '',
    },
    settings: {
      useUnits:          document.getElementById('useUnits').checked,
      pageSize:          document.getElementById('pageSize').value,
      fontSize:          document.getElementById('fontSize').value,
      lineSpacing:       document.getElementById('lineSpacing').value,
      marginSize:        document.getElementById('marginSize').value,
      chapterStyle:      document.getElementById('chapterStyle').value,
      colorTheme:        document.getElementById('colorTheme').value,
      showPageNumbers:   document.getElementById('showPageNumbers').checked,
      showRunningHeader: document.getElementById('showRunningHeader').checked,
      chapterNewPage:    document.getElementById('chapterNewPage').checked,
    },
    units: state.units,
    chapters: state.chapters,
    chapterCounter: state.chapterCounter,
    unitCounter: state.unitCounter,
    coverImageDataUrl: state.coverImageDataUrl,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${data.meta.bookTitle || 'manuscript'}_AuthorPro.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Progress saved!', 'success');
}

function loadProgress() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { restoreFromData(JSON.parse(ev.target.result)); showToast('📂 Project loaded!', 'success'); }
      catch (err) { showToast('Error loading file. Invalid format.', 'error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function restoreFromData(data) {
  if (data.meta) {
    Object.entries(data.meta).forEach(([k, v]) => {
      const el = document.getElementById(k); if (el) el.value = v;
    });
  }
  if (data.sections) {
    Object.entries(data.sections).forEach(([k, v]) => {
      const el = document.getElementById(k); if (el) el.checked = v;
    });
  }
  if (data.frontEditors) {
    const map = {
      copyright:  'copyrightEditor',
      dedication: 'dedicationEditor',
      foreword:   'forewordEditor',
      preface:    'prefaceEditor',
      ack:        'ackEditor',
      intro:      'introEditor',
      epilogue:   'epilogueEditor',
      afterword:  'afterwordEditor',
      glossary:   'glossaryEditor',
      bib:        'bibEditor',
      about:      'aboutEditor',
      colophon:   'colophonEditor',
    };
    Object.entries(data.frontEditors).forEach(([k, v]) => {
      const el = document.getElementById(map[k]); if (el) el.innerHTML = v;
    });
    // Show wraps for checked sections
    if (data.sections) {
      const wrapMap = {
        hasCopyrightPage:    'copyrightEditorWrap',
        hasDedication:       'dedicationEditorWrap',
        hasForeword:         'forewordEditorWrap',
        hasPreface:          'prefaceEditorWrap',
        hasAcknowledgements: 'ackEditorWrap',
        hasIntroduction:     'introEditorWrap',
        hasEpilogue:         'epilogueEditorWrap',
        hasAfterword:        'afterwordEditorWrap',
        hasGlossary:         'glossaryEditorWrap',
        hasBibliography:     'bibEditorWrap',
        hasAboutAuthor:      'aboutEditorWrap',
        hasColophon:         'colophonEditorWrap',
      };
      Object.entries(wrapMap).forEach(([sec, wrapId]) => {
        const wrap = document.getElementById(wrapId);
        if (wrap && data.sections[sec]) wrap.classList.add('visible');
      });
    }
  }
  if (data.settings) {
    const s = data.settings;
    if (s.useUnits !== undefined) document.getElementById('useUnits').checked = s.useUnits;
    ['pageSize','fontSize','lineSpacing','marginSize','chapterStyle','colorTheme'].forEach(k => {
      const el = document.getElementById(k); if (el && s[k]) el.value = s[k];
    });
    ['showPageNumbers','showRunningHeader','chapterNewPage'].forEach(k => {
      const el = document.getElementById(k); if (el && s[k] !== undefined) el.checked = s[k];
    });
  }
  if (data.coverImageDataUrl) {
    state.coverImageDataUrl = data.coverImageDataUrl;
    document.getElementById('coverPreview').src = data.coverImageDataUrl;
    document.getElementById('coverPreviewWrap').style.display = 'block';
  }
  state.units = data.units || [];
  state.chapters = [];
  state.chapterCounter = data.chapterCounter || 0;
  state.unitCounter    = data.unitCounter    || 0;
  document.querySelectorAll('.tab-btn:not([data-tab="welcome"])').forEach(t => t.remove());
  document.querySelectorAll('.tab-content:not(#tab-welcome)').forEach(t => t.remove());
  renderUnits();
  if (document.getElementById('useUnits').checked) document.getElementById('addUnitBtn').style.display = 'inline-flex';
  (data.chapters || []).forEach(ch => { state.chapters.push(ch); createEditorTab(ch); });
  renderChapterList();
  switchTab(state.chapters.length > 0 ? state.chapters[0].id : 'welcome');
}

function clearAll() {
  if (!confirm('Clear everything and start fresh? Cannot be undone.')) return;
  document.querySelectorAll('.tab-btn:not([data-tab="welcome"])').forEach(t => t.remove());
  document.querySelectorAll('.tab-content:not(#tab-welcome)').forEach(t => t.remove());
  state.chapters = []; state.units = []; state.chapterCounter = 0; state.unitCounter = 0;
  state.coverImageDataUrl = null;
  document.getElementById('coverPreviewWrap').style.display = 'none';
  renderChapterList(); renderUnits();
  switchTab('welcome');
  localStorage.removeItem('authorpro_autosave');
  showToast('🗑️ Everything cleared.', 'success');
}

// ===== AUTO SAVE =====
function scheduleAutoSave() {
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    saveToLocalStorage();
    const ind = document.getElementById('autoSaveIndicator');
    if (ind) { ind.textContent = '✓ Auto-saved'; ind.style.color = '#4ade80'; }
  }, 2500);
}

function syncEditorsToState() {
  state.chapters.forEach(ch => {
    const ed = document.getElementById(`editor_${ch.id}`);
    if (ed) ch.content = ed.innerHTML;
  });
}

function initAutoSave() {
  setInterval(() => { syncEditorsToState(); saveToLocalStorage(); }, 60000);
}

function saveToLocalStorage() {
  try {
    syncEditorsToState();
    localStorage.setItem('authorpro_autosave', JSON.stringify({
      meta: {
        bookTitle: document.getElementById('bookTitle').value,
        bookSubtitle: document.getElementById('bookSubtitle').value,
        authorName: document.getElementById('authorName').value,
        publisherName: document.getElementById('publisherName').value,
        pubYear: document.getElementById('pubYear').value,
        isbnNum: document.getElementById('isbnNum').value,
        editionNum: document.getElementById('editionNum').value,
      },
      sections: {
        hasTitlePage: document.getElementById('hasTitlePage').checked,
        hasCopyrightPage: document.getElementById('hasCopyrightPage').checked,
        hasDedication: document.getElementById('hasDedication').checked,
        hasForeword: document.getElementById('hasForeword').checked,
        hasPreface: document.getElementById('hasPreface').checked,
        hasAcknowledgements: document.getElementById('hasAcknowledgements').checked,
        hasTOC: document.getElementById('hasTOC').checked,
        hasIntroduction: document.getElementById('hasIntroduction').checked,
        hasEpilogue: document.getElementById('hasEpilogue').checked,
        hasAfterword: document.getElementById('hasAfterword').checked,
        hasGlossary: document.getElementById('hasGlossary').checked,
        hasBibliography: document.getElementById('hasBibliography').checked,
        hasIndex: document.getElementById('hasIndex').checked,
        hasAboutAuthor: document.getElementById('hasAboutAuthor').checked,
        hasColophon: document.getElementById('hasColophon').checked,
      },
      frontEditors: {
        copyright:  document.getElementById('copyrightEditor')?.innerHTML  || '',
        dedication: document.getElementById('dedicationEditor')?.innerHTML || '',
        foreword:   document.getElementById('forewordEditor')?.innerHTML   || '',
        preface:    document.getElementById('prefaceEditor')?.innerHTML    || '',
        ack:        document.getElementById('ackEditor')?.innerHTML        || '',
        intro:      document.getElementById('introEditor')?.innerHTML      || '',
        epilogue:   document.getElementById('epilogueEditor')?.innerHTML   || '',
        afterword:  document.getElementById('afterwordEditor')?.innerHTML  || '',
        glossary:   document.getElementById('glossaryEditor')?.innerHTML   || '',
        bib:        document.getElementById('bibEditor')?.innerHTML        || '',
        about:      document.getElementById('aboutEditor')?.innerHTML      || '',
        colophon:   document.getElementById('colophonEditor')?.innerHTML   || '',
      },
      chapters: state.chapters,
      units: state.units,
      chapterCounter: state.chapterCounter,
      unitCounter: state.unitCounter,
      coverImageDataUrl: state.coverImageDataUrl,
    }));
  } catch (e) { /* localStorage full */ }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('authorpro_autosave');
    if (!saved) return;
    const data = JSON.parse(saved);
    if (data.chapters && data.chapters.length > 0) {
      restoreFromData(data);
      showToast('✓ Auto-save restored', 'success');
    }
  } catch (e) { /* ignore */ }
}

// ===== FAQ =====
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  document.querySelectorAll('.faq-a.open').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) { answer.classList.add('open'); btn.classList.add('open'); }
}

// ===== TOAST =====
let _toastTimer;
function showToast(msg, type = '') {
  let t = document.getElementById('_ap_toast');
  if (!t) { t = document.createElement('div'); t.id = '_ap_toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  requestAnimationFrame(() => {
    t.classList.add('show');
    _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  });
}

// ===== UTILITY =====
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.id === 'wordCountModal') e.target.classList.remove('active');
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProgress(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); togglePreview(); }
  if (e.key === 'Escape') {
    document.getElementById('previewModal').classList.remove('active');
    document.getElementById('wordCountModal').classList.remove('active');
  }
});
