import fs from 'fs';
const script = fs.readFileSync("./scripts/fetch-data.mjs", "utf-8");
const isMedicalSrc = script.match(/function isMedical[\s\S]*?^}/m)[0];
const normalizeTextSrc = script.match(/function normalizeText[\s\S]*?^}/m)[0];
const searchKwSrc = script.match(/const SEARCH_KEYWORDS = \[[\s\S]*?^\];/m)[0];
fs.writeFileSync("./test-run-old-filter.mjs", `
${searchKwSrc}
${normalizeTextSrc}
${isMedicalSrc}

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
`);
