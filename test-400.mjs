import fetch from "node-fetch";

async function test() {
  const payload = [{
    pageSize: 10,
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
      ]
    }]
  }];
  const res = await fetch("https://muasamcong.mpi.gov.vn/o/egp-portal-home/services/smart/search", {
    method: "POST", headers: { 
      "Content-Type": "application/json",
      "User-Agent": "test" 
    }, body: JSON.stringify(payload)
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
