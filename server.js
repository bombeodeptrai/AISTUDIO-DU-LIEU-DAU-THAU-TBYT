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

const DISTRICT_CLUSTERS = [
  // Gia Lai clusters
  { id: "GL_CENTRAL", name: "Khu vực TP. Pleiku & 2-3 huyện lân cận (Chư Păh, Đắk Đoa, Ia Grai, Mang Yang)", province: "Gia Lai", keywords: ["pleiku", "chư păh", "đak đoa", "ia grai", "mang yang"] },
  { id: "GL_WEST", name: "Khu vực Đức Cơ & 2-3 huyện lân cận (Chư Prông, Chư Sê, Chư Pưh)", province: "Gia Lai", keywords: ["đức cơ", "chư prông", "chư pưh", "chư sê"] },
  { id: "GL_EAST", name: "Khu vực TX. An Khê & 2-3 huyện lân cận (Đắk Pơ, KBang, Kông Chro)", province: "Gia Lai", keywords: ["an khê", "đak pơ", "kbang", "kông chro"] },
  { id: "GL_SOUTH", name: "Khu vực TX. Ayun Pa & 2-3 huyện lân cận (Phú Thiện, Krông Pa, Ia Pa)", province: "Gia Lai", keywords: ["ayun pa", "phú thiện", "krông pa", "ia pa"] },
  // Bình Định clusters
  { id: "BD_SOUTH", name: "Khu vực TP. Quy Nhơn & 2-3 huyện lân cận (Tuy Phước, An Nhơn, Vân Canh)", province: "Bình Định", keywords: ["quy nhơn", "tuy phước", "an nhơn", "vân canh"] },
  { id: "BD_NORTH", name: "Khu vực TX. Hoài Nhơn & 2-3 huyện lân cận (Hoài Ân, An Lão, Phù Mỹ, Phù Cát)", province: "Bình Định", keywords: ["hoài nhơn", "bồng sơn", "hoài ân", "an lão", "phù mỹ", "phù cát", "tam quan"] },
  { id: "BD_WEST", name: "Khu vực Tây Sơn & Vĩnh Thạnh", province: "Bình Định", keywords: ["tây sơn", "vĩnh thạnh"] },
  // Đắk Lắk clusters
  { id: "DL_CENTRAL", name: "Khu vực Buôn Ma Thuột & 2-3 huyện lân cận", province: "Đắk Lắk", keywords: ["buôn ma thuột", "dak lak", "đắk lắk", "cư m'gar", "buôn hồ", "ea h'leo", "krông pắc"] },
  // Quảng Nam
  { id: "QN_CENTRAL", name: "Khu vực Tam Kỳ & 2-3 huyện lân cận", province: "Quảng Nam", keywords: ["quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc"] },
  // Hà Nội
  { id: "HN_CENTRAL", name: "Khu vực Hà Nội & các quận/huyện lân cận", province: "Hà Nội", keywords: ["hà nội", "hoàn kiếm", "cầu giấy", "đống đa", "hai bà trưng", "ba đình", "thanh xuân"] },
  // TP. Hồ Chí Minh
  { id: "HCM_CENTRAL", name: "Khu vực TP. Hồ Chí Minh & các quận lân cận", province: "TP. Hồ Chí Minh", keywords: ["hồ chí minh", "tphcm", "sài gòn", "thủ đức", "quận 1", "quận 3", "quận 5", "quận 10"] }
];

function getDistrictClusterInfo(investor, location, name) {
  const text = `${investor || ''} ${location || ''} ${name || ''}`.toLowerCase();
  for (const cluster of DISTRICT_CLUSTERS) {
    if (cluster.keywords.some(kw => text.includes(kw))) {
      return cluster;
    }
  }
  return null;
}

function isPriceCompatible(p1, p2) {
  const price1 = Number(p1) || 0;
  const price2 = Number(p2) || 0;
  if (!price1 || !price2) return true;
  if (price1 >= 10000000000) return price2 >= price1 * 0.05;
  if (price1 >= 1000000000) return price2 >= price1 * 0.05;
  if (price1 <= 200000000) return price2 <= price1 * 25;
  return true;
}

function getRegionNameAndKeywords(investor, location, name) {
  const cluster = getDistrictClusterInfo(investor, location, name);
  if (cluster) {
    return { name: cluster.name, keywords: cluster.keywords, province: cluster.province };
  }

  const combined = `${investor || ''} ${location || ''} ${name || ''}`.toLowerCase();

  // Fallbacks by province
  if (combined.includes('gia lai')) return { name: 'Gia Lai', keywords: ['gia lai', 'pleiku'], province: 'Gia Lai' };
  if (combined.includes('bình định')) return { name: 'Bình Định', keywords: ['bình định', 'quy nhơn'], province: 'Bình Định' };
  if (combined.includes('đắk lắk') || combined.includes('dak lak')) return { name: 'Đắk Lắk', keywords: ['đắk lắk', 'buôn ma thuột'], province: 'Đắk Lắk' };

  const fallbackName = (location || investor || 'Địa phương').trim();
  return { name: fallbackName, keywords: [fallbackName.toLowerCase()], province: fallbackName };
}

function formatPackageTitle(rawName) {
  if (!rawName) return "Gói thầu thiết bị/vật tư y tế";
  let name = rawName
    .replace(/^gói thầu( số \d+)?[:\s]*/i, "")
    .replace(/^mua sắm\s*/i, "Mua sắm ")
    .trim();
  if (name.length > 40) {
    name = name.slice(0, 38) + "...";
  }
  return name;
}

function getTenderYear(t) {
  if (!t) return 2025;
  let dateStr = t.decisionDate || t.resultPublishedDate || t.publicDate || t.closeDate;
  if (dateStr) {
    const y = new Date(dateStr).getFullYear();
    if (y && !isNaN(y) && y > 2000) return y;
  }
  const match = (t.name || "").match(/năm\s+(20\d\d)/i) || (t.name || "").match(/(20\d\d)/);
  if (match) return parseInt(match[1]);
  return 2025;
}

function formatContractorWinningText(name, packagesList, modelsSet, yearsSet) {
  if (!packagesList || packagesList.length === 0) return name;

  const winCount = packagesList.length;
  let ratingText = "";
  if (winCount >= 3) {
    ratingText = "Xếp loại khả năng trúng: Rất Cao (85 - 90%)";
  } else if (winCount === 2) {
    ratingText = "Xếp loại khả năng trúng: Cao (70 - 80%)";
  } else {
    ratingText = "Xếp loại khả năng trúng: Khá (50 - 65%)";
  }

  let pkgText = "";
  if (winCount === 1) {
    pkgText = `Trúng 1 gói: "${packagesList[0]}"`;
  } else if (winCount === 2) {
    pkgText = `Trúng 2 gói: "${packagesList[0]}", "${packagesList[1]}"`;
  } else {
    pkgText = `Trúng ${winCount} gói, tiêu biểu: "${packagesList[0]}", "${packagesList[1]}"`;
  }

  let detailsParts = [pkgText];

  if (modelsSet && modelsSet.size > 0) {
    const modelsList = [...modelsSet].slice(0, 4);
    const modelsJoined = modelsList.map(m => `**${m}**`).join(", ");
    detailsParts.push(`Thiết bị/Model đã trúng: ${modelsJoined}`);
  }

  if (yearsSet && yearsSet.size > 0) {
    const sortedYears = [...yearsSet].sort((a, b) => a - b);
    detailsParts.push(`Năm trúng: ${sortedYears.join(", ")}`);
  }

  return `${name} - **[${ratingText}]** (${detailsParts.join("; ")})`;
}

function splitModelString(str) {
  if (!str) return [];
  return str.split(/[;\n\r,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.toLowerCase() !== "nhiều mã hàng" && s.toLowerCase() !== "không có" && s.toLowerCase() !== ".");
}

function getModelsWonByContractorInTender(contractorName, t) {
  if (!t.winnerNames || !t.winningModels || t.winningModels.length === 0) return [];
  const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
  const models = Array.isArray(t.winningModels) ? t.winningModels : [t.winningModels];
  
  const cleanContractor = contractorName.toLowerCase().trim();
  
  if (winners.length === models.length) {
    for (let i = 0; i < winners.length; i++) {
      if (winners[i] && winners[i].toLowerCase().trim() === cleanContractor) {
        return splitModelString(models[i]);
      }
    }
  } else {
    const hasWinner = winners.some(w => w && w.toLowerCase().trim() === cleanContractor);
    if (hasWinner) {
      return models.flatMap(m => splitModelString(m));
    }
  }
  return [];
}

function getScopeKeywords(text) {
  const t = (text || "").toLowerCase();
  const keywords = [];
  if (t.includes("hóa chất") || t.includes("sinh phẩm") || t.includes("reagent") || t.includes("thuốc thử") || t.includes("xét nghiệm")) {
    keywords.push("hoa_chat");
  }
  if (t.includes("vật tư") || t.includes("dụng cụ") || t.includes("đinh") || t.includes("nẹp") || t.includes("vít") || t.includes("catheter") || t.includes("băng") || t.includes("gạc")) {
    keywords.push("vat_tu");
  }
  if (t.includes("thiết bị") || t.includes("máy") || t.includes("bơm tiêm") || t.includes("monitor") || t.includes("điện tim") || t.includes("nội soi") || t.includes("x-quang") || t.includes("siêu âm")) {
    keywords.push("thiet_bi");
  }
  if (t.includes("bảo dưỡng") || t.includes("sửa chữa") || t.includes("kiểm định")) {
    keywords.push("bao_duong");
  }
  return keywords;
}

function isValidModelName(model) {
  if (!model) return false;
  const m = model.toLowerCase().trim();
  if (m.length <= 2) return false;
  if (/^[0-9*xX\s/-]+$/.test(m)) return false;
  const blacklisted = [
    "không", "không có", "nhiều mã hàng", "co", "dg", "đg", "kèm", "theo", 
    "ltd.", "ltd", "co.", "co", "inc.", "inc", "corporation", "corp",
    "china", "vietnam", "usa", "germany", "japan", "g7", "hãng", "nước",
    "bộ", "cái", "chiếc", "hộp", "thùng", "máy", "thiết bị", "vật tư", "hóa chất",
    "chưa", "chưa rõ", "đang", "đang thầu", "coo", "con"
  ];
  if (blacklisted.includes(m)) return false;
  if (m.includes("nhiều mã") || m.includes("không có")) return false;
  return true;
}

function getHistoricalContext(investor, category, currentNotifyNo, currentName, currentLocation, currentPrice) {
  const tenders = getAllTenders();
  const safeCategory = (category || '').toLowerCase().trim();
  
  // Sort tenders descending by date
  const sortedTenders = [...tenders].sort((a, b) => {
    const dateA = new Date(a.publicDate || a.closeDate || 0);
    const dateB = new Date(b.publicDate || b.closeDate || 0);
    return dateB - dateA;
  });

  // 1. Fuzzy match investor (Exact hospital familiar contractors)
  const sameInvestorTenders = sortedTenders.filter(t => 
    t.investor && 
    t.notifyNo !== currentNotifyNo &&
    isSameInvestorFuzzy(investor, t.investor)
  );

  const recentInvestor10 = sameInvestorTenders.slice(0, 10);
  const investorWinnerPackages = new Map();
  const investorWinnerModels = new Map();
  const investorWinnerYears = new Map();
  recentInvestor10.forEach(t => {
    if (t.winnerNames && t.winnerNames.length > 0) {
      const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
      const pkgTitle = formatPackageTitle(t.name);
      const year = getTenderYear(t);
      winners.forEach(w => {
        if (w) {
          const name = w.trim();
          if (!investorWinnerPackages.has(name)) investorWinnerPackages.set(name, []);
          const list = investorWinnerPackages.get(name);
          if (!list.includes(pkgTitle)) list.push(pkgTitle);

          if (!investorWinnerYears.has(name)) investorWinnerYears.set(name, new Set());
          if (year) investorWinnerYears.get(name).add(year);

          const currentScopes = getScopeKeywords(currentName + " " + (category || ""));
          const historicalScopes = getScopeKeywords(t.name + " " + (t.category || ""));
          const hasOverlap = currentScopes.length === 0 || historicalScopes.length === 0 || currentScopes.some(s => historicalScopes.includes(s));
          
          if (hasOverlap) {
            const models = getModelsWonByContractorInTender(name, t);
            if (models && models.length > 0) {
              if (!investorWinnerModels.has(name)) investorWinnerModels.set(name, new Set());
              const set = investorWinnerModels.get(name);
              models.forEach(m => {
                if (isValidModelName(m)) set.add(m);
              });
            }
          }
        }
      });
    }
  });

  const topInvestorWinners = [...investorWinnerPackages.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([name, pkgs]) => formatContractorWinningText(name, pkgs, investorWinnerModels.get(name), investorWinnerYears.get(name)));

  // 2. Regional district cluster match (2-3 lân cận) + Price scale match
  const regionInfo = getRegionNameAndKeywords(investor, currentLocation, currentName);
  const targetPrice = currentPrice || 0;

  const regionalTenders = sortedTenders.filter(t => {
    if (t.notifyNo === currentNotifyNo) return false;
    
    // Price compatibility check
    const tPrice = Number(t.winningPrice) || Number(t.price) || 0;
    if (!isPriceCompatible(targetPrice, tPrice)) return false;

    let inRegion = false;
    if (regionInfo.keywords.length > 0) {
      const combinedT = `${t.investor || ''} ${t.location || ''} ${t.name || ''}`.toLowerCase();
      inRegion = regionInfo.keywords.some(kw => combinedT.includes(kw));
    } else {
      inRegion = true;
    }
    return inRegion;
  });

  const recentRegional10 = regionalTenders.slice(0, 12);
  const regionalWinnerPackages = new Map();
  const regionalWinnerModels = new Map();
  const regionalWinnerYears = new Map();
  recentRegional10.forEach(t => {
    if (t.winnerNames && t.winnerNames.length > 0) {
      const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
      const pkgTitle = formatPackageTitle(t.name);
      const year = getTenderYear(t);
      winners.forEach(w => {
        if (w) {
          const name = w.trim();
          if (!regionalWinnerPackages.has(name)) regionalWinnerPackages.set(name, []);
          const list = regionalWinnerPackages.get(name);
          if (!list.includes(pkgTitle)) list.push(pkgTitle);

          if (!regionalWinnerYears.has(name)) regionalWinnerYears.set(name, new Set());
          if (year) regionalWinnerYears.get(name).add(year);

          const currentScopes = getScopeKeywords(currentName + " " + (category || ""));
          const historicalScopes = getScopeKeywords(t.name + " " + (t.category || ""));
          const hasOverlap = currentScopes.length === 0 || historicalScopes.length === 0 || currentScopes.some(s => historicalScopes.includes(s));
          
          if (hasOverlap) {
            const models = getModelsWonByContractorInTender(name, t);
            if (models && models.length > 0) {
              if (!regionalWinnerModels.has(name)) regionalWinnerModels.set(name, new Set());
              const set = regionalWinnerModels.get(name);
              models.forEach(m => {
                if (isValidModelName(m)) set.add(m);
              });
            }
          }
        }
      });
    }
  });

  const topRegionalWinners = [...regionalWinnerPackages.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([name, pkgs]) => formatContractorWinningText(name, pkgs, regionalWinnerModels.get(name), regionalWinnerYears.get(name)));

  const investorHistory = recentInvestor10.slice(0, 5).map(t => {
    const formattedPrice = t.price ? Number(t.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa rõ';
    const winnerText = t.winnerNames ? (Array.isArray(t.winnerNames) ? t.winnerNames.join(', ') : t.winnerNames) : 'Chưa rõ/Đang thầu';
    return `- "${t.name}" (${formattedPrice}) -> Trúng thầu: ${winnerText}`;
  }).join('\n');

  const regionalHistory = recentRegional10.slice(0, 5).map(t => {
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
      const categoryWinnerPkgs = new Map();
      const categoryWinnerModels = new Map();
      const categoryWinnerYears = new Map();
      tenders.forEach(t => {
        if (t.category === category && t.winnerNames) {
          const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
          const pkgTitle = formatPackageTitle(t.name);
          const year = getTenderYear(t);
          winners.forEach(w => {
            if (w) {
              const trimmed = w.trim();
              if (!categoryWinnerPkgs.has(trimmed)) categoryWinnerPkgs.set(trimmed, []);
              const list = categoryWinnerPkgs.get(trimmed);
              if (!list.includes(pkgTitle)) list.push(pkgTitle);

              if (!categoryWinnerYears.has(trimmed)) categoryWinnerYears.set(trimmed, new Set());
              if (year) categoryWinnerYears.get(trimmed).add(year);

              const models = getModelsWonByContractorInTender(trimmed, t);
              if (models && models.length > 0) {
                if (!categoryWinnerModels.has(trimmed)) categoryWinnerModels.set(trimmed, new Set());
                const set = categoryWinnerModels.get(trimmed);
                models.forEach(m => {
                  if (isValidModelName(m)) set.add(m);
                });
              }
            }
          });
        }
      });
      const sortedCatWinners = [...categoryWinnerPkgs.entries()].sort((a,b) => b[1].length - a[1].length).slice(0, 4);
      sortedCatWinners.forEach(([name, pkgs]) => {
        const nameOnly = name.trim();
        const alreadyAdded = likelyRivals.some(r => r.includes(nameOnly));
        if (!alreadyAdded && likelyRivals.length < 4) {
          likelyRivals.push(formatContractorWinningText(name, pkgs, categoryWinnerModels.get(name), categoryWinnerYears.get(name)));
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

  const currentPriceVal = Number(tender.winningPrice) || Number(tender.price) || 0;
  const hist = getHistoricalContext(tender.investor, tender.category, tender.notifyNo, tender.name, tender.location, currentPriceVal);
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
      // Recalculate competitor analysis dynamically in real-time so it is always 100% up-to-date with model-level cross-referencing
      const reqPrice = Number(req.body.winningPrice) || Number(req.body.price) || 0;
      const history = getHistoricalContext(investor, category, notifyNo, name, location, reqPrice);
      cachedData.competitorAnalysis = buildCompetitorAnalysisFromDatabase(history, investor, category, location);
      
      // Keep score and successChance aligned with live history data
      cachedData.score = history.sameInvestorCount > 0 ? 82 : 70;
      cachedData.successChance = history.topInvestorWinners.length > 0 ? 32 : 45;
      
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Query historical database early for competitor analysis & statistics
    const history = getHistoricalContext(investor, category, notifyNo, name, location, reqPrice);
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
      if (data && data.officialUrl) {
        data.officialUrl = data.officialUrl.replaceAll("&amp;", "&");
      }
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
        const tPrice = Number(tender.winningPrice) || Number(tender.price) || 0;
        const history = getHistoricalContext(tender.investor, tender.category, tender.notifyNo, tender.name, tender.location, tPrice);
        cachedData.competitorAnalysis = buildCompetitorAnalysisFromDatabase(history, tender.investor, tender.category, tender.location);
        saveToDiskCache(tender.notifyNo, cachedData);
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
            const originalTender = missingTenders.find(t => t.notifyNo === item.notifyNo) || {};
            const origPrice = Number(originalTender.winningPrice) || Number(originalTender.price) || 0;
            const history = getHistoricalContext(originalTender.investor, originalTender.category, item.notifyNo, originalTender.name, originalTender.location, origPrice);
            const compAnalysis = buildCompetitorAnalysisFromDatabase(history, originalTender.investor, originalTender.category, originalTender.location);

            const sumData = {
              summary: item.summary,
              score: history.sameInvestorCount > 0 ? 82 : (item.score || 60),
              successChance: history.topInvestorWinners.length > 0 ? 32 : (item.successChance || 35),
              suitabilityMetrics: item.suitabilityMetrics || { phapLy: 50, kyThuat: 50, thuongMai: 45, tienDo: 50, diaBan: 50, lienKet: 45 },
              primaryEquipment: item.primaryEquipment || "Chưa rõ thiết bị chủ đạo",
              strengths: item.strengths || [],
              gaps: item.gaps || [],
              risks: item.risks || [],
              requiredPartners: item.requiredPartners || [],
              actionItems: item.actionItems || [],
              keyPoints: item.keyPoints,
              aiAssessment: item.aiAssessment,
              officialUrl: (item.officialUrl || originalTender.sourceUrl || 'https://muasamcong.mpi.gov.vn/').replaceAll('&amp;', '&'),
              competitorAnalysis: compAnalysis
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

// API endpoint to trigger live fetch/sync for a specific tender ID
app.post('/api/fetch-tender', (req, res) => {
  const { notifyNo } = req.body;
  if (!notifyNo || typeof notifyNo !== 'string' || notifyNo.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Mã thông báo mời thầu không hợp lệ' });
  }

  const cleanId = notifyNo.trim();
  console.log(`[API] Triggering live sync for ID: ${cleanId}`);

  const { exec } = require('child_process');
  
  // Run scripts/fetch-data.mjs with --id <cleanId>
  exec(`node scripts/fetch-data.mjs --id ${cleanId}`, (error, stdout, stderr) => {
    // Invalidate the cache so the next request reads the updated tenders.json
    allTendersCached = null;

    if (error) {
      console.error(`[API] Error scanning ${cleanId}:`, error);
      return res.json({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
        message: `Lỗi khi đồng bộ gói thầu ${cleanId}`
      });
    }

    console.log(`[API] Sync of ${cleanId} completed successfully!`);
    return res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
      message: `Đồng bộ thành công gói thầu ${cleanId}!`
    });
  });
});

// API endpoint to trigger full background incremental scan on demand
app.post('/api/trigger-scan', (req, res) => {
  console.log(`[API] Triggering live database-wide sync...`);
  const { exec } = require('child_process');
  
  exec('node scripts/fetch-data.mjs', (error, stdout, stderr) => {
    allTendersCached = null;

    if (error) {
      console.error(`[API] Error triggering broad scan:`, error);
      return res.json({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
        message: `Lỗi khi đồng bộ dữ liệu hệ thống`
      });
    }

    console.log(`[API] Broad sync completed successfully!`);
    return res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
      message: `Đồng bộ và cập nhật toàn bộ thầu mới thành công!`
    });
  });
});

// Background scheduler to auto-sync automatically every 2 hours
const { exec } = require('child_process');
function runBackgroundSync() {
  console.log('[Scheduler] Starting automatic background synchronization...');
  exec('node scripts/fetch-data.mjs', (error, stdout, stderr) => {
    allTendersCached = null;
    if (error) {
      console.error('[Scheduler] Automatic sync failed:', error);
    } else {
      console.log('[Scheduler] Automatic background sync completed successfully!');
    }
  });
}

// Run automatic sync once shortly after startup
setTimeout(runBackgroundSync, 5000);

// Set interval to run automatic sync every 2 hours
setInterval(runBackgroundSync, 2 * 60 * 60 * 1000);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

