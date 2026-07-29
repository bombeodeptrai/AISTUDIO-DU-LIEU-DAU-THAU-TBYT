import fs from "fs";

const code = fs.readFileSync("scripts/fetch-data.mjs", "utf-8");
const normStr = code.substring(code.indexOf("function normalizeText("), code.indexOf("function normalizeTender(item)"));
const API_SEARCH_KEYWORDS = code.match(/const API_SEARCH_KEYWORDS = \[[^\]]+\];/)[0];
const SEARCH_KEYWORDS = code.match(/const SEARCH_KEYWORDS = \[[^\]]+\];/)[0];

const fnStr = code.substring(code.indexOf("function analyzeMedical(item)"), code.indexOf("function isStoredTenderMedical"));

const script = `
${API_SEARCH_KEYWORDS}
${SEARCH_KEYWORDS}
${normStr}
${fnStr}

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
`;
fs.writeFileSync("run-test-stats.mjs", script);
