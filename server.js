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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
    return res.status(500).json({ error: 'Không thể tạo tóm tắt AI: ' + error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

