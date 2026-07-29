import fs from "fs";
const script = fs.readFileSync("./scripts/fetch-data.mjs", "utf-8");
const postJsonSrc = script.match(/async function postJson[\s\S]*?^}/m)[0];
const delaySrc = script.match(/function delay[\s\S]*?^}/m)[0];
fs.writeFileSync("./test-page-size-run.mjs", `
import fetch from "node-fetch";
${delaySrc}
${postJsonSrc}
async function test() {
  const payload = [{
    pageSize: 50,
    pageNumber: 0,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: "y tế",
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
  console.log("Returned items:", data.page?.content?.length);
}
test();
`);
