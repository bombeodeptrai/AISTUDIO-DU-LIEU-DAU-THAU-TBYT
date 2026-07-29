
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
function isMedical(item) {
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
  if (excludedTerms.some((term) => title.includes(term))) return false;

  // Chỉ các cụm từ tự thân xác định rõ thiết bị/vật tư y tế mới được giữ lại.
  const explicitMedicalTerms = [
    ...SEARCH_KEYWORDS,
    "trang thiết bị y tế", "y cụ", "y dụng cụ", "hóa chất y tế", "hoá chất y tế",
    "sinh phẩm y tế", "sinh phẩm xét nghiệm", "khí y tế", "oxy y tế",
    "hóa chất khử khuẩn", "hoá chất khử khuẩn", "hóa chất định nhóm máu",
    "hoá chất định nhóm máu", "vật tư xét nghiệm", "vật tư nha khoa",
  ];
  if (explicitMedicalTerms.some((term) => originalTitle.includes(term))) return true;

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
  if (medicalProductTerms.some((term) => originalTitle.includes(term))) return true;

  // Hóa chất/sinh phẩm chỉ được giữ khi gắn với xét nghiệm hoặc chẩn đoán y khoa.
  const laboratoryTerms = [
    "xét nghiệm", "chẩn đoán", "in vitro", "huyết học", "sinh hóa", "sinh hoá",
    "vi sinh", "bệnh phẩm", "định nhóm máu", "máy huyết học", "máy sinh hóa", "máy sinh hoá",
    "miễn dịch", "elisa", "pcr", "hba1c", "nước tiểu", "đông máu", "sinh học phân tử", "máy phân tích",
    "giải phẫu bệnh", "tế bào học", "mô bệnh học"
  ];
  const laboratorySupplies = ["hóa chất", "hoá chất", "sinh phẩm", "vật tư", "chủng vi sinh"];
  if (laboratoryTerms.some((term) => originalTitle.includes(term))
    && laboratorySupplies.some((term) => originalTitle.includes(term))) return true;

  // Tiêu đề chung chỉ được nhận khi vừa có vật tư/hóa chất, vừa có ngữ cảnh khám chữa bệnh,
  // và chủ đầu tư rõ ràng là cơ sở y tế. Không dùng tên chủ đầu tư làm điều kiện duy nhất.
  const medicalInvestors = [
    "so y te", "benh vien", "trung tam y te", "tram y te", "trung tam kiem soat benh tat",
    "cdc", "phong kham", "benh xa", "y khoa", "y duoc", "da khoa", "chuyen khoa",
    "trung tam phap y", "trung tam kiem nghiem",
  ];
  const genericSupplyTerms = ["vat tu", "hoa chat", "sinh pham", "dung cu"];
  const clinicalTerms = ["kham chua benh", "kham benh", "chua benh", "dieu tri", "phong mo"];
  return medicalInvestors.some((term) => investor.includes(term))
    && genericSupplyTerms.some((term) => title.includes(term))
    && clinicalTerms.some((term) => title.includes(term));
}

const items = [
  { bidName: ["Gói 6. Hóa chất sử dụng trên máy miễn dịch huỳnh quang gồm 02 mặt hàng 01 phần (lô)"], investorName: "Bệnh viện Đa khoa Gia Lai" },
  { bidName: ["Gói số 5. Hóa chất sử dụng cho máy ELISA miễn dịch bán tự động gồm 06 mặt hàng 01 phần (lô)"], investorName: "Bệnh viện Đa khoa Gia Lai" },
  { bidName: ["Gói 4. Hóa chất sử dụng trên máy Xét nghiệm HbA1C gồm 03 mặt hàng 01 phần (lô)"], investorName: "Bệnh viện Đa khoa Gia Lai" },
  { bidName: ["Gói 3. Hóa chất sử dụng trên máy miễn dịch tự động gồm 08 mặt hàng 01 phần (lô)"], investorName: "Bệnh viện Đa khoa Gia Lai" },
  { bidName: ["Gói 2. Hóa chất sử dụng trên máy phân tích huyết học tự động gồm 07 mặt hàng 01 phần (lô)"], investorName: "Bệnh viện Đa khoa Gia Lai" }
];

items.forEach(item => {
  console.log(item.bidName[0], "=>", isMedical(item));
});
