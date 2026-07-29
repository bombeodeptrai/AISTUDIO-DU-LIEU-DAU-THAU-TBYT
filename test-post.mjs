
import fetch from "node-fetch";
function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
async function postJson(url, body, timeoutMs = 25_000) {
  let lastError;
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await delay(200);
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
async function test() {
  const PROVINCE_CODES = [
  "01", "02", "04", "06", "08", "10", "11", "12", "14", "15",
  "17", "19", "20", "22", "24", "25", "26", "27", "30", "31",
  "33", "34", "35", "36", "37", "38", "40", "42", "44", "45",
  "46", "48", "49", "50", "51", "52", "53", "54", "55", "56",
  "57", "58", "60", "62", "64", "66", "67", "68", "70", "72",
  "74", "75", "77", "79", "80", "82", "83", "84", "86", "87",
  "89", "91", "92", "93", "94", "95", "96"
  ];
  const payload = [{
    pageSize: 10,
    pageNumber: 0,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: "",
      matchType: "exact",
      matchFields: ["bidName"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
        { fieldName: "locations.provCode", searchType: "in", fieldValues: PROVINCE_CODES },
        { fieldName: "publicDate", searchType: "range", from: "2026-07-21T00:00:00.000Z", to: "2026-07-28T00:00:00.000Z" }
      ]
    }]
  }];
  const data = await postJson("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", payload);
  console.log("Total records:", data.page?.totalElements);
}
test();
