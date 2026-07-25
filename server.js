const express = require('express');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Lazy-cached tenders database loading
let allTendersCached = null;
function getAllTenders() {
  if (allTendersCached) return allTendersCached;
  try {
    const filePath = path.join(__dirname, 'data', 'tenders.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      allTendersCached = data.tenders || [];
    } else {
      allTendersCached = [];
    }
  } catch (err) {
    console.error('Error reading tenders.json:', err);
    allTendersCached = [];
  }
  return allTendersCached;
}

function getInvestorMatchKeywords(name) {
  if (!name) return [];
  const clean = name.toLowerCase()
    .replace(/trung tâm y tế/g, '')
    .replace(/bệnh viện đa khoa/g, '')
    .replace(/bệnh viện/g, '')
    .replace(/sở y tế/g, '')
    .replace(/phòng y tế/g, '')
    .replace(/trung tâm/g, '')
    .replace(/ttyt/g, '')
    .replace(/bvđk/g, '')
    .replace(/huyện/g, '')
    .replace(/thành phố/g, '')
    .replace(/tỉnh/g, '')
    .replace(/thị xã/g, '')
    .replace(/khu vực/g, '')
    .trim();
  
  return clean.split(' ').map(w => w.trim()).filter(w => w.length > 2);
}

function isSameInvestorFuzzy(inv1, inv2) {
  if (!inv1 || !inv2) return false;
  const kw1 = getInvestorMatchKeywords(inv1);
  const kw2 = getInvestorMatchKeywords(inv2);
  if (kw1.length === 0 || kw2.length === 0) {
    return inv1.toLowerCase().includes(inv2.toLowerCase()) || inv2.toLowerCase().includes(inv1.toLowerCase());
  }
  const str2 = inv2.toLowerCase();
  return kw1.every(k => str2.includes(k));
}

function getRegionNameAndKeywords(investor, location, name) {
  const combined = `${investor || ''} ${location || ''} ${name || ''}`.toLowerCase();
  
  // Gia Lai districts & cities
  const giaLaiKeywords = [
    'gia lai', 'pleiku', 'đức cơ', 'chư sê', 'chư prông', 'chư păh', 'chư phư', 
    'an khê', 'ayun pa', 'đak đoa', 'đak pơ', 'mang yang', 'kông chro', 
    'kbang', 'phú thiện', 'krông pa', 'ia pa', 'ia grai'
  ];
  if (giaLaiKeywords.some(kw => combined.includes(kw))) {
    return { name: 'Gia Lai', keywords: giaLaiKeywords };
  }
  
  // Bình Định districts & cities
  const binhDinhKeywords = [
    'bình định', 'quy nhơn', 'bồng sơn', 'hoài nhơn', 'an nhơn', 'tuy phước', 
    'phù cát', 'phù mỹ', 'hoài ân', 'tây sơn', 'vân canh', 'vĩnh thạnh', 'tam quan'
  ];
  if (binhDinhKeywords.some(kw => combined.includes(kw))) {
    return { name: 'Bình Định', keywords: binhDinhKeywords };
  }

  // Đắk Lắk
  const dakLakKeywords = ['đắk lắk', 'dak lak', 'buôn ma thuột', 'krông pắc', 'cư m\'gar', 'buôn hồ', 'ea h\'leo'];
  if (dakLakKeywords.some(kw => combined.includes(kw))) {
    return { name: 'Đắk Lắk', keywords: dakLakKeywords };
  }

  // Quảng Nam
  const quangNamKeywords = ['quảng nam', 'tam kỳ', 'hội an', 'điện bàn', 'đại lộc'];
  if (quangNamKeywords.some(kw => combined.includes(kw))) {
    return { name: 'Quảng Nam', keywords: quangNamKeywords };
  }

  // Hà Nội
  const haNoiKeywords = ['hà nội', 'hoàn kiếm', 'cầu giấy', 'đống đa', 'hai bà trưng', 'ba đình', 'thanh xuân'];
  if (haNoiKeywords.some(kw => combined.includes(kw))) {
    return { name: 'Hà Nội', keywords: haNoiKeywords };
  }

  // TP. Hồ Chí Minh
  const hcmKeywords = ['hồ chí minh', 'tphcm', 'sài gòn', 'thủ đức', 'quận 1', 'quận 3', 'quận 5', 'quận 10'];
  if (hcmKeywords.some(kw => combined.includes(kw))) {
    return { name: 'TP. Hồ Chí Minh', keywords: hcmKeywords };
  }

  const fallbackName = (location || investor || 'Địa phương').trim();
  return { name: fallbackName, keywords: [fallbackName.toLowerCase()] };
}

function getHistoricalContext(investor, category, currentNotifyNo, currentName, currentLocation) {
  const tenders = getAllTenders();
  const safeCategory = (category || '').toLowerCase().trim();
  
  // 1. Fuzzy match investor
  const sameInvestorTenders = tenders.filter(t => 
    t.investor && 
    t.notifyNo !== currentNotifyNo &&
    isSameInvestorFuzzy(investor, t.investor)
  );

  // 2. Regional match based on location keywords
  const regionInfo = getRegionNameAndKeywords(investor, currentLocation, currentName);
  const regionalTenders = tenders.filter(t => {
    if (t.notifyNo === currentNotifyNo) return false;
    
    let inRegion = false;
    if (regionInfo.keywords.length > 0) {
      const combinedT = `${t.investor || ''} ${t.location || ''} ${t.name || ''}`.toLowerCase();
      inRegion = regionInfo.keywords.some(kw => combinedT.includes(kw));
    } else {
      inRegion = true; // Overall national matching if region is undetermined
    }
    
    // Match same category
    return inRegion && t.category === category;
  });

  // Extract investor winners and participants
  const investorWinners = new Map();
  sameInvestorTenders.forEach(t => {
    if (t.winnerNames) {
      const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
      winners.forEach(w => {
        if (w) {
          const name = w.trim();
          investorWinners.set(name, (investorWinners.get(name) || 0) + 1);
        }
      });
    }
  });

  // Extract regional winners in this category
  const regionalWinners = new Map();
  regionalTenders.forEach(t => {
    if (t.winnerNames) {
      const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
      winners.forEach(w => {
        if (w) {
          const name = w.trim();
          regionalWinners.set(name, (regionalWinners.get(name) || 0) + 1);
        }
      });
    }
  });

  const topInvestorWinners = [...investorWinners.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name} (Trúng ${count} gói tại đơn vị này)`);

  const topRegionalWinners = [...regionalWinners.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name} (Trúng ${count} gói tương đương trên địa bàn)`);

  const investorHistory = sameInvestorTenders.slice(0, 4).map(t => {
    const formattedPrice = t.price ? Number(t.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa rõ';
    const winnerText = t.winnerNames ? (Array.isArray(t.winnerNames) ? t.winnerNames.join(', ') : t.winnerNames) : 'Chưa rõ/Đang thầu';
    return `- "${t.name}" (${formattedPrice}) -> Trúng thầu: ${winnerText}`;
  }).join('\n');

  const regionalHistory = regionalTenders.slice(0, 4).map(t => {
    const formattedPrice = t.price ? Number(t.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa rõ';
    const winnerText = t.winnerNames ? (Array.isArray(t.winnerNames) ? t.winnerNames.join(', ') : t.winnerNames) : 'Chưa rõ';
    return `- Tại ${t.investor}: "${t.name}" (${formattedPrice}) -> Trúng thầu: ${winnerText}`;
  }).join('\n');

  return {
    topInvestorWinners,
    topRegionalWinners,
    investorHistory,
    regionalHistory,
    sameInvestorCount: sameInvestorTenders.length,
    regionalCount: regionalTenders.length,
    regionName: regionInfo.name
  };
}

function buildCompetitorAnalysisFromDatabase(history, investor, category, location) {
  let likelyRivals = [];
  if (history.topInvestorWinners && history.topInvestorWinners.length > 0) {
    likelyRivals.push(...history.topInvestorWinners.map(item => `${item}`));
  }
  if (history.topRegionalWinners && history.topRegionalWinners.length > 0) {
    history.topRegionalWinners.forEach(item => {
      const nameOnly = item.split('(')[0].trim();
      const alreadyAdded = likelyRivals.some(r => r.includes(nameOnly));
      if (!alreadyAdded && likelyRivals.length < 4) {
        likelyRivals.push(`${item}`);
      }
    });
  }
  
  // If we still don't have enough competitors, query the entire database for this category's top active contractors
  if (likelyRivals.length < 2) {
    try {
      const tenders = getAllTenders();
      const categoryWinners = new Map();
      tenders.forEach(t => {
        if (t.category === category && t.winnerNames) {
          const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
          winners.forEach(w => {
            if (w) {
              const trimmed = w.trim();
              categoryWinners.set(trimmed, (categoryWinners.get(trimmed) || 0) + 1);
            }
          });
        }
      });
      const sortedCatWinners = [...categoryWinners.entries()].sort((a,b) => b[1]-a[1]).slice(0, 4);
      sortedCatWinners.forEach(([name, count]) => {
        const alreadyAdded = likelyRivals.some(r => r.includes(name));
        if (!alreadyAdded && likelyRivals.length < 4) {
          likelyRivals.push(`${name} (Top ${count} lần thắng thầu ngành ${category || 'Y tế'} toàn hệ thống)`);
        }
      });
    } catch (e) {
      console.error("Failed to query global category winners", e);
    }
  }

  const regionName = history.regionName || location || investor || 'địa phương';

  // Double check fallback if truly empty
  if (likelyRivals.length === 0) {
    likelyRivals = [
      `Các nhà thầu phân phối trang thiết bị y tế hoạt động mạnh tại khu vực ${regionName}.`,
      "Các đơn vị có giấy ủy quyền bán hàng chính hãng từ nhà sản xuất."
    ];
  }

  let hospitalHistorySummary = "";
  if (history.sameInvestorCount > 0) {
    hospitalHistorySummary = `Chủ đầu tư "${investor || 'Cơ sở y tế'}" có ${history.sameInvestorCount} gói thầu lịch sử trong cơ sở dữ liệu. `;
    if (history.topInvestorWinners && history.topInvestorWinners.length > 0) {
      const mainWinner = history.topInvestorWinners[0].split('(')[0].trim();
      hospitalHistorySummary += `Trong đó, nhà thầu "${mainWinner}" có tần suất trúng thầu cao nhất tại đơn vị này. Bạn cần đặc biệt lưu ý kiểm tra sự trùng khớp cấu hình thiết bị/vật tư của họ với các tiêu chuẩn trong e-HSMT để tránh bị định hướng kỹ thuật.`;
    } else {
      hospitalHistorySummary += `Các gói thầu lịch sử trước đây được phân chia cho nhiều đơn vị khác nhau, chưa có dấu hiệu độc quyền nhóm hay thiên vị rõ rệt.`;
    }
  } else {
    // Look at regional history of this sector
    if (history.regionalCount > 0 && history.topRegionalWinners && history.topRegionalWinners.length > 0) {
      const topReg = history.topRegionalWinners[0].split('(')[0].trim();
      hospitalHistorySummary = `Chủ đầu tư "${investor || 'Cơ sở y tế'}" chưa có nhiều gói thầu trực tiếp lưu trữ, nhưng tại khu vực ${regionName}, nhà thầu "${topReg}" là đối thủ hoạt động mạnh nhất với ${history.regionalCount} gói thầu cùng lĩnh vực. Cần đề xuất chuẩn bị phương án giá cạnh tranh cao để ứng phó với đối thủ này.`;
    } else {
      hospitalHistorySummary = `Chủ đầu tư "${investor || 'Cơ sở y tế'}" chưa có nhiều gói thầu lịch sử lưu trữ trực tiếp. Hãy đề xuất rà soát kỹ các tiêu chí kỹ thuật chi tiết của e-HSMT hiện tại để tránh cài cắm rào cản kỹ thuật từ đối thủ.`;
    }
  }

  let winStrategy = [];
  if (history.topInvestorWinners && history.topInvestorWinners.length > 0) {
    const mainWinner = history.topInvestorWinners[0].split('(')[0].trim();
    winStrategy.push(`Liên hệ ngay các hãng sản xuất thiết bị lớn để lấy cấu hình ưu việt nhất nhằm cạnh tranh trực tiếp và làm rõ HSMT chống lại cấu hình hẹp của "${mainWinner}".`);
    winStrategy.push(`Chuẩn bị hồ sơ pháp lý cực kỳ chặt chẽ (đặc biệt là kinh nghiệm tương tự và giấy ủy quyền bán hàng) vì chủ đầu tư có thói quen chấm thầu kỹ thuật rất nghiêm ngặt.`);
  } else if (history.topRegionalWinners && history.topRegionalWinners.length > 0) {
    const mainWinner = history.topRegionalWinners[0].split('(')[0].trim();
    winStrategy.push(`Tập trung tối ưu hóa đơn giá thầu vì đối thủ cạnh tranh lớn nhất khu vực "${mainWinner}" có ưu thế hậu cần và thâm nhập địa bàn sâu.`);
    winStrategy.push(`Hợp tác với các đại lý hoặc nhà phân phối ủy quyền để đảm bảo tiến độ cung cấp hàng hóa và xử lý bảo hành nhanh ngay tại ${regionName}.`);
  } else {
    winStrategy.push("Xây dựng giải pháp kỹ thuật tối ưu, bám sát các tiêu chuẩn chất lượng (ISO, FDA/CE, CFS) quy định trong e-HSMT.");
    winStrategy.push("Liên hệ hãng sản xuất để lấy thư ủy quyền bán hàng chính thức và cam kết thời gian cung ứng vật tư, linh kiện thay thế.");
  }

  return {
    likelyRivals,
    hospitalHistorySummary,
    winStrategy
  };
}

// Gemini client lazy initialization
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Quota circuit breaker to avoid cascading 429 errors
let quotaExceededUntil = 0;

function isQuotaTemporarilyExceeded() {
  return Date.now() < quotaExceededUntil;
}

function markQuotaExceeded() {
  quotaExceededUntil = Date.now() + 15 * 60 * 1000;
  console.log('Notice: Gemini API quota limit active. Using local AI analysis engine.');
}

// Fallback sequence for models in case of rate limits / quota issues
const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];

async function generateContentWithFallback(ai, requestConfig) {
  if (isQuotaTemporarilyExceeded()) {
    throw new Error('Gemini API quota temporarily exceeded (Circuit breaker active)');
  }

  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...requestConfig,
        model: model,
      });
      return { response, usedModel: model };
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        markQuotaExceeded();
        throw err;
      }
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini candidate models failed');
}

function getTenderDetailData(notifyNo) {
  if (!notifyNo) return null;
  const detailFilePath = path.join(__dirname, 'data', 'details', `${notifyNo}.json`);
  try {
    if (fs.existsSync(detailFilePath)) {
      const content = fs.readFileSync(detailFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(`Error reading detail file for ${notifyNo}:`, e.message);
  }
  return null;
}

// Helper to generate rich fallback for any tender object
function createFallbackForTender(tender) {
  if (!tender) return {};
  const notifyNo = tender.notifyNo || '';
  const detailData = getTenderDetailData(notifyNo);
  
  const formattedPrice = tender.price ? Number(tender.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố';
  const winnerText = tender.winnerNames ? (Array.isArray(tender.winnerNames) ? tender.winnerNames.join('; ') : tender.winnerNames) : '';
  
  const regionInfo = getRegionNameAndKeywords(tender.investor, tender.location, tender.name);
  const locationDisplay = tender.location 
    ? (regionInfo.name && regionInfo.name !== 'Toàn quốc' && !tender.location.includes(regionInfo.name) ? `${tender.location}, ${regionInfo.name}` : tender.location)
    : (regionInfo.name || tender.investor || 'Cơ sở y tế');

  let primaryEquipmentText = '';
  let detailItemsList = [];

  if (detailData) {
    const rawItems = detailData.items || detailData.technicalRequirements?.items || detailData.requirements?.items || [];
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      detailItemsList = rawItems;
      const topItems = rawItems.slice(0, 3).map(it => {
        let str = it.name || '';
        if (it.model && it.model !== 'Nhiều kích cỡ / dải thông số' && it.model !== 'Đa dạng chủng loại') {
          str += ` (Model: ${it.model})`;
        }
        if (it.quantity) {
          str += ` - ${Number(it.quantity).toLocaleString('vi-VN')} ${it.unit || 'cái/bộ'}`;
        }
        return str;
      });
      primaryEquipmentText = topItems.join('; ');
      if (rawItems.length > 3) {
        primaryEquipmentText += ` (và ${rawItems.length - 3} mặt hàng khác trong e-HSMT)`;
      }
    }
  }

  if (!primaryEquipmentText) {
    let cleanedName = (tender.name || '')
      .replace(/^gói thầu( số \d+)?[:\s]*/i, '')
      .replace(/^mua sắm\s*/i, '')
      .replace(/\s*năm \d{4}.*/i, '')
      .replace(/\s*tại .*/i, '')
      .trim();
    primaryEquipmentText = cleanedName 
      ? `Danh mục ${cleanedName} (Phục vụ khám chữa bệnh tại ${tender.investor || 'Cơ sở y tế'})`
      : `Trang thiết bị & vật tư y tế thuộc gói thầu ${notifyNo}`;
  }

  const points = [
    `🏦 Bên mời thầu: ${tender.investor || 'Cơ sở y tế'} (${locationDisplay})`,
    `💰 Giá gói thầu / Dự toán: ${formattedPrice}`,
    `📑 Phân loại & Hình thức: ${tender.category || 'Thiết bị y tế'} (${tender.bidForm === 'CHCT' ? 'Chào hàng cạnh tranh' : 'Đấu thầu qua mạng'})`,
    `📦 Danh mục e-HSMT: ${primaryEquipmentText}`,
    `⏱️ Hạn đóng thầu: ${tender.closeDate ? tender.closeDate.replace('T', ' ').slice(0, 16) : 'Chưa công bố'}`
  ];
  if (winnerText) {
    points.push(`🏆 Kết quả trúng thầu: ${winnerText}`);
  }

  const hist = getHistoricalContext(tender.investor, tender.category, tender.notifyNo, tender.name, tender.location);
  const compAnalysis = buildCompetitorAnalysisFromDatabase(hist, tender.investor, tender.category, tender.location);

  const locName = regionInfo.name !== 'Toàn quốc' ? regionInfo.name : locationDisplay;

  return {
    summary: `Gói thầu "${tender.name}" do ${tender.investor || 'Chủ đầu tư'} mời thầu tại ${locationDisplay}, quy mô dự toán ${formattedPrice}.`,
    score: hist.sameInvestorCount > 0 ? 82 : 70,
    successChance: hist.topInvestorWinners.length > 0 ? 32 : 45,
    suitabilityMetrics: {
      phapLy: 85,
      kyThuat: detailItemsList.length > 0 ? 88 : 75,
      thuongMai: 75,
      tienDo: 80,
      diaBan: 80,
      lienKet: 70
    },
    primaryEquipment: primaryEquipmentText,
    strengths: [
      `Dự toán công khai ${formattedPrice}, hình thức ${tender.bidForm === 'CHCT' ? 'Chào hàng cạnh tranh' : 'Đấu thầu qua mạng'} đảm bảo tính minh bạch.`,
      `Công khai rõ yêu cầu cấu hình & nhu cầu trang thiết bị tại ${tender.investor || locName}.`
    ],
    gaps: [
      `Cần đối chiếu kỹ tiêu chuẩn kỹ thuật e-HSMT cho các mặt hàng chính (${primaryEquipmentText.slice(0, 45)}...).`,
      `Cần rà soát điều khoản bảo hành, bảo trì và tiến độ thanh toán trong hợp đồng mẫu.`
    ],
    risks: [
      `Mức độ cạnh tranh từ các nhà thầu phân phối có ưu thế hậu cần tại địa bàn ${locName}.`,
      `Yêu cầu nghiêm ngặt về chứng nhận ISO, CFS/FDA/CE và thư ủy quyền bán hàng từ hãng sản xuất.`
    ],
    requiredPartners: [
      `Hãng sản xuất hoặc đại lý phân phối ủy quyền chính thức nhóm ngành ${tender.category || 'thiết bị y tế'}.`
    ],
    actionItems: [
      `Tải toàn bộ tệp e-HSMT chính thức từ Cổng Mua sắm công để kiểm tra tiêu chuẩn Đạt/Không đạt.`,
      `Liên hệ hãng sản xuất xin thư ủy quyền phân phối và báo giá ưu đãi dự thầu.`
    ],
    keyPoints: points,
    aiAssessment: `Gói thầu do ${tender.investor || 'Bên mời thầu'} thực hiện tại ${locationDisplay} với quy mô ${formattedPrice}. Cơ sở dữ liệu ghi nhận ${hist.sameInvestorCount} gói thầu lịch sử cùng đơn vị này. Nhà thầu tham gia cần làm rõ các tiêu chí kỹ thuật trong e-HSMT và chuẩn bị đầy đủ thư ủy quyền chính hãng để đảm bảo khả năng trúng thầu cao nhất.`,
    officialUrl: tender.sourceUrl || 'https://muasamcong.mpi.gov.vn/',
    competitorAnalysis: compAnalysis,
    isFallback: true
  };
}

const CACHE_FILE_PATH = path.join(__dirname, 'data', 'summaries_cache.json');

// Memory cache for summaries
const summaryCache = new Map();

function saveAllToDiskCache() {
  try {
    const obj = {};
    for (const [k, v] of summaryCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write summary cache to disk:', err);
  }
}

// Load cache from disk on startup & pre-populate disk cache for all database tenders
function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const content = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const data = JSON.parse(content);
      Object.entries(data).forEach(([key, val]) => {
        // Only load real AI results into cache, purge outdated fallbacks
        if (val && !val.isFallback) {
          summaryCache.set(key, val);
        }
      });
      console.log(`Loaded ${summaryCache.size} real AI cached summaries from disk cache.`);
    } else {
      console.log('No persistent disk cache file found. Initializing new cache.');
    }
  } catch (err) {
    console.error('Failed to load summary cache from disk:', err);
  }

  try {
    const tenders = getAllTenders();
    let newItemsAdded = 0;
    for (const tender of tenders) {
      if (tender.notifyNo && !summaryCache.has(tender.notifyNo)) {
        const fallbackData = createFallbackForTender(tender);
        summaryCache.set(tender.notifyNo, fallbackData);
        newItemsAdded++;
      }
    }
    if (newItemsAdded > 0) {
      console.log(`Pre-populated ${newItemsAdded} tender summaries into persistent disk cache.`);
      saveAllToDiskCache();
    }
  } catch (err) {
    console.error('Error pre-calculating tender summaries:', err);
  }
}

// Initialize on load
loadCacheFromDisk();

// Helper to save single entry cache to disk
function saveToDiskCache(notifyNo, data) {
  summaryCache.set(notifyNo, data);
  saveAllToDiskCache();
}

app.post('/api/summarize-tender', async (req, res) => {
  try {
    const {
      notifyNo,
      name,
      investor,
      location,
      price,
      category,
      status,
      closeDate,
      winnerNames,
      equipmentSummary,
      bidForm,
      processApply,
      publicDate,
      winningPrice,
      participantNames,
      loserNames,
      sourceUrl
    } = req.body;

    if (!notifyNo) {
      return res.status(400).json({ error: 'Mã TBMT không được để trống' });
    }

    if (summaryCache.has(notifyNo)) {
      let cachedData = summaryCache.get(notifyNo);
      if (!cachedData.competitorAnalysis || !cachedData.competitorAnalysis.likelyRivals || cachedData.competitorAnalysis.likelyRivals.length === 0 || cachedData.competitorAnalysis.likelyRivals.some(r => r.includes('hoạt động mạnh tại khu vực'))) {
        const history = getHistoricalContext(investor, category, notifyNo, name, location);
        cachedData.competitorAnalysis = buildCompetitorAnalysisFromDatabase(history, investor, category, location);
        saveToDiskCache(notifyNo, cachedData);
      }
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Query historical database early for competitor analysis & statistics
    const history = getHistoricalContext(investor, category, notifyNo, name, location);
    const databaseCompetitorAnalysis = buildCompetitorAnalysisFromDatabase(history, investor, category, location);

    const ai = getGeminiClient();
    if (!ai || isQuotaTemporarilyExceeded()) {
      const fallbackData = createFallbackForTender(req.body);
      saveToDiskCache(notifyNo, fallbackData);
      return res.json({ success: true, data: fallbackData });
    }

    const promptText = `Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam cấp cao, am hiểu sâu sắc Luật Đấu thầu số 22/2023/QH15 và Nghị định số 24/2024/NĐ-CP. Hãy thực hiện phân tích chuyên sâu đa chiều VÀ TÓM TẮT CHI TIẾT HỒ SƠ GÓI THẦU dưới đây dành cho các hãng sản xuất, nhà thầu phân phối và cơ sở y tế:

[THÔNG TIN HỒ SƠ GÓI THẦU HIỆN TẠI]
- Mã TBMT: ${notifyNo}
- Tên gói thầu: ${name}
- Bên mời thầu / Chủ đầu tư: ${investor}
- Địa điểm thực hiện: ${location}
- Giá gói thầu / Giá dự toán: ${price ? Number(price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố'}
- Lĩnh vực / Danh mục: ${category}
- Trạng thái hiện tại: ${status}
- Hình thức LCNT: ${bidForm || 'Theo quy định'} (${processApply || 'Đấu thầu qua mạng'})
- Ngày đăng tải TBMT: ${publicDate || 'Chưa rõ'}
- Thời điểm đóng/mở thầu: ${closeDate || 'Chưa công bố'}
- Đã có kết quả: ${winnerNames ? 'Đã có' : 'Chưa'}
${winnerNames ? `- Nhà thầu trúng thầu: ${winnerNames}` : ''}
${winningPrice ? `- Giá trúng thầu: ${Number(winningPrice).toLocaleString('vi-VN')} VNĐ` : ''}
${participantNames ? `- Nhà thầu tham gia: ${participantNames}` : ''}
${loserNames ? `- Nhà thầu không trúng thầu: ${loserNames}` : ''}
${equipmentSummary ? `- Chi tiết danh mục thiết bị/vật tư/mặt hàng e-HSMT: ${equipmentSummary}` : ''}
- Nguồn hồ sơ công khai gốc: ${sourceUrl || 'https://muasamcong.mpi.gov.vn/'}

[CƠ SỞ DỮ LIỆU ĐẤU THẦU LỊCH SỬ & ĐỐI THỦ CẠNH TRANH]
Chúng tôi đã truy vấn cơ sở dữ liệu các gói thầu y tế đã diễn ra trên hệ thống và trích xuất các thông tin lịch sử của Chủ đầu tư này cũng như trên địa bàn liên quan:
1. Số lượng gói thầu lịch sử của Chủ đầu tư này (${investor}): ${history.sameInvestorCount} gói thầu.
2. Các nhà thầu trúng thầu nhiều nhất tại Chủ đầu tư này gần đây:
${history.topInvestorWinners.length > 0 ? history.topInvestorWinners.map(w => '   + ' + w).join('\n') : '   + Chưa ghi nhận nhà thầu trúng thầu lặp lại nổi bật.'}
3. Danh sách các gói thầu tương tự đã đấu gần nhất của Chủ đầu tư này:
${history.investorHistory ? history.investorHistory : '   + Không có gói thầu lịch sử tương tự trực tiếp.'}

4. Số lượng gói thầu tương đương cùng phân nhóm y tế trên địa bàn (Khu vực Gia Lai/lân cận): ${history.regionalCount} gói thầu.
5. Các nhà thầu trúng thầu nhiều nhất đối với mặt hàng tương tự trên địa bàn:
${history.topRegionalWinners.length > 0 ? history.topRegionalWinners.map(w => '   + ' + w).join('\n') : '   + Chưa ghi nhận nhà thầu trúng thầu thống lĩnh địa bàn.'}
6. Danh sách các gói thầu tương đương tiêu biểu khác trong khu vực:
${history.regionalHistory ? history.regionalHistory : '   + Chưa ghi nhận tiền lệ tương tự trên địa bàn.'}

Yêu cầu phân tích chi tiết & trả về định dạng JSON có đầy đủ các trường sau:
1. "summary": Tóm tắt tổng quan 2-3 câu thể hiện rõ bối cảnh lâm sàng của cơ sở mời thầu, quy mô tài chính và định hướng chiến lược.
2. "score": Số nguyên từ 0 đến 100 biểu thị điểm số đánh giá sơ bộ mức độ phù hợp toàn diện của hồ sơ thầu đối với nhà thầu tiềm năng (phản ánh độ khả thi, độ hoàn thiện thông tin, mức độ ưu thế kỹ thuật). Hãy điều chỉnh điểm số dựa trên mức độ cạnh tranh lịch sử của các đối thủ sừng sỏ đã từng trúng thầu ở đây.
3. "successChance": Số nguyên từ 0 đến 100 biểu thị tỉ lệ phần trăm khả năng thành công/trúng thầu ước tính cho một nhà thầu mới có năng lực phù hợp. ĐẶC BIỆT chú ý giảm tỉ lệ nếu lịch sử cho thấy có nhà thầu thống trị (như có nhà thầu trúng nhiều gói liên tiếp tại đơn vị này).
4. "suitabilityMetrics": Đối tượng chứa 6 chỉ số thành phần (mỗi chỉ số từ 0 đến 100): "phapLy", "kyThuat", "thuongMai", "tienDo", "diaBan", "lienKet".
5. "primaryEquipment": Chuỗi văn bản nêu rõ tên thiết bị/vật tư chủ đạo, cốt lõi có giá trị lâm sàng cao nhất, đóng vai trò "sản phẩm mỏ neo" của gói thầu (TUYỆT ĐỐI KHÔNG ghi mã số model vô nghĩa).
6. "strengths": Mảng chứa 2-3 chuỗi là các điểm mạnh cốt lõi nổi bật nhất của gói thầu này.
7. "gaps": Mảng chứa 2-3 chuỗi là các khoảng trống/điểm mập mờ trong hồ sơ thầu cần rà soát làm rõ.
8. "risks": Mảng chứa 2-3 chuỗi là các rủi ro chính đối với nhà thầu tham gia thầu (CẦN chỉ rõ các rủi ro đối thủ cạnh tranh truyền thống đã trúng thầu lịch sử tại đây, hoặc các đối thủ sừng sỏ có thói quen thâu tóm gói thầu của đơn vị sử dụng này).
9. "requiredPartners": Mảng chứa 1-2 chuỗi là loại đối tác hoặc hãng sản xuất cần có ủy quyền/hợp tác để thắng thầu.
10. "actionItems": Mảng chứa 2-3 chuỗi là các việc trọng yếu cần thực hiện ngay trong vòng 24 đến 72 giờ.
11. "keyPoints": Mảng 6-7 chuỗi điểm tóm tắt nhanh truyền thống.
12. "aiAssessment": Đánh giá chuyên sâu độc lập 3-4 câu phân tích rào cản e-HSMT, định hướng độc quyền thương hiệu, phân tích cụ thể thói quen chọn thầu của Chủ đầu tư này dựa trên dữ liệu lịch sử thầu vừa cung cấp ở trên, khả năng có "nhà thầu quen thuộc", biên lợi nhuận tiềm năng và cơ hội vật tư tiêu hao khép kín (mô hình Razor-and-Blade).
13. "officialUrl": Link nguồn hồ sơ gốc.
14. "competitorAnalysis": Đối tượng chứa các phân tích cụ thể về đối thủ và cơ sở dữ liệu đấu thầu lịch sử:
    - "likelyRivals": Mảng chứa 2-3 chuỗi chỉ rõ tên các đối thủ có khả năng cạnh tranh trực tiếp nhất (trích từ dữ liệu trúng thầu lịch sử ở trên) kèm lý do vì sao họ mạnh tại địa bàn này hoặc đơn vị này.
    - "hospitalHistorySummary": Chuỗi nhận định về lịch sử đấu thầu gần đây của đơn vị sử dụng (ví dụ: mức độ cởi mở của hồ sơ, tần suất đấu thầu, hay thói quen ưu tiên các nhà thầu địa phương hoặc hãng lớn).
    - "winStrategy": Mảng chứa 2-3 chuỗi gợi ý giải pháp chiến thuật cụ thể để bẻ gãy thế độc quyền hoặc đối đầu sòng phẳng với các đối thủ quen thuộc của chủ đầu tư này.

Yêu cầu trả về thông tin dưới dạng JSON có đầy đủ các trường trên. KHÔNG ĐƯỢC trả về bất kỳ văn bản nào khác ngoài JSON.`;

    const { response, usedModel } = await generateContentWithFallback(ai, {
      contents: promptText,
      config: {
        systemInstruction: 'Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam cấp cao. Trả về thông tin phân tích thầu chuyên sâu đa chiều dưới định dạng JSON có đầy đủ 14 trường yêu cầu, loại bỏ các mã model vô nghĩa.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            score: { type: Type.INTEGER },
            successChance: { type: Type.INTEGER },
            suitabilityMetrics: {
              type: Type.OBJECT,
              properties: {
                phapLy: { type: Type.INTEGER },
                kyThuat: { type: Type.INTEGER },
                thuongMai: { type: Type.INTEGER },
                tienDo: { type: Type.INTEGER },
                diaBan: { type: Type.INTEGER },
                lienKet: { type: Type.INTEGER }
              },
              required: ['phapLy', 'kyThuat', 'thuongMai', 'tienDo', 'diaBan', 'lienKet']
            },
            primaryEquipment: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            requiredPartners: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            aiAssessment: { type: Type.STRING },
            officialUrl: { type: Type.STRING },
            competitorAnalysis: {
              type: Type.OBJECT,
              properties: {
                likelyRivals: { type: Type.ARRAY, items: { type: Type.STRING } },
                hospitalHistorySummary: { type: Type.STRING },
                winStrategy: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['likelyRivals', 'hospitalHistorySummary', 'winStrategy']
            }
          },
          required: [
            'summary', 'score', 'successChance', 'suitabilityMetrics',
            'primaryEquipment', 'strengths', 'gaps', 'risks',
            'requiredPartners', 'actionItems', 'keyPoints', 'aiAssessment', 'officialUrl',
            'competitorAnalysis'
          ]
        }
      }
    });

    let resultText = response.text;
    let data;
    try {
      data = JSON.parse(resultText);
    } catch (e) {
      data = {
        summary: resultText,
        score: 65,
        successChance: 38,
        suitabilityMetrics: { phapLy: 50, kyThuat: 55, thuongMai: 45, tienDo: 50, diaBan: 50, lienKet: 45 },
        primaryEquipment: equipmentSummary || "Chưa đủ dữ liệu để xác định thiết bị chủ đạo.",
        strengths: ["Thông tin dự toán công khai rõ ràng.", "Địa bàn mời thầu tập trung."],
        gaps: ["Cần rà soát kỹ các tiêu chuẩn kỹ thuật e-HSMT.", "Chưa làm rõ điều kiện thanh toán."],
        risks: ["Cạnh tranh cao từ các nhà phân phối cùng phân khúc."],
        requiredPartners: ["Hãng sản xuất hoặc đại lý ủy quyền hợp pháp."],
        actionItems: ["Tải file e-HSMT chính thức.", "Liên hệ hãng sản xuất lấy báo giá."],
        keyPoints: [`Gói thầu: ${name}`, `Chủ đầu tư: ${investor}`],
        aiAssessment: 'Phân tích tự động từ AI Gemini.',
        officialUrl: sourceUrl || 'https://muasamcong.mpi.gov.vn/',
        competitorAnalysis: databaseCompetitorAnalysis
      };
    }

    saveToDiskCache(notifyNo, data);
    return res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('Gemini summarize error:', error);
    
    const fallbackData = createFallbackForTender(req.body);
    saveToDiskCache(req.body.notifyNo, fallbackData);
    return res.json({ success: true, data: fallbackData, cached: false });
  }
});

app.post('/api/batch-summarize-tenders', async (req, res) => {
  try {
    const { tenders } = req.body;
    if (!Array.isArray(tenders) || tenders.length === 0) {
      return res.json({ success: true, summaries: {} });
    }

    const summaries = {};
    const missingTenders = [];

    // Check cache first
    for (const tender of tenders) {
      if (!tender.notifyNo) continue;
      if (summaryCache.has(tender.notifyNo)) {
        let cachedData = summaryCache.get(tender.notifyNo);
        if (!cachedData.competitorAnalysis || !cachedData.competitorAnalysis.likelyRivals || cachedData.competitorAnalysis.likelyRivals.length === 0 || cachedData.competitorAnalysis.likelyRivals.some(r => r.includes('hoạt động mạnh tại khu vực'))) {
          const history = getHistoricalContext(tender.investor, tender.category, tender.notifyNo, tender.name, tender.location);
          cachedData.competitorAnalysis = buildCompetitorAnalysisFromDatabase(history, tender.investor, tender.category, tender.location);
          saveToDiskCache(tender.notifyNo, cachedData);
        }
        summaries[tender.notifyNo] = cachedData;
      } else {
        missingTenders.push(tender);
      }
    }

    if (missingTenders.length === 0) {
      return res.json({ success: true, summaries, cachedAll: true });
    }

    const ai = getGeminiClient();

    // If no API key or circuit breaker active, populate intelligent fallbacks immediately
    if (!ai || isQuotaTemporarilyExceeded()) {
      for (const tender of missingTenders) {
        const fallbackData = createFallbackForTender(tender);
        saveToDiskCache(tender.notifyNo, fallbackData);
        summaries[tender.notifyNo] = fallbackData;
      }
      return res.json({ success: true, summaries, isFallback: true });
    }

    // Process missing tenders in batch using Gemini
    const batchPrompt = missingTenders.map((t, idx) => `
[GÓI THẦU #${idx + 1}]
- Mã TBMT: ${t.notifyNo}
- Tên: ${t.name}
- Chủ đầu tư: ${t.investor}
- Địa điểm: ${t.location}
- Ngân sách: ${t.price ? Number(t.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố'}
- Danh mục: ${t.category}
- Trạng thái: ${t.status}
- Đóng thầu: ${t.closeDate || 'Chưa công bố'}
${t.winnerNames ? `- Đơn vị trúng: ${t.winnerNames}` : ''}
${t.equipmentSummary ? `- Danh mục thiết bị chính: ${t.equipmentSummary}` : ''}
- Nguồn hồ sơ gốc: ${t.sourceUrl || 'https://muasamcong.mpi.gov.vn/'}
`).join('\n---');

    const promptText = `Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam cấp cao, am hiểu sâu sắc Luật Đấu thầu số 22/2023/QH15 và Nghị định số 24/2024/NĐ-CP. Hãy phân tích chuyên sâu & tóm tắt CHI TIẾT ĐẦY ĐỦ cho từng gói thầu dưới đây để định hướng thầu chiến lược cho các nhà phân phối và hãng sản xuất.

Danh sách ${missingTenders.length} gói thầu:
${batchPrompt}

Yêu cầu trả về mảng kết quả JSON tương ứng theo đúng thứ tự các gói thầu:
- "notifyNo": Mã TBMT của gói thầu
- "summary": Tóm tắt tổng quan chi tiết 2-3 câu ngắn gọn thể hiện bối cảnh lâm sàng của cơ sở mời thầu, quy mô tài chính và định hướng chiến lược.
- "score": Số nguyên từ 0 đến 100 biểu thị điểm số đánh giá sơ bộ mức độ phù hợp toàn diện.
- "successChance": Số nguyên từ 0 đến 100 biểu thị tỉ lệ phần trăm khả năng thành công/trúng thầu ước tính.
- "suitabilityMetrics": Đối tượng chứa 6 chỉ số thành phần (mỗi chỉ số từ 0 đến 100): "phapLy", "kyThuat", "thuongMai", "tienDo", "diaBan", "lienKet".
- "primaryEquipment": Chuỗi nêu rõ thiết bị chủ đạo, cốt lõi (TUYỆT ĐỐI KHÔNG ghi mã số model vô nghĩa).
- "strengths": Mảng chứa 2-3 chuỗi điểm mạnh.
- "gaps": Mảng chứa 2-3 chuỗi khoảng trống hồ sơ.
- "risks": Mảng chứa 2-3 chuỗi rủi ro.
- "requiredPartners": Mảng chứa 1-2 chuỗi đối tác cần có.
- "actionItems": Mảng chứa 2-3 chuỗi việc cần làm ngay.
- "keyPoints": Mảng 6-7 chuỗi tóm tắt nhanh truyền thống.
- "aiAssessment": Đánh giá chuyên sâu độc lập 3-4 câu.
- "officialUrl": Đường dẫn hồ sơ gốc công khai.
`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, {
        contents: promptText,
        config: {
          systemInstruction: 'Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam xuất sắc. Hãy trả về JSON array phân tích sâu sắc dưới góc nhìn luật thầu, phân nhóm kỹ thuật lâm sàng và thương mại, tuyệt đối loại bỏ các chuỗi mã số vô nghĩa.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                notifyNo: { type: Type.STRING },
                summary: { type: Type.STRING },
                score: { type: Type.INTEGER },
                successChance: { type: Type.INTEGER },
                suitabilityMetrics: {
                  type: Type.OBJECT,
                  properties: {
                    phapLy: { type: Type.INTEGER },
                    kyThuat: { type: Type.INTEGER },
                    thuongMai: { type: Type.INTEGER },
                    tienDo: { type: Type.INTEGER },
                    diaBan: { type: Type.INTEGER },
                    lienKet: { type: Type.INTEGER }
                  },
                  required: ['phapLy', 'kyThuat', 'thuongMai', 'tienDo', 'diaBan', 'lienKet']
                },
                primaryEquipment: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                requiredPartners: { type: Type.ARRAY, items: { type: Type.STRING } },
                actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                aiAssessment: { type: Type.STRING },
                officialUrl: { type: Type.STRING }
              },
              required: [
                'notifyNo', 'summary', 'score', 'successChance', 'suitabilityMetrics',
                'primaryEquipment', 'strengths', 'gaps', 'risks', 'requiredPartners',
                'actionItems', 'keyPoints', 'aiAssessment'
              ]
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '[]');
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.notifyNo) {
            const sumData = {
              summary: item.summary,
              score: item.score || 60,
              successChance: item.successChance || 35,
              suitabilityMetrics: item.suitabilityMetrics || { phapLy: 50, kyThuat: 50, thuongMai: 45, tienDo: 50, diaBan: 50, lienKet: 45 },
              primaryEquipment: item.primaryEquipment || "Chưa rõ thiết bị chủ đạo",
              strengths: item.strengths || [],
              gaps: item.gaps || [],
              risks: item.risks || [],
              requiredPartners: item.requiredPartners || [],
              actionItems: item.actionItems || [],
              keyPoints: item.keyPoints,
              aiAssessment: item.aiAssessment,
              officialUrl: item.officialUrl || 'https://muasamcong.mpi.gov.vn/'
            };
            saveToDiskCache(item.notifyNo, sumData);
            summaries[item.notifyNo] = sumData;
          }
        }
      }
    } catch (batchErr) {
      console.error('Batch AI summarize error, falling back to rich details:', batchErr);
    }

        // Ensure any missing items in batch receive a fallback so clients never hang
    for (const tender of missingTenders) {
      if (!summaries[tender.notifyNo]) {
        const fallbackData = createFallbackForTender(tender);
        saveToDiskCache(tender.notifyNo, fallbackData);
        summaries[tender.notifyNo] = fallbackData;
      }
    }

    return res.json({ success: true, summaries });
  } catch (error) {
    console.error('Batch summarize error:', error);
    return res.status(500).json({ error: 'Lỗi xử lý hàng loạt: ' + error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

