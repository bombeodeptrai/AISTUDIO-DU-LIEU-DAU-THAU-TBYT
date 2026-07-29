
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

async function fetchWindowKeyword(keyword, window, windowIndex, totalWindows) {
  try {
    const first = await postJson(SEARCH_URL, searchPayload(0, window.from, window.to, keyword));
    const totalPages = Math.max(1, Number(first.page?.totalPages) || 1);
    const pagesToFetch = Math.min(totalPages - 1, 10);
    const pageNumbers = Array.from({ length: pagesToFetch }, (_, index) => index + 1);
    const remaining = await mapLimited(pageNumbers, 1, async (pageNumber) => {
      try {
        await delay(500);
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
  const results = await mapLimited(API_SEARCH_KEYWORDS, 1, (keyword) =>
    fetchWindowKeyword(keyword, window, windowIndex, totalWindows)
  );
  const items = results.flat();
  const uniqueItems = new Map();
  items.forEach((item) => {
    const key = item.notifyId || item.id || item.notifyNo;
    if (key) uniqueItems.set(key, item);
  });
  process.stdout.write(
    `Hoàn thành khoảng ${windowIndex + 1}/${totalWindows}: tìm thấy ${uniqueItems.size} gói thầu y tế\n`,
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



const items = [
  { notifyNo: "1", bidName: ["Gói 2. Hóa chất sử dụng trên máy phân tích huyết học tự động"], investorName: "Bệnh viện Đa khoa Gia Lai" },
  { notifyNo: "2", bidName: ["Xây dựng nhà vệ sinh"], investorName: "Trường mầm non" },
  { notifyNo: "3", bidName: ["Hóa chất sử dụng trên máy miễn dịch tự động"], investorName: "Bệnh viện đa khoa Gia Lai" }
];

const filterStats = {};
items.forEach(item => {
  const result = analyzeMedical(item);
  filterStats[result.reason] = (filterStats[result.reason] || 0) + 1;
});
console.log(filterStats);
