import fs from "fs";
const script = fs.readFileSync("./scripts/fetch-data.mjs", "utf-8");
const postJsonSrc = script.match(/async function postJson[\s\S]*?^}/m)[0];
const delaySrc = script.match(/function delay[\s\S]*?^}/m)[0];
fs.writeFileSync("./test-post.mjs", `
import fetch from "node-fetch";
${delaySrc}
${postJsonSrc}
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
`);
