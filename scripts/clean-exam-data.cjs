/**
 * clean-exam-data.cjs — 清洗 exam.json
 *
 * 任务1: 将题干中包含 A./B./C./D. 选项模式的 QA 题转为 choice 类型
 * 任务2: 将 QA 题干末尾括号内的疑似答案提取到 answer 字段
 *
 * 用法: node scripts/clean-exam-data.cjs
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'src', 'data', 'exam.json');
const BACKUP = path.join(__dirname, '..', 'src', 'data', 'exam.json.bak');

// 读取数据
const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// 备份
fs.writeFileSync(BACKUP, JSON.stringify(data, null, 2), 'utf-8');
console.log('已备份: exam.json.bak');

let stats = {
  qaToChoice: 0,
  parenExtracted: 0,
  totalQa: 0,
  totalChoice: 0,
};

// ===== 辅助函数 =====

/** 从题干中检测并提取内嵌选项 (A.xxx B.xxx C.xxx) */
function extractEmbeddedOptions(question) {
  // 匹配 A.xxx B.xxx C.xxx D.xxx E.xxx 模式
  // 支持 A. A、A．A) A）等多种标点
  const optionRegex = /([A-E])[\.、．\)）]\s*/g;
  const matches = [...question.matchAll(optionRegex)];

  if (matches.length < 2) return null; // 至少要有2个选项

  // 找到第一个选项标记的位置
  const firstIdx = matches[0].index;
  const pureQuestion = question.substring(0, firstIdx).trim();
  const optionsText = question.substring(firstIdx);

  // 解析选项：按 [A-E][\.、．\)）] 分割
  const parts = optionsText.split(/([A-E])[\.、．\)）]\s*/).filter(Boolean);
  const options = [];
  for (let i = 0; i < parts.length; i += 2) {
    const label = parts[i];
    const text = (parts[i + 1] || '').trim();
    if (label && /^[A-E]$/.test(label)) {
      options.push({ label, text });
    }
  }

  return options.length >= 2 ? { pureQuestion, options } : null;
}

/** 判断括号内容是否为疑似答案 */
function isLikelyAnswer(parenContent) {
  const inner = parenContent.trim();
  if (!inner) return false;

  // 跳过填空标记
  if (/_{2,}/.test(inner)) return false;
  if (/^[\s_（）]*$/.test(inner)) return false;
  if (inner === '）' || inner === '）') return false;

  // 跳过明显是另一道题目的描述（含句号、问号、长句）
  if (/[。；，：？！?]/.test(inner) && inner.length > 15) return false;
  if (inner.length > 25) return false;

  // 跳过描述性子问题（含"解释"、"说明"、"试述"等长篇指令）
  if (/^(?:解释|说明|试述|何谓|名词解释|举例)/.test(inner)) return false;

  // 含 "/" → 很可能是答案选项
  if (/\//.test(inner)) return true;

  // 短内容（≤15字），纯中文/字母/数字 → 可能是答案
  if (inner.length <= 15 && /^[一-龥a-zA-Z0-9+\-*/，,、\s]+$/.test(inner)) {
    return true;
  }

  return false;
}

/** 提取题干末尾的疑似答案括号 */
function extractTrailingParenAnswer(question) {
  // 匹配末尾的括号内容
  const match = question.match(/[（(]([^（）]{1,40})[）)]\s*$/);
  if (!match) return null;

  const parenContent = match[1];
  if (isLikelyAnswer(parenContent)) {
    return {
      answer: parenContent.trim(),
      cleanedQuestion: question.substring(0, match.index).trim(),
    };
  }
  return null;
}

// ===== 主处理 =====

function processItem(item) {
  if (item.type === 'qa') {
    stats.totalQa++;

    // --- 任务1: 检测内嵌选项 → 转为 choice ---
    const embedded = extractEmbeddedOptions(item.question);
    if (embedded) {
      item.type = 'multiple_choice';
      item.question = embedded.pureQuestion;
      item.options = embedded.options;

      // 如果已有答案，且是单个字母 (A-E)，保持不变
      // 如果答案不是单字母，尝试匹配
      if (item.answer && !/^[A-E]$/.test(item.answer.trim())) {
        // 答案可能是文本形式，尝试匹配到选项
        const matched = embedded.options.find(o =>
          o.text.includes(item.answer.trim()) || item.answer.trim().includes(o.text)
        );
        if (matched) {
          item.answer = matched.label;
        }
      }
      stats.qaToChoice++;
      stats.totalChoice++;
      return;
    }

    // --- 任务2: 提取末尾括号答案 ---
    const extracted = extractTrailingParenAnswer(item.question);
    if (extracted) {
      // 只在答案为空或明显不对时才覆盖
      if (!item.answer || !item.answer.trim() || item.answer.trim().length === 0) {
        item.answer = extracted.answer;
        item.question = extracted.cleanedQuestion;
        stats.parenExtracted++;
      } else {
        // 已有答案，仅清理题干
        item.question = extracted.cleanedQuestion;
      }
    }
  } else if (item.type === 'multiple_choice') {
    stats.totalChoice++;
  }
}

// 遍历所有题目
data.sections.forEach(sec => {
  sec.chapters.forEach(ch => {
    ch.topics.forEach(t => {
      t.subTopics.forEach(st => {
        st.knowledgePoints.forEach(processItem);
      });
    });
  });
});

// 重新统计
let totalItems = 0, totalChapters = 0, totalTopics = 0;
const itemTypes = {};
data.sections.forEach(s => {
  totalChapters += s.chapters.length;
  s.chapters.forEach(ch => {
    totalTopics += ch.topics.length;
    ch.topics.forEach(t => {
      t.subTopics.forEach(st => {
        st.knowledgePoints.forEach(item => {
          totalItems++;
          itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
        });
      });
    });
  });
});

data.stats = {
  totalSections: data.sections.length,
  totalChapters,
  totalTopics,
  totalItems,
  itemTypes,
};

// 写回
fs.writeFileSync(INPUT, JSON.stringify(data, null, 2), 'utf-8');

console.log('\n=== 清洗完成 ===');
console.log(`QA → Choice 转换: ${stats.qaToChoice} 题`);
console.log(`括号答案提取:    ${stats.parenExtracted} 题`);
console.log(`QA 总数:         ${stats.totalQa}`);
console.log(`Choice 总数:     ${stats.totalChoice}`);
console.log(`总条目:          ${totalItems}`);
console.log('题型分布:', JSON.stringify(itemTypes));
console.log('\n备份文件: exam.json.bak');
