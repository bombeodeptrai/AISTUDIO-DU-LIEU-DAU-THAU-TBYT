import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractOnlineReofferTechnicalRequirements } from "./technical-requirements.mjs";

const SEARCH_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-home/services/smart/search";
const WINNING_PRICE_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-winning-bid-data/services/smart/search_prc";
const BID_OPEN_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/expose/ldtkqmt/bid-notification-p/bid-open?token=public";
const LOT_OPEN_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/expose/ldtkqmt/bid-notification-p/lotOpenDetail?token=public";
const CONTRACTOR_RESULT_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/expose/contractor-input-result/get?token=public";
const PLAN_BID_DETAIL_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/lcnt/bid-po-bidp-plan-project-view/get-bidp-plan-detail-by-id?token=public";
const ONLINE_REOFFER_HSMT_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/lcnt_tbmcgtt_hsmt";
const PROVINCE_CODES = [
  "01", "02", "04", "06", "08", "10", "11", "12", "14", "15",
  "17", "19", "20", "22", "24", "25", "26", "27", "30", "31",
  "33", "34", "35", "36", "37", "38", "40", "42", "44", "45",
  "46", "48", "49", "50", "51", "52", "53", "54", "55", "56",
  "57", "58", "60", "62", "64", "66", "67", "68", "70", "72",
  "74", "75", "77", "79", "80", "82", "83", "84", "86", "87",
  "89", "91", "92", "93", "94", "95", "96"
];
const DAYS = 3 * 365;
const INCREMENTAL_DAYS = 14;
const STATUS_SCHEMA_VERSION = 4;
const DETAIL_SCHEMA_VERSION = 3;
const WINDOW_DAYS = 7;
const PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 20;

// Các từ khóa rộng dùng để gọi API (để không bỏ sót)
const API_SEARCH_KEYWORDS = [
  "y tế",
  "bệnh viện",
  "trung tâm y tế",
  "thiết bị",
  "vật tư",
  "dụng cụ",
  "hóa chất",
  "sinh phẩm",
  "xét nghiệm",
  "thuốc",
  "dược phẩm",
  "phẫu thuật",
  "chẩn đoán",
  "hồi sức",
  "nha khoa",
  "siêu âm",
  "máy thở",
];

// Các từ khóa chắc chắn là y tế (dùng trong isMedical)
const SEARCH_KEYWORDS = [
  "thiết bị y tế",
  "vật tư tiêu hao",
  "vật tư y tế",
  "dụng cụ y tế",
  "vật tư phẫu thuật",
  "hóa chất xét nghiệm",
  "sinh phẩm chẩn đoán",
  "chẩn đoán in vitro",
  "máy xét nghiệm",
  "máy siêu âm",
  "máy thở",
];

// Hồ sơ cũ trước đợt thay đổi địa giới thường không còn trường locations.provCode.
// Khi quét bù 3 năm, tìm giao giữa địa danh trong tên đơn vị và từ khóa trong tên gói,
// sau đó vẫn chạy bộ lọc y tế chặt chẽ ở isMedical().
const HISTORICAL_LOCATION_TERMS = [
  "Gia Lai", "Bình Định", "Đắk Lắk", "Kon Tum", "Phú Yên", "Quảng Ngãi", "Quảng Nam", "Khánh Hòa", "Lâm Đồng", "Đắk Nông"
];
const HISTORICAL_TITLE_TERMS = [
  "thiết bị y tế", "vật tư y tế", "hóa chất", "máy thở", "siêu âm", "xét nghiệm"
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "data/tenders.json");
const biddersOutputPath = resolve(root, "data/bidders.json");
const equipmentOutputPath = resolve(root, "data/equipment.json");
const requirementsOutputPath = resolve(root, "data/requirements.json");
const technicalRequirementsOutputPath = resolve(root, "data/technical-requirements.json");
const detailsDir = resolve(root, "data/details");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function dateWindows(days = DAYS) {
  const now = new Date();
  // Muasamcong trả về publicDate theo giờ địa phương Việt Nam (UTC+7).
  // Nếu dùng now.toISOString() làm mốc 'to' trên máy chủ UTC (như GitHub Actions),
  // các gói thầu vừa đăng trong ngày (ví dụ 08:50 ICT) sẽ mang mốc giờ lớn hơn UTC và bị loại bỏ.
  const bufferedNow = new Date(now.getTime() + 86_400_000);
  const windows = [];
  for (let offset = 0; offset < days; offset += WINDOW_DAYS) {
    const to = new Date(bufferedNow.getTime() - offset * 86_400_000);
    const from = new Date(bufferedNow.getTime() - Math.min(offset + WINDOW_DAYS, days) * 86_400_000);
    windows.push({ from: from.toISOString(), to: to.toISOString() });
  }
  return windows;
}

function searchPayload(pageNumber, from, to, keyWord = "") {
  return [{
    pageSize: PAGE_SIZE,
    pageNumber,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord,
      matchType: "exact",
      matchFields: ["bidName"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
        { fieldName: "locations.provCode", searchType: "in", fieldValues: PROVINCE_CODES },
        { fieldName: "publicDate", searchType: "range", from, to },
      ],
    }],
  }];
}

function historicalSearchPayload(pageNumber, from, to, locationTerm, titleTerm) {
  const filters = [
    { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
    { fieldName: "publicDate", searchType: "range", from, to },
  ];
  return [{
    pageSize: PAGE_SIZE,
    pageNumber,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [
      {
        index: "es-contractor-selection",
        keyWord: titleTerm,
        matchType: "exact",
        matchFields: ["bidName"],
        filters,
      },
      {
        index: "es-contractor-selection",
        keyWord: locationTerm,
        matchType: "exact",
        matchFields: ["investorName", "procuringEntityName"],
        filters,
      },
    ],
  }];
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function postJson(url, body, timeoutMs = 45_000) {
  let lastError;
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await delay(1000);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Language": "vi-VN,vi;q=0.9",
          "Content-Type": "application/json",
          Origin: "https://muasamcong.mpi.gov.vn",
          Referer: "https://muasamcong.mpi.gov.vn/",
          "User-Agent": "thau-y-te-gia-lai-public-data/2.0",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${url} phản hồi HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        throw new Error(`${url} không trả về JSON (lần ${attempt}/${maxAttempts})`);
      }
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await delay(attempt * 1_500 + Math.random() * 1_000);
    }
  }
  throw lastError;
}

async function mapLimited(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function provinceBroadPayload(pageNumber, from, to, provCodes) {
  return [{
    pageSize: 10,
    pageNumber,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: "",
      matchType: "exact",
      matchFields: ["bidName"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
        { fieldName: "locations.provCode", searchType: "in", fieldValues: provCodes },
        { fieldName: "publicDate", searchType: "range", from, to },
      ],
    }],
  }];
}

async function fetchBroadProvinces(window, windowIndex, totalWindows) {
  const provCodes = ["52", "50", "54", "53", "49", "51", "48", "56", "58", "55", "57", "60", "46", "45", "44"];
  process.stdout.write(`Đang rà soát toàn bộ thầu địa phương (không lọc từ khóa) cho 15 tỉnh miền Trung - Tây Nguyên...\n`);
  try {
    const first = await postJson(SEARCH_URL, provinceBroadPayload(0, window.from, window.to, provCodes));
    const totalPages = Math.max(1, Number(first.page?.totalPages) || 1);
    const pagesToFetch = Math.min(totalPages - 1, 100);
    const pageNumbers = Array.from({ length: pagesToFetch }, (_, index) => index + 1);
    const remaining = await mapLimited(pageNumbers, 3, async (pageNumber) => {
      try {
        await delay(300);
        return await postJson(SEARCH_URL, provinceBroadPayload(pageNumber, window.from, window.to, provCodes));
      } catch (e) {
        process.stderr.write(`Cảnh báo trang thầu địa phương ${pageNumber} thất bại: ${e.message}\n`);
        return { page: { content: [] } };
      }
    });
    const items = [first, ...remaining].flatMap((payload) => payload.page?.content || []);
    process.stdout.write(`Đã tải ${items.length} thầu địa phương.\n`);
    return items;
  } catch (error) {
    process.stderr.write(`Cảnh báo quét thầu địa phương thất bại trang đầu: ${error.message}\n`);
    return [];
  }
}

async function fetchWindowKeyword(keyword, window, windowIndex, totalWindows) {
  try {
    const first = await postJson(SEARCH_URL, searchPayload(0, window.from, window.to, keyword));
    const totalPages = Math.max(1, Number(first.page?.totalPages) || 1);
    const pagesToFetch = Math.min(totalPages - 1, 10);
    const pageNumbers = Array.from({ length: pagesToFetch }, (_, index) => index + 1);
    const remaining = await mapLimited(pageNumbers, 3, async (pageNumber) => {
      try {
        await delay(300);
        return await postJson(SEARCH_URL, searchPayload(pageNumber, window.from, window.to, keyword));
      } catch (e) {
        process.stderr.write(`Cảnh báo từ khóa "${keyword}" trang ${pageNumber} thất bại: ${e.message}\n`);
        return { page: { content: [] } };
      }
    });
    return [first, ...remaining].flatMap((payload) => payload.page?.content || []);
  } catch (error) {
    process.stderr.write(`Cảnh báo từ khóa "${keyword}" khoảng ${windowIndex + 1}/${totalWindows} thất bại trang đầu: ${error.message}\n`);
    return [];
  }
}

async function fetchWindow(window, windowIndex, totalWindows) {
  process.stdout.write(`Đang quét khoảng ${windowIndex + 1}/${totalWindows} (${window.from.split('T')[0]} đến ${window.to.split('T')[0]})...\n`);
  
  // 1. Broad keywordless scan for Central region
  const broadItems = await fetchBroadProvinces(window, windowIndex, totalWindows);

  // 2. National keyword-based scan with increased concurrency (3)
  const results = await mapLimited(API_SEARCH_KEYWORDS, 3, (keyword) =>
    fetchWindowKeyword(keyword, window, windowIndex, totalWindows)
  );
  const keywordItems = results.flat();
  
  const allItems = [...broadItems, ...keywordItems];
  const uniqueItems = new Map();
  allItems.forEach((item) => {
    const key = item.notifyId || item.id || item.notifyNo;
    if (key) uniqueItems.set(key, item);
  });
  
  process.stdout.write(
    `Hoàn thành khoảng ${windowIndex + 1}/${totalWindows}: tìm thấy ${uniqueItems.size} gói thầu y tế & địa phương\n`,
  );
  return [...uniqueItems.values()];
}

async function fetchHistoricalPair(pair, pairIndex, totalPairs, from, to) {
  const { locationTerm, titleTerm } = pair;
  try {
    const first = await postJson(
      SEARCH_URL,
      historicalSearchPayload(0, from, to, locationTerm, titleTerm),
    );
    const totalPages = Math.max(0, Number(first.page?.totalPages) || 0);
    const pageNumbers = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 1);
    const remaining = await mapLimited(pageNumbers, 2, (pageNumber) =>
      postJson(SEARCH_URL, historicalSearchPayload(pageNumber, from, to, locationTerm, titleTerm)),
    );
    const items = [first, ...remaining].flatMap((payload) => payload.page?.content || []);
    if (items.length || (pairIndex + 1) % 50 === 0 || pairIndex + 1 === totalPairs) {
      process.stdout.write(
        `Bù địa bàn ${pairIndex + 1}/${totalPairs}: ${locationTerm} + ${titleTerm} = ${items.length}\n`,
      );
    }
    return items;
  } catch (error) {
    process.stderr.write(
      `Cảnh báo bù địa bàn ${pairIndex + 1}/${totalPairs} (${locationTerm} + ${titleTerm}) thất bại: ${error.message}\n`,
    );
    return [];
  }
}

async function fetchHistoricalFallback() {
  const now = new Date();
  const bufferedNow = new Date(now.getTime() + 86_400_000);
  const from = new Date(bufferedNow.getTime() - DAYS * 86_400_000).toISOString();
  const to = bufferedNow.toISOString();
  const pairs = HISTORICAL_LOCATION_TERMS.flatMap((locationTerm) =>
    HISTORICAL_TITLE_TERMS.map((titleTerm) => ({ locationTerm, titleTerm })));
  process.stdout.write(
    `Quét bù hồ sơ cũ thiếu mã tỉnh bằng ${pairs.length} cặp địa danh/từ khóa\n`,
  );
  return (await mapLimited(pairs, 3, (pair, index) =>
    fetchHistoricalPair(pair, index, pairs.length, from, to))).flat();
}

function analyzeMedical(item) {
  const originalTitle = String(item.bidName?.join(" ") || "").toLocaleLowerCase("vi-VN");
  const title = normalizeText(originalTitle);
  const investor = normalizeText(item.investorName);
  
  const excludedTerms = [
    // Xây dựng, vận hành và mua sắm hành chính.
    "xay lap", "xay dung", "cai tao", "sua chua nha", "suat an", "thuc pham", "bao ve",
    "ve sinh cong nghiep", "van phong pham", "xang dau", "cay xanh", "rac thai", "chat thai",
    "in an", "bien ten", "trang phuc", "bao ho lao dong", "giay bao ho", "quan ao", "drap",
    "boi duong doc hai", "boi duong hien vat", "hang hoa thuc hien che do", "phu cap doc hai",
    "ban, ghe", "ban ghe", "tu dung ho so", "xe ban tai", "xe day sieu thi", "bao hiem",
    "binh ac quy", "vat tu dien", "vat tu nuoc", "dien, nuoc", "dien nuoc",
    "dich vu sua chua", "sua chua", "dich vu bao tri", "bao tri, bao duong",
    "dich vu kiem dinh", "kiem dinh, hieu chuan", "kiem dinh va hieu chuan",
    "tu van", "tham dinh", "lap e-hsmt", "danh gia e-hsdt", "lap ho so moi thau",
    "danh gia ho so du thau", "lap du toan", "giam sat thi cong", "quan ly du an",
    "di doi va lap dat lai", "thao do va lap dat lai", "gia cong, lap dat tu",
    "tu de ho so", "ke de vat tu",
    // Công nghệ thông tin và thiết bị hạ tầng không phải thiết bị y tế.
    "may tinh", "may in", "tin hoc", "cong nghe thong tin", "may chu", "thiet bi tuong lua",
    "bao mat du lieu", "luu tru san", "thang may", "may phat dien", "dieu hoa khong khi",
    // Nông nghiệp, cao su và thú y.
    "phan bon", "thuoc bvtv", "bao ve thuc vat", "vuon cay", "cay cao su", "cay ca phe",
    "kich thich mu", "phun thuoc", "thuoc phong tri", "thuoc phun tri", "benh dong vat",
    "trau, bo", "cho, meo", "gia cam", "lo mom long mong", "viem da noi cuc",
    "phuc vu che bien", "san xuat phan vi sinh",
  ];
  if (excludedTerms.some((term) => title.includes(term))) {
    return { matched: false, reason: "Bị loại (từ khóa ngoài phạm vi)" };
  }

  // Chỉ các cụm từ tự thân xác định rõ thiết bị/vật tư y tế mới được giữ lại.
  const explicitMedicalTerms = [
    ...SEARCH_KEYWORDS,
    "trang thiết bị y tế", "y cụ", "y dụng cụ", "hóa chất y tế", "hoá chất y tế",
    "sinh phẩm y tế", "sinh phẩm xét nghiệm", "khí y tế", "oxy y tế",
    "hóa chất khử khuẩn", "hoá chất khử khuẩn", "hóa chất định nhóm máu",
    "hoá chất định nhóm máu", "vật tư xét nghiệm", "vật tư nha khoa",
  ];
  if (explicitMedicalTerms.some((term) => originalTitle.includes(term))) {
    return { matched: true, reason: "Được nhận (Từ khóa y tế rõ ràng)" };
  }

  // Tên riêng của máy móc, vật tư và sinh phẩm chuyên môn.
  const medicalProductTerms = [
    "máy thở", "máy siêu âm", "đầu dò siêu âm", "máy điện tim", "máy theo dõi bệnh nhân",
    "monitor bệnh nhân", "máy hút dịch", "bơm tiêm điện", "máy tim phổi", "máy lọc máu",
    "máy chạy thận", "máy xét nghiệm", "máy phân tích huyết học", "máy sinh hóa",
    "máy sinh hoá", "máy chụp", "x-quang", "x quang", "ct scanner", "mri",
    "máy hấp nhiệt độ thấp", "máy tiệt khuẩn", "máy tập cơ sàn chậu", "micropipet",
    "tủ bảo quản máu", "bình nitơ lưu trữ mẫu", "lọc nước ro cho phòng xét nghiệm",
    "dụng cụ phẫu thuật", "dao phẫu thuật", "gạc phẫu thuật", "găng tay phẫu thuật",
    "bơm tiêm", "kim tiêm", "kim nha khoa", "kim châm cứu", "dây truyền dịch",
    "truyền máu", "catheter", "stent", "implant", "đinh, nẹp, vít", "đinh nẹp vít",
    "nẹp chấn thương", "khớp gối", "khớp háng", "nội soi", "dây dao siêu âm",
    "bộ bơm cản quang", "máy bơm cản quang", "ampu bóp bóng", "túi đựng oxy",
    "bông y tế", "găng tay y tế", "khẩu trang y tế", "test nhanh chẩn đoán",
    "kit test", "dịch nhầy dùng trong phẫu thuật mắt", "chẩn thương chỉnh hình",
    "chấn thương chỉnh hình", "lọc máu liên tục", "chạy thận nhân tạo",
    "vật tư thận niệu", "vật tư tim mạch can thiệp", "vật tư can thiệp mạch não",
    "áo, khăn phẫu thuật", "que đè lưỡi", "dây garo",
  ];
  if (medicalProductTerms.some((term) => originalTitle.includes(term))) {
    return { matched: true, reason: "Được nhận (Hàng hóa chuyên môn)" };
  }

  // Hóa chất/sinh phẩm chỉ được giữ khi gắn với xét nghiệm hoặc chẩn đoán y khoa.
  const laboratoryTerms = [
    "xét nghiệm", "chẩn đoán", "in vitro", "huyết học", "sinh hóa", "sinh hoá",
    "vi sinh", "bệnh phẩm", "định nhóm máu", "máy huyết học", "máy sinh hóa", "máy sinh hoá",
    "miễn dịch", "elisa", "pcr", "hba1c", "nước tiểu", "đông máu", "sinh học phân tử", "máy phân tích",
    "giải phẫu bệnh", "tế bào học", "mô bệnh học"
  ];
  const laboratorySupplies = ["hóa chất", "hoá chất", "sinh phẩm", "vật tư", "chủng vi sinh", "thuốc thử", "chất hiệu chuẩn", "reagent"];
  if (laboratoryTerms.some((term) => originalTitle.includes(term))
    && laboratorySupplies.some((term) => originalTitle.includes(term))) {
    return { matched: true, reason: "Được nhận (Sinh phẩm/hóa chất phòng xét nghiệm)" };
  }

  const medicalInvestors = [
    "so y te", "benh vien", "trung tam y te", "tram y te", "trung tam kiem soat benh tat",
    "cdc", "phong kham", "benh xa", "y khoa", "y duoc", "da khoa", "chuyen khoa",
    "trung tam phap y", "trung tam kiem nghiem",
  ];

  // Hóa chất/sinh phẩm dùng trên máy phân tích
  const machineUsageTerms = ["sử dụng trên máy", "sử dụng cho máy", "chạy máy", "dùng cho máy", "dùng trên máy"];
  if (medicalInvestors.some((term) => investor.includes(term))
      && laboratorySupplies.some((term) => originalTitle.includes(term))
      && machineUsageTerms.some((term) => originalTitle.includes(term))) {
    return { matched: true, reason: "Được nhận (Hóa chất/sinh phẩm dùng trên máy)" };
  }

  // Tiêu đề chung chỉ được nhận khi vừa có vật tư/hóa chất, vừa có ngữ cảnh khám chữa bệnh,
  // và chủ đầu tư rõ ràng là cơ sở y tế. Không dùng tên chủ đầu tư làm điều kiện duy nhất.
  const genericSupplyTerms = ["vat tu", "hoa chat", "sinh pham", "dung cu", "thuoc thu"];
  const clinicalTerms = ["kham chua benh", "kham benh", "chua benh", "dieu tri", "phong mo"];
  if (medicalInvestors.some((term) => investor.includes(term))
    && genericSupplyTerms.some((term) => title.includes(term))
    && clinicalTerms.some((term) => title.includes(term))) {
    return { matched: true, reason: "Được nhận (Vật tư/hóa chất chung phục vụ điều trị)" };
  }
  
  return { matched: false, reason: "Bị loại (Không thỏa quy tắc y tế)" };
}

function isMedical(item) {
  return analyzeMedical(item).matched;
}

function isStoredTenderMedical(tender) {
  return isMedical({
    bidName: [tender.name],
    investorName: tender.investor,
  });
}

function categoryOf(name) {
  const original = String(name || "").toLocaleLowerCase("vi-VN");
  const normalized = normalizeText(original);
  const supplyTerms = [
    "vật tư", "hóa chất", "hoá chất", "sinh phẩm", "dụng cụ", "đinh", "nẹp", "vít",
    "gạc", "găng tay", "bộ bơm tiêm", "bơm tiêm các loại", "dây nối bơm tiêm", "kim ",
    "dây truyền", "stent", "khớp", "test nhanh", "dao phẫu thuật", "dây garo",
    "áo, khăn phẫu thuật", "bông y tế", "khẩu trang", "hơi oxy y tế", "oxy y tế",
    "dịch nhầy", "chuẩn đối chiếu", "chủng vi sinh", "tay dao", "dây dao", "ampu bóp bóng",
  ];
  if (supplyTerms.some((term) => original.includes(term))) return "Vật tư & hóa chất";
  if (original === normalized && [
    "vat tu", "hoa chat", "sinh pham", "dung cu", "dinh", "nep", "vit", "gac",
    "gang tay", "bo bom tiem", "bom tiem cac loai", "day noi bom tiem", "kim ",
    "day truyen", "stent", "khop", "test nhanh", "dao phau thuat", "day garo",
    "ao, khan phau thuat", "bong y te", "khau trang", "hoi oxy y te", "oxy y te",
    "dich nhay", "chuan doi chieu", "chung vi sinh", "tay dao", "day dao", "ampu bop bong",
  ].some((term) => normalized.includes(term))) return "Vật tư & hóa chất";
  return "Thiết bị y tế";
}

function statusOf(item) {
  const sourceStatus = String(item.sourceStatus || item.status || "").toUpperCase();
  const notifyStatus = String(item.statusForNotify || "").toUpperCase();
  const hasResult = Boolean(
    item.hasResult || item.inputResultId || item.contractorName?.length || item.winnerNames?.length,
  );
  if (sourceStatus === "CANCEL_BID" || ["DHT", "DHTBMT"].includes(notifyStatus)) return "cancelled";
  if (hasResult || notifyStatus === "CNTTT") return "awarded";
  if (notifyStatus === "DXT" || sourceStatus === "OPEN_BID") return "evaluating";
  const closeDate = item.bidCloseDate || item.closeDate || 0;
  const remaining = new Date(closeDate).getTime() - Date.now();
  const rawBidderCount = item.numBidderJoin ?? item.bidderCount;
  if (remaining <= 0 && rawBidderCount !== null && rawBidderCount !== undefined
    && Number(rawBidderCount) === 0) return "no_bidder";
  if (remaining <= 0) return "closed";
  if (remaining <= 3 * 86_400_000) return "urgent";
  return "open";
}

function sourceUrl(item) {
  const params = new URLSearchParams({
    p_p_id: "egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2",
    p_p_lifecycle: "0",
    p_p_state: "normal",
    p_p_mode: "view",
    _egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2_render: "detail-v2",
    type: item.type || "es-notify-contractor",
    stepCode: item.stepCode || "notify-contractor-step-1-tbmt",
    id: item.id || "",
    notifyId: item.notifyId || item.id || "",
    inputResultId: item.inputResultId || "",
    bidOpenId: item.bidOpenId || "",
    techReqId: item.techReqId || "",
    bidPreNotifyResultId: item.bidPreNotifyResultId || "",
    bidPreOpenId: item.bidPreOpenId || "",
    processApply: item.processApply || "LDT",
    bidMode: item.bidMode || "",
    notifyNo: item.notifyNo || "",
    planNo: item.planNo || "",
    pno: item.pno || "",
    step: "tbmt",
    isInternet: String(item.isInternet ?? ""),
    caseKHKQ: String(item.caseKHKQ ?? ""),
    bidForm: item.bidForm || "",
  });
  return `https://muasamcong.mpi.gov.vn/web/guest/contractor-selection?${params}`;
}

function detectLocationAndProvCode(item) {
  let provCode = item.locations?.[0]?.provCode || "";
  let location = item.locations?.map((l) => [l.districtName, l.provName].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "";

  const text = `${item.investorName || ""} ${item.procuringEntityName || ""} ${(item.bidName || []).join(" ")}`.toLowerCase();

  const PROVINCE_MAP = [
    { code: "52", name: "Tỉnh Gia Lai", keywords: ["gia lai", "pleiku", "đức cơ", "chư sê", "chư prông", "chư păh", "chư pưh", "an khê", "ayun pa", "đak đoa", "đăk đoa", "đak pơ", "đăk pơ", "mang yang", "kông chro", "kbang", "phú thiện", "krông pa", "ia pa", "ia grai"] },
    { code: "50", name: "Tỉnh Bình Định", keywords: ["bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước", "phù cát", "phù mỹ", "hoài ân", "an lão", "an lao", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong"] },
    { code: "54", name: "Tỉnh Đắk Lắk", keywords: ["đắk lắk", "dak lak", "daklak", "buôn ma thuột", "krông pắc", "cư m'gar", "buôn hồ", "ea h'leo", "ea kar", "cư kuin", "ea súp", "krông ana", "krông bông", "m'đrắk"] },
    { code: "53", name: "Tỉnh Kon Tum", keywords: ["kon tum", "đăk hà", "đăk tô", "măng đen", "ngọc hồi", "sa thầy", "tu mơ rông", "kon plông", "ia h'drai", "kon rẫy"] },
    { code: "49", name: "Tỉnh Phú Yên", keywords: ["phú yên", "tuy hòa", "sông cầu", "đông hòa", "đồng xuân", "phú hòa", "sơn hòa", "sông hinh", "tây hòa", "tuy an"] },
    { code: "51", name: "Tỉnh Quảng Ngãi", keywords: ["quảng ngãi", "quang ngai", "đức phổ", "bình sơn", "sơn tịnh", "tư nghĩa", "mộ đức", "nghĩa hành", "trà bồng", "ba tơ", "lý sơn", "minh long", "sơn hà"] },
    { code: "48", name: "Tỉnh Quảng Nam", keywords: ["quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc", "thăng bình", "núi thành", "bắc trà my", "nam trà my", "duy xuyên", "nông sơn", "quế sơn", "tiên phước"] },
    { code: "56", name: "Tỉnh Khánh Hòa", keywords: ["khánh hòa", "nha trang", "cam ranh", "ninh hòa", "cam lâm", "diên khánh", "khánh sơn", "khánh vĩnh", "vạn ninh"] },
    { code: "58", name: "Tỉnh Lâm Đồng", keywords: ["lâm đồng", "đà lạt", "bảo lộc", "bảo lâm", "di linh", "đơn dương", "đức trọng", "lạc dương", "lâm hà"] },
    { code: "55", name: "Tỉnh Đắk Nông", keywords: ["đắk nông", "dak nong", "gia nghĩa", "cư jút", "đắk glong", "đắk mil", "đắk r'lấp", "đắk song", "krông nô", "tuy đức"] },
    { code: "57", name: "Tỉnh Ninh Thuận", keywords: ["ninh thuận", "phan rang", "tháp chàm"] },
    { code: "60", name: "Tỉnh Bình Thuận", keywords: ["bình thuận", "phan thiết", "la gi", "bắc bình", "hàm thuận", "tánh linh", "tuy phong"] },
    { code: "46", name: "Tỉnh Thừa Thiên Huế", keywords: ["thừa thiên huế", "huế", "hương thủy", "hương trà"] },
    { code: "45", name: "Tỉnh Quảng Trị", keywords: ["quảng trị", "đông hà", "cam lộ", "gio linh", "triệu phong", "vĩnh linh"] },
    { code: "44", name: "Tỉnh Quảng Bình", keywords: ["quảng bình", "đồng hới", "ba đồn", "bố trạch", "lệ thủy"] },
  ];

  const allProvincesMap = {
    "01": "Thành phố Hà Nội", "02": "Tỉnh Hà Giang", "04": "Tỉnh Cao Bằng", "06": "Tỉnh Bắc Kạn", "08": "Tỉnh Tuyên Quang",
    "10": "Tỉnh Lào Cai", "11": "Tỉnh Điện Biên", "12": "Tỉnh Lai Châu", "14": "Tỉnh Sơn La", "15": "Tỉnh Yên Bái",
    "17": "Tỉnh Hòa Bình", "19": "Tỉnh Thái Nguyên", "20": "Tỉnh Lạng Sơn", "22": "Tỉnh Quảng Ninh", "24": "Tỉnh Bắc Giang",
    "25": "Tỉnh Phú Thọ", "26": "Tỉnh Vĩnh Phúc", "27": "Tỉnh Bắc Ninh", "30": "Tỉnh Hải Dương", "31": "Thành phố Hải Phòng",
    "33": "Tỉnh Hưng Yên", "34": "Tỉnh Thái Bình", "35": "Tỉnh Hà Nam", "36": "Tỉnh Nam Định", "37": "Tỉnh Ninh Bình",
    "38": "Tỉnh Thanh Hóa", "40": "Tỉnh Nghệ An", "42": "Tỉnh Hà Tĩnh", "44": "Tỉnh Quảng Bình", "45": "Tỉnh Quảng Trị",
    "46": "Tỉnh Thừa Thiên Huế", "48": "Thành phố Đà Nẵng", "49": "Tỉnh Quảng Nam", "50": "Tỉnh Bình Định", "51": "Tỉnh Quảng Ngãi",
    "52": "Tỉnh Gia Lai", "53": "Tỉnh Kon Tum", "54": "Tỉnh Đắk Lắk", "55": "Tỉnh Đắk Nông", "56": "Tỉnh Khánh Hòa",
    "57": "Tỉnh Ninh Thuận", "58": "Tỉnh Lâm Đồng", "60": "Tỉnh Bình Thuận", "62": "Tỉnh Long An", "64": "Tỉnh Đồng Tháp",
    "66": "Tỉnh An Giang", "67": "Tỉnh Tiền Giang", "68": "Tỉnh Kiên Giang", "70": "Tỉnh Bình Dương", "72": "Tỉnh Tây Ninh",
    "74": "Tỉnh Bình Phước", "75": "Tỉnh Đồng Nai", "77": "Tỉnh Bà Rịa - Vũng Tàu", "79": "Thành phố Hồ Chí Minh",
    "80": "Tỉnh Long An", "82": "Tỉnh Tiền Giang", "83": "Tỉnh Bến Tre", "84": "Tỉnh Trà Vinh", "86": "Tỉnh Vĩnh Long",
    "87": "Tỉnh Đồng Tháp", "89": "Tỉnh An Giang", "91": "Tỉnh Kiên Giang", "92": "Thành phố Cần Thơ", "93": "Tỉnh Hậu Giang",
    "94": "Tỉnh Sóc Trăng", "95": "Tỉnh Bạc Liêu", "96": "Tỉnh Cà Mau"
  };

  if (!provCode) {
    const matched = PROVINCE_MAP.find((p) => p.keywords.some((kw) => text.includes(kw)));
    if (matched) provCode = matched.code;
  }

  if (!location) {
    const matched = PROVINCE_MAP.find((p) => p.code === provCode || p.keywords.some((kw) => text.includes(kw)));
    if (matched) {
      location = matched.name;
    } else if (provCode && allProvincesMap[provCode]) {
      location = allProvincesMap[provCode];
    } else {
      location = "Khu vực Toàn quốc";
    }
  }

  return { provCode, location };
}

function normalizeTender(item) {
  const name = (item.bidName?.join(" ") || "Gói thầu chưa có tên").replace(/\s+/g, " ").trim();
  const bidderCount = item.numBidderJoin === null || item.numBidderJoin === undefined
    ? null
    : Number(item.numBidderJoin);
  const locInfo = detectLocationAndProvCode(item);
  return {
    id: item.notifyId || item.id || item.notifyNo,
    notifyId: item.notifyId || item.id || "",
    bidId: item.bidId || "",
    bidOpenId: item.bidOpenId || "",
    inputResultId: item.inputResultId || "",
    bidForm: item.bidForm || "",
    processApply: item.processApply || "LDT",
    stepCode: item.stepCode || "",
    notifyNo: item.notifyNo || "—",
    name,
    investor: item.investorName || "Chưa công bố",
    provCode: locInfo.provCode,
    location: locInfo.location,
    closeDate: item.bidCloseDate || "",
    publicDate: item.publicDate || "",
    price: (item.bidPrice || []).reduce((sum, value) => sum + (Number(value) || 0), 0),
    category: categoryOf(name),
    status: statusOf(item),
    sourceStatus: item.status || "",
    statusForNotify: item.statusForNotify || "",
    bidderCount: Number.isFinite(bidderCount) ? bidderCount : null,
    sourceUrl: sourceUrl(item),
    winnerNames: [...new Set((item.contractorName || []).filter(Boolean))],
    winningPrice: (item.bidWinningPrice || []).reduce((sum, value) => sum + (Number(value) || 0), 0),
    decisionDate: item.decisionDate || "",
    resultPublishedDate: item.publicDateKqlcnt || "",
    hasResult: Boolean(item.inputResultId || item.contractorName?.length),
  };
}

function pricingQuery(notifyNo, tab, pageNumber) {
  return {
    pageSize: DETAIL_PAGE_SIZE,
    pageNumber,
    query: [{
      index: "es-smart-pricing",
      keyWord: "",
      keyWordNotMatch: "",
      matchType: "all-1",
      matchFields: tab === "HANG_HOA" ? ["danh_muc_hang_hoa"] : ["ten_thiet_bi"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["HANG_HOA"] },
        { fieldName: "tab", searchType: "in", fieldValues: [tab] },
        { fieldName: "ma_tbmt", searchType: "in", fieldValues: [notifyNo] },
      ],
    }],
  };
}

function normalizeEquipment(item) {
  return {
    id: item.id || crypto.randomUUID(),
    name: item.tenThietBi || item.danhMucHangHoa || "Hàng hóa chưa có tên",
    model: item.kyMaHieu || "",
    brand: item.nhanHieu || "",
    manufacturer: item.hangSanXuat || "",
    origin: item.xuatXu || "",
    manufactureYear: item.namSanXuat || "",
    specification: (item.cauHinh || "").replace(/^\s*[\"']|[\"']\s*$/g, "").trim(),
    unit: item.donViTinh || "",
    quantity: Number(item.khoiLuongDouble) || 0,
    unitPrice: Number(item.donGia ?? item.donGiaDuThau) || 0,
    winnerNames: [...new Set((item.winningName || []).filter(Boolean))],
    decisionNo: item.soQuyetDinh || "",
    decisionDate: item.ngayBanHanhQuyetDinh || "",
    resultPublishedDate: item.ngayDangTaiKqlcnt || "",
  };
}

async function fetchPricingDetailPage(notifyNo, pageNumber) {
  return postJson(
    WINNING_PRICE_URL,
    [pricingQuery(notifyNo, "THIET_BI_VAT_TU_Y_TE", pageNumber), pricingQuery(notifyNo, "HANG_HOA", pageNumber)],
    30_000,
  );
}

async function fetchPricingDetails(notifyNo) {
  const first = await fetchPricingDetailPage(notifyNo, 0);
  const total = Number(first.page?.totalElements) || (first.page?.content || []).length;
  const totalPages = Number(first.page?.totalPages) || Math.max(1, Math.ceil(total / DETAIL_PAGE_SIZE));
  const pageNumbers = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 1);
  const remaining = await mapLimited(pageNumbers, 2, (pageNumber) => fetchPricingDetailPage(notifyNo, pageNumber));
  const unique = new Map();
  [first, ...remaining].flatMap((payload) => payload.page?.content || []).forEach((item) => {
    const key = item.id || `${item.tenThietBi || item.danhMucHangHoa}-${item.donGia || item.donGiaDuThau}`;
    unique.set(key, item);
  });
  const items = [...unique.values()].map(normalizeEquipment);
  return { total: Math.max(total, items.length), items, fetchedAt: new Date().toISOString() };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseFormValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeResultEquipment(item, parent, root) {
  const requestedCode = compactText(item.code);
  const model = item.codeGood || item.kyMaHieu
    || (!/^không yêu cầu$/i.test(requestedCode) ? requestedCode : "");
  return {
    id: String(item.id || crypto.randomUUID()),
    name: compactText(item.name || item.tenThietBi || item.danhMucHangHoa) || "Hàng hóa chưa có tên",
    model: compactText(model),
    brand: compactText(item.labelGood || item.nhanHieu || item.brand),
    manufacturer: compactText(item.manufacturer || item.hangSanXuat || item.manufacture),
    origin: compactText(item.origin || item.xuatXu || item.nuocSanXuat || item.goodsOrigin),
    manufactureYear: compactText(item.yearManufacture || item.namSanXuat || item.manufactureYear),
    specification: String(item.feature || item.cauHinh || item.specification || "").trim(),
    unit: item.uom || item.donViTinh || "",
    quantity: numberOrZero(item.qty ?? item.quantity ?? item.khoiLuongDouble),
    unitPrice: numberOrZero(item.unitPrice ?? item.donGia ?? item.donGiaDuThau),
    amount: numberOrZero(item.subTotal ?? item.amount ?? item.totalM),
    contractorCode: parent.contractorCode || "",
    winnerNames: [parent.contractorName].filter(Boolean),
    lotNo: item.lotNo || parent.lotNo || "",
    decisionNo: root.decisionNo || "",
    decisionDate: root.decisionDate || "",
    resultPublishedDate: root.publicDate || "",
  };
}

function normalizeBidder(item, status) {
  const bidPrice = numberOrZero(
    item.lotOpenPrice ?? item.bidFinalPrice ?? item.lotFinalPrice ?? item.lotPrice ?? item.bidPrice,
  );
  const finalPrice = numberOrZero(item.lotFinalPrice ?? item.bidFinalPrice ?? item.bidPrice);
  return {
    id: item.id || crypto.randomUUID(),
    contractorCode: item.orgCode || item.contractorCode || item.taxCode || "",
    taxCode: item.taxCode || "",
    contractorName: compactText(item.orgFullname || item.contractorName || item.newContractorName
      || item.ventureName) || "Chưa công bố tên nhà thầu",
    status,
    lotNo: item.lotNo || item.bidNo || "",
    lotName: compactText(item.lotName),
    bidPrice,
    finalPrice,
    winningPrice: status === "won"
      ? numberOrZero(item.bidWiningPrice ?? item.bidWinningPrice
        ?? item.succBidderPrice ?? item.lotFinalPrice ?? item.bidFinalPrice ?? item.bidPrice)
      : 0,
    reason: compactText(item.reason || item.noPassedRson || item.noSuccBidderRson),
    submittedAt: item.createdDateBidOpen || item.createdDate || "",
    models: [],
  };
}

function resultDetails(payload) {
  const root = payload?.bideContractorInputResultDTO || {};
  const versions = Array.isArray(root.decisionVersions) ? [...root.decisionVersions].reverse() : [];
  const latest = versions.find((version) => version?.lotResultDTO?.length || version?.lotResultItems?.length) || {};
  const lots = root.lotResultDTO?.length ? root.lotResultDTO : (latest.lotResultDTO || []);
  const lotItems = root.lotResultItems?.length ? root.lotResultItems : (latest.lotResultItems || []);
  const equipment = lotItems.flatMap((parent) =>
    parseFormValue(parent.formValue).map((item) => normalizeResultEquipment(item, parent, root)),
  );
  const bidders = lots.flatMap((lot) => (lot.contractorList || []).map((contractor) => {
    const status = Number(contractor.bidResult) === 1 ? "won" : "lost";
    const bidder = normalizeBidder({ ...contractor, lotNo: lot.lotNo, lotName: lot.lotName }, status);
    bidder.models = [...new Set(equipment
      .filter((item) => item.contractorCode && item.contractorCode === bidder.contractorCode)
      .map((item) => item.model || item.name)
      .filter(Boolean))];
    return bidder;
  }));
  return { bidders, items: equipment };
}

function openingDetails(bidOpenPayload, lotOpenPayload) {
  const submissions = bidOpenPayload?.bidSubmissionByContractorViewResponse?.bidSubmissionDTOList || [];
  const lots = Array.isArray(lotOpenPayload) ? lotOpenPayload : [];
  const rows = lots.length
    ? lots.map((lot) => ({
      ...(submissions.find((submission) => submission.contractorCode === lot.contractorCode
        || submission.id === lot.bidOpenId) || {}),
      ...lot,
    }))
    : submissions;
  const unique = new Map();
  rows.forEach((row) => {
    const bidder = normalizeBidder(row, "participating");
    const key = `${bidder.contractorCode || bidder.contractorName}|${bidder.lotNo}`;
    unique.set(key, bidder);
  });
  return [...unique.values()];
}

function normalizeRequirement(item) {
  return {
    id: String(item.id || crypto.randomUUID()),
    lotNo: compactText(item.lotNo),
    name: compactText(item.lotName || item.tenThuoc || item.bidName) || "Phần/lô chưa có tên",
    quantity: numberOrZero(item.quantity),
    unit: compactText(item.uom),
    plannedPrice: numberOrZero(item.lotPrice ?? item.lotEstimatePrice ?? item.pricePlan),
    specification: compactText(item.qualityStandards),
    sourceStage: "invitation",
  };
}

async function fetchTenderRequirements(tender) {
  if (!tender.bidId) {
    return {
      total: 0,
      items: [],
      summary: "",
      disclosure: "missing-plan-detail-id",
    };
  }
  const payload = await postJson(PLAN_BID_DETAIL_URL, { id: tender.bidId }, 35_000);
  const lots = Array.isArray(payload?.bidpBidLotList) ? payload.bidpBidLotList : [];
  const unique = new Map();
  lots.forEach((item) => {
    const normalized = normalizeRequirement(item);
    const key = normalized.id || `${normalized.lotNo}|${normalized.name}`;
    unique.set(key, normalized);
  });
  const items = [...unique.values()];
  return {
    total: items.length,
    items,
    summary: compactText(payload?.generalTasks),
    disclosure: items.length ? "public-plan-lots" : "plan-summary-only",
  };
}

async function fetchTenderTechnicalRequirements(tender) {
  if (tender.bidForm !== "CGTTRG") {
    return {
      total: 0,
      items: [],
      chapters: [],
      files: [],
      disclosure: "official-captcha-required",
    };
  }
  const payload = await postJson(ONLINE_REOFFER_HSMT_URL, {
    id: tender.notifyId || tender.id,
    processApply: tender.processApply || "LDT",
  }, 45_000);
  return extractOnlineReofferTechnicalRequirements(payload);
}

async function fetchTenderDetails(tender) {
  let bidders = [];
  let items = [];
  let pricingTotal = 0;
  const requirementsPromise = fetchTenderRequirements(tender).catch((error) => ({
    total: 0,
    items: [],
    summary: "",
    disclosure: "temporarily-unavailable",
    error: error.message,
  }));
  const technicalRequirementsPromise = fetchTenderTechnicalRequirements(tender).catch((error) => ({
    total: 0,
    items: [],
    chapters: [],
    files: [],
    disclosure: "temporarily-unavailable",
    error: error.message,
  }));

  if (tender.inputResultId) {
    const [resultResponse, pricingResponse] = await Promise.allSettled([
      postJson(CONTRACTOR_RESULT_URL, { id: tender.inputResultId }, 35_000),
      fetchPricingDetails(tender.notifyNo),
    ]);
    if (resultResponse.status === "fulfilled") {
      const detail = resultDetails(resultResponse.value);
      bidders = detail.bidders;
      items = detail.items;
    }
    if (pricingResponse.status === "fulfilled") {
      pricingTotal = pricingResponse.value.total;
      if (!items.length) items = pricingResponse.value.items;
    }
  } else if (["evaluating", "closed"].includes(tender.status)) {
    const request = {
      notifyNo: tender.notifyNo,
      notifyId: tender.notifyId || tender.id,
      type: "TBMT",
      packType: 0,
    };
    const [bidOpenResponse, lotOpenResponse] = await Promise.allSettled([
      postJson(BID_OPEN_URL, request, 35_000),
      postJson(LOT_OPEN_URL, request, 35_000),
    ]);
    bidders = openingDetails(
      bidOpenResponse.status === "fulfilled" ? bidOpenResponse.value : {},
      lotOpenResponse.status === "fulfilled" ? lotOpenResponse.value : [],
    );
  } else if (tender.hasResult) {
    const pricing = await fetchPricingDetails(tender.notifyNo);
    pricingTotal = pricing.total;
    items = pricing.items;
  }

  const requirements = await requirementsPromise;
  const technicalRequirements = await technicalRequirementsPromise;

  return {
    schemaVersion: DETAIL_SCHEMA_VERSION,
    total: Math.max(pricingTotal, items.length),
    bidders,
    items,
    requirements,
    technicalRequirements,
    modelDisclosure: bidders.some((bidder) => bidder.status === "lost")
      ? "winning-bidders-only"
      : "as-published",
    fetchedAt: new Date().toISOString(),
  };
}

async function previousData() {
  try {
    const manifest = JSON.parse(await readFile(outputPath, "utf8"));
    const detailsByNotifyNo = { ...(manifest.detailsByNotifyNo || {}) };
    try {
      const files = (await readdir(detailsDir)).filter((name) => /^IB\d{10}\.json$/.test(name));
      await mapLimited(files, 10, async (name) => {
        detailsByNotifyNo[name.replace(/\.json$/, "")] = JSON.parse(await readFile(resolve(detailsDir, name), "utf8"));
      });
    } catch {
      // Bản dữ liệu cũ có thể chưa được tách thành từng tệp chi tiết.
    }
    return { ...manifest, detailsByNotifyNo };
  } catch {
    return { tenders: [], detailsByNotifyNo: {} };
  }
}

function shouldRefreshDetails(tender, cached) {
  if (!cached) return true;
  if (Number(cached.schemaVersion || 0) < DETAIL_SCHEMA_VERSION) return true;
  if (["open", "urgent"].includes(tender.status)
    && cached.requirements?.disclosure !== "public-plan-lots") return true;
  const fetchedAt = new Date(cached.fetchedAt || 0).getTime();
  if (!fetchedAt) return true;
  const resultPublishedAt = new Date(tender.resultPublishedDate || 0).getTime();
  if (resultPublishedAt > fetchedAt) return true;
  const refreshAfter = ["open", "urgent", "evaluating"].includes(tender.status)
    ? 60 * 60 * 1000
    : (cached.items?.length ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  return Date.now() - fetchedAt >= refreshAfter;
}

function enrichTender(tender, detail) {
  const bidders = detail?.bidders || [];
  const participantNames = [...new Set(bidders.map((bidder) => bidder.contractorName).filter(Boolean))];
  const winners = bidders.filter((bidder) => bidder.status === "won");
  const losers = bidders.filter((bidder) => bidder.status === "lost");
  const publishedWinners = [...new Set([
    ...(tender.winnerNames || []),
    ...winners.map((bidder) => bidder.contractorName),
  ].filter(Boolean))];
  const winningModels = [...new Set((detail?.items || [])
    .map((item) => item.model || item.name)
    .filter(Boolean))];
  const losingModels = [...new Set(losers.flatMap((bidder) => bidder.models || []).filter(Boolean))];
  const loserDetails = [...new Map(losers.map((bidder) => {
    const value = { contractorName: bidder.contractorName, reason: bidder.reason || "" };
    return [`${value.contractorName}|${value.reason}`, value];
  })).values()];
  const uniqueBidderCodes = new Set(bidders.map((bidder) => bidder.contractorCode || bidder.contractorName));
  const detailedWinningPrice = winners.reduce((sum, bidder) => sum + numberOrZero(
    bidder.winningPrice || bidder.finalPrice || bidder.bidPrice,
  ), 0);
  return {
    ...tender,
    bidderCount: uniqueBidderCodes.size || tender.bidderCount,
    participantNames,
    winnerNames: publishedWinners,
    loserNames: [...new Set(losers.map((bidder) => bidder.contractorName).filter(Boolean))],
    loserDetails,
    winningModels,
    losingModels,
    losingModelDisclosure: losers.length && !losingModels.length ? "Nguồn công khai chưa công bố" : "",
    winningPrice: numberOrZero(tender.winningPrice) || detailedWinningPrice,
  };
}

async function writeAtomic(targetPath, data) {
  const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmpPath, targetPath);
}

async function main() {
  const previous = await previousData();

  // Handle direct fetch of specific tender by notifyNo/id
  const idIdx = process.argv.indexOf("--id");
  if (idIdx !== -1 && process.argv[idIdx + 1]) {
    const targetId = process.argv[idIdx + 1].trim();
    process.stdout.write(`Đang tiến hành quét và đồng bộ trực tiếp gói thầu ID/Mã TBMT: ${targetId}...\n`);
    
    // Search the API for exact notifyNo
    const results = await postJson(SEARCH_URL, [{
      pageSize: 10,
      pageNumber: 0,
      sortBy: "publicDate",
      sortType: "DESC",
      query: [{
        index: "es-contractor-selection",
        keyWord: targetId,
        matchType: "exact",
        matchFields: ["notifyNo"],
        filters: [
          { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] }
        ]
      }]
    }]);
    
    const items = results.page?.content || [];
    if (!items.length) {
      process.stdout.write(`Không tìm thấy gói thầu ${targetId} trên cổng chính thức muasamcong!\n`);
      return;
    }
    
    const item = items[0];
    const medicalCheck = analyzeMedical(item);
    if (!medicalCheck.matched) {
      process.stdout.write(`Cảnh báo: Gói thầu ${targetId} được tìm thấy nhưng bị bộ lọc y tế loại (${medicalCheck.reason}). Vẫn cho phép đồng bộ theo yêu cầu trực tiếp của người dùng.\n`);
    }
    
    // Normalize and enrich
    const tender = normalizeTender(item);
    tender.category = categoryOf(tender.name);
    tender.status = statusOf(tender);
    
    // Fetch details
    process.stdout.write(`Đang tải chi tiết cho gói thầu ${targetId}...\n`);
    const detailsByNotifyNo = { ...(previous.detailsByNotifyNo || {}) };
    try {
      detailsByNotifyNo[tender.notifyNo] = await fetchTenderDetails(tender);
      process.stdout.write(`Đã tải chi tiết thành công cho gói thầu ${targetId}!\n`);
    } catch (err) {
      process.stderr.write(`Cảnh báo khi tải chi tiết cho gói thầu ${targetId}: ${err.message}\n`);
    }
    
    // Merge into previous tenders
    const tendersMap = new Map((previous.tenders || []).map(t => [t.notifyNo || t.id, t]));
    const enrichedTender = enrichTender(tender, detailsByNotifyNo[tender.notifyNo]);
    tendersMap.set(enrichedTender.notifyNo || enrichedTender.id, enrichedTender);
    
    const tenders = [...tendersMap.values()].sort((a, b) => new Date(b.publicDate) - new Date(a.publicDate));
    
    // Regenerate files
    const bidders = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
      const tender = tendersMap.get(notifyNo);
      return (detail.bidders || []).map((bidder) => ({
        notifyNo,
        tenderName: tender?.name || "",
        sourceUrl: tender?.sourceUrl || "",
        ...bidder,
      }));
    });
    
    const equipment = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
      const tender = tendersMap.get(notifyNo);
      return (detail.items || []).map((item) => ({
        notifyNo,
        tenderName: tender?.name || "",
        sourceUrl: tender?.sourceUrl || "",
        ...item,
      }));
    });
    
    const requirements = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
      const tender = tendersMap.get(notifyNo);
      return (detail.requirements?.items || []).map((item) => ({
        notifyNo,
        tenderName: tender?.name || "",
        sourceUrl: tender?.sourceUrl || "",
        ...item,
      }));
    });
    
    const technicalRequirements = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
      const tender = tendersMap.get(notifyNo);
      return (detail.technicalRequirements?.items || []).map((item) => ({
        notifyNo,
        tenderName: tender?.name || "",
        sourceUrl: tender?.sourceUrl || "",
        ...item,
      }));
    });
    
    const payload = {
      ...previous,
      tenders,
      fetchedAt: new Date().toISOString(),
      detailTenderCount: Object.keys(detailsByNotifyNo).length,
    };
    
    await mkdir(dirname(outputPath), { recursive: true });
    await mkdir(detailsDir, { recursive: true });
    
    if (detailsByNotifyNo[tender.notifyNo]) {
      await writeFile(resolve(detailsDir, `${tender.notifyNo}.json`), `${JSON.stringify(detailsByNotifyNo[tender.notifyNo], null, 2)}\n`);
    }
    
    await writeAtomic(biddersOutputPath, { bidders, fetchedAt: new Date().toISOString() });
    await writeAtomic(equipmentOutputPath, { equipment, fetchedAt: new Date().toISOString() });
    await writeAtomic(requirementsOutputPath, { requirements, fetchedAt: new Date().toISOString() });
    await writeAtomic(technicalRequirementsOutputPath, { technicalRequirements, fetchedAt: new Date().toISOString() });
    await writeAtomic(outputPath, payload);
    
    process.stdout.write(`Đã quét, đồng bộ và lưu thành công gói thầu ${targetId} vào cơ sở dữ liệu!\n`);
    return;
  }

  const fullRefresh = process.argv.includes("--full");
  const scanDays = fullRefresh ? DAYS : (previous.tenders?.length ? INCREMENTAL_DAYS : 90);
  const windows = dateWindows(scanDays);
  process.stdout.write(fullRefresh
    ? `Quét bù toàn bộ ${DAYS} ngày lần đầu\n`
    : `Cập nhật tăng dần ${scanDays} ngày gần nhất\n`);
  const windowConcurrency = fullRefresh ? 1 : 2;
  const provinceItems = (await mapLimited(windows, windowConcurrency, (window, index) =>
    fetchWindow(window, index, windows.length))).flat();
  const historicalFallbackItems = fullRefresh ? await fetchHistoricalFallback() : [];
  const allItems = [...provinceItems, ...historicalFallbackItems];
  const allUnique = new Map();
  allItems.forEach((item) => {
    const key = item.notifyId || item.id || item.notifyNo;
    if (key) allUnique.set(key, item);
  });

  const medicalUnique = new Map();
  const filterStats = {};
  [...allUnique.values()].forEach((item) => {
    const result = analyzeMedical(item);
    filterStats[result.reason] = (filterStats[result.reason] || 0) + 1;
    if (result.matched) {
      const key = item.notifyId || item.id || item.notifyNo;
      if (key) medicalUnique.set(key, item);
    }
  });

  process.stdout.write(`\n--- THỐNG KÊ LỌC HỒ SƠ ---\n`);
  process.stdout.write(`Tổng số hồ sơ thô tìm thấy: ${allUnique.size}\n`);
  for (const [reason, count] of Object.entries(filterStats).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`- ${reason}: ${count} hồ sơ\n`);
  }
  process.stdout.write(`--------------------------\n\n`);

  const freshTenders = [...medicalUnique.values()].map(normalizeTender);
  const now = Date.now();
  const cutoff = now - DAYS * 86_400_000;
  const refreshedFrom = now - scanDays * 86_400_000;
  const historicalTenders = fullRefresh ? [] : (previous.tenders || [])
    .filter((tender) => {
      const publishedAt = new Date(tender.publicDate || 0).getTime();
      return publishedAt >= cutoff
        && publishedAt < refreshedFrom
        && isStoredTenderMedical(tender);
    })
    .map((tender) => ({
      ...tender,
      category: categoryOf(tender.name),
      status: statusOf(tender),
    }));
  const mergedTenders = new Map();
  [...historicalTenders, ...freshTenders].forEach((tender) => {
    const key = tender.notifyNo || tender.id;
    if (key) mergedTenders.set(key, tender);
  });
  const tenders = [...mergedTenders.values()]
    .sort((a, b) => new Date(b.publicDate) - new Date(a.publicDate));
  if (!tenders.length && previous.tenders?.length) throw new Error("Nguồn trả về 0 gói; giữ nguyên bản dữ liệu gần nhất");
  process.stdout.write(
    `Đã rà ${allUnique.size} gói trong ${scanDays} ngày cập nhật, đang lưu ${tenders.length} gói y tế/${DAYS} ngày\n`,
  );

  const detailsByNotifyNo = { ...(previous.detailsByNotifyNo || {}) };
  const detailCandidates = tenders.filter((tender) =>
    tender.hasResult || ["open", "urgent", "evaluating", "closed"].includes(tender.status));
  const detailsToRefresh = detailCandidates
    .filter((tender) => shouldRefreshDetails(tender, detailsByNotifyNo[tender.notifyNo]));
  process.stdout.write(`Chi tiết: làm mới ${detailsToRefresh.length}/${detailCandidates.length} gói mời thầu/mở thầu/kết quả\n`);
  await mapLimited(detailsToRefresh, 3, async (tender) => {
    try {
      detailsByNotifyNo[tender.notifyNo] = await fetchTenderDetails(tender);
      const detail = detailsByNotifyNo[tender.notifyNo];
      process.stdout.write(
        `Chi tiết ${tender.notifyNo}: ${detail.requirements?.items?.length || 0} phần/lô mời, ${detail.technicalRequirements?.items?.length || 0} dòng kỹ thuật, ${detail.bidders.length} nhà thầu, ${detail.items.length} mặt hàng trúng\n`,
      );
    } catch (error) {
      process.stderr.write(`Bỏ qua chi tiết ${tender.notifyNo}: ${error.message}\n`);
    }
  });

  const activeNumbers = new Set(tenders.map((tender) => tender.notifyNo));
  for (const notifyNo of Object.keys(detailsByNotifyNo)) {
    if (!activeNumbers.has(notifyNo)) delete detailsByNotifyNo[notifyNo];
  }
  const enrichedTenders = tenders.map((tender) =>
    enrichTender(tender, detailsByNotifyNo[tender.notifyNo]));
  const tenderByNotifyNo = new Map(enrichedTenders.map((tender) => [tender.notifyNo, tender]));
  const bidders = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
    const tender = tenderByNotifyNo.get(notifyNo);
    return (detail.bidders || []).map((bidder) => ({
      notifyNo,
      tenderName: tender?.name || "",
      sourceUrl: tender?.sourceUrl || "",
      ...bidder,
    }));
  });
  const equipment = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
    const tender = tenderByNotifyNo.get(notifyNo);
    return (detail.items || []).map((item) => ({
      notifyNo,
      tenderName: tender?.name || "",
      sourceUrl: tender?.sourceUrl || "",
      ...item,
    }));
  });
  const requirements = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
    const tender = tenderByNotifyNo.get(notifyNo);
    return (detail.requirements?.items || []).map((item) => ({
      notifyNo,
      tenderName: tender?.name || "",
      sourceUrl: tender?.sourceUrl || "",
      ...item,
    }));
  });
  const technicalRequirements = Object.entries(detailsByNotifyNo).flatMap(([notifyNo, detail]) => {
    const tender = tenderByNotifyNo.get(notifyNo);
    return (detail.technicalRequirements?.items || []).map((item) => ({
      notifyNo,
      tenderName: tender?.name || "",
      sourceUrl: tender?.sourceUrl || "",
      ...item,
    }));
  });
  const payload = {
    tenders: enrichedTenders,
    fetchedAt: new Date().toISOString(),
    source: "muasamcong-public-api",
    provinceCodes: PROVINCE_CODES,
    detailTenderCount: Object.keys(detailsByNotifyNo).length,
    collection: {
      days: DAYS,
      strategy: "incremental-province-plus-historical-entity-keywords",
      refreshDays: INCREMENTAL_DAYS,
      statusSchemaVersion: STATUS_SCHEMA_VERSION,
      lastScanDays: scanDays,
      lastScanTenderCount: allUnique.size,
      lastProvinceTenderCount: provinceItems.length,
      lastHistoricalFallbackTenderCount: historicalFallbackItems.length,
      scannedTenderCount: fullRefresh
        ? allUnique.size
        : (Number(previous.collection?.scannedTenderCount) || allUnique.size),
      keywords: SEARCH_KEYWORDS,
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await rm(detailsDir, { recursive: true, force: true });
  await mkdir(detailsDir, { recursive: true });
  await mapLimited(Object.entries(detailsByNotifyNo), 10, ([notifyNo, detail]) =>
    writeFile(resolve(detailsDir, `${notifyNo}.json`), `${JSON.stringify(detail, null, 2)}\n`),
  );
  async function writeAtomic(targetPath, data) {
    const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
    await rename(tmpPath, targetPath);
  }

  await writeAtomic(biddersOutputPath, { bidders, fetchedAt: new Date().toISOString() });
  await writeAtomic(equipmentOutputPath, { equipment, fetchedAt: new Date().toISOString() });
  await writeAtomic(requirementsOutputPath, { requirements, fetchedAt: new Date().toISOString() });
  await writeAtomic(technicalRequirementsOutputPath, { technicalRequirements, fetchedAt: new Date().toISOString() });
  await writeAtomic(outputPath, payload);
  process.stdout.write(
    `Đã lưu ${enrichedTenders.length} gói, ${requirements.length} phần/lô mời, ${technicalRequirements.length} dòng kỹ thuật, ${bidders.length} dòng nhà thầu và ${equipment.length} mặt hàng trúng\n`,
  );
}

await main();
