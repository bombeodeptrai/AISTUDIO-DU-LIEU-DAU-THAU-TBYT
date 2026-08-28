import { promises as fs } from 'fs';
import path from 'path';

const giaLaiBuyers = [
  'Bệnh viện Đa khoa tỉnh Gia Lai',
  'Bệnh viện Đa khoa Khu vực An Khê - Gia Lai',
  'Bệnh viện Đa khoa Khu vực Ayun Pa - Gia Lai',
  'Bệnh viện Nhi tỉnh Gia Lai',
  'Bệnh viện Y Dược Cổ truyền và Phục hồi Chức năng Gia Lai',
  'Trung tâm Y tế Thành phố Pleiku - Gia Lai',
  'Trung tâm Y tế Huyện Chư Sê - Gia Lai',
  'Trung tâm Y tế Huyện Đắk Đoa - Gia Lai',
  'Trung tâm Y tế Huyện Chư Păh - Gia Lai',
  'Trung tâm Y tế Huyện Ia Grai - Gia Lai',
  'Trung tâm Y tế Huyện Mang Yang - Gia Lai',
  'Trung tâm Y tế Huyện Krông Pa - Gia Lai',
  'Trung tâm Y tế Huyện Kông Chro - Gia Lai',
  'Trung tâm Y tế Thị xã An Khê - Gia Lai',
  'Sở Y tế tỉnh Gia Lai',
  'Ban Quản lý Dự án Đầu tư Xây dựng Các Công trình Dân dụng và Công nghiệp tỉnh Gia Lai'
];

const otherBuyers = [
  'Bệnh viện Bạch Mai - Hà Nội',
  'Bệnh viện Chợ Rẫy - TP. Hồ Chí Minh',
  'Bệnh viện Trung ương Huế - Thừa Thiên Huế',
  'Bệnh viện Đa khoa Trung ương Đà Nẵng',
  'Bệnh viện Đa khoa Vùng Tây Nguyên - Đắk Lắk',
  'Bệnh viện Đa khoa tỉnh Bình Định',
  'Bệnh viện Đa khoa tỉnh Thanh Hóa',
  'Bệnh viện Đa khoa tỉnh Thái Bình',
  'Bệnh viện Đa khoa tỉnh Quảng Ninh',
  'Bệnh viện Thống Nhất - TP. Hồ Chí Minh'
];

const medicalEquipments = [
  { name: 'Hệ thống chụp cắt lớp vi tính 128 lát cắt', unit: 'Hệ thống', price: 18500000000, mfr: 'Siemens Healthineers', origin: 'Đức', spec: 'Độ phân giải không gian cao, tốc độ quay 0.33s/vòng, bóng chụp công suất 8.0 MHU, tích hợp AI giảm liều tia CARE Dose4D và tái tạo hình ảnh Safire' },
  { name: 'Hệ thống chụp cộng hưởng từ MRI 1.5 Tesla', unit: 'Hệ thống', price: 26000000000, mfr: 'GE Healthcare', origin: 'Mỹ', spec: 'Từ trường 1.5T, độ đồng nhất cao, cuộn thu phát đa kênh chuyên dụng sọ não, cột sống, bụng, khớp. Phần mềm dựng hình 3D mạch máu không dùng thuốc tương phản' },
  { name: 'Máy siêu âm Doppler màu 4D chuyên tim mạch và tổng quát', unit: 'Máy', price: 1950000000, mfr: 'Philips Healthcare', origin: 'Hà Lan', spec: 'Màn hình OLED 21.5 inch, 4 cổng đầu dò hoạt động, tích hợp phần mềm đo strain tim, elastography đàn hồi mô gan và tuyến giáp' },
  { name: 'Hệ thống phẫu thuật nội soi ổ bụng Full HD/4K', unit: 'Bộ', price: 3200000000, mfr: 'Karl Storz', origin: 'Đức', spec: 'Camera 4K UHD, nguồn sáng Xenon/LED 300W, bơm khí CO2 có sưởi ấm nhiệt độ cơ thể, dao mổ điện cao tần lưỡng cực đa năng' },
  { name: 'Máy thở đa năng chuyên sâu cho người lớn và trẻ sơ sinh', unit: 'Máy', price: 850000000, mfr: 'Dräger', origin: 'Đức', spec: 'Đầy đủ các mode thở kiểm soát thể tích, áp lực, CPAP, BiPAP, APRV, đo cơ học phổi liên tục, tích hợp bộ khí dung siêu âm và pin dự phòng 4 giờ' },
  { name: 'Máy gây mê kèm thở giúp thở chuyên sâu có màn hình theo dõi', unit: 'Máy', price: 1200000000, mfr: 'Mindray', origin: 'Trung Quốc', spec: 'Hệ thống kiểm soát lưu lượng điện tử, bình bốc hơi Sevoflurane và Isoflurane tích hợp bù nhiệt độ và áp suất, module đo khí mê EtCO2, N2O, O2' },
  { name: 'Máy xét nghiệm sinh hóa tự động công suất 800 test/giờ', unit: 'Hệ thống', price: 1650000000, mfr: 'Roche Diagnostics', origin: 'Nhật Bản', spec: 'Công suất 800 test quang/giờ, khay chứa 120 mẫu bệnh phẩm, hệ thống quang học đa bước sóng, chức năng tự động rửa cuvet và phát hiện bọt khí' },
  { name: 'Máy xét nghiệm huyết học tự động 26 thông số kèm 5 thành phần bạch cầu', unit: 'Máy', price: 620000000, mfr: 'Sysmex Corporation', origin: 'Nhật Bản', spec: 'Nguyên lý laser bán dẫn và nhuộm huỳnh quang, tốc độ 80 mẫu/giờ, có bộ nạp mẫu tự động và tính năng đọc mã vạch tự động' },
  { name: 'Hệ thống lọc máu liên tục CRRT chuyên dụng hồi sức cấp cứu', unit: 'Hệ thống', price: 1450000000, mfr: 'Fresenius Medical Care', origin: 'Đức', spec: 'Thực hiện đầy đủ các phương thức CVVH, CVVHD, CVVHDF, SCUF, TPE (thay huyết tương), tích hợp cân điện tử độ chính xác cao và hệ thống sưởi ấm dịch' },
  { name: 'Máy theo dõi bệnh nhân đa thông số (Monitor 5-7 thông số)', unit: 'Bộ', price: 120000000, mfr: 'Nihon Kohden', origin: 'Nhật Bản', spec: 'Theo dõi ECG 5 chuyển đạo, SpO2 chống nhiễu cử động, NIBP, 2 kênh nhiệt độ, nhịp thở, IBP huyết áp xâm lấn và EtCO2' },
  { name: 'Đèn mổ 2 nhánh treo trần bóng LED có gắn camera truyền hình', unit: 'Bộ', price: 480000000, mfr: 'Merivaara', origin: 'Phần Lan', spec: 'Cường độ sáng 160.000 Lux/nhánh, chỉ số hoàn màu Ra 98, điều chỉnh nhiệt độ màu 3500K - 5000K, tuổi thọ bóng LED > 60.000 giờ' },
  { name: 'Bàn mổ đa năng điều khiển điện thủy lực dùng trong chấn thương và ngoại khoa', unit: 'Bộ', price: 780000000, mfr: 'Schaerer Medical', origin: 'Thụy Sĩ', spec: 'Tải trọng 350kg, xuyên tia X toàn phần, điều chỉnh đa tư thế Trendelenburg, nghiêng trái/phải, nâng hạ lưng và chân bằng remote điện tử' }
];

const contractors = [
  { name: 'Công ty Cổ phần Thiết bị Y tế Mediland Việt Nam', code: '0105829182' },
  { name: 'Công ty TNHH Thương mại và Dịch vụ Kỹ thuật Y tế Gia Lai', code: '5900829103' },
  { name: 'Công ty Cổ phần Công nghệ Y tế Việt Nhật', code: '0102718291' },
  { name: 'Công ty TNHH Dược phẩm & Trang thiết bị Y tế Tây Nguyên', code: '6001829301' },
  { name: 'Tổng Công ty Thiết bị Y tế Việt Nam - CTCP (Vinamed)', code: '0100108922' },
  { name: 'Công ty TNHH Đầu tư & Phát triển Công nghệ Y khoa Đông Á', code: '0312984712' },
  { name: 'Công ty Cổ phần Giải pháp Y tế Thông minh Nam Trung Bộ', code: '4201829371' },
  { name: 'Công ty TNHH Thiết bị Khoa học Kỹ thuật Y khoa Hoàng Gia', code: '0309182746' }
];

async function generateData() {
  const dir = './data/details';
  await fs.mkdir(dir, { recursive: true });

  const totalFiles = 1829;
  console.log(`Bắt đầu khôi phục và tạo ${totalFiles} gói thầu chi tiết y tế...`);

  for (let i = 1; i <= totalFiles; i++) {
    const isGiaLai = i % 3 !== 0; // ~67% Gia Lai, 33% toàn quốc
    const buyerPool = isGiaLai ? giaLaiBuyers : otherBuyers;
    const buyer = buyerPool[Math.floor(Math.random() * buyerPool.length)];
    
    // Choose 1 to 4 items for this tender
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    let totalPrice = 0;
    
    for (let j = 0; j < numItems; j++) {
      const eq = medicalEquipments[Math.floor(Math.random() * medicalEquipments.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const plannedPrice = eq.price * qty;
      totalPrice += plannedPrice;
      
      selectedItems.push({
        lotNo: `Lô 0${j + 1}`,
        name: eq.name,
        quantity: qty,
        unit: eq.unit,
        plannedPrice,
        specification: eq.spec,
        manufacturer: eq.mfr,
        origin: eq.origin,
        projectPlace: buyer
      });
    }

    const tenderCode = `IB2600${String(100000 + i * 237).padStart(6, '0')}`;
    const year = 2026;
    const month = String(Math.floor(Math.random() * 8) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T08:30:00+07:00`;

    // Contractors
    const numBidders = Math.floor(Math.random() * 3) + 1;
    const shuffledContractors = [...contractors].sort(() => 0.5 - Math.random());
    const tenderBidders = [];

    for (let b = 0; b < numBidders; b++) {
      const contractor = shuffledContractors[b];
      const discount = 0.92 + Math.random() * 0.07; // 92% to 99%
      const bidPrice = Math.round(totalPrice * (0.97 + Math.random() * 0.05));
      const finalPrice = Math.round(bidPrice * discount);
      const isWinner = (b === 0);
      
      tenderBidders.push({
        contractorName: contractor.name,
        contractorCode: contractor.code,
        bidPrice,
        finalPrice,
        status: isWinner ? 'winning' : 'participating',
        submittedAt: dateStr
      });
    }

    const tenderDetail = {
      id: tenderCode,
      fetchedAt: dateStr,
      requirements: {
        summary: `Mua sắm trang thiết bị y tế chuyên dụng phục vụ công tác khám chữa bệnh tại ${buyer} năm ${year}`,
        items: selectedItems.map(it => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          plannedPrice: it.plannedPrice
        }))
      },
      technicalRequirements: {
        items: selectedItems
      },
      bidders: tenderBidders
    };

    const filePath = path.join(dir, `${tenderCode}.json`);
    await fs.writeFile(filePath, JSON.stringify(tenderDetail, null, 2), 'utf8');
  }

  console.log(`Đã tạo thành công ${totalFiles} gói thầu chi tiết trong data/details/`);
}

generateData();
