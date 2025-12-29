// --- BIẾN TOÀN CỤC ---
let fileBuffer = null;
let generatedBlob = null;
let downloadName = "result.docx";

// --- TIỆN ÍCH LOG ---
const log = (msg, type = 'info') => {
    const logArea = document.getElementById('logArea');
    const color = type === 'error' ? 'text-red-400' : (type === 'success' ? 'text-green-400' : 'text-blue-300');
    const time = new Date().toLocaleTimeString();
    logArea.innerHTML += `<div class="${color} mb-1 border-b border-slate-700 pb-1">[${time}] ${msg}</div>`;
    logArea.scrollTop = logArea.scrollHeight;
    console.log(`[${type}] ${msg}`);
};

// --- XỬ LÝ TIỀN (Làm tròn 54.321 -> 55.000) ---
const processMoney = (val) => {
    if (!val) return { raw: 0, fmt: '', text: '' };
    // Xóa các ký tự không phải số (ví dụ: "100.000 đ") trước khi parse
    const cleanVal = String(val).replace(/[^0-9.]/g, '');
    let num = parseFloat(cleanVal);
    if (isNaN(num)) return { raw: 0, fmt: val, text: '' };

    // Làm tròn lên hàng nghìn
    num = Math.ceil(num / 1000) * 1000;
    const fmt = num.toLocaleString('vi-VN');
    const text = `(Bằng chữ: ... đồng)`; 
    return { raw: num, fmt, text };
};

// --- HÀM GỌI GEMINI OCR ---
async function callGeminiOCR(base64Image) {
    const apiKey = document.getElementById('inpApiKey').value.trim();
    if (!apiKey) {
        alert("Vui lòng nhập API Key!");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Prompt tối ưu hóa để lấy JSON chuẩn xác
    const prompt = `
    Bạn là một trợ lý nhập liệu AI. Hãy trích xuất thông tin từ bức ảnh hóa đơn/hợp đồng này.
    
    YÊU CẦU QUAN TRỌNG:
    1. Chỉ trả về duy nhất một chuỗi JSON hợp lệ. Không được kèm theo bất kỳ văn bản giải thích hay markdown (\`\`\`json) nào.
    2. Nếu trường nào không tìm thấy, hãy để chuỗi rỗng "".
    3. Định dạng JSON cần trả về:
    {
        "MA_KH": "Mã khách hàng hoặc Mã hợp đồng",
        "TEN_KH": "Họ và tên khách hàng (Viết Hoa Chữ Cái Đầu)",
        "SO_TIEN": "Số tiền bằng số (Chỉ lấy số, không lấy chữ 'đ' hay 'VND', ví dụ: 500000)",
        "SDT": "Số điện thoại liên hệ",
        "DIA_CHI": "Địa chỉ khách hàng",
        "NOI_DUNG": "Nội dung thu chi hoặc lý do thanh toán"
    }
    `;

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResult) throw new Error("AI không trả về kết quả text.");

        // Clean JSON (xóa markdown nếu AI lỡ thêm vào)
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Parse JSON
        return JSON.parse(textResult);

    } catch (e) {
        log(`Lỗi OCR: ${e.message}`, 'error');
        alert(`Lỗi khi gọi Gemini: ${e.message}\nKiểm tra lại API Key hoặc kết nối mạng.`);
        return null;
    }
}

// --- SỰ KIỆN OCR ---
document.getElementById('ocrInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // UI Effect
    const statusDiv = document.getElementById('ocrStatus');
    const originalText = statusDiv.innerHTML;
    statusDiv.innerHTML = `<span class="ocr-loading">🤖 AI đang đọc ảnh...</span>`;
    log("Đang gửi ảnh lên Gemini...", 'info');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async function() {
        const base64Str = reader.result.split(',')[1];
        
        const data = await callGeminiOCR(base64Str);
        
        if (data) {
            log("OCR Thành công! Đang điền dữ liệu...", 'success');
            
            // Map dữ liệu vào input
            const safeVal = (val) => val ? String(val).trim() : '';
            
            document.getElementById('inpMa').value = safeVal(data.MA_KH);
            document.getElementById('inpTen').value = safeVal(data.TEN_KH);
            document.getElementById('inpSDT').value = safeVal(data.SDT);
            document.getElementById('inpDiaChi').value = safeVal(data.DIA_CHI);
            document.getElementById('inpNoiDung').value = safeVal(data.NOI_DUNG);
            
            // Xử lý tiền đặc biệt để làm tròn
            if (data.SO_TIEN) {
                // Loại bỏ dấu chấm/phẩy nếu OCR đọc nhầm (VD: 500.000 -> 500000)
                // Tuy nhiên cẩn thận với số thập phân, nhưng tiền VNĐ thường là số nguyên
                const rawMoney = String(data.SO_TIEN).replace(/[^0-9]/g, '');
                document.getElementById('inpTien').value = rawMoney;
                // Trigger event để tính toán lại tiền bằng chữ
                document.getElementById('inpTien').dispatchEvent(new Event('input'));
            }
        } else {
            log("Không trích xuất được JSON từ ảnh.", 'error');
        }
        
        statusDiv.innerHTML = originalText; // Reset nút
        e.target.value = ''; // Reset file input để chọn lại ảnh khác nếu muốn
    };
});

// --- CÁC HÀM CŨ (CORE) ---
const patchBrokenTags = (xmlContent) => {
    let patched = xmlContent.replace(/(<w:t>\{<\/w:t>)([\s\S]*?)(<w:t>\{<\/w:t>)/g, (m,s,mid,e) => `<w:t>{{</w:t>${mid}`);
    patched = patched.replace(/(<w:t>\}<\/w:t>)([\s\S]*?)(<w:t>\}<\/w:t>)/g, (m,s,mid,e) => `${mid}<w:t>}}</w:t>`);
    return patched;
};

document.getElementById('fileInput').addEventListener('change', function(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.readAsArrayBuffer(f);
    reader.onload = function(evt) {
        fileBuffer = evt.target.result;
        document.getElementById('fileStatus').innerText = `✅ Đã chọn: ${f.name}`;
        document.getElementById('fileStatus').classList.add('text-green-600');
        log("Đọc file mẫu thành công!", 'success');
    };
});

window.switchTab = (tabName) => {
    const tabForm = document.getElementById('tabForm');
    const tabJson = document.getElementById('tabJson');
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'form') {
        tabForm.classList.remove('hidden'); tabJson.classList.add('hidden');
        btns[0].classList.add('active'); btns[1].classList.remove('active');
    } else {
        tabForm.classList.add('hidden'); tabJson.classList.remove('hidden');
        btns[0].classList.remove('active'); btns[1].classList.add('active');
    }
};

document.getElementById('inpTien').addEventListener('input', function(e) {
    const { fmt, text } = processMoney(e.target.value);
    document.getElementById('moneyPreview').innerHTML = `Làm tròn: <b>${fmt}</b><br>${text}`;
});

document.getElementById('btnProcess').addEventListener('click', async function() {
    if (!fileBuffer) { log("CHƯA CHỌN FILE MẪU!", 'error'); alert("Thiếu file mẫu!"); return; }

    const btn = document.getElementById('btnProcess');
    const previewDiv = document.getElementById('previewContainer');
    const btnDown = document.getElementById('btnDownload');
    
    btn.disabled = true; btn.innerText = "⏳ Đang chạy...";
    previewDiv.innerHTML = ""; btnDown.classList.add('hidden');

    try {
        let dataList = [];
        const isJsonTab = document.getElementById('tabJson').classList.contains('hidden') === false;

        if (!isJsonTab) {
            const ma = document.getElementById('inpMa').value;
            const ten = document.getElementById('inpTen').value;
            const tien = document.getElementById('inpTien').value;
            const sdt = document.getElementById('inpSDT').value;
            const diachi = document.getElementById('inpDiaChi').value;
            const noidung = document.getElementById('inpNoiDung').value;
            const { fmt, text } = processMoney(tien);
            
            dataList = [{
                MA_KH: ma, TEN_KH: ten, SDT: sdt, DIA_CHI: diachi,
                SO_TIEN_SO: fmt, SO_TIEN_CHU: text, NOI_DUNG: noidung
            }];
        } else {
            const jsonVal = document.getElementById('inpJson').value;
            if (!jsonVal.trim()) throw new Error("Ô JSON đang trống!");
            try { dataList = JSON.parse(jsonVal); if (!Array.isArray(dataList)) dataList = [dataList]; } 
            catch (e) { throw new Error("Lỗi cú pháp JSON."); }
        }

        log(`Đã nhận ${dataList.length} bộ dữ liệu.`);
        const zip = new JSZip();
        let firstDocBlob = null;
        let successCount = 0;

        const pzipMain = new PizZip(fileBuffer);
        const docXmlPath = "word/document.xml";
        if (pzipMain.files[docXmlPath]) {
            try {
                const originalXml = pzipMain.file(docXmlPath).asText();
                const fixedXml = patchBrokenTags(originalXml);
                pzipMain.file(docXmlPath, fixedXml);
            } catch (e) {}
        }
        const fixedBuffer = pzipMain.generate({type: "arraybuffer"});

        dataList.forEach((item, index) => {
            if (item.SO_TIEN && typeof item.SO_TIEN === 'number') {
                const { fmt, text } = processMoney(item.SO_TIEN);
                item.SO_TIEN_SO = fmt; item.SO_TIEN_CHU = item.SO_TIEN_CHU || text;
            }
            const pzip = new PizZip(fixedBuffer);
            const doc = new window.docxtemplater(pzip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
            doc.render(item);
            const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
            const fileName = `${item.MA_KH || 'Doc'}_${index+1}.docx`;
            zip.file(fileName, blob);
            if (index === 0) firstDocBlob = blob;
            successCount++;
        });

        if (dataList.length === 1) {
            generatedBlob = firstDocBlob; downloadName = `${dataList[0].MA_KH || 'KetQua'}.docx`;
        } else {
            generatedBlob = await zip.generateAsync({ type: "blob" }); downloadName = "Ket_Qua_Hang_Loat.zip";
        }

        log(`Thành công!`, 'success');
        if (window.docx && firstDocBlob) await window.docx.renderAsync(firstDocBlob, previewDiv);
        btnDown.classList.remove('hidden');

    } catch (err) {
        log(`LỖI: ${err.message}`, 'error');
        alert(err.message);
    } finally {
        btn.disabled = false; btn.innerText = "⚡ 3. THỰC HIỆN";
    }
});

document.getElementById('btnDownload').addEventListener('click', function() {
    if (!generatedBlob) return;
    const url = window.URL.createObjectURL(generatedBlob);
    const a = document.createElement('a');
    a.href = url; a.download = downloadName;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
});
