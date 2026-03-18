// ==UserScript==
// @name         BOSS直聘候选人智能筛选助手
// @namespace    https://github.com/freekingxx/boss
// @version      0.1.2
// @description  自动解析推荐牛人卡片信息，根据预设规则评分并高亮显示，帮助快速识别高匹配候选人
// @author       BossHelper
// @match        https://www.zhipin.com/*
// @match        https://www.bosszhipin.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/freekingxx/boss/main/boss-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/freekingxx/boss/main/boss-helper.user.js
// @supportURL   https://github.com/freekingxx/boss/issues
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // 只在主窗口运行，忽略 iframe
  if (window.self !== window.top) {
    console.log('[BOSS助手] 检测到 iframe，跳过执行');
    return;
  }

  // 检查是否已经有实例在运行
  if (window.__BOSS_HELPER_RUNNING__) {
    console.log('[BOSS助手] 检测到重复实例，跳过执行');
    return;
  }
  window.__BOSS_HELPER_RUNNING__ = true;

  // ============================================================
  // Section 1: 常量与数据
  // ============================================================

  const SCRIPT_PREFIX = 'bh';
  const CONFIG_KEY = 'boss_helper_config_v1';
  const PROBE_KEY = 'boss_helper_probe_mode';
  const REMOTE_CACHE_KEY = 'boss_helper_remote_config_v1';
  const REJECTED_KEY = 'boss_helper_rejected_v1';
  const ROLE_URL_KEY = 'boss_helper_role_url';
  const GITHUB_BASE = 'https://raw.githubusercontent.com/freekingxx/boss/main/configs';
  const ROLE_CONFIGS = {
    dev:     { name: '开发岗', url: `${GITHUB_BASE}/role-dev.json` },
    algo:    { name: '算法岗(C++)', url: `${GITHUB_BASE}/role-algo.json` },
    ops:     { name: '运营岗', url: `${GITHUB_BASE}/role-ops.json` },
    product: { name: '产品岗', url: `${GITHUB_BASE}/role-pm.json` }
  };

  // 985院校名单
  const SCHOOLS_985 = [
    '清华大学', '北京大学', '中国人民大学', '北京理工大学', '北京航空航天大学',
    '北京师范大学', '中国农业大学', '中央民族大学', '南开大学', '天津大学',
    '大连理工大学', '东北大学', '吉林大学', '哈尔滨工业大学', '复旦大学',
    '上海交通大学', '同济大学', '华东师范大学', '南京大学', '东南大学',
    '浙江大学', '中国科学技术大学', '厦门大学', '山东大学', '中国海洋大学',
    '武汉大学', '华中科技大学', '湖南大学', '中南大学', '中山大学',
    '华南理工大学', '四川大学', '电子科技大学', '重庆大学', '西安交通大学',
    '西北工业大学', '兰州大学', '国防科技大学', '西北农林科技大学'
  ];

  // 211院校名单（不含985，避免重复）
  const SCHOOLS_211_ONLY = [
    '北京交通大学', '北京工业大学', '北京科技大学', '北京化工大学', '北京邮电大学',
    '北京林业大学', '北京中医药大学', '北京外国语大学', '中国传媒大学', '对外经济贸易大学',
    '中央财经大学', '中国政法大学', '华北电力大学', '河北工业大学', '太原理工大学',
    '内蒙古大学', '辽宁大学', '大连海事大学', '延边大学', '东北师范大学',
    '哈尔滨工程大学', '东北农业大学', '东北林业大学', '华东理工大学', '东华大学',
    '上海外国语大学', '上海财经大学', '上海大学', '苏州大学', '南京航空航天大学',
    '南京理工大学', '中国矿业大学', '河海大学', '江南大学', '南京农业大学',
    '中国药科大学', '南京师范大学', '安徽大学', '合肥工业大学', '福州大学',
    '南昌大学', '郑州大学', '中国地质大学', '武汉理工大学', '华中农业大学',
    '华中师范大学', '中南财经政法大学', '湖南师范大学', '暨南大学', '华南师范大学',
    '海南大学', '广西大学', '西南交通大学', '西南大学', '西南财经大学',
    '贵州大学', '云南大学', '西藏大学', '西北大学', '西安电子科技大学',
    '长安大学', '陕西师范大学', '青海大学', '宁夏大学', '新疆大学', '石河子大学',
    '中国石油大学', '第二军医大学', '第四军医大学', '哈尔滨医科大学'
  ];

  // 知名海外院校关键词
  const OVERSEAS_KEYWORDS = [
    'MIT', 'Stanford', 'Harvard', 'Cambridge', 'Oxford', 'CMU', 'Berkeley',
    'Caltech', 'Princeton', 'Yale', 'Columbia', 'Cornell', 'UPenn',
    '麻省理工', '斯坦福', '哈佛', '剑桥', '牛津', '卡内基梅隆',
    '加州伯克利', '加州理工', '普林斯顿', '耶鲁', '哥伦比亚', '康奈尔',
    '多伦多大学', '新加坡国立', '南洋理工', '东京大学', '首尔大学',
    '墨尔本大学', '悉尼大学', '帝国理工', 'UCL', 'ETH'
  ];

  // 知名科技公司
  const TOP_COMPANIES = [
    '阿里巴巴', '腾讯', '字节跳动', '百度', '美团', '京东', '华为', '小米',
    '网易', '滴滴', '快手', '拼多多', '蚂蚁集团', '微软', 'Microsoft',
    'Google', '谷歌', 'Apple', '苹果', 'Amazon', '亚马逊', 'Meta', 'Facebook',
    'Netflix', 'Uber', 'Twitter', 'LinkedIn', '领英', 'Oracle', 'SAP',
    '大疆', 'DJI', 'OPPO', 'vivo', '商汤', '旷视', '依图', '地平线',
    'ByteDance', 'Alibaba', 'Tencent', 'Baidu', 'Meituan', 'JD'
  ];

  // 默认评分规则
  const DEFAULT_RULES = [
    {
      id: 'edu_master', name: '硕士及以上加分', field: 'education',
      type: 'bonus', operator: 'in', value: ['硕士', '博士', 'MBA'], score: 15, enabled: true
    },
    {
      id: 'edu_below', name: '大专及以下减分', field: 'education',
      type: 'penalty', operator: 'in', value: ['大专', '高中', '中专', '初中'], score: -25, enabled: true
    },
    {
      id: 'school_985', name: '985院校加分', field: 'school',
      type: 'bonus', operator: 'schoolLevel', value: '985', score: 18, enabled: true
    },
    {
      id: 'school_211', name: '211院校加分', field: 'school',
      type: 'bonus', operator: 'schoolLevel', value: '211', score: 10, enabled: true
    },
    {
      id: 'school_overseas', name: '海外名校硕士加分', field: 'school',
      type: 'bonus', operator: 'overseasMaster', value: null, score: 15, enabled: true
    },
    {
      id: 'exp_ideal', name: '3-7年经验优先', field: 'experience',
      type: 'bonus', operator: 'between', value: [3, 7], score: 12, enabled: false
    },
    {
      id: 'company_top', name: '大厂经历加分', field: 'company',
      type: 'bonus', operator: 'listMatch', value: 'topCompanies', score: 12, enabled: true
    },
    {
      id: 'keyword_positive', name: '包含加分关键词', field: 'rawText',
      type: 'bonus', operator: 'containsAny', value: [], score: 8, enabled: true
    },
    {
      id: 'keyword_negative', name: '包含减分关键词', field: 'rawText',
      type: 'penalty', operator: 'containsAny', value: [], score: -12, enabled: true
    },
    {
      id: 'salary_over', name: '期望薪资超预算', field: 'salaryMax',
      type: 'knockout', operator: 'gt', value: 0, score: -100, enabled: false
    },
    {
      id: 'job_hopping', name: '频繁跳槽扣分', field: '_computed',
      type: 'penalty', operator: 'jobHopping', value: null, score: -10, enabled: true
    },
    {
      id: 'work_gap', name: '工作空窗期扣分', field: '_computed',
      type: 'penalty', operator: 'workGap', value: null, score: -8, enabled: true
    }
  ];

  // 预设模板
  const PRESET_TEMPLATES = {
    tech_standard: {
      name: '技术岗-通用',
      positiveKeywords: ['React', 'Vue', 'TypeScript', 'Node', 'Go', 'Java', 'Python', 'Rust', 'Kubernetes', 'Docker', '微服务', '分布式'],
      negativeKeywords: ['外包', '培训', '实习'],
      thresholdHigh: 70,
      thresholdLow: 40,
      salaryMax: 0
    },
    tech_strict: {
      name: '技术岗-严格',
      positiveKeywords: ['React', 'Vue', 'TypeScript', 'Node', 'Go', 'Java', 'Python', 'Rust'],
      negativeKeywords: ['外包', '培训', '实习', '兼职'],
      thresholdHigh: 80,
      thresholdLow: 50,
      salaryMax: 0
    },
    tech_relaxed: {
      name: '技术岗-宽松',
      positiveKeywords: ['前端', '后端', '全栈', '开发', '工程师', '架构'],
      negativeKeywords: [],
      thresholdHigh: 60,
      thresholdLow: 30,
      salaryMax: 0
    },
    cpp_algo: {
      name: 'C++算法岗',
      positiveKeywords: ['C++', 'STL', '模板', '算法', '数据结构', '性能优化', 'Linux', 'CMake', 'Boost', 'Qt', '多线程', '并发', '内存管理', 'CUDA', 'OpenCV', '深度学习', 'TensorFlow', 'PyTorch', 'ONNX', '模型优化', '推理引擎'],
      negativeKeywords: ['外包', '培训', '实习', '转行'],
      thresholdHigh: 75,
      thresholdLow: 45,
      salaryMax: 0
    }
  };

  // 默认配置
  function getDefaultConfig() {
    return {
      rules: JSON.parse(JSON.stringify(DEFAULT_RULES)),
      positiveKeywords: ['C++', 'STL', '算法', '数据结构', '性能优化', 'Linux'],
      negativeKeywords: ['外包', '培训', '转行'],
      customSchools: [],
      thresholdHigh: 70,
      thresholdLow: 40,
      salaryMax: 0,
      probeMode: false,
      apiEndpoints: [],
      debugMode: false,
      notifyEnabled: true,
      notifyThreshold: 70,
      notifySound: true,
      roleKey: '',
      configUrl: '',
      lastRemoteSync: 0,
      lastSyncedRole: '',
      expectedGender: '',
      keywordBonusMinMatch: 3,
      keywordBonusScore: 12,
      keywordPenaltyMinMatch: 1,
      keywordPenaltyScore: -12,
      highlightKeywords: []
    };
  }

  // ============================================================
  // Section 2: 配置管理
  // ============================================================

  let config = null;
  const configListeners = [];

  // 「不合适」标记 — name → timestamp
  let rejectedMap = {};

  function loadRejected() {
    try { rejectedMap = JSON.parse(GM_getValue(REJECTED_KEY, '{}')); }
    catch (e) { rejectedMap = {}; }
  }
  function saveRejected() { GM_setValue(REJECTED_KEY, JSON.stringify(rejectedMap)); }
  function isRejected(name) { return !!rejectedMap[name]; }
  function toggleRejected(name) {
    if (rejectedMap[name]) delete rejectedMap[name];
    else rejectedMap[name] = Date.now();
    saveRejected();
  }

  function loadConfig() {
    try {
      const raw = GM_getValue(CONFIG_KEY, null);
      if (raw) {
        const saved = JSON.parse(raw);
        config = mergeConfig(saved, getDefaultConfig());
      } else {
        config = getDefaultConfig();
      }
    } catch (e) {
      console.warn('[BOSS助手] 配置加载失败，使用默认配置', e);
      config = getDefaultConfig();
    }
    // 同步关键词到规则
    syncKeywordsToRules();
    normalizeNotifyThreshold();
    return config;
  }

  function saveConfig() {
    try {
      GM_setValue(CONFIG_KEY, JSON.stringify(config));
      configListeners.forEach(fn => fn(config));
    } catch (e) {
      console.error('[BOSS助手] 配置保存失败', e);
    }
  }

  function mergeConfig(saved, defaults) {
    const notifyThreshold = typeof saved.notifyThreshold === 'number'
      ? saved.notifyThreshold
      : (typeof saved.thresholdHigh === 'number' ? saved.thresholdHigh : defaults.notifyThreshold);
    return {
      ...defaults,
      ...saved,
      notifyThreshold,
      rules: mergeRulesWithDefaults(saved.rules || defaults.rules),
      positiveKeywords: saved.positiveKeywords || defaults.positiveKeywords,
      negativeKeywords: saved.negativeKeywords || defaults.negativeKeywords,
      customSchools: saved.customSchools || defaults.customSchools
    };
  }

  function mergeRulesWithDefaults(rules) {
    const nextRules = Array.isArray(rules) ? JSON.parse(JSON.stringify(rules)) : [];
    nextRules.forEach((rule, index) => {
      nextRules[index] = normalizeKnownRuleShape(rule);
    });
    // 旧的本地配置、导入文件、远程角色配置可能缺少或误改后续新增的计算规则，回填并校正以避免静默失效。
    const requiredRuleIds = ['job_hopping', 'work_gap'];
    requiredRuleIds.forEach((ruleId) => {
      const defaultRule = DEFAULT_RULES.find(rule => rule.id === ruleId);
      if (!defaultRule) return;

      const existingIndex = nextRules.findIndex(rule => rule.id === ruleId);
      if (existingIndex === -1) {
        nextRules.push(JSON.parse(JSON.stringify(defaultRule)));
        return;
      }

      nextRules[existingIndex] = normalizeComputedRule(nextRules[existingIndex], defaultRule);
    });
    return nextRules;
  }

  function normalizeKnownRuleShape(rule) {
    if (!rule || typeof rule !== 'object') return rule;
    const nextRule = { ...rule };
    if (['major_non_cs', 'major_stem_finance', 'major_exclude'].includes(nextRule.id)) {
      nextRule.field = 'major';
      nextRule.operator = 'containsAny';
    }
    return nextRule;
  }

  function normalizeComputedRule(rule, defaultRule) {
    return {
      ...rule,
      id: defaultRule.id,
      name: rule.name || defaultRule.name,
      field: defaultRule.field,
      type: defaultRule.type,
      operator: defaultRule.operator,
      value: defaultRule.value,
      score: typeof rule.score === 'number' ? rule.score : defaultRule.score,
      enabled: typeof rule.enabled === 'boolean' ? rule.enabled : defaultRule.enabled
    };
  }

  function normalizeNotifyThreshold() {
    const high = typeof config.thresholdHigh === 'number' ? config.thresholdHigh : 0;
    const raw = typeof config.notifyThreshold === 'number' ? config.notifyThreshold : high;
    config.notifyThreshold = Math.max(high, Math.min(100, raw));
  }

  function syncKeywordsToRules() {
    const posRule = config.rules.find(r => r.id === 'keyword_positive');
    if (posRule) {
      posRule.value = config.positiveKeywords;
      posRule.minMatchCount = config.keywordBonusMinMatch;
      posRule.score = config.keywordBonusScore;
    }
    const negRule = config.rules.find(r => r.id === 'keyword_negative');
    if (negRule) {
      negRule.value = config.negativeKeywords;
      negRule.minMatchCount = config.keywordPenaltyMinMatch;
      negRule.score = config.keywordPenaltyScore;
    }
    const salaryRule = config.rules.find(r => r.id === 'salary_over');
    if (salaryRule) {
      salaryRule.value = config.salaryMax;
      salaryRule.enabled = config.salaryMax > 0;
    }
  }

  function onConfigChange(fn) {
    configListeners.push(fn);
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boss-helper-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importConfig(jsonStr) {
    try {
      const imported = JSON.parse(jsonStr);
      config = mergeConfig(imported, getDefaultConfig());
      syncKeywordsToRules();
      saveConfig();
      rescoreAllCards();
      return true;
    } catch (e) {
      console.error('[BOSS助手] 配置导入失败', e);
      return false;
    }
  }

  function applyPreset(presetKey) {
    const preset = PRESET_TEMPLATES[presetKey];
    if (!preset) return;
    config.positiveKeywords = [...preset.positiveKeywords];
    config.negativeKeywords = [...preset.negativeKeywords];
    config.thresholdHigh = preset.thresholdHigh;
    config.thresholdLow = preset.thresholdLow;
    config.salaryMax = preset.salaryMax;
    syncKeywordsToRules();
    normalizeNotifyThreshold();
    saveConfig();
    rescoreAllCards();
  }

  // --- 远程配置 ---

  function fetchRemoteConfig(url, onDone, force) {
    if (!url) {
      url = config.configUrl;
    }
    if (!url) {
      if (onDone) onDone(false, '未设置配置源URL');
      return;
    }
    console.log('[BOSS助手] 正在拉取远程配置:', url);
    GM_xmlhttpRequest({
      method: 'GET',
      url: url + '?t=' + Date.now(),
      timeout: 10000,
      onload: function (resp) {
        if (resp.status === 200) {
          try {
            const remoteData = JSON.parse(resp.responseText);
            GM_setValue(REMOTE_CACHE_KEY, resp.responseText);
            applyRemoteConfig(remoteData, force);
            config.lastRemoteSync = Date.now();
            saveConfig();
            console.log('[BOSS助手] 远程配置加载成功:', remoteData.name || '未命名');
            if (onDone) onDone(true, remoteData.name || '加载成功');
          } catch (e) {
            console.warn('[BOSS助手] 远程配置解析失败', e);
            if (onDone) onDone(false, '配置JSON解析失败');
          }
        } else {
          console.warn('[BOSS助手] 远程配置拉取失败, HTTP', resp.status);
          if (onDone) onDone(false, 'HTTP ' + resp.status);
        }
      },
      onerror: function (err) {
        console.warn('[BOSS助手] 远程配置请求失败', err);
        if (onDone) onDone(false, '网络错误');
      },
      ontimeout: function () {
        console.warn('[BOSS助手] 远程配置请求超时');
        if (onDone) onDone(false, '请求超时');
      }
    });
  }

  function applyRemoteConfig(remoteData, force) {
    const isNewRole = !config.lastSyncedRole || config.lastSyncedRole !== (remoteData.name || '');
    const shouldOverwrite = force || isNewRole;

    // rules、阈值、薪资仅在换角色或手动同步时覆盖，F5自动同步保留本地编辑
    if (shouldOverwrite) {
      if (remoteData.rules && Array.isArray(remoteData.rules)) {
        config.rules = mergeRulesWithDefaults(remoteData.rules);
      }
      if (remoteData.positiveKeywords) {
        config.positiveKeywords = [...remoteData.positiveKeywords];
      }
      if (remoteData.negativeKeywords) {
        config.negativeKeywords = [...remoteData.negativeKeywords];
      }
      if (typeof remoteData.thresholdHigh === 'number') {
        config.thresholdHigh = remoteData.thresholdHigh;
      }
      if (typeof remoteData.thresholdLow === 'number') {
        config.thresholdLow = remoteData.thresholdLow;
      }
      if (typeof remoteData.salaryMax === 'number') {
        config.salaryMax = remoteData.salaryMax;
      }
    }
    config.lastSyncedRole = remoteData.name || '';
    syncKeywordsToRules();
    normalizeNotifyThreshold();
    saveConfig();
    rescoreAllCards();
  }

  // ============================================================
  // Section 3: API 拦截器
  // ============================================================

  const candidateStore = new Map(); // name -> candidate data
  let interceptedCount = 0;

  function setupInterceptors() {
    hookFetch();
    hookXHR();
    console.log('[BOSS助手] API拦截器已启动' + (config.probeMode ? '（探测模式）' : ''));
  }

  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (shouldIntercept(url)) {
          const clone = response.clone();
          clone.json().then(data => processApiResponse(url, data)).catch(() => {});
        }
      } catch (e) { /* ignore */ }
      return response;
    };
  }

  function hookXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._bhUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      if (this._bhUrl && shouldIntercept(this._bhUrl)) {
        this.addEventListener('load', function () {
          try {
            const data = JSON.parse(this.responseText);
            processApiResponse(this._bhUrl, data);
          } catch (e) { /* ignore */ }
        });
      }
      return originalSend.apply(this, args);
    };
  }

  function shouldIntercept(url) {
    if (!url) return false;
    if (config.probeMode) {
      // 探测模式：拦截所有zhipin相关的API请求
      return url.includes('zhipin.com') || url.includes('bosszhipin.com') ||
        url.startsWith('/') || url.includes('/wapi/');
    }
    // 正常模式：匹配候选人相关接口
    const patterns = [
      '/wapi/zpboss/',
      '/wapi/zpchat/',
      'recommend',
      'geek',
      'candidate',
      'resume',
      '/search/',
      'zpgeek'
    ];
    // 用户自定义的API端点
    if (config.apiEndpoints?.length > 0) {
      return config.apiEndpoints.some(ep => url.includes(ep));
    }
    return patterns.some(p => url.includes(p));
  }

  function processApiResponse(url, data) {
    interceptedCount++;

    if (config.probeMode) {
      console.group(`[BOSS助手 探测] #${interceptedCount} ${url}`);
      console.log('响应数据:', data);
      // 尝试自动检测是否包含候选人数据
      const candidates = findCandidateArray(data);
      if (candidates) {
        console.log(`%c✅ 检测到候选人数据！共 ${candidates.length} 条`, 'color: green; font-weight: bold');
        console.log('示例:', candidates[0]);
        console.log(`%c建议将此URL添加到API端点配置: ${url}`, 'color: blue');
      }
      console.groupEnd();
      return;
    }

    // 正常模式：提取候选人数据
    const candidates = findCandidateArray(data);
    if (candidates && candidates.length > 0) {
      console.log(`[BOSS助手] 捕获到 ${candidates.length} 条候选人数据 (from: ${url})`);
      candidates.forEach(c => {
        const parsed = parseCandidateFromApi(c);
        if (parsed && parsed.name) {
          candidateStore.set(parsed.name, parsed);
        }
      });
      // 触发一次重新评分
      setTimeout(() => rescoreAllCards(), 500);
    }
  }

  // 在嵌套JSON中查找候选人数组
  function findCandidateArray(data, depth = 0) {
    if (depth > 5) return null;
    if (!data || typeof data !== 'object') return null;

    // 如果是数组，检查元素是否像候选人
    if (Array.isArray(data)) {
      if (data.length >= 2 && data.length <= 100) {
        const sample = data[0];
        if (looksLikeCandidate(sample)) return data;
      }
      return null;
    }

    // 遍历对象属性
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val) && val.length >= 2) {
        const sample = val[0];
        if (looksLikeCandidate(sample)) return val;
      }
      // 递归搜索
      const found = findCandidateArray(val, depth + 1);
      if (found) return found;
    }
    return null;
  }

  // 判断一个对象是否像候选人数据
  function looksLikeCandidate(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const text = JSON.stringify(obj).toLowerCase();
    const signals = [
      // 字段名特征
      'name', 'geek', 'expect', 'salary', 'degree', 'education',
      'experience', 'school', 'age', 'gender', 'skill',
      // 中文内容特征
      '本科', '硕士', '博士', '大专', '经验', '在职', '离职',
      '期望', '薪资', '技能'
    ];
    let matchCount = 0;
    for (const s of signals) {
      if (text.includes(s)) matchCount++;
    }
    return matchCount >= 3;
  }

  // 从API数据解析候选人（需要根据实际接口调整字段映射）
  function parseCandidateFromApi(raw) {
    const card = raw?.geekCard && typeof raw.geekCard === 'object' ? raw.geekCard : raw;
    const edus = pickFirstArray(raw?.showEdus, card?.showEdus, card?.geekEdus, raw?.geekEdus);
    const primaryEdu = pickPrimaryEducation(card?.geekEdu, edus);
    const works = pickFirstArray(raw?.showWorks, card?.showWorks, card?.geekWorks, raw?.geekWorks);
    const primaryWork = pickPrimaryWork(raw?.geekLastWork, card?.geekLastWork, works);
    const text = JSON.stringify(raw);

    // 尝试多种可能的字段名
    const name = card?.geekName || raw.name || raw.geekName || raw.nickName || raw.username || '';
    const age = card?.age || raw.age || extractNumber(card?.ageDesc || '', /(\d{2})岁/) || extractNumber(text, /(\d{2})岁/);
    const education = primaryEdu?.degreeName || card?.geekDegree || raw.education || raw.degree || raw.degreeName ||
      extractMatch(text, /(博士|硕士|MBA|本科|大专|高中|中专)/);
    const school = primaryEdu?.school || card?.school || raw.school || raw.schoolName || raw.university || '';
    const major = primaryEdu?.major || card?.major || raw.major || raw.majorName || raw.specialty || raw.professional || raw.subjectName || extractMajorFromText(text);
    const experience = parseExperienceYears(card?.workYears || card?.geekWorkYear || raw.experience || raw.workYears, text);
    const company = primaryWork?.company || card?.company || raw.company || raw.companyName || raw.lastCompany || extractCompanyFromText(text) || '';
    const salary = card?.salary || raw.expectSalary || raw.salary || raw.salaryDesc || '';
    const skills = collectCandidateSkills(raw, card, works);
    const status = card?.applyStatusDesc || raw.applyStatusDesc || card?.status || raw.status || raw.jobStatus || raw.activeStatus || '';

    // 解析性别
    let gender = null;
    if (card?.geekGender === 1 || card?.gender === 1 || raw.gender === 1 || raw.gender === '1' || raw.genderName === '男') gender = '男';
    else if (card?.geekGender === 0 || card?.geekGender === 2 || card?.gender === 0 || card?.gender === 2 || raw.gender === 0 || raw.gender === 2 || raw.gender === '0' || raw.gender === '2' || raw.genderName === '女') gender = '女';
    if (!gender) {
      const genderMatch = text.match(/(?:^|[·\s",:])?(男|女)(?:[·\s",:]|$)/);
      if (genderMatch) gender = genderMatch[1];
    }

    // 解析薪资范围
    let salaryMin = 0, salaryMax = 0;
    const salaryStr = typeof salary === 'string' ? salary : '';
    const salaryMatch = salaryStr.match(/(\d+)\s*[-~]\s*(\d+)\s*[Kk]/);
    if (salaryMatch) {
      salaryMin = parseInt(salaryMatch[1]);
      salaryMax = parseInt(salaryMatch[2]);
    }

    // 计算跳槽/空窗指标
    const metricsSource = {
      ...raw,
      geekWorks: works,
      showWorks: works
    };
    const jobMetrics = computeJobMetrics(metricsSource, experience);

    return {
      name,
      age: typeof age === 'number' ? age : null,
      education: education || null,
      school: school || null,
      major: major || null,
      experience: typeof experience === 'number' ? experience : null,
      company: company || null,
      salaryMin,
      salaryMax,
      salaryDesc: salaryStr,
      skills,
      status: status || null,
      gender: gender,
      jobCount: jobMetrics.jobCount,
      gapCount: jobMetrics.gapCount,
      maxGapMonths: jobMetrics.maxGapMonths,
      graduationDate: jobMetrics.graduationDate,
      jobPeriods: jobMetrics.periods,
      jobPeriodsSource: jobMetrics.periodsSource,
      rawText: text,
      source: 'api'
    };
  }

  function pickFirstArray(...arrays) {
    for (const arr of arrays) {
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    return [];
  }

  function pickPrimaryEducation(primaryEdu, edus) {
    if (primaryEdu && typeof primaryEdu === 'object' && (primaryEdu.school || primaryEdu.major || primaryEdu.degreeName)) {
      return primaryEdu;
    }
    return Array.isArray(edus) && edus.length > 0 ? edus[0] : null;
  }

  function pickPrimaryWork(primaryWork, fallbackWork, works) {
    if (primaryWork && typeof primaryWork === 'object' && (primaryWork.company || primaryWork.positionName)) return primaryWork;
    if (fallbackWork && typeof fallbackWork === 'object' && (fallbackWork.company || fallbackWork.positionName)) return fallbackWork;
    return Array.isArray(works) && works.length > 0 ? works[0] : null;
  }

  function collectCandidateSkills(raw, card, works) {
    const skills = [];
    const pushSkill = (value) => {
      if (!value) return;
      const text = typeof value === 'string' ? value : (value.name || value.content || '');
      const normalized = text.trim();
      if (normalized && !skills.includes(normalized)) skills.push(normalized);
    };

    [raw?.skills, raw?.skillList, raw?.tags, card?.skills, card?.skillList, card?.tags, card?.matches, card?.markWords].forEach((list) => {
      if (Array.isArray(list)) list.forEach(pushSkill);
    });

    if (Array.isArray(works)) {
      works.forEach((work) => {
        if (Array.isArray(work?.workEmphasisList)) work.workEmphasisList.forEach(pushSkill);
      });
    }

    return skills;
  }

  function extractNumber(text, regex) {
    const m = text.match(regex);
    return m ? parseInt(m[1]) : null;
  }

  function extractMatch(text, regex) {
    const m = text.match(regex);
    return m ? m[1] : null;
  }

  // 从API原始数据中查找工作经历数组
  function findWorkExpList(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const fields = ['geekWorks', 'showWorks', 'geekWorkExpList', 'workExpList',
      'workList', 'expList', 'workExperience', 'experiences', 'jobList'];
    for (const key of fields) {
      if (Array.isArray(raw[key]) && raw[key].length > 0) return raw[key];
    }
    // 搜索一层嵌套
    for (const key of Object.keys(raw)) {
      const val = raw[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const subKey of fields) {
          if (Array.isArray(val[subKey]) && val[subKey].length > 0) return val[subKey];
        }
      }
    }
    return [];
  }

  function findEducationList(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const fields = ['showEdus', 'geekEdus', 'eduList', 'educationList', 'educations', 'geekEduList'];
    for (const key of fields) {
      if (Array.isArray(raw[key]) && raw[key].length > 0) return raw[key];
    }
    if (raw.geekEdu && typeof raw.geekEdu === 'object') return [raw.geekEdu];
    for (const key of Object.keys(raw)) {
      const val = raw[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const subKey of fields) {
          if (Array.isArray(val[subKey]) && val[subKey].length > 0) return val[subKey];
        }
        if (val.geekEdu && typeof val.geekEdu === 'object') return [val.geekEdu];
      }
    }
    return [];
  }

  function parseWorkDate(val) {
    if (!val) return null;
    if (typeof val === 'number') return new Date(val > 1e12 ? val : val * 1000);
    const str = String(val).trim();
    if (/^(至今|现在|目前|present|current)$/i.test(str)) return null;
    const compactMatch = str.match(/^(\d{4})(\d{2})(?:\d{2})?$/);
    if (compactMatch) {
      return new Date(parseInt(compactMatch[1]), parseInt(compactMatch[2]) - 1);
    }
    const monthMatch = str.match(/(\d{4})\s*[-./年]\s*(\d{1,2})(?:\s*月)?/);
    if (monthMatch) {
      return new Date(parseInt(monthMatch[1]), parseInt(monthMatch[2]) - 1);
    }
    const yearMatch = str.match(/^(\d{4})$/);
    return yearMatch ? new Date(parseInt(yearMatch[1]), 0) : null;
  }

  function parseExperienceYears(val, fallbackText) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const direct = extractNumber(val, /(\d+)\s*年/);
      if (typeof direct === 'number') return direct;
    }
    return extractNumber(fallbackText || '', /(\d+)\s*年/);
  }

  function extractWorkPeriodsFromText(text) {
    const periods = [];
    if (!text) return periods;

    const regex = /(\d{4})\s*[.\-/年]\s*(\d{1,2})(?:\s*月)?\s*[-–—~至]+\s*((\d{4})\s*[.\-/年]\s*(\d{1,2})(?:\s*月)?|至今|现在|目前|present|current)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = new Date(parseInt(match[1]), parseInt(match[2]) - 1);
      const end = parseWorkDate(match[3]);
      periods.push({ start, end });
    }

    return periods;
  }

  function formatPeriod(period) {
    const formatDate = (date) => {
      if (!date) return '至今';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}.${month}`;
    };
    return `${formatDate(period.start)}-${formatDate(period.end)}`;
  }

  function getGraduationDate(raw) {
    const edus = findEducationList(raw);
    let latest = null;
    edus.forEach((edu) => {
      const end = parseWorkDate(edu?.endDate || edu?.graduateDate || edu?.endTime || edu?.finishTime);
      if (end && (!latest || end > latest)) latest = end;
    });
    return latest;
  }

  // 计算跳槽频率和空窗期指标
  function computeJobMetrics(raw, totalExp) {
    const workList = findWorkExpList(raw);
    let jobCount = workList.length;
    let periodsSource = workList.length > 0 ? 'api' : 'none';
    const graduationDate = getGraduationDate(raw);

    // 从结构化数据提取工作时间段
    let periods = [];
    for (const exp of workList) {
      const start = parseWorkDate(exp.startDate || exp.startTime || exp.start || exp.beginTime || exp.startdate);
      const end = parseWorkDate(exp.endDate || exp.endTime || exp.end || exp.finishTime || exp.enddate);
      if (start) periods.push({ start, end });
    }

    // 兜底：从文本中正则提取 "YYYY.MM - YYYY.MM" 格式的工作时间段
    // 只匹配带月份的日期范围（如 2021.07 - 2024.03），跳过纯年份范围（通常是教育经历）
    if (periods.length === 0) {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      periods = extractWorkPeriodsFromText(text);
      if (periods.length > 0) {
        jobCount = periods.length;
        periodsSource = 'text';
      }
    }

    if (periods.length === 0 && jobCount === 0) {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const m = text.match(/(\d+)\s*段/);
      return {
        jobCount: m ? parseInt(m[1]) : 0,
        gapCount: 0,
        maxGapMonths: 0,
        periods: [],
        periodsSource: 'none'
      };
    }

    periods.sort((a, b) => a.start - b.start);
    let gapCount = 0, maxGapMonths = 0;
    const now = Date.now();

    function getEffectiveGapStart(date) {
      if (!date) return graduationDate || null;
      if (!graduationDate) return date;
      return date < graduationDate ? graduationDate : date;
    }

    // 检测工作之间的空窗
    for (let i = 1; i < periods.length; i++) {
      const prevEnd = getEffectiveGapStart(periods[i - 1].end);
      const currStart = periods[i].start;
      if (graduationDate && currStart <= graduationDate) continue;
      if (prevEnd && currStart && currStart > prevEnd) {
        const months = (currStart - prevEnd) / (1000 * 60 * 60 * 24 * 30);
        if (months > 1) {
          gapCount++;
          maxGapMonths = Math.max(maxGapMonths, months);
        }
      }
    }

    // 检测最后一份工作结束至今的空窗（当前失业期）
    const graduationPassed = !graduationDate || graduationDate.getTime() < now;
    if (graduationPassed && periods.length > 0) {
      const lastEnd = getEffectiveGapStart(periods[periods.length - 1].end);
      if (lastEnd) {
        const monthsToNow = (now - lastEnd.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsToNow > 3) {
          gapCount++;
          maxGapMonths = Math.max(maxGapMonths, monthsToNow);
        }
      }
    } else if (graduationPassed && graduationDate && periods.length === 0) {
      const monthsToNow = (now - graduationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsToNow > 3) {
        gapCount++;
        maxGapMonths = Math.max(maxGapMonths, monthsToNow);
      }
    }

    return {
      jobCount: Math.max(jobCount, periods.length),
      gapCount,
      maxGapMonths: Math.round(maxGapMonths),
      graduationDate: graduationDate ? graduationDate.toISOString() : null,
      periods: periods.map(period => ({
        start: period.start ? period.start.toISOString() : null,
        end: period.end ? period.end.toISOString() : null
      })),
      periodsSource
    };
  }

  // ============================================================
  // Section 4: 评分引擎
  // ============================================================

  function scoreCandidate(candidate) {
    let score = 30; // 基准分（降低以提高难度）
    const matchedRules = [];
    const highlightedKeywords = [];

    for (const rule of config.rules) {
      if (!rule.enabled) continue;

      const fieldValue = candidate[rule.field];

      // containsAny 特殊处理
      if (rule.operator === 'containsAny' && Array.isArray(rule.value) && rule.value.length > 0) {
        const text = typeof fieldValue === 'string' ? fieldValue : '';
        const matchedKeywords = rule.value.filter(v => text.includes(v));
        if (matchedKeywords.length > 0) {
          if (rule.type === 'knockout') {
            return { score: 0, level: 'low', matchedRules: [{ ...rule, applied: true, matchedKeywords }] };
          }
          const minMatch = typeof rule.minMatchCount === 'number' ? rule.minMatchCount : 0;
          if (minMatch > 0) {
            // 阈值模式：命中数 >= minMatchCount 时计固定分值（不按个数翻倍）
            if (matchedKeywords.length >= minMatch) {
              score += rule.score;
              matchedRules.push({ ...rule, applied: true, matchedKeywords, effectiveScore: rule.score });
            }
          } else {
            // 默认模式：每个关键词独立计分
            const delta = rule.score * matchedKeywords.length;
            score += delta;
            matchedRules.push({ ...rule, applied: true, matchedKeywords, effectiveScore: delta });
          }
        }
        continue;
      }

      // gtPerUnit 特殊处理：每超出一个单位独立计分（如年龄每超1岁扣N分）
      if (rule.operator === 'gtPerUnit' && typeof fieldValue === 'number' && typeof rule.value === 'number') {
        if (fieldValue > rule.value) {
          const units = Math.floor(fieldValue - rule.value);
          const delta = rule.score * units;
          score += delta;
          matchedRules.push({ ...rule, applied: true, effectiveScore: delta });
        }
        continue;
      }

      // containsAnyWord: 类似containsAny，但对英文关键词使用单词边界匹配
      // 避免 "Java" 匹配到 "JavaScript" 等子串误命中问题
      if (rule.operator === 'containsAnyWord' && Array.isArray(rule.value) && rule.value.length > 0) {
        const text = typeof fieldValue === 'string' ? fieldValue : '';
        if (text) {
          const matchedKeywords = rule.value.filter(keyword => {
            if (/^[a-zA-Z0-9+#_./-]+$/.test(keyword)) {
              // 英文关键词：用前后非字母断言做单词边界匹配
              try {
                const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp('(?<![a-zA-Z])' + escaped + '(?![a-zA-Z])', 'i').test(text);
              } catch (e) { return text.includes(keyword); }
            }
            // 中文关键词：直接 includes
            return text.includes(keyword);
          });
          if (matchedKeywords.length > 0) {
            const delta = rule.score * matchedKeywords.length;
            score += delta;
            matchedRules.push({ ...rule, applied: true, matchedKeywords, effectiveScore: delta });
          }
        }
        continue;
      }

      // checkGender: 对比候选人性别与期望性别，不符则扣分
      if (rule.operator === 'checkGender') {
        if (config.expectedGender && typeof fieldValue === 'string' && fieldValue && fieldValue !== config.expectedGender) {
          score += rule.score;
          matchedRules.push({ ...rule, applied: true, effectiveScore: rule.score });
        }
        continue;
      }

      // overseasMaster: 海外名校仅对硕士及以上加分，本科不加
      if (rule.operator === 'overseasMaster') {
        const masterDegrees = ['硕士', '博士', 'MBA'];
        if (candidate.education && masterDegrees.includes(candidate.education) &&
            candidate.school && OVERSEAS_KEYWORDS.some(k => candidate.school.includes(k))) {
          score += rule.score;
          matchedRules.push({ ...rule, applied: true, effectiveScore: rule.score });
        }
        continue;
      }

      // jobHopping: 频繁跳槽检测 — 平均每份工作不足2年则扣分
      if (rule.operator === 'jobHopping') {
        if (candidate.jobCount >= 2 && candidate.experience > 0) {
          const avgTenure = candidate.experience / candidate.jobCount;
          if (avgTenure < 2) {
            const severity = avgTenure < 1 ? 2 : 1; // 不足1年双倍扣分
            const delta = rule.score * severity;
            score += delta;
            matchedRules.push({ ...rule, applied: true, effectiveScore: delta });
          }
        }
        continue;
      }

      // workGap: 工作空窗期检测 — 2段以上或单段超3个月
      if (rule.operator === 'workGap') {
        if (candidate.gapCount >= 2 || candidate.maxGapMonths > 3) {
          const severity = (candidate.gapCount >= 2 && candidate.maxGapMonths > 3) ? 2 : 1;
          const delta = rule.score * severity;
          score += delta;
          matchedRules.push({ ...rule, applied: true, effectiveScore: delta });
        }
        continue;
      }

      const matched = evaluateCondition(rule, fieldValue, candidate);

      if (matched) {
        if (rule.type === 'knockout') {
          return { score: 0, level: 'low', matchedRules: [{ ...rule, applied: true }] };
        }
        score += rule.score;
        matchedRules.push({ ...rule, applied: true, effectiveScore: rule.score });
      }
    }

    // 检查高亮关键词匹配
    if (config.highlightKeywords && config.highlightKeywords.length > 0) {
      const text = candidate.rawText || '';
      config.highlightKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          highlightedKeywords.push(keyword);
        }
      });
    }

    score = Math.max(0, Math.min(100, score));
    const level = score >= config.thresholdHigh ? 'high'
      : score >= config.thresholdLow ? 'medium'
        : 'low';

    return { score, level, matchedRules, highlightedKeywords };
  }

  function evaluateCondition(rule, fieldValue, candidate) {
    const { operator, value } = rule;

    switch (operator) {
      case 'eq':
        return fieldValue === value;
      case 'neq':
        return fieldValue !== value;
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > value;
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < value;
      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= value;
      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= value;
      case 'between':
        return typeof fieldValue === 'number' && Array.isArray(value) &&
          fieldValue >= value[0] && fieldValue <= value[1];
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);
      case 'notContains':
        return typeof fieldValue === 'string' && !fieldValue.includes(value);
      case 'containsAny':
        if (!Array.isArray(value) || value.length === 0) return false;
        if (typeof fieldValue === 'string') {
          return value.some(v => fieldValue.includes(v));
        }
        return false;
      case 'regex':
        try {
          return typeof fieldValue === 'string' && new RegExp(value, 'i').test(fieldValue);
        } catch { return false; }
      case 'schoolLevel':
        return checkSchoolLevel(candidate.school, value);
      case 'listMatch':
        return checkListMatch(candidate, value);
      default:
        return false;
    }
  }

  function checkSchoolLevel(school, level) {
    if (!school) return false;
    const allSchools = [...(config.customSchools || [])];

    switch (level) {
      case '985':
        return SCHOOLS_985.some(s => school.includes(s));
      case '211':
        // 仅匹配纯211院校，985已由985规则处理，避免重复加分
        return SCHOOLS_211_ONLY.some(s => school.includes(s));
      case 'overseas':
        return OVERSEAS_KEYWORDS.some(k => school.includes(k));
      default:
        return allSchools.some(s => school.includes(s));
    }
  }

  function checkListMatch(candidate, listName) {
    switch (listName) {
      case 'topCompanies': {
        const text = (candidate.company || '') + ' ' + (candidate.rawText || '');
        return TOP_COMPANIES.some(c => text.includes(c));
      }
      default:
        return false;
    }
  }

  // ============================================================
  // Section 4.5: 通知系统
  // ============================================================

  const notifiedCandidates = new Set(); // 避免重复通知

  function notifyHighScoreCandidate(candidate, result, cardElement) {
    if (!config.notifyEnabled) return;
    if (isRejected(candidate.name)) return; // 已标记不合适，跳过通知
    if (result.score < config.notifyThreshold) return;
    const key = candidate.name + '_' + result.score;
    if (notifiedCandidates.has(key)) return;
    notifiedCandidates.add(key);

    // 页面内Toast
    showToast(candidate, result, cardElement);

    // 桌面通知
    showDesktopNotification(candidate, result, cardElement);

    // 提示音
    if (config.notifySound) {
      playNotificationSound();
    }

    // 高分卡片呼吸动画
    if (cardElement) {
      cardElement.classList.add(`${SCRIPT_PREFIX}-card-pulse`);
      setTimeout(() => cardElement.classList.remove(`${SCRIPT_PREFIX}-card-pulse`), 3000);
    }
  }

  function showToast(candidate, result, cardElement) {
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `${SCRIPT_PREFIX}-toast`;

    const info = document.createElement('div');
    info.className = `${SCRIPT_PREFIX}-toast-info`;
    const title = document.createElement('strong');
    title.textContent = `${candidate.name || '候选人'} — ${result.score}分`;
    info.appendChild(title);

    const details = [];
    if (candidate.education) details.push(candidate.education);
    if (candidate.school) details.push(candidate.school);
    if (candidate.experience) details.push(candidate.experience + '年经验');
    if (candidate.salaryDesc) details.push(candidate.salaryDesc);
    if (details.length > 0) {
      const sub = document.createElement('span');
      sub.className = `${SCRIPT_PREFIX}-toast-sub`;
      sub.textContent = details.join(' · ');
      info.appendChild(sub);
    }

    const actions = document.createElement('div');
    actions.className = `${SCRIPT_PREFIX}-toast-actions`;

    const locateBtn = document.createElement('button');
    locateBtn.className = `${SCRIPT_PREFIX}-btn`;
    locateBtn.textContent = '定位';
    locateBtn.style.cssText = 'padding:3px 10px; font-size:12px;';
    locateBtn.addEventListener('click', () => {
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardElement.style.outline = '3px solid #1677ff';
        setTimeout(() => { cardElement.style.outline = ''; }, 2000);
      }
      toast.remove();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = `${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline`;
    dismissBtn.textContent = '忽略';
    dismissBtn.style.cssText = 'padding:3px 10px; font-size:12px;';
    dismissBtn.addEventListener('click', () => toast.remove());

    actions.appendChild(locateBtn);
    actions.appendChild(dismissBtn);

    toast.appendChild(info);
    toast.appendChild(actions);
    container.appendChild(toast);

    // 入场动画
    requestAnimationFrame(() => toast.classList.add('show'));

    // 8秒后自动消失
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  }

  function getToastContainer() {
    let container = document.getElementById(`${SCRIPT_PREFIX}-toast-container`);
    if (!container) {
      container = document.createElement('div');
      container.id = `${SCRIPT_PREFIX}-toast-container`;
      container.className = `${SCRIPT_PREFIX}-toast-container`;
      document.body.appendChild(container);
    }
    return container;
  }

  function showDesktopNotification(candidate, result, cardElement) {
    const title = `高匹配候选人 ${result.score}分`;
    const details = [];
    if (candidate.name) details.push(candidate.name);
    if (candidate.education) details.push(candidate.education);
    if (candidate.school) details.push(candidate.school);
    if (candidate.experience) details.push(candidate.experience + '年经验');
    const body = details.join(' | ');

    try {
      GM_notification({
        title: title,
        text: body,
        timeout: 6000,
        onclick: () => {
          window.focus();
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardElement.style.outline = '3px solid #1677ff';
            setTimeout(() => { cardElement.style.outline = ''; }, 2000);
          }
        }
      });
    } catch (e) {
      // GM_notification不可用时降级到浏览器原生通知
      if (Notification.permission === 'granted') {
        const n = new Notification(title, { body, tag: 'bh-' + candidate.name });
        n.onclick = () => {
          window.focus();
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* 静默失败 */ }
  }

  // ============================================================
  // Section 5: DOM 解析器（兜底方案）
  // ============================================================

  function sliceTextAroundCandidate(text, candidateName) {
    if (!text || !candidateName) return text || '';
    const idx = text.indexOf(candidateName);
    if (idx === -1) return text;
    const start = Math.max(0, idx - 240);
    const end = Math.min(text.length, idx + 1400);
    return text.slice(start, end);
  }

  function scoreCandidateTextScope(text, candidateName, distance) {
    if (!text) return -Infinity;
    const periodCount = extractWorkPeriodsFromText(text).length;
    const hasName = candidateName && text.includes(candidateName) ? 1 : 0;
    const schoolCount = (text.match(/(?:大学|学院)/g) || []).length;
    const salaryCount = (text.match(/\d+\s*[-~·]\s*\d+\s*[Kk]/g) || []).length;
    const lengthPenalty = Math.floor(text.length / 400);
    return periodCount * 20 + schoolCount * 3 + hasName * 5 - salaryCount * 4 - distance * 2 - lengthPenalty;
  }

  function expandCandidateTextScope(cardElement, baseText, candidateName) {
    let bestText = baseText || '';
    let bestScore = scoreCandidateTextScope(bestText, candidateName, 0);
    let node = cardElement;

    for (let i = 0; i < 4 && node?.parentElement; i++) {
      node = node.parentElement;
      const text = node.textContent || '';
      if (!text) continue;
      const scopedText = candidateName ? sliceTextAroundCandidate(text, candidateName) : text;
      const score = scoreCandidateTextScope(scopedText, candidateName, i + 1);
      if (score > bestScore) {
        bestText = scopedText;
        bestScore = score;
      }
    }

    return bestText;
  }

  function extractMajorFromText(text) {
    if (!text) return '';
    const majors = [];
    const majorRegex = /[\u4e00-\u9fa5A-Za-z()（）]{2,30}(?:大学|学院)(?:（[^）]+）|\([^)]*\))?\s*[·•\-\s]\s*([^·•\-\n]{2,24}?)(?=\s*[·•\-\s]\s*(?:博士|硕士|本科|大专|专科)|\s*(?:博士|硕士|本科|大专|专科)|$)/g;
    let match;
    while ((match = majorRegex.exec(text)) !== null) {
      const major = match[1].trim();
      if (!major) continue;
      if (/^(大学|学院|硕士|博士|本科|大专|专科)$/.test(major)) continue;
      if (!majors.includes(major)) majors.push(major);
    }
    return majors.join(' | ');
  }

  function parseCandidateFromDOM(cardElement) {
    const baseText = cardElement.textContent || '';
    const name = extractCandidateName(cardElement);
    const text = expandCandidateTextScope(cardElement, baseText, name);

    const education = extractMatch(text, /(博士|硕士|MBA|本科|大专|高中|中专)/);
    const experience = extractNumber(text, /(\d+)[年]/) || extractNumber(text, /经验\s*(\d+)/);
    const age = extractNumber(text, /(\d{2})岁/);
    const school = extractSchoolFromText(text);
    const major = extractMajorFromText(text);
    const company = extractCompanyFromText(text);

    let salaryMin = 0, salaryMax = 0;
    const salaryMatch = text.match(/(\d+)\s*[-~·]\s*(\d+)\s*[Kk]/);
    if (salaryMatch) {
      salaryMin = parseInt(salaryMatch[1]);
      salaryMax = parseInt(salaryMatch[2]);
    }

    return {
      name: name || '未知',
      age: age || null,
      education: education || null,
      school: school || null,
      major: major || null,
      experience: experience || null,
      company: company || null,
      salaryMin,
      salaryMax,
      salaryDesc: salaryMatch ? salaryMatch[0] : '',
      skills: [],
      status: extractMatch(text, /(在职|离职|在校|应届)/),
      ...(() => {
        const metrics = computeJobMetrics(text, experience);
        return {
          jobCount: metrics.jobCount,
          gapCount: metrics.gapCount,
          maxGapMonths: metrics.maxGapMonths,
          graduationDate: metrics.graduationDate,
          jobPeriods: metrics.periods,
          jobPeriodsSource: metrics.periodsSource
        };
      })(),
      rawText: text,
      source: 'dom'
    };
  }

  function extractCandidateName(card) {
    // 尝试从常见位置提取姓名
    const nameEl = card.querySelector('[class*="name"], [class*="Name"], h3, h4, .title');
    if (nameEl) {
      const t = nameEl.textContent.trim();
      if (t.length >= 2 && t.length <= 10) return t;
    }
    return null;
  }

  function extractSchoolFromText(text) {
    // 检查985/211院校
    for (const s of SCHOOLS_985) {
      if (text.includes(s)) return s;
    }
    for (const s of SCHOOLS_211_ONLY) {
      if (text.includes(s)) return s;
    }
    // 检查海外院校
    for (const k of OVERSEAS_KEYWORDS) {
      if (text.includes(k)) return k;
    }
    // 通用学校名匹配
    const m = text.match(/([\u4e00-\u9fa5]{2,8}(?:大学|学院|University|Institute))/);
    return m ? m[1] : null;
  }

  function extractCompanyFromText(text) {
    for (const c of TOP_COMPANIES) {
      if (text.includes(c)) return c;
    }
    return null;
  }

  // ============================================================
  // Section 6: 页面渲染
  // ============================================================

  let statsBar = null;
  let observer = null;
  let debounceTimer = null;
  let detectedCardSelector = null;
  let floatingTooltip = null;
  let tooltipHideTimer = null;
  let uiInitialized = false; // 标记UI是否已初始化，防止重复创建

  function injectStyles() {
    GM_addStyle(`
      /* 评分徽章 */
      .${SCRIPT_PREFIX}-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        color: #fff;
        z-index: 100;
        pointer-events: auto;
        cursor: default;
        line-height: 18px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      .${SCRIPT_PREFIX}-badge-high { background: #4CAF50; }
      .${SCRIPT_PREFIX}-badge-medium { background: #FF9800; }
      .${SCRIPT_PREFIX}-badge-low { background: #9E9E9E; }

      /* 关键词匹配徽章 */
      .${SCRIPT_PREFIX}-keyword-badge {
        position: absolute;
        top: 32px;
        right: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        color: #fff;
        background: #1677ff;
        z-index: 100;
        pointer-events: auto;
        cursor: help;
        line-height: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* 卡片高亮 */
      .${SCRIPT_PREFIX}-card-high {
        background-color: rgba(76, 175, 80, 0.08) !important;
        border-left: 3px solid #4CAF50 !important;
      }
      .${SCRIPT_PREFIX}-card-medium {
        background-color: rgba(255, 152, 0, 0.06) !important;
        border-left: 3px solid #FF9800 !important;
      }
      .${SCRIPT_PREFIX}-card-low {
        opacity: 0.45 !important;
        border-left: 3px solid #ccc !important;
      }
      .${SCRIPT_PREFIX}-card-low:hover {
        opacity: 0.85 !important;
      }

      /* 不合适标记按钮 */
      .${SCRIPT_PREFIX}-reject-btn {
        position: absolute; top: 8px; right: 70px; z-index: 10;
        padding: 2px 8px; border-radius: 4px; font-size: 11px;
        cursor: pointer; border: 1px solid #ddd; background: #fff;
        color: #999; transition: all 0.2s; line-height: 18px;
      }
      .${SCRIPT_PREFIX}-reject-btn:hover { color: #f44336; border-color: #f44336; }
      .${SCRIPT_PREFIX}-reject-btn.active { background: #f44336; color: #fff; border-color: #f44336; }
      .${SCRIPT_PREFIX}-card-rejected { opacity: 0.45 !important; }

      /* 悬停提示 */
      .${SCRIPT_PREFIX}-tooltip {
        position: fixed;
        top: 0;
        left: 0;
        background: rgba(0,0,0,0.88);
        color: #fff;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.6;
        z-index: 100002;
        max-width: min(420px, calc(100vw - 24px));
        max-height: min(70vh, 520px);
        overflow: auto;
        white-space: pre-line;
        box-shadow: 0 8px 24px rgba(0,0,0,0.28);
        pointer-events: auto;
        opacity: 0;
        visibility: hidden;
        transform: translateY(4px);
        transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
      }
      .${SCRIPT_PREFIX}-tooltip.show {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      /* 统计栏 */
      .${SCRIPT_PREFIX}-stats {
        position: fixed;
        bottom: 70px;
        right: 20px;
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 10000;
        display: flex;
        gap: 12px;
        align-items: center;
        box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      }
      .${SCRIPT_PREFIX}-stats-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
      }

      /* 配置按钮 */
      .${SCRIPT_PREFIX}-toggle-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #1677ff;
        color: #fff;
        border: none;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        box-shadow: 0 2px 12px rgba(22,119,255,0.4);
        transition: transform 0.2s;
      }
      .${SCRIPT_PREFIX}-toggle-btn:hover {
        transform: scale(1.1);
      }

      /* 配置面板 */
      .${SCRIPT_PREFIX}-panel {
        position: fixed;
        top: 0;
        right: -420px;
        width: 400px;
        height: 100vh;
        background: #fff;
        z-index: 100000;
        box-shadow: -4px 0 20px rgba(0,0,0,0.15);
        transition: right 0.3s ease;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #333;
      }
      .${SCRIPT_PREFIX}-panel.open {
        right: 0;
      }
      .${SCRIPT_PREFIX}-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e8e8e8;
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 1;
      }
      .${SCRIPT_PREFIX}-panel-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .${SCRIPT_PREFIX}-panel-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        padding: 4px 8px;
      }
      .${SCRIPT_PREFIX}-panel-close:hover {
        color: #333;
      }
      .${SCRIPT_PREFIX}-panel-body {
        padding: 16px 20px;
      }
      .${SCRIPT_PREFIX}-section {
        margin-bottom: 20px;
      }
      .${SCRIPT_PREFIX}-section-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 10px;
        color: #222;
        cursor: pointer;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .${SCRIPT_PREFIX}-section-title::after {
        content: '▼';
        font-size: 10px;
        color: #999;
        transition: transform 0.2s;
      }
      .${SCRIPT_PREFIX}-section-title.collapsed::after {
        transform: rotate(-90deg);
      }
      .${SCRIPT_PREFIX}-section-content {
        overflow: hidden;
        transition: max-height 0.3s;
      }
      .${SCRIPT_PREFIX}-section-content.collapsed {
        max-height: 0 !important;
      }

      /* 规则列表 */
      .${SCRIPT_PREFIX}-rule-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border: 1px solid #e8e8e8;
        border-radius: 6px;
        margin-bottom: 6px;
        background: #fafafa;
      }
      .${SCRIPT_PREFIX}-rule-item label {
        flex: 1;
        font-size: 13px;
      }
      .${SCRIPT_PREFIX}-rule-score {
        font-weight: bold;
        font-size: 13px;
        min-width: 40px;
        text-align: right;
      }
      .${SCRIPT_PREFIX}-rule-score.positive { color: #4CAF50; }
      .${SCRIPT_PREFIX}-rule-score.negative { color: #f44336; }
      .${SCRIPT_PREFIX}-rule-btn {
        background: none;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 12px;
        color: #666;
      }
      .${SCRIPT_PREFIX}-rule-btn:hover {
        border-color: #1677ff;
        color: #1677ff;
      }
      .${SCRIPT_PREFIX}-rule-btn.delete:hover {
        border-color: #f44336;
        color: #f44336;
      }

      /* 输入控件 */
      .${SCRIPT_PREFIX}-input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        font-size: 13px;
        box-sizing: border-box;
      }
      .${SCRIPT_PREFIX}-input:focus {
        border-color: #1677ff;
        outline: none;
        box-shadow: 0 0 0 2px rgba(22,119,255,0.1);
      }
      .${SCRIPT_PREFIX}-select {
        padding: 6px 10px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        font-size: 13px;
        background: #fff;
      }
      .${SCRIPT_PREFIX}-btn {
        padding: 6px 16px;
        border: 1px solid #1677ff;
        background: #1677ff;
        color: #fff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      .${SCRIPT_PREFIX}-btn:hover {
        background: #4096ff;
      }
      .${SCRIPT_PREFIX}-btn-outline {
        background: #fff;
        color: #1677ff;
      }
      .${SCRIPT_PREFIX}-btn-outline:hover {
        background: #f0f5ff;
      }
      .${SCRIPT_PREFIX}-btn-danger {
        border-color: #f44336;
        background: #fff;
        color: #f44336;
      }
      .${SCRIPT_PREFIX}-btn-danger:hover {
        background: #fff1f0;
      }

      /* 标签输入 */
      .${SCRIPT_PREFIX}-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 6px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        min-height: 36px;
        cursor: text;
      }
      .${SCRIPT_PREFIX}-tag {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        background: #f0f5ff;
        border: 1px solid #d6e4ff;
        border-radius: 4px;
        font-size: 12px;
        color: #1677ff;
      }
      .${SCRIPT_PREFIX}-tag-close {
        margin-left: 4px;
        cursor: pointer;
        font-size: 14px;
        color: #999;
      }
      .${SCRIPT_PREFIX}-tag-close:hover {
        color: #f44336;
      }
      .${SCRIPT_PREFIX}-tag-input {
        border: none;
        outline: none;
        font-size: 13px;
        min-width: 80px;
        flex: 1;
      }

      /* 滑块 */
      .${SCRIPT_PREFIX}-slider-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .${SCRIPT_PREFIX}-slider-group label {
        min-width: 100px;
        font-size: 13px;
      }
      .${SCRIPT_PREFIX}-slider-group input[type="range"] {
        flex: 1;
      }
      .${SCRIPT_PREFIX}-slider-group .value {
        min-width: 30px;
        text-align: right;
        font-weight: bold;
        font-size: 13px;
      }

      /* 底部操作栏 */
      .${SCRIPT_PREFIX}-panel-footer {
        padding: 12px 20px;
        border-top: 1px solid #e8e8e8;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        position: sticky;
        bottom: 0;
        background: #fff;
      }

      /* 添加规则表单 */
      .${SCRIPT_PREFIX}-add-rule-form {
        padding: 12px;
        border: 1px dashed #d9d9d9;
        border-radius: 6px;
        margin-top: 8px;
        background: #fafafa;
      }
      .${SCRIPT_PREFIX}-form-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        align-items: center;
      }
      .${SCRIPT_PREFIX}-form-row label {
        min-width: 50px;
        font-size: 12px;
        color: #666;
      }

      /* 遮罩 */
      .${SCRIPT_PREFIX}-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.3);
        z-index: 99999;
        display: none;
      }
      .${SCRIPT_PREFIX}-overlay.open {
        display: block;
      }

      /* Toast通知 */
      .${SCRIPT_PREFIX}-toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 100001;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .${SCRIPT_PREFIX}-toast {
        pointer-events: auto;
        background: #fff;
        border-left: 4px solid #4CAF50;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 420px;
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .${SCRIPT_PREFIX}-toast.show {
        transform: translateX(0);
        opacity: 1;
      }
      .${SCRIPT_PREFIX}-toast-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .${SCRIPT_PREFIX}-toast-info strong {
        font-size: 14px;
        color: #222;
      }
      .${SCRIPT_PREFIX}-toast-sub {
        font-size: 12px;
        color: #888;
      }
      .${SCRIPT_PREFIX}-toast-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }

      /* 高分卡片呼吸动画 */
      @keyframes ${SCRIPT_PREFIX}-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(76, 175, 80, 0); }
      }
      .${SCRIPT_PREFIX}-card-pulse {
        animation: ${SCRIPT_PREFIX}-pulse 1s ease-in-out 3;
      }
    `);
  }

  // 检测候选人卡片
  function detectCardElements() {
    // 策略1: 通过已知的class模式匹配
    const knownSelectors = [
      '.recommend-card-wrap li',
      '.candidate-list li',
      '.geek-list li',
      '[class*="recommend"] [class*="card"]',
      '[class*="geek"] [class*="card"]',
      '[class*="candidate"] [class*="item"]',
      '.job-card-wrap .job-card-body'
    ];

    for (const sel of knownSelectors) {
      const cards = document.querySelectorAll(sel);
      if (cards.length >= 2) {
        detectedCardSelector = sel;
        return [...cards];
      }
    }

    // 策略2: 启发式检测 - 找包含重复结构且有候选人特征的容器
    const allContainers = document.querySelectorAll('div, ul, section');
    for (const container of allContainers) {
      const children = container.children;
      if (children.length < 2 || children.length > 60) continue;

      // 检查子元素是否有候选人特征
      let matchCount = 0;
      const checkCount = Math.min(children.length, 5);
      for (let i = 0; i < checkCount; i++) {
        const child = children[i];
        const text = child.textContent || '';
        const html = child.innerHTML || '';

        // 排除明显不是候选人卡片的元素
        const isTimeline = /timeline|history|record|experience-item|work-item/i.test(child.className);
        const isNote = /note|remark|comment|memo/i.test(child.className);
        const isSmall = child.offsetHeight < 60; // 候选人卡片通常较高
        if (isTimeline || isNote || isSmall) continue;

        // 候选人卡片必须有的强特征
        const hasAvatar = /<img|avatar|photo/i.test(html);
        const hasName = /[\u4e00-\u9fa5]{2,4}(?=\s|$|·|，|,)/.test(text); // 2-4个汉字的姓名
        const hasEdu = /本科|硕士|博士|大专/.test(text);
        const hasExp = /\d+年|经验|在职|离职/.test(text);
        const hasSalary = /\d+[Kk]|\d+-\d+/.test(text);

        // 必须有姓名或头像，且至少有2个其他特征
        const hasIdentity = hasAvatar || hasName;
        const featureCount = (hasEdu ? 1 : 0) + (hasExp ? 1 : 0) + (hasSalary ? 1 : 0);

        if (hasIdentity && featureCount >= 2) {
          matchCount++;
        }
      }

      if (matchCount >= 2) {
        // 构建选择器
        const tag = container.tagName.toLowerCase();
        const cls = container.className ? '.' + container.className.split(/\s+/).filter(c => c && c.length < 30).join('.') : '';
        const childTag = children[0].tagName.toLowerCase();
        detectedCardSelector = `${tag}${cls} > ${childTag}`;

        console.log(`[BOSS助手] 启发式检测到候选人卡片: ${detectedCardSelector} (${children.length} 张)`);
        return [...children];
      }
    }

    return [];
  }

  function getCardElements() {
    if (detectedCardSelector) {
      const cards = document.querySelectorAll(detectedCardSelector);
      if (cards.length > 0) return [...cards];
      // 选择器失效，重新检测
      detectedCardSelector = null;
    }
    return detectCardElements();
  }

  function ensureFloatingTooltip() {
    if (floatingTooltip) return floatingTooltip;
    floatingTooltip = document.createElement('div');
    floatingTooltip.className = `${SCRIPT_PREFIX}-tooltip`;
    floatingTooltip.addEventListener('mouseenter', () => {
      if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    });
    floatingTooltip.addEventListener('mouseleave', hideFloatingTooltip);
    document.body.appendChild(floatingTooltip);
    return floatingTooltip;
  }

  function positionFloatingTooltip(anchorEl) {
    if (!floatingTooltip || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const tooltipRect = floatingTooltip.getBoundingClientRect();
    const gap = 10;

    let left = rect.right - tooltipRect.width;
    let top = rect.bottom + gap;

    if (left < 12) left = 12;
    if (left + tooltipRect.width > window.innerWidth - 12) {
      left = window.innerWidth - tooltipRect.width - 12;
    }
    if (top + tooltipRect.height > window.innerHeight - 12) {
      top = rect.top - tooltipRect.height - gap;
    }
    if (top < 12) top = 12;

    floatingTooltip.style.left = `${left}px`;
    floatingTooltip.style.top = `${top}px`;
  }

  function showFloatingTooltip(content, anchorEl) {
    const tooltip = ensureFloatingTooltip();
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltip.textContent = content;
    tooltip.classList.add('show');
    positionFloatingTooltip(anchorEl);
  }

  function hideFloatingTooltip() {
    if (!floatingTooltip) return;
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltipHideTimer = setTimeout(() => {
      if (floatingTooltip) floatingTooltip.classList.remove('show');
    }, 80);
  }

  function bindTooltipHover(targetEl, content) {
    if (!targetEl) return;
    targetEl.addEventListener('mouseenter', () => showFloatingTooltip(content, targetEl));
    targetEl.addEventListener('mouseleave', hideFloatingTooltip);
    targetEl.addEventListener('click', (e) => {
      e.stopPropagation();
      showFloatingTooltip(content, targetEl);
    });
  }

  function mergeCandidateJobMetrics(candidate, domCandidate) {
    const merged = { ...candidate };
    const candidatePeriods = Array.isArray(candidate.jobPeriods) ? candidate.jobPeriods : [];
    const domPeriods = Array.isArray(domCandidate.jobPeriods) ? domCandidate.jobPeriods : [];

    const shouldUseDomMetrics =
      (candidate.jobCount || 0) === 0 ||
      domPeriods.length > candidatePeriods.length ||
      (domCandidate.maxGapMonths || 0) > (candidate.maxGapMonths || 0) ||
      (domCandidate.gapCount || 0) > (candidate.gapCount || 0);

    if (shouldUseDomMetrics && domPeriods.length > 0) {
      merged.jobCount = domCandidate.jobCount;
      merged.gapCount = domCandidate.gapCount;
      merged.maxGapMonths = domCandidate.maxGapMonths;
      merged.graduationDate = domCandidate.graduationDate;
      merged.jobPeriods = domCandidate.jobPeriods;
      merged.jobPeriodsSource = domCandidate.jobPeriodsSource || 'dom-text';
    }

    return merged;
  }

  // 为单个卡片渲染评分
  function renderCard(card) {
    if (card.dataset.bhScored) return;

    // 跳过过小的元素（时间线条目、备注等）
    if (card.offsetHeight < 60 || card.offsetWidth < 200) {
      card.dataset.bhScored = 'skip';
      return;
    }

    // 获取候选人数据（优先API数据，回退DOM解析）
    let candidate;
    const domCandidate = parseCandidateFromDOM(card);

    // 尝试从API数据匹配
    if (domCandidate.name && candidateStore.has(domCandidate.name)) {
      candidate = candidateStore.get(domCandidate.name);
    } else {
      // 尝试模糊匹配
      for (const [name, data] of candidateStore) {
        if (domCandidate.rawText.includes(name)) {
          candidate = data;
          break;
        }
      }
    }

    if (!candidate) {
      candidate = domCandidate;
    } else {
      candidate = { ...candidate };
    }

    // 页面右侧时间轴往往比接口字段更贴近用户看到的信息，必要时用DOM时间段覆盖工作指标。
    candidate = mergeCandidateJobMetrics(candidate, domCandidate);

    // 评分
    const result = scoreCandidate(candidate);

    // 标记已处理
    card.dataset.bhScored = '1';
    card.dataset.bhScore = result.score;
    card.dataset.bhLevel = result.level;
    card.style.position = 'relative';

    // 添加卡片高亮class
    card.classList.add(`${SCRIPT_PREFIX}-card-${result.level}`);

    // 分数徽章
    const badge = document.createElement('span');
    badge.className = `${SCRIPT_PREFIX}-badge ${SCRIPT_PREFIX}-badge-${result.level}`;
    badge.textContent = `${result.score}分`;
    card.appendChild(badge);

    // 「不合适」标记按钮
    const candidateName = candidate.name;
    const rejectBtn = document.createElement('span');
    rejectBtn.className = `${SCRIPT_PREFIX}-reject-btn` + (isRejected(candidateName) ? ' active' : '');
    rejectBtn.textContent = '✕ 不合适';
    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleRejected(candidateName);
      rejectBtn.classList.toggle('active');
      card.classList.toggle(`${SCRIPT_PREFIX}-card-rejected`);
    });
    card.appendChild(rejectBtn);
    if (isRejected(candidateName)) {
      card.classList.add(`${SCRIPT_PREFIX}-card-rejected`);
    }

    // 高亮关键词标签（显示在分数旁边）
    if (result.highlightedKeywords && result.highlightedKeywords.length > 0) {
      const keywordBadge = document.createElement('span');
      keywordBadge.className = `${SCRIPT_PREFIX}-keyword-badge`;
      keywordBadge.textContent = result.highlightedKeywords.join(', ');
      keywordBadge.title = '匹配的关键词: ' + result.highlightedKeywords.join(', ');
      card.appendChild(keywordBadge);
    }

    const lines = ['基准分: 30'];
    if (result.matchedRules.length > 0) {
      result.matchedRules.forEach(r => {
        const es = r.effectiveScore || r.score;
        const prefix = es > 0 ? '+' : '';
        const kwInfo = r.matchedKeywords ? ` (×${r.matchedKeywords.length}: ${r.matchedKeywords.join(', ')})` : '';
        lines.push(`${r.name}${kwInfo}: ${prefix}${es}`);
      });
    } else {
      lines.push('(无规则命中)');
    }
    lines.push('───────');
    if (config.debugMode) {
      const workGapRule = config.rules.find(r => r.id === 'work_gap');
      const periods = Array.isArray(candidate.jobPeriods) ? candidate.jobPeriods : [];
      lines.push(`[调试] 数据来源: ${candidate.source || 'unknown'} / 时间来源: ${candidate.jobPeriodsSource || 'none'}`);
      lines.push(`[调试] 状态: ${candidate.status || '未知'} | 工作段: ${candidate.jobCount || 0} | gap数: ${candidate.gapCount || 0} | 最大空窗: ${candidate.maxGapMonths || 0}月`);
      lines.push(`[调试] 毕业时间基线: ${candidate.graduationDate ? formatPeriod({ start: new Date(candidate.graduationDate), end: null }).replace('-至今', '') : '无'}`);
      lines.push(`[调试] 学校: ${candidate.school || '无'} | 专业: ${candidate.major || '无'}`);
      lines.push(`[调试] work_gap规则: ${workGapRule ? (workGapRule.enabled ? '启用' : '关闭') : '缺失'}`);
      if (periods.length > 0) {
        const periodText = periods.map(period => formatPeriod({
          start: period.start ? new Date(period.start) : null,
          end: period.end ? new Date(period.end) : null
        })).join(' | ');
        lines.push(`[调试] 识别时间段: ${periodText}`);
      } else {
        lines.push('[调试] 识别时间段: 无');
      }
      lines.push(`[调试] 文本片段: ${(candidate.rawText || '').slice(0, 180).replace(/\s+/g, ' ')}`);
      lines.push('───────');
    }
    lines.push(`总分: ${result.score}`);
    bindTooltipHover(badge, lines.join('\n'));

    // 高分候选人通知
    notifyHighScoreCandidate(candidate, result, card);
  }

  // 处理所有卡片
  function processCards() {
    const cards = getCardElements();
    cards.forEach(card => renderCard(card));
    updateStats();
  }

  // 重新评分所有卡片
  function rescoreAllCards() {
    const cards = getCardElements();
    cards.forEach(card => {
      card.dataset.bhScored = '';
      card.querySelectorAll(`.${SCRIPT_PREFIX}-badge, .${SCRIPT_PREFIX}-tooltip, .${SCRIPT_PREFIX}-reject-btn`).forEach(el => el.remove());
      card.classList.remove(`${SCRIPT_PREFIX}-card-high`, `${SCRIPT_PREFIX}-card-medium`, `${SCRIPT_PREFIX}-card-low`, `${SCRIPT_PREFIX}-card-rejected`);
      card.style.opacity = '';
    });
    processCards();
  }

  // 统计栏
  function updateStats() {
    const cards = getCardElements();
    const total = cards.length;
    let high = 0, medium = 0, low = 0;
    cards.forEach(card => {
      const level = card.dataset.bhLevel;
      if (level === 'high') high++;
      else if (level === 'medium') medium++;
      else if (level === 'low') low++;
    });

    if (!statsBar) {
      statsBar = document.createElement('div');
      statsBar.className = `${SCRIPT_PREFIX}-stats`;
      document.body.appendChild(statsBar);
    }

    statsBar.innerHTML = `
      <span>BOSS助手</span>
      <span>共 ${total} 人</span>
      <span><span class="${SCRIPT_PREFIX}-stats-dot" style="background:#4CAF50"></span>优 ${high}</span>
      <span><span class="${SCRIPT_PREFIX}-stats-dot" style="background:#FF9800"></span>中 ${medium}</span>
      <span><span class="${SCRIPT_PREFIX}-stats-dot" style="background:#9E9E9E"></span>低 ${low}</span>
    `;
  }

  // DOM变化监听
  function setupObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => processCards(), 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ============================================================
  // Section 7: 配置面板
  // ============================================================

  let panel = null;
  let overlay = null;
  let isPanelOpen = false;

  function togglePanel() {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    if (!panel) createPanel();
    refreshPanelContent();
    panel.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    isPanelOpen = true;
  }

  function closePanel() {
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    isPanelOpen = false;
  }

  function createPanel() {
    // 遮罩
    overlay = document.createElement('div');
    overlay.className = `${SCRIPT_PREFIX}-overlay`;
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);

    // 面板
    panel = document.createElement('div');
    panel.className = `${SCRIPT_PREFIX}-panel`;
    panel.innerHTML = `
      <div class="${SCRIPT_PREFIX}-panel-header">
        <h3>BOSS助手 配置</h3>
        <button class="${SCRIPT_PREFIX}-panel-close">&times;</button>
      </div>
      <div class="${SCRIPT_PREFIX}-panel-body" id="${SCRIPT_PREFIX}-panel-body"></div>
      <div class="${SCRIPT_PREFIX}-panel-footer">
        <button class="${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline" id="${SCRIPT_PREFIX}-btn-export">导出配置</button>
        <button class="${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline" id="${SCRIPT_PREFIX}-btn-import">导入配置</button>
        <button class="${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-danger" id="${SCRIPT_PREFIX}-btn-reset">恢复默认</button>
      </div>
    `;
    document.body.appendChild(panel);

    // 事件绑定
    panel.querySelector(`.${SCRIPT_PREFIX}-panel-close`).addEventListener('click', closePanel);
    panel.querySelector(`#${SCRIPT_PREFIX}-btn-export`).addEventListener('click', exportConfig);
    panel.querySelector(`#${SCRIPT_PREFIX}-btn-import`).addEventListener('click', handleImport);
    panel.querySelector(`#${SCRIPT_PREFIX}-btn-reset`).addEventListener('click', handleReset);
  }

  function refreshPanelContent() {
    const body = panel.querySelector(`#${SCRIPT_PREFIX}-panel-body`);
    body.innerHTML = '';

    // 配置源（远程角色配置）
    body.appendChild(createConfigSourceSection());
    // 预设模板
    body.appendChild(createPresetSection());
    // 评分阈值
    body.appendChild(createThresholdSection());
    // 评分规则
    body.appendChild(createRulesSection());
    // 加分关键词
    body.appendChild(createKeywordSection('加分关键词', 'positiveKeywords', '#4CAF50'));
    // 减分关键词
    body.appendChild(createKeywordSection('减分关键词', 'negativeKeywords', '#f44336'));
    // 高亮关键词
    body.appendChild(createHighlightKeywordSection());
    // 院校名单
    body.appendChild(createSchoolSection());
    // 高级设置
    body.appendChild(createAdvancedSection());
  }

  // --- 配置源 ---
  function createConfigSourceSection() {
    const section = createSection('配置源');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    // 角色选择
    const roleRow = document.createElement('div');
    roleRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px;';

    const roleLabel = document.createElement('label');
    roleLabel.textContent = '角色:';
    roleLabel.style.cssText = 'flex-shrink: 0; font-weight: 500;';

    const roleSelect = document.createElement('select');
    roleSelect.style.cssText = 'flex: 1; padding: 6px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '-- 不使用远程配置 --';
    roleSelect.appendChild(noneOpt);

    for (const [key, role] of Object.entries(ROLE_CONFIGS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = role.name;
      if (config.roleKey === key) opt.selected = true;
      roleSelect.appendChild(opt);
    }

    const customOpt = document.createElement('option');
    customOpt.value = '_custom';
    customOpt.textContent = '自定义URL';
    if (config.roleKey === '_custom') customOpt.selected = true;
    roleSelect.appendChild(customOpt);

    roleRow.appendChild(roleLabel);
    roleRow.appendChild(roleSelect);
    content.appendChild(roleRow);

    // 自定义URL输入框（仅在选择自定义时显示）
    const urlRow = document.createElement('div');
    urlRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px;' +
      (config.roleKey === '_custom' ? '' : ' display: none;');

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = '输入远程配置JSON的URL';
    urlInput.value = config.roleKey === '_custom' ? (config.configUrl || '') : '';
    urlInput.style.cssText = 'flex: 1; padding: 6px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;';

    urlRow.appendChild(urlInput);
    content.appendChild(urlRow);

    // 同步按钮行
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

    const syncBtn = document.createElement('button');
    syncBtn.className = `${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline`;
    syncBtn.textContent = '立即同步';
    syncBtn.style.cssText = 'flex-shrink: 0;';

    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size: 12px; color: #999;';
    if (config.lastRemoteSync) {
      const d = new Date(config.lastRemoteSync);
      statusSpan.textContent = '上次同步: ' + d.toLocaleString('zh-CN');
    } else if (config.configUrl) {
      statusSpan.textContent = '尚未同步';
    }

    actionRow.appendChild(syncBtn);
    actionRow.appendChild(statusSpan);
    content.appendChild(actionRow);

    // 角色切换事件
    roleSelect.addEventListener('change', () => {
      const val = roleSelect.value;
      config.roleKey = val;
      if (val && val !== '_custom') {
        config.configUrl = ROLE_CONFIGS[val].url;
        urlRow.style.display = 'none';
      } else if (val === '_custom') {
        config.configUrl = urlInput.value;
        urlRow.style.display = 'flex';
      } else {
        config.configUrl = '';
        urlRow.style.display = 'none';
      }
      saveConfig();
    });

    // URL输入事件
    urlInput.addEventListener('change', () => {
      config.configUrl = urlInput.value.trim();
      saveConfig();
    });

    // 同步按钮事件
    syncBtn.addEventListener('click', () => {
      if (!config.configUrl) {
        statusSpan.textContent = '请先选择角色或输入URL';
        statusSpan.style.color = '#f44336';
        return;
      }
      syncBtn.disabled = true;
      syncBtn.textContent = '同步中...';
      statusSpan.textContent = '';
      fetchRemoteConfig(config.configUrl, (ok, msg) => {
        syncBtn.disabled = false;
        syncBtn.textContent = '立即同步';
        if (ok) {
          statusSpan.textContent = '同步成功: ' + msg;
          statusSpan.style.color = '#4CAF50';
          refreshPanelContent();
        } else {
          statusSpan.textContent = '同步失败: ' + msg;
          statusSpan.style.color = '#f44336';
        }
      }, true); // force=true: 手动同步强制覆盖本地
    });

    // 期望性别
    const genderRow = document.createElement('div');
    genderRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 10px;';

    const genderLabel = document.createElement('label');
    genderLabel.textContent = '期望性别:';
    genderLabel.style.cssText = 'flex-shrink: 0; font-weight: 500;';

    const genderSelect = document.createElement('select');
    genderSelect.style.cssText = 'flex: 1; padding: 6px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;';

    [['', '不限'], ['男', '男'], ['女', '女']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (config.expectedGender === val) opt.selected = true;
      genderSelect.appendChild(opt);
    });

    genderSelect.addEventListener('change', () => {
      config.expectedGender = genderSelect.value;
      saveConfig();
      rescoreAllCards();
    });

    genderRow.appendChild(genderLabel);
    genderRow.appendChild(genderSelect);
    content.appendChild(genderRow);

    return section;
  }

  // --- 预设模板 ---
  function createPresetSection() {
    const section = createSection('预设模板');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

    for (const [key, preset] of Object.entries(PRESET_TEMPLATES)) {
      const btn = document.createElement('button');
      btn.className = `${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline`;
      btn.textContent = preset.name;
      btn.addEventListener('click', () => {
        applyPreset(key);
        refreshPanelContent();
      });
      row.appendChild(btn);
    }
    content.appendChild(row);
    return section;
  }

  // --- 评分阈值 ---
  function createThresholdSection() {
    const section = createSection('评分阈值');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    content.appendChild(createSlider('高匹配 (绿色)', config.thresholdHigh, 0, 100, (v) => {
      config.thresholdHigh = v;
      normalizeNotifyThreshold();
      syncNotifyThresholdControl();
      saveConfig();
      rescoreAllCards();
    }));
    content.appendChild(createSlider('一般 (黄色)', config.thresholdLow, 0, 100, (v) => {
      config.thresholdLow = v;
      saveConfig();
      rescoreAllCards();
    }));
    content.appendChild(createSlider('薪资上限 (K, 0=不限)', config.salaryMax, 0, 100, (v) => {
      config.salaryMax = v;
      syncKeywordsToRules();
      saveConfig();
      rescoreAllCards();
    }));

    return section;
  }

  // --- 评分规则 ---
  function createRulesSection() {
    const section = createSection('评分规则');
    section.dataset.bhSection = 'rules';
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    config.rules.forEach((rule, index) => {
      const item = document.createElement('div');
      item.className = `${SCRIPT_PREFIX}-rule-item`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = rule.enabled;
      checkbox.addEventListener('change', () => {
        config.rules[index].enabled = checkbox.checked;
        saveConfig();
        rescoreAllCards();
      });

      const label = document.createElement('label');
      label.textContent = rule.name;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = `${SCRIPT_PREFIX}-rule-score ${rule.score > 0 ? 'positive' : 'negative'}`;
      scoreSpan.textContent = (rule.score > 0 ? '+' : '') + rule.score;

      const editBtn = document.createElement('button');
      editBtn.className = `${SCRIPT_PREFIX}-rule-btn`;
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', () => showRuleEditor(index));

      const delBtn = document.createElement('button');
      delBtn.className = `${SCRIPT_PREFIX}-rule-btn delete`;
      delBtn.textContent = '删';
      delBtn.addEventListener('click', () => {
        config.rules.splice(index, 1);
        saveConfig();
        rescoreAllCards();
        refreshPanelContent();
      });

      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(scoreSpan);
      item.appendChild(editBtn);
      item.appendChild(delBtn);
      content.appendChild(item);
    });

    // 添加规则按钮
    const addBtn = document.createElement('button');
    addBtn.className = `${SCRIPT_PREFIX}-btn`;
    addBtn.textContent = '+ 添加规则';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', () => showRuleEditor(-1));
    content.appendChild(addBtn);

    return section;
  }

  // --- 规则编辑器 ---
  function showRuleEditor(index) {
    const isNew = index === -1;
    const rule = isNew ? {
      id: 'custom_' + Date.now(),
      name: '',
      field: 'rawText',
      type: 'bonus',
      operator: 'contains',
      value: '',
      score: 10,
      enabled: true
    } : { ...config.rules[index] };

    const fields = [
      { value: '_computed', label: '计算字段' },
      { value: 'education', label: '学历' },
      { value: 'school', label: '学校' },
      { value: 'major', label: '专业' },
      { value: 'experience', label: '工作年限' },
      { value: 'company', label: '公司' },
      { value: 'salaryMax', label: '期望薪资(上限K)' },
      { value: 'rawText', label: '全文' },
      { value: 'status', label: '在职状态' }
    ];

    const operators = [
      { value: 'eq', label: '等于' },
      { value: 'neq', label: '不等于' },
      { value: 'gt', label: '大于' },
      { value: 'lt', label: '小于' },
      { value: 'between', label: '介于' },
      { value: 'in', label: '在列表中' },
      { value: 'contains', label: '包含' },
      { value: 'notContains', label: '不包含' },
      { value: 'containsAny', label: '包含任一' },
      { value: 'regex', label: '正则匹配' },
      { value: 'schoolLevel', label: '院校等级' },
      { value: 'gtPerUnit', label: '每超1单位' },
      { value: 'containsAnyWord', label: '包含任一词(精确)' },
      { value: 'checkGender', label: '性别校验' },
      { value: 'jobHopping', label: '频繁跳槽检测' },
      { value: 'workGap', label: '工作空窗期检测' },
      { value: 'overseasMaster', label: '海外名校硕士' }
    ];

    if (!fields.some(f => f.value === rule.field)) {
      fields.unshift({ value: rule.field, label: `当前值(${rule.field})` });
    }
    if (!operators.some(o => o.value === rule.operator)) {
      operators.unshift({ value: rule.operator, label: `当前值(${rule.operator})` });
    }

    const form = document.createElement('div');
    form.className = `${SCRIPT_PREFIX}-add-rule-form`;
    form.innerHTML = `
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>名称</label>
        <input class="${SCRIPT_PREFIX}-input" value="${rule.name}" data-field="name" style="flex:1">
      </div>
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>字段</label>
        <select class="${SCRIPT_PREFIX}-select" data-field="field" style="flex:1">
          ${fields.map(f => `<option value="${f.value}" ${rule.field === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
      </div>
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>类型</label>
        <select class="${SCRIPT_PREFIX}-select" data-field="type" style="flex:1">
          <option value="bonus" ${rule.type === 'bonus' ? 'selected' : ''}>加分</option>
          <option value="penalty" ${rule.type === 'penalty' ? 'selected' : ''}>减分</option>
          <option value="knockout" ${rule.type === 'knockout' ? 'selected' : ''}>一票否决</option>
        </select>
      </div>
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>条件</label>
        <select class="${SCRIPT_PREFIX}-select" data-field="operator" style="flex:1">
          ${operators.map(o => `<option value="${o.value}" ${rule.operator === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>值</label>
        <input class="${SCRIPT_PREFIX}-input" value="${Array.isArray(rule.value) ? rule.value.join(', ') : (rule.value ?? '')}" data-field="value" style="flex:1"
          placeholder="多个值用逗号分隔">
      </div>
      <div class="${SCRIPT_PREFIX}-form-row">
        <label>分值</label>
        <input class="${SCRIPT_PREFIX}-input" type="number" value="${rule.score}" data-field="score" style="width:80px">
      </div>
      <div class="${SCRIPT_PREFIX}-form-row" style="justify-content: flex-end; gap: 8px;">
        <button class="${SCRIPT_PREFIX}-btn" id="${SCRIPT_PREFIX}-rule-save">保存</button>
        <button class="${SCRIPT_PREFIX}-btn ${SCRIPT_PREFIX}-btn-outline" id="${SCRIPT_PREFIX}-rule-cancel">取消</button>
      </div>
    `;

    // 找到规则列表区域插入
    const rulesSection = panel.querySelector(`[data-bh-section="rules"]`);
    const existingForm = rulesSection.querySelector(`.${SCRIPT_PREFIX}-add-rule-form`);
    if (existingForm) existingForm.remove();
    rulesSection.querySelector(`.${SCRIPT_PREFIX}-section-content`).appendChild(form);

    const fieldSelect = form.querySelector('[data-field="field"]');
    const operatorSelect = form.querySelector('[data-field="operator"]');
    const valueInput = form.querySelector('[data-field="value"]');

    const syncComputedRuleEditorState = () => {
      const computedOperators = ['jobHopping', 'workGap', 'checkGender', 'overseasMaster'];
      const isComputed = computedOperators.includes(operatorSelect.value);

      if (isComputed) {
        fieldSelect.value = '_computed';
        valueInput.value = '';
        valueInput.disabled = true;
        valueInput.placeholder = '该条件无需填写值';
      } else {
        valueInput.disabled = false;
        valueInput.placeholder = '多个值用逗号分隔';
      }
    };

    operatorSelect.addEventListener('change', syncComputedRuleEditorState);
    syncComputedRuleEditorState();

    // 保存
    form.querySelector(`#${SCRIPT_PREFIX}-rule-save`).addEventListener('click', () => {
      const newRule = {
        id: rule.id,
        name: form.querySelector('[data-field="name"]').value || '自定义规则',
        field: form.querySelector('[data-field="field"]').value,
        type: form.querySelector('[data-field="type"]').value,
        operator: form.querySelector('[data-field="operator"]').value,
        score: parseInt(form.querySelector('[data-field="score"]').value) || 0,
        enabled: true
      };

      // 解析值
      const rawValue = form.querySelector('[data-field="value"]').value;
      if (['jobHopping', 'workGap', 'checkGender', 'overseasMaster'].includes(newRule.operator)) {
        newRule.field = '_computed';
        newRule.value = null;
      } else if (['in', 'notIn', 'containsAny'].includes(newRule.operator)) {
        newRule.value = rawValue.split(/[,，]\s*/).filter(Boolean);
      } else if (newRule.operator === 'between') {
        const parts = rawValue.split(/[,，\-~]\s*/).filter(Boolean).map(Number);
        newRule.value = parts.length === 2 ? parts : [0, 100];
      } else if (['gt', 'lt', 'gte', 'lte'].includes(newRule.operator)) {
        newRule.value = parseFloat(rawValue) || 0;
      } else {
        newRule.value = rawValue;
      }

      if (isNew) {
        config.rules.push(newRule);
      } else {
        config.rules[index] = newRule;
      }
      saveConfig();
      rescoreAllCards();
      refreshPanelContent();
    });

    // 取消
    form.querySelector(`#${SCRIPT_PREFIX}-rule-cancel`).addEventListener('click', () => {
      form.remove();
    });
  }

  // --- 关键词编辑 ---
  function createKeywordSection(title, configKey, color) {
    const section = createSection(title);
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    const isPositive = configKey === 'positiveKeywords';
    const minMatchKey = isPositive ? 'keywordBonusMinMatch' : 'keywordPenaltyMinMatch';
    const scoreKey = isPositive ? 'keywordBonusScore' : 'keywordPenaltyScore';

    // 阈值配置行
    const configRow = document.createElement('div');
    configRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 13px;';

    const minLabel = document.createElement('span');
    minLabel.textContent = isPositive ? '满' : '匹配';
    configRow.appendChild(minLabel);

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.min = '1';
    minInput.max = '99';
    minInput.value = config[minMatchKey] || 1;
    minInput.style.cssText = 'width: 48px; padding: 4px 6px; border: 1px solid #d9d9d9; border-radius: 4px; text-align: center; font-size: 13px;';
    configRow.appendChild(minInput);

    const midLabel = document.createElement('span');
    midLabel.textContent = isPositive ? '条及以上' : '条及以上';
    configRow.appendChild(midLabel);

    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = isPositive ? '加' : '扣';
    scoreLabel.style.marginLeft = '6px';
    configRow.appendChild(scoreLabel);

    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.min = '1';
    scoreInput.max = '100';
    scoreInput.value = Math.abs(config[scoreKey] || 15);
    scoreInput.style.cssText = 'width: 48px; padding: 4px 6px; border: 1px solid #d9d9d9; border-radius: 4px; text-align: center; font-size: 13px;';
    configRow.appendChild(scoreInput);

    const unitLabel = document.createElement('span');
    unitLabel.textContent = '分';
    configRow.appendChild(unitLabel);

    const saveParams = () => {
      config[minMatchKey] = Math.max(1, parseInt(minInput.value) || 1);
      config[scoreKey] = isPositive
        ? Math.abs(parseInt(scoreInput.value) || 15)
        : -Math.abs(parseInt(scoreInput.value) || 15);
      syncKeywordsToRules();
      saveConfig();
      rescoreAllCards();
    };
    minInput.addEventListener('change', saveParams);
    scoreInput.addEventListener('change', saveParams);

    content.appendChild(configRow);

    const tagsContainer = document.createElement('div');
    tagsContainer.className = `${SCRIPT_PREFIX}-tags`;

    const renderTags = () => {
      tagsContainer.innerHTML = '';
      (config[configKey] || []).forEach((keyword, i) => {
        const tag = document.createElement('span');
        tag.className = `${SCRIPT_PREFIX}-tag`;
        tag.style.borderColor = color + '40';
        tag.style.background = color + '10';
        tag.style.color = color;

        const textNode = document.createTextNode(keyword);
        tag.appendChild(textNode);

        const closeBtn = document.createElement('span');
        closeBtn.className = `${SCRIPT_PREFIX}-tag-close`;
        closeBtn.dataset.index = i;
        closeBtn.textContent = '\u00d7';
        tag.appendChild(closeBtn);

        tagsContainer.appendChild(tag);
      });

      // 输入框
      const input = document.createElement('input');
      input.className = `${SCRIPT_PREFIX}-tag-input`;
      input.placeholder = '输入关键词后回车添加';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = input.value.trim().replace(/[,，]$/, '');
          if (val && !config[configKey].includes(val)) {
            config[configKey].push(val);
            syncKeywordsToRules();
            saveConfig();
            rescoreAllCards();
            renderTags();
          }
        }
      });
      tagsContainer.appendChild(input);

      // 删除标签
      tagsContainer.querySelectorAll(`.${SCRIPT_PREFIX}-tag-close`).forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
          const idx = parseInt(closeBtn.dataset.index);
          config[configKey].splice(idx, 1);
          syncKeywordsToRules();
          saveConfig();
          rescoreAllCards();
          renderTags();
        });
      });
    };

    renderTags();
    content.appendChild(tagsContainer);
    return section;
  }

  // --- 高亮关键词 ---
  function createHighlightKeywordSection() {
    const section = createSection('高亮关键词匹配');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    // 说明文字
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px; color:#666; margin:0 0 10px;';
    hint.textContent = '匹配到的关键词将显示在分数旁边的蓝色标签中（不影响评分）';
    content.appendChild(hint);

    const tagsContainer = document.createElement('div');
    tagsContainer.className = `${SCRIPT_PREFIX}-tags`;

    const renderTags = () => {
      tagsContainer.innerHTML = '';
      (config.highlightKeywords || []).forEach((keyword, i) => {
        const tag = document.createElement('span');
        tag.className = `${SCRIPT_PREFIX}-tag`;
        tag.style.borderColor = '#1677ff40';
        tag.style.background = '#1677ff10';
        tag.style.color = '#1677ff';

        const textNode = document.createTextNode(keyword);
        tag.appendChild(textNode);

        const closeBtn = document.createElement('span');
        closeBtn.className = `${SCRIPT_PREFIX}-tag-close`;
        closeBtn.dataset.index = i;
        closeBtn.textContent = '\u00d7';
        tag.appendChild(closeBtn);

        tagsContainer.appendChild(tag);
      });

      // 输入框
      const input = document.createElement('input');
      input.className = `${SCRIPT_PREFIX}-tag-input`;
      input.placeholder = '输入关键词后回车添加（如：C++、STL、模板等）';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = input.value.trim().replace(/[,，]$/, '');
          if (val && !(config.highlightKeywords || []).includes(val)) {
            if (!config.highlightKeywords) config.highlightKeywords = [];
            config.highlightKeywords.push(val);
            saveConfig();
            rescoreAllCards();
            renderTags();
          }
        }
      });
      tagsContainer.appendChild(input);

      // 删除标签
      tagsContainer.querySelectorAll(`.${SCRIPT_PREFIX}-tag-close`).forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
          const idx = parseInt(closeBtn.dataset.index);
          config.highlightKeywords.splice(idx, 1);
          saveConfig();
          rescoreAllCards();
          renderTags();
        });
      });
    };

    renderTags();
    content.appendChild(tagsContainer);
    return section;
  }

  // --- 院校名单 ---
  function createSchoolSection() {
    const section = createSection('院校名单');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    // 985
    const p985 = document.createElement('p');
    p985.style.cssText = 'font-size:12px; color:#666; margin:0 0 4px;';
    p985.textContent = `985院校 (${SCHOOLS_985.length}所): ${SCHOOLS_985.slice(0, 5).join('、')}...`;
    content.appendChild(p985);

    // 211
    const p211 = document.createElement('p');
    p211.style.cssText = 'font-size:12px; color:#666; margin:0 0 8px;';
    p211.textContent = `211院校 (${SCHOOLS_985.length + SCHOOLS_211_ONLY.length}所): 含985 + ${SCHOOLS_211_ONLY.slice(0, 3).join('、')}...`;
    content.appendChild(p211);

    // 自定义院校
    content.appendChild(createKeywordSubsection('自定义院校', 'customSchools'));

    return section;
  }

  function createKeywordSubsection(title, configKey) {
    const wrapper = document.createElement('div');
    const label = document.createElement('p');
    label.style.cssText = 'font-size:12px; color:#666; margin:0 0 4px;';
    label.textContent = title + ':';
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.className = `${SCRIPT_PREFIX}-input`;
    input.value = (config[configKey] || []).join(', ');
    input.placeholder = '逗号分隔添加';
    input.addEventListener('change', () => {
      config[configKey] = input.value.split(/[,，]\s*/).filter(Boolean);
      saveConfig();
      rescoreAllCards();
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  // --- 高级设置 ---
  function createAdvancedSection() {
    const section = createSection('高级设置');
    const content = section.querySelector(`.${SCRIPT_PREFIX}-section-content`);

    // 高分通知开关
    const notifyRow = document.createElement('div');
    notifyRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
    const notifyCheckbox = document.createElement('input');
    notifyCheckbox.type = 'checkbox';
    notifyCheckbox.checked = config.notifyEnabled;
    notifyCheckbox.addEventListener('change', () => {
      config.notifyEnabled = notifyCheckbox.checked;
      saveConfig();
    });
    const notifyLabel = document.createElement('label');
    notifyLabel.textContent = '高分候选人通知 (桌面通知 + 页面Toast)';
    notifyLabel.style.fontSize = '13px';
    notifyRow.appendChild(notifyCheckbox);
    notifyRow.appendChild(notifyLabel);
    content.appendChild(notifyRow);

    const notifyThresholdHint = document.createElement('p');
    notifyThresholdHint.style.cssText = 'font-size:12px; color:#666; margin:0 0 6px 24px;';
    notifyThresholdHint.textContent = '仅当候选人分数达到该阈值时通知，且不会低于“高匹配”阈值。';
    content.appendChild(notifyThresholdHint);

    const notifyThresholdSlider = createSlider('通知分数下限', config.notifyThreshold, config.thresholdHigh, 100, (v) => {
      config.notifyThreshold = v;
      normalizeNotifyThreshold();
      syncNotifyThresholdControl();
      saveConfig();
    });
    notifyThresholdSlider.dataset.bhControl = 'notify-threshold-row';
    notifyThresholdSlider.querySelector('input[type="range"]').dataset.bhControl = 'notify-threshold';
    notifyThresholdSlider.querySelector('.value').dataset.bhControl = 'notify-threshold-value';
    content.appendChild(notifyThresholdSlider);

    // 提示音开关
    const soundRow = document.createElement('div');
    soundRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:12px;';
    const soundCheckbox = document.createElement('input');
    soundCheckbox.type = 'checkbox';
    soundCheckbox.checked = config.notifySound;
    soundCheckbox.addEventListener('change', () => {
      config.notifySound = soundCheckbox.checked;
      saveConfig();
    });
    const soundLabel = document.createElement('label');
    soundLabel.textContent = '提示音 (高分候选人出现时播放短促提示)';
    soundLabel.style.fontSize = '13px';
    soundRow.appendChild(soundCheckbox);
    soundRow.appendChild(soundLabel);
    content.appendChild(soundRow);

    // 探测模式
    const probeRow = document.createElement('div');
    probeRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
    const probeCheckbox = document.createElement('input');
    probeCheckbox.type = 'checkbox';
    probeCheckbox.checked = config.probeMode;
    probeCheckbox.addEventListener('change', () => {
      config.probeMode = probeCheckbox.checked;
      saveConfig();
      if (config.probeMode) {
        console.log('%c[BOSS助手] 探测模式已开启，请在Network面板查看捕获的API请求', 'color: blue; font-size: 14px');
      }
    });
    const probeLabel = document.createElement('label');
    probeLabel.textContent = 'API探测模式 (在控制台输出所有拦截到的请求)';
    probeLabel.style.fontSize = '13px';
    probeRow.appendChild(probeCheckbox);
    probeRow.appendChild(probeLabel);
    content.appendChild(probeRow);

    // 调试模式
    const debugRow = document.createElement('div');
    debugRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
    const debugCheckbox = document.createElement('input');
    debugCheckbox.type = 'checkbox';
    debugCheckbox.checked = config.debugMode;
    debugCheckbox.addEventListener('change', () => {
      config.debugMode = debugCheckbox.checked;
      saveConfig();
    });
    const debugLabel = document.createElement('label');
    debugLabel.textContent = '调试模式 (在控制台输出评分详情)';
    debugLabel.style.fontSize = '13px';
    debugRow.appendChild(debugCheckbox);
    debugRow.appendChild(debugLabel);
    content.appendChild(debugRow);

    // API端点
    const epLabel = document.createElement('p');
    epLabel.style.cssText = 'font-size:12px; color:#666; margin:8px 0 4px;';
    epLabel.textContent = 'API端点 (每行一个URL片段):';
    content.appendChild(epLabel);

    const epInput = document.createElement('textarea');
    epInput.className = `${SCRIPT_PREFIX}-input`;
    epInput.style.cssText = 'min-height:60px; resize:vertical;';
    epInput.value = (config.apiEndpoints || []).join('\n');
    epInput.placeholder = '例如: /wapi/zpboss/recommend';
    epInput.addEventListener('change', () => {
      config.apiEndpoints = epInput.value.split('\n').map(s => s.trim()).filter(Boolean);
      saveConfig();
    });
    content.appendChild(epInput);

    return section;
  }

  // --- UI 工具函数 ---
  function createSection(title) {
    const section = document.createElement('div');
    section.className = `${SCRIPT_PREFIX}-section`;

    const titleEl = document.createElement('div');
    titleEl.className = `${SCRIPT_PREFIX}-section-title`;
    titleEl.textContent = title;

    const contentEl = document.createElement('div');
    contentEl.className = `${SCRIPT_PREFIX}-section-content`;
    contentEl.style.maxHeight = '2000px';

    titleEl.addEventListener('click', () => {
      titleEl.classList.toggle('collapsed');
      contentEl.classList.toggle('collapsed');
    });

    section.appendChild(titleEl);
    section.appendChild(contentEl);
    return section;
  }

  function createSlider(label, value, min, max, onChange) {
    const row = document.createElement('div');
    row.className = `${SCRIPT_PREFIX}-slider-group`;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.value = value;

    const valueEl = document.createElement('span');
    valueEl.className = 'value';
    valueEl.textContent = value;

    slider.addEventListener('input', () => {
      valueEl.textContent = slider.value;
      onChange(parseInt(slider.value));
    });

    row.appendChild(labelEl);
    row.appendChild(slider);
    row.appendChild(valueEl);
    return row;
  }

  function syncNotifyThresholdControl() {
    if (!panel) return;
    const slider = panel.querySelector('input[data-bh-control="notify-threshold"]');
    const valueEl = panel.querySelector('[data-bh-control="notify-threshold-value"]');
    if (!slider || !valueEl) return;
    slider.min = config.thresholdHigh;
    slider.value = config.notifyThreshold;
    valueEl.textContent = config.notifyThreshold;
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (importConfig(ev.target.result)) {
          refreshPanelContent();
          alert('配置导入成功！');
        } else {
          alert('配置导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function handleReset() {
    if (confirm('确定恢复默认配置？当前配置将丢失。')) {
      config = getDefaultConfig();
      saveConfig();
      rescoreAllCards();
      refreshPanelContent();
    }
  }

  // ============================================================
  // Section 8: 初始化
  // ============================================================

  function init() {
    // 加载配置
    loadConfig();
    loadRejected();

    // 注入拦截器（在document-start阶段）
    setupInterceptors();

    // 等待DOM就绪后初始化UI
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  }

  function initUI() {
    // 防止重复初始化（检查全局标志和DOM元素）
    if (uiInitialized || window.__BOSS_HELPER_INITIALIZED__ || document.querySelector(`.${SCRIPT_PREFIX}-toggle-btn`)) {
      console.log('[BOSS助手] UI已初始化，跳过重复创建');
      return;
    }
    uiInitialized = true;
    window.__BOSS_HELPER_INITIALIZED__ = true;

    // 注入样式
    injectStyles();

    // 创建配置按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `${SCRIPT_PREFIX}-toggle-btn`;
    toggleBtn.textContent = '⚙';
    toggleBtn.title = 'BOSS助手配置';
    toggleBtn.addEventListener('click', togglePanel);
    document.body.appendChild(toggleBtn);

    // 注册油猴菜单
    GM_registerMenuCommand('打开配置面板', togglePanel);
    GM_registerMenuCommand('切换探测模式', () => {
      config.probeMode = !config.probeMode;
      saveConfig();
      console.log(`[BOSS助手] 探测模式: ${config.probeMode ? '开启' : '关闭'}`);
    });
    GM_registerMenuCommand('重新评分', rescoreAllCards);

    // 启动DOM监听
    setupObserver();

    // 首次处理
    setTimeout(() => processCards(), 1000);

    console.log('%c[BOSS助手] 已启动 v0.1.1', 'color: #1677ff; font-weight: bold; font-size: 14px');
    if (config.probeMode) {
      console.log('%c[BOSS助手] 探测模式已开启，请浏览页面并在控制台查看拦截到的API请求', 'color: orange; font-size: 13px');
    }

    // 异步加载远程配置（不阻塞初始化）
    if (config.configUrl) {
      fetchRemoteConfig(config.configUrl, (ok, msg) => {
        if (ok) {
          console.log('[BOSS助手] 远程配置自动同步完成:', msg);
        }
      });
    }
  }

  // 启动
  init();

})();