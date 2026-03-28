/* ============================================================
   AuthorPro – script.js
   Author: Avinash Walton | MIT License
   ============================================================ */

'use strict';

// ===== STATE =====
const state = {
  chapters: [],       // { id, title, content, unitId }
  units: [],          // { id, title }
  activeTab: 'welcome',
  exportFormat: 'pdf',
  autoSaveTimer: null,
  chapterCounter: 0,
  unitCounter: 0,
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  initAutoSave();
  loadFromLocalStorage();
  updateWordCount();
});

// ===== NAVIGATION =====
function scrollToFormatter() {
  document.getElementById('formatter').scrollIntoView({ behavior: 'smooth' });
}

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
}

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

// ===== UNIT MODE TOGGLE =====
function toggleUnitMode() {
  const use = document.getElementById('useUnits').checked;
  document.getElementById('addUnitBtn').style.display = use ? 'inline-flex' : 'none';
  document.getElementById('unitsContainer').innerHTML = '';
  if (use && state.units.length === 0) {
    addUnit();
  } else if (!use) {
    state.units = [];
    // Re-render chapters without unit labels
    renderChapterList();
  }
}

// ===== UNITS =====
function addUnit() {
  const id = 'u' + (++state.unitCounter);
  const unit = { id, title: '' };
  state.units.push(unit);
  renderUnits();
}

function removeUnit(unitId) {
  if (!confirm('Delete this unit? Chapters under it will remain.')) return;
  state.units = state.units.filter(u => u.id !== unitId);
  state.chapters.forEach(ch => { if (ch.unitId === unitId) ch.unitId = null; });
  renderUnits();
  renderChapterList();
}

function renderUnits() {
  const container = document.getElementById('unitsContainer');
  if (!container) return;
  container.innerHTML = state.units.map((unit, i) => `
    <div class="unit-block" id="unitBlock_${unit.id}">
      <div class="unit-header">
        <span class="unit-label">Unit ${i + 1}</span>
        <input class="unit-title-input" type="text" placeholder="Unit title e.g. The Beginning"
          value="${escHtml(unit.title)}"
          oninput="updateUnitTitle('${unit.id}', this.value)"
        />
        <button class="btn-delete-chapter" title="Delete Unit" onclick="removeUnit('${unit.id}')">✕</button>
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
  const ch = { id, title: 'Untitled Chapter', content: '', unitId: unitId || null };
  state.chapters.push(ch);
  renderChapterList();
  createEditorTab(ch);
  switchTab(id);
  return ch;
}

function removeChapter(id, e) {
  if (e) e.stopPropagation();
  if (state.chapters.length === 1 && !confirm('Remove the only chapter?')) return;
  if (state.chapters.length > 1 && !confirm('Delete this chapter? Content will be lost.')) return;

  // Remove tab
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  const tabContent = document.getElementById(`tab-${id}`);
  if (tabBtn) tabBtn.remove();
  if (tabContent) tabContent.remove();

  state.chapters = state.chapters.filter(ch => ch.id !== id);
  renderChapterList();

  if (state.activeTab === id) {
    if (state.chapters.length > 0) {
      switchTab(state.chapters[state.chapters.length - 1].id);
    } else {
      switchTab('welcome');
    }
  }
  scheduleAutoSave();
}

function renderChapterList() {
  const container = document.getElementById('chaptersContainer');
  if (!container) return;

  if (document.getElementById('useUnits').checked && state.units.length > 0) {
    let html = '';
    state.units.forEach((unit, ui) => {
      const unitChapters = state.chapters.filter(ch => ch.unitId === unit.id);
      html += `
        <div class="unit-chapters-group">
          <div class="unit-group-label">▸ ${escHtml(unit.title || `Unit ${ui + 1}`)}</div>
          ${unitChapters.map(ch => chapterItemHTML(ch)).join('')}
          <button class="btn-add" style="margin:4px 0 8px 12px;font-size:0.75rem;" onclick="addChapter('${unit.id}')">+ Add Chapter</button>
        </div>
      `;
    });
    const unassigned = state.chapters.filter(ch => !ch.unitId);
    if (unassigned.length > 0) {
      html += `<div class="unit-group-label" style="margin-top:8px;">Unassigned</div>`;
      html += unassigned.map(ch => chapterItemHTML(ch)).join('');
    }
    container.innerHTML = html;
  } else {
    container.innerHTML = state.chapters.map(ch => chapterItemHTML(ch)).join('');
  }
}

function chapterItemHTML(ch) {
  const isActive = state.activeTab === ch.id;
  const chIdx = state.chapters.indexOf(ch);
  return `
    <div class="chapter-item ${isActive ? 'active' : ''}" id="chItem_${ch.id}" onclick="switchTab('${ch.id}')">
      <span class="chapter-num">Ch.${chIdx + 1}</span>
      <span class="chapter-title-label">${escHtml(ch.title || 'Untitled')}</span>
      <button class="btn-delete-chapter" title="Delete Chapter" onclick="removeChapter('${ch.id}', event)">✕</button>
    </div>
  `;
}

// ===== EDITOR TABS =====
function createEditorTab(ch) {
  const tabsRow = document.getElementById('editorTabs');
  const editorContent = document.getElementById('editorContent');

  // Tab button
  const tabBtn = document.createElement('button');
  tabBtn.className = 'tab-btn';
  tabBtn.dataset.tab = ch.id;
  tabBtn.title = ch.title;
  tabBtn.textContent = ch.title || 'Ch.';
  tabBtn.onclick = () => switchTab(ch.id);
  tabsRow.appendChild(tabBtn);

  // Tab content
  const tabDiv = document.createElement('div');
  tabDiv.className = 'tab-content';
  tabDiv.id = `tab-${ch.id}`;
  tabDiv.innerHTML = `
    <div class="rich-editor-wrap">
      <div class="chapter-heading-bar">
        <span class="ch-heading-label">Chapter Title:</span>
        <input class="ch-title-input" type="text" placeholder="Enter chapter title..."
          value="${escHtml(ch.title)}"
          oninput="updateChapterTitle('${ch.id}', this.value)"
        />
      </div>
      <div class="rich-editor" id="editor_${ch.id}"
        contenteditable="true"
        data-placeholder="Start writing or paste your content here..."
        oninput="onEditorInput('${ch.id}')"
        onpaste="onEditorPaste(event)"
      >${ch.content}</div>
    </div>
  `;
  editorContent.appendChild(tabDiv);
}

function switchTab(id) {
  // Deactivate all
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  // Activate
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  const tabContent = document.getElementById(`tab-${id}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  state.activeTab = id;

  // Update chapter list highlight
  document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  const chItem = document.getElementById(`chItem_${id}`);
  if (chItem) {
    chItem.classList.add('active');
    chItem.scrollIntoView({ block: 'nearest' });
  }

  updateWordCount();
}

function updateChapterTitle(id, val) {
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  ch.title = val;

  // Update tab button
  const tabBtn = document.querySelector(`[data-tab="${id}"]`);
  if (tabBtn) { tabBtn.textContent = val || 'Ch.'; tabBtn.title = val; }

  // Update chapter list
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

function onEditorPaste(e) {
  // Allow paste with formatting from Word/Google Docs
  // No override needed — contenteditable handles it
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

function insertImage() {
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
    for (let c = 0; c < cols; c++) {
      tbl += r === 0 ? '<th>Header</th>' : '<td>Cell</td>';
    }
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
  const activeEditor = document.querySelector('.tab-content.active .rich-editor');
  const text = activeEditor ? (activeEditor.innerText || '') : '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  document.getElementById('wordCountDisplay').textContent = `Words: ${words.toLocaleString()}`;
  document.getElementById('charCountDisplay').textContent = `Characters: ${chars.toLocaleString()}`;
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

  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-item"><div class="stat-num">${state.chapters.length}</div><div class="stat-label">Chapters</div></div>
    <div class="stat-item"><div class="stat-num">${state.units.length}</div><div class="stat-label">Units</div></div>
    <div class="stat-item"><div class="stat-num">${totalWords.toLocaleString()}</div><div class="stat-label">Total Words</div></div>
    <div class="stat-item"><div class="stat-num">${totalChars.toLocaleString()}</div><div class="stat-label">Total Characters</div></div>
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords / 250)}</div><div class="stat-label">Est. Pages</div></div>
    <div class="stat-item"><div class="stat-num">${Math.ceil(totalWords / 70000 * 100)}%</div><div class="stat-label">Novel Progress</div></div>
  `;
  document.getElementById('wordCountModal').classList.add('active');
}

// ===== FORMAT SELECT =====
function setFormat(fmt) {
  state.exportFormat = fmt;
  document.getElementById('fmtPDF').classList.toggle('active', fmt === 'pdf');
  document.getElementById('fmtEPUB').classList.toggle('active', fmt === 'epub');
  document.getElementById('exportBtnText').textContent = fmt === 'pdf' ? 'Generate PDF' : 'Generate EPUB';
}

// ===== PREVIEW =====
function togglePreview() {
  const modal = document.getElementById('previewModal');
  const isActive = modal.classList.contains('active');
  if (!isActive) {
    buildPreview();
  }
  modal.classList.toggle('active');
}

function buildPreview() {
  const previewBody = document.getElementById('previewBody');
  const bookTitle = document.getElementById('bookTitle').value || 'Untitled Book';
  const subtitle = document.getElementById('bookSubtitle').value;
  const author = document.getElementById('authorName').value || 'Unknown Author';
  const showHeader = document.getElementById('showRunningHeader').checked;
  let html = '';

  // Title Page preview
  if (document.getElementById('hasTitlePage').checked) {
    html += `
      <div class="preview-page">
        <div class="preview-title-page">
          <div class="preview-book-title">${escHtml(bookTitle)}</div>
          ${subtitle ? `<div class="preview-book-subtitle">${escHtml(subtitle)}</div>` : ''}
          <div class="preview-author">— ${escHtml(author)} —</div>
        </div>
      </div>
    `;
  }

  // Front matter sections
  const frontSections = [
    { key: 'hasDedication', label: 'Dedication' },
    { key: 'hasForeword', label: 'Foreword' },
    { key: 'hasPreface', label: 'Preface' },
    { key: 'hasAcknowledgements', label: 'Acknowledgements' },
    { key: 'hasIntroduction', label: 'Introduction' },
  ];
  frontSections.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      html += sectionPreviewPage(sec.label, bookTitle, showHeader, `<p><em>(Content for ${sec.label} goes here)</em></p>`);
    }
  });

  // TOC Preview
  if (document.getElementById('hasTOC').checked) {
    let tocItems = state.chapters.map((ch, i) => `<p>Chapter ${i + 1} — ${escHtml(ch.title)} ............. ${i + 1}</p>`).join('');
    html += sectionPreviewPage('Table of Contents', bookTitle, showHeader, tocItems);
  }

  // Chapters
  state.chapters.forEach((ch, i) => {
    const headerRight = ch.title || `Chapter ${i + 1}`;
    const chContent = ch.content || '<p><em>(No content yet)</em></p>';
    html += `
      <div class="preview-page">
        ${showHeader ? `<div class="preview-header-bar"><span>${escHtml(bookTitle)}</span><span>${escHtml(headerRight)}</span></div>` : ''}
        <div class="preview-chapter-num">CHAPTER ${i + 1}</div>
        <div class="preview-chapter-title">${escHtml(ch.title || 'Untitled Chapter')}</div>
        <div class="preview-chapter-body">${chContent}</div>
      </div>
    `;
  });

  // Back matter
  const backSections = [
    { key: 'hasEpilogue', label: 'Epilogue' },
    { key: 'hasAfterword', label: 'Afterword' },
    { key: 'hasGlossary', label: 'Glossary' },
    { key: 'hasBibliography', label: 'Bibliography' },
    { key: 'hasIndex', label: 'Index' },
    { key: 'hasAboutAuthor', label: 'About the Author' },
  ];
  backSections.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      html += sectionPreviewPage(sec.label, bookTitle, showHeader, `<p><em>(Content for ${sec.label} goes here)</em></p>`);
    }
  });

  previewBody.innerHTML = html || '<p style="color:#888;padding:40px;text-align:center;">No content to preview yet.</p>';
}

function sectionPreviewPage(title, bookTitle, showHeader, content) {
  return `
    <div class="preview-page">
      ${showHeader ? `<div class="preview-header-bar"><span>${escHtml(bookTitle)}</span><span>${escHtml(title)}</span></div>` : ''}
      <div class="preview-chapter-title">${escHtml(title)}</div>
      ${content}
    </div>
  `;
}

// ===== FULLSCREEN =====
function toggleFullscreen() {
  const panel = document.getElementById('panelRight');
  panel.classList.toggle('fullscreen-panel');
  if (panel.classList.contains('fullscreen-panel')) {
    panel.style.cssText = `position:fixed;inset:0;z-index:999;border-radius:0;max-height:100vh;`;
  } else {
    panel.style.cssText = '';
  }
}

// ===== EXPORT =====
async function exportBook() {
  const btnText = document.getElementById('exportBtnText');
  const spinner = document.getElementById('exportSpinner');
  btnText.textContent = 'Generating...';
  spinner.style.display = 'inline';

  try {
    if (state.exportFormat === 'pdf') {
      await exportPDF();
    } else {
      exportEPUB();
    }
  } catch (err) {
    console.error(err);
    showToast('Export failed. Please try again.', 'error');
  }

  btnText.textContent = state.exportFormat === 'pdf' ? 'Generate PDF' : 'Generate EPUB';
  spinner.style.display = 'none';
}

async function exportPDF() {
  const { jsPDF } = window.jspdf;

  const pageSizeMap = {
    'A4': [210, 297],
    'A5': [148, 210],
    'Letter': [215.9, 279.4],
    '6x9': [152.4, 228.6],
    '5x8': [127, 203.2],
  };
  const selectedSize = document.getElementById('pageSize').value;
  const [pw, ph] = pageSizeMap[selectedSize] || [148, 210];

  const doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: 'portrait' });

  const bookTitle = document.getElementById('bookTitle').value || 'Untitled Book';
  const subtitle = document.getElementById('bookSubtitle').value || '';
  const author = document.getElementById('authorName').value || '';
  const publisher = document.getElementById('publisherName').value || '';
  const year = document.getElementById('pubYear').value || '';
  const isbn = document.getElementById('isbnNum').value || '';
  const edition = document.getElementById('editionNum').value || '';
  const bodyFont = document.getElementById('bodyFont').value;
  const fontSize = parseInt(document.getElementById('fontSize').value) || 11;
  const lineSpacing = parseFloat(document.getElementById('lineSpacing').value) || 1.5;
  const showHeader = document.getElementById('showRunningHeader').checked;
  const showPageNums = document.getElementById('showPageNumbers').checked;
  const chNewPage = document.getElementById('chapterNewPage').checked;
  const marginMap = { narrow: 15, normal: 20, wide: 25, mirror: 20 };
  const margin = marginMap[document.getElementById('marginSize').value] || 20;
  const themeMap = { black: '#1a1228', navy: '#1a2744', sepia: '#3d2b1f', forest: '#1a2e1a' };
  const headingColor = themeMap[document.getElementById('colorTheme').value] || '#1a1228';

  const textColor = '#222222';
  const lineH = fontSize * lineSpacing * 0.352778; // mm per line
  let pageNum = 0;
  let currentChapterTitle = '';

  function addPage(isFirst = false) {
    if (!isFirst) doc.addPage([pw, ph]);
    pageNum++;
  }

  function drawHeader(chTitle) {
    if (!showHeader) return;
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(bookTitle, margin, margin - 5, { maxWidth: pw / 2 - margin - 4 });
    doc.text(chTitle, pw - margin, margin - 5, { align: 'right', maxWidth: pw / 2 - margin - 4 });
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, margin - 3, pw - margin, margin - 3);
  }

  function drawPageNum() {
    if (!showPageNums) return;
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(String(pageNum), pw / 2, ph - 8, { align: 'center' });
  }

  function writeText(text, x, y, opts = {}) {
    doc.setTextColor(textColor);
    doc.setFont(opts.font || 'times', opts.style || 'normal');
    doc.setFontSize(opts.size || fontSize);
    const lines = doc.splitTextToSize(text, opts.maxWidth || (pw - 2 * margin));
    lines.forEach(line => {
      if (y > ph - margin - 10) {
        drawPageNum();
        addPage();
        y = margin + (showHeader ? 10 : 0);
        drawHeader(currentChapterTitle);
      }
      doc.text(line, x, y);
      y += lineH;
    });
    return y;
  }

  function htmlToText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || '';
  }

  // ---- TITLE PAGE ----
  if (document.getElementById('hasTitlePage').checked) {
    addPage(true);
    let ty = ph / 3;
    doc.setFont('times', 'bold');
    doc.setFontSize(Math.min(26, pw / 6));
    doc.setTextColor(headingColor);
    doc.text(bookTitle, pw / 2, ty, { align: 'center', maxWidth: pw - 2 * margin });
    ty += 12;
    if (subtitle) {
      doc.setFont('times', 'italic');
      doc.setFontSize(14);
      doc.setTextColor(100, 80, 60);
      doc.text(subtitle, pw / 2, ty, { align: 'center', maxWidth: pw - 2 * margin });
      ty += 8;
    }
    if (author) {
      ty += 12;
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(textColor);
      doc.text(author, pw / 2, ty, { align: 'center' });
    }
    if (publisher || year) {
      doc.setFontSize(10);
      doc.setTextColor(140, 140, 140);
      doc.text(`${publisher}${publisher && year ? ' · ' : ''}${year}`, pw / 2, ph - margin - 10, { align: 'center' });
    }
    if (edition) {
      doc.setFontSize(9);
      doc.text(edition, pw / 2, ph - margin - 4, { align: 'center' });
    }
    drawPageNum();
  }

  // ---- COPYRIGHT PAGE ----
  if (document.getElementById('hasCopyrightPage').checked) {
    addPage();
    let cy = margin + 20;
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor);
    const copyText = [
      `Copyright © ${year || new Date().getFullYear()} ${author || 'Author'}`,
      'All rights reserved.',
      '',
      isbn ? `ISBN: ${isbn}` : '',
      'No part of this publication may be reproduced without written permission.',
      '',
      publisher ? `Published by ${publisher}` : '',
      'Formatted with AuthorPro – https://avinashwalton.github.io/AuthorPro/',
    ].filter(l => l !== undefined);
    copyText.forEach(line => {
      cy = writeText(line, margin, cy, { size: 9 });
    });
    drawPageNum();
  }

  // ---- FRONT MATTER SECTIONS ----
  const frontSections = [
    { key: 'hasDedication', label: 'Dedication' },
    { key: 'hasForeword', label: 'Foreword' },
    { key: 'hasPreface', label: 'Preface' },
    { key: 'hasAcknowledgements', label: 'Acknowledgements' },
    { key: 'hasIntroduction', label: 'Introduction' },
  ];

  for (const sec of frontSections) {
    const el = document.getElementById(sec.key);
    if (el && el.checked) {
      addPage();
      currentChapterTitle = sec.label;
      drawHeader(sec.label);
      let sy = margin + (showHeader ? 12 : 4);
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(headingColor);
      doc.text(sec.label, pw / 2, sy, { align: 'center' });
      sy += 10;
      sy = writeText(`(Write your ${sec.label} content here)`, margin, sy, { style: 'italic', size: fontSize });
      drawPageNum();
    }
  }

  // ---- TABLE OF CONTENTS ----
  if (document.getElementById('hasTOC').checked && state.chapters.length > 0) {
    addPage();
    currentChapterTitle = 'Table of Contents';
    drawHeader(currentChapterTitle);
    let ty = margin + (showHeader ? 12 : 4);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(headingColor);
    doc.text('Table of Contents', pw / 2, ty, { align: 'center' });
    ty += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(fontSize);
    state.chapters.forEach((ch, i) => {
      ty = writeText(`Chapter ${i + 1} — ${ch.title || 'Untitled'}`, margin, ty);
    });
    drawPageNum();
  }

  // ---- CHAPTERS ----
  for (let i = 0; i < state.chapters.length; i++) {
    const ch = state.chapters[i];
    if (chNewPage || i === 0) {
      addPage(pageNum === 0);
    }
    currentChapterTitle = ch.title || `Chapter ${i + 1}`;
    drawHeader(currentChapterTitle);
    let cy = margin + (showHeader ? 12 : 4);

    // Chapter heading style
    const style = document.getElementById('chapterStyle').value;
    doc.setTextColor(headingColor);
    if (style === 'classic') {
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`CHAPTER ${i + 1}`, pw / 2, cy, { align: 'center' });
      cy += 7;
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.text(ch.title || 'Untitled Chapter', pw / 2, cy, { align: 'center', maxWidth: pw - 2 * margin });
      cy += 12;
    } else if (style === 'modern') {
      doc.setFont('times', 'bold');
      doc.setFontSize(48);
      doc.setTextColor(220, 200, 150);
      doc.text(String(i + 1), margin, cy + 12);
      doc.setFontSize(14);
      doc.setTextColor(headingColor);
      doc.text(ch.title || 'Untitled Chapter', margin + 22, cy + 8, { maxWidth: pw - margin - 30 });
      cy += 20;
    } else if (style === 'minimal') {
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text(ch.title || 'Untitled Chapter', pw / 2, cy, { align: 'center' });
      cy += 10;
    } else if (style === 'ornate') {
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`✦ CHAPTER ${i + 1} ✦`, pw / 2, cy, { align: 'center' });
      cy += 7;
      doc.setFontSize(16);
      doc.text(ch.title || 'Untitled Chapter', pw / 2, cy, { align: 'center', maxWidth: pw - 2 * margin });
      cy += 4;
      doc.setDrawColor(200, 160, 60);
      doc.line(margin + 20, cy, pw - margin - 20, cy);
      cy += 10;
    }

    // Chapter content
    doc.setTextColor(textColor);
    const plainText = htmlToText(ch.content || '');
    const paragraphs = plainText.split(/\n\n+/).filter(p => p.trim());
    for (const para of paragraphs) {
      const cleaned = para.replace(/\n/g, ' ').trim();
      if (!cleaned) continue;
      cy = writeText(cleaned, margin, cy, { size: fontSize });
      cy += lineH * 0.4;
    }
    drawPageNum();
  }

  // ---- BACK MATTER ----
  const backSections = [
    { key: 'hasEpilogue', label: 'Epilogue' },
    { key: 'hasAfterword', label: 'Afterword' },
    { key: 'hasGlossary', label: 'Glossary' },
    { key: 'hasBibliography', label: 'Bibliography / References' },
    { key: 'hasIndex', label: 'Index' },
    { key: 'hasAboutAuthor', label: 'About the Author' },
    { key: 'hasColophon', label: 'Colophon' },
  ];
  for (const sec of backSections) {
    const el = document.getElementById(sec.key);
    if (el && el.checked) {
      addPage();
      currentChapterTitle = sec.label;
      drawHeader(sec.label);
      let sy = margin + (showHeader ? 12 : 4);
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(headingColor);
      doc.text(sec.label, pw / 2, sy, { align: 'center' });
      sy += 10;
      if (sec.key === 'hasColophon') {
        sy = writeText(`This book was typeset with AuthorPro.\nhttps://avinashwalton.github.io/AuthorPro/`, margin, sy, { style: 'italic', size: 9 });
      } else {
        sy = writeText(`(Write your ${sec.label} content here)`, margin, sy, { style: 'italic', size: fontSize });
      }
      drawPageNum();
    }
  }

  // Save
  const safeTitle = (bookTitle || 'book').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_AuthorPro.pdf`);
  showToast('✅ PDF downloaded successfully!', 'success');
}

// ===== EPUB EXPORT =====
function exportEPUB() {
  const bookTitle = document.getElementById('bookTitle').value || 'Untitled Book';
  const author = document.getElementById('authorName').value || 'Unknown Author';
  const publisher = document.getElementById('publisherName').value || '';
  const year = document.getElementById('pubYear').value || new Date().getFullYear();
  const isbn = document.getElementById('isbnNum').value || '';
  const uniqueId = 'authorpro-' + Date.now();

  let navItems = '';
  let contentDocuments = '';
  let manifestItems = '';
  let spineItems = '';
  let itemIndex = 1;

  function addItem(id, href, mediaType, spineEntry = true, properties = '') {
    manifestItems += `<item id="${id}" href="${href}" media-type="${mediaType}"${properties ? ` properties="${properties}"` : ''}/>\n`;
    if (spineEntry) spineItems += `<itemref idref="${id}"/>\n`;
    itemIndex++;
  }

  // CSS
  const css = `
    body { font-family: Georgia, serif; font-size: 1em; line-height: 1.7; margin: 2em; color: #1a1228; }
    h1 { font-size: 2em; text-align: center; margin: 1em 0 0.5em; }
    h2 { font-size: 1.5em; margin: 0.8em 0 0.4em; }
    h3 { font-size: 1.2em; }
    .title-page { text-align: center; padding: 4em 0; }
    .chapter-num { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.15em; color: #888; text-align: center; }
    blockquote { border-left: 3px solid #c9a84c; padding-left: 1em; font-style: italic; color: #555; }
    p { margin: 0 0 0.8em; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ddd; padding: 0.4em 0.7em; }
  `;

  const files = {};
  files['EPUB/style.css'] = css;
  addItem('css', 'style.css', 'text/css', false);

  // Title Page
  if (document.getElementById('hasTitlePage').checked) {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>Title Page</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <div class="title-page">
    <h1>${escHtml(bookTitle)}</h1>
    ${document.getElementById('bookSubtitle').value ? `<p><em>${escHtml(document.getElementById('bookSubtitle').value)}</em></p>` : ''}
    <p>— ${escHtml(author)} —</p>
    ${publisher ? `<p>${escHtml(publisher)}</p>` : ''}
    <p>${year}</p>
    ${isbn ? `<p>ISBN: ${escHtml(isbn)}</p>` : ''}
  </div>
</body></html>`;
    files['EPUB/titlepage.xhtml'] = content;
    addItem('titlepage', 'titlepage.xhtml', 'application/xhtml+xml');
    navItems += `<li><a href="titlepage.xhtml">Title Page</a></li>\n`;
  }

  // Front matter
  const frontSecs = [
    { key: 'hasDedication', id: 'dedication', label: 'Dedication' },
    { key: 'hasForeword', id: 'foreword', label: 'Foreword' },
    { key: 'hasPreface', id: 'preface', label: 'Preface' },
    { key: 'hasAcknowledgements', id: 'ack', label: 'Acknowledgements' },
    { key: 'hasIntroduction', id: 'intro', label: 'Introduction' },
  ];
  frontSecs.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      const content = xhtmlPage(sec.label, `<h1>${escHtml(sec.label)}</h1><p><em>Content goes here.</em></p>`);
      files[`EPUB/${sec.id}.xhtml`] = content;
      addItem(sec.id, `${sec.id}.xhtml`, 'application/xhtml+xml');
      navItems += `<li><a href="${sec.id}.xhtml">${escHtml(sec.label)}</a></li>\n`;
    }
  });

  // TOC
  if (document.getElementById('hasTOC').checked) {
    let tocHtml = '<h1>Table of Contents</h1><ul>';
    state.chapters.forEach((ch, i) => {
      tocHtml += `<li><a href="chapter${i}.xhtml">Chapter ${i + 1} — ${escHtml(ch.title || 'Untitled')}</a></li>`;
    });
    tocHtml += '</ul>';
    files['EPUB/toc_page.xhtml'] = xhtmlPage('Table of Contents', tocHtml);
    addItem('toc_page', 'toc_page.xhtml', 'application/xhtml+xml');
    navItems += `<li><a href="toc_page.xhtml">Table of Contents</a></li>\n`;
  }

  // Chapters
  state.chapters.forEach((ch, i) => {
    const chHtml = `
      <p class="chapter-num">Chapter ${i + 1}</p>
      <h1>${escHtml(ch.title || 'Untitled Chapter')}</h1>
      ${ch.content || '<p></p>'}
    `;
    files[`EPUB/chapter${i}.xhtml`] = xhtmlPage(ch.title || `Chapter ${i + 1}`, chHtml);
    addItem(`chapter${i}`, `chapter${i}.xhtml`, 'application/xhtml+xml');
    navItems += `<li><a href="chapter${i}.xhtml">${escHtml(ch.title || `Chapter ${i + 1}`)}</a></li>\n`;
  });

  // Back matter
  const backSecs = [
    { key: 'hasEpilogue', id: 'epilogue', label: 'Epilogue' },
    { key: 'hasAfterword', id: 'afterword', label: 'Afterword' },
    { key: 'hasGlossary', id: 'glossary', label: 'Glossary' },
    { key: 'hasBibliography', id: 'bibliography', label: 'Bibliography' },
    { key: 'hasIndex', id: 'index', label: 'Index' },
    { key: 'hasAboutAuthor', id: 'about', label: 'About the Author' },
  ];
  backSecs.forEach(sec => {
    if (document.getElementById(sec.key) && document.getElementById(sec.key).checked) {
      const content = xhtmlPage(sec.label, `<h1>${escHtml(sec.label)}</h1><p><em>Content goes here.</em></p>`);
      files[`EPUB/${sec.id}.xhtml`] = content;
      addItem(sec.id, `${sec.id}.xhtml`, 'application/xhtml+xml');
      navItems += `<li><a href="${sec.id}.xhtml">${escHtml(sec.label)}</a></li>\n`;
    }
  });

  // Navigation document
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>${navItems}</ol>
  </nav>
</body></html>`;
  files['EPUB/nav.xhtml'] = nav;
  addItem('nav', 'nav.xhtml', 'application/xhtml+xml', true, 'nav');

  // OPF
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uniqueId}</dc:identifier>
    <dc:title>${escHtml(bookTitle)}</dc:title>
    <dc:creator>${escHtml(author)}</dc:creator>
    <dc:publisher>${escHtml(publisher)}</dc:publisher>
    <dc:date>${year}</dc:date>
    <dc:language>en</dc:language>
    ${isbn ? `<dc:identifier opf:scheme="ISBN">${escHtml(isbn)}</dc:identifier>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().slice(0,19)}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`;
  files['EPUB/content.opf'] = opf;
  files['META-INF/container.xml'] = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  files['mimetype'] = 'application/epub+zip';

  // Build ZIP-like blob (simplified: we create a downloadable blob)
  // For a proper EPUB we'd need JSZip; here we create a structured HTML file as EPUB approximation
  // Inform user
  const safeTitle = (bookTitle || 'book').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');

  // Build a simple single HTML file that represents the book (EPUB-like)
  // For true EPUB, JSZip would be needed. We create a .epub downloadable as a zip.
  buildEPUBDownload(files, safeTitle);
}

function buildEPUBDownload(files, title) {
  // Create a combined HTML file that could be opened as ebook
  // Also provide all EPUB files as a JSON for the user to manually package
  // For simplicity, we create a readable single-file HTML ebook
  let fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(document.getElementById('bookTitle').value || 'My Book')}</title>
  <style>
    body{font-family:Georgia,serif;max-width:680px;margin:40px auto;padding:20px;line-height:1.8;color:#1a1228;}
    h1{font-size:2em;text-align:center;margin:1.5em 0 0.5em;}
    .chapter-num{text-align:center;font-size:.75em;letter-spacing:.15em;color:#888;text-transform:uppercase;}
    .page-break{page-break-after:always;border-top:1px dashed #ccc;margin:3em 0;}
    blockquote{border-left:3px solid #c9a84c;padding-left:1em;font-style:italic;}
    .title-page{text-align:center;padding:5em 0;}
    @media print{.page-break{page-break-after:always;}}
  </style>
</head>
<body>`;

  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith('.xhtml') && path !== 'EPUB/nav.xhtml') {
      const div = document.createElement('div');
      div.innerHTML = content.replace(/<\?xml[^?]*\?>|<!DOCTYPE[^>]*>/g, '').replace(/<html[^>]*>|<\/html>|<head>[\s\S]*?<\/head>|<body>|<\/body>/g, '');
      fullHtml += `<section>${div.innerHTML}</section><div class="page-break"></div>`;
    }
  });

  fullHtml += '</body></html>';

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}_AuthorPro.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📱 EPUB (HTML) downloaded! Open in browser or convert to EPUB with Calibre.', 'success');
}

function xhtmlPage(title, bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>${escHtml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${bodyContent}</body></html>`;
}

// ===== SAVE / LOAD =====
function saveProgress() {
  // Sync editors to state
  syncEditorsToState();

  const data = {
    version: '1.0',
    savedAt: new Date().toISOString(),
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
    settings: {
      useUnits: document.getElementById('useUnits').checked,
      pageSize: document.getElementById('pageSize').value,
      bodyFont: document.getElementById('bodyFont').value,
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
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.meta.bookTitle || 'manuscript'}_AuthorPro_save.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Progress saved as JSON file!', 'success');
}

function loadProgress() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        restoreFromData(data);
        showToast('📂 Project loaded successfully!', 'success');
      } catch (err) {
        showToast('Error loading file. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function restoreFromData(data) {
  // Meta
  if (data.meta) {
    Object.entries(data.meta).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) el.value = v;
    });
  }
  // Sections
  if (data.sections) {
    Object.entries(data.sections).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) el.checked = v;
    });
  }
  // Settings
  if (data.settings) {
    const s = data.settings;
    if (s.useUnits !== undefined) document.getElementById('useUnits').checked = s.useUnits;
    ['pageSize','bodyFont','fontSize','lineSpacing','marginSize','chapterStyle','colorTheme'].forEach(k => {
      const el = document.getElementById(k);
      if (el && s[k]) el.value = s[k];
    });
    ['showPageNumbers','showRunningHeader','chapterNewPage'].forEach(k => {
      const el = document.getElementById(k);
      if (el && s[k] !== undefined) el.checked = s[k];
    });
  }
  // Units & Chapters
  state.units = data.units || [];
  state.chapters = [];
  state.chapterCounter = data.chapterCounter || 0;
  state.unitCounter = data.unitCounter || 0;

  // Clear existing tabs
  document.querySelectorAll('.tab-btn:not([data-tab="welcome"])').forEach(t => t.remove());
  document.querySelectorAll('.tab-content:not(#tab-welcome)').forEach(t => t.remove());

  renderUnits();
  if (document.getElementById('useUnits').checked) {
    document.getElementById('addUnitBtn').style.display = 'inline-flex';
  }

  (data.chapters || []).forEach(ch => {
    state.chapters.push(ch);
    createEditorTab(ch);
  });

  renderChapterList();
  if (state.chapters.length > 0) {
    switchTab(state.chapters[0].id);
  } else {
    switchTab('welcome');
  }
}

function clearAll() {
  if (!confirm('Clear everything and start fresh? This cannot be undone.')) return;
  document.querySelectorAll('.tab-btn:not([data-tab="welcome"])').forEach(t => t.remove());
  document.querySelectorAll('.tab-content:not(#tab-welcome)').forEach(t => t.remove());
  state.chapters = [];
  state.units = [];
  state.chapterCounter = 0;
  state.unitCounter = 0;
  renderChapterList();
  renderUnits();
  switchTab('welcome');
  localStorage.removeItem('authorpro_autosave');
  showToast('🗑️ Everything cleared.', 'success');
}

// ===== AUTO SAVE =====
function scheduleAutoSave() {
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    saveToLocalStorage();
    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
      indicator.textContent = '✓ Auto-saved';
      indicator.style.color = '#4ade80';
    }
  }, 2000);
}

function initAutoSave() {
  // Save to localStorage every 60s as backup
  setInterval(() => {
    syncEditorsToState();
    saveToLocalStorage();
  }, 60000);
}

function syncEditorsToState() {
  state.chapters.forEach(ch => {
    const editor = document.getElementById(`editor_${ch.id}`);
    if (editor) ch.content = editor.innerHTML;
  });
}

function saveToLocalStorage() {
  try {
    syncEditorsToState();
    const data = {
      meta: {
        bookTitle: document.getElementById('bookTitle').value,
        bookSubtitle: document.getElementById('bookSubtitle').value,
        authorName: document.getElementById('authorName').value,
        publisherName: document.getElementById('publisherName').value,
        pubYear: document.getElementById('pubYear').value,
        isbnNum: document.getElementById('isbnNum').value,
        editionNum: document.getElementById('editionNum').value,
      },
      chapters: state.chapters,
      units: state.units,
      chapterCounter: state.chapterCounter,
      unitCounter: state.unitCounter,
    };
    localStorage.setItem('authorpro_autosave', JSON.stringify(data));
  } catch (e) { /* localStorage might be full */ }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('authorpro_autosave');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.chapters && data.chapters.length > 0) {
        restoreFromData(data);
        showToast('✓ Auto-save restored.', 'success');
      }
    }
  } catch (e) { /* ignore */ }
}

// ===== FAQ =====
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  document.querySelectorAll('.faq-a.open').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
}

// ===== TOAST =====
let toastTimeout;
function showToast(msg, type = '') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimeout);
  requestAnimationFrame(() => {
    toast.classList.add('show');
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
  });
}

// ===== UTILITY =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.id === 'wordCountModal') {
    e.target.classList.remove('active');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProgress();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    togglePreview();
  }
  if (e.key === 'Escape') {
    document.getElementById('previewModal').classList.remove('active');
    document.getElementById('wordCountModal').classList.remove('active');
  }
});
