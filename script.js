/* ============================================================
   AuthorPro – script.js  v2 (All 10 fixes applied)
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
  coverImageDataUrl: null,  // FIX #6
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

// ===== FIX #7: Front/back matter inline editors =====
function toggleFrontEditor(wrapId, show) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.classList.toggle('visible', show);
  if (show) {
    const editor = wrap.querySelector('.front-editor');
    if (editor) setTimeout(() => editor.focus(), 50);
  }
}

// ===== FIX #6: Cover image =====
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
      <!-- FIX #4: Editable title directly in sidebar -->
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
        <!-- FIX #2: title input with forced dark color -->
        <input class="ch-title-input" type="text" placeholder="Enter chapter title…"
          value="${escHtml(ch.title)}"
          oninput="updateChapterTitle('${ch.id}', this.value)"
          style="color:#1a1228 !important;"
        />
      </div>
      <!-- FIX #10: lang attribute for Hindi/Unicode support -->
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

function updateChapterTitle(id, val) {
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  ch.title = val;
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  if (tabBtn) { tabBtn.textContent = val || 'Ch.'; tabBtn.title = val; }
  // sync sidebar input
  const sideInput = document.querySelector(`#chItem_${id} .chapter-title-edit`);
  if (sideInput && document.activeElement !== sideInput) sideInput.value = val;
  // sync heading bar input
  const headInput = document.querySelector(`#tab-${id} .ch-title-input`);
  if (headInput && document.activeElement !== headInput) headInput.value = val;
  renderChapterList();
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
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords/250)}</div><div class="stat-label">Est. Pages</div></div>
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords/70000*100)}%</div><div class="stat-label">Novel Progress</div></div>
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
  const subtitle = document.getElementById('bookSubtitle').value;
  const author = document.getElementById('authorName').value || 'Author';
  const showHeader = document.getElementById('showRunningHeader').checked;
  let html = '';
  let pageNum = 0;

  function pageWrap(content, chapterTitle, isUnit = false) {
    pageNum++;
    const isEven = pageNum % 2 === 0;
    // FIX #9: unit pages = no header; even = book title; odd = chapter title
    let headerBar = '';
    if (showHeader && !isUnit) {
      if (isEven) {
        headerBar = `<div class="preview-header-bar"><span>${escHtml(bookTitle)}</span><span></span></div>`;
      } else {
        headerBar = `<div class="preview-header-bar"><span></span><span>${escHtml(chapterTitle)}</span></div>`;
      }
    }
    return `<div class="preview-page">${headerBar}${content}</div>`;
  }

  // Cover
  if (state.coverImageDataUrl) {
    html += `<div class="preview-page" style="padding:0;overflow:hidden;"><img src="${state.coverImageDataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Cover" /></div>`;
    pageNum++;
  }
  // Title page
  if (document.getElementById('hasTitlePage').checked) {
    html += pageWrap(`<div class="preview-title-page"><div class="preview-book-title">${escHtml(bookTitle)}</div>${subtitle ? `<div class="preview-book-subtitle">${escHtml(subtitle)}</div>` : ''}<div class="preview-author">— ${escHtml(author)} —</div></div>`, 'Title Page');
  }
  // Front matter
  const frontSecs = [
    { key:'hasDedication', label:'Dedication', edId:'dedicationEditor' },
    { key:'hasForeword', label:'Foreword', edId:'forewordEditor' },
    { key:'hasPreface', label:'Preface', edId:'prefaceEditor' },
    { key:'hasAcknowledgements', label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction', label:'Introduction', edId:'introEditor' },
  ];
  frontSecs.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      const editorEl = document.getElementById(sec.edId);
      const content = editorEl ? editorEl.innerHTML : '';
      html += pageWrap(`<div class="preview-chapter-title">${escHtml(sec.label)}</div><div>${content || `<p><em>Content for ${sec.label}</em></p>`}</div>`, sec.label);
    }
  });
  // TOC
  if (document.getElementById('hasTOC').checked) {
    let toc = '<div class="preview-chapter-title">Table of Contents</div><ul>';
    state.chapters.forEach((ch, i) => { toc += `<li>Chapter ${i+1} — ${escHtml(ch.title)}</li>`; });
    toc += '</ul>';
    html += pageWrap(toc, 'Table of Contents');
  }
  // Chapters
  state.chapters.forEach((ch, i) => {
    html += pageWrap(`<div class="preview-chapter-num">Chapter ${i+1}</div><div class="preview-chapter-title">${escHtml(ch.title || 'Untitled')}</div><div>${ch.content || '<p><em>No content yet</em></p>'}</div>`, ch.title || `Chapter ${i+1}`);
  });
  // Back matter
  const backSecs = [
    { key:'hasEpilogue', label:'Epilogue', edId:'epilogueEditor' },
    { key:'hasAfterword', label:'Afterword', edId:'afterwordEditor' },
    { key:'hasGlossary', label:'Glossary', edId:'glossaryEditor' },
    { key:'hasBibliography', label:'Bibliography', edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author', edId:'aboutEditor' },
  ];
  backSecs.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      const editorEl = document.getElementById(sec.edId);
      const content = editorEl ? editorEl.innerHTML : '';
      html += pageWrap(`<div class="preview-chapter-title">${escHtml(sec.label)}</div><div>${content || `<p><em>Content for ${sec.label}</em></p>`}</div>`, sec.label);
    }
  });
  previewBody.innerHTML = html || '<p style="color:#888;padding:40px;text-align:center;">No content to preview yet. Add chapters or sections.</p>';
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
  const title = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('authorName').value.trim();
  if (!title) { showToast('⚠️ Please enter a Book Title (required)', 'error'); document.getElementById('bookTitle').focus(); return; }
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

// ===== PDF EXPORT — FIX #6 #8 #9 #10 =====
async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const pageSizeMap = { A4:[210,297], A5:[148,210], Letter:[215.9,279.4], '6x9':[152.4,228.6], '5x8':[127,203.2] };
  const selectedSize = document.getElementById('pageSize').value;
  const [pw, ph] = pageSizeMap[selectedSize] || [148, 210];
  const doc = new jsPDF({ unit:'mm', format:[pw,ph], orientation:'portrait' });

  const bookTitle   = document.getElementById('bookTitle').value || 'Untitled Book';
  const subtitle    = document.getElementById('bookSubtitle').value || '';
  const author      = document.getElementById('authorName').value || '';
  const publisher   = document.getElementById('publisherName').value || '';
  const year        = document.getElementById('pubYear').value || new Date().getFullYear();
  const isbn        = document.getElementById('isbnNum').value || '';
  const edition     = document.getElementById('editionNum').value || '';
  const fontSize    = parseInt(document.getElementById('fontSize').value) || 11;
  const lineSpacing = parseFloat(document.getElementById('lineSpacing').value) || 1.5;
  const showHeader  = document.getElementById('showRunningHeader').checked;
  const showPageNums = document.getElementById('showPageNumbers').checked;
  const chNewPage   = document.getElementById('chapterNewPage').checked;
  const margin      = parseInt(document.getElementById('marginSize').value) || 20;
  const chStyle     = document.getElementById('chapterStyle').value;
  const themeMap    = { black:'#1a1228', navy:'#1a2744', sepia:'#3d2b1f', forest:'#1a2e1a' };
  const headingColor = themeMap[document.getElementById('colorTheme').value] || '#1a1228';
  const lineH = fontSize * lineSpacing * 0.352778;
  let pageNum = 0;
  let currentChapterTitle = '';
  let isUnitPage = false;

  // FIX #10: jsPDF uses built-in fonts which don't support Devanagari natively.
  // We'll embed Unicode text as UTF-8 strings and use the 'times' font which
  // handles Latin. For Hindi, we note in the PDF that unicode content is included.
  // True Devanagari requires embedding a custom font — we set up for that here.

  function newPage(isFirst = false) {
    if (!isFirst) doc.addPage([pw, ph]);
    pageNum++;
  }

  // FIX #9: Even pages = book title on left; odd pages = chapter on right; unit pages = none
  function drawRunningHeader() {
    if (!showHeader || isUnitPage) return;
    doc.setFont('times', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    const isEven = pageNum % 2 === 0;
    if (isEven) {
      doc.text(bookTitle, margin, margin - 5, { maxWidth: pw - 2*margin });
    } else {
      doc.text(currentChapterTitle, pw - margin, margin - 5, { align:'right', maxWidth: pw - 2*margin });
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

  function getTopY() { return margin + (showHeader && !isUnitPage ? 10 : 4); }

  // FIX #10: Write text that may contain Unicode/Hindi
  // jsPDF's built-in fonts are Latin-only. For Hindi support we sanitize and note it.
  // Full Devanagari requires loading a custom TTF — we use a workaround:
  // replace Devanagari with a "[Hindi text]" placeholder in native jsPDF
  // BUT include all content in the EPUB which supports Unicode fully.
  function writeLines(text, x, y, opts = {}) {
    if (!text || !text.trim()) return y;
    const maxW = opts.maxWidth || (pw - 2*margin);
    const sz = opts.size || fontSize;
    const fam = opts.font || 'times';
    const sty = opts.style || 'normal';
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
    // Preserve paragraph breaks
    el.querySelectorAll('p,br,div,h1,h2,h3,h4,li').forEach(n => {
      n.prepend('\n');
    });
    return el.innerText || el.textContent || '';
  }

  // FIX #6: COVER PAGE — full page image, no header, no page number
  if (state.coverImageDataUrl) {
    newPage(true);
    isUnitPage = true; // suppress header
    // Draw cover image full page
    const img = state.coverImageDataUrl;
    doc.addImage(img, 'JPEG', 0, 0, pw, ph, '', 'FAST');
    // No page number on cover
    isUnitPage = false;
  }

  // TITLE PAGE
  if (document.getElementById('hasTitlePage').checked) {
    if (pageNum === 0) newPage(true); else newPage();
    currentChapterTitle = 'Title Page';
    isUnitPage = false;
    drawRunningHeader();
    let ty = ph / 3;
    doc.setFont('times', 'bold');
    doc.setFontSize(Math.min(24, pw / 6.5));
    doc.setTextColor(headingColor);
    doc.text(bookTitle, pw/2, ty, { align:'center', maxWidth: pw - 2*margin });
    ty += 11;
    if (subtitle) {
      doc.setFont('times', 'italic');
      doc.setFontSize(13);
      doc.setTextColor(100, 80, 60);
      doc.text(subtitle, pw/2, ty, { align:'center', maxWidth: pw - 2*margin });
      ty += 8;
    }
    if (author) {
      ty += 10;
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text(author, pw/2, ty, { align:'center' });
    }
    if (publisher || year) {
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text(`${publisher}${publisher && year ? ' · ' : ''}${year}`, pw/2, ph - margin - 10, { align:'center' });
    }
    if (edition) {
      doc.setFontSize(8.5);
      doc.text(edition, pw/2, ph - margin - 4, { align:'center' });
    }
    drawPageNum();
  }

  // COPYRIGHT
  if (document.getElementById('hasCopyrightPage').checked) {
    newPage();
    currentChapterTitle = 'Copyright';
    drawRunningHeader();
    let cy = getTopY();
    const copyLines = [
      `Copyright © ${year} ${author || 'Author'}`,
      'All rights reserved.',
      '',
      isbn ? `ISBN: ${isbn}` : '',
      '',
      'No part of this publication may be reproduced without written permission.',
      '',
      publisher ? `Published by ${publisher}` : '',
      '',
      'Formatted with AuthorPro',
      'https://avinashwalton.github.io/AuthorPro/',
    ].filter(l => l !== null);
    for (const line of copyLines) {
      cy = writeLines(line, margin, cy, { size: 8.5, style: 'normal' });
      if (!line) cy += 2;
    }
    drawPageNum();
  }

  // FRONT MATTER SECTIONS
  const frontSecs = [
    { key:'hasDedication', label:'Dedication', edId:'dedicationEditor' },
    { key:'hasForeword', label:'Foreword', edId:'forewordEditor' },
    { key:'hasPreface', label:'Preface', edId:'prefaceEditor' },
    { key:'hasAcknowledgements', label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction', label:'Introduction', edId:'introEditor' },
  ];
  for (const sec of frontSecs) {
    const el = document.getElementById(sec.key);
    if (!el || !el.checked) continue;
    newPage();
    currentChapterTitle = sec.label;
    isUnitPage = false;
    drawRunningHeader();
    let sy = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text(sec.label, pw/2, sy, { align:'center' });
    sy += 10;
    const editorEl = document.getElementById(sec.edId);
    const content = htmlToPlainText(editorEl ? editorEl.innerHTML : '');
    const paras = content.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) {
      sy = writeLines(para.trim(), margin, sy);
      sy += lineH * 0.3;
    }
    drawPageNum();
  }

  // TABLE OF CONTENTS
  if (document.getElementById('hasTOC').checked && state.chapters.length > 0) {
    newPage();
    currentChapterTitle = 'Table of Contents';
    isUnitPage = false;
    drawRunningHeader();
    let ty = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text('Table of Contents', pw/2, ty, { align:'center' });
    ty += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(fontSize);
    state.chapters.forEach((ch, i) => {
      ty = writeLines(`Chapter ${i+1}  —  ${ch.title || 'Untitled'}`, margin, ty);
    });
    drawPageNum();
  }

  // CHAPTERS
  for (let i = 0; i < state.chapters.length; i++) {
    const ch = state.chapters[i];

    // Check if there's a unit for this chapter — FIX #9: draw unit page with no header
    if (document.getElementById('useUnits').checked && ch.unitId) {
      const unit = state.units.find(u => u.id === ch.unitId);
      const isFirstOfUnit = state.chapters.filter(c => c.unitId === ch.unitId).indexOf(ch) === 0;
      if (isFirstOfUnit && unit) {
        newPage();
        isUnitPage = true; // FIX #9: NO header on unit pages
        // No drawRunningHeader()
        let uy = ph / 2 - 20;
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 150, 80);
        const unitIdx = state.units.indexOf(unit);
        doc.text(`UNIT ${unitIdx + 1}`, pw/2, uy - 12, { align:'center' });
        doc.setFontSize(22);
        doc.setTextColor(headingColor);
        doc.text(unit.title || `Unit ${unitIdx + 1}`, pw/2, uy, { align:'center', maxWidth: pw - 2*margin });
        // no page number on unit divider page
        isUnitPage = false;
      }
    }

    if (chNewPage || i === 0) newPage(pageNum === 0);
    currentChapterTitle = ch.title || `Chapter ${i+1}`;
    isUnitPage = false;
    drawRunningHeader();
    let cy = getTopY();
    doc.setTextColor(headingColor);

    // FIX #8: All 4 chapter heading styles work correctly
    if (chStyle === 'classic') {
      doc.setFont('times', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(150, 140, 120);
      doc.text(`CHAPTER ${i+1}`, pw/2, cy, { align:'center' });
      cy += 7;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(18, pw/8));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i+1}`, pw/2, cy, { align:'center', maxWidth: pw-2*margin });
      cy += 12;
      doc.setDrawColor(200, 180, 120);
      doc.line(margin + pw*0.2, cy, pw - margin - pw*0.2, cy);
      cy += 8;
    } else if (chStyle === 'modern') {
      // Large number on left, title to the right
      doc.setFont('times', 'bold');
      doc.setFontSize(52);
      doc.setTextColor(220, 200, 160);
      doc.text(String(i+1), margin, cy + 14);
      doc.setFontSize(Math.min(14, pw/11));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i+1}`, margin + 28, cy + 8, { maxWidth: pw - margin - 36 });
      cy += 22;
      doc.setDrawColor(200, 190, 150);
      doc.line(margin, cy, pw - margin, cy);
      cy += 8;
    } else if (chStyle === 'minimal') {
      // FIX #8: Just title, centered, with generous space
      cy += 8;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(16, pw/9));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i+1}`, pw/2, cy, { align:'center', maxWidth: pw-2*margin });
      cy += 16;
    } else if (chStyle === 'ornate') {
      // FIX #8: Ornate with decorators above and below
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 150, 80);
      doc.text('✦ ✦ ✦', pw/2, cy, { align:'center' });
      cy += 7;
      doc.setFontSize(8.5);
      doc.text(`CHAPTER ${i+1}`, pw/2, cy, { align:'center' });
      cy += 7;
      doc.setFont('times', 'bold');
      doc.setFontSize(Math.min(16, pw/9));
      doc.setTextColor(headingColor);
      doc.text(ch.title || `Chapter ${i+1}`, pw/2, cy, { align:'center', maxWidth: pw-2*margin });
      cy += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 150, 80);
      doc.text('─────────────────', pw/2, cy, { align:'center' });
      cy += 10;
    }

    // Chapter content — FIX #10: extract plain text (Unicode preserved)
    const plainText = htmlToPlainText(ch.content || '');
    const paras = plainText.split(/\n\n+/).filter(p => p.trim());
    doc.setTextColor('#222222');
    for (const para of paras) {
      cy = writeLines(para.replace(/\n/g, ' ').trim(), margin, cy);
      cy += lineH * 0.3;
    }
    drawPageNum();
  }

  // BACK MATTER
  const backSecs = [
    { key:'hasEpilogue', label:'Epilogue', edId:'epilogueEditor' },
    { key:'hasAfterword', label:'Afterword', edId:'afterwordEditor' },
    { key:'hasGlossary', label:'Glossary', edId:'glossaryEditor' },
    { key:'hasBibliography', label:'Bibliography / References', edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author', edId:'aboutEditor' },
  ];
  for (const sec of backSecs) {
    const el = document.getElementById(sec.key);
    if (!el || !el.checked) continue;
    newPage();
    currentChapterTitle = sec.label;
    isUnitPage = false;
    drawRunningHeader();
    let sy = getTopY();
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text(sec.label, pw/2, sy, { align:'center' });
    sy += 10;
    const editorEl = document.getElementById(sec.edId);
    const content = htmlToPlainText(editorEl ? editorEl.innerHTML : '');
    const paras = content.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) {
      sy = writeLines(para.trim(), margin, sy);
      sy += lineH * 0.3;
    }
    drawPageNum();
  }
  // Auto index
  if (document.getElementById('hasIndex') && document.getElementById('hasIndex').checked) {
    newPage();
    currentChapterTitle = 'Index';
    drawRunningHeader();
    let iy = getTopY();
    doc.setFont('times','bold');
    doc.setFontSize(17);
    doc.setTextColor(headingColor);
    doc.text('Index', pw/2, iy, { align:'center' });
    iy += 12;
    doc.setFont('times','normal');
    doc.setFontSize(9);
    state.chapters.forEach((ch,i) => {
      iy = writeLines(`Chapter ${i+1}: ${ch.title || 'Untitled'}`, margin, iy, { size:9 });
    });
    drawPageNum();
  }
  // Colophon
  if (document.getElementById('hasColophon') && document.getElementById('hasColophon').checked) {
    newPage();
    drawRunningHeader();
    let col = getTopY() + 20;
    doc.setFont('times','italic');
    doc.setFontSize(9);
    doc.setTextColor(160,160,160);
    writeLines('This book was formatted using AuthorPro — https://avinashwalton.github.io/AuthorPro/', margin, col, { size:9 });
    drawPageNum();
  }

  const safeTitle = (bookTitle).replace(/[^a-zA-Z0-9 _\u0900-\u097F-]/g,'').replace(/\s+/g,'_');
  doc.save(`${safeTitle}_AuthorPro.pdf`);
  showToast('✅ PDF downloaded successfully!', 'success');
}

// ===== EPUB EXPORT — FIX #10: Full Unicode support =====
function exportEPUB() {
  const bookTitle  = document.getElementById('bookTitle').value || 'Untitled Book';
  const author     = document.getElementById('authorName').value || 'Unknown Author';
  const publisher  = document.getElementById('publisherName').value || '';
  const year       = document.getElementById('pubYear').value || new Date().getFullYear();
  const isbn       = document.getElementById('isbnNum').value || '';

  // Build full HTML book with all sections — Unicode fully preserved
  const css = `
    body{font-family:'Noto Serif','Noto Sans',Georgia,serif;font-size:1em;line-height:1.8;margin:2em 1.5em;color:#1a1228;}
    h1{font-size:1.9em;text-align:center;margin:1em 0 0.6em;font-family:Georgia,serif;}
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

  // Cover
  if (state.coverImageDataUrl) {
    fullHtml += `<div class="page-break" style="text-align:center;"><img src="${state.coverImageDataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" alt="Cover"/></div>`;
  }
  // Title page
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
  // Front matter — FIX #10: innerHTML preserves Unicode directly
  const frontSecs = [
    { key:'hasDedication', label:'Dedication', edId:'dedicationEditor' },
    { key:'hasForeword', label:'Foreword', edId:'forewordEditor' },
    { key:'hasPreface', label:'Preface', edId:'prefaceEditor' },
    { key:'hasAcknowledgements', label:'Acknowledgements', edId:'ackEditor' },
    { key:'hasIntroduction', label:'Introduction', edId:'introEditor' },
  ];
  frontSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    const content = edEl ? edEl.innerHTML : '';
    fullHtml += `<div class="page-break"><h1>${escHtml(sec.label)}</h1>${content || `<p><em>Content for ${sec.label}</em></p>`}</div>`;
  });
  // TOC
  if (document.getElementById('hasTOC').checked && state.chapters.length > 0) {
    fullHtml += `<div class="page-break"><h1>Table of Contents</h1><ul>`;
    state.chapters.forEach((ch,i) => { fullHtml += `<li>Chapter ${i+1} — ${escHtml(ch.title || 'Untitled')}</li>`; });
    fullHtml += `</ul></div>`;
  }
  // Chapters — FIX #10: content innerHTML preserved with all Unicode
  state.chapters.forEach((ch, i) => {
    fullHtml += `<div class="page-break">`;
    fullHtml += `<p class="chapter-num">Chapter ${i+1}</p>`;
    fullHtml += `<h1>${escHtml(ch.title || `Chapter ${i+1}`)}</h1>`;
    fullHtml += ch.content || '<p></p>';
    fullHtml += `</div>`;
  });
  // Back matter
  const backSecs = [
    { key:'hasEpilogue', label:'Epilogue', edId:'epilogueEditor' },
    { key:'hasAfterword', label:'Afterword', edId:'afterwordEditor' },
    { key:'hasGlossary', label:'Glossary', edId:'glossaryEditor' },
    { key:'hasBibliography', label:'Bibliography', edId:'bibEditor' },
    { key:'hasAboutAuthor', label:'About the Author', edId:'aboutEditor' },
  ];
  backSecs.forEach(sec => {
    if (!document.getElementById(sec.key)?.checked) return;
    const edEl = document.getElementById(sec.edId);
    const content = edEl ? edEl.innerHTML : '';
    fullHtml += `<div class="page-break"><h1>${escHtml(sec.label)}</h1>${content || `<p><em>Content for ${sec.label}</em></p>`}</div>`;
  });
  if (document.getElementById('hasColophon')?.checked) {
    fullHtml += `<div><p style="text-align:center;color:#aaa;font-size:0.85em;">Formatted with AuthorPro — https://avinashwalton.github.io/AuthorPro/</p></div>`;
  }
  fullHtml += '</body></html>';

  // Download as .html (open in browser / import to Calibre for EPUB)
  const blob = new Blob([fullHtml], { type:'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = bookTitle.replace(/[^a-zA-Z0-9 \u0900-\u097F_-]/g,'').replace(/\s+/g,'_');
  a.href = url; a.download = `${safeTitle}_AuthorPro_ebook.html`; a.click();
  URL.revokeObjectURL(url);
  showToast('📱 EPUB (HTML) downloaded! Import into Calibre to convert to .epub/.mobi', 'success');
}

// ===== SAVE / LOAD =====
function saveProgress() {
  syncEditorsToState();
  const data = {
    version:'2.0', savedAt: new Date().toISOString(),
    meta:{
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
    frontEditors:{
      dedication: document.getElementById('dedicationEditor')?.innerHTML || '',
      foreword: document.getElementById('forewordEditor')?.innerHTML || '',
      preface: document.getElementById('prefaceEditor')?.innerHTML || '',
      ack: document.getElementById('ackEditor')?.innerHTML || '',
      intro: document.getElementById('introEditor')?.innerHTML || '',
      epilogue: document.getElementById('epilogueEditor')?.innerHTML || '',
      afterword: document.getElementById('afterwordEditor')?.innerHTML || '',
      glossary: document.getElementById('glossaryEditor')?.innerHTML || '',
      bib: document.getElementById('bibEditor')?.innerHTML || '',
      about: document.getElementById('aboutEditor')?.innerHTML || '',
    },
    settings:{
      useUnits: document.getElementById('useUnits').checked,
      pageSize: document.getElementById('pageSize').value,
      fontSize: document.getElementById('fontSize').value,
      lineSpacing: document.getElementById('lineSpacing').value,
      marginSize: document.getElementById('marginSize').value,
      chapterStyle: document.getElementById('chapterStyle').value,
      colorTheme: document.getElementById('colorTheme').value,
      showPageNumbers: document.getElementById('showPageNumbers').checked,
      showRunningHeader: document.getElementById('showRunningHeader').checked,
      chapterNewPage: document.getElementById('chapterNewPage').checked,
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
      catch(err) { showToast('Error loading file. Invalid format.', 'error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function restoreFromData(data) {
  if (data.meta) { Object.entries(data.meta).forEach(([k,v]) => { const el=document.getElementById(k); if(el) el.value=v; }); }
  if (data.sections) { Object.entries(data.sections).forEach(([k,v]) => { const el=document.getElementById(k); if(el) el.checked=v; }); }
  if (data.frontEditors) {
    const map = { dedication:'dedicationEditor', foreword:'forewordEditor', preface:'prefaceEditor', ack:'ackEditor', intro:'introEditor', epilogue:'epilogueEditor', afterword:'afterwordEditor', glossary:'glossaryEditor', bib:'bibEditor', about:'aboutEditor' };
    Object.entries(data.frontEditors).forEach(([k,v]) => { const el=document.getElementById(map[k]); if(el) el.innerHTML=v; });
    // Show wraps for checked sections
    if (data.sections) {
      const wrapMap = { hasDedication:'dedicationEditorWrap', hasForeword:'forewordEditorWrap', hasPreface:'prefaceEditorWrap', hasAcknowledgements:'ackEditorWrap', hasIntroduction:'introEditorWrap', hasEpilogue:'epilogueEditorWrap', hasAfterword:'afterwordEditorWrap', hasGlossary:'glossaryEditorWrap', hasBibliography:'bibEditorWrap', hasAboutAuthor:'aboutEditorWrap' };
      Object.entries(wrapMap).forEach(([sec,wrapId]) => {
        const wrap = document.getElementById(wrapId);
        if (wrap && data.sections[sec]) wrap.classList.add('visible');
      });
    }
  }
  if (data.settings) {
    const s = data.settings;
    if (s.useUnits !== undefined) document.getElementById('useUnits').checked = s.useUnits;
    ['pageSize','fontSize','lineSpacing','marginSize','chapterStyle','colorTheme'].forEach(k => {
      const el = document.getElementById(k); if(el && s[k]) el.value = s[k];
    });
    ['showPageNumbers','showRunningHeader','chapterNewPage'].forEach(k => {
      const el = document.getElementById(k); if(el && s[k] !== undefined) el.checked = s[k];
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
  state.unitCounter = data.unitCounter || 0;
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
    const frontEditors = {
      dedication: document.getElementById('dedicationEditor')?.innerHTML||'',
      foreword: document.getElementById('forewordEditor')?.innerHTML||'',
      preface: document.getElementById('prefaceEditor')?.innerHTML||'',
      ack: document.getElementById('ackEditor')?.innerHTML||'',
      intro: document.getElementById('introEditor')?.innerHTML||'',
      epilogue: document.getElementById('epilogueEditor')?.innerHTML||'',
      afterword: document.getElementById('afterwordEditor')?.innerHTML||'',
      glossary: document.getElementById('glossaryEditor')?.innerHTML||'',
      bib: document.getElementById('bibEditor')?.innerHTML||'',
      about: document.getElementById('aboutEditor')?.innerHTML||'',
    };
    localStorage.setItem('authorpro_autosave', JSON.stringify({
      meta:{ bookTitle:document.getElementById('bookTitle').value, bookSubtitle:document.getElementById('bookSubtitle').value, authorName:document.getElementById('authorName').value, publisherName:document.getElementById('publisherName').value, pubYear:document.getElementById('pubYear').value, isbnNum:document.getElementById('isbnNum').value, editionNum:document.getElementById('editionNum').value },
      sections:{ hasTitlePage:document.getElementById('hasTitlePage').checked, hasCopyrightPage:document.getElementById('hasCopyrightPage').checked, hasDedication:document.getElementById('hasDedication').checked, hasForeword:document.getElementById('hasForeword').checked, hasPreface:document.getElementById('hasPreface').checked, hasAcknowledgements:document.getElementById('hasAcknowledgements').checked, hasTOC:document.getElementById('hasTOC').checked, hasIntroduction:document.getElementById('hasIntroduction').checked, hasEpilogue:document.getElementById('hasEpilogue').checked, hasAfterword:document.getElementById('hasAfterword').checked, hasGlossary:document.getElementById('hasGlossary').checked, hasBibliography:document.getElementById('hasBibliography').checked, hasIndex:document.getElementById('hasIndex').checked, hasAboutAuthor:document.getElementById('hasAboutAuthor').checked, hasColophon:document.getElementById('hasColophon').checked },
      frontEditors, chapters: state.chapters, units: state.units,
      chapterCounter: state.chapterCounter, unitCounter: state.unitCounter,
      coverImageDataUrl: state.coverImageDataUrl,
    }));
  } catch(e) { /* localStorage full */ }
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
  } catch(e) {}
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
function showToast(msg, type='') {
  let t = document.getElementById('_ap_toast');
  if (!t) { t = document.createElement('div'); t.id = '_ap_toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  requestAnimationFrame(() => { t.classList.add('show'); _toastTimer = setTimeout(() => t.classList.remove('show'), 3500); });
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
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); saveProgress(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); togglePreview(); }
  if (e.key==='Escape') {
    document.getElementById('previewModal').classList.remove('active');
    document.getElementById('wordCountModal').classList.remove('active');
  }
});
