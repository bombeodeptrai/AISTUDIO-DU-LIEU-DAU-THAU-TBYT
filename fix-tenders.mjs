import fetch from "node-fetch";

async function fetchByNotifyNo(notifyNo) {
  const payload = [{
    pageSize: 10,
    pageNumber: 0,
    sortBy: "publicDate",
    sortType: "DESC",
    query: [{
      index: "es-contractor-selection",
      keyWord: notifyNo,
      matchType: "exact",
      matchFields: ["notifyNo"],
      filters: [
        { fieldName: "type", searchType: "in", fieldValues: ["es-notify-contractor"] }
      ]
    }]
  }];
  const res = await fetch("https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search", {
    method: "POST", headers: { 
      "Content-Type": "application/json",
      "User-Agent": "thau-y-te-gia-lai-public-data/2.0" 
    }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  return data.page?.content?.[0];
}

async function main() {
  const ids = [
    "IB2600349751",
    "IB2600348377",
    "IB2600347689",
    "IB2600346897"
  ];
  const results = [];
  for (const id of ids) {
    console.log("Fetching", id);
    const item = await fetchByNotifyNo(id);
    if (item) results.push(item);
  }
  
  import("fs").then(fs => {
    fs.writeFileSync("missing_tenders.json", JSON.stringify(results, null, 2));
    console.log("Saved missing_tenders.json");
  });
}
main();
