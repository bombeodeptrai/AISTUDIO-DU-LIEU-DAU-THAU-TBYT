import fetch from "node-fetch";

async function test() {
  const PROVINCE_CODES = [
  "01", "02", "04", "06", "08", "10", "11", "12", "14", "15",
  "17", "19", "20", "22", "24", "25", "26", "27", "30", "31",
  "33", "34", "35", "36", "37", "38", "40", "42", "44", "45",
  "46", "48", "49", "50", "51", "52", "53", "54", "55", "56",
  "57", "58", "60", "62", "64", "66", "67", "68", "70", "72",
  "74", "75", "77", "79", "80", "82", "83", "84", "86", "87",
  "89", "91", "92", "93", "94", "95", "96"];

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
        { fieldName: "locations.provCode", searchType: "in", fieldValues: PROVINCE_CODES },
        { fieldName: "publicDate", searchType: "range", from: "2026-07-23T00:00:00Z", to: "2026-07-30T00:00:00Z" }
      ]
    }]
  }];
  for(let i=0; i<3; i++){
    try{
      const res = await fetch("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", {
        method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "test" }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log("hóa chất match exact bidName:", data.page?.totalElements);
      return;
    } catch(e) {}
  }
}
test();
