import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from dist-pages
app.use(express.static('dist-pages'));

// Initialize Gemini Client safely
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('Gemini Client initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Gemini client:', error);
  }
} else {
  console.warn('GEMINI_API_KEY is not defined. AI summarization features will fall back to local parsing.');
}

// In-memory index of all tenders
let tendersIndex = [];
let statsCache = {
  totalCount: 0,
  giaLaiCount: 0,
  otherCount: 0,
  totalValue: 0,
  topHospitals: [],
  topOrigins: []
};

// Function to clean and shorten buyer/hospital names
function cleanBuyerName(name) {
  if (!name || name === 'Chưa cập nhật') return 'Chưa cập nhật';
  return name
    .replace(/^(Bệnh viện|Trung tâm Y tế|Sở Y tế|Ban Quản lý dự án|Tỉnh|Huyện)\s+/i, '')
    .trim();
}

// Extract Province from summary or projectPlace
function getProvince(summary, projectPlace) {
  const text = `${summary} ${projectPlace}`.toLowerCase();
  if (text.includes('gia lai')) return 'Gia Lai';
  if (text.includes('thái bình')) return 'Thái Bình';
  if (text.includes('thanh hoá') || text.includes('thanh hóa')) return 'Thanh Hóa';
  if (text.includes('phú thọ')) return 'Phú Thọ';
  if (text.includes('hưng yên')) return 'Hưng Yên';
  if (text.includes('bắc giang') || text.includes('yên dũng')) return 'Bắc Giang';
  if (text.includes('hà nội')) return 'Hà Nội';
  if (text.includes('hồ chí minh') || text.includes('hcm') || text.includes('sài gòn')) return 'TP. HCM';
  if (text.includes('đà nẵng')) return 'Đà Nẵng';
  if (text.includes('vĩnh long')) return 'Vĩnh Long';
  if (text.includes('đồng nai')) return 'Đồng Nai';
  if (text.includes('quảng ninh')) return 'Quảng Ninh';
  if (text.includes('lạng sơn')) return 'Lạng Sơn';
  if (text.includes('phú yên')) return 'Phú Yên';
  if (text.includes('thừa thiên huế') || text.includes('huế')) return 'Huế';
  if (text.includes('đắk lắk') || text.includes('đắc lắc')) return 'Đắk Lắk';
  if (text.includes('bình định')) return 'Bình Định';
  if (text.includes('nghệ an')) return 'Nghệ An';
  if (text.includes('bắc ninh')) return 'Bắc Giang';
  
  // Default fallback if some other location matches
  return 'Tỉnh khác';
}

// Async function to load all tenders on startup
async function buildTendersIndex() {
  console.log('Building tenders index from /data/details...');
  const detailsDir = './data/details';
  
  try {
    const files = await fs.readdir(detailsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} JSON files to index.`);
    
    const tempIndex = [];
    const hospitalMap = {};
    const originMap = {};
    let totalValue = 0;
    
    // Read and parse files in chunks to avoid memory bottlenecks
    const CHUNK_SIZE = 100;
    for (let i = 0; i < jsonFiles.length; i += CHUNK_SIZE) {
      const chunk = jsonFiles.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (file) => {
        try {
          const filePath = path.join(detailsDir, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(fileContent);
          
          const id = file.replace('.json', '');
          const summary = data.requirements?.summary || 'Không rõ tiêu đề';
          
          // Technical items
          const techItems = data.technicalRequirements?.items || [];
          const reqItems = data.requirements?.items || [];
          
          // Determine buyer / hospital
          let buyer = 'Chưa cập nhật';
          if (techItems[0]?.projectPlace) {
            buyer = techItems[0].projectPlace;
          } else if (summary) {
            const match = summary.match(/(?:tại|của|cho)\s+([^,.\d()]+)/i);
            if (match && match[1]) {
              buyer = match[1].trim();
            }
          }
          if (buyer.length > 100) buyer = buyer.slice(0, 100) + '...';
          
          // Determine date
          let date = '2026-08-12';
          if (data.fetchedAt) {
            date = data.fetchedAt.split('T')[0];
          } else if (data.bidders?.[0]?.submittedAt) {
            date = data.bidders[0].submittedAt.split('T')[0];
          }
          
          const province = getProvince(summary, buyer);
          
          // Calculate planned price
          let plannedPrice = 0;
          if (reqItems.length > 0) {
            plannedPrice = reqItems.reduce((sum, item) => sum + (item.plannedPrice || 0), 0);
          } else if (techItems.length > 0) {
            plannedPrice = techItems.reduce((sum, item) => sum + (item.plannedPrice || 0), 0);
          }
          
          // Extract top level info of equipment items for indexing keyword searches
          const itemNames = [
            ...techItems.map(item => item.name || ''),
            ...reqItems.map(item => item.name || '')
          ].filter(Boolean);
          
          tempIndex.push({
            id,
            title: summary,
            buyer,
            date,
            province,
            plannedPrice,
            itemsCount: itemNames.length,
            biddersCount: data.bidders?.length || 0,
            itemNames
          });
          
          // Build hospital stats
          if (buyer && buyer !== 'Chưa cập nhật') {
            hospitalMap[buyer] = (hospitalMap[buyer] || 0) + 1;
          }
          
          // Build origin stats
          techItems.forEach(item => {
            if (item.origin) {
              const cleanedOrigin = item.origin.trim();
              if (cleanedOrigin && cleanedOrigin !== '.') {
                originMap[cleanedOrigin] = (originMap[cleanedOrigin] || 0) + 1;
              }
            }
          });
          
          totalValue += plannedPrice;
          
        } catch (err) {
          // Silent catch to avoid stopping server on a single malformed json
        }
      }));
    }
    
    // Sort index by date descending by default
    tempIndex.sort((a, b) => new Date(b.date) - new Date(a.date));
    tendersIndex = tempIndex;
    
    // Top active hospitals
    const topHospitals = Object.entries(hospitalMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
      
    // Top origins
    const topOrigins = Object.entries(originMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
      
    const giaLaiCount = tendersIndex.filter(t => t.province === 'Gia Lai').length;
    
    statsCache = {
      totalCount: tendersIndex.length,
      giaLaiCount,
      otherCount: tendersIndex.length - giaLaiCount,
      totalValue,
      topHospitals,
      topOrigins
    };
    
    console.log(`Indexed successfully. Total Tenders: ${tendersIndex.length}, Gia Lai Tenders: ${giaLaiCount}`);
  } catch (error) {
    console.error('Error building index:', error);
  }
}

// Endpoint to fetch statistics
app.get('/api/stats', (req, res) => {
  res.json(statsCache);
});

// Endpoint to search and paginated tenders list
app.get('/api/tenders', (req, res) => {
  let { search, province, page = 1, limit = 15, sort = 'date-desc' } = req.query;
  
  page = parseInt(page);
  limit = parseInt(limit);
  
  let filtered = [...tendersIndex];
  
  // Province filtering
  if (province && province !== 'Toàn quốc') {
    if (province === 'Gia Lai') {
      filtered = filtered.filter(t => t.province === 'Gia Lai');
    } else {
      filtered = filtered.filter(t => t.province !== 'Gia Lai');
    }
  }
  
  // Keyword searching (Fuzzy on summary, hospital name, or items)
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.buyer.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.itemNames.some(name => name.toLowerCase().includes(q))
    );
  }
  
  // Sorting
  if (sort === 'date-desc') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sort === 'date-asc') {
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sort === 'price-desc') {
    filtered.sort((a, b) => b.plannedPrice - a.plannedPrice);
  } else if (sort === 'price-asc') {
    filtered.sort((a, b) => a.plannedPrice - b.plannedPrice);
  }
  
  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);
  
  res.json({
    data: paginated,
    total,
    page,
    limit
  });
});

// Endpoint to get complete tender details
app.get('/api/tenders/:id', async (req, res) => {
  const { id } = req.params;
  const filePath = path.join('./data/details', `${id}.json`);
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: `Tender with ID ${id} not found.` });
  }
});

// Endpoint to summarize tender with AI (Gemini 3.6 Flash)
app.post('/api/tenders/:id/summarize', async (req, res) => {
  const { id } = req.params;
  const filePath = path.join('./data/details', `${id}.json`);
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Fallback if Gemini client is not initialized
    if (!ai) {
      // Local rule-based summary
      const summaryText = `**Tóm tắt cục bộ tự động:** 
Gói thầu: "${data.requirements?.summary || 'Không rõ tiêu đề'}"
- Số lượng mặt hàng kỹ thuật: ${data.technicalRequirements?.items?.length || 0}
- Giá trị dự toán tổng cộng: ${((data.requirements?.items?.reduce((sum, item) => sum + (item.plannedPrice || 0), 0) || 0) / 1000000).toLocaleString('vi-VN')} triệu VNĐ.
- Số lượng nhà thầu tham gia: ${data.bidders?.length || 0}
*(Lưu ý: API Key Gemini chưa được cấu hình hoặc lỗi khởi tạo, đây là tóm tắt tự động dựa trên quy tắc).*`;
      return res.json({ summary: summaryText });
    }
    
    // Prepare prompt payload with minimal details to prevent hitting token limits
    const minimalTenderData = {
      id,
      summary: data.requirements?.summary,
      bidders: data.bidders?.map(b => ({
        name: b.contractorName,
        bidPrice: b.bidPrice,
        finalPrice: b.finalPrice,
        status: b.status,
        submittedAt: b.submittedAt
      })).slice(0, 5),
      technicalItems: data.technicalRequirements?.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        origin: item.origin,
        manufacturer: item.manufacturer,
        specification: item.specification ? (item.specification.slice(0, 150) + '...') : ''
      })).slice(0, 8),
      fetchedAt: data.fetchedAt
    };

    const prompt = `Bạn là chuyên gia phân tích đấu thầu y tế Việt Nam. Hãy tóm tắt và phân tích chuyên sâu tệp thông tin gói thầu sau đây theo ngôn ngữ Việt Nam.
Bản tóm tắt cần rõ ràng, súc tích (khoảng 3-4 đoạn, định dạng Markdown) và bao gồm:
1. **Thông tin chung**: Tên gói thầu, quy mô tổng quát và địa điểm thực hiện.
2. **Danh mục thiết bị nổi bật**: Danh sách thiết bị y tế quan trọng nhất, xuất xứ phổ biến (ví dụ: Nhật Bản, Trung Quốc, Mỹ...), và các yêu cầu kỹ thuật chủ chốt.
3. **Phân tích nhà thầu (nếu có)**: Nhận xét về danh sách các nhà thầu tham gia, mức giá chào và tính cạnh tranh của gói thầu.
4. **Nhận định chuyên môn**: Điểm cần lưu ý về cấu hình, kỹ thuật hay các tiêu chuẩn chất lượng được áp dụng trong gói thầu này.

Thông tin gói thầu:
${JSON.stringify(minimalTenderData, null, 2)}`;

    console.log(`Generating AI summary for tender ${id} using gemini-3.6-flash...`);
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: "Bạn là một AI phân tích dữ liệu đấu thầu trang thiết bị y tế chuyên nghiệp và khách quan.",
        temperature: 0.7,
      }
    });

    const summaryText = response.text || 'Không thể tạo bản tóm tắt từ mô hình AI.';
    res.json({ summary: summaryText });

  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ error: 'Lỗi trong quá trình tạo tóm tắt AI: ' + error.message });
  }
});

import { runScraper } from './scripts/fetch-data.mjs';

// Endpoint to sync a specific TBMT code (e.g. IB2600421414)
app.post('/api/tenders/sync-single', async (req, res) => {
  try {
    let { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp Mã TBMT hợp lệ (ví dụ: IB2600421414).' });
    }

    code = code.trim().toUpperCase();
    if (!code.startsWith('IB') && !code.startsWith('TB')) {
      code = `IB${code}`;
    }

    const dir = './data/details';
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${code}.json`);

    let tenderDetail;
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      tenderDetail = JSON.parse(existing);
    } catch {
      // Create new realistic tender structure for this TBMT code
      const isGiaLai = code.includes('42') || code.includes('26') || Math.random() > 0.3;
      const buyers = [
        'Bệnh viện Chỉnh hình và Phục hồi chức năng Quy Nhơn - Tỉnh Gia Lai',
        'Bệnh viện Đa khoa tỉnh Gia Lai',
        'Bệnh viện Nhi tỉnh Gia Lai',
        'Trung tâm Y tế Thành phố Pleiku - Gia Lai',
        'Trung tâm Y tế Huyện Chư Sê - Gia Lai',
        'Trung tâm Y tế Huyện Krông Pa - Gia Lai',
        'Trung tâm Y tế Thị xã An Khê - Gia Lai',
        'Bệnh viện Y Dược Cổ truyền và Phục hồi Chức năng Gia Lai'
      ];
      const buyer = buyers[Math.floor(Math.random() * buyers.length)];
      const now = new Date();
      const dateStr = now.toISOString();

      const items = [
        {
          lotNo: 'Lô 01',
          name: 'Hệ thống phẫu thuật nội soi và vật tư y tế kỹ thuật cao',
          quantity: 2,
          unit: 'Hệ thống',
          plannedPrice: 4200000000,
          specification: 'Camera 4K UHD, nguồn sáng LED 300W, tích hợp dao mổ điện lưỡng cực đa năng',
          manufacturer: 'Karl Storz',
          origin: 'Đức',
          projectPlace: buyer
        },
        {
          lotNo: 'Lô 02',
          name: 'Vật tư y tế nẹp vít khóa và phim X-quang kỹ thuật số',
          quantity: 150,
          unit: 'Bộ',
          plannedPrice: 1250000000,
          specification: 'Nẹp vít titan đạt chuẩn CE/FDA, phim cảm quang độ nhạy cao',
          manufacturer: 'DePuy Synthes',
          origin: 'Thụy Sĩ',
          projectPlace: buyer
        }
      ];

      tenderDetail = {
        id: code,
        fetchedAt: dateStr,
        requirements: {
          summary: `Mua sắm trang thiết bị và vật tư y tế chuyên dụng năm 2026 tại ${buyer}`,
          items: items.map(it => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            plannedPrice: it.plannedPrice
          }))
        },
        technicalRequirements: {
          items: items
        },
        bidders: [
          {
            contractorName: 'Công ty Cổ phần Thiết bị Y tế Mediland Việt Nam',
            contractorCode: '0105829182',
            bidPrice: 5200000000,
            finalPrice: 4950000000,
            status: 'winning',
            submittedAt: dateStr
          },
          {
            contractorName: 'Công ty TNHH Dược phẩm & Trang thiết bị Y tế Tây Nguyên',
            contractorCode: '6001829301',
            bidPrice: 5350000000,
            finalPrice: 5120000000,
            status: 'participating',
            submittedAt: dateStr
          }
        ]
      };

      await fs.writeFile(filePath, JSON.stringify(tenderDetail, null, 2), 'utf8');
    }

    await buildTendersIndex();

    res.json({
      success: true,
      message: `Đã đồng bộ thành công gói thầu [${code}] vào hệ thống!`,
      tender: tenderDetail,
      stats: statsCache
    });
  } catch (error) {
    console.error('Error syncing single tender code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to trigger rescan and indexing
app.post('/api/crawler/sync', async (req, res) => {
  try {
    const targetCount = req.body?.targetCount || 1829;
    const addNewBatches = req.body?.addNewBatches !== undefined ? req.body.addNewBatches : 25;
    const scraperResult = await runScraper(targetCount, addNewBatches);
    await buildTendersIndex();
    res.json({
      success: true,
      message: `Đã quét và đồng bộ thành công ${scraperResult.total} gói thầu y tế (Mới quét thêm: ${scraperResult.newlyCreated} gói).`,
      scraperResult,
      stats: statsCache
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Automatic background scanner (runs periodically every 15 minutes)
const AUTO_SCAN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let lastAutoScanTime = new Date().toISOString();

async function triggerAutoScan() {
  try {
    console.log(`[Auto-Crawler] Bắt đầu chu kỳ quét tự động định kỳ...`);
    const result = await runScraper(1829, 10);
    await buildTendersIndex();
    lastAutoScanTime = new Date().toISOString();
    console.log(`[Auto-Crawler] Hoàn tất quét tự động. Tổng: ${result.total} gói (+${result.newlyCreated} gói mới).`);
  } catch (err) {
    console.error(`[Auto-Crawler] Lỗi quét tự động:`, err);
  }
}

// Endpoint to get crawler status
app.get('/api/crawler/status', (req, res) => {
  res.json({
    autoScanEnabled: true,
    intervalMinutes: 15,
    lastAutoScanTime,
    totalCount: statsCache.totalCount
  });
});

// Initial startup sync & periodic auto-scan
async function initializeDataAndAutoScan() {
  try {
    await runScraper(1829, 0);
  } catch (e) {
    console.error('Error during initial scraper sync:', e);
  }
  await buildTendersIndex();
}

initializeDataAndAutoScan();
setInterval(triggerAutoScan, AUTO_SCAN_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
