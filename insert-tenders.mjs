import fs from "fs";

const tenders = [
  {
    notifyNo: "IB2600349751",
    bidName: ["Gói 6. Hóa chất sử dụng trên máy miễn dịch huỳnh quang gồm 02 mặt hàng 01 phần (lô)"],
    investorName: "Bệnh viện Đa khoa Gia Lai",
    publicDate: "2026-07-29T03:49:00.000Z",
    bidCloseDate: "2026-08-10T01:00:00.000Z",
    provCode: "52",
    stepCode: "notify-contractor-step-1",
    isInternet: "1"
  },
  {
    notifyNo: "IB2600348377",
    bidName: ["Gói số 5. Hóa chất sử dụng cho máy ELISA miễn dịch bán tự động gồm 06 mặt hàng 01 phần (lô)"],
    investorName: "Bệnh viện Đa khoa Gia Lai",
    publicDate: "2026-07-29T03:47:00.000Z",
    bidCloseDate: "2026-08-10T01:00:00.000Z",
    provCode: "52",
    stepCode: "notify-contractor-step-1",
    isInternet: "1"
  },
  {
    notifyNo: "IB2600347689",
    bidName: ["Gói 4. Hóa chất sử dụng trên máy Xét nghiệm HbA1C gồm 03 mặt hàng 01 phần (lô)"],
    investorName: "Bệnh viện Đa khoa Gia Lai",
    publicDate: "2026-07-29T03:46:00.000Z",
    bidCloseDate: "2026-08-10T01:00:00.000Z",
    provCode: "52",
    stepCode: "notify-contractor-step-1",
    isInternet: "1"
  },
  {
    notifyNo: "IB2600346897",
    bidName: ["Gói 3. Hóa chất sử dụng trên máy miễn dịch tự động gồm 08 mặt hàng 01 phần (lô)"],
    investorName: "Bệnh viện Đa khoa Gia Lai",
    publicDate: "2026-07-29T03:45:00.000Z",
    bidCloseDate: "2026-08-10T01:00:00.000Z",
    provCode: "52",
    stepCode: "notify-contractor-step-1",
    isInternet: "1"
  }
];

const dataPath = "data/tenders.json";
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

// prepend them
for (const t of tenders.reverse()) {
  if (!data.tenders.some(existing => existing.notifyNo === t.notifyNo)) {
    data.tenders.unshift(t);
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log("Inserted missing tenders into data/tenders.json");
