const express = require('express');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Gemini client lazy initialization
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback sequence for models in case of rate limits / quota issues
const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];

async function generateContentWithFallback(ai, requestConfig) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...requestConfig,
        model: model,
      });
      return { response, usedModel: model };
    } catch (err) {
      const msg = err.message || String(err);
      console.warn(`[Gemini Model ${model}] ${msg.slice(0, 120)}...`);
      lastError = err;
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        // Brief pause before fallback to avoid cascading rate-limit hits
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw lastError || new Error('All Gemini candidate models failed');
}

// Memory cache for summaries
const summaryCache = new Map();

app.post('/api/summarize-tender', async (req, res) => {
  try {
    const {
      notifyNo,
      name,
      investor,
      location,
      price,
      category,
      status,
      closeDate,
      winnerNames,
      equipmentSummary
    } = req.body;

    if (!notifyNo) {
      return res.status(400).json({ error: 'Mã TBMT không được để trống' });
    }

    if (summaryCache.has(notifyNo)) {
      return res.json({ success: true, data: summaryCache.get(notifyNo), cached: true });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackData = {
        summary: `Gói thầu "${name}" do ${investor || 'Chủ đầu tư'} mời thầu tại địa bàn ${location || 'Gia Lai'}.`,
        keyPoints: [
          `Giá dự toán / quy mô: ${price ? Number(price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa cập nhật'}`,
          `Phân loại: ${category || 'Thiết bị y tế'}`,
          `Trạng thái: ${status || 'Chưa rõ'}`,
          `Thời điểm đóng thầu: ${closeDate || 'Chưa công bố'}`
        ],
        aiAssessment: 'Lưu ý: Để bật AI Gemini phân tích nâng cao, hãy nhập GEMINI_API_KEY tại Cài đặt > Secrets.',
        isFallback: true
      };
      return res.json({ success: true, data: fallbackData });
    }

    const promptText = `Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam cấp cao, am hiểu sâu sắc Luật Đấu thầu số 22/2023/QH15 và Nghị định số 24/2024/NĐ-CP. Hãy thực hiện phân tích chuyên sâu đa chiều VÀ TÓM TẮT CHI TIẾT HỒ SƠ GÓI THẦU dưới đây dành cho các hãng sản xuất, nhà thầu phân phối và cơ sở y tế:

[THÔNG TIN HỒ SƠ GÓI THẦU]
- Mã TBMT: ${notifyNo}
- Tên gói thầu: ${name}
- Bên mời thầu / Chủ đầu tư: ${investor}
- Địa điểm thực hiện: ${location}
- Giá gói thầu / Giá dự toán: ${price ? Number(price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố'}
- Lĩnh vực / Danh mục: ${category}
- Trạng thái hiện tại: ${status}
- Hình thức LCNT: ${bidForm || 'Theo quy định'} (${processApply || 'Đấu thầu qua mạng'})
- Ngày đăng tải TBMT: ${publicDate || 'Chưa rõ'}
- Thời điểm đóng/mở thầu: ${closeDate || 'Chưa công bố'}
- Đã có kết quả: ${winnerNames ? 'Đã có' : 'Chưa'}
${winnerNames ? `- Nhà thầu trúng thầu: ${winnerNames}` : ''}
${winningPrice ? `- Giá trúng thầu: ${Number(winningPrice).toLocaleString('vi-VN')} VNĐ` : ''}
${participantNames ? `- Nhà thầu tham gia: ${participantNames}` : ''}
${loserNames ? `- Nhà thầu không trúng thầu: ${loserNames}` : ''}
${equipmentSummary ? `- Chi tiết danh mục thiết bị/vật tư/mặt hàng e-HSMT: ${equipmentSummary}` : ''}
- Nguồn hồ sơ công khai gốc: ${sourceUrl || 'https://muasamcong.mpi.gov.vn/'}

Yêu cầu phân tích chi tiết & trả về định dạng JSON:
1. "summary": Tóm tắt tổng quan 2-3 câu thể hiện rõ bối cảnh lâm sàng của cơ sở mời thầu (tuyến Trung ương, tỉnh hay huyện/vùng), quy mô tài chính và định hướng mua sắm chiến lược lần này.
2. "keyPoints": Mảng 6-8 mục thông tin sắc bén từ lăng kính chuyên gia thầu:
   - 🏦 **Chủ đầu tư & Nhu cầu lâm sàng**: (Nhận định về năng lực chuyên môn và quy mô của đơn vị mời thầu đối với danh mục này)
   - 💰 **Quy mô ngân sách & Phân khúc**: (Đánh giá mức độ hấp dẫn của giá dự toán, tiềm năng phân bổ dòng ngân sách)
   - 📑 **Phân nhóm kỹ thuật & Luật áp dụng**: (Nhận định về tiêu chí kỹ thuật, phân nhóm xuất xứ trang thiết bị theo quy định của Bộ Y tế - ví dụ: Nhóm 1 xuất xứ Âu/Mỹ, Nhóm 5 xuất xứ Trung Quốc/Ấn Độ)
   - 💎 **Mặt hàng chủ chốt & Tiềm năng kinh doanh**: (Xác định chính xác tên thiết bị/vật tư có giá trị kinh tế lâm sàng cao nhất, đóng vai trò cốt lõi hoặc là "sản phẩm mỏ neo" của gói thầu - TUYỆT ĐỐI KHÔNG ghi các mã số model vô nghĩa, chỉ nêu tên thương mại/lâm sàng như: Nẹp khóa xương đùi đa hướng, hệ thống nội soi tiêu hóa, sinh phẩm xét nghiệm chuyên sâu, v.v.)
   - 📦 **Cấu trúc danh mục e-HSMT**: (Tóm tắt các nhóm sản phẩm cốt lõi. BỎ HẾT hoàn toàn các chuỗi mã số model/serial rời rạc rườm rà rác mắt. Ghi rõ tên trang thiết bị, hãng/nước sản xuất thầu nếu có)
   - ⏱️ **Thời hạn thầu & Lưu ý hồ sơ**: (Tiến độ thời gian mở thầu và lưu ý thời gian chuẩn bị hồ sơ kỹ thuật)
   - 🏆 **Thế trận cạnh tranh & Kết quả**: (Nếu đã có kết quả thầu: Phân tích chênh lệch tỷ lệ tiết kiệm, nhận diện liên danh trúng thầu và các đối thủ bị loại vì lý do kỹ thuật hay giá)
3. "aiAssessment": Đánh giá chuyên sâu 3-4 câu với tư cách Chuyên gia Đấu thầu Độc lập: Phân tích sâu sắc về rào cản kỹ thuật đặc thù trong e-HSMT có khả năng định hướng thương hiệu độc quyền; đánh giá tiềm năng biên lợi nhuận của nhà thầu phân phối; dự báo cơ hội bán kèm vật tư tiêu hao khép kín đi kèm thiết bị chính (mô hình Razor-and-Blade); và các điểm trọng yếu cần hoàn thiện trong hồ sơ năng lực (kinh nghiệm tương tự, ủy quyền hãng) để tăng tỷ lệ thắng thầu.
4. "officialUrl": Trả về chính xác link hồ sơ công khai: "${sourceUrl || 'https://muasamcong.mpi.gov.vn/'}"
`;

    const { response, usedModel } = await generateContentWithFallback(ai, {
      contents: promptText,
      config: {
        systemInstruction: 'Bạn là chuyên gia phân tích đấu thầu y tế Việt Nam xuất sắc. Trả về thông tin phân tích gói thầu sâu sắc dưới góc nhìn kinh tế, thị trường và kỹ thuật lâm sàng, loại bỏ các chuỗi mã số vô nghĩa, trả về dạng JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Tóm tắt tổng quan chi tiết 2-3 câu' },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '6-8 điểm nổi bật chi tiết về quy mô, thiết bị giá trị cao nhất, thời gian, kết quả'
            },
            aiAssessment: { type: Type.STRING, description: 'Đánh giá phân tích tiềm năng và rủi ro từ chuyên gia AI' },
            officialUrl: { type: Type.STRING, description: 'Đường dẫn hồ sơ chính thức gốc' }
          },
          required: ['summary', 'keyPoints', 'aiAssessment', 'officialUrl']
        }
      }
    });

    let resultText = response.text;
    let data;
    try {
      data = JSON.parse(resultText);
    } catch (e) {
      data = {
        summary: resultText,
        keyPoints: [`Gói thầu: ${name}`, `Chủ đầu tư: ${investor}`],
        aiAssessment: 'Phân tích tự động từ AI Gemini.',
        officialUrl: sourceUrl || 'https://muasamcong.mpi.gov.vn/'
      };
    }

    summaryCache.set(notifyNo, data);
    return res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('Gemini summarize error:', error);
    const formattedPrice = req.body.price ? Number(req.body.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố';
    const fallbackData = {
      summary: `Gói thầu "${req.body.name}" do ${req.body.investor || 'Chủ đầu tư'} mời thầu tại ${req.body.location || 'Gia Lai'} với dự toán ${formattedPrice}.`,
      keyPoints: [
        `🏦 Bên mời thầu: ${req.body.investor || 'Chủ đầu tư'} (${req.body.location || 'Gia Lai'})`,
        `💰 Dự toán gói thầu: ${formattedPrice}`,
        `📑 Hình thức LCNT: ${req.body.bidForm || 'Qua mạng'} - ${req.body.category || 'Thiết bị y tế'}`,
        `📦 Danh mục hàng hóa: ${req.body.equipmentSummary || 'Trích từ biểu mẫu e-HSMT công khai'}`,
        `⏱️ Thời điểm đóng thầu: ${req.body.closeDate || 'Chưa công bố'}`
      ],
      aiAssessment: 'Hồ sơ công khai chính thức từ Cổng Mua sắm công (Muasamcong). Bấm nút bên dưới để xem toàn văn e-HSMT gốc.',
      officialUrl: req.body.sourceUrl || 'https://muasamcong.mpi.gov.vn/',
      isFallback: true
    };
    summaryCache.set(req.body.notifyNo, fallbackData);
    return res.json({ success: true, data: fallbackData });
  }
});

app.post('/api/batch-summarize-tenders', async (req, res) => {
  try {
    const { tenders } = req.body;
    if (!Array.isArray(tenders) || tenders.length === 0) {
      return res.json({ success: true, summaries: {} });
    }

    const summaries = {};
    const missingTenders = [];

    // Check cache first
    for (const tender of tenders) {
      if (!tender.notifyNo) continue;
      if (summaryCache.has(tender.notifyNo)) {
        summaries[tender.notifyNo] = summaryCache.get(tender.notifyNo);
      } else {
        missingTenders.push(tender);
      }
    }

    if (missingTenders.length === 0) {
      return res.json({ success: true, summaries, cachedAll: true });
    }

    const ai = getGeminiClient();

    // Helper to generate rich fallback
    const createFallbackForTender = (tender) => {
      const formattedPrice = tender.price ? Number(tender.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố';
      const winnerText = tender.winnerNames ? (Array.isArray(tender.winnerNames) ? tender.winnerNames.join('; ') : tender.winnerNames) : '';
      
      const points = [
        `🏦 Bên mời thầu: ${tender.investor || 'Cơ sở y tế'} (${tender.location || 'Gia Lai'})`,
        `💰 Giá gói thầu / Dự toán: ${formattedPrice}`,
        `📑 Phân loại & Hình thức: ${tender.category || 'Thiết bị y tế'} (${tender.bidForm || 'Qua mạng'})`,
        `📦 Danh mục máy móc/thiết bị e-HSMT: ${tender.equipmentSummary || 'Chi tiết trong biểu mẫu công khai.'}`,
        `⏱️ Hạn đóng thầu: ${tender.closeDate || 'Chưa công bố'}`
      ];
      if (winnerText) {
        points.push(`🏆 Kết quả trúng thầu: ${winnerText}`);
      }

      return {
        summary: `Gói thầu "${tender.name}" do ${tender.investor || 'Chủ đầu tư'} mời thầu tại ${tender.location || 'Gia Lai'} quy mô ${formattedPrice}.`,
        keyPoints: points,
        aiAssessment: `Thông tin trích xuất từ Cổng Dịch vụ công / Mạng đấu thầu Quốc gia. Bấm xem liên kết gốc để truy cập hồ sơ đầy đủ.`,
        officialUrl: tender.sourceUrl || 'https://muasamcong.mpi.gov.vn/',
        isFallback: true
      };
    };

    // If no API key, populate intelligent fallbacks immediately
    if (!ai) {
      for (const tender of missingTenders) {
        const fallbackData = createFallbackForTender(tender);
        summaryCache.set(tender.notifyNo, fallbackData);
        summaries[tender.notifyNo] = fallbackData;
      }
      return res.json({ success: true, summaries, isFallback: true });
    }

    // Process missing tenders in batch using Gemini
    const batchPrompt = missingTenders.map((t, idx) => `
[GÓI THẦU #${idx + 1}]
- Mã TBMT: ${t.notifyNo}
- Tên: ${t.name}
- Chủ đầu tư: ${t.investor}
- Địa điểm: ${t.location}
- Ngân sách: ${t.price ? Number(t.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa công bố'}
- Danh mục: ${t.category}
- Trạng thái: ${t.status}
- Đóng thầu: ${t.closeDate || 'Chưa công bố'}
${t.winnerNames ? `- Đơn vị trúng: ${t.winnerNames}` : ''}
${t.equipmentSummary ? `- Danh mục thiết bị chính: ${t.equipmentSummary}` : ''}
- Nguồn hồ sơ gốc: ${t.sourceUrl || 'https://muasamcong.mpi.gov.vn/'}
`).join('\n---');

    const promptText = `Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam cấp cao, am hiểu sâu sắc Luật Đấu thầu số 22/2023/QH15 và Nghị định số 24/2024/NĐ-CP. Hãy phân tích chuyên sâu & tóm tắt CHI TIẾT ĐẦY ĐỦ cho từng gói thầu dưới đây để định hướng thầu chiến lược cho các nhà phân phối và hãng sản xuất.

Danh sách ${missingTenders.length} gói thầu:
${batchPrompt}

Yêu cầu trả về mảng kết quả JSON tương ứng theo đúng thứ tự các gói thầu:
- "notifyNo": Mã TBMT của gói thầu
- "summary": Tóm tắt tổng quan chi tiết 2-3 câu ngắn gọn thể hiện bối cảnh lâm sàng của cơ sở mời thầu, quy mô tài chính và định hướng chiến lược.
- "keyPoints": Mảng 6-7 điểm thông tin thầu chi tiết sắc bén (Gồm: 🏦Chủ đầu tư & Địa bàn; 💰Ngân sách & Phân khúc; 📑Phân nhóm kỹ thuật Bộ Y tế; 💎Mặt hàng chủ chốt & Tiềm năng thương mại: Chỉ rõ thiết bị/vật tư cốt lõi có giá trị kinh tế lâm sàng cao nhất, tuyệt đối không ghi mã số model vô nghĩa; 📦Danh mục sản phẩm thầu chính: Tóm tắt tinh gọn, bỏ hết các mã số model/serial rườm rà rác mắt; ⏱️Thời hạn thầu quan trọng; 🏆Thế trận cạnh tranh & Kết quả).
- "aiAssessment": Đánh giá chuyên sâu 3-4 câu với tư cách Chuyên gia Đấu thầu Độc lập về rào cản e-HSMT, định hướng độc quyền thương hiệu, biên lợi nhuận tiềm năng, và chu kỳ vật tư tiêu hao đi kèm (mô hình Razor-and-Blade).
- "officialUrl": Đường dẫn hồ sơ gốc công khai
`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, {
        contents: promptText,
        config: {
          systemInstruction: 'Bạn là Chuyên gia Tư vấn Đấu thầu Trang thiết bị & Vật tư Y tế Việt Nam xuất sắc. Hãy trả về JSON array phân tích sâu sắc dưới góc nhìn luật thầu, phân nhóm kỹ thuật lâm sàng và thương mại, tuyệt đối loại bỏ các chuỗi mã số vô nghĩa.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                notifyNo: { type: Type.STRING },
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                aiAssessment: { type: Type.STRING },
                officialUrl: { type: Type.STRING }
              },
              required: ['notifyNo', 'summary', 'keyPoints', 'aiAssessment']
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '[]');
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.notifyNo) {
            const sumData = {
              summary: item.summary,
              keyPoints: item.keyPoints,
              aiAssessment: item.aiAssessment,
              officialUrl: item.officialUrl || 'https://muasamcong.mpi.gov.vn/'
            };
            summaryCache.set(item.notifyNo, sumData);
            summaries[item.notifyNo] = sumData;
          }
        }
      }
    } catch (batchErr) {
      console.error('Batch AI summarize error, falling back to rich details:', batchErr);
    }

    // Ensure any missing items in batch receive a fallback so clients never hang
    for (const tender of missingTenders) {
      if (!summaries[tender.notifyNo]) {
        const fallbackData = createFallbackForTender(tender);
        summaryCache.set(tender.notifyNo, fallbackData);
        summaries[tender.notifyNo] = fallbackData;
      }
    }

    return res.json({ success: true, summaries });
  } catch (error) {
    console.error('Batch summarize error:', error);
    return res.status(500).json({ error: 'Lỗi xử lý hàng loạt: ' + error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

