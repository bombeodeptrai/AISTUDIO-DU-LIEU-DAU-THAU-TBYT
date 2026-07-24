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
const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

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
      console.warn(`Model ${model} request failed (${err.message || err}). Trying fallback model...`);
      lastError = err;
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

    const promptText = `Hãy phân tích và tóm tắt khái quát thông tin gói thầu sau đây cho nhà thầu/người quan tâm bằng tiếng Việt:
- Mã TBMT: ${notifyNo}
- Tên gói thầu: ${name}
- Bên mời thầu / Chủ đầu tư: ${investor}
- Địa điểm: ${location}
- Ngân sách / Giá gói thầu: ${price ? price + ' VNĐ' : 'Chưa công bố'}
- Danh mục: ${category}
- Trạng thái hiện tại: ${status}
- Thời điểm đóng thầu: ${closeDate || 'Chưa công bố'}
${winnerNames ? `- Đơn vị trúng thầu: ${winnerNames}` : ''}
${equipmentSummary ? `- Danh mục máy móc/thiết bị chính: ${equipmentSummary}` : ''}

Yêu cầu tóm tắt:
1. "summary": Tóm tắt súc tích trong 1-2 câu ngắn gọn về bản chất gói thầu.
2. "keyPoints": Danh sách 3-4 điểm trọng tâm (ví dụ: Quy mô ngân sách, Các thiết bị chính, Thời hạn & Yêu cầu, Đối tượng tham gia).
3. "aiAssessment": Đánh giá vắt tắt góc nhìn AI (mức độ hấp dẫn, độ phức tạp kỹ thuật hoặc lưu ý chính).`;

    const { response, usedModel } = await generateContentWithFallback(ai, {
      contents: promptText,
      config: {
        systemInstruction: 'Bạn là chuyên gia phân tích dữ liệu đấu thầu y tế Việt Nam. Hãy tóm tắt thông tin gói thầu cực kỳ súc tích, chính xác, khách quan.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Tóm tắt khái quát gói thầu 1-2 câu' },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 điểm nổi bật chính của gói thầu'
            },
            aiAssessment: { type: Type.STRING, description: 'Đánh giá vắt tắt từ AI' }
          },
          required: ['summary', 'keyPoints', 'aiAssessment']
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
        aiAssessment: 'Phân tích tự động từ AI Gemini.'
      };
    }

    summaryCache.set(notifyNo, data);
    return res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('Gemini summarize error:', error);
    const fallbackData = {
      summary: `Gói thầu "${req.body.name}" do ${req.body.investor || 'Chủ đầu tư'} mời thầu tại ${req.body.location || 'Gia Lai'}.`,
      keyPoints: [
        `Giá gói thầu / quy mô: ${req.body.price ? Number(req.body.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa cập nhật'}`,
        `Phân loại: ${req.body.category || 'Thiết bị y tế'}`,
        `Trạng thái: ${req.body.status || 'Chưa rõ'}`,
        `Hạn đóng thầu: ${req.body.closeDate || 'Chưa công bố'}`
      ],
      aiAssessment: 'Tóm tắt tự động theo hồ sơ gói thầu.',
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

    // If no API key, populate intelligent fallbacks immediately
    if (!ai) {
      for (const tender of missingTenders) {
        const fallbackData = {
          summary: `Gói thầu "${tender.name}" do ${tender.investor || 'Chủ đầu tư'} mời thầu tại ${tender.location || 'Gia Lai'}.`,
          keyPoints: [
            `Giá dự toán: ${tender.price ? Number(tender.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa cập nhật'}`,
            `Phân loại: ${tender.category || 'Thiết bị y tế'}`,
            `Trạng thái: ${tender.status || 'Chưa rõ'}`,
            `Hạn đóng thầu: ${tender.closeDate || 'Chưa công bố'}`
          ],
          aiAssessment: 'Lưu ý: Để bật AI Gemini phân tích sâu, hãy nhập GEMINI_API_KEY trong Cài đặt > Secrets.',
          isFallback: true
        };
        summaryCache.set(tender.notifyNo, fallbackData);
        summaries[tender.notifyNo] = fallbackData;
      }
      return res.json({ success: true, summaries, isFallback: true });
    }

    // Process missing tenders in batch using Gemini with concurrency or batch prompt
    // We process up to 10 at a time to stay fast and avoid token limits
    const batchPrompt = missingTenders.map((t, idx) => `
[GÓI THẦU #${idx + 1}]
- Mã TBMT: ${t.notifyNo}
- Tên: ${t.name}
- Chủ đầu tư: ${t.investor}
- Địa điểm: ${t.location}
- Ngân sách: ${t.price ? t.price + ' VNĐ' : 'Chưa công bố'}
- Danh mục: ${t.category}
- Trạng thái: ${t.status}
- Đóng thầu: ${t.closeDate || 'Chưa công bố'}
${t.winnerNames ? `- Đơn vị trúng: ${t.winnerNames}` : ''}
${t.equipmentSummary ? `- Thiết bị chính: ${t.equipmentSummary}` : ''}
`).join('\n---');

    const promptText = `Bạn là chuyên gia phân tích đấu thầu y tế Việt Nam. Hãy tóm tắt ngắn gọn khái quát từng gói thầu dưới đây.

Danh sách ${missingTenders.length} gói thầu:
${batchPrompt}

Yêu cầu trả về mảng kết quả JSON tương ứng theo đúng thứ tự các gói thầu:
- "notifyNo": Mã TBMT của gói thầu
- "summary": Tóm tắt súc tích 1-2 câu về bản chất gói thầu
- "keyPoints": Mảng 3-4 điểm trọng tâm ngắn (Quy mô, thiết bị, hạn nộp,...)
- "aiAssessment": Đánh giá vắt tắt 1 câu góc nhìn AI
`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, {
        contents: promptText,
        config: {
          systemInstruction: 'Trả về JSON array các tóm tắt gói thầu cực kỳ súc tích, chính xác.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                notifyNo: { type: Type.STRING },
                summary: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                aiAssessment: { type: Type.STRING }
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
              aiAssessment: item.aiAssessment
            };
            summaryCache.set(item.notifyNo, sumData);
            summaries[item.notifyNo] = sumData;
          }
        }
      }
    } catch (batchErr) {
      console.error('Batch AI summarize error, falling back to basic:', batchErr);
    }

    // Ensure any missing items in batch receive a fallback so clients never hang
    for (const tender of missingTenders) {
      if (!summaries[tender.notifyNo]) {
        const fallbackData = {
          summary: `Gói thầu "${tender.name}" do ${tender.investor || 'Chủ đầu tư'} mời thầu tại ${tender.location || 'Gia Lai'}.`,
          keyPoints: [
            `Giá dự toán: ${tender.price ? Number(tender.price).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa cập nhật'}`,
            `Phân loại: ${tender.category || 'Thiết bị y tế'}`,
            `Trạng thái: ${tender.status || 'Chưa rõ'}`
          ],
          aiAssessment: 'Tóm tắt tự động theo thông tin gói thầu.',
          isFallback: true
        };
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

