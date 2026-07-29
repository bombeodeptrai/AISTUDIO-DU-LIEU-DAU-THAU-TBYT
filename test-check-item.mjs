import fetch from "node-fetch";

async function test() {
  const payload = [{
    pageSize: 50,
    pageNumber: 0,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: "Bệnh viện Đa khoa Gia Lai",
      matchType: "all-1",
      matchFields: ["investorName", "procuringEntityName"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] },
        { fieldName: "publicDate", searchType: "range", from: "2026-07-28T00:00:00Z", to: "2026-07-30T00:00:00Z" }
      ]
    }]
  }];
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", {
        method: "POST", headers: { 
          "Content-Type": "application/json",
          "User-Agent": "thau-y-te-gia-lai-public-data/2.0" 
        }, body: JSON.stringify(payload)
      });
      const text = await res.text();
      try {
          const data = JSON.parse(text);
          console.log("Total:", data.page?.totalElements);
          console.log(data.page?.content?.map(t => t.notifyNo + " - " + t.bidName[0] + " - loc: " + t.locations?.map(l=>l.provCode).join(",")));
          return;
      } catch (e) {
          console.log("Parse error:", e);
      }
    } catch(e) {}
  }
}
test();
