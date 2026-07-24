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
const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];

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

    const promptText = `Bạn là chuyên gia phân tích dữ liệu đấu thầu y tế Việt Nam. Hãy phân tích VÀ TÓM TẮT CHI TIẾT HỒ SƠ GÓI THẦU dưới đây cho nhà thầu/cơ sở y tế:

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
${winnerNames ? `- Nhà thầu trúng thầu: ${winnerNames}` : ''}
${winningPrice ? `- Giá trúng thầu: ${Number(winningPrice).toLocaleString('vi-VN')} VNĐ` : ''}
${participantNames ? `- Nhà thầu tham gia: ${participantNames}` : ''}
${loserNames ? `- Nhà thầu không trúng thầu: ${loserNames}` : ''}
${equipmentSummary ? `- Chi tiết danh mục thiết bị/vật tư/mặt hàng e-HSMT: ${equipmentSummary}` : ''}
- Nguồn hồ sơ công khai gốc: ${sourceUrl || 'https://muasamcong.mpi.gov.vn/'}

Yêu cầu phân tích chi tiết & trả về định dạng JSON:
1. "summary": Tóm tắt tổng quan chi tiết 2-3 câu ngắn gọn nhưng đầy đủ bối cảnh, quy mô ngân sách, mục đích mua sắm và cơ sở y tế mời thầu.
2. "keyPoints": Mảng 5-7 mục thông tin chi tiết chuyên sâu:
   - 🏦 Chủ đầu tư & Cơ sở: ...
   - 💰 Giá gói thầu & Tài chính: ... (nếu có giá trúng thầu thì nêu cả mức chênh lệch/tiết kiệm)
   - 📑 Hình thức & Phương thức LCNT: ...
   - 📦 Danh mục hàng hóa / Thiết bị chính: (Nêu cụ thể tên máy/vật tư/sinh phẩm kèm model/số lượng)
   - ⏱️ Tiến độ mốc thời gian: (Ngày đăng tải, hạn đóng thầu)
   - 🏆 Kết quả & Nhà thầu: (Đơn vị trúng thầu, nhà thầu tham gia/trượt thầu)
3. "aiAssessment": Đánh giá chuyên sâu góc nhìn AI (mức độ cạnh tranh, tính phức tạp kỹ thuật của danh mục, rủi ro/lưu ý hồ sơ).
4. "officialUrl": Trả về chính xác link hồ sơ công khai: "${sourceUrl || 'https://muasamcong.mpi.gov.vn/'}"
`;

    const { response, usedModel } = await generateContentWithFallback(ai, {
      contents: promptText,
      config: {
        systemInstruction: 'Bạn là chuyên gia phân tích đấu thầu y tế Việt Nam. Trả về thông tin phân tích gói thầu cực kỳ chi tiết, chính xác, khách quan dưới dạng JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Tóm tắt tổng quan chi tiết 2-3 câu' },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '5-7 điểm nổi bật chi tiết về quy mô, thiết bị, thời gian, kết quả'
            },
            aiAssessment: { type: Type.STRING, description: 'Đánh giá chuyên sâu từ AI' },
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

    const promptText = `Bạn là chuyên gia phân tích đấu thầu y tế Việt Nam. Hãy phân tích & tóm tắt CHI TIẾT ĐẦY ĐỦ cho từng gói thầu dưới đây.

Danh sách ${missingTenders.length} gói thầu:
${batchPrompt}

Yêu cầu trả về mảng kết quả JSON tương ứng theo đúng thứ tự các gói thầu:
- "notifyNo": Mã TBMT của gói thầu
- "summary": Tóm tắt tổng quan chi tiết 2-3 câu ngắn gọn
- "keyPoints": Mảng 5-6 điểm thông tin chi tiết (Chủ đầu tư, giá gói thầu, hình thức LCNT, danh mục thiết bị, mốc thời gian, kết quả)
- "aiAssessment": Đánh giá chuyên sâu 1-2 câu góc nhìn AI
- "officialUrl": Đường dẫn hồ sơ gốc công khai
`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, {
        contents: promptText,
        config: {
          systemInstruction: 'Trả về JSON array các tóm tắt phân tích gói thầu cực kỳ chi tiết, chính xác.',
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

