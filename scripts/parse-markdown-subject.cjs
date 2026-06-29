/**
 * parse-markdown-subject.cjs
 * 将学科 .md 复习资料转换为 exam.json 结构
 * 用法: node scripts/parse-markdown-subject.cjs --input <file> --output <file> --name <name> --qlevel <minLevel>
 * qlevel: 题目所在的最低标题层级 (3=H3+, 4=H4+, 5=H5+)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; }

const INPUT = getArg('input');
const OUTPUT = getArg('output');
const SUBJECT_NAME = getArg('name') || '未命名';
const QLEVEL = parseInt(getArg('qlevel') || '4', 10);

if (!INPUT || !OUTPUT) {
  console.error('用法: --input <file> --output <file> --name <name> --qlevel <minLevel>');
  process.exit(1);
}

const INPUT_PATH = path.resolve(__dirname, '..', INPUT);
const OUTPUT_PATH = path.resolve(__dirname, '..', OUTPUT);

console.error(`解析: ${INPUT} (qlevel=H${QLEVEL}+)`);

const text = fs.readFileSync(INPUT_PATH, 'utf-8');

// ============ 辅助函数 ============

function extractImages(str) {
  const imgs = [];
  const re = /!\[.*?\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
  let m;
  while ((m = re.exec(str)) !== null) imgs.push(m[1]);
  return imgs;
}

function stripImages(str) {
  return str.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '');
}

function isHeading(line) { return /^#{1,5}\s+\S/.test(line.trim()); }
function headingLevel(line) { const m = line.trim().match(/^(#{1,5})\s/); return m ? m[1].length : 0; }
function headingTitle(line) { return line.trim().replace(/^#{1,5}\s+/, ''); }

function isOption(line) { return /^[A-E][\.\s、．\)）]/.test(line.trim()); }
function parseOption(line) {
  const m = line.trim().match(/^([A-E])[\.\s、．\)）]\s*(.+)/);
  return m ? { label: m[1], text: m[2].replace(/\*{1,2}/g, '').trim() } : null;
}

function isAnswerLetter(line) { return /^[A-E]$/.test(line.trim()); }
function isTableMarkdown(line) { return line.trim().startsWith('|') && line.trim().endsWith('|'); }
function isTableSep(line) { return /^\|[\s\-:|]+\|$/.test(line.trim()); }
function parseTableRow(line) { return line.trim().split('|').slice(1, -1).map(c => c.trim()); }

// 提取年份
function extractYears(text) {
  // 前缀: "16 15 12 题目..."
  let m = text.match(/^((?:\d{2}\s+){1,15})(.+)/);
  if (m) {
    const years = m[1].trim().split(/\s+/).map(y => (parseInt(y) < 50 ? 2000 : 1900) + parseInt(y));
    return { years, text: m[2].trim() };
  }
  // 后缀: "题目（16，15，14法八...）"
  m = text.match(/[（(]([^）)]*\d{2}[^）)]*)[）)]/);
  if (m) {
    const yn = m[1].match(/\d{2}/g);
    if (yn) {
      const years = yn.map(y => (parseInt(y) < 50 ? 2000 : 1900) + parseInt(y));
      return { years, text: text.substring(0, m.index).trim() };
    }
  }
  return null;
}

// ============ 核心解析 ============

function parseMd() {
  const lines = text.split(/\r?\n/);
  console.error(`总行数: ${lines.length}`);

  // === 步骤1: 按标题分段 + 自动构建层级树 ===
  // 每个 segment: { level, title, content (string), children[] }

  const root = { level: 0, title: 'ROOT', content: '', children: [] };
  const stack = [root];
  let curContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeading(line)) {
      // 累积内容到当前节点
      if (curContent.length > 0 && stack.length > 0) {
        const prev = stack[stack.length - 1];
        prev.content = (prev.content ? prev.content + '\n' : '') + curContent.join('\n');
        curContent = [];
      }

      const level = headingLevel(line);
      const title = headingTitle(line);

      // 弹出不再需要的层级
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const node = { level, title, content: '', children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      curContent.push(line);
    }
  }
  // 最后的内容
  if (curContent.length > 0 && stack.length > 0) {
    const prev = stack[stack.length - 1];
    prev.content = (prev.content ? prev.content + '\n' : '') + curContent.join('\n');
  }

  // === 步骤2: 转换树为 exam.json 结构 ===
  let secIdx = 0, chIdx = 0, tpIdx = 0, stIdx = 0, itemIdx = 0;
  const sections = [];

  function processNode(node, parentPath) {
    const lv = node.level;
    const title = node.title;
    const content = node.content || '';

    if (lv === 0) {
      // ROOT - skip preamble, process children
      const skipTitles = new Set(['说明', '前言']);
      for (const child of node.children) {
        if (child.level === 1 && skipTitles.has(child.title)) continue;
        processNode(child, { section: null, chapter: null, topic: null });
      }
      return;
    }

    // 合并文本+子节点内容
    let allContent = content;
    if (node.children.length > 0) {
      // 不合并子节点内容（已经单独处理）
    }

    // === 判断是否到达题目层级 ===
    if (lv >= QLEVEL) {
      // 当前节点是题目层级，解析其内容
      const items = parseItems(content, title);
      if (items.length > 0 || (node.children.length === 0 && content.trim())) {
        // 创建合适的父级结构
        let sec = parentPath.section;
        let ch = parentPath.chapter;
        let tp = parentPath.topic;

        if (!sec) {
          sec = { id: '', title: title, chapters: [] };
          sections.push(sec);
        }
        if (!ch) {
          ch = { id: '', title: title, topics: [] };
          sec.chapters.push(ch);
        }
        if (!tp) {
          tp = { id: '', title: title, subTopics: [] };
          ch.topics.push(tp);
        }

        if (items.length > 0) {
          tp.subTopics.push({ id: '', title: title, knowledgePoints: items });
        }

        // 处理子节点
        const newPath = { section: sec, chapter: ch, topic: tp };
        for (const child of node.children) {
          processNode(child, newPath);
        }
        return;
      }
    }

    // === 结构层级 ===
    if (lv === 1) {
      // H1 → 新 section
      const sec = { id: '', title, chapters: [] };
      sections.push(sec);
      const newPath = { section: sec, chapter: null, topic: null };
      // 如果有内容且不是题目层级，添加到章节
      for (const child of node.children) {
        processNode(child, newPath);
      }
      // 如果没有子节点，把当前内容作为独立章节
      if (node.children.length === 0 && content.trim()) {
        const ch = { id: '', title, topics: [] };
        const tp = { id: '', title, subTopics: [] };
        const items = parseItems(content, title);
        if (items.length > 0) {
          tp.subTopics.push({ id: '', title, knowledgePoints: items });
        }
        ch.topics.push(tp);
        sec.chapters.push(ch);
      }
    } else if (lv === 2) {
      // H2 → 新 chapter
      let sec = parentPath.section;
      if (!sec) {
        sec = { id: '', title, chapters: [] };
        sections.push(sec);
      }
      const ch = { id: '', title, topics: [] };
      sec.chapters.push(ch);
      const newPath = { section: sec, chapter: ch, topic: null };
      for (const child of node.children) {
        processNode(child, newPath);
      }
      if (node.children.length === 0 && content.trim()) {
        const tp = { id: '', title, subTopics: [] };
        const items = parseItems(content, title);
        if (items.length > 0) tp.subTopics.push({ id: '', title, knowledgePoints: items });
        ch.topics.push(tp);
      }
    } else if (lv === 3) {
      // H3 → 新 topic
      let sec = parentPath.section;
      let ch = parentPath.chapter;
      if (!sec) { sec = { id: '', title, chapters: [] }; sections.push(sec); }
      if (!ch) { ch = { id: '', title, topics: [] }; sec.chapters.push(ch); }
      const tp = { id: '', title, subTopics: [] };
      ch.topics.push(tp);
      const newPath = { section: sec, chapter: ch, topic: tp };
      for (const child of node.children) {
        processNode(child, newPath);
      }
      if (node.children.length === 0 && content.trim()) {
        const items = parseItems(content, title);
        if (items.length > 0) tp.subTopics.push({ id: '', title, knowledgePoints: items });
      }
    } else if (lv >= 4 && lv < QLEVEL) {
      // H4/H5 but below question level → subTopic with headings
      let sec = parentPath.section;
      let ch = parentPath.chapter;
      let tp = parentPath.topic;
      if (!sec) { sec = { id: '', title, chapters: [] }; sections.push(sec); }
      if (!ch) { ch = { id: '', title, topics: [] }; sec.chapters.push(ch); }
      if (!tp) { tp = { id: '', title, subTopics: [] }; ch.topics.push(tp); }
      const newPath = { section: sec, chapter: ch, topic: tp };
      for (const child of node.children) {
        processNode(child, newPath);
      }
      if (node.children.length === 0 && content.trim()) {
        const items = parseItems(content, title);
        if (items.length > 0) tp.subTopics.push({ id: '', title, knowledgePoints: items });
      }
    }
  }

  processNode(root, { section: null, chapter: null, topic: null });

  // === 步骤3: 清理、重编号、统计 ===
  let totalItems = 0, totalCh = 0, totalTp = 0;
  const itemTypes = {};

  const newSections = [];
  for (const s of sections) {
    const newChs = [];
    for (const ch of s.chapters) {
      const newTps = [];
      for (const tp of ch.topics) {
        const newSts = [];
        for (const st of tp.subTopics) {
          if (!st.knowledgePoints || st.knowledgePoints.length === 0) continue;
          st.id = `subtopic-${stIdx++}`;
          for (const item of st.knowledgePoints) {
            item.id = `item-${itemIdx++}`;
            item.tags = item.tags || [];
            item.options = item.options || [];
            item.years = item.years || [];
            totalItems++;
            itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
          }
          newSts.push(st);
        }
        if (newSts.length === 0) continue;
        tp.id = `topic-${tpIdx++}`;
        tp.subTopics = newSts;
        newTps.push(tp);
      }
      if (newTps.length === 0) continue;
      ch.id = `chapter-${chIdx++}`;
      ch.topics = newTps;
      totalTp += newTps.length;
      newChs.push(ch);
    }
    if (newChs.length === 0) continue;
    s.id = `section-${secIdx++}`;
    s.chapters = newChs;
    totalCh += newChs.length;
    newSections.push(s);
  }

  console.error(`Sections: ${newSections.length}, Chapters: ${totalCh}, Topics: ${totalTp}, Items: ${totalItems}`);
  console.error('Types:', JSON.stringify(itemTypes));

  return {
    metadata: { title: SUBJECT_NAME, source: INPUT, generated: new Date().toISOString(), totalLines: lines.length },
    sections: newSections,
    stats: { totalSections: newSections.length, totalChapters: totalCh, totalTopics: totalTp, totalItems, itemTypes },
  };
}

// ============ 解析题目内容 ============

/** 从文本中提取粗体答案: **D** 或 **D xxx** */
function extractBoldAnswer(text) {
  let m = text.match(/\*\*([A-E])\*\*/);
  if (m) return m[1];
  m = text.match(/\*\*([A-E])\s[^*]*\*\*/);
  if (m) return m[1];
  return null;
}

/** 检测行内选项: "A xxx B xxx C xxx D xxx E xxx" */
function extractInlineOptions(text) {
  // 分割点在 [A-E] 后跟分隔符的位置 (A.xxx, A xxx, A、xxx)
  const parts = text.split(/(?=[A-E][\.\s、．\)）])/);
  if (parts.length < 3) return null;
  const pre = parts[0].trim();
  const opts = [];
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^([A-E])[\.\s、．\)）]\s*(.+)/);
    if (m) {
      // 清理选项文本——移除可能粘连的下一个选项
      let txt = m[2].replace(/\*{1,2}/g, '').trim();
      txt = txt.replace(/\s*[A-E][\.\s、．\)）]\s*$/, '').trim();
      opts.push({ label: m[1], text: txt });
    }
  }
  return opts.length >= 2 ? { pre, opts } : null;
}

function parseItems(content, headingTitle) {
  // 合并参数
  if (headingTitle === undefined) headingTitle = '';

  if (!content || !content.trim()) {
    if (headingTitle && headingTitle.trim()) {
      const y = extractYears(headingTitle);
      return [{
        type: 'qa',
        years: y ? y.years : [],
        question: y ? y.text : headingTitle,
        answer: null, options: [], explanation: null, images: [], tags: [], id: '',
      }];
    }
    return [];
  }

  const items = [];
  const lines = content.split('\n');

  // 收集图片
  const allImgs = [];
  for (const l of lines) allImgs.push(...extractImages(l));

  // 清理文本行
  const cleanLines = lines.map(l => stripImages(l)).filter(l => {
    const t = l.trim();
    return t && !isHeading(t);
  });

  if (cleanLines.length === 0) {
    if (allImgs.length > 0) {
      return [{ type: 'qa', years: [], question: headingTitle || '', answer: null, options: [], explanation: null, images: allImgs, tags: [], id: '' }];
    }
    return [];
  }

  const nonEmpty = cleanLines.filter(l => l.trim());
  if (nonEmpty.length === 0) return [];

  // 检测是否有独立行选项
  const hasLineOptions = nonEmpty.filter(l => isOption(l)).length >= 2;

  // 检测是否有表格
  const hasTables = nonEmpty.some(l => isTableMarkdown(l) && !isTableSep(l));

  // 检测行内选项 (整段文本中)
  const fullText = nonEmpty.join('\n');
  const inlineResult = extractInlineOptions(fullText);

  // === MC: 独立行选项 ===
  if (hasLineOptions) {
    const preOptLines = [];
    const opts = [];
    const postOptLines = [];
    let phase = 'pre';

    for (const l of nonEmpty) {
      const t = l.trim();
      if (phase === 'pre') {
        if (isOption(t)) { phase = 'opts'; opts.push(parseOption(t)); }
        else { preOptLines.push(t); }
      } else if (phase === 'opts') {
        if (isOption(t)) { opts.push(parseOption(t)); }
        else { phase = 'post'; postOptLines.push(t); }
      } else {
        postOptLines.push(t);
      }
    }

    const qText = preOptLines.join('\n') || headingTitle;
    const postText = postOptLines.join('\n');

    // 找答案：1) 粗体 2) 单字母 3) 从解释文本匹配选项文本
    let answer = extractBoldAnswer(content);
    if (!answer) {
      for (const l of postOptLines) {
        if (isAnswerLetter(l.trim())) { answer = l.trim(); break; }
      }
    }
    // 尝试从解释文本中找匹配的选项内容
    if (!answer && postText) {
      for (const opt of opts) {
        if (opt.text.length > 5 && postText.includes(stripImages(opt.text).substring(0, 10))) {
          answer = opt.label; break;
        }
      }
    }

    const y = extractYears(qText);
    items.push({
      type: 'multiple_choice',
      years: y ? y.years : [],
      question: y ? y.text : qText,
      answer: answer || null,
      options: opts,
      explanation: postText || null,
      images: allImgs,
    });
    return items;
  }

  // === MC: 行内选项 ===
  if (inlineResult && inlineResult.opts.length >= 2) {
    const { pre, opts } = inlineResult;
    const qText = pre || headingTitle;

    // 提取粗体答案
    let answer = extractBoldAnswer(fullText);

    // 清理选项粗体标记
    const cleanOpts = opts.map(o => ({
      label: o.label,
      text: o.text.replace(/\*{1,2}/g, ''),
    }));

    const y = extractYears(qText);
    items.push({
      type: 'multiple_choice',
      years: y ? y.years : [],
      question: y ? y.text : qText,
      answer: answer || null,
      options: cleanOpts,
      explanation: null,
      images: allImgs,
    });
    return items;
  }

  // === 表格 ===
  if (hasTables) {
    const headers = [];
    const rows = [];
    for (const l of nonEmpty) {
      const t = l.trim();
      if (isTableMarkdown(t) && !isTableSep(t)) {
        const r = parseTableRow(t);
        if (headers.length === 0) headers.push(...r);
        else rows.push(r);
      }
    }
    items.push({
      type: 'table', headers, rows,
      images: allImgs, years: [], tags: [],
    });
    return items;
  }

  // === QA: 标题是题目，内容是答案 ===
  // 如果有 headingTitle，用它作为题目
  let questionText, answerText;

  if (headingTitle && fullText) {
    // 标题作为题目，内容作为答案
    questionText = headingTitle;
    answerText = fullText;
  } else if (headingTitle) {
    questionText = headingTitle;
    answerText = null;
  } else if (fullText.length > 200) {
    // 没有标题且内容很长，尝试分离
    const paragraphs = fullText.split(/\n\n+/);
    if (paragraphs.length >= 2) {
      questionText = paragraphs[0].trim();
      answerText = paragraphs.slice(1).join('\n').trim();
    } else {
      questionText = fullText;
      answerText = null;
    }
  } else {
    questionText = fullText;
    answerText = null;
  }

  const y = extractYears(questionText);
  items.push({
    type: 'qa',
    years: y ? y.years : [],
    question: y ? y.text : questionText,
    answer: answerText,
    options: [],
    explanation: null,
    images: allImgs,
    tags: [],
  });
  return items;
}

// ============ 执行 ============

try {
  const data = parseMd();
  const json = JSON.stringify(data, null, 2);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, json, 'utf-8');
  console.error(`✓ ${OUTPUT_PATH} (${(json.length / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('失败:', err.message);
  console.error(err.stack);
  process.exit(1);
}
