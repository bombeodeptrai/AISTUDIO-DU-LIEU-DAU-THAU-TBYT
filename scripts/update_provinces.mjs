import fs from "fs";

const file = "./data/tenders.json";
if (fs.existsSync(file)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  
  function detectLocationAndProvCode(item) {
    let provCode = item.locations?.[0]?.provCode || "";
    let location = item.locations?.map((l) => [l.districtName, l.provName].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "";

    const text = `${item.investorName || item.investor || ""} ${item.procuringEntityName || ""} ${(item.bidName || []).join(" ")} ${item.name || ""}`.toLowerCase();

    const PROVINCE_MAP = [
      { code: "52", name: "Tỉnh Gia Lai", keywords: ["gia lai", "pleiku", "đức cơ", "chư sê", "chư prông", "chư păh", "chư pưh", "an khê", "ayun pa", "đak đoa", "đăk đoa", "đak pơ", "đăk pơ", "mang yang", "kông chro", "kbang", "phú thiện", "krông pa", "ia pa", "ia grai", "gia lai - kon tum", "gia lai kon tum"] },
      { code: "50", name: "Tỉnh Bình Định", keywords: ["bình định", "quy nhơn", "bồng sơn", "hoài nhơn", "an nhơn", "tuy phước", "phù cát", "phù mỹ", "hoài ân", "an lão", "an lao", "tây sơn", "vân canh", "vĩnh thạnh", "tam quan", "phú phong", "nghĩa bình"] },
      { code: "54", name: "Tỉnh Đắk Lắk", keywords: ["đắk lắk", "dak lak", "daklak", "buôn ma thuột", "krông pắc", "cư m'gar", "buôn hồ", "ea h'leo", "ea kar", "cư kuin", "ea súp", "krông ana", "krông bông", "m'đrắk"] },
      { code: "53", name: "Tỉnh Kon Tum", keywords: ["kon tum", "đăk hà", "đăk tô", "măng đen", "ngọc hồi", "sa thầy", "tu mơ rông", "kon plông", "ia h'drai", "kon rẫy", "gia lai - kon tum", "gia lai kon tum"] },
      { code: "49", name: "Tỉnh Phú Yên", keywords: ["phú yên", "tuy hòa", "sông cầu", "đông hòa", "đồng xuân", "phú hòa", "sơn hòa", "sông hinh", "tây hòa", "tuy an", "phú khánh"] },
      { code: "51", name: "Tỉnh Quảng Ngãi", keywords: ["quảng ngãi", "quang ngai", "đức phổ", "bình sơn", "sơn tịnh", "tư nghĩa", "mộ đức", "nghĩa hành", "trà bồng", "ba tơ", "lý sơn", "minh long", "sơn hà", "nghĩa bình"] },
      { code: "48", name: "Tỉnh Quảng Nam", keywords: ["quảng nam", "tam kỳ", "hội an", "điện bàn", "đại lộc", "thăng bình", "núi thành", "bắc trà my", "nam trà my", "duy xuyên", "nông sơn", "quế sơn", "tiên phước", "quảng nam - đà nẵng", "quảng nam đà nẵng"] },
      { code: "56", name: "Tỉnh Khánh Hòa", keywords: ["khánh hòa", "nha trang", "cam ranh", "ninh hòa", "cam lâm", "diên khánh", "khánh sơn", "khánh vĩnh", "vạn ninh", "phú khánh"] },
      { code: "58", name: "Tỉnh Lâm Đồng", keywords: ["lâm đồng", "đà lạt", "bảo lộc", "bảo lâm", "di linh", "đơn dương", "đức trọng", "lạc dương", "lâm hà"] },
      { code: "55", name: "Tỉnh Đắk Nông", keywords: ["đắk nông", "dak nong", "gia nghĩa", "cư jút", "đắk glong", "đắk mil", "đắk r'lấp", "đắk song", "krông nô", "tuy đức"] },
      { code: "57", name: "Tỉnh Ninh Thuận", keywords: ["ninh thuận", "phan rang", "tháp chàm", "thuận hải"] },
      { code: "60", name: "Tỉnh Bình Thuận", keywords: ["bình thuận", "phan thiết", "la gi", "bắc bình", "hàm thuận", "tánh linh", "tuy phong", "thuận hải"] },
      { code: "46", name: "Tỉnh Thừa Thiên Huế", keywords: ["thừa thiên huế", "huế", "hương thủy", "hương trà", "bình trị thiên"] },
      { code: "45", name: "Tỉnh Quảng Trị", keywords: ["quảng trị", "đông hà", "cam lộ", "gio linh", "triệu phong", "vĩnh linh", "bình trị thiên"] },
      { code: "44", name: "Tỉnh Quảng Bình", keywords: ["quảng bình", "đồng hới", "ba đồn", "bố trạch", "lệ thủy", "bình trị thiên"] },
    ];

    if (!provCode) {
      const matched = PROVINCE_MAP.find((p) => p.keywords.some((kw) => text.includes(kw)));
      if (matched) provCode = matched.code;
    }

    if (!location || location === "Tỉnh Gia Lai") {
      const matched = PROVINCE_MAP.find((p) => p.code === provCode || p.keywords.some((kw) => text.includes(kw)));
      location = matched ? matched.name : "Khu vực Miền Trung";
    }

    return { provCode, location };
  }

  data.tenders = data.tenders.map(t => {
    const info = detectLocationAndProvCode(t);
    return {
      ...t,
      provCode: info.provCode,
      location: info.location
    };
  });
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  console.log("Updated tenders count:", data.tenders.length);
}
