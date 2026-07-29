
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
  const payload = [{
    pageSize: 10,
    pageNumber: 0,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: "hóa chất",
      matchType: "exact",
      matchFields: ["bidName"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
        { fieldName: "locations.provCode", searchType: "in", fieldValues: ["52"] },
      ]
    }]
  }];
  const data = await postJson("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", payload, 5000);
  console.log("Total records:", data.page?.totalElements);
}
test();
