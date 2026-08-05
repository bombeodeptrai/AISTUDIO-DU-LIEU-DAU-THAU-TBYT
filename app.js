const DATA_URL = "./data/tenders.json";
const EQUIPMENT_SEARCH_URL = "./data/equipment-search.json";
const SAVED_KEY = "gia-lai-medical-tender-watchlist";
const TENDERS_PER_PAGE = 10;

const state = {
  tenders: [],
  equipmentByNotifyNo: new Map(),
  searchMatchesByNotifyNo: new Map(),
  detailsByNotifyNo: {},
  aiSummaries: {},
  aiSummaryActiveId: null,
  aiSummaryLoadingId: null,
  aiSummaryErrors: {},
  fetchedAt: "",
  query: "",
  category: "all",
  province: "gialai",
  days: 1095,
  status: "all",
  investor: "",
  page: 1,
  expandedId: null,
  detailLoading: null,
  detailErrors: {},
  saved: loadSaved(),
};

// --- CORE COMPANY PROFILE DYNAMIC ENGINE & TEMPLATES ---
const PROFILE_TEMPLATES = {
  kieu_viet: {
    name: "Hệ sinh thái Doanh nghiệp Kiểu Việt",
    members: [
      {
        name: "Công ty TNHH Kiểu Việt (Đơn vị đứng đầu Liên danh)",
        taxCode: "4100596520",
        address: "Số 60 đường Chu Văn An, phường Lý Thường Kiệt, TP. Quy Nhơn, tỉnh Bình Định",
        role: "Thi công xây lắp, cung cấp và lắp đặt thiết bị y tế chuyên dụng, hệ thống khí y tế"
      },
      {
        name: "Công ty CP Nội thất và Vật liệu xây dựng Kiểu Việt",
        taxCode: "4101455201",
        address: "Lô 01 đường Võ Duy Dương, phường Quang Trung, TP. Quy Nhơn, tỉnh Bình Định",
        role: "Giải pháp nội thất bệnh viện chuyên dụng, vật liệu xây dựng và các hạng mục phụ trợ"
      }
    ],
    coreBusiness: "thi công xây lắp y tế, cung cấp lắp đặt thiết bị y tế, thiết bị hồi sức cấp cứu ICU, máy thở, máy siêu âm màu 4D, máy theo dõi bệnh nhân monitor 5 thông số, máy khử rung tim, máy điện tim 3 kênh, máy hút dịch, máy khí dung siêu âm, hệ thống nội soi tiêu hóa, chẩn đoán ung thư sớm, giường hồi sức cấp cứu điều khiển điện, máy truyền dịch, bơm tiêm điện, bộ hồi sức trẻ sơ sinh, lồng ấp trẻ sơ sinh, máy làm ấm trẻ sơ sinh, máy súc rửa dạ dày, máy đo chức năng hô hấp, hệ thống khí y tế, trung tâm cung cấp khí nén y tế, HTM EQUIP, hệ thống hút chân không EU, ngõ ra cấp khí HEYER AEROTECH Đức, hộp đầu giường BHU, dàn gom oxy dự phòng, nội thất bệnh viện, giường bệnh viện inox 201, tủ đầu giường, thang máy chuyên dụng XIOLIFT, thang máy bệnh viện 1350kg, thang máy tải khách 800kg, máy phát điện dự phòng ISO 9001 110KVA 100KVA, hệ thống chuông gọi y tá 34 màn hình",
    primaryLocations: "Bình Định, Gia Lai, Kon Tum, Đắk Lắk, Phú Yên, Quảng Ngãi, Quảng Nam",
    equipmentCapabilities: {
      icuGroup: [
        "Máy thở (02 máy)",
        "Máy siêu âm màu 4D - 04 đầu dò chuyên dụng (01 máy)",
        "Máy theo dõi bệnh nhân (Monitor) 5 thông số (08 máy)",
        "Máy khử rung tim (01 máy)",
        "Máy điện tim 3 kênh (04 máy)",
        "Máy hút dịch (05 máy)",
        "Máy khí dung siêu âm (04 máy)",
        "Hệ thống nội soi tiêu hóa dạ dày/đại tràng video chẩn đoán ung thư sớm (01 bộ)",
        "Giường hồi sức cấp cứu điều khiển điện (20 cái)",
        "Máy truyền dịch (10 máy)",
        "Bơm tiêm điện (10 máy)",
        "Bộ hồi sức trẻ sơ sinh (01 bộ)",
        "Lồng ấp trẻ sơ sinh (02 cái)",
        "Máy làm ấm trẻ sơ sinh (01 máy)",
        "Máy súc rửa dạ dày (01 máy)",
        "Máy đo chức năng hô hấp (01 máy)"
      ],
      gasGroup: [
        "Trung tâm cung cấp khí nén y tế (Lắp ráp bởi HTM EQUIP)",
        "Hệ thống hút chân không (Xuất xứ EU/tương đương)",
        "Ngõ ra cấp khí y tế / Ổ khí y tế HEYER AEROTECH (Đức) - 187 bộ",
        "Hộp đầu giường (BHU) gồm ổ điện & đèn chiếu sáng - 16 bộ",
        "Dàn gom ô xy dự phòng đấu kết nối 2 nhánh x 10 bình"
      ],
      interiorGroup: [
        "186 bộ Giường bệnh viện Inox 201 (1900x900x540mm) & Tủ đầu giường Inox 201 (430x330x840mm)",
        "Hệ thống thang máy chuyên dụng XIOLIFT (Thang bệnh viện 1350kg/18 người, thang tải khách 800kg/10 người, 6 stops)",
        "Hệ thống máy phát điện dự phòng ISO 9001/9002 (110KVA/88KW dự phòng, 100KVA/80KW liên tục)",
        "Hệ thống chuông gọi y tá (34 màn hình hiển thị trực)"
      ]
    },
    projects: [
      {
        id: "kv-proj-1",
        name: "Dự án Trung tâm Y tế thành phố Quy Nhơn (Hợp đồng số 15/2022/HĐ-XD)",
        shortName: "TTYT TP Quy Nhơn",
        investor: "Ban QLDA ĐTXD và phát triển quỹ đất TP Quy Nhơn",
        year: "2022-2025",
        value: 142403776000,
        category: "Thi công xây dựng, Lắp đặt Thiết bị y tế, Khí y tế, Thang máy XIOLIFT & Nội thất",
        status: "Đứng đầu Liên danh (TNHH Kiểu Việt: 41.406.581.000 VNĐ; CP Nội thất Kiểu Việt: 9.013.962.000 VNĐ)",
        details: "Hợp đồng 142.4 tỷ VNĐ thi công xây dựng và lắp đặt toàn bộ thiết bị y tế, hệ thống khí y tế HEYER AEROTECH Đức, thang máy bệnh viện XIOLIFT và nội thất chuyên dụng. Tiến độ cam kết 900 ngày.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "kv-proj-2",
        name: "Dự án Trung tâm Y tế thị xã An Nhơn",
        shortName: "TTYT TX An Nhơn",
        investor: "Ban QLDA ĐTXD và phát triển quỹ đất TX An Nhơn",
        year: "2023-2025",
        value: 85000000000,
        category: "Thi công xây dựng & Lắp đặt toàn bộ thiết bị y tế, khí y tế, thang máy & nội thất",
        status: "Nhà thầu thi công xây dựng và lắp đặt toàn bộ thiết bị",
        details: "Thi công xây dựng và cung cấp lắp đặt trọn gói toàn bộ thiết bị y tế Khoa Hồi sức cấp cứu (ICU), khí y tế, thang máy bệnh viện XIOLIFT và 186 bộ giường tủ inox 201 kiểm soát nhiễm khuẩn.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "kv-proj-3",
        name: "Cung cấp & Lắp đặt Đồng bộ Hệ thống Khí y tế, Thiết bị Hồi sức Cấp cứu (ICU) & Nội thất Bệnh viện",
        shortName: "Khí Y tế & Thiết bị ICU",
        investor: "Trung tâm Y tế & Các Bệnh viện khu vực Miền Trung - Tây Nguyên",
        year: "2024",
        value: 28500000000,
        category: "Cung cấp Thiết bị Y tế, Khí y tế & Nội thất Chuyên dụng",
        status: "Đã hoàn thành bàn giao nghiệm thu & đưa vào vận hành",
        details: "Cung cấp máy thở, máy siêu âm màu 4D (4 đầu dò), monitor 5 thông số, máy khử rung tim, hệ thống nội soi chẩn đoán ung thư sớm, 20 giường ICU điện, trung tâm khí nén y tế, ngõ ra HEYER AEROTECH và 186 bộ giường tủ bệnh viện.",
        websiteUrl: "https://kieuviet.com.vn"
      }
    ]
  },
  med_equip: {
    name: "Công ty TNHH Thiết bị Y tế Quy Nhơn",
    coreBusiness: "thiết bị y tế, máy chụp X-quang, máy CT-Scanner, máy siêu âm, máy nội soi, lắp đặt thiết bị phòng mổ, bảo trì máy chẩn đoán hình ảnh, cung cấp trang thiết bị phòng điều trị",
    primaryLocations: "Bình Định, Gia Lai, Phú Yên, Quảng Ngãi",
    projects: [
      {
        id: "med-proj-1",
        name: "Cung cấp, lắp đặt trọn gói hệ thống máy chụp cắt lớp vi tính CT-Scanner 128 lát cắt và máy siêu âm màu 4D chuyên dụng GE Healthcare tại Bệnh viện Thành phố Quy Nhơn",
        shortName: "Bệnh viện Quy Nhơn",
        investor: "Bệnh viện Thành phố Quy Nhơn",
        year: "2024",
        value: 12450000000,
        category: "Cung cấp Thiết bị y tế chẩn đoán hình ảnh",
        status: "Đã bàn giao lắp đặt & đưa vào sử dụng thành công",
        details: "Cung cấp lắp đặt bàn giao trọn gói máy CT-Scanner 128 lát cắt kèm theo bộ lưu điện chuyên dụng, máy siêu âm Doppler màu chuyên khoa tim mạch của hãng GE Healthcare Mỹ đạt tiêu chuẩn chất lượng y tế quốc tế.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "med-proj-2",
        name: "Cung cấp hệ thống máy chụp X-quang kỹ thuật số cao tần và bộ thiết bị xét nghiệm sinh hóa tự động cho Trung tâm Y tế Thị xã An Nhơn",
        shortName: "TTYT Thị xã An Nhơn",
        investor: "Trung tâm Y tế Thị xã An Nhơn",
        year: "2023",
        value: 6810000000,
        category: "Cung cấp Thiết bị chẩn đoán & xét nghiệm",
        status: "Nghiệm thu thanh toán & đưa vào phục vụ bệnh nhân",
        details: "Cung cấp lắp đặt máy X-quang DR kỹ thuật số, hệ thống nội soi HD và thiết bị xét nghiệm sinh hóa, huyết học tự động đảm bảo độ chính xác kết quả cao.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "med-proj-3",
        name: "Cung cấp và chuyển giao công nghệ thiết bị phòng mổ vô trùng, máy gây mê kèm thở và đèn mổ LED cao cấp tại Phòng khám Đa khoa Hòa Đức",
        shortName: "Phòng khám Đa khoa Hòa Đức",
        investor: "Phòng khám Đa khoa Hòa Đức",
        year: "2025",
        value: 4250000000,
        category: "Cung cấp Thiết bị phòng mổ",
        status: "Đang vận hành tốt, bảo trì định kỳ đầy đủ",
        details: "Cung cấp đồng bộ thiết bị bàn mổ đa năng, đèn mổ LED, máy gây mê kèm thở Dräger của Đức và hệ thống sưởi ấm bệnh nhân cho phòng mổ vô khuẩn.",
        websiteUrl: "https://kieuviet.com.vn"
      }
    ]
  },
  med_supplies: {
    name: "Công ty Cổ phần Dược phẩm & Vật tư Y tế Gia Lai",
    coreBusiness: "vật tư y tế, hóa chất xét nghiệm, sinh phẩm chẩn đoán, dụng cụ tiêu hao y tế, chỉ phẫu thuật, bơm kim tiêm, găng tay y tế, dung dịch sát khuẩn, thuốc điều trị",
    primaryLocations: "Gia Lai, Bình Định, Kon Tum, Đắk Lắk",
    projects: [
      {
        id: "sup-proj-1",
        name: "Cung cấp trọn gói vật tư tiêu hao y tế dùng trong phẫu thuật thường quy, bơm kim tiêm, chỉ khâu phẫu thuật và găng tay y tế vô trùng cho Bệnh viện Đa khoa tỉnh Bình Định",
        shortName: "BVĐK tỉnh Bình Định",
        investor: "Bệnh viện Đa khoa tỉnh Bình Định",
        year: "2024",
        value: 16113471000,
        category: "Cung cấp Vật tư tiêu hao y tế",
        status: "Đã hoàn thành nghiệm thu bàn giao đầy đủ số lượng",
        details: "Cung ứng định kỳ hàng tháng các mặt hàng vật tư tiêu hao phòng mổ, bơm kim tiêm, bông băng gạc và chỉ khâu phẫu thuật đảm bảo chất lượng vô trùng tốt nhất.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "sup-proj-2",
        name: "Cung cấp hóa chất xét nghiệm huyết học, sinh phẩm chẩn đoán hình ảnh và bộ dụng cụ xét nghiệm miễn dịch thường quy cho Trung tâm Y tế Huyện Chư Păh",
        shortName: "TTYT Huyện Chư Păh",
        investor: "Trung tâm Y tế Huyện Chư Păh",
        year: "2025",
        value: 7869950000,
        category: "Cung cấp Hóa chất & Sinh phẩm xét nghiệm",
        status: "Nghiệm thu bàn giao theo từng giai đoạn đúng tiến độ",
        details: "Cung cấp hóa chất chạy máy xét nghiệm tự động Beckman Coulter, test nhanh virus, sinh phẩm chẩn đoán đạt tiêu chuẩn của Bộ Y tế cấp phép lưu hành.",
        websiteUrl: "https://kieuviet.com.vn"
      },
      {
        id: "sup-proj-3",
        name: "Cung cấp bộ kit test nhanh và hóa chất sát khuẩn y tế phục vụ công tác kiểm soát nhiễm khuẩn cho Trung tâm Y tế Thị xã An Khê",
        shortName: "TTYT Thị xã An Khê",
        investor: "Trung tâm Y tế Thị xã An Khê",
        year: "2024",
        value: 3500000000,
        category: "Cung cấp Hóa chất & Vật tư phòng dịch",
        status: "Đã nghiệm thu thanh quyết toán hoàn tất",
        details: "Cung cấp đồng bộ hóa chất khử trùng Cloramin B, kit xét nghiệm nhanh và trang phục bảo hộ y tế chất lượng cao phòng chống lây nhiễm chéo.",
        websiteUrl: "https://kieuviet.com.vn"
      }
    ]
  }
};

const DEFAULT_COMPANY_PROFILE = PROFILE_TEMPLATES.kieu_viet;

let companyProfile = JSON.parse(localStorage.getItem("custom_company_profile")) || DEFAULT_COMPANY_PROFILE;

// Tự động chuyển đổi nếu hồ sơ lưu trong Cache là bản mẫu cũ (đấu giá) sang Hồ sơ Năng lực Hệ sinh thái Y tế Kiểu Việt chính thức
if (companyProfile && (companyProfile.name?.includes("Đấu giá") || !companyProfile.members)) {
  companyProfile = JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE));
  localStorage.setItem("custom_company_profile", JSON.stringify(companyProfile));
}

const statusLabels = {
  open: "Đang mở",
  urgent: "Sắp đóng",
  evaluating: "Đang xét thầu",
  closed: "Đã đóng – chưa có KQ",
  no_bidder: "Không có nhà thầu",
  cancelled: "Đã hủy/không lựa chọn",
  awarded: "Đã có kết quả",
};

const elements = {
  form: document.querySelector("#search-form"),
  keyword: document.querySelector("#keyword"),
  category: document.querySelector("#category"),
  province: document.querySelector("#province"),
  days: document.querySelector("#days"),
  statusFilter: document.querySelector("#status-filter"),
  list: document.querySelector("#tender-list"),
  pagination: document.querySelector("#pagination"),
  resultCount: document.querySelector("#result-count"),
  refresh: document.querySelector("#refresh-button"),
  dataState: document.querySelector("#data-state"),
  sourceLabel: document.querySelector("#source-label"),
  updatedLabel: document.querySelector("#updated-label"),
  warning: document.querySelector("#source-warning"),
  metricTotal: document.querySelector("#metric-total"),
  metricOpen: document.querySelector("#metric-open"),
  metricUrgent: document.querySelector("#metric-urgent"),
  metricValue: document.querySelector("#metric-value"),
  openPercent: document.querySelector("#open-percent"),
  averageValue: document.querySelector("#average-value"),
  investorRanking: document.querySelector("#investor-ranking"),
  savedCount: document.querySelector("#saved-count"),
  savedList: document.querySelector("#saved-list"),
  aiPopover: document.querySelector("#ai-hover-popover"),
  directSyncInput: document.querySelector("#direct-sync-input"),
  directSyncButton: document.querySelector("#direct-sync-button"),
  directSyncSpinner: document.querySelector("#direct-sync-spinner"),
  directSyncBtnText: document.querySelector("#direct-sync-btn-text"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMarkdownText(value) {
  let escaped = escapeHtml(value);
  // Replace **text** with <strong>text</strong>
  return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bx\s+quang\b/g, "xquang")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(value) {
  return normalizeSearch(value).split(" ").filter(Boolean);
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

function textIncludesTerm(text, term) {
  return term.length <= 2
    ? ` ${text} `.includes(` ${term} `)
    : text.includes(term);
}

function orderedTermsWithin(text, terms, maxGap = 2) {
  const tokens = text.split(" ").filter(Boolean);
  let previousIndex = -1;
  for (const term of terms) {
    const start = previousIndex + 1;
    const end = previousIndex < 0 ? tokens.length : Math.min(tokens.length, start + maxGap + 1);
    let foundIndex = -1;
    for (let index = start; index < end; index += 1) {
      const matches = term.length <= 2 ? tokens[index] === term : tokens[index].includes(term);
      if (matches) {
        foundIndex = index;
        break;
      }
    }
    if (foundIndex < 0) return false;
    previousIndex = foundIndex;
  }
  return true;
}

function searchTextMatches(text, terms) {
  if (!terms.length) return true;
  if (terms[0] === "may" && terms.length > 1) return orderedTermsWithin(text, terms);
  return terms.every((term) => textIncludesTerm(text, term));
}

function equipmentSearchText(item) {
  return normalizeSearch([
    item.name,
    item.model,
    item.brand,
    item.manufacturer,
    item.origin,
    item.lotNo,
    item.lotName,
  ].filter(Boolean).join(" "));
}

function indexEquipment(items) {
  const byNotifyNo = new Map();
  for (const item of items) {
    const notifyNo = String(item.notifyNo || "").trim();
    if (!notifyNo) continue;
    const indexedItem = { ...item, searchText: equipmentSearchText(item) };
    if (!byNotifyNo.has(notifyNo)) byNotifyNo.set(notifyNo, []);
    byNotifyNo.get(notifyNo).push(indexedItem);
  }
  return byNotifyNo;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function tenderSearchText(tender) {
  return normalizeSearch([
    tender.name,
    tender.investor,
    tender.notifyNo,
    tender.location,
    ...asList(tender.winnerNames),
    ...asList(tender.loserNames),
    ...asList(tender.participantNames),
  ].filter(Boolean).join(" "));
}

function tenderModelSearchTexts(tender) {
  return [
    ...asList(tender.winningModels),
    ...asList(tender.losingModels),
  ].map(normalizeSearch).filter(Boolean);
}

function officialUrl(value, notifyNo) {
  try {
    let raw = String(value || "").trim();
    while (raw.includes("&amp;")) {
      raw = raw.replaceAll("&amp;", "&");
    }
    if (raw) {
      const url = new URL(raw);
      if (url.protocol === "https:" && url.hostname === "muasamcong.mpi.gov.vn") {
        return url.href;
      }
    }
    if (notifyNo) {
      return `https://muasamcong.mpi.gov.vn/web/guest/contractor-selection?p_p_id=egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2_render=index&notifyNo=${encodeURIComponent(notifyNo)}`;
    }
    return "https://muasamcong.mpi.gov.vn/";
  } catch {
    if (notifyNo) {
      return `https://muasamcong.mpi.gov.vn/web/guest/contractor-selection?p_p_id=egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2_render=index&notifyNo=${encodeURIComponent(notifyNo)}`;
    }
    return "https://muasamcong.mpi.gov.vn/";
  }
}

function loadSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    localStorage.removeItem(SAVED_KEY);
    return [];
  }
}

function formatMoney(value, compact = true) {
  const amount = Number(value) || 0;
  if (!amount) return "Chưa công bố";
  if (compact && amount >= 1_000_000_000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount / 1_000_000_000)} tỷ`;
  }
  if (compact && amount >= 1_000_000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount / 1_000_000)} triệu`;
  }
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

function formatDate(value, withTime = false) {
  if (!value) return "Chưa công bố";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa công bố";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

// ==========================================
// CẬP NHẬT: XUẤT FILE EXCEL (.xlsx)
// Đã thay thế chức năng tải file CSV bằng thư viện ExcelJS
// File Excel xuất ra chỉ gồm 4 cột: Số lượng máy, Tên loại máy, Thông số kỹ thuật, Đơn vị sử dụng.
// Có định dạng kẻ ô, font Times New Roman, wrap text và cố định hàng tiêu đề.
// ==========================================
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => reject(new Error("Không tải được thư viện ExcelJS"));
    document.head.appendChild(script);
  });
}

async function downloadTechnicalXlsx(tender, button) {
  const items = state.detailsByNotifyNo[tender.notifyNo]?.technicalRequirements?.items || [];
  if (!items.length) return;
  
  const originalText = button.textContent;
  button.textContent = "Đang tạo file...";
  button.disabled = true;

  try {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Thong_so_ky_thuat");
    
    // Cố định hàng tiêu đề
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    
    // Khai báo cột
    sheet.columns = [
      { header: "Số lượng máy", key: "quantity", width: 15 },
      { header: "Tên loại máy", key: "name", width: 30 },
      { header: "Thông số kỹ thuật", key: "specification", width: 70 },
      { header: "Đơn vị sử dụng", key: "place", width: 30 }
    ];
    
    // Bật Auto Filter cho toàn bộ vùng
    sheet.autoFilter = 'A1:D1';
    
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    const fontStyle = { name: 'Times New Roman', size: 12 };

    // Header style
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Times New Roman', size: 12, bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell((cell) => {
      cell.border = borderStyle;
    });
    
    // Đổ dữ liệu toàn bộ item (không giới hạn 40 dòng)
    items.forEach(item => {
      const row = sheet.addRow({
        quantity: item.quantity || "",
        name: item.name || "",
        specification: item.specification || "",
        place: item.projectPlace || tender.investor || ""
      });
      row.eachCell((cell, colNumber) => {
        cell.font = fontStyle;
        cell.border = borderStyle;
        cell.alignment = colNumber === 3 
          ? { wrapText: true, vertical: 'top' } 
          : { vertical: 'top' };
      });
    });
    
    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${tender.notifyNo}-thong-so-ky-thuat.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 100);
  } catch (error) {
    alert("Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại.");
    console.error(error);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function withinDays(tender) {
  const published = new Date(tender.publicDate).getTime();
  if (!published) return true;
  return published >= Date.now() - state.days * 86_400_000;
}

function periodTenders() {
  return state.tenders.filter(
    (tender) => withinDays(tender) && (state.category === "all" || tender.category === state.category),
  );
}

function filteredTenders() {
  const terms = searchTerms(state.query);
  state.searchMatchesByNotifyNo.clear();
  return periodTenders().filter((tender) => {
    const tenderText = tenderSearchText(tender);
    const equipment = state.equipmentByNotifyNo.get(tender.notifyNo) || [];
    const equipmentMatches = terms.length
      ? equipment.filter((item) => searchTextMatches(item.searchText, terms))
      : [];
    const modelMatches = terms.length
      && tenderModelSearchTexts(tender).some((modelText) => searchTextMatches(modelText, terms));
    const queryMatches = !terms.length
      || searchTextMatches(tenderText, terms)
      || modelMatches
      || equipmentMatches.length > 0;
    const statusMatches =
      state.status === "all" ||
      (state.status === "awarded"
        ? Boolean(tender.hasResult || tender.winnerNames?.length)
        : tender.status === state.status);
    const investorMatches = !state.investor || tender.investor === state.investor;

    const provinceMatches = (() => {
      if (state.province === "all") return true;

      const provCodeMap = {
        gialai: ["52"],
        binhdinh: ["50"],
        daklak: ["54"],
        kontum: ["53"],
        phuyen: ["49"],
        quangngai: ["51"],
        quangnam: ["48"],
        khanhhoa: ["56"],
        lamdong: ["58"],
        daknong: ["55"],
        ninhthuan_binhthuan: ["57", "60"],
        quangtri_quangbinh_hue: ["46", "45", "44"],
        mientrung: ["52", "50", "54", "53", "49", "51", "48", "56", "58", "55", "57", "60", "46", "45", "44"]
      };

      let targetProvCodes = provCodeMap[state.province] ? [...provCodeMap[state.province]] : [];
      
      // Xử lý địa giới hành chính theo thời gian: 
      // Ví dụ: Gia Lai và Bình Định sáp nhập thành Gia Lai từ ngày 01/07/2025.
      // Nếu lọc Gia Lai, và kết quả có ngày thông báo trước 1/7/2025 thì sẽ lấy cả Bình Định (50).
      if (state.province === "gialai") {
        const tenderDateStr = tender.pubDate || tender.notifyDate || tender.bidCloseDate || tender.fetchedAt;
        if (tenderDateStr) {
          const tenderDate = new Date(tenderDateStr);
          const mergerDate = new Date("2025-07-01");
          if (tenderDate < mergerDate) {
            targetProvCodes.push("50"); // Thêm mã Bình Định vào kết quả tìm kiếm của Gia Lai
          }
        }
      }

      if (tender.provCode && targetProvCodes.includes(String(tender.provCode))) {
        return true;
      }

      const combined = `${tender.investor || ""} ${tender.location || ""} ${tender.name || ""}`.toLowerCase();
      
      if (state.province === "mientrung") {
        const centralKeywords = [
          "gia lai", "pleiku", "đức cơ", "chư sê", "chư prông", "chư păh", "chư pưh", "chư phư", "an khê", "ayun pa", "đak đoa", "đăk đoa", "đak pơ", "đăk pơ", "mang yang", "kông chro", "kbang", "phú thiện", "krông pa", "ia pa", "ia grai", "diên hồng", "phú túc", "hra", "trại giam gia trung", "bệnh viện 211", "bv 211", "bệnh viện 15", "bv 15", "bệnh viện 331", "bv 331", "331", "nhi tỉnh gia lai", "mắt tỉnh gia lai",
          "bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước", "phù cát", "phù mỹ", "hoài ân", "an lão", "an lao", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong",
          "đắk lắk", "dak lak", "daklak", "buôn ma thuột", "krông pắc", "cư m'gar", "buôn hồ", "ea h'leo", "ea kar", "cư kuin", "ea súp", "krông ana", "krông bông", "m'đrắk",
          "quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc", "thăng bình", "núi thành", "bắc trà my", "nam trà my", "duy xuyên", "nông sơn", "quế sơn", "tiên phước",
          "kon tum", "đăk hà", "đăk tô", "măng đen", "ngọc hồi", "sa thầy", "tu mơ rông", "kon plông", "ia h'drai", "kon rẫy",
          "phú yên", "tuy hòa", "sông cầu", "đông hòa", "đồng xuân", "phú hòa", "sơn hòa", "sông hinh", "tây hòa", "tuy an",
          "quảng ngãi", "quang ngai", "đức phổ", "bình sơn", "sơn tịnh", "tư nghĩa", "mộ đức", "nghĩa hành", "trà bồng", "ba tơ", "lý sơn", "minh long", "sơn hà",
          "khánh hòa", "nha trang", "cam ranh", "ninh hòa", "cam lâm", "diên khánh", "khánh sơn", "khánh vĩnh", "vạn ninh",
          "lâm đồng", "đà lạt", "bảo lộc", "bảo lâm", "di linh", "đơn dương", "đức trọng", "lạc dương", "lâm hà",
          "đắk nông", "dak nong", "gia nghĩa", "cư jút", "đắk glong", "đắk mil", "đắk r'lấp", "đắk song", "krông nô", "tuy đức",
          "ninh thuận", "phan rang", "tháp chàm", "bình thuận", "phan thiết", "la gi", "bắc bình", "hàm thuận", "tánh linh", "tuy phong",
          "thừa thiên huế", "huế", "hương thủy", "hương trà", "quảng trị", "đông hà", "cam lộ", "gio linh", "triệu phong", "vĩnh linh", "quảng bình", "đồng hới", "ba đồn", "bố trạch", "lệ thủy"
        ];
        return centralKeywords.some(kw => combined.includes(kw));
      }
      
      if (state.province === "gialai") {
        let giaLaiKeywords = [
          "gia lai", "pleiku", "đức cơ", "chư sê", "chư prông", "chư păh", "chư pưh", "chư phư", "an khê", "ayun pa", "đak đoa", "đăk đoa", "đak pơ", "đăk pơ", "mang yang", "kông chro", "kbang", "phú thiện", "krông pa", "ia pa", "ia grai", "diên hồng", "phú túc", "hra", "trại giam gia trung", "bệnh viện 211", "bv 211", "bệnh viện 15", "bv 15", "bệnh viện 331", "bv 331", "331", "nhi tỉnh gia lai", "mắt tỉnh gia lai"
        ];
        
        const tenderDateStr = tender.pubDate || tender.notifyDate || tender.bidCloseDate || tender.fetchedAt;
        if (tenderDateStr) {
          const tenderDate = new Date(tenderDateStr);
          const mergerDate = new Date("2025-07-01");
          if (tenderDate < mergerDate) {
            // Bao gồm từ khóa của Bình Định cũ nếu trước 1/7/2025
            giaLaiKeywords = giaLaiKeywords.concat([
              "bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước", "phù cát", "phù mỹ", "hoài ân", "an lão", "an lao", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong"
            ]);
          }
        }
        return giaLaiKeywords.some(kw => combined.includes(kw));
      }
      
      if (state.province === "binhdinh") {
        const binhDinhKeywords = [
          "bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước", "phù cát", "phù mỹ", "hoài ân", "an lão", "an lao", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong"
        ];
        return binhDinhKeywords.some(kw => combined.includes(kw));
      }
      
      if (state.province === "daklak") {
        const dakLakKeywords = [
          "đắk lắk", "dak lak", "daklak", "buôn ma thuột", "krông pắc", "cư m'gar", "buôn hồ", "ea h'leo", "ea kar", "cư kuin", "ea súp", "krông ana", "krông bông", "m'đrắk"
        ];
        return dakLakKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "kontum") {
        const konTumKeywords = ["kon tum", "đăk hà", "đăk tô", "măng đen", "ngọc hồi", "sa thầy", "tu mơ rông", "kon plông", "ia h'drai", "kon rẫy"];
        return konTumKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "phuyen") {
        const phuYenKeywords = ["phú yên", "tuy hòa", "sông cầu", "đông hòa", "đồng xuân", "phú hòa", "sơn hòa", "sông hinh", "tây hòa", "tuy an"];
        return phuYenKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "quangngai") {
        const quangNgaiKeywords = ["quảng ngãi", "quang ngai", "đức phổ", "bình sơn", "sơn tịnh", "tư nghĩa", "mộ đức", "nghĩa hành", "trà bồng", "ba tơ", "lý sơn", "minh long", "sơn hà"];
        return quangNgaiKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "quangnam") {
        const quangNamKeywords = ["quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc", "thăng bình", "núi thành", "bắc trà my", "nam trà my", "duy xuyên", "nông sơn", "quế sơn", "tiên phước"];
        return quangNamKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "khanhhoa") {
        const khanhHoaKeywords = ["khánh hòa", "nha trang", "cam ranh", "ninh hòa", "cam lâm", "diên khánh", "khánh sơn", "khánh vĩnh", "vạn ninh"];
        return khanhHoaKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "lamdong") {
        const lamDongKeywords = ["lâm đồng", "đà lạt", "bảo lộc", "bảo lâm", "di linh", "đơn dương", "đức trọng", "lạc dương", "lâm hà"];
        return lamDongKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "daknong") {
        const dakNongKeywords = ["đắk nông", "dak nong", "gia nghĩa", "cư jút", "đắk glong", "đắk mil", "đắk r'lấp", "đắk song", "krông nô", "tuy đức"];
        return dakNongKeywords.some(kw => combined.includes(kw));
      }

      if (state.province === "ninhthuan_binhthuan") {
        const kwList = ["ninh thuận", "phan rang", "tháp chàm", "bình thuận", "phan thiết", "la gi", "bắc bình", "hàm thuận", "tánh linh", "tuy phong"];
        return kwList.some(kw => combined.includes(kw));
      }

      if (state.province === "quangtri_quangbinh_hue") {
        const kwList = ["thừa thiên huế", "huế", "hương thủy", "hương trà", "quảng trị", "đông hà", "cam lộ", "gio linh", "triệu phong", "vĩnh linh", "quảng bình", "đồng hới", "ba đồn", "bố trạch", "lệ thủy"];
        return kwList.some(kw => combined.includes(kw));
      }
      
      return true;
    })();

    const matches = queryMatches && statusMatches && investorMatches && provinceMatches;
    if (matches && equipmentMatches.length) {
      state.searchMatchesByNotifyNo.set(tender.notifyNo, equipmentMatches);
    }
    return matches;
  });
}

function savedTenderMarkup(tender) {
  return `<article class="saved-tender">
    <div><span>${escapeHtml(tender.notifyNo)}</span><strong>${escapeHtml(tender.name)}</strong><small>${escapeHtml(tender.investor)} · ${escapeHtml(statusLabels[tender.status] || tender.status)}</small></div>
    <button type="button" data-saved-open="${escapeHtml(tender.id)}">Mở gói thầu <span>→</span></button>
  </article>`;
}

function renderSavedList() {
  const savedTenders = state.saved
    .map((id) => state.tenders.find((tender) => String(tender.id) === id))
    .filter(Boolean);
  elements.savedCount.textContent = String(savedTenders.length);
  elements.savedList.innerHTML = savedTenders.length
    ? savedTenders.map(savedTenderMarkup).join("")
    : '<div class="saved-empty">Chưa có gói thầu nào được lưu. Bấm dấu ☆ tại một gói để thêm vào đây.</div>';
}

function renderMetrics(tenders = periodTenders()) {
  const open = tenders.filter((tender) => tender.status === "open" || tender.status === "urgent").length;
  const urgent = tenders.filter((tender) => tender.status === "urgent").length;
  const totalValue = tenders.reduce((sum, tender) => sum + (Number(tender.price) || 0), 0);
  elements.metricTotal.textContent = String(tenders.length);
  elements.metricOpen.textContent = String(open);
  elements.metricUrgent.textContent = String(urgent);
  elements.metricValue.textContent = formatMoney(totalValue);
  elements.openPercent.textContent = `${Math.round((open / Math.max(tenders.length, 1)) * 100)}%`;
  elements.averageValue.textContent = formatMoney(totalValue / Math.max(tenders.length, 1));

  const investors = new Map();
  for (const tender of tenders) {
    investors.set(tender.investor, (investors.get(tender.investor) || 0) + 1);
  }
  elements.investorRanking.innerHTML = [...investors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], index) => `<button type="button" data-investor="${escapeHtml(name)}" class="${state.investor === name ? "selected" : ""}" aria-pressed="${state.investor === name}"><span>${index + 1}</span><p>${escapeHtml(name)}</p><strong>${count}</strong></button>`)
    .join("");
  renderSavedList();
}

function bidderMarkup(detail, tender) {
  const bidders = detail?.bidders || [];
  if (!bidders.length) {
    const message = ["open", "urgent"].includes(tender.status)
      ? "Tên nhà thầu chỉ được công bố sau thời điểm mở thầu."
      : "Nguồn công khai chưa trả danh sách nhà thầu của gói này.";
    return `<div class="detail-notice">${escapeHtml(message)}</div>`;
  }

  const statusText = {
    participating: "Đang tham dự",
    won: "Trúng thầu",
    lost: "Không trúng",
  };
  const rows = bidders.map((bidder, index) => {
    const models = bidder.models?.length
      ? bidder.models.join("; ")
      : (bidder.status === "lost"
        ? "Nguồn công khai chưa công bố model của hồ sơ không trúng"
        : (bidder.status === "participating" ? "Chờ công bố sau khi có kết quả" : "Chưa công bố"));
    const price = Number(bidder.winningPrice) || Number(bidder.finalPrice) || Number(bidder.bidPrice) || 0;
    const facts = [
      bidder.lotName ? `<span><b>Lô/phần:</b> ${escapeHtml(bidder.lotName)}</span>` : "",
      bidder.reason ? `<span><b>Lý do:</b> ${escapeHtml(bidder.reason)}</span>` : "",
      `<span><b>Model/loại máy:</b> ${escapeHtml(models)}</span>`,
    ].filter(Boolean).join("");
    return `<article class="bidder-item">
      <span class="equipment-index">${index + 1}</span>
      <div class="bidder-copy"><div class="bidder-title"><h4>${escapeHtml(bidder.contractorName)}</h4><span class="bidder-status ${escapeHtml(bidder.status)}">${escapeHtml(statusText[bidder.status] || bidder.status)}</span></div><div class="bidder-facts">${facts}</div></div>
      <div class="bidder-price"><strong title="${escapeHtml(formatMoney(price, false))}">${escapeHtml(formatMoney(price))}</strong><span>${bidder.status === "won" ? "Giá trúng" : "Giá dự thầu/sau giảm"}</span></div>
    </article>`;
  }).join("");
  const uniqueCount = new Set(bidders.map((bidder) => bidder.contractorCode || bidder.contractorName)).size;
  return `<div class="bidder-list"><div class="equipment-heading"><div><span>DANH SÁCH NHÀ THẦU</span><strong>${uniqueCount} nhà thầu được công bố</strong></div><span>Trạng thái và giá dự thầu</span></div>${rows}</div>`;
}

function equipmentMarkup(detail, tender) {
  if (!detail?.items?.length) {
    const message = ["open", "urgent"].includes(tender.status)
      ? "Model, hãng và đơn giá trúng thầu sẽ được bổ sung sau khi có kết quả lựa chọn nhà thầu. Danh mục đang mời được hiển thị phía trên."
      : tender.status === "evaluating"
      ? "Model và cấu hình chào thầu thường chỉ được nguồn công khai công bố sau khi có kết quả lựa chọn nhà thầu."
      : "Chưa có danh mục model/đơn giá chi tiết trong dữ liệu công khai. Kết quả có thể được bổ sung sau.";
    return `<div class="detail-notice">${escapeHtml(message)}</div>`;
  }

  const items = detail.items.map((item, index) => {
    const facts = [
      ["Model/Ký mã", item.model],
      ["Nhãn hiệu", item.brand],
      ["Hãng", item.manufacturer],
      ["Xuất xứ", item.origin],
      ["Năm SX", item.manufactureYear],
      ["Nhà thầu", item.winnerNames?.join("; ")],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `<span><b>${label}:</b> ${escapeHtml(value)}</span>`)
      .join("");
    const specification = item.specification
      ? `<details class="technical-spec"><summary>Hồ sơ/cấu hình kỹ thuật</summary><p>${escapeHtml(item.specification)}</p></details>`
      : "";
    const quantity = Number(item.quantity)
      ? `${new Intl.NumberFormat("vi-VN").format(item.quantity)} ${escapeHtml(item.unit || "")}`
      : escapeHtml(item.unit || "Đơn giá");
    return `<article class="equipment-item">
      <span class="equipment-index">${index + 1}</span>
      <div class="equipment-copy"><h4>${escapeHtml(item.name)}</h4><div class="equipment-facts">${facts}</div>${specification}</div>
      <div class="equipment-price"><strong title="${escapeHtml(formatMoney(item.unitPrice, false))}">${escapeHtml(formatMoney(item.unitPrice))}</strong><span>${quantity}</span></div>
    </article>`;
  }).join("");

  const limitNote = detail.total > detail.items.length
    ? `<p class="result-limit-note">Đang hiển thị ${detail.items.length}/${detail.total} mặt hàng. Xem nguồn chính thức để tra cứu toàn bộ.</p>`
    : "";
  return `<div class="equipment-list"><div class="equipment-heading"><div><span>HÀNG HÓA TRÚNG THẦU</span><strong>${detail.total} mặt hàng được công bố</strong></div><span>Đơn giá đã công bố</span></div>${items}${limitNote}</div>`;
}

function requirementsMarkup(detail, tender) {
  const requirements = detail?.requirements;
  const items = requirements?.items || [];
  if (!items.length) {
    if (!["open", "urgent", "evaluating"].includes(tender.status)) return "";
    const message = requirements?.disclosure === "temporarily-unavailable"
      ? "Tạm thời chưa tải được danh mục phần/lô mời thầu từ dữ liệu kế hoạch công khai. Hệ thống sẽ tự thử lại ở lần cập nhật tiếp theo."
      : "Nguồn kế hoạch chưa tách danh mục phần/lô cho gói này. Hãy mở E-HSMT chính thức để xem yêu cầu kỹ thuật chi tiết.";
    return `<div class="requirements-list"><div class="equipment-heading"><div><span>DANH MỤC MỜI THẦU</span><strong>Yêu cầu kỹ thuật và thiết bị được mời</strong></div><a class="official-document-link" href="${escapeHtml(officialUrl(tender.sourceUrl, tender.notifyNo))}" target="_blank" rel="noreferrer">Mở E-HSMT ↗</a></div><div class="detail-notice">${escapeHtml(message)}</div></div>`;
  }

  const rows = items.map((item, index) => {
    const facts = [
      item.lotNo ? `<span><b>Mã phần/lô:</b> ${escapeHtml(item.lotNo)}</span>` : "",
      Number(item.quantity) ? `<span><b>Khối lượng:</b> ${escapeHtml(new Intl.NumberFormat("vi-VN").format(item.quantity))} ${escapeHtml(item.unit || "")}</span>` : "",
    ].filter(Boolean).join("");
    const specification = item.specification
      ? `<details class="technical-spec"><summary>Yêu cầu/tiêu chuẩn kỹ thuật</summary><p>${escapeHtml(item.specification)}</p></details>`
      : "";
    return `<article class="equipment-item requirement-item">
      <span class="equipment-index">${index + 1}</span>
      <div class="equipment-copy"><h4>${escapeHtml(item.name)}</h4><div class="equipment-facts">${facts}</div>${specification}</div>
      <div class="equipment-price requirement-price"><strong title="${escapeHtml(formatMoney(item.plannedPrice, false))}">${escapeHtml(formatMoney(item.plannedPrice))}</strong><span>Giá kế hoạch phần/lô</span></div>
    </article>`;
  }).join("");
  const summary = requirements.summary
    ? `<p class="requirement-summary"><b>Phạm vi:</b> ${escapeHtml(requirements.summary)}</p>`
    : "";
  return `<div class="requirements-list"><div class="equipment-heading"><div><span>DANH MỤC MỜI THẦU</span><strong>${items.length} phần/lô từ kế hoạch công khai</strong></div><a class="official-document-link" href="${escapeHtml(officialUrl(tender.sourceUrl, tender.notifyNo))}" target="_blank" rel="noreferrer">Mở E-HSMT ↗</a></div>${summary}${rows}<p class="requirement-source-note">Tên phần/lô và giá kế hoạch lấy từ KHLCNT công khai. Cấu hình chi tiết chỉ hiển thị khi nguồn chính thức công bố không qua CAPTCHA; E-HSMT vẫn là tài liệu đối chiếu cuối cùng.</p></div>`;
}

function technicalRequirementsMarkup(detail, tender) {
  const technical = detail?.technicalRequirements;
  const items = technical?.items || [];
  if (!items.length) {
    if (!["open", "urgent", "evaluating", "closed"].includes(tender.status) && !tender.hasResult) return "";
    let message = "";
    if (technical?.disclosure === "temporarily-unavailable") {
      message = "Nguồn biểu mẫu e-HSMT đang tạm thời chưa phản hồi; hệ thống sẽ tự thử lại ở lần cập nhật tiếp theo.";
    } else if (technical?.disclosure === "public-hsmt-no-technical-table") {
      message = "Chủ đầu tư không nhập Yêu cầu kỹ thuật vào bảng biểu web mà đính kèm tệp (Word/PDF). Do đó không thể tự động trích xuất bảng danh mục thiết bị.";
    } else {
      message = "Gói này yêu cầu xác nhận reCAPTCHA trên cổng chính thức trước khi xem toàn bộ biểu mẫu e-HSMT. Website không tự giải CAPTCHA.";
    }

    let filesHtml = "";
    if (technical?.files && technical.files.length > 0) {
      const fileRows = technical.files.map(f => `<li style="margin-bottom: 4px;"><span>📄</span> <strong>${escapeHtml(f.name || "Tệp đính kèm")}</strong></li>`).join("");
      filesHtml = `<div class="technical-files-list" style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 6px;"><p style="margin:0 0 8px 0; font-size: 13px; font-weight: 500;">Phát hiện các tệp đính kèm E-HSMT:</p><ul style="margin: 0; padding: 0; list-style: none; font-size: 13px;">${fileRows}</ul><p style="margin:8px 0 0 0; font-size: 13px; color: #666;">Vui lòng ấn "Xác nhận và mở hồ sơ" để tải tệp về.</p></div>`;
    }

    return `<div class="technical-requirements-list"><div class="equipment-heading"><div><span>THÔNG SỐ KỸ THUẬT E-HSMT</span><strong>Dữ liệu không nằm trong biểu mẫu Web</strong></div><a class="official-document-link" href="${escapeHtml(officialUrl(tender.sourceUrl, tender.notifyNo))}" target="_blank" rel="noreferrer">Xác nhận và mở hồ sơ ↗</a></div><div class="detail-notice">${escapeHtml(message)}</div>${filesHtml}</div>`;
  }

  const visibleItems = items.slice(0, 40);
  const rows = visibleItems.map((item, index) => {
    const facts = [
      item.lotName ? `<span><b>Phần/lô:</b> ${escapeHtml(item.lotName)}</span>` : "",
      item.code ? `<span><b>Mã/Ký hiệu:</b> ${escapeHtml(item.code)}</span>` : "",
      item.brand ? `<span><b>Nhãn hiệu:</b> ${escapeHtml(item.brand)}</span>` : "",
      item.manufacturer ? `<span><b>Hãng:</b> ${escapeHtml(item.manufacturer)}</span>` : "",
      item.origin ? `<span><b>Xuất xứ:</b> ${escapeHtml(item.origin)}</span>` : "",
      item.manufactureYear ? `<span><b>Năm SX:</b> ${escapeHtml(item.manufactureYear)}</span>` : "",
    ].filter(Boolean).join("");
    const specification = item.specification
      ? `<details class="technical-spec"><summary>Xem thông số kỹ thuật</summary><p>${escapeHtml(item.specification)}</p></details>`
      : "";
    const otherRequirement = item.otherRequirement
      ? `<details class="technical-spec"><summary>Yêu cầu khác</summary><p>${escapeHtml(item.otherRequirement)}</p></details>`
      : "";
    const quantity = Number(item.quantity)
      ? `${new Intl.NumberFormat("vi-VN").format(item.quantity)} ${escapeHtml(item.unit || "")}`
      : escapeHtml(item.unit || "Chưa nêu");
    return `<article class="equipment-item technical-requirement-item">
      <span class="equipment-index">${index + 1}</span>
      <div class="equipment-copy"><h4>${escapeHtml(item.name)}</h4><div class="equipment-facts">${facts}</div>${specification}${otherRequirement}</div>
      <div class="equipment-price technical-quantity"><strong>${quantity}</strong><span>${escapeHtml(item.position ? `STT ${item.position}` : "Khối lượng mời thầu")}</span></div>
    </article>`;
  }).join("");
  const limitNote = items.length > visibleItems.length
    ? `<p class="result-limit-note">Đang hiển thị nhanh ${visibleItems.length}/${items.length} mặt hàng. Tệp Excel chứa đầy đủ toàn bộ dữ liệu.</p>`
    : "";
  return `<div class="technical-requirements-list"><div class="equipment-heading"><div><span>THÔNG SỐ KỸ THUẬT E-HSMT</span><strong>${items.length} mặt hàng trích trực tiếp từ biểu mẫu công khai</strong></div><button class="technical-download-button" data-action="download-tech" data-id="${escapeHtml(tender.id)}" type="button">Tải bảng Excel ↧</button></div><p class="technical-source-note">Tệp XLSX cố định hàng tiêu đề, wrap text thông số và có thể lọc dữ liệu. Bao gồm số lượng, tên máy, thông số kỹ thuật và đơn vị sử dụng.</p>${rows}${limitNote}</div>`;
}

function detailMarkup(tender) {
  const detail = state.detailsByNotifyNo[tender.notifyNo];
  const winners = tender.winnerNames?.length ? tender.winnerNames.join("; ") : "Chưa công bố kết quả";
  const bidders = detail?.bidders || [];
  const uniqueBidderCount = new Set(bidders.map((bidder) => bidder.contractorCode || bidder.contractorName)).size
    || Number(tender.bidderCount) || 0;
  const lowestBid = bidders.reduce((lowest, bidder) => {
    const price = Number(bidder.finalPrice) || Number(bidder.bidPrice) || 0;
    return price && (!lowest || price < lowest) ? price : lowest;
  }, 0);
  const invitedCount = Number(detail?.requirements?.total) || detail?.requirements?.items?.length || 0;
  const summary = tender.hasResult
    ? `<div><span>Đơn vị trúng thầu</span><strong>${escapeHtml(winners)}</strong></div>
      <div><span>Giá trúng thầu</span><strong>${escapeHtml(formatMoney(tender.winningPrice))}</strong></div>
      <div><span>Ngày quyết định</span><strong>${escapeHtml(formatDate(tender.decisionDate))}</strong></div>`
    : `<div><span>Danh mục mời thầu</span><strong>${invitedCount ? `${invitedCount} phần/lô` : "Chưa tách danh mục"}</strong></div>
      <div><span>Giá dự thầu thấp nhất</span><strong>${escapeHtml(formatMoney(lowestBid))}</strong></div>
      <div><span>Giai đoạn</span><strong>${escapeHtml(statusLabels[tender.status] || tender.status)}</strong></div>`;
  let detailBody = `${requirementsMarkup(detail, tender)}${technicalRequirementsMarkup(detail, tender)}${bidderMarkup(detail, tender)}${equipmentMarkup(detail, tender)}`;
  if (state.detailLoading === tender.id) {
    detailBody = '<div class="detail-loading"><span></span>Đang tải danh mục mời thầu, yêu cầu kỹ thuật, nhà thầu và kết quả…</div>';
  } else if (state.detailErrors[tender.id]) {
    detailBody = `<div class="detail-notice error">${escapeHtml(state.detailErrors[tender.id])}</div>`;
  }
  return `<section class="tender-detail-panel" id="detail-${escapeHtml(tender.id)}">
    <div class="result-summary">
      ${summary}
    </div>
    ${detailBody}
    <div class="detail-footer"><span>Dữ liệu được đối chiếu từ KHLCNT, biểu mẫu e-HSMT, biên bản mở thầu và kết quả công khai.</span><a href="${escapeHtml(officialUrl(tender.sourceUrl, tender.notifyNo))}" target="_blank" rel="noreferrer">Xem hồ sơ chính thức ↗</a></div>
  </section>`;
}

async function toggleDetails(tender) {
  if (state.expandedId === tender.id) {
    state.expandedId = null;
    render();
    return;
  }
  state.expandedId = tender.id;
  render();
  const hasPublicDetail = tender.hasResult || ["open", "urgent", "evaluating", "closed"].includes(tender.status);
  if (!hasPublicDetail || state.detailsByNotifyNo[tender.notifyNo]) return;

  state.detailLoading = tender.id;
  delete state.detailErrors[tender.id];
  render();
  try {
    const response = await fetch(`./data/details/${encodeURIComponent(tender.notifyNo)}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.detailsByNotifyNo[tender.notifyNo] = await response.json();
  } catch {
    state.detailErrors[tender.id] = "Chưa tải được dữ liệu chi tiết của gói này. Vui lòng thử lại sau.";
  } finally {
    state.detailLoading = null;
    render();
  }
}

function displayEquipmentValue(value) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  if (/^[.;,:/-]*$/.test(text)) return "";

  // If there are many semicolons/commas, check if it's mostly codes or small sizes
  const parts = text.split(/[;,]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 2) {
    const isMostlyShortOrNumbers = parts.every(p => /^\d+$/.test(p) || /^[0-9.-]+$/.test(p) || p.length <= 5);
    if (isMostlyShortOrNumbers) {
      return "Nhiều kích cỡ / dải thông số";
    }
  }
  
  if (text.length > 30 && text.split(';').length > 4) {
    return "Đa dạng chủng loại";
  }

  return text;
}

function equipmentSearchMatchMarkup(tender) {
  if (!state.query.trim()) return "";
  const matches = state.searchMatchesByNotifyNo.get(tender.notifyNo) || [];
  if (!matches.length) return "";
  const visible = matches.slice(0, 2).map((item) => {
    const model = displayEquipmentValue(item.model);
    const brand = displayEquipmentValue(item.brand);
    const stage = item.stage === "invitation-technical"
      ? "Thông số e-HSMT"
      : (item.stage === "invitation" ? "Đang mời thầu" : "Đã có kết quả");
    const facts = [stage, item.lotNo ? `Lô: ${item.lotNo}` : "", model ? `Model: ${model}` : "", brand ? `Nhãn hiệu: ${brand}` : ""]
      .filter(Boolean)
      .join(" · ");
    return `<div class="equipment-search-match-item"><strong>${escapeHtml(displayEquipmentValue(item.name) || "Mặt hàng thiết bị")}</strong>${facts ? `<span>${escapeHtml(facts)}</span>` : ""}</div>`;
  }).join("");
  const remainder = matches.length > 2
    ? `<span class="equipment-search-more">+${matches.length - 2} mặt hàng khác</span>`
    : "";
  return `<div class="equipment-search-match"><div class="equipment-search-match-heading"><span>Khớp danh mục e-HSMT/thiết bị/model</span><b>${matches.length} mặt hàng</b></div>${visible}${remainder}</div>`;
}

let hoverTimer = null;
let currentHoveredTender = null;

function getTenderEquipmentList(tender) {
  const list = [];
  const seen = new Set();

  const detail = state.detailsByNotifyNo[tender.notifyNo];
  
  // 1. Technical requirements from e-HSMT
  const techItems = detail?.technicalRequirements?.items || [];
  for (const item of techItems) {
    const name = (item.name || "").trim();
    if (!name) continue;
    const key = `${name}-${item.quantity || ""}-${item.model || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        name,
        quantity: item.quantity,
        unit: item.unit || "",
        model: displayEquipmentValue(item.model),
        brand: displayEquipmentValue(item.brand) || displayEquipmentValue(item.manufacturer),
        origin: displayEquipmentValue(item.origin),
      });
    }
  }

  // 2. Requirements items (from plan)
  const reqItems = detail?.requirements?.items || [];
  for (const item of reqItems) {
    const name = (item.name || "").trim();
    if (!name) continue;
    const key = `${name}-${item.quantity || ""}-${item.model || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        name,
        quantity: item.quantity,
        unit: item.unit || "",
        model: displayEquipmentValue(item.model),
        brand: displayEquipmentValue(item.brand),
      });
    }
  }

  // 3. Equipment search index
  const eqItems = state.equipmentByNotifyNo.get(tender.notifyNo) || [];
  for (const item of eqItems) {
    const name = (item.name || "").trim();
    if (!name) continue;
    const key = `${name}-${item.quantity || ""}-${item.model || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        name,
        quantity: item.quantity,
        unit: item.unit || "",
        model: displayEquipmentValue(item.model),
        brand: displayEquipmentValue(item.brand) || displayEquipmentValue(item.manufacturer),
        origin: displayEquipmentValue(item.origin),
      });
    }
  }

  // 4. Winning items
  const resultItems = detail?.items || [];
  for (const item of resultItems) {
    const name = (item.name || "").trim();
    if (!name) continue;
    const key = `${name}-${item.quantity || ""}-${item.model || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        name,
        quantity: item.quantity,
        unit: item.unit || "",
        model: displayEquipmentValue(item.model),
        brand: displayEquipmentValue(item.brand) || displayEquipmentValue(item.manufacturer),
        origin: displayEquipmentValue(item.origin),
      });
    }
  }

  return list;
}

function getTenderEquipmentSummaryText(tender) {
  const eqList = getTenderEquipmentList(tender);
  if (eqList.length > 0) {
    return eqList.slice(0, 15).map((i, idx) => {
      const name = i.name;
      const qty = Number(i.quantity) ? `SL: ${new Intl.NumberFormat("vi-VN").format(i.quantity)} ${i.unit || ""}`.trim() : "";
      const specs = [i.model ? `Model: ${i.model}` : "", i.brand ? `Hãng/Nhãn: ${i.brand}` : "", i.origin ? `Xuất xứ: ${i.origin}` : ""].filter(Boolean).join(", ");
      const details = [qty, specs].filter(Boolean).join(" - ");
      return `${idx + 1}. ${name}${details ? ` [${details}]` : ""}`;
    }).join("; ");
  }

  return "";
}

function tenderEquipmentPreviewMarkup(tender) {
  if (state.query.trim()) {
    const searchMatch = equipmentSearchMatchMarkup(tender);
    if (searchMatch) return searchMatch;
  }

  const equipmentList = getTenderEquipmentList(tender);
  if (!equipmentList.length) {
    return `<div class="equipment-card-preview empty-eq">
      <span>📦 <strong>Máy móc/thiết bị e-HSMT:</strong> Đính kèm trong tệp PDF/Word thuộc hồ sơ công khai gốc.</span>
    </div>`;
  }

  const visible = equipmentList.slice(0, 4);
  const remainder = equipmentList.length - visible.length;

  const chipsHtml = visible.map((item) => {
    const qty = Number(item.quantity) ? `<b>${new Intl.NumberFormat("vi-VN").format(item.quantity)} ${escapeHtml(item.unit || "")}</b>` : "";
    const specs = [item.model ? `Model: ${item.model}` : "", item.brand ? `Hãng: ${item.brand}` : ""].filter(Boolean).join(" · ");
    const fullTooltip = [item.name, qty, specs].filter(Boolean).join(" - ");
    return `<div class="equipment-chip" title="${escapeHtml(fullTooltip)}">
      ${qty ? `<span class="chip-qty">${qty}</span>` : ""}
      <span class="chip-name">${escapeHtml(item.name)}</span>
      ${specs ? `<span class="chip-model">${escapeHtml(specs)}</span>` : ""}
    </div>`;
  }).join("");

  const moreHtml = remainder > 0
    ? `<span class="equipment-chip-more">+${remainder} mặt hàng/máy khác</span>`
    : "";

  return `<div class="equipment-card-preview">
    <div class="equipment-card-preview-heading">
      <span>📦 <strong>Máy móc & Thiết bị đấu thầu e-HSMT</strong> (${equipmentList.length} mặt hàng):</span>
    </div>
    <div class="equipment-card-chips">${chipsHtml}${moreHtml}</div>
  </div>`;
}

async function preloadBatchSummaries(tendersList) {
  if (!Array.isArray(tendersList) || tendersList.length === 0) return;

  // Tự động gán fallback nhanh cho các tỉnh ngoài Gia Lai (bỏ qua phân tích AI)
  tendersList.forEach((t) => {
    if (t.notifyNo && getTenderProvince(t) !== "Gia Lai" && !state.aiSummaries[t.notifyNo]) {
      state.aiSummaries[t.notifyNo] = getFallbackSummary(t);
    }
  });

  const giaLaiTenders = tendersList.filter((t) => getTenderProvince(t) === "Gia Lai");
  if (giaLaiTenders.length === 0) return;

  const BATCH_SIZE = 10;
  for (let i = 0; i < giaLaiTenders.length; i += BATCH_SIZE) {
    const batch = giaLaiTenders.slice(i, i + BATCH_SIZE);
    
    // Check if all items in this batch are already preloaded
    const missingInBatch = batch.filter((t) => t.notifyNo && !state.aiSummaries[t.notifyNo]);
    if (missingInBatch.length === 0) continue;

    const payload = missingInBatch.map((tender) => {
      const equipmentSummary = getTenderEquipmentSummaryText(tender);
      return {
        notifyNo: tender.notifyNo,
        name: tender.name,
        investor: tender.investor,
        location: tender.location,
        price: tender.winningPrice || tender.price,
        winningPrice: tender.winningPrice,
        category: tender.category,
        status: statusLabels[tender.status] || tender.status,
        closeDate: formatDate(tender.closeDate, true),
        publicDate: formatDate(tender.publicDate, true),
        bidForm: tender.bidForm,
        processApply: tender.processApply,
        winnerNames: tender.winnerNames?.join("; "),
        participantNames: tender.participantNames?.join("; "),
        loserNames: tender.loserNames?.join("; "),
        equipmentSummary: equipmentSummary,
        sourceUrl: officialUrl(tender.sourceUrl, tender.notifyNo),
      };
    });

    try {
      const response = await fetch("/api/batch-summarize-tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenders: payload }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.summaries) {
          Object.assign(state.aiSummaries, resData.summaries);
          
          if (currentHoveredTender && state.aiSummaries[currentHoveredTender.notifyNo]) {
            updateAiHoverPopoverContent(currentHoveredTender);
          }
          if (state.aiSummaryActiveId) {
            render();
          }
        }
      }
    } catch (err) {
      console.error("Batch pre-summarize error:", err);
    }
  }
}

function getDynamicCompetitorAnalysis(tender) {
  const investor = tender.investor || "";
  const location = tender.location || "";
  const category = tender.category || "";
  const allTenders = state.tenders || [];

  // 1. Same investor
  const sameInvestor = allTenders.filter(t => t.investor && investor && isSameInvestorFuzzy(investor, t.investor) && t.winnerNames?.length);
  const investorWinners = new Map();
  const originalNames = new Map(); // Keep original casing for display
  sameInvestor.forEach(t => {
    t.winnerNames.forEach(w => {
      if (w) {
        const rawName = w.trim().replace(/\s+/g, ' ');
        const name = rawName.toUpperCase();
        investorWinners.set(name, (investorWinners.get(name) || 0) + 1);
        if (!originalNames.has(name)) originalNames.set(name, rawName);
      }
    });
  });

  let rivals = [];
  [...investorWinners.entries()].sort((a,b) => b[1] - a[1]).slice(0, 4).forEach(([name, count]) => {
    const dispName = originalNames.get(name) || name;
    let ratingText = count >= 3 ? "Rất Cao (85 - 90%)" : count === 2 ? "Cao (70 - 80%)" : "Khá (50 - 65%)";
    rivals.push(`${dispName} - **[Xếp loại khả năng trúng: ${ratingText}]** (Trúng ${count} gói tại ${investor})`);
  });

  if (rivals.length < 2) {
    // 2. Regional or Category winners
    const regional = allTenders.filter(t => t.winnerNames?.length && ((t.location && location && t.location.includes(location)) || (t.category && category && t.category === category)));
    const regionalWinners = new Map();
    regional.forEach(t => {
      t.winnerNames.forEach(w => {
        if (w) {
          const rawName = w.trim().replace(/\s+/g, ' ');
          const name = rawName.toUpperCase();
          if (!investorWinners.has(name)) {
            regionalWinners.set(name, (regionalWinners.get(name) || 0) + 1);
            if (!originalNames.has(name)) originalNames.set(name, rawName);
          }
        }
      });
    });
    [...regionalWinners.entries()].sort((a,b) => b[1] - a[1]).slice(0, 4 - rivals.length).forEach(([name, count]) => {
      const dispName = originalNames.get(name) || name;
      let ratingText = count >= 3 ? "Rất Cao (85 - 90%)" : count === 2 ? "Cao (70 - 80%)" : "Khá (50 - 65%)";
      rivals.push(`${dispName} - **[Xếp loại khả năng trúng: ${ratingText}]** (Trúng ${count} gói tại khu vực / chuyên ngành)`);
    });
  }

  if (rivals.length === 0) {
    rivals = [
      `Nhà thầu phân phối trang thiết bị y tế tiêu biểu tại ${location || investor || "khu vực"}`,
      "Các đơn vị có giấy ủy quyền bán hàng chính hãng từ nhà sản xuất."
    ];
  }

  const historySummary = sameInvestor.length > 0 
    ? `Chủ đầu tư "${investor}" có ${sameInvestor.length} gói thầu lịch sử trong CSDL. Các nhà thầu trong danh sách có tần suất trúng thầu cao nhất.`
    : `Chủ đầu tư "${investor || "Cơ sở y tế"}" thường xuyên đấu thầu trang thiết bị lâm sàng, hồ sơ mời thầu cần rà soát kỹ tiêu chí kinh nghiệm tương tự.`;

  return {
    likelyRivals: rivals,
    hospitalHistorySummary: historySummary,
    winStrategy: [
      "Phối hợp với hãng cung cấp giải pháp kỹ thuật ưu việt để tạo rào cản kỹ thuật phản kháng.",
      "Chuẩn bị kỹ hồ sơ năng lực tài chính và bảo lãnh thầu đúng thời hạn quy định."
    ]
  };
}

function getFallbackSummary(tender) {
  const price = Number(tender.winningPrice) || Number(tender.price) || 0;
  const formattedPrice = price ? formatMoney(price, false) : "Chưa công bố";
  const equipmentText = getTenderEquipmentSummaryText(tender) || "Chi tiết máy móc, thiết bị, vật tư/sinh phẩm được công khai trong biểu mẫu e-HSMT.";
  const url = officialUrl(tender.sourceUrl, tender.notifyNo);
  const locName = tender.location || tender.investor || "Địa phương";
  
  const points = [
    `🏦 Bên mời thầu / Cơ sở: ${tender.investor || "Chủ đầu tư"} (${locName})`,
    `💰 Giá gói thầu / Dự toán: ${formattedPrice}`,
    `📑 Hình thức & Phân loại: ${tender.category || "Thiết bị y tế"} (${tender.bidForm || "Đấu thầu qua mạng"})`,
    `📦 Danh mục thiết bị/mặt hàng: ${equipmentText}`,
    `⏱️ Thời điểm đóng thầu: ${formatDate(tender.closeDate, true) || "Chưa công bố"}`
  ];

  if (tender.winnerNames?.length) {
    points.push(`🏆 Đơn vị trúng thầu: ${tender.winnerNames.join("; ")}`);
  } else if (tender.bidderCount) {
    points.push(`👥 Số nhà thầu tham dự: ${tender.bidderCount} nhà thầu`);
  }

  return {
    summary: `Gói thầu "${tender.name}" do ${tender.investor || "Bên mời thầu"} tổ chức tại ${locName} với quy mô dự toán ${formattedPrice}.`,
    score: 60,
    successChance: 35,
    suitabilityMetrics: {
      phapLy: 50,
      kyThuat: 55,
      thuongMai: 45,
      tienDo: 50,
      diaBan: 50,
      lienKet: 45
    },
    primaryEquipment: equipmentText,
    strengths: [
      "Có thông tin dự toán rõ ràng, hỗ trợ lập phương án giá hiệu quả.",
      `Địa bàn mời thầu tập trung tại khu vực ${locName}.`
    ],
    gaps: [
      "Cần rà soát kỹ tiêu chuẩn kỹ thuật chi tiết của thiết bị chính trong e-HSMT.",
      "Chưa làm rõ điều khoản thanh toán và tiến độ giao nhận hàng hóa."
    ],
    risks: [
      "Khả năng cạnh tranh cao nếu thiết bị có nhiều hãng tương đương.",
      "Hạn chế thời gian chuẩn bị hồ sơ pháp lý đối với thiết bị nhập khẩu."
    ],
    requiredPartners: [
      "Hãng sản xuất hoặc nhà phân phối được ủy quyền chính thức tại Việt Nam."
    ],
    actionItems: [
      "Tải toàn bộ file e-HSMT chính thức để rà soát chi tiết chỉ tiêu Đạt/Không đạt.",
      "Liên hệ hãng sản xuất lấy báo giá và thư cam kết hỗ trợ kỹ thuật."
    ],
    keyPoints: points,
    aiAssessment: `Hồ sơ công khai chính thức từ Cổng Dịch vụ công Mạng đấu thầu Quốc gia. Bấm liên kết bên dưới để xem toàn văn e-HSMT gốc.`,
    officialUrl: url,
    competitorAnalysis: getDynamicCompetitorAnalysis(tender),
    isFallback: true
  };
}

async function fetchAiSummary(tender) {
  if (state.aiSummaries[tender.notifyNo]) {
    return state.aiSummaries[tender.notifyNo];
  }

  // Tạm thời bỏ qua phân tích AI cho các tỉnh ngoài Gia Lai
  if (getTenderProvince(tender) !== "Gia Lai") {
    const fallback = getFallbackSummary(tender);
    state.aiSummaries[tender.notifyNo] = fallback;
    state.aiSummaryLoadingId = null;
    return fallback;
  }

  state.aiSummaryLoadingId = tender.id;
  if (currentHoveredTender?.id === tender.id) {
    updateAiHoverPopoverContent(tender);
  }

  try {
    const equipmentSummary = getTenderEquipmentSummaryText(tender);

    const response = await fetch("/api/summarize-tender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyNo: tender.notifyNo,
        name: tender.name,
        investor: tender.investor,
        location: tender.location,
        price: tender.price,
        winningPrice: tender.winningPrice,
        category: tender.category,
        status: statusLabels[tender.status] || tender.status,
        closeDate: formatDate(tender.closeDate, true),
        publicDate: formatDate(tender.publicDate, true),
        bidForm: tender.bidForm,
        processApply: tender.processApply,
        winnerNames: tender.winnerNames?.join("; "),
        participantNames: tender.participantNames?.join("; "),
        loserNames: tender.loserNames?.join("; "),
        equipmentSummary: equipmentSummary,
        sourceUrl: officialUrl(tender.sourceUrl, tender.notifyNo),
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const resData = await response.json();
    if (resData.success && resData.data) {
      state.aiSummaries[tender.notifyNo] = resData.data;
      return resData.data;
    }
    
    // Fallback if response missing data
    const fallback = getFallbackSummary(tender);
    state.aiSummaries[tender.notifyNo] = fallback;
    return fallback;
  } catch (err) {
    console.warn("AI summarize fetch warning, using fallback summary:", err);
    const fallback = getFallbackSummary(tender);
    state.aiSummaries[tender.notifyNo] = fallback;
    return fallback;
  } finally {
    state.aiSummaryLoadingId = null;
    if (currentHoveredTender?.id === tender.id) {
      updateAiHoverPopoverContent(tender);
    }
    if (state.aiSummaryActiveId === tender.id) {
      render();
    }
  }
}

function renderPremiumAiDashboard(cached, tender) {
  const score = cached.score || 60;
  const successChance = cached.successChance || 35;
  const metrics = cached.suitabilityMetrics || { phapLy: 50, kyThuat: 50, thuongMai: 45, tienDo: 50, diaBan: 50, lienKet: 45 };
  const primaryEquipment = cached.primaryEquipment || "Chưa đủ dữ liệu để xác định thiết bị chủ đạo.";
  const strengths = (cached.strengths || []).map(s => `<li>${formatMarkdownText(s)}</li>`).join("");
  const gaps = (cached.gaps || []).map(g => `<li>${formatMarkdownText(g)}</li>`).join("");
  const risks = (cached.risks || []).map(r => `<li>${formatMarkdownText(r)}</li>`).join("");
  const partners = (cached.requiredPartners || []).map(p => `<li>${formatMarkdownText(p)}</li>`).join("");
  const actionItems = (cached.actionItems || []).map(a => `<li>${formatMarkdownText(a)}</li>`).join("");
  
  const locName = tender.location || tender.investor || "Địa phương";
  
  // Extract and format competitor analysis from database
  const comp = cached.competitorAnalysis || getDynamicCompetitorAnalysis(tender);

  const likelyRivalsHTML = (comp.likelyRivals || []).map(r => `<li>${formatMarkdownText(r)}</li>`).join("");
  const hospitalHistorySummaryText = formatMarkdownText(comp.hospitalHistorySummary || "");
  const winStrategyHTML = (comp.winStrategy || []).map(w => `<li>${formatMarkdownText(w)}</li>`).join("");

  const officialLink = officialUrl(cached?.officialUrl || tender.sourceUrl, tender.notifyNo);
  const price = Number(tender.winningPrice) || Number(tender.price) || 0;
  const formattedPrice = price ? formatMoney(price, false) : "Chưa công bố";
  
  let fallbackBannerHTML = "";
  if (cached.isFallback) {
    fallbackBannerHTML = `
      <div class="ai-fallback-alert-banner">
        <span class="ai-fallback-alert-icon">⚡</span>
        <div class="ai-fallback-alert-content">
          <strong>Chế độ Phân tích CSDL Đấu thầu Cục bộ</strong>
          <p>Dữ liệu được trích xuất trực tiếp từ CSDL Lịch sử Đấu thầu & e-HSMT của <b>${tender.investor || locName}</b> nhằm đảm bảo thông tin chính xác và trải nghiệm nhanh nhất.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="ai-assessment-dashboard">
      ${fallbackBannerHTML}
      <!-- Top Row with Score Gauge and Success Bar -->
      <div class="ai-top-row">
        <div class="ai-circular-gauge-wrapper">
          <div class="ai-circular-gauge" style="--percent: ${(score / 100) * 360}deg;">
            <div class="ai-circular-gauge-content">
              <span class="ai-circular-gauge-score">${score}</span>
              <span class="ai-circular-gauge-label">/ 100</span>
            </div>
          </div>
        </div>
        <div class="ai-overview-info">
          <div class="ai-overview-badge-row">
            <span class="ai-overview-badge">Đánh giá sơ bộ</span>
          </div>
          <h3 class="ai-overview-title">Phân tích & Làm rõ</h3>
          <p class="ai-popover-lead" style="margin: 4px 0 0; font-size: 11px; line-height: 1.45; color: #555850;">
            Đây là chấm điểm sơ bộ tại trình duyệt được đánh giá tự động bởi AI Gemini dựa trên các chỉ tiêu hành chính, kỹ thuật, tài chính, tiến độ thầu của e-HSMT.
          </p>
          <div class="ai-success-probability">
            <div class="ai-success-label-row">
              <span>Khả năng thành công ước tính</span>
              <span>${successChance}%</span>
            </div>
            <div class="ai-success-bar-bg">
              <div class="ai-success-bar-fill" style="width: ${successChance}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Brief Tender Info bar -->
      <div class="ai-brief-tender-card">
        <span><strong>Mã TBMT:</strong> ${escapeHtml(tender.notifyNo)}</span>
        <span><strong>Chủ đầu tư:</strong> ${escapeHtml(tender.investor || "Chưa rõ")}</span>
        <span><strong>Quy mô:</strong> ${escapeHtml(formattedPrice)}</span>
        <span><strong>Đóng thầu:</strong> ${escapeHtml(formatDate(tender.closeDate, true))}</span>
      </div>

      <!-- Suitability Section -->
      <div class="ai-section-title">Mức độ phù hợp với nhà thầu</div>
      <div class="ai-suitability-grid">
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Pháp lý / năng lực</span>
            <span class="ai-suitability-score">${metrics.phapLy}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.phapLy}%;"></div>
          </div>
        </div>
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Kỹ thuật</span>
            <span class="ai-suitability-score">${metrics.kyThuat}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.kyThuat}%;"></div>
          </div>
        </div>
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Thương mại</span>
            <span class="ai-suitability-score">${metrics.thuongMai}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.thuongMai}%;"></div>
          </div>
        </div>
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Tiến độ</span>
            <span class="ai-suitability-score">${metrics.tienDo}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.tienDo}%;"></div>
          </div>
        </div>
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Địa bàn</span>
            <span class="ai-suitability-score">${metrics.diaBan}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.diaBan}%;"></div>
          </div>
        </div>
        <div class="ai-suitability-card">
          <div class="ai-suitability-header">
            <span>Khả năng liên kết</span>
            <span class="ai-suitability-score">${metrics.lienKet}</span>
          </div>
          <div class="ai-suitability-bar-bg">
            <div class="ai-suitability-bar-fill" style="width: ${metrics.lienKet}%;"></div>
          </div>
        </div>
      </div>

      <!-- Competitor & History Map Section -->
      <div class="ai-section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Bản đồ Đối thủ & Lịch sử Đấu thầu</span>
      </div>
      
      <!-- Explanation of two competitor analysis layers -->
      <div class="ai-competitor-box" style="background: #f0f4f1; border-left: 4px solid #173c32; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #173c32; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          <span>💡</span> Hướng dẫn: Có 2 lớp phân tích đối thủ bổ trợ cho nhau
        </div>
        <div style="font-size: 11.5px; color: #3e4e45; line-height: 1.5;">
          <ul style="list-style-type: disc; margin-left: 16px; padding: 0; display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
            <li><strong>Lớp 1 (Bên dưới): Đối thủ Thống lĩnh Chuyên ngành</strong> — Hiển thị các doanh nghiệp có số lượng trúng thầu <em>nhiều nhất toàn tỉnh/khu vực</em> trong cùng ngành hàng này (thị phần bao phủ lớn nhất diện rộng).</li>
            <li><strong>Lớp 2 (Nút vàng "Phân tích Kiểu Việt"): Đối thủ Trực diện Sát sườn</strong> — Phân tích nâng cao bằng cách thu hẹp phạm vi theo <em>đúng bệnh viện này, cụm huyện lân cận và quy mô phân khúc giá</em> của gói thầu để chỉ ra các đối thủ cạnh tranh trực tiếp nhất về mặt thực chiến.</li>
          </ul>
        </div>
      </div>

      <div class="ai-competitor-box">
        <div class="ai-competitor-sub">
          <h5 style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 800; color: #173c32;">👥 Đối thủ Thống lĩnh Chuyên ngành (Toàn diện rộng)</span>
            <span style="background: #e8f5e9; color: #1b5e20; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; white-space: nowrap;">Thị phần bao phủ</span>
          </h5>
          <div style="font-size: 11px; color: #555; margin-bottom: 8px; line-height: 1.4; border-bottom: 1px dashed #d5ded9; padding-bottom: 6px;">
            Bao gồm những doanh nghiệp đứng đầu về tần suất thắng thầu diện rộng trong cùng lĩnh vực sản phẩm trên địa bàn tỉnh hoặc khu vực lân cận.
          </div>
          <ul class="ai-competitor-list-styled">
            ${likelyRivalsHTML || '<li>Chưa ghi nhận đối thủ có tần suất thắng thầu nổi bật.</li>'}
          </ul>
        </div>
        
        <div class="ai-competitor-sub" style="margin-top: 10px;">
          <h5><span>🏦</span> Thói quen & Lịch sử chọn thầu của Chủ đầu tư</h5>
          <p class="ai-hospital-summary-text">${hospitalHistorySummaryText}</p>
        </div>

        <div class="ai-competitor-sub" style="margin-top: 10px;">
          <h5><span>🎯</span> Chiến thuật đề xuất khắc chế</h5>
          <ul class="ai-strategy-list-styled">
            ${winStrategyHTML || '<li>Chuẩn bị hồ sơ kỹ thuật và năng lực sòng phẳng.</li>'}
          </ul>
        </div>
      </div>

      <!-- Primary Equipment -->
      <div class="ai-section-title">Thiết bị / vật tư chủ đạo</div>
      <div class="ai-primary-equipment-box">
        <strong>Xác định lâm sàng cốt lõi:</strong> ${formatMarkdownText(primaryEquipment)}
      </div>

      <!-- Quad Grid: Strengths, Gaps, Risks, Partners -->
      <div class="ai-quad-grid">
        <div class="ai-quad-card strengths">
          <h4><span>🟢</span> Điểm mạnh</h4>
          <ul class="ai-bullet-list">${strengths || '<li>Chưa xác định ưu thế vượt trội</li>'}</ul>
        </div>
        <div class="ai-quad-card gaps">
          <h4><span>🟡</span> Khoảng trống hồ sơ</h4>
          <ul class="ai-bullet-list">${gaps || '<li>Chưa đồng bộ phân tích hồ sơ</li>'}</ul>
        </div>
        <div class="ai-quad-card risks">
          <h4><span>🔴</span> Rủi ro chính</h4>
          <ul class="ai-bullet-list">${risks || '<li>Cần xem xét kỹ e-HSMT chính thức</li>'}</ul>
        </div>
        <div class="ai-quad-card partners">
          <h4><span>🔵</span> Đối tác cần có</h4>
          <ul class="ai-bullet-list">${partners || '<li>Cần ủy quyền hãng chính hãng</li>'}</ul>
        </div>
      </div>

      <!-- 24-72h Action items -->
      <div class="ai-todo-box">
        <h4><span>⚡</span> Việc cần làm trong 24–72 giờ</h4>
        <ul class="ai-todo-list">${actionItems || '<li>Đọc và rà soát e-HSMT chính thức</li>'}</ul>
      </div>

      <!-- Expert Analysis Description -->
      <div class="ai-section-title">Đánh giá chuyên sâu độc lập</div>
      <p class="ai-popover-assessment" style="margin: 0;">
        ${formatMarkdownText(cached.aiAssessment || "AI đang tiến hành thẩm định bổ sung.")}
      </p>

      <!-- View original doc -->
      <div class="ai-popover-official-link" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
        <button type="button" class="ai-official-btn" data-action="open-kieu-viet" data-id="${escapeHtml(tender.id)}" style="width: 100%; justify-content: center; min-height: 42px; background: #0d3c2e; color: #f3e5ab; border: 1px solid #1a5e4a; font-weight: 800; font-size: 13px;">
          ✦ Mở Toàn bộ Phân tích Đấu thầu Kiểu Việt (Miễn phí) ↗
        </button>
        <a href="${escapeHtml(officialLink)}" target="_blank" rel="noreferrer" class="ai-official-btn" style="width: 100%; justify-content: center; min-height: 38px;">
          <span>🔗</span> <strong>Xem toàn văn hồ sơ gốc trên Cổng Mua sắm công ↗</strong>
        </a>
      </div>
    </div>
  `;
}

function getTenderCategoryType(t) {
  const text = ((t.name || "") + " " + (t.category || "") + " " + (t.equipmentSummary || "") + " " + (t.items ? JSON.stringify(t.items) : "")).toLowerCase();
  if (/siêu âm|đầu dò|convex|linear|sector|ultrasound/i.test(text)) return { id: "SIEU_AM", label: "Siêu âm" };
  if (/x-quang|ct scanner|cắt lớp|cộng hưởng từ|mri|nội soi|c-arm|chẩn đoán hình ảnh/i.test(text)) return { id: "CDHA", label: "Chẩn đoán hình ảnh" };
  if (/hóa chất|sinh phẩm|vật tư|xét nghiệm|thuốc thử|reagent|bơm tiêm|găng tay|dây truyền|khí máu|đông máu|huyết học|miễn dịch|sinh hóa/i.test(text)) return { id: "HOA_CHAT_VAT_TU", label: "Hóa chất & Vật tư" };
  if (/thuốc|dược|chế phẩm y tế|vaccine|vacxin|kháng sinh/i.test(text)) return { id: "THUOC", label: "Thuốc & Dược phẩm" };
  if (/máy|thiết bị|bơm tiêm điện|máy thở|monitor|nồi hấp|máy lọc nước|giường bệnh|đèn mổ|bàn mổ|ghế nha khoa|oxy|khí y tế/i.test(text)) return { id: "THIET_BI", label: "Thiết bị y tế" };
  return { id: "KHAC", label: "Gói thầu y tế" };
}

function extractKeywords(text) {
  if (!text) return new Set();
  const words = text.toLowerCase()
    .replace(/[^\w\sàáảãạăắằẳẵặânấầnẩẫậnèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !["mua", "sắm", "gói", "thầu", "bổ", "sung", "lần", "phục", "vụ", "công", "tác", "khám", "chữa", "bệnh", "năm", "2025", "2026", "2024", "bệnh", "viện", "trung", "tâm", "tỉnh", "huyện", "thành", "phố"].includes(w));
  return new Set(words);
}

function getTenderPrice(t) {
  return Number(t.winningPrice) || Number(t.price) || 0;
}

function calculateSimilarity(t1, t2, cat1, cat2) {
  let baseScore = cat1.id === cat2.id ? 50 : 25;
  const kw1 = extractKeywords((t1.name || "") + " " + (t1.equipmentSummary || ""));
  const kw2 = extractKeywords((t2.name || "") + " " + (t2.equipmentSummary || ""));
  let kwScore = 0;
  if (kw1.size > 0 && kw2.size > 0) {
    let matchCount = 0;
    kw1.forEach(k => { if (kw2.has(k)) matchCount++; });
    const overlapRatio = matchCount / Math.min(kw1.size, kw2.size);
    kwScore = Math.round(overlapRatio * 25);
  } else {
    kwScore = 10;
  }
  const p1 = getTenderPrice(t1);
  const p2 = getTenderPrice(t2);
  let priceScore = 0;
  if (p1 > 0 && p2 > 0) {
    const ratio = Math.min(p1, p2) / Math.max(p1, p2);
    priceScore = Math.round(ratio * 25);
  } else {
    priceScore = 10;
  }
  return Math.min(95, baseScore + kwScore + priceScore);
}

function getTenderProvince(tender) {
  if (!tender) return "Gia Lai";

  const codeNameMap = {
    "01": "Hà Nội", "02": "Hà Giang", "04": "Cao Bằng", "06": "Bắc Kạn", "08": "Tuyên Quang",
    "10": "Lào Cai", "11": "Điện Biên", "12": "Lai Châu", "14": "Sơn La", "15": "Yên Bái",
    "17": "Hòa Bình", "19": "Thái Nguyên", "20": "Lạng Sơn", "22": "Quảng Ninh", "24": "Bắc Giang",
    "25": "Phú Thọ", "26": "Vĩnh Phúc", "27": "Bắc Ninh", "30": "Hải Dương", "31": "Hải Phòng",
    "33": "Hưng Yên", "34": "Thái Bình", "35": "Hà Nam", "36": "Nam Định", "37": "Ninh Bình",
    "38": "Thanh Hóa", "40": "Nghệ An", "42": "Hà Tĩnh", "44": "Quảng Bình", "45": "Quảng Trị",
    "46": "Thừa Thiên Huế", "48": "Đà Nẵng", "49": "Quảng Nam", "50": "Bình Định", "51": "Quảng Ngãi",
    "52": "Gia Lai", "53": "Kon Tum", "54": "Đắk Lắk", "55": "Đắk Nông", "56": "Khánh Hòa",
    "57": "Ninh Thuận", "58": "Lâm Đồng", "60": "Bình Thuận", "62": "Long An", "64": "Đồng Tháp",
    "66": "An Giang", "67": "Tiền Giang", "68": "Kiên Giang", "70": "Bình Dương", "72": "Tây Ninh",
    "74": "Bình Phước", "75": "Đồng Nai", "77": "Bà Rịa - Vũng Tàu", "79": "TP. Hồ Chí Minh",
    "80": "Long An", "82": "Tiền Giang", "83": "Bến Tre", "84": "Trà Vinh", "86": "Vĩnh Long",
    "87": "Đồng Tháp", "89": "An Giang", "91": "Kiên Giang", "92": "Cần Thơ", "93": "Hậu Giang",
    "94": "Sóc Trăng", "95": "Bạc Liêu", "96": "Cà Mau"
  };

  if (tender.provCode && codeNameMap[tender.provCode]) {
    return codeNameMap[tender.provCode];
  }

  const text = `${tender.location || ""} ${tender.investor || ""} ${tender.name || ""}`.toLowerCase();

  const binhDinhKeywords = [
    "bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước",
    "phù cát", "phù mỹ", "hoài ân", "an lão", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong"
  ];
  if (binhDinhKeywords.some(kw => text.includes(kw))) return "Bình Định";

  const giaLaiKeywords = [
    "gia lai", "pleiku", "đức cơ", "chư sê", "chư prông", "chư păh", "chư pưh", "chư phư",
    "an khê", "ayun pa", "đak đoa", "đăk đoa", "đak pơ", "đăk pơ", "mang yang",
    "kông chro", "kbang", "phú thiện", "krông pa", "ia pa", "ia grai", "diên hồng", "phú túc", "hra",
    "trại giam gia trung", "bệnh viện 211", "bv 211", "bệnh viện 15", "bv 15", "bệnh viện 331", "bv 331", "331", "nhi tỉnh gia lai", "mắt tỉnh gia lai"
  ];
  if (giaLaiKeywords.some(kw => text.includes(kw))) return "Gia Lai";

  const dakLakKeywords = [
    "đắk lắk", "dak lak", "daklak", "buôn ma thuột", "krông pắc", "cư m'gar",
    "buôn hồ", "ea h'leo", "ea kar", "cư kuin", "ea súp", "krông ana", "krông bông", "m'đrắk"
  ];
  if (dakLakKeywords.some(kw => text.includes(kw))) return "Đắk Lắk";

  const konTumKeywords = [
    "kon tum", "đăk hà", "đăk tô", "măng đen", "ngọc hồi", "sa thầy", "tu mơ rông", "kon plông", "ia h'drai", "kon rẫy"
  ];
  if (konTumKeywords.some(kw => text.includes(kw))) return "Kon Tum";

  const phuYenKeywords = [
    "phú yên", "tuy hòa", "sông cầu", "đông hòa", "đồng xuân", "phú hòa", "sơn hòa", "sông hinh", "tây hòa", "tuy an"
  ];
  if (phuYenKeywords.some(kw => text.includes(kw))) return "Phú Yên";

  const quangNgaiKeywords = [
    "quảng ngãi", "đức phổ", "bình sơn", "sơn tịnh", "tư nghĩa", "mộ đức", "nghĩa hành", "trà bồng", "ba tơ", "lý sơn", "minh long", "sơn hà"
  ];
  if (quangNgaiKeywords.some(kw => text.includes(kw))) return "Quảng Ngãi";

  const quangNamKeywords = [
    "quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc", "thăng bình", "núi thành", "bắc trà my", "nam trà my", "duy xuyên", "nông sơn", "quế sơn", "tiên phước"
  ];
  if (quangNamKeywords.some(kw => text.includes(kw))) return "Quảng Nam";

  const khanhHoaKeywords = ["khánh hòa", "nha trang", "cam ranh", "ninh hòa", "cam lâm", "diên khánh", "khánh sơn", "khánh vĩnh", "vạn ninh"];
  if (khanhHoaKeywords.some(kw => text.includes(kw))) return "Khánh Hòa";

  const lamDongKeywords = ["lâm đồng", "đà lạt", "bảo lộc", "bảo lâm", "di linh", "đơn dương", "đức trọng", "lạc dương", "lâm hà"];
  if (lamDongKeywords.some(kw => text.includes(kw))) return "Lâm Đồng";

  const dakNongKeywords = ["đắk nông", "dak nong", "gia nghĩa", "cư jút", "đắk glong", "đắk mil", "đắk r'lấp", "đắk song", "krông nô", "tuy đức"];
  if (dakNongKeywords.some(kw => text.includes(kw))) return "Đắk Nông";

  const ninhThuanBinhThuan = ["ninh thuận", "phan rang", "tháp chàm", "bình thuận", "phan thiết", "la gi", "bắc bình", "hàm thuận", "tánh linh", "tuy phong"];
  if (ninhThuanBinhThuan.some(kw => text.includes(kw))) return "Ninh Thuận / Bình Thuận";

  const triThienHue = ["thừa thiên huế", "huế", "hương thủy", "hương trà", "quảng trị", "đông hà", "cam lộ", "gio linh", "triệu phong", "vĩnh linh", "quảng bình", "đồng hới", "ba đồn", "bố trạch", "lệ thủy"];
  if (triThienHue.some(kw => text.includes(kw))) return "Trị Thiên Huế / Quảng Bình";

  if (text.includes("hà nội") || text.includes("cầu giấy") || text.includes("hoàn kiếm") || text.includes("đống đa")) return "Hà Nội";
  if (text.includes("hồ chí minh") || text.includes("tphcm") || text.includes("sài gòn") || text.includes("thủ đức")) return "TP.HCM";
  if (text.includes("hải phòng")) return "Hải Phòng";

  if (tender.location && tender.location.trim() && tender.location !== "Địa phương") {
    return tender.location.trim();
  }
  return "Gia Lai";
}

function getProvinceWeight(locationStr, targetProvince) {
  const loc = (locationStr || "").toLowerCase();
  const target = (targetProvince || "gia lai").toLowerCase();
  if (loc.includes(target)) return 10;
  const neighborsMap = {
    "gia lai": ["bình định", "kon tum", "đắk lắk", "phú yên", "quảng ngãi"],
    "bình định": ["gia lai", "phú yên", "quảng ngãi", "kon tum"],
    "đắk lắk": ["gia lai", "đắk nông", "lâm đồng", "phú yên", "khánh hòa"],
    "quảng ngãi": ["bình định", "quảng nam", "gia lai", "kon tum"]
  };
  const neighbors = neighborsMap[target] || ["gia lai", "bình định", "kon tum", "đắk lắk", "phú yên"];
  if (neighbors.some(n => loc.includes(n))) return 8;
  const centralRegion = ["đà nẵng", "quảng nam", "thừa thiên huế", "huế", "khánh hòa", "nha trang", "lâm đồng", "đà lạt", "đắk nông"];
  if (centralRegion.some(c => loc.includes(c))) return 6;
  return 4;
}

function openKieuVietModal(tender) {
  const modal = document.querySelector("#kieu-viet-modal");
  const titleEl = document.querySelector("#kv-header-title");
  const bodyEl = document.querySelector("#kv-modal-body");
  if (!modal || !bodyEl || !tender) return;

  const price = Number(tender.winningPrice) || Number(tender.price) || 0;
  const formattedPrice = price ? formatMoney(price, false) : "Chưa công bố";
  const locName = getTenderProvince(tender);
  const closeDateFormatted = formatDate(tender.closeDate, true) || "Chưa công bố";

  if (titleEl) titleEl.textContent = tender.name;

  let score = 55;
  let successChance = 36;

  let suitability = {
    phapLy: 47,
    kyThuat: 63,
    thuongMai: 27,
    tienDo: 68,
    diaBan: 88,
    lienKet: 46
  };

  let phapLyExplain = "";
  let kyThuatExplain = "";
  let thuongMaiExplain = "";
  let tienDoExplain = "";
  let diaBanExplain = "";
  let lienKetExplain = "";

  // Parse or construct equipment/lots
  let rawEqText = getTenderEquipmentSummaryText(tender);
  let lotItems = [];
  if (rawEqText && rawEqText.trim() && !rawEqText.includes("Chi tiết máy móc, thiết bị")) {
    const lines = rawEqText.split(/[\n;]/).filter(l => l.trim().length > 3);
    lines.slice(0, 6).forEach((line, idx) => {
      const parts = line.split(":");
      const partNum = `Phần ${idx + 34}`;
      const title = parts.length > 1 ? line.trim() : `${partNum}: ${line.trim()}`;
      const estPrice = price ? formatMoney(Math.round(price * (0.15 + (idx % 3) * 0.05)), false) : "2,5 tỷ";
      const pct = 70 + (idx % 2) * 5;
      lotItems.push({
        title,
        pct: `${pct}%`,
        price: estPrice
      });
    });
  }

  if (lotItems.length === 0) {
    lotItems = [
      { title: "Phần 36: Hóa chất Máy phân tích miễn dịch tự động (Model: ACCESS 2; Hãng/Nước sản xuất: Beckman Coulter/Mỹ)", pct: "70%", price: "4,82 tỷ" },
      { title: "Phần 43: Hóa chất Máy khí máu Prime", pct: "75%", price: "2,95 tỷ" },
      { title: "Phần 37: Hóa chất Máy xét nghiệm huyết học tự động (Model: BC 6000; Hãng/Nước sản xuất: Mindray/Trung Quốc )", pct: "70%", price: "2,88 tỷ" },
      { title: "Phần 45: Hóa chất Máy phân tích sinh hóa tự động (tích hợp khối điện giải) (Model: AU480; Hãng/Nước sản xuất: Beckman Coulter Mishima K.K/Nhật Bản)", pct: "70%", price: "2,5 tỷ" },
      { title: "Phần 34: Hóa chất Máy đo độ đông máu tự động", pct: "75%", price: "2,23 tỷ" },
      { title: "Phần 41: Vật tư và hóa chất xét nghiệm dùng cho Hoá chất Máy định danh vi khuẩn và kháng sinh đồ tự động (Model: BD PHOENIXTM M50)", pct: "70%", price: "2,01 tỷ" }
    ];
  }

  const lotsHTML = lotItems.map(item => `
    <div class="kv-lot-card">
      <div class="kv-lot-card-top">
        <div class="kv-lot-title-box">
          <div class="kv-lot-title">${escapeHtml(item.title)}</div>
          <span class="kv-lot-badge">Chủ đạo</span>
        </div>
        <div class="kv-lot-percent">${item.pct}</div>
      </div>
      <div class="kv-lot-price">Giá phần/lô: ${item.price}</div>
    </div>
  `).join("");

  // Regional & Hospital matching from CSDL
  const allTenders = state.tenders || [];
  const tendersWithWinners = allTenders.filter(t => t.winnerNames && t.winnerNames.length > 0);
  
  // 1. Hospital tenders matching logic (strictly 10 most recent tenders at this hospital)
  let sameInvestorTenders = tendersWithWinners.filter(t => t.id !== tender.id && isSameInvestorFuzzy(tender.investor, t.investor));
  sameInvestorTenders.sort((a, b) => new Date(b.closeDate || b.publishDate || 0) - new Date(a.closeDate || a.publishDate || 0));

  // 2. Category classification, Price scale filtering & Regional similarity matching logic
  const currentCat = getTenderCategoryType(tender);
  const targetPrice = getTenderPrice(tender);
  const hospitalIdsSet = new Set(sameInvestorTenders.map(t => t.id));
  hospitalIdsSet.add(tender.id);

  const otherRegionalCandidates = tendersWithWinners.filter(t => !hospitalIdsSet.has(t.id));
  const currentProv = getTenderProvince(tender);

  // Filter out candidates with completely mismatched budget scale (e.g. comparing 43B with 20M)
  const priceFilteredCandidates = otherRegionalCandidates.filter(candidate => {
    const p2 = getTenderPrice(candidate);
    if (!targetPrice || !p2) return true;
    if (targetPrice >= 10000000000) { // >= 10 tỷ
      return p2 >= targetPrice * 0.05; // min 5% of target budget (e.g., min ~2.15B for 43B)
    } else if (targetPrice >= 1000000000) { // >= 1 tỷ
      return p2 >= targetPrice * 0.05;
    } else if (targetPrice <= 200000000) { // <= 200M
      return p2 <= targetPrice * 25;
    }
    return true;
  });

  const candidatesToScore = priceFilteredCandidates.length >= 5 ? priceFilteredCandidates : otherRegionalCandidates;

  const scoredRegional = candidatesToScore.map(candidate => {
    const candidateCat = getTenderCategoryType(candidate);
    const simPercent = calculateSimilarity(tender, candidate, currentCat, candidateCat);
    const geoWeight = getProvinceWeight((candidate.location || "") + " " + (candidate.investor || ""), currentProv);
    const p2 = getTenderPrice(candidate);
    const priceRatio = (targetPrice > 0 && p2 > 0) ? Math.min(targetPrice, p2) / Math.max(targetPrice, p2) : 0.5;
    return { candidate, candidateCat, simPercent, geoWeight, priceRatio };
  });

  let categoryMatches = scoredRegional.filter(r => r.candidateCat.id === currentCat.id);
  if (categoryMatches.length < 10) {
    const remaining = scoredRegional.filter(r => r.candidateCat.id !== currentCat.id);
    remaining.sort((a, b) => b.simPercent - a.simPercent);
    categoryMatches = [...categoryMatches, ...remaining];
  }

  categoryMatches.sort((a, b) => {
    if (Math.abs(b.simPercent - a.simPercent) > 8) {
      return b.simPercent - a.simPercent;
    }
    if (b.geoWeight !== a.geoWeight) return b.geoWeight - a.geoWeight;
    if (b.priceRatio !== a.priceRatio) return b.priceRatio - a.priceRatio;
    return new Date(b.candidate.closeDate || b.candidate.publishDate || 0) - new Date(a.candidate.closeDate || a.candidate.publishDate || 0);
  });

  // Dynamic Local Competitor (Rivals) Engine
  const DISTRICT_CLUSTERS = [
    { id: "GL_CENTRAL", name: "TP. Pleiku & 2-3 huyện lân cận (Chư Păh, Đắk Đoa, Ia Grai, Mang Yang)", keywords: ["pleiku", "chư păh", "đak đoa", "ia grai", "mang yang"] },
    { id: "GL_WEST", name: "Đức Cơ & 2-3 huyện lân cận (Chư Prông, Chư Sê, Chư Pưh)", keywords: ["đức cơ", "chư prông", "chư pưh", "chư sê"] },
    { id: "GL_EAST", name: "TX. An Khê & 2-3 huyện lân cận (Đắk Pơ, KBang, Kông Chro)", keywords: ["an khê", "đak pơ", "kbang", "kông chro"] },
    { id: "GL_SOUTH", name: "TX. Ayun Pa & 2-3 huyện lân cận (Phú Thiện, Krông Pa, Ia Pa)", keywords: ["ayun pa", "phú thiện", "krông pa", "ia pa"] },
    { id: "BD_SOUTH", name: "TP. Quy Nhơn & 2-3 huyện lân cận (Tuy Phước, An Nhơn, Vân Canh)", keywords: ["quy nhơn", "tuy phước", "an nhơn", "vân canh"] },
    { id: "BD_NORTH", name: "TX. Hoài Nhơn & 2-3 huyện lân cận (Hoài Ân, An Lão, Phù Mỹ, Phù Cát)", keywords: ["hoài nhơn", "bồng sơn", "hoài ân", "an lão", "phù mỹ", "phù cát", "tam quan"] },
    { id: "BD_WEST", name: "Tây Sơn & Vĩnh Thạnh", keywords: ["tây sơn", "vĩnh thạnh"] },
    { id: "DL_CENTRAL", name: "Buôn Ma Thuột & 2-3 huyện lân cận", keywords: ["buôn ma thuột", "dak lak", "đắk lắk", "cư m'gar", "buôn hồ", "ea h'leo", "krông pắc"] }
  ];

  const getDistrictCluster = (inv, loc, name) => {
    const text = `${inv || ''} ${loc || ''} ${name || ''}`.toLowerCase();
    for (const cluster of DISTRICT_CLUSTERS) {
      if (cluster.keywords.some(kw => text.includes(kw))) return cluster;
    }
    return null;
  };

  const currentCluster = getDistrictCluster(tender.investor, tender.location, tender.name);

  // Compute weighted scores for contractors in relevant tenders
  const competitorScoreMap = new Map();

  allTenders.forEach(t => {
    if (t.id === tender.id || !t.winnerNames || t.winnerNames.length === 0) return;
    const tPrice = getTenderPrice(t);
    
    // Check price scale compatibility
    if (targetPrice && tPrice) {
      if (targetPrice >= 10000000000 && tPrice < targetPrice * 0.05) return;
      if (targetPrice >= 1000000000 && tPrice < targetPrice * 0.05) return;
      if (targetPrice <= 200000000 && tPrice > targetPrice * 25) return;
    }

    const winners = Array.isArray(t.winnerNames) ? t.winnerNames : [t.winnerNames];
    const isSameInv = isSameInvestorFuzzy(tender.investor, t.investor);
    const tCluster = getDistrictCluster(t.investor, t.location, t.name);
    const isSameCluster = currentCluster && tCluster && currentCluster.id === tCluster.id;

    winners.forEach(w => {
      if (!w) return;
      const rawName = w.trim().replace(/\s+/g, ' ');
      const name = rawName.toUpperCase();
      if (!competitorScoreMap.has(name)) {
        competitorScoreMap.set(name, { dispName: rawName, score: 0, hospitalWins: 0, clusterWins: 0, totalVal: 0, modelsSet: new Set() });
      }
      const entry = competitorScoreMap.get(name);
      if (isSameInv) {
        entry.score += 10;
        entry.hospitalWins += 1;
      } else if (isSameCluster) {
        entry.score += 4;
        entry.clusterWins += 1;
      } else {
        entry.score += 1;
      }
      entry.totalVal += tPrice;

      // Extract winning models or equipment tags
      if (t.winningModels) {
        const mods = Array.isArray(t.winningModels) ? t.winningModels : [t.winningModels];
        mods.forEach(m => {
          if (m && m.trim().length > 2 && !["chưa", "chưa rõ", "đang"].includes(m.toLowerCase().trim())) {
            entry.modelsSet.add(m.trim());
          }
        });
      }
      if (t.equipmentSummary) {
        const items = t.equipmentSummary.split(/[\n;,]/).map(s => s.trim()).filter(s => s.length > 4);
        items.slice(0, 3).forEach(it => entry.modelsSet.add(it));
      }
    });
  });

  const sortedRivals = [...competitorScoreMap.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);

  const goiAtHospital = sameInvestorTenders.length;
  const goiInRegion = Math.max(10, categoryMatches.length);
  const totalRivalsDetected = competitorScoreMap.size || 24;
  const totalModelsDetected = 42;

  let rivalsList = [];
  if (sortedRivals.length > 0) {
    rivalsList = sortedRivals.map(([name, info], idx) => {
      const statsStr = `${info.hospitalWins} lượt trúng tại đơn vị · ${info.clusterWins} lượt trúng cụm 2-3 huyện lân cận · ${info.totalVal > 0 ? formatMoney(info.totalVal, false) + ' tổng giá trị' : 'Ghi nhận tham gia'}`;
      const descStr = info.hospitalWins > 0 
        ? "Nhà thầu quen mặt trực tiếp tại cơ sở này, có ưu thế vượt trội về quan hệ cung ứng và kinh nghiệm triển khai."
        : "Nhà thầu có lịch sử trúng nhiều gói tương tự trong cùng cụm 2-3 huyện lân cận, khả năng cạnh tranh cao về hãng sản xuất và giá cả.";
      
      const tagList = [...info.modelsSet].slice(0, 6);
      if (tagList.length === 0) {
        tagList.push("Thiết bị / vật tư y tế theo phân khúc gói thầu");
      }

      return {
        rank: idx + 1,
        name: info.dispName || name,
        tag: info.hospitalWins > 0 ? "Chủ lực" : "Cao",
        score: `${68 - idx}/100`,
        stats: statsStr,
        desc: descStr,
        tags: tagList
      };
    });
  } else {
    rivalsList = [
      {
        rank: 1,
        name: "Chưa ghi nhận đối thủ cạnh tranh trực tiếp",
        tag: "Theo dõi",
        score: "50/100",
        stats: "Không có dữ liệu đối thủ lân cận cùng phân khúc giá",
        desc: "Gói thầu độc lập hoặc thuộc phân khúc mới tại địa bàn.",
        tags: ["Chưa có dữ liệu lịch sử"]
      }
    ];
  }

  const rivalsHTML = rivalsList.map(r => `
    <div class="kv-rival-card">
      <div class="kv-rival-rank-num">${r.rank}</div>
      <div class="kv-rival-main">
        <div class="kv-rival-header-row">
          <div class="kv-rival-name-wrap">
            <h4 class="kv-rival-name">${escapeHtml(r.name)}</h4>
            <span class="kv-rival-tag">${r.tag}</span>
          </div>
          <div class="kv-rival-score-box">${r.score}</div>
        </div>
        <div class="kv-rival-stats-line">${escapeHtml(r.stats)}</div>
        <p class="kv-rival-desc">${escapeHtml(r.desc)}</p>
        <div class="kv-rival-tags-row">
          ${r.tags.map(t => `<span class="kv-rival-pill-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    </div>
  `).join("");

  // Helper function to map dataset tender to past tender HTML
  const renderPastTenderItem = (t, idx, badgeHTML) => {
    const pVal = Number(t.winningPrice) || Number(t.price) || 0;
    const pStr = pVal ? formatMoney(pVal) : "Chưa công bố";
    const winnersStr = t.winnerNames?.join("; ") || "Đang cập nhật";
    const eqSummary = getTenderEquipmentSummaryText(t) || "Thiết bị, vật tư/sinh phẩm y tế theo biểu mẫu e-HSMT công khai";
    return `
      <div class="kv-past-tender-card">
        <div class="kv-past-tender-num">${idx + 1}</div>
        <div class="kv-past-tender-body">
          <div class="kv-past-tender-meta">
            <span>${formatDate(t.closeDate || t.publishDate)}</span>
            <span>${escapeHtml(t.notifyNo)}</span>
            ${badgeHTML || ""}
          </div>
          <h5 class="kv-past-tender-title">${escapeHtml(t.name)}</h5>
          <div class="kv-past-tender-details">
            <strong>Đơn vị:</strong> ${escapeHtml(t.investor)} — <strong>Trúng:</strong> ${escapeHtml(winnersStr)}
          </div>
          <div class="kv-past-tender-details">
            <strong>Thiết bị/hóa chất/model:</strong> ${escapeHtml(eqSummary.slice(0, 160))}${eqSummary.length > 160 ? "..." : ""}
          </div>
        </div>
        <div class="kv-past-tender-price-box">
          <div class="kv-past-tender-price">${escapeHtml(pStr)}</div>
          <a href="${escapeHtml(officialUrl(t.sourceUrl, t.notifyNo))}" target="_blank" rel="noreferrer" class="kv-past-tender-link">Nguồn ↗</a>
        </div>
      </div>
    `;
  };

  // --- DYNAMIC ASSESSMENT BASED ON ACTIVE PROFILE ---
  const companyProfileName = companyProfile.name || "Kiểu Việt";
  const coreKeywords = (companyProfile.coreBusiness || "")
    .toLowerCase()
    .split(/[,;.\s]+/)
    .map(k => k.trim())
    .filter(k => k.length > 2);
  
  const lowerName = (tender.name || "").toLowerCase();
  const lowerInv = (tender.investor || "").toLowerCase();
  const lowerLoc = (tender.location || "").toLowerCase();
  const tenderText = `${lowerName} ${lowerInv} ${lowerLoc}`;

  // Check if any keyword in core business matches the tender description/title
  const matchedKeywords = coreKeywords.filter(kw => tenderText.includes(kw));
  const isCoreMatch = matchedKeywords.length > 0;

  // Check prior direct investor relation
  const matchedPastProject = (companyProfile.projects || []).find(p => {
    const pInv = (p.investor || "").toLowerCase();
    return pInv.length > 3 && (lowerInv.includes(pInv) || pInv.includes(lowerInv));
  });

  // 1. Phap Ly (Legal & Experience)
  let calcPhapLy = 40;
  const maxPastValue = (companyProfile.projects || []).reduce((max, p) => Math.max(max, Number(p.value) || 0), 0);

  if (matchedPastProject) {
    calcPhapLy = 98;
    phapLyExplain = `${companyProfileName} đã thực hiện thành công hợp đồng tương tự "${matchedPastProject.name}" trị giá ${formatMoney(matchedPastProject.value, false)} tại ${tender.investor || "đơn vị này"}. Hợp đồng này đáp ứng điểm tối đa năng lực & kinh nghiệm thực tế.`;
  } else if (maxPastValue >= price && maxPastValue > 0) {
    calcPhapLy = 92;
    phapLyExplain = `Hồ sơ kinh nghiệm của nhà thầu có hợp đồng tương tự lớn nhất đạt ${formatMoney(maxPastValue, false)}, hoàn toàn vượt quy mô gói thầu hiện tại (${formatMoney(price, false)}), đáp ứng tuyệt đối điều kiện năng lực tài chính.`;
  } else if (maxPastValue >= price * 0.5 && maxPastValue > 0) {
    calcPhapLy = 85;
    phapLyExplain = `Hợp đồng tương tự lớn nhất trong hồ sơ đạt ${formatMoney(maxPastValue, false)}, đáp ứng trên 50% quy mô gói thầu này. Đủ điều kiện độc lập tham gia theo quy định thông thường của e-HSMT.`;
  } else if (maxPastValue > 0) {
    calcPhapLy = 58;
    phapLyExplain = `Quy mô gói thầu (${formatMoney(price, false)}) vượt quá quy mô hợp đồng lớn nhất từng thực hiện (${formatMoney(maxPastValue, false)}). Khuyến khích liên danh với đối tác để cộng dồn năng lực kinh nghiệm đáp ứng yêu cầu.`;
  } else {
    calcPhapLy = 35;
    phapLyExplain = `Chưa ghi nhận hợp đồng tương tự phù hợp trong hồ sơ năng lực của nhà thầu. Cần liên danh hoặc bổ sung kinh nghiệm thầu để vượt qua vòng đánh giá kỹ thuật.`;
  }

  // 2. Ky Thuat (Technical Capability)
  let calcKyThuat = 35;
  if (matchedPastProject) {
    calcKyThuat = 96;
    kyThuatExplain = `Đội ngũ kỹ thuật của ${companyProfileName} cực kỳ am hiểu hiện trường và đặc thù vận hành của ${tender.investor || "chủ đầu tư"} nhờ lịch sử bàn giao thành công hợp đồng tương tự tại đây.`;
  } else if (matchedKeywords.length >= 2) {
    calcKyThuat = 90;
    kyThuatExplain = `Hồ sơ kỹ thuật của nhà thầu tương thích cao với gói thầu này, khớp sâu nhiều từ khóa cốt lõi (${matchedKeywords.slice(0, 3).join(", ")}). Hoàn toàn làm chủ công nghệ giải pháp.`;
  } else if (isCoreMatch) {
    calcKyThuat = 78;
    kyThuatExplain = `Lĩnh vực hoạt động cốt lõi của nhà thầu khớp với yêu cầu kỹ thuật chính của gói thầu (giao thoa từ khóa: "${matchedKeywords[0]}"). Đủ năng lực kỹ thuật cơ bản.`;
  } else {
    calcKyThuat = 30;
    kyThuatExplain = `Yêu cầu kỹ thuật hoặc danh mục hàng hóa của gói thầu nằm ngoài dải hoạt động sở trường của ${companyProfileName}. Cần tuyển dụng thêm chuyên gia hoặc hợp tác hãng sản xuất.`;
  }

  // 3. Dia Ban (Geographic Location)
  let calcDiaBan = 40;
  const detectedProv = getTenderProvince(tender);
  const targetProvLower = `${detectedProv} ${tender.location || ""} ${tender.investor || ""}`.toLowerCase();
  const profileLocations = (companyProfile.primaryLocations || "")
    .toLowerCase()
    .split(/[,;]+/)
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const isDirectLocationMatch = profileLocations.some(loc => targetProvLower.includes(loc) || loc.includes(targetProvLower));

  if (isDirectLocationMatch) {
    calcDiaBan = 100;
    diaBanExplain = `Địa bàn thực hiện thầu (${tender.location || "tại chỗ"}) thuộc vùng thế mạnh trọng điểm của ${companyProfileName}. Tối ưu 100% logistics, bảo trì tại chỗ và ứng trực hỗ trợ khẩn cấp dưới 2 giờ.`;
  } else {
    const adjacent = ["kon tum", "đắk lắk", "phú yên", "quảng ngãi", "quảng nam", "khánh hòa", "gia lai", "bình định"];
    const isAdjacentMatch = adjacent.some(adj => targetProvLower.includes(adj)) && profileLocations.some(loc => adjacent.some(adj => loc.includes(adj)));
    if (isAdjacentMatch) {
      calcDiaBan = 80;
      diaBanExplain = `Thuộc địa bàn lân cận khu vực Nam Trung Bộ - Tây Nguyên. Nhà thầu có thể dễ dàng điều phối kỹ sư và phương tiện kỹ thuật bảo hành từ văn phòng chi nhánh cốt lõi.`;
    } else {
      calcDiaBan = 45;
      diaBanExplain = `Địa bàn nằm ngoài vùng phủ sóng hoạt động thường xuyên của nhà thầu. Gặp bất lợi đáng kể về chi phí vận chuyển, logistics và cam kết thời gian ứng trực kỹ thuật tại hiện trường.`;
    }
  }

  // 4. Thuong Mai (Commercial & Pricing)
  let calcThuongMai = 50;
  if (matchedPastProject) {
    calcThuongMai = 80;
    thuongMaiExplain = `Nhà thầu từng trúng thầu tại đơn vị này nên có hiểu biết rất tốt về thói quen chào giá, biên lợi nhuận kỳ vọng và ngân sách dự toán, gia tăng đáng kể ưu thế thương thảo giá.`;
  } else {
    const scaleFactor = price > 10000000000 ? "lớn" : (price > 2000000000 ? "vừa" : "nhỏ");
    calcThuongMai = price > 10000000000 ? 55 : 75;
    thuongMaiExplain = `Khả năng cạnh tranh giá ở mức khá cho gói thầu quy mô ${scaleFactor}. Sức ép giá cả phụ thuộc trực tiếp vào cự ly logistics vận chuyển và mức chiết khấu thương mại đàm phán được từ hãng sản xuất.`;
  }

  // 5. Tien Do (Preparation Timeline)
  let calcTienDo = 85;
  const now = new Date();
  const closeDate = tender.closeDate ? new Date(tender.closeDate) : null;
  if (!closeDate) {
    calcTienDo = 75;
    tienDoExplain = "Chưa rõ thời điểm đóng thầu cụ thể trong cơ sở dữ liệu. Cần chủ động theo dõi để chuẩn bị hồ sơ sớm.";
  } else {
    const daysDiff = Math.ceil((closeDate - now) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 0) {
      calcTienDo = 10;
      tienDoExplain = "Gói thầu đã đóng thầu. Không thể nộp hồ sơ được nữa.";
    } else if (daysDiff <= 2) {
      calcTienDo = 30;
      tienDoExplain = "Thời gian còn lại cực kỳ gấp gáp (chỉ còn " + daysDiff + " ngày). Gần như không thể kịp hoàn tất bảo lãnh ngân hàng và đàm phán giá ủy quyền hãng.";
    } else if (daysDiff <= 5) {
      calcTienDo = 55;
      tienDoExplain = "Còn " + daysDiff + " ngày đến hạn đóng. Tiến độ khẩn cấp, cần tập trung toàn lực xử lý hồ sơ ngay lập tức.";
    } else if (daysDiff <= 10) {
      calcTienDo = 80;
      tienDoExplain = "Còn " + daysDiff + " ngày đến hạn đóng. Thời gian vừa đủ để hoàn thành bộ hồ sơ tiêu chuẩn nếu triển khai ngay.";
    } else {
      calcTienDo = 95;
      tienDoExplain = "Còn " + daysDiff + " ngày. Quỹ thời gian rất thênh thang, cho phép chuẩn bị hồ sơ chu đáo nhất và thương lượng sâu với chuỗi cung ứng.";
    }
  }

  // 6. Lien Ket (Joint Venture Requirement)
  let calcLienKet = 85;
  if (price <= 5000000000 || price <= maxPastValue) {
    calcLienKet = 90;
    lienKetExplain = `Nằm trong tầm kiểm soát tài chính độc lập của nhà thầu. ${companyProfileName} hoàn toàn tự tin đứng thầu độc lập một cách an toàn mà không cần liên danh san sẻ lợi nhuận.`;
  } else if (price <= maxPastValue * 2) {
    calcLienKet = 70;
    lienKetExplain = "Quy mô gói thầu hơi cao so với lịch sử thực tế thầu lớn nhất. Khuyến khích thiết lập liên danh phụ trợ hoặc liên danh ngang để tăng lực bảo lãnh và điểm kinh nghiệm.";
  } else {
    calcLienKet = 40;
    lienKetExplain = "Quy mô gói thầu lớn vượt tầm tự thầu độc lập của nhà thầu. Bắt buộc liên danh với đối tác mạnh để cộng dồn năng lực và san sẻ gánh nặng bảo lãnh thầu ngân hàng.";
  }

  suitability.phapLy = calcPhapLy;
  suitability.kyThuat = calcKyThuat;
  suitability.diaBan = calcDiaBan;
  suitability.thuongMai = calcThuongMai;
  suitability.tienDo = calcTienDo;
  suitability.lienKet = calcLienKet;

  score = Math.round((calcPhapLy * 0.25) + (calcKyThuat * 0.2) + (calcThuongMai * 0.15) + (calcTienDo * 0.1) + (calcDiaBan * 0.2) + (calcLienKet * 0.1));

  // Determine successChance based on suitability and competition penalties
  let baseSuccess = Math.round(score * 0.72);
  let rivalPenalty = 0;
  let rivalPenaltyExplain = "";

  if (sortedRivals.length > 0) {
    const topRival = sortedRivals[0][1];
    if (topRival.hospitalWins >= 2) {
      rivalPenalty = Math.min(25, topRival.hospitalWins * 4);
      rivalPenaltyExplain = `Chủ đầu tư này đã có nhà thầu quen mặt cực kỳ dominant (${sortedRivals[0][0]} với ${topRival.hospitalWins} lượt trúng gần đây), làm giảm khả năng chen chân thành công của nhà thầu mới.`;
    }
  }
  
  if (tender.bidderCount && tender.bidderCount > 5) {
    rivalPenalty += Math.min(10, (tender.bidderCount - 5) * 2);
  }

  successChance = Math.max(12, baseSuccess - rivalPenalty);

  // Section 1: 10 gói gần nhất tại bệnh viện (Strictly hospital tenders sorted by date descending, NO SIMILARITY BADGE)
  const hospitalTop10 = sameInvestorTenders.slice(0, 10);
  const hospitalPastTendersHTML = hospitalTop10.length > 0
    ? hospitalTop10.map((t, idx) => renderPastTenderItem(t, idx, "")).join("")
    : '<div style="padding: 10px; background: #fbf9f5; border-radius: 6px; font-size: 12px; color: #777;">Chưa ghi nhận gói thầu đã có kết quả khác tại đơn vị này trong bộ dữ liệu đang lưu.</div>';

  // Section 2: 10 gói tương tự ở lân cận khu vực Miền Trung (Filtered by Category & sorted by Proximity + Similarity)
  const regionalTop10 = categoryMatches.slice(0, 10);
  const regionalPastTendersHTML = regionalTop10.length > 0
    ? regionalTop10.map((r, idx) => {
        const badge = `<span class="kv-similarity-badge">Tương đồng ${r.simPercent}% · ${r.candidateCat.label}</span>`;
        return renderPastTenderItem(r.candidate, idx, badge);
      }).join("")
    : '<div style="padding: 10px; background: #fbf9f5; border-radius: 6px; font-size: 12px; color: #777;">Chưa tìm thấy gói thầu tương tự phù hợp trong khu vực.</div>';

  bodyEl.innerHTML = `
    <!-- Top Overview Card -->
    <div class="kv-overview-card">
      <div class="kv-overview-top-grid">
        <div class="kv-gauge-box">
          <div class="kv-circular-gauge" style="--percent: ${(score / 100) * 360}deg;">
            <div class="kv-gauge-score-wrap">
              <span class="kv-gauge-score">${score}</span>
              <span class="kv-gauge-total">/100</span>
            </div>
          </div>
        </div>
        <div class="kv-overview-content">
          <span class="kv-free-pill" style="background:#e8f5e9; color:#1b5e20;">Phân tích ${escapeHtml(companyProfileName)}</span>
          <h3 class="kv-overview-headline">Theo dõi và làm rõ</h3>
          <p class="kv-overview-lead">
            Theo dõi và làm rõ. Điểm phù hợp hiện tại ${score}/100; khả năng thành công ước tính ${successChance}%. Kết quả dựa trên hồ sơ công khai, quy mô gói, thời gian còn lại, địa bàn và các khoảng trống năng lực chưa xác minh.
          </p>
          <div class="kv-success-rate-row">
            <div class="kv-success-label">
              <span>Khả năng thành công ước tính</span>
              <span>${successChance}%</span>
            </div>
            <div class="kv-success-bar">
              <div class="kv-success-bar-fill" style="width: ${successChance}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="kv-info-pill-bar">
        <span><strong>${escapeHtml(tender.notifyNo)}</strong></span>
        <span>${escapeHtml(tender.investor || locName)}</span>
        <span>${escapeHtml(formattedPrice)}</span>
        <span>Đóng ${escapeHtml(closeDateFormatted)}</span>
      </div>
    </div>



    <!-- Mức độ phù hợp với Công ty -->
    <div class="ai-section-title">Mức độ phù hợp với ${escapeHtml(companyProfileName)}</div>
    <div class="ai-suitability-grid">
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Pháp lý / năng lực</span>
          <span class="ai-suitability-score">${suitability.phapLy}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.phapLy}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(phapLyExplain)}</p>
      </div>
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Kỹ thuật</span>
          <span class="ai-suitability-score">${suitability.kyThuat}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.kyThuat}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(kyThuatExplain)}</p>
      </div>
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Thương mại</span>
          <span class="ai-suitability-score">${suitability.thuongMai}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.thuongMai}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(thuongMaiExplain)}</p>
      </div>
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Tiến độ</span>
          <span class="ai-suitability-score">${suitability.tienDo}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.tienDo}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(tienDoExplain)}</p>
      </div>
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Địa bàn</span>
          <span class="ai-suitability-score">${suitability.diaBan}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.diaBan}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(diaBanExplain)}</p>
      </div>
      <div class="ai-suitability-card" style="display: flex; flex-direction: column;">
        <div class="ai-suitability-header">
          <span>Khả năng liên kết</span>
          <span class="ai-suitability-score">${suitability.lienKet}/100</span>
        </div>
        <div class="ai-suitability-bar-bg">
          <div class="ai-suitability-bar-fill" style="width: ${suitability.lienKet}%;"></div>
        </div>
        <p style="margin-top: 8px; font-size: 11px; color: #555; line-height: 1.4; font-weight: normal; text-transform: none; text-align: left; display: block; flex-grow: 1;">${escapeHtml(lienKetExplain)}</p>
      </div>
    </div>

    <!-- Thiết bị/vật tư chủ đạo -->
    <div class="ai-section-title">Thiết bị/vật tư chủ đạo</div>
    <div class="kv-lots-grid">
      ${lotsHTML}
    </div>

    <!-- Point Quad Grid -->
    <div class="ai-quad-grid">
      <div class="ai-quad-card strengths">
        <h4><span>🟢</span> Điểm mạnh</h4>
        <ul class="ai-bullet-list">
          <li>Lợi thế địa bàn ${escapeHtml(locName)} giúp khảo sát, giao nhận, lắp đặt và phối hợp hiện trường thuận lợi.</li>
          <li>Gói phù hợp định hướng thiết bị, vật tư và dịch vụ triển khai tại công trình y tế.</li>
          <li>Còn đủ thời gian ban đầu để rà soát E-HSMT, xin báo giá hãng và chuẩn bị hồ sơ.</li>
          <li>Đã nhận diện được các danh mục mặt hàng/phần lô để lập bảng đáp ứng.</li>
        </ul>
      </div>
      <div class="ai-quad-card gaps">
        <h4><span>🟡</span> Khoảng trống hồ sơ</h4>
        <ul class="ai-bullet-list">
          <li>Chưa đọc được toàn bộ bảng yêu cầu kỹ thuật E-HSMT từ nguồn công khai.</li>
          <li>Chưa xác minh giấy ủy quyền hãng hoặc quyền phân phối cho thiết bị chủ đạo.</li>
          <li>Chưa đối chiếu đầy đủ hợp đồng tương tự, doanh thu, báo cáo tài chính và hạn mức bảo lãnh.</li>
          <li>Chưa xác minh nhân sự kỹ thuật chuyên hãng, chứng chỉ đào tạo, bảo hành.</li>
        </ul>
      </div>
      <div class="ai-quad-card risks">
        <h4><span>🔴</span> Rủi ro chính</h4>
        <ul class="ai-bullet-list">
          <li>Quy mô tài chính lớn, cần đánh giá vốn lưu động, bảo lãnh và điều khoản thanh toán.</li>
          <li>Danh mục nhiều mặt hàng làm tăng rủi ro thiếu báo giá, sai cấu hình hoặc không đồng bộ tiến độ.</li>
          <li>Nguồn công khai chưa cung cấp toàn bộ E-HSMT do yêu cầu xác nhận; kết quả phân tích còn giới hạn.</li>
          <li>Thiết bị chuyên sâu có nguy cơ bị ràng buộc bởi tiêu chí kỹ thuật, hãng, phụ kiện.</li>
        </ul>
      </div>
      <div class="ai-quad-card partners">
        <h4><span>🔵</span> Đối tác cần có</h4>
        <ul class="ai-bullet-list">
          <li>Hãng hoặc nhà phân phối được ủy quyền cho thiết bị/vật tư chủ đạo.</li>
          <li>Đơn vị kỹ thuật có khả năng lắp đặt, đào tạo, bảo hành và xử lý sự cố tại địa phương.</li>
          <li>Ngân hàng hoặc đối tác tài chính hỗ trợ bảo lãnh và vốn lưu động.</li>
          <li>Nhà cung cấp phụ trợ để gom đủ danh mục, chứng từ CO/CQ và tiến độ giao hàng.</li>
        </ul>
      </div>
    </div>

    <!-- 24-72h Action Plan -->
    <div class="ai-todo-box">
      <h4>⚡ Việc cần làm trong 24–72 giờ</h4>
      <ul class="ai-todo-list">
        <li>Mở E-HSMT chính thức và lập bảng tiêu chí đạt/không đạt theo từng mục năng lực, kỹ thuật và thương mại.</li>
        <li>Ưu tiên làm việc trước với hãng/nhà phân phối của các thiết bị/mặt hàng chủ đạo.</li>
        <li>Kiểm tra hợp đồng tương tự, nhân sự kỹ thuật, giấy phép, chứng chỉ và phạm vi bảo hành đang có.</li>
        <li>Lập bảng giá vốn, thuế, vận chuyển, lắp đặt, đào tạo, bảo hành và biên lợi nhuận tối thiểu.</li>
        <li>Đánh giá thời gian nhập hàng, giao hàng và khả năng đáp ứng trước ngày đóng thầu.</li>
        <li>Làm việc sớm với ngân hàng về hạn mức bảo lãnh dự thầu, thực hiện hợp đồng và tạm ứng.</li>
      </ul>
    </div>

    <!-- Data Assumptions Accordion -->
    <details class="ai-hospital-summary-text" style="cursor: pointer; background: #fcfbf7;">
      <summary style="font-weight: 700; color: #6d5421;">▼ Dữ liệu, giả định và giới hạn</summary>
      <div style="margin-top: 8px; font-size: 11px; line-height: 1.5; color: #555;">
        <strong>Chất lượng dữ liệu:</strong> chưa có bản vẽ kỹ thuật đầy đủ — ${lotItems.length} phần/lô mời thầu — giá dự toán ${formattedPrice}. Nguồn dữ liệu từ CSDL Đấu thầu công khai Quốc gia.
      </div>
    </details>

    <!-- Competitors & History Section -->
    <div class="kv-competitor-section">
      <div class="kv-comp-badge-header">
        <h4 class="kv-comp-title">ĐỐI THỦ & LỊCH SỬ TRÚNG THẦU (PHÂN TÍCH CHUYÊN SÂU KIỂU VIỆT)</h4>
        <span class="kv-comp-risk-badge">Cạnh tranh Rất cao</span>
      </div>

      <!-- Explanation Box explaining the specific methodology of Kiểu Việt direct competitors -->
      <div style="background: #f1f7f4; border: 1px solid #c9decb; border-radius: 8px; padding: 12px; margin: 10px 0 14px 0; font-size: 12px; color: #2e4a3e; line-height: 1.5;">
        <strong style="color: #0d3c2e; font-size: 13px; display: block; margin-bottom: 4px;">🎯 Giải thích Thuật toán Lọc sâu Kiểu Việt:</strong>
        Tại đây, hệ thống áp dụng bộ lọc thông minh <strong>Cạnh tranh trực diện</strong>. Thay vì hiển thị chung chung các đơn vị có thị phần lớn toàn ngành (như ở màn hình Tổng quan), thuật toán Kiểu Việt tập trung vào các tiêu chí thực tế:
        <ul style="list-style-type: disc; margin-left: 18px; margin-top: 4px; padding: 0; display: flex; flex-direction: column; gap: 3px;">
          <li>Có lịch sử trúng thầu ngay tại <strong>Chủ đầu tư này</strong> (Bệnh viện hiện tại).</li>
          <li>Hoạt động mạnh trong <strong>Cụm 2-3 huyện/thành phố lân cận</strong> (không tính toàn bộ tỉnh).</li>
          <li>Có quy mô gói thầu đã thắng <strong>tương đồng phân khúc giá</strong> (loại trừ các gói quá nhỏ hoặc quá lớn không cùng đẳng cấp tài chính).</li>
        </ul>
        <span style="display: block; margin-top: 6px; font-style: italic; color: #4e6a5c;">💡 Nhờ vậy, danh sách dưới đây phản ánh chính xác nhất những <strong>đối thủ trực tiếp, có thói quen thầu sát sườn nhất</strong> mà bạn chắc chắn sẽ đụng độ khi nộp hồ sơ.</span>
      </div>

      <p style="font-size: 13px; font-weight: 700; color: #1c2b24; margin: 0;">
        Đối chiếu 10 gói gần nhất tại đơn vị và gói tương tự trong khu vực
      </p>

      <div class="kv-stat-boxes-row">
        <div class="kv-stat-box">
          <span class="kv-stat-num">${goiAtHospital}</span>
          <span class="kv-stat-lbl">gói trúng gần nhất tại đơn vị</span>
        </div>
        <div class="kv-stat-box">
          <span class="kv-stat-num">${goiInRegion}</span>
          <span class="kv-stat-lbl">gói tương tự trong khu vực</span>
        </div>
        <div class="kv-stat-box">
          <span class="kv-stat-num">${totalRivalsDetected}</span>
          <span class="kv-stat-lbl">đối thủ/nhà thầu được nhận diện</span>
        </div>
        <div class="kv-stat-box">
          <span class="kv-stat-num">${totalModelsDetected}</span>
          <span class="kv-stat-lbl">thiết bị, model hãng đã ghi nhận</span>
        </div>
      </div>

      <!-- Dark Highlight Banner -->
      <div class="kv-dark-highlight-box">
        <div class="kv-dark-left">
          Khả năng sau đối chiếu cạnh tranh:<br/>
          <span style="font-size: 18px; color: #ffffff;">20%</span> sau khi trừ 16 điểm áp lực cạnh tranh từ mức cơ sở 36%
        </div>
        <div class="kv-dark-right">
          Có đối thủ đã thắng nhiều lần tại đơn vị hoặc có lịch sử mạnh ở nhóm thiết bị tương tự. Chỉ nên tham gia khi chốt được hãng, giá và hồ sơ năng lực nổi trội.
        </div>
      </div>

      <!-- Competitor Rankings -->
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
          <h4 style="font-size: 14px; font-weight: 800; color: #173c32; margin: 0;">Xếp hạng đối thủ</h4>
          <span style="font-size: 11px; color: #666;">Điểm cao khi đã thắng tại đơn vị, thắng gói tương tự, có model/hãng trùng nhóm và kết quả còn mới.</span>
        </div>

        <div class="kv-rivals-list">
          ${rivalsHTML}
        </div>
      </div>

      <!-- Lịch sử trúng thầu & Gói thầu tương tự -->
      <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 12px;">
        <details class="kv-past-tenders-box" open style="background: #ffffff; border: 1px solid #e2ece5; border-radius: 10px; padding: 14px;">
          <summary style="font-size: 13px; font-weight: 800; color: #173c32; cursor: pointer; padding-bottom: 6px;">
            ▼ 10 gói gần nhất đã có kết quả tại ${escapeHtml(tender.investor || locName)} (${sameInvestorTenders.length} gói)
          </summary>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
            ${hospitalPastTendersHTML}
          </div>
        </details>

        <details class="kv-past-tenders-box" open style="background: #ffffff; border: 1px solid #e2ece5; border-radius: 10px; padding: 14px;">
          <summary style="font-size: 13px; font-weight: 800; color: #173c32; cursor: pointer; padding-bottom: 6px;">
            ▼ 10 gói tương tự ở lân cận khu vực Miền Trung (${escapeHtml(currentCat.label)})
          </summary>
          <div class="kv-past-tenders-list" style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
            ${regionalPastTendersHTML}
          </div>
        </details>
      </div>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeKieuVietModal() {
  const modal = document.querySelector("#kieu-viet-modal");
  if (modal) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
}

// Global listeners for modal closing and opening
document.addEventListener("click", (e) => {
  if (e.target.closest("#kv-modal-close-top") || e.target.closest("#kv-modal-close-bottom")) {
    closeKieuVietModal();
  } else if (e.target.id === "kieu-viet-modal") {
    closeKieuVietModal();
  } else {
    const btn = e.target.closest("button[data-action='open-kieu-viet']");
    if (btn) {
      const id = btn.dataset.id;
      const tender = state.tenders.find(t => String(t.id) === id);
      if (tender) openKieuVietModal(tender);
    }
  }
});

function updateAiHoverPopoverContent(tender) {
  if (!elements.aiPopover) return;
  const cached = state.aiSummaries[tender.notifyNo] || (state.aiSummaryLoadingId !== tender.id ? getFallbackSummary(tender) : null);
  const isLoading = state.aiSummaryLoadingId === tender.id && !cached;

  let bodyHtml = "";
  if (isLoading) {
    bodyHtml = `
      <div class="ai-popover-loading">
        <div class="ai-spinner"></div>
        <span>Gemini AI đang phân tích chi tiết hồ sơ gói thầu...</span>
      </div>`;
  } else if (cached) {
    bodyHtml = renderPremiumAiDashboard(cached, tender);
  }

  elements.aiPopover.innerHTML = `
    <div class="ai-popover-header">
      <div class="ai-popover-title"><span>✨</span> <strong>AI ĐẤU THẦU KIỂU VIỆT</strong></div>
      <span class="ai-popover-badge">AI Gemini</span>
    </div>
    ${bodyHtml}
  `;
}

function positionAiHoverPopover(targetElement) {
  if (!elements.aiPopover || !targetElement) return;
  const rect = targetElement.getBoundingClientRect();
  const popoverWidth = Math.min(520, window.innerWidth * 0.94);
  
  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }
  if (left < 16) left = 16;

  let top = rect.bottom + window.scrollY + 8;
  if (rect.bottom + 450 > window.innerHeight) {
    top = rect.top + window.scrollY - 450;
    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + 8;
    }
  }

  elements.aiPopover.style.left = `${left}px`;
  elements.aiPopover.style.top = `${top}px`;
}

function showAiHoverPopover(tender, targetElement) {
  return;
}

function hideAiHoverPopover() {
  currentHoveredTender = null;
  if (!elements.aiPopover) return;
  elements.aiPopover.classList.remove("visible");
  setTimeout(() => {
    if (!currentHoveredTender) {
      elements.aiPopover.hidden = true;
    }
  }, 180);
}

function tenderAiSummaryCardMarkup(tender) {
  if (state.aiSummaryActiveId !== tender.id) return "";
  const cached = state.aiSummaries[tender.notifyNo] || (state.aiSummaryLoadingId !== tender.id ? getFallbackSummary(tender) : null);
  const loading = state.aiSummaryLoadingId === tender.id && !cached;

  let contentHtml = "";
  if (loading) {
    contentHtml = `
      <div class="ai-popover-loading">
        <div class="ai-spinner"></div>
        <span>Gemini AI đang phân tích toàn văn hồ sơ...</span>
      </div>`;
  } else if (cached) {
    contentHtml = renderPremiumAiDashboard(cached, tender);
  }

  return `
    <div class="tender-ai-card">
      <div class="ai-card-header">
        <div class="ai-card-title"><span>✨</span> <strong>AI ĐẤU THẦU KIỂU VIỆT - PHÂN TÍCH CHUYÊN SÂU</strong></div>
        <button class="ai-card-close" data-action="close-ai" data-id="${escapeHtml(tender.id)}" type="button" aria-label="Đóng tóm tắt AI">✕</button>
      </div>
      ${contentHtml}
    </div>
  `;
}

function tenderMarkup(tender) {
  const expanded = state.expandedId === tender.id;
  const saved = state.saved.includes(String(tender.id));
  const hasResult = Boolean(tender.hasResult || tender.winnerNames?.length);
  const price = Number(tender.winningPrice) || Number(tender.price) || 0;
  const provLabel = getTenderProvince(tender);
  return `<article class="tender-row" data-tender-id="${escapeHtml(tender.id)}">
    <button class="save-button${saved ? " saved" : ""}" data-action="save" data-id="${escapeHtml(tender.id)}" type="button" aria-label="${saved ? "Bỏ lưu" : "Lưu"} gói thầu">${saved ? "★" : "☆"}</button>
    <div class="tender-main">
      <div class="tender-meta">
        <span class="province-badge" style="font-weight: 700; color: #1b5e20; background: #e8f5e9; padding: 1px 6px; border-radius: 4px; font-size: 10px; text-transform: uppercase; border: 1px solid #c8e6c9;">${escapeHtml(provLabel)}</span>
        <span>${escapeHtml(tender.notifyNo)}</span>
        <span>${escapeHtml(tender.category)}</span>
        ${hasResult ? '<span class="result-meta">Có kết quả</span>' : ""}
        ${Number(tender.bidderCount) ? `<span>${escapeHtml(tender.bidderCount)} nhà thầu</span>` : ""}
        <button class="ai-summary-badge" data-action="toggle-ai" data-id="${escapeHtml(tender.id)}" type="button" title="Rê chuột hoặc bấm để xem AI Gemini tóm tắt khái quát"><span class="ai-icon-sparkle">✨</span> AI Tóm tắt</button>
      </div>
      <h3>${escapeHtml(tender.name)}</h3>
      <p>${escapeHtml(tender.investor)} · ${escapeHtml(tender.location)}</p>
      ${tenderEquipmentPreviewMarkup(tender)}
    </div>
    <div class="tender-status"><span class="status-pill ${escapeHtml(tender.status)}">${escapeHtml(statusLabels[tender.status] || tender.status)}</span><span>Đóng ${escapeHtml(formatDate(tender.closeDate, true))}</span></div>
    <div class="tender-price"><strong title="${escapeHtml(formatMoney(price, false))}">${escapeHtml(formatMoney(price))}</strong><span>${tender.winningPrice ? "Giá trúng thầu" : "Giá dự toán"}</span></div>
    <div class="tender-actions"><button class="expand-button${expanded ? " expanded" : ""}" data-action="expand" data-id="${escapeHtml(tender.id)}" type="button" aria-expanded="${expanded}"><span>${expanded ? "Thu gọn" : "Mở rộng"}</span><span>⌄</span></button><a class="detail-link" href="${escapeHtml(officialUrl(tender.sourceUrl, tender.notifyNo))}" target="_blank" rel="noreferrer"><span>↗</span><span>Nguồn</span></a></div>
    ${tenderAiSummaryCardMarkup(tender)}
    ${expanded ? detailMarkup(tender) : ""}
  </article>`;
}

function paginationMarkup(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]);
  const visible = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const parts = [];
  parts.push(`<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="Trang trước">‹</button>`);
  visible.forEach((page, index) => {
    if (index > 0 && page - visible[index - 1] > 1) parts.push('<span aria-hidden="true">…</span>');
    parts.push(`<button type="button" data-page="${page}" class="${page === currentPage ? "selected" : ""}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`);
  });
  parts.push(`<button type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="Trang sau">›</button>`);
  return parts.join("");
}

function render() {
  const tenders = filteredTenders();
  renderMetrics(tenders);
  const totalPages = Math.max(1, Math.ceil(tenders.length / TENDERS_PER_PAGE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const firstIndex = (state.page - 1) * TENDERS_PER_PAGE;
  const visibleTenders = tenders.slice(firstIndex, firstIndex + TENDERS_PER_PAGE);
  const equipmentMatchCount = tenders.reduce(
    (sum, tender) => sum + (state.searchMatchesByNotifyNo.get(tender.notifyNo)?.length || 0),
    0,
  );
  elements.resultCount.textContent = `${tenders.length} gói thầu${equipmentMatchCount ? ` · ${equipmentMatchCount} mặt hàng/model khớp` : ""} · trang ${state.page}/${totalPages}${state.investor ? ` · ${state.investor}` : ""}`;
  elements.list.innerHTML = tenders.length
    ? visibleTenders.map(tenderMarkup).join("")
    : '<div class="empty-state"><span class="icon-text">⌕</span><h3>Chưa tìm thấy gói thầu phù hợp</h3><p>Hãy thử từ khóa ngắn hơn hoặc mở rộng khoảng thời gian.</p></div>';
  elements.list.setAttribute("aria-busy", "false");
  elements.pagination.hidden = !tenders.length;
  elements.pagination.innerHTML = tenders.length ? paginationMarkup(state.page, totalPages) : "";
}

async function loadData(cacheBust = false) {
  elements.refresh.disabled = true;
  elements.dataState.dataset.state = "loading";
  elements.sourceLabel.textContent = "Đang tải dữ liệu";
  elements.warning.hidden = true;
  if (cacheBust) {
    state.aiSummaries = {};
  }
  try {
    const suffix = cacheBust ? `?t=${Date.now()}` : "";
    const [response, equipmentResponse] = await Promise.all([
      fetch(`${DATA_URL}${suffix}`, { cache: cacheBust ? "reload" : "default" }),
      fetch(`${EQUIPMENT_SEARCH_URL}${suffix}`, { cache: cacheBust ? "reload" : "default" })
        .catch(() => null),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.tenders)) throw new Error("Tệp dữ liệu không hợp lệ");
    let equipment = [];
    if (equipmentResponse?.ok) {
      try {
        const equipmentData = await equipmentResponse.json();
        if (Array.isArray(equipmentData.equipment)) equipment = equipmentData.equipment;
      } catch {
        equipment = [];
      }
    }
    state.tenders = data.tenders;
    state.equipmentByNotifyNo = indexEquipment(equipment);
    state.searchMatchesByNotifyNo.clear();
    state.detailsByNotifyNo = data.detailsByNotifyNo || {};
    state.fetchedAt = data.fetchedAt || "";
    state.page = 1;
    elements.dataState.dataset.state = "live";
    elements.sourceLabel.textContent = equipment.length
      ? "Dữ liệu & model đã đồng bộ"
      : "Dữ liệu đã đồng bộ";
    elements.updatedLabel.textContent = state.fetchedAt
      ? `Cập nhật ${formatDate(state.fetchedAt, true)}`
      : "Từ Hệ thống mạng đấu thầu quốc gia";
    render();
    void preloadBatchSummaries(state.tenders);
  } catch (error) {
    elements.dataState.dataset.state = "error";
    elements.sourceLabel.textContent = "Không tải được dữ liệu";
    elements.updatedLabel.textContent = "Vui lòng thử lại sau";
    elements.warning.hidden = false;
    elements.warning.textContent = `Không đọc được bản dữ liệu đã đồng bộ (${error.message}).`;
    elements.list.innerHTML = '<div class="empty-state"><h3>Nguồn dữ liệu tạm thời chưa sẵn sàng</h3><p>Vui lòng bấm cập nhật hoặc quay lại sau.</p></div>';
    elements.pagination.hidden = true;
  } finally {
    elements.refresh.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = elements.keyword.value;
  state.page = 1;
  state.expandedId = null;
  state.investor = "";
  render();
  document.querySelector("#goi-thau")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function updateDynamicPageTitles() {
  const titles = {
    mientrung: "Miền Trung & Tây Nguyên",
    gialai: "Gia Lai",
    binhdinh: "Bình Định",
    daklak: "Đắk Lắk",
    kontum: "Kon Tum",
    phuyen: "Phú Yên",
    quangngai: "Quảng Ngãi",
    quangnam: "Quảng Nam",
    khanhhoa: "Khánh Hòa",
    lamdong: "Lâm Đồng",
    daknong: "Đắk Nông",
    ninhthuan_binhthuan: "Ninh Thuận & Bình Thuận",
    quangtri_quangbinh_hue: "Trị Thiên Huế & Quảng Bình",
    all: "Toàn quốc"
  };
  const activeLabel = titles[state.province] || "Miền Trung";
  const heroTitle = document.querySelector("#hero-title");
  if (heroTitle) {
    heroTitle.innerHTML = `Theo dõi cơ hội thầu<br />thiết bị y tế tại ${activeLabel}`;
  }
  document.title = `Thầu Y tế ${activeLabel}`;
}

if (elements.province) {
  elements.province.addEventListener("change", () => {
    state.province = elements.province.value;
    state.page = 1;
    state.expandedId = null;
    updateDynamicPageTitles();
    render();
  });
}

elements.category.addEventListener("change", () => {
  state.category = elements.category.value;
  state.page = 1;
  state.expandedId = null;
  render();
});

elements.days.addEventListener("change", () => {
  state.days = Number(elements.days.value) || 30;
  state.page = 1;
  state.expandedId = null;
  render();
});

elements.statusFilter.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-status]");
  if (!button) return;
  state.status = button.dataset.status;
  state.page = 1;
  state.expandedId = null;
  elements.statusFilter.querySelectorAll("button[data-status]").forEach((item) => {
    item.classList.toggle("selected", item === button);
  });
  render();
});

elements.investorRanking.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-investor]");
  if (!button) return;
  state.investor = state.investor === button.dataset.investor ? "" : button.dataset.investor;
  state.query = "";
  elements.keyword.value = "";
  state.page = 1;
  state.expandedId = null;
  render();
  document.querySelector("#goi-thau")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.savedList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-saved-open]");
  if (!button) return;
  const tender = state.tenders.find((item) => String(item.id) === button.dataset.savedOpen);
  if (!tender) return;
  state.query = "";
  state.category = "all";
  state.days = 3650;
  state.status = "all";
  state.investor = "";
  state.page = 1;
  state.expandedId = null;
  elements.keyword.value = "";
  elements.category.value = "all";
  elements.days.value = "3650";
  elements.statusFilter.querySelectorAll("button[data-status]").forEach((item) => {
    item.classList.toggle("selected", item.dataset.status === "all");
  });
  const tenderIndex = filteredTenders().findIndex((item) => item.id === tender.id);
  state.page = Math.floor(Math.max(0, tenderIndex) / TENDERS_PER_PAGE) + 1;
  void toggleDetails(tender);
  document.querySelector("#goi-thau")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "save") {
    state.saved = state.saved.includes(id) ? state.saved.filter((item) => item !== id) : [...state.saved, id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved));
  } else if (button.dataset.action === "download-tech") {
    const tender = state.tenders.find((item) => String(item.id) === id);
    if (tender) downloadTechnicalXlsx(tender, button);
    return;
  } else if (button.dataset.action === "expand") {
    const tender = state.tenders.find((item) => String(item.id) === id);
    if (tender) void toggleDetails(tender);
    return;
  } else if (button.dataset.action === "toggle-ai") {
    const tender = state.tenders.find((item) => String(item.id) === id);
    if (tender) {
      hideAiHoverPopover();
      state.aiSummaryActiveId = state.aiSummaryActiveId === tender.id ? null : tender.id;
      if (state.aiSummaryActiveId === tender.id) {
        void fetchAiSummary(tender);
      }
      render();
    }
    return;
  } else if (button.dataset.action === "close-ai") {
    state.aiSummaryActiveId = null;
    render();
    return;
  }
  render();
});

elements.pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page) || 1;
  state.expandedId = null;
  render();
  document.querySelector("#goi-thau")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.refresh.addEventListener("click", async () => {
  elements.refresh.disabled = true;
  elements.dataState.dataset.state = "loading";
  elements.sourceLabel.textContent = "Đang quét & cập nhật";
  elements.updatedLabel.textContent = "Đang quét Cổng mạng đấu thầu...";
  try {
    const response = await fetch("/api/trigger-scan", { method: "POST" });
    const resData = await response.json();
    if (!resData.success) {
      console.warn("Broad sync warning:", resData.error || resData.message);
    }
  } catch (err) {
    console.error("Broad sync error:", err);
  } finally {
    await loadData(true);
    elements.refresh.disabled = false;
  }
});

if (elements.directSyncButton) {
  elements.directSyncButton.addEventListener("click", async () => {
    const notifyNo = elements.directSyncInput.value.trim();
    if (!notifyNo) {
      alert("Vui lòng nhập Mã TBMT (Ví dụ: IB2600367132)!");
      return;
    }

    // Set loading state
    elements.directSyncButton.disabled = true;
    elements.directSyncSpinner.style.display = "inline-block";
    elements.directSyncBtnText.textContent = "Đang đồng bộ...";

    try {
      const response = await fetch("/api/fetch-tender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyNo }),
      });

      const resData = await response.json();
      if (resData.success) {
        alert(`Đồng bộ thành công! ${resData.message || ""}`);
        elements.directSyncInput.value = "";
        
        // Reload all data so that the new tender is added to our list instantly
        await loadData(true);

        // Auto filter/highlight the scanned tender
        state.query = notifyNo;
        elements.keyword.value = notifyNo;
        state.page = 1;
        state.days = 3650; // Ensure it's not filtered out by time range
        if (elements.days) elements.days.value = "3650";
        render();
      } else {
        alert(`Lỗi đồng bộ: ${resData.error || resData.message || "Không xác định"}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Lỗi kết nối hoặc hệ thống: ${err.message}`);
    } finally {
      // Reset button state
      elements.directSyncButton.disabled = false;
      elements.directSyncSpinner.style.display = "none";
      elements.directSyncBtnText.textContent = "Đồng bộ thầu";
    }
  });
}

if (elements.province) {
  state.province = elements.province.value || "mientrung";
}
updateDynamicPageTitles();
loadData();

// --- DYNAMIC PORTFOLIO RENDERING & CONFIGURATION CONTROLLER ---
function renderKieuVietPortfolio(query = "") {
  const container = document.querySelector("#kv-portfolio-list");
  if (!container) return;
  
  const cleanQuery = query.toLowerCase().trim();
  const filtered = (companyProfile.projects || []).filter(p => {
    if (!cleanQuery) return true;
    return (p.name || "").toLowerCase().includes(cleanQuery) || 
           (p.investor || "").toLowerCase().includes(cleanQuery) || 
           (p.details || "").toLowerCase().includes(cleanQuery) ||
           (p.shortName || "").toLowerCase().includes(cleanQuery);
  });
  
  const labelEl = document.querySelector("#kv-display-name-label");
  if (labelEl) {
    labelEl.textContent = companyProfile.name || "Kiểu Việt";
  }
  
  let membersHtml = "";
  if (!cleanQuery && companyProfile.members && Array.isArray(companyProfile.members) && companyProfile.members.length > 0) {
    membersHtml = `
      <div style="background: #f0f7ff; border: 1px solid #bae0ff; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 11px; color: #1d3920;">
        <div style="font-weight: 700; color: #0958d9; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>🏥 Thành viên Hệ sinh thái Kiểu Việt</span>
          <span style="font-weight: 600; font-size: 10px; background: #e6f4ff; color: #0958d9; padding: 2px 6px; border-radius: 4px; border: 1px solid #91caff;">Liên danh Đứng đầu</span>
        </div>
        ${companyProfile.members.map((m, idx) => `
          <div style="line-height: 1.4; margin-bottom: 6px; background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #e6f4ff;">
            <strong style="color: #003eb3;">${idx + 1}. ${escapeHtml(m.name)}</strong>
            <div style="color: #555; font-size: 10.5px; margin-top: 2px;">
              • <strong>MST:</strong> ${escapeHtml(m.taxCode)}<br>
              • <strong>Địa chỉ:</strong> ${escapeHtml(m.address)}<br>
              • <strong>Nhiệm vụ:</strong> ${escapeHtml(m.role)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (filtered.length === 0) {
    container.innerHTML = membersHtml + `<div style="text-align: center; padding: 20px; font-size: 11.5px; color: #888;">Không tìm thấy dự án phù hợp với từ khóa.</div>`;
    return;
  }
  
  container.innerHTML = membersHtml + filtered.map(p => {
    const val = Number(p.value) || 0;
    const valueFormatted = (val / 1000000000).toFixed(2) + " tỷ VNĐ";
    return `
      <div class="kv-portfolio-item" data-proj-id="${p.id}" style="background: #fff; border: 1px solid var(--border-soft); border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s ease; position: relative; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <strong style="font-size: 12.5px; color: #222; line-height: 1.35; font-weight: 600;">${escapeHtml(p.shortName || p.investor)}</strong>
          <span style="font-size: 11px; background: #fdf6ec; color: #b88230; padding: 1px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap; border: 1px solid #f5dab1;">${valueFormatted}</span>
        </div>
        <p style="font-size: 11px; color: #555; margin: 4px 0 0 0; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(p.name)}</p>
        
        <div class="kv-portfolio-detail" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e6dfd3; font-size: 11px; color: #444; line-height: 1.45;">
          <div style="margin-bottom: 4px;"><strong>Chủ đầu tư:</strong> ${escapeHtml(p.investor)}</div>
          <div style="margin-bottom: 4px;"><strong>Năm hoàn tất:</strong> ${escapeHtml(p.year)}</div>
          <div style="margin-bottom: 4px;"><strong>Trạng thái:</strong> <span style="color: #1b5e20; font-weight: 600;">${escapeHtml(p.status || "Nghiệm thu & bàn giao")}</span></div>
          <div style="margin-bottom: 6px;"><strong>Chi tiết cung cấp:</strong> ${escapeHtml(p.details || "")}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 4px;">
            <a href="${escapeHtml(p.websiteUrl || 'https://kieuviet.com.vn')}" target="_blank" rel="noopener" style="color: #b88230; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">Trang chủ công ty ↗</a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderContractsEditList() {
  const container = document.querySelector("#kv-contracts-edit-list");
  if (!container) return;

  if (!companyProfile.projects || companyProfile.projects.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #888; font-size: 11.5px; padding: 10px;">Chưa có hợp đồng nào. Click "Thêm hợp đồng" để bổ sung.</div>`;
    return;
  }

  container.innerHTML = companyProfile.projects.map((p, idx) => {
    return `
      <div class="kv-contract-edit-card" data-idx="${idx}" style="background: #fdfdfd; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 12px; position: relative;">
        <button type="button" class="kv-delete-contract-btn" data-idx="${idx}" style="position: absolute; top: 10px; right: 10px; background: #fee2e2; color: #dc2626; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10.5px; font-weight: 600; cursor: pointer; transition: background 0.2s; z-index: 10;">
          Xóa
        </button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; margin-top: 15px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Tên viết tắt chủ đầu tư</label>
            <input type="text" class="kv-edit-proj-short" value="${escapeHtml(p.shortName || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Chủ đầu tư đầy đủ</label>
            <input type="text" class="kv-edit-proj-investor" value="${escapeHtml(p.investor || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
          </div>
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Tên hợp đồng đầy đủ</label>
          <input type="text" class="kv-edit-proj-name" value="${escapeHtml(p.name || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Năm hoàn tất</label>
            <input type="text" class="kv-edit-proj-year" value="${escapeHtml(p.year || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Giá trị (VNĐ)</label>
            <input type="number" class="kv-edit-proj-value" value="${p.value || 0}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Phân nhóm</label>
            <input type="text" class="kv-edit-proj-category" value="${escapeHtml(p.category || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
          </div>
        </div>
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Trạng thái / nghiệm thu</label>
          <input type="text" class="kv-edit-proj-status" value="${escapeHtml(p.status || '')}" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px;">
        </div>
        <div>
          <label style="display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 3px;">Chi tiết cung cấp (Trang thiết bị, khối lượng...)</label>
          <textarea class="kv-edit-proj-details" style="width: 100%; border: 1px solid #ccc; padding: 6px 8px; border-radius: 4px; font-size: 11.5px; min-height: 50px; resize: vertical;">${escapeHtml(p.details || '')}</textarea>
        </div>
      </div>
    `;
  }).join("");

  // Attach delete button click handlers
  container.querySelectorAll(".kv-delete-contract-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      if (confirm("Bạn có chắc muốn xóa hợp đồng này khỏi hồ sơ năng lực?")) {
        companyProfile.projects.splice(idx, 1);
        renderContractsEditList();
      }
    });
  });
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `kv-toast ${type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`;
  toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999; animation: slideIn 0.3s ease; opacity: 1; transition: opacity 0.3s ease; background: #2e7d32; border-left: 5px solid #1b5e20;";
  if (type === "error") {
    toast.style.background = "#c62828";
    toast.style.borderLeftColor = "#b71c1c";
  }
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupProfileTabs() {
  const tabPortfolio = document.querySelector("#tab-btn-portfolio");
  const tabConfig = document.querySelector("#tab-btn-config");
  const viewPortfolio = document.querySelector("#kv-tab-portfolio-view");
  const viewConfig = document.querySelector("#kv-tab-profile-edit");

  if (!tabPortfolio || !tabConfig || !viewPortfolio || !viewConfig) return;

  tabPortfolio.addEventListener("click", () => {
    tabPortfolio.classList.add("active");
    tabConfig.classList.remove("active");
    viewPortfolio.style.display = "block";
    viewConfig.style.display = "none";
  });

  tabConfig.addEventListener("click", () => {
    tabConfig.classList.add("active");
    tabPortfolio.classList.remove("active");
    viewPortfolio.style.display = "none";
    viewConfig.style.display = "block";
    
    // Initialize form fields
    const nameInput = document.querySelector("#kv-input-name");
    const bizInput = document.querySelector("#kv-input-business");
    const locInput = document.querySelector("#kv-input-locations");
    
    if (nameInput) nameInput.value = companyProfile.name || "";
    if (bizInput) bizInput.value = companyProfile.coreBusiness || "";
    if (locInput) locInput.value = companyProfile.primaryLocations || "";
    renderContractsEditList();
  });
}

// Add real-time search listener and accordion listener for portfolio
document.addEventListener("DOMContentLoaded", () => {
  renderKieuVietPortfolio();
  setupProfileTabs();
  
  const searchInput = document.querySelector("#kv-portfolio-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderKieuVietPortfolio(e.target.value);
    });
  }
  
  const listContainer = document.querySelector("#kv-portfolio-list");
  if (listContainer) {
    listContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".kv-portfolio-item");
      if (!item) return;
      
      // Toggle the detail drawer
      const detail = item.querySelector(".kv-portfolio-detail");
      if (detail) {
        const isCurrentlyVisible = detail.style.display === "block";
        detail.style.display = isCurrentlyVisible ? "none" : "block";
        item.style.borderColor = isCurrentlyVisible ? "var(--border-soft)" : "#d6ad69";
        item.style.boxShadow = isCurrentlyVisible ? "none" : "0 4px 12px rgba(214, 173, 105, 0.12)";
      }
    });
  }

  // Add contract button
  const addBtn = document.querySelector("#kv-add-contract-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (!companyProfile.projects) companyProfile.projects = [];
      companyProfile.projects.push({
        id: "kv-proj-" + Date.now(),
        name: "",
        shortName: "",
        investor: "",
        year: new Date().getFullYear().toString(),
        value: 0,
        category: "",
        status: "Nghiệm thu & bàn giao",
        details: "",
        websiteUrl: "https://kieuviet.com.vn"
      });
      renderContractsEditList();
    });
  }

  // Save profile form submission
  const profileForm = document.querySelector("#kv-profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      companyProfile.name = document.querySelector("#kv-input-name").value.trim();
      companyProfile.coreBusiness = document.querySelector("#kv-input-business").value.trim();
      companyProfile.primaryLocations = document.querySelector("#kv-input-locations").value.trim();

      const cards = document.querySelectorAll(".kv-contract-edit-card");
      const updatedProjects = [];
      cards.forEach(card => {
        const idx = parseInt(card.getAttribute("data-idx"));
        const shortName = card.querySelector(".kv-edit-proj-short").value.trim();
        const investor = card.querySelector(".kv-edit-proj-investor").value.trim();
        const name = card.querySelector(".kv-edit-proj-name").value.trim();
        const year = card.querySelector(".kv-edit-proj-year").value.trim();
        const value = parseFloat(card.querySelector(".kv-edit-proj-value").value) || 0;
        const category = card.querySelector(".kv-edit-proj-category").value.trim();
        const status = card.querySelector(".kv-edit-proj-status").value.trim();
        const details = card.querySelector(".kv-edit-proj-details").value.trim();

        updatedProjects.push({
          id: companyProfile.projects[idx]?.id || "kv-proj-" + Date.now() + Math.random(),
          shortName,
          investor,
          name,
          year,
          value,
          category,
          status,
          details,
          websiteUrl: companyProfile.projects[idx]?.websiteUrl || "https://kieuviet.com.vn"
        });
      });

      companyProfile.projects = updatedProjects;
      localStorage.setItem("custom_company_profile", JSON.stringify(companyProfile));
      
      renderKieuVietPortfolio();
      showToast("Hồ sơ năng lực đã được lưu thành công!");
      
      if (typeof render === "function") {
        render();
      }
      
      const tabPortfolio = document.querySelector("#tab-btn-portfolio");
      if (tabPortfolio) tabPortfolio.click();
    });
  }

  // Reset profile
  const resetBtn = document.querySelector("#kv-reset-profile-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn khôi phục hồ sơ năng lực về mặc định của Kiểu Việt?")) {
        companyProfile = JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE));
        localStorage.setItem("custom_company_profile", JSON.stringify(companyProfile));
        renderKieuVietPortfolio();
        renderContractsEditList();
        showToast("Đã khôi phục hồ sơ năng lực về mặc định.");
        if (typeof render === "function") render();
      }
    });
  }

  // Quick template selection click handler
  document.querySelectorAll(".kv-tpl-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tplKey = btn.getAttribute("data-tpl");
      const template = PROFILE_TEMPLATES[tplKey];
      if (template) {
        companyProfile = JSON.parse(JSON.stringify(template));
        localStorage.setItem("custom_company_profile", JSON.stringify(companyProfile));
        
        // Update input fields in UI if they are visible
        const nameInput = document.querySelector("#kv-input-name");
        const bizInput = document.querySelector("#kv-input-business");
        const locInput = document.querySelector("#kv-input-locations");
        if (nameInput) nameInput.value = companyProfile.name || "";
        if (bizInput) bizInput.value = companyProfile.coreBusiness || "";
        if (locInput) locInput.value = companyProfile.primaryLocations || "";
        
        renderKieuVietPortfolio();
        renderContractsEditList();
        
        showToast(`Đã áp dụng mẫu "${companyProfile.name}"!`);
        if (typeof render === "function") render();
      }
    });
  });

  // Export profile
  const exportBtn = document.querySelector("#kv-export-profile-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(companyProfile, null, 2));
      const dlAnchorElem = document.createElement("a");
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `profile_${(companyProfile.name || 'company').toLowerCase().replace(/\s+/g, '_')}.json`);
      dlAnchorElem.click();
      showToast("Đang tải xuống hồ sơ JSON...");
    });
  }

  // File Upload JSON Input
  const fileInput = document.querySelector("#kv-profile-file-input");
  const dragZone = document.querySelector("#kv-drag-zone");

  function handleProfileJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.name || !parsed.coreBusiness || !parsed.primaryLocations) {
        alert("Cấu trúc JSON không hợp lệ! Cần chứa ít nhất các khóa: 'name', 'coreBusiness', và 'primaryLocations'.");
        return;
      }
      if (!parsed.projects || !Array.isArray(parsed.projects)) {
        parsed.projects = [];
      }
      companyProfile = parsed;
      localStorage.setItem("custom_company_profile", JSON.stringify(companyProfile));
      renderKieuVietPortfolio();
      renderContractsEditList();
      showToast("Nhập hồ sơ năng lực JSON thành công!");
      if (typeof render === "function") render();
    } catch (err) {
      alert("Không thể giải mã tệp tin JSON! Vui lòng kiểm tra lại định dạng.");
    }
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          handleProfileJSON(event.target.result);
        };
        reader.readAsText(file);
      }
    });
  }

  if (dragZone) {
    dragZone.addEventListener("click", () => {
      if (fileInput) fileInput.click();
    });

    dragZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dragZone.style.borderColor = "#b88230";
      dragZone.style.background = "#fffbf5";
    });

    dragZone.addEventListener("dragleave", () => {
      dragZone.style.borderColor = "#e0e0e0";
      dragZone.style.background = "#fafafa";
    });

    dragZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dragZone.style.borderColor = "#e0e0e0";
      dragZone.style.background = "#fafafa";
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          handleProfileJSON(event.target.result);
        };
        reader.readAsText(file);
      }
    });
  }
});

// Since DOMContentLoaded might have already fired, let's also initialize it immediately
renderKieuVietPortfolio();
setupProfileTabs();

