import { extractOnlineReofferTechnicalRequirements } from "./scripts/technical-requirements.mjs";

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://muasamcong.mpi.gov.vn",
      Referer: "https://muasamcong.mpi.gov.vn/",
      "User-Agent": "thau-y-te-gia-lai-public-data/2.0",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} phản hồi HTTP ${response.status}`);
  return await response.json();
}

async function main() {
  try {
    const notifyId = "72e73097-b091-44a6-85c6-812416567c13";
    
    // 1. Get Technical Requirements
    console.log("Fetching Technical Requirements (E-HSMT)...");
    const hsmtUrl = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/lcnt_tbmcgtt_hsmt";
    const hsmtPayload = await postJson(hsmtUrl, {
      id: notifyId,
      processApply: "LDT",
    });
    const requirements = extractOnlineReofferTechnicalRequirements(hsmtPayload);
    console.log("Requirements parsed:", requirements.total, "items found.");
    if (requirements.total === 0) {
      console.log("Empty items. Form codes available:", (hsmtPayload.bidoInvBiddingDTO || []).map(f => f.formCode));
      // Log Table keys from formValue
      (hsmtPayload.bidoInvBiddingDTO || []).forEach(f => {
        try {
          const val = JSON.parse(f.formValue || "{}");
          console.log(`Form ${f.formCode} keys:`, Object.keys(val));
          if (val.Table && val.Table.length) {
            console.log(`Form ${f.formCode} Table[0]:`, val.Table[0]);
          }
        } catch(e) {}
      });
    }

    // 2. Get Input Result (Kết quả)
    console.log("Fetching Input Result (KQLCNT)...");
    const resultUrl = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/expose/contractor-input-result/get?token=public";
    const resultPayload = await postJson(resultUrl, {
      id: "d9c80e57-afef-4c57-97b8-ee138cc7bd83"
    });
    console.log("Lot result DTO length:", resultPayload?.bideContractorInputResultDTO?.lotResultDTO?.length);
    console.log("Lot result items length:", resultPayload?.bideContractorInputResultDTO?.lotResultItems?.length);
    if (!resultPayload?.bideContractorInputResultDTO?.lotResultItems?.length) {
        // Maybe in decisionVersions
        const versions = resultPayload?.bideContractorInputResultDTO?.decisionVersions || [];
        console.log("Versions count:", versions.length);
        if (versions.length) {
            console.log("Version 0 lot items:", versions[0].lotResultItems?.length);
        }
    }

  } catch (err) {
    console.error(err);
  }
}

main();
