import fetch from "node-fetch";
async function test() {
  const payload = [{
    pageSize: 100,
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
        { fieldName: "publicDate", searchType: "range", from: "2026-07-28T00:00:00Z", to: "2026-07-30T00:00:00Z" }
      ]
    }]
  }];
  for(let i=0;i<3;i++) {
    try {
      const res = await fetch("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      const found = data.page?.content?.find(x => x.notifyNo === "IB2600349751");
      console.log("Found IB2600349751 with keyword 'hóa chất':", !!found);
      console.log("Total matched 'hóa chất':", data.page?.totalElements);
      return;
    } catch(e) {}
  }
}
test();
