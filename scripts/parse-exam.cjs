/**
 * parse-exam.js
 * 解析 exam_data.txt (GBK编码)，提取中医学复习资料的结构化数据，
 * 输出为 data/exam.json
 */

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// === 配置 ===
const INPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'exam_data.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'exam.json');

// === 已知的章节标题 ===
const MAJOR_SECTIONS = ['中医内科', '针灸', '前言'];

// 主要章节 (一级标题)
const KNOWN_CHAPTERS = new Set([
  '绪论', '阴阳五行学说', '藏像学说', '病因病机', '诊法',
  '辩证', '防治原则', '治法', '中药', '方剂',
  '经络学', '腧穴学', '十四经循行与常用腧穴', '刺法炙法学',
  '炙法', '拔罐', '电针疗法', '针法', '毫针刺法',
  '中医口腔科'
]);

// 常见主题标题 (二级/三级)
const KNOWN_TOPICS = new Set([
  '中医药学的历史沿革', '中医药学的基本特点', '临床医学分科的发展',
  '阴阳学说', '五行学说', '阴阳的基本概念', '阴阳的相互关系',
  '阴阳学说在中医学中的应用', '事物的五行分类', '五行的生克乘侮',
  '五行学说在中医学中的应用', '藏像的基本概念', '藏像学说', '概述',
  '脏腑', '五脏', '六腑', '奇恒之腑', '脑', '三焦',
  '精、气、血、津液、神', '精、气、血、津液、神的相互关系',
  '病因', '六淫', '风邪', '寒邪', '暑邪', '湿邪', '燥邪', '火邪',
  '痰饮', '淤血', '其他', '病机', '正邪相争', '正邪盛衰与虚实变化',
  '望诊', '闻诊', '问诊', '切诊', '望色', '局部望诊', '望排泄物',
  '问疼痛', '问二便', '常见脉象与临床意义', '脉诊',
  '八纲辨证', '虚实辨证', '脏腑辨证', '气血津液辩证', '血病辨证',
  '阴阳辩证', '表里辩证',
  '调整阴阳', '扶正祛邪', '三因制宜', '病治异同', '治未病',
  '汗法', '吐法', '下法', '和法', '温法', '清法', '消法', '补法',
  '中药煎服法', '升降浮沉', '配伍',
  '清热药', '祛湿药', '泻下药', '行气药', '消导药', '理血药',
  '安神药', '平肝熄风药', '补虚药', '补血药', '补阴药', '补阳药',
  '固涩药', '常用方剂', '方剂的组成变化',
  '经络的意义与经络系统的主要内容', '经络的意义', '经络系统的组成',
  '经络的功能和作用', '十二经脉的流注和交接规律',
  '十二经脉的络属表里关系', '奇经八脉',
  '腧穴的命名、概念、分类及作用', '腧穴的定位',
  '骨度分寸取穴法', '手指同身寸取穴法', '简便取穴法',
  '脏腑兼病辨证', '气血同病辨证', '津液辨证',
  '针刺的角度和深度', '行针与得气', '针刺异常情况及处理',
  '头痛', '失眠', '胃痛', '泄泻', '腰痛', '四肢痛', '中风后遗症',
  '面瘫', '落枕',
  '中医口腔科', '气', '气的分类', '气的功能',
  '一、津液的基本概念', '二、津与液的区别', '三、津与液的联系',
  '一、津液输布的核心脏腑及功能', '二、津液排泄的关键环节',
  '三、津液代谢的核心脏腑 —— 肺、脾、肾',
  '一、气与血的基本属性与总纲', '二、气为血之帅（气对血的主导作用）',
  '三、血为气之母（血对气的滋养承载）', '四、总结',
  '一、六淫的基本定义', '二、六淫的致病条件', '三、六淫的别称与性质',
  '一、痰饮的基本概念', '二、痰饮的形成', '三、痰饮的致病特点',
  '一、八纲辨证：里虚寒证（偏阳虚寒湿）',
  '二、脏腑辨证：脾阳虚衰，兼及肾阳不足',
  '三、从脏象学说解析大便溏稀的机制',
  '四、以中医八法论治法：温补为主，兼化湿调中',
  '五、综合治法总结',
  '一、八纲辨证分析', '二、脏腑辨证分析', '三、鉴别要点', '四、病机总结',
  '一、临床表现', '二、常见诱因', '三、处理措施',
  '一、手太阴肺经', '二、手阳明大肠经', '三、足阳明胃经', '四、足太阴脾经',
  '五、手少阴心经', '六、手太阳小肠经', '七、足太阳膀胱经',
  '八、足少阴肾经', '九、手厥阴心包经', '十、手少阳三焦经',
  '十一、足少阳胆经', '十二、足厥阴肝经', '督脉', '任脉',
  // 五脏子标题
  '心', '肺', '脾', '肝', '肾',
  // 病证子标题
  '（一）心脾两虚', '（二）阴虚火旺', '（二）湿热泄泻', '（三）脾虚泄泻',
  '（四）肾虚泄泻', '（一）寒湿腰痛', '（二）肾虚腰痛', '（三）劳损腰痛',
  '（一）临床表现', '（二）常见诱因', '（三）处理措施',
  // 中药分类子标题
  '清热药', '祛湿药', '泻下药', '行气药', '消导药', '理血药',
  '安神药', '平肝熄风药', '补虚药', '补血药', '补阴药', '补阳药', '固涩药',
  '解表药', '攻下药', '峻下逐水药',
  // 方剂分类
  '解表剂', '清热剂', '温里剂', '补益剂', '理气剂', '理血剂',
  '祛湿剂', '祛痰剂', '消导剂', '固涩剂', '安神剂', '开窍剂',
  '驱虫剂', '涌吐剂', '治燥剂', '治风剂', '和解剂',
  // 针灸病证
  '四、头痛', '七、失眠', '八、胃痛', '十、泄泻', '十二、腰痛',
  '十三、四肢痛', '十四、中风后遗症', '十七、面瘫', '十八、落枕',
  '食滞胃肠症', '膀胱湿热证', '虚寒证', '虚证', '实证', '表证', '里证',
  '阳虚证', '阴虚证', '亡阳证', '亡阴证',
  '里、虚热、实、阴虚',
  '虚寒证的病因病机',
]);

// 疑似非标题模式（用于排除）
const NOT_A_HEADER_PATTERN = /^\d{2}\s|^[A-E][\s\.\?]|^[①②③④⑤⑥⑦⑧⑨⑩]|^[o○]|^解析|^归经|^定位|^主治|^机理|^位置|^简易|^脏腑|^机理/;

// === TCM 专有名词词典 (用于标注) ===
const TCM_TERMS = {
  // 经络 meridians
  meridians: [
    '手太阴肺经', '手阳明大肠经', '足阳明胃经', '足太阴脾经',
    '手少阴心经', '手太阳小肠经', '足太阳膀胱经', '足少阴肾经',
    '手厥阴心包经', '手少阳三焦经', '足少阳胆经', '足厥阴肝经',
    '任脉', '督脉', '冲脉', '带脉', '阴维脉', '阳维脉', '阴跷脉', '阳跷脉'
  ],
  // 常用穴位 acupoints (部分列表)
  acupoints: [
    '合谷', '曲池', '足三里', '三阴交', '太冲', '内关', '外关', '神门',
    '太溪', '大椎', '百会', '关元', '气海', '中脘', '天枢', '风池',
    '太阳', '迎香', '地仓', '颊车', '下关', '翳风', '阳白', '鱼腰',
    '列缺', '后溪', '委中', '承山', '至阴', '肾俞', '心俞', '大肠俞',
    '膀胱俞', '腰俞', '命门', '悬枢', '次髎', '支沟', '阴陵泉', '阳陵泉',
    '中冲', '大陵', '曲泽', '少商', '尺泽', '孔最', '鱼际', '太渊',
    '商阳', '二间', '三间', '上廉', '下廉', '手三里', '肩髃', '头维',
    '梁丘', '上巨虚', '下巨虚', '丰隆', '解溪', '内庭', '厉兑',
    '隐白', '太白', '地机', '血海', '大横', '大包',
    '少海', '灵道', '通里', '阴郄', '少冲', '少泽', '前谷', '养老', '听宫',
    '昆仑', '申脉', '照海', '复溜', '涌泉', '天池', '天泉', '郄门', '间使',
    '中渚', '液门', '阳池', '天井', '丝竹空', '耳门',
    '风市', '环跳', '光明', '悬钟', '足临泣', '足窍阴',
    '大敦', '行间', '章门', '期门', '曲泉', '中都', '蠡沟',
    '膻中', '鸠尾', '神阙', '水分', '石门', '中极', '长强', '腰阳关',
    '至阳', '灵台', '身柱', '陶道', '风府', '囟会', '上星', '素髎', '水沟',
    '承浆', '廉泉', '天突', '璇玑', '华盖', '紫宫', '玉堂',
    '印堂', '太阳', '落枕穴', '阿是穴', '夹脊穴', '四神聪', '安眠',
    '牙痛穴', '肩井', '天宗', '秉风', '肩外俞', '肩中俞', '天柱', '风门',
    '肺俞', '膈俞', '肝俞', '胆俞', '脾俞', '胃俞', '三焦俞', '小肠俞',
    '秧边', '承扶', '殷门', '委阳', '飞扬', '跗阳', '金门', '京骨', '束骨',
    '然谷', '交信', '筑宾', '阴谷', '横骨', '大赫', '气穴', '四满',
    '角孙', '耳尖', '耳穴', '皮质下', '内分泌', '交感', '神门穴',
    '子宫', '胃', '肝', '肾', '心', '肺', '脾', '胆', '三焦穴',
    '口', '鼻', '眼', '目', '面', '额', '枕', '颞', '颌',
    '腕', '踝', '膝', '肘', '肩', '指', '趾', '颈', '胸', '腹',
    '腰', '骶', '坐骨', '臀', '股', '腓', '胫',
  ],
  // 方剂 formulas
  formulas: [
    '麻黄汤', '桂枝汤', '小青龙汤', '银翘散', '桑菊饮', '白虎汤',
    '大承气汤', '小承气汤', '调胃承气汤', '大黄牡丹汤', '温脾汤',
    '小柴胡汤', '大柴胡汤', '四逆散', '逍遥散', '半夏泻心汤',
    '四君子汤', '六君子汤', '参苓白术散', '补中益气汤', '生脉散',
    '四物汤', '当归补血汤', '归脾汤', '八珍汤', '十全大补汤',
    '六味地黄丸', '知柏地黄丸', '杞菊地黄丸', '金匮肾气丸',
    '右归丸', '左归丸', '大补阴丸', '一贯煎', '百合固金汤',
    '理中丸', '附子理中丸', '吴茱萸汤', '四逆汤',
    '血府逐瘀汤', '补阳还五汤', '失笑散', '丹参饮', '桃核承气汤',
    '二陈汤', '温胆汤', '清气化痰丸', '半夏白术天麻汤',
    '平胃散', '藿香正气散', '茵陈蒿汤', '八正散', '五苓散', '猪苓汤',
    '真武汤', '苓桂术甘汤', '实脾散', '羌活胜湿汤', '独活寄生汤',
    '朱砂安神丸', '天王补心丹', '酸枣仁汤', '安宫牛黄丸',
    '天麻钩藤饮', '镇肝熄风汤', '羚角钩藤汤',
    '玉屏风散', '牡蛎散', '四神丸', '金锁固精丸', '固冲汤',
    '保和丸', '健脾丸', '枳实导滞丸',
    '川芎茶调散', '杏苏散', '桑杏汤', '清燥救肺汤',
    '麦门冬汤', '养阴清肺汤', '玉女煎',
    '旋覆代赭汤', '苏子降气汤', '定喘汤',
    '桃红四物汤', '少腹逐瘀汤', '膈下逐瘀汤',
    '十灰散', '小蓟饮子', '槐花散', '黄土汤',
    '川芎茶调散', '消风散', '大秦艽汤', '牵正散', '玉真散',
    '乌梅丸', '肥儿丸', '布袋丸', '化虫丸',
    '香苏散', '杏苏散', '葱豉汤',
    '大青龙汤', '麻杏石甘汤', '葛根汤', '升麻葛根汤',
    '荆防败毒散', '参苏饮', '再造散', '加减葳蕤汤',
    '凉膈散', '普济消毒饮', '仙方活命饮', '导赤散', '龙胆泻肝汤',
    '苇茎汤', '清胃散', '泻黄散', '玉女煎', '白头翁汤', '青蒿鳖甲汤',
    '新加香薷饮', '六一散', '桂苓甘露饮', '清暑益气汤',
    '理中丸', '大建中汤',
    '当归四逆汤', '黄芪桂枝五物汤',
    '大补阴丸', '炙甘草汤',
    '越鞠丸', '柴胡疏肝散', '金铃子散', '瓜蒌薤白白酒汤',
    '半夏厚朴汤', '天台乌药散', '暖肝煎', '苏子降气汤', '定喘汤',
    '旋覆代赭汤', '橘皮竹茹汤', '丁香柿蒂汤',
    '生化汤', '桂枝茯苓丸', '大黄蛰虫丸',
    '复元活血汤', '七厘散',
    '咳血方', '槐花散', '小蓟饮子',
    '三仁汤', '甘露消毒丹', '连朴饮', '当归拈痛汤',
    '二妙散', '五皮散', '萆薢分清饮',
    '苓甘五味姜辛汤', '三子养亲汤', '滚痰丸', '贝母瓜蒌散',
    '消瘰丸', '小金丹',
    '乌梅丸', '化虫丸',
    '大定风珠', '阿胶鸡子黄汤', '大秦艽汤',
    '增液汤', '麦门冬汤', '益胃汤',
    '清瘟败毒饮', '犀角地黄汤', '黄连解毒汤',
  ],
  // 中药 herbs
  herbs: [
    '麻黄', '桂枝', '紫苏', '生姜', '香薷', '荆芥', '防风', '羌活',
    '白芷', '细辛', '藁本', '苍耳子', '辛夷', '薄荷', '牛蒡子',
    '蝉蜕', '桑叶', '菊花', '蔓荆子', '柴胡', '升麻', '葛根',
    '淡豆豉', '浮萍', '石膏', '知母', '芦根', '天花粉', '竹叶',
    '淡竹叶', '栀子', '夏枯草', '决明子', '谷精草', '密蒙花',
    '黄芩', '黄连', '黄柏', '龙胆草', '秦皮', '苦参', '白鲜皮',
    '金银花', '连翘', '板蓝根', '大青叶', '青黛', '贯众',
    '蒲公英', '紫花地丁', '野菊花', '鱼腥草', '败酱草',
    '白头翁', '马齿苋', '鸦胆子', '射干', '山豆根', '马勃',
    '生地黄', '玄参', '牡丹皮', '赤芍', '紫草',
    '青蒿', '白薇', '地骨皮', '银柴胡', '胡黄连',
    '大黄', '芒硝', '番泻叶', '芦荟',
    '火麻仁', '郁李仁', '甘遂', '大戟', '芫花', '巴豆',
    '独活', '威灵仙', '川乌', '草乌', '蕲蛇', '乌梢蛇',
    '木瓜', '秦艽', '防己', '桑枝', '豨莶草', '络石藤',
    '五加皮', '桑寄生', '狗脊', '千年健',
    '苍术', '厚朴', '藿香', '佩兰', '砂仁', '白豆蔻', '草豆蔻', '草果',
    '茯苓', '猪苓', '泽泻', '薏苡仁', '车前子', '滑石', '木通',
    '通草', '瞿麦', '萹蓄', '地肤子', '海金沙', '石韦', '萆薢',
    '茵陈', '金钱草', '虎杖',
    '附子', '干姜', '肉桂', '吴茱萸', '小茴香', '丁香', '高良姜', '花椒',
    '陈皮', '青皮', '枳实', '木香', '沉香', '川楝子', '乌药',
    '香附', '佛手', '香橼', '玫瑰花', '薤白', '大腹皮', '柿蒂',
    '山楂', '神曲', '麦芽', '谷芽', '莱菔子', '鸡内金',
    '使君子', '苦楝皮', '槟榔', '雷丸', '南瓜子',
    '小蓟', '大蓟', '地榆', '槐花', '侧柏叶', '白茅根',
    '三七', '茜草', '蒲黄', '花蕊石', '降香',
    '白及', '仙鹤草', '棕榈炭', '血余炭', '藕节',
    '艾叶', '炮姜', '灶心土',
    '川芎', '延胡索', '郁金', '姜黄', '乳香', '没药', '五灵脂',
    '丹参', '红花', '桃仁', '益母草', '牛膝', '鸡血藤',
    '泽兰', '王不留行', '月季花', '土鳖虫', '水蛭', '虻虫',
    '三棱', '莪术', '穿山甲',
    '半夏', '天南星', '白附子', '白芥子', '皂荚', '旋覆花',
    '白前', '前胡', '桔梗', '川贝母', '浙贝母', '瓜蒌',
    '竹茹', '竹沥', '天竺黄', '海藻', '昆布', '胖大海',
    '苦杏仁', '紫苏子', '百部', '紫菀', '款冬花', '马兜铃',
    '枇杷叶', '桑白皮', '葶苈子', '白果',
    '朱砂', '磁石', '龙骨', '琥珀',
    '酸枣仁', '柏子仁', '远志', '合欢皮', '首乌藤',
    '石决明', '珍珠母', '牡蛎', '代赭石',
    '羚羊角', '牛黄', '钩藤', '天麻', '地龙', '全蝎', '蜈蚣', '僵蚕',
    '麝香', '冰片', '苏合香', '石菖蒲',
    '人参', '西洋参', '党参', '太子参', '黄芪', '白术', '山药',
    '白扁豆', '甘草', '大枣', '蜂蜜',
    '鹿茸', '紫河车', '淫羊藿', '巴戟天', '仙茅', '杜仲',
    '续断', '肉苁蓉', '锁阳', '补骨脂', '益智仁',
    '菟丝子', '沙苑子', '蛤蚧', '冬虫夏草', '核桃仁',
    '当归', '熟地黄', '白芍', '何首乌', '阿胶', '龙眼肉',
    '北沙参', '南沙参', '百合', '麦冬', '天冬', '石斛',
    '玉竹', '黄精', '枸杞子', '墨旱莲', '女贞子',
    '龟甲', '鳖甲',
    '五味子', '乌梅', '五倍子', '罂粟壳',
    '麻黄根', '浮小麦',
    '山茱萸', '覆盆子', '桑螵蛸', '金樱子',
    '莲子', '芡实', '海螵蛸',
    '瓜蒂', '常山', '胆矾',
    '雄黄', '硫黄', '白矾', '蛇床子', '蟾酥', '蜂房',
    '升药', '轻粉', '砒石', '铅丹', '炉甘石', '硼砂',
  ]
};

// === 辅助函数 ===

/** 判断是否为年份前缀行 (如 "21 15 12 question text") */
function isYearPrefixed(line) {
  return /^\d{2}\s/.test(line);
}

/** 解析年份前缀，返回 { years: number[], text: string } 或 null */
function parseYearPrefix(line) {
  const match = line.match(/^((?:\d{2}\s)+)(.*)/);
  if (!match) return null;
  const years = match[1].trim().split(/\s+/).map(y => parseInt(y, 10) + 2000);
  const text = match[2].trim().replace(/^\?+/, '').trim();
  return { years, text };
}

/** 判断是否为多选题选项 */
function isMultipleChoiceOption(line) {
  return /^[A-E][\s\.\?]+/.test(line);
}

/** 判断是否为单字母答案 */
function isSingleLetterAnswer(line) {
  return /^[A-E]$/.test(line) || /^[A-E][A-E]*$/.test(line);
}

/** 判断是否为表格行 (包含 tab) */
function isTableRow(line) {
  return line.includes('\t');
}

/** 解析表格行 */
function parseTableRow(line) {
  return line.split('\t').map(c => c.trim());
}

/** 判断是否为标题行 (增强版，prevLineEmpty 仅作为参考，不是必须) */
function isHeaderLine(line, prevLineEmpty, afterSectionHeader) {
  const clean = line.replace(/\?+$/, '').trim();
  if (!clean || clean.length > 80) return false;
  if (NOT_A_HEADER_PATTERN.test(clean)) return false;
  if (isYearPrefixed(clean)) return false;

  // 已知章节/主题 —— 无条件识别
  if (KNOWN_CHAPTERS.has(clean) || KNOWN_TOPICS.has(clean)) return true;

  // 非常短的行（≤7字），且前后有空行 → 大概率是标题
  if (clean.length <= 7 && prevLineEmpty && /^[一-龥]+$/.test(clean)) return true;

  // 以数字编号开头的中文标题
  if (/^[一二三四五六七八九十]、/.test(clean) && clean.length <= 40) return true;

  // 括号编号
  if (/^（[一二三四五六七八九十]）/.test(clean) && clean.length <= 40) return true;

  // 紧跟在大节标题之后的行 → 是章节
  if (afterSectionHeader && clean.length <= 25) return true;

  return false;
}

/** 检测并标注 TCM 专有名词 */
function tagTCMTerms(text) {
  const tags = [];

  for (const [category, terms] of Object.entries(TCM_TERMS)) {
    for (const term of terms) {
      if (text.includes(term)) {
        tags.push({ term, category });
      }
    }
  }

  return tags;
}

/** 从文本中提取所有 TCM 专有名词 */
function extractAllTCMTerms(text) {
  const found = new Map();
  for (const [category, terms] of Object.entries(TCM_TERMS)) {
    for (const term of terms) {
      if (text.includes(term)) {
        if (!found.has(term)) {
          found.set(term, { term, category });
        }
      }
    }
  }
  return Array.from(found.values());
}

// === 主解析逻辑 ===

function parseExamData() {
  console.log('读取文件:', INPUT_FILE);
  const buffer = fs.readFileSync(INPUT_FILE);
  const text = iconv.decode(buffer, 'gbk');
  const lines = text.split(/\r?\n/);

  console.log(`共 ${lines.length} 行`);

  const result = {
    metadata: {
      title: '中医学复习资料',
      subtitle: '中医内科 & 针灸学',
      source: 'exam_data.txt',
      generated: new Date().toISOString(),
      totalLines: lines.length,
    },
    sections: [],
    allTags: {},
  };

  // 解析状态
  let currentSection = null;     // 大节 (中医内科 / 针灸)
  let currentChapter = null;     // 章 (绪论 / 阴阳五行...)
  let currentTopic = null;       // 节 (中医药学的历史沿革...)
  let currentSubTopic = null;    // 小节 (医学理论体系的初步形成...)
  let currentItems = [];         // 当前上下文的知识条目
  let afterSectionHeader = false; // 紧跟在 ☆...☆ 之后的标记

  // 临时解析状态
  let pendingQuestion = null;    // 待匹配答案的问题
  let tableBuffer = [];          // 表格缓冲区
  let i = 0;

  function flushTable() {
    if (tableBuffer.length >= 2) {
      const header = parseTableRow(tableBuffer[0]);
      const rows = tableBuffer.slice(1).map(parseTableRow);
      currentItems.push({
        type: 'table',
        headers: header,
        rows: rows,
      });
    } else if (tableBuffer.length === 1) {
      // 单行可能不是表格，作为文本处理
      currentItems.push({
        type: 'text',
        content: tableBuffer[0].trim(),
      });
    }
    tableBuffer = [];
  }

  function flushPendingQuestion() {
    if (pendingQuestion) {
      currentItems.push(pendingQuestion);
      pendingQuestion = null;
    }
  }

  function flushAll() {
    flushTable();
    flushPendingQuestion();
  }

  function ensureContext() {
    if (!currentSection) {
      currentSection = {
        id: `section-auto-${result.sections.length}`,
        title: '未分类',
        chapters: [],
      };
      result.sections.push(currentSection);
    }
    if (!currentChapter) {
      currentChapter = {
        id: `chapter-auto-${currentSection.chapters.length}`,
        title: '未分类',
        topics: [],
      };
      currentSection.chapters.push(currentChapter);
    }
    if (!currentTopic) {
      currentTopic = {
        id: `topic-auto-${currentChapter.topics.length}`,
        title: '未分类',
        subTopics: [],
      };
      currentChapter.topics.push(currentTopic);
    }
    if (!currentSubTopic) {
      currentSubTopic = {
        id: `subtopic-auto-${currentTopic.subTopics.length}`,
        title: '未分类',
        knowledgePoints: currentItems,
      };
      currentTopic.subTopics.push(currentSubTopic);
    }
  }

  function finalizeSubTopic() {
    if (currentItems.length > 0 && currentSubTopic) {
      currentSubTopic.knowledgePoints = currentItems;
      // 收集所有 TCM 术语标签
      for (const item of currentItems) {
        const textToSearch = [
          item.question, item.answer, item.content,
          ...(item.options || []).map(o => o.text || ''),
          item.explanation,
        ].filter(Boolean).join(' ');
        const tags = extractAllTCMTerms(textToSearch);
        for (const tag of tags) {
          if (!result.allTags[tag.category + 's']) {
            result.allTags[tag.category + 's'] = [];
          }
          // category is already plural in TCM_TERMS keys (meridians, acupoints, formulas, herbs)
          const catKey = tag.category;
          if (!result.allTags[catKey]) {
            result.allTags[catKey] = [];
          }
          if (!result.allTags[catKey].includes(tag.term)) {
            result.allTags[catKey].push(tag.term);
          }
        }
      }
    }
    currentItems = [];
  }

  // === 逐行解析 ===
  for (i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const prevLineEmpty = i === 0 || lines[i - 1].trim() === '';
    const nextLineEmpty = i >= lines.length - 1 || lines[i + 1].trim() === '';

    // 跳过空行
    if (!line) {
      // 空行可能表示段落结束
      if (tableBuffer.length > 0) {
        flushTable();
      }
      continue;
    }

    // === 检测大节 (☆...☆) ===
    if (line.startsWith('☆') && line.endsWith('☆')) {
      flushAll();
      finalizeSubTopic();
      const sectionTitle = line.replace(/☆/g, '').trim();
      if (sectionTitle === '前言') {
        currentSection = {
          id: `section-preface`,
          title: '前言',
          type: 'preface',
          chapters: [],
        };
      } else {
        currentSection = {
          id: `section-${result.sections.length}`,
          title: sectionTitle,
          chapters: [],
        };
      }
      result.sections.push(currentSection);
      currentChapter = null;
      currentTopic = null;
      currentSubTopic = null;
      currentItems = [];
      afterSectionHeader = true;   // 标记下一行紧跟大节标题
      continue;
    }

    ensureContext();

    // === 检测章节标题 ===
    // 1) 已知章节 2) 紧跟大节标题的短行 3) 孤立短行
    const isChapterLine = (KNOWN_CHAPTERS.has(line) && line.length <= 20)
      || (afterSectionHeader && line.length <= 25 && prevLineEmpty === false);

    if (isChapterLine) {
      flushAll();
      finalizeSubTopic();
      // 检查是否已存在同名章节 → 合并而非新建
      const existingChapter = currentSection.chapters.find(ch => ch.title === line);
      if (existingChapter) {
        currentChapter = existingChapter;
      } else {
        currentChapter = {
          id: `chapter-${currentSection.chapters.length}`,
          title: line,
          topics: [],
        };
        currentSection.chapters.push(currentChapter);
      }
      currentTopic = null;
      currentSubTopic = null;
      currentItems = [];
      afterSectionHeader = false;
      continue;
    }

    afterSectionHeader = false;

    // === 检测主题标题 (使用增强的 isHeaderLine) ===
    if (isHeaderLine(line, prevLineEmpty, false) && !KNOWN_CHAPTERS.has(line)) {
      flushAll();
      finalizeSubTopic();
      currentTopic = {
        id: `topic-${currentChapter.topics.length}`,
        title: line,
        subTopics: [],
      };
      currentChapter.topics.push(currentTopic);
      currentSubTopic = null;
      currentItems = [];
      continue;
    }

    // === 检测表格 ===
    if (isTableRow(line)) {
      flushPendingQuestion();
      tableBuffer.push(line);

      // 检查下一行是否还是表格
      if (nextLineEmpty || i >= lines.length - 1 || !isTableRow(lines[i + 1].trim())) {
        flushTable();
      }
      continue;
    }

    // === 检测年份前缀题目 ===
    if (isYearPrefixed(line)) {
      flushPendingQuestion();
      flushTable();

      const parsed = parseYearPrefix(line);
      if (parsed && parsed.text) {
        pendingQuestion = {
          type: 'qa',
          years: parsed.years,
          question: parsed.text,
          answer: null,
          options: [],
          explanation: null,
          tags: tagTCMTerms(parsed.text),
        };

        // 检查是否下一行是单选题选项
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (isMultipleChoiceOption(nextLine)) {
            pendingQuestion.type = 'multiple_choice';
          }
        }
      }
      continue;
    }

    // === 检测多选题选项 (没有年份前缀的情况) ===
    if (isMultipleChoiceOption(line) && !pendingQuestion) {
      flushTable();
      // 回顾上一行作为题目
      let questionText = '';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j].trim();
        if (prev && !isMultipleChoiceOption(prev) && !isSingleLetterAnswer(prev)) {
          questionText = prev;
          break;
        }
      }
      if (questionText) {
        pendingQuestion = {
          type: 'multiple_choice',
          years: [],
          question: questionText,
          answer: null,
          options: [],
          explanation: null,
          tags: tagTCMTerms(questionText),
        };
        // 移除已作为题目的上一行
        const prevItem = currentItems.pop();
        if (prevItem && prevItem.type === 'text' && prevItem.content === questionText) {
          // 已移除
        }
      }
    }

    // === 收集多选题选项 ===
    if (isMultipleChoiceOption(line) && pendingQuestion) {
      const optionMatch = line.match(/^([A-E])[\s\.\?]+(.*)/);
      if (optionMatch) {
        pendingQuestion.options.push({
          label: optionMatch[1],
          text: optionMatch[2].trim().replace(/^[\?？]+/, '').trim(),
        });
      }
      continue;
    }

    // === 检测答案 ===
    if (pendingQuestion && !pendingQuestion.answer) {
      // 多选题答案 (单字母)
      if (pendingQuestion.type === 'multiple_choice' && isSingleLetterAnswer(line) && line.length <= 5) {
        pendingQuestion.answer = line;
        pendingQuestion.tags.push(...tagTCMTerms(line));

        // 检查下一行是否为解析
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !isYearPrefixed(nextLine) && !isHeaderLine(nextLine, false, false)
              && !isMultipleChoiceOption(nextLine) && !isSingleLetterAnswer(nextLine)) {
            // 可能是解析
          }
        }

        if (nextLineEmpty || i + 1 >= lines.length ||
            isYearPrefixed(lines[i + 1].trim()) || isHeaderLine(lines[i + 1].trim(), false, false)) {
          flushPendingQuestion();
        }
        continue;
      }

      // 非多选题答案 (文本答案)
      if (!isYearPrefixed(line) && !isHeaderLine(line, false, false)
          && !isMultipleChoiceOption(line) && !isTableRow(line)) {
        // 确认这不是一个选项的延续
        if (pendingQuestion.options.length === 0 || !line.startsWith('A')) {
          pendingQuestion.answer = line;
          pendingQuestion.tags.push(...tagTCMTerms(line));
          if (nextLineEmpty || i + 1 >= lines.length ||
              isYearPrefixed(lines[i + 1].trim()) || isHeaderLine(lines[i + 1].trim(), false, false)) {
            flushPendingQuestion();
          }
          continue;
        }
      }
    }

    // === 收集解析 (pending question 的后续文本) ===
    if (pendingQuestion && pendingQuestion.answer && !nextLineEmpty) {
      // 如果当前行是 pending question 的解析文本
      if (!isYearPrefixed(line) && !isHeaderLine(line, false, false)
          && !isMultipleChoiceOption(line) && !isTableRow(line)
          && !isSingleLetterAnswer(line)) {
        if (!pendingQuestion.explanation) {
          pendingQuestion.explanation = line;
        } else {
          pendingQuestion.explanation += '\n' + line;
        }
        pendingQuestion.tags.push(...tagTCMTerms(line));
        continue;
      }
    }

    // === 检测纯文本/知识点条目 ===
    if (!isYearPrefixed(line) && !isHeaderLine(line, false, false)
        && !isMultipleChoiceOption(line) && !isTableRow(line)
        && !isSingleLetterAnswer(line) && !pendingQuestion) {

      // 检测是否为穴位详解条目 (归经/定位/主治 模式)
      if (/^(归经|定位|主治|机理|位置|简易)/.test(line)) {
        // 查找前面最近的穴位名称作为条目
        const lastItem = currentItems[currentItems.length - 1];
        if (lastItem && lastItem.type === 'acupoint') {
          if (line.startsWith('归经')) {
            lastItem.meridian = line.replace('归经：', '').replace('归经:', '').trim();
          } else if (line.startsWith('定位')) {
            lastItem.location = line.replace('定位：', '').replace('定位:', '').trim();
          } else if (line.startsWith('主治')) {
            if (!lastItem.indications) lastItem.indications = [];
          } else if (line.startsWith('机理')) {
            lastItem.mechanism = line.replace('机理：', '').replace('机理:', '').trim();
          } else if (line.startsWith('位置')) {
            lastItem.position = line.replace('位置：', '').replace('位置:', '').trim();
          } else if (line.startsWith('简易')) {
            lastItem.simpleLocation = line.replace('简易取穴：', '').replace('简易取穴:', '').trim();
          }
          continue;
        }
      }

      // 检测是否为穴位主治子条目
      if (/^[o○]\s/.test(line) || /^[1-9]\d*[\.\、]/.test(line)) {
        const lastItem = currentItems[currentItems.length - 1];
        if (lastItem && lastItem.type === 'acupoint' && !lastItem.indications) {
          lastItem.indications = [];
        }
        if (lastItem && lastItem.type === 'acupoint' && lastItem.indications) {
          lastItem.indications.push(line.replace(/^[o○]\s*/, '').trim());
          continue;
        }
      }

      // 尝试检测穴位名称 (通过年份前缀行检测)
      // 例如: "14 11 09 太溪" → 穴位条目
      if (isYearPrefixed(line)) {
        // 已在上面处理
        continue;
      }

      // 当前为普通文本
      const lastItem = currentItems[currentItems.length - 1];
      if (lastItem && lastItem.type === 'text' && !prevLineEmpty) {
        // 追加到上一个文本块
        lastItem.content += '\n' + line;
      } else {
        currentItems.push({
          type: 'text',
          content: line,
          tags: tagTCMTerms(line),
        });
      }
      continue;
    }

    // === 默认: 作为文本处理 ===
    if (!pendingQuestion && line) {
      const lastItem = currentItems[currentItems.length - 1];
      if (lastItem && lastItem.type === 'text' && !prevLineEmpty) {
        lastItem.content += '\n' + line;
      } else if (!isYearPrefixed(line) && !isMultipleChoiceOption(line)
                 && !isSingleLetterAnswer(line) && !isTableRow(line)) {
        currentItems.push({
          type: 'text',
          content: line,
          tags: tagTCMTerms(line),
        });
      }
    }
  }

  // 最终清理
  flushAll();
  finalizeSubTopic();

  // === 后处理: 清理空内容 ===
  result.sections = result.sections.filter(s => {
    s.chapters = s.chapters.filter(ch => {
      ch.topics = ch.topics.filter(t => {
        t.subTopics = t.subTopics.filter(st => {
          st.knowledgePoints = (st.knowledgePoints || []).filter(kp => {
            if (kp.type === 'text') return kp.content && kp.content.trim();
            if (kp.type === 'qa' || kp.type === 'multiple_choice') return kp.question;
            if (kp.type === 'table') return kp.rows && kp.rows.length > 0;
            if (kp.type === 'acupoint') return kp.name;
            return true;
          });
          return st.knowledgePoints && st.knowledgePoints.length > 0;
        });
        return t.subTopics.length > 0;
      });
      return ch.topics.length > 0;
    });
    return s.chapters.length > 0 || s.type === 'preface';
  });

  // 给所有条目添加唯一 ID
  let itemCounter = 0;
  function assignIds(sections) {
    for (const section of sections) {
      for (const chapter of (section.chapters || [])) {
        for (const topic of (chapter.topics || [])) {
          for (const subTopic of (topic.subTopics || [])) {
            for (const item of (subTopic.knowledgePoints || [])) {
              item.id = `item-${itemCounter++}`;
            }
          }
        }
      }
    }
  }
  assignIds(result.sections);

  // 统计信息
  const stats = {
    totalSections: result.sections.length,
    totalChapters: 0,
    totalTopics: 0,
    totalSubTopics: 0,
    totalItems: 0,
    itemTypes: {},
  };

  for (const s of result.sections) {
    stats.totalChapters += s.chapters.length;
    for (const ch of s.chapters) {
      stats.totalTopics += ch.topics.length;
      for (const t of ch.topics) {
        stats.totalSubTopics += t.subTopics.length;
        for (const st of t.subTopics) {
          for (const item of (st.knowledgePoints || [])) {
            stats.totalItems++;
            stats.itemTypes[item.type] = (stats.itemTypes[item.type] || 0) + 1;
          }
        }
      }
    }
  }

  result.stats = stats;

  console.log('\n=== 解析统计 ===');
  console.log(`大节: ${stats.totalSections}`);
  console.log(`章: ${stats.totalChapters}`);
  console.log(`节: ${stats.totalTopics}`);
  console.log(`小节: ${stats.totalSubTopics}`);
  console.log(`知识点条目: ${stats.totalItems}`);
  console.log('条目类型分布:', JSON.stringify(stats.itemTypes, null, 2));
  console.log('TCM术语:', {
    meridians: result.allTags.meridians?.length || 0,
    acupoints: result.allTags.acupoints?.length || 0,
    formulas: result.allTags.formulas?.length || 0,
    herbs: result.allTags.herbs?.length || 0,
  });

  return result;
}

// === 执行 ===
try {
  const data = parseExamData();

  // 写入 JSON
  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonStr, 'utf-8');
  console.log(`\n✓ 成功生成: ${OUTPUT_FILE}`);
  console.log(`  文件大小: ${(jsonStr.length / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('解析失败:', err.message);
  console.error(err.stack);
  process.exit(1);
}
