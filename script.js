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
    let num = parseFloat(val);
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
        alert("Vui lòng nhập Gemini API Key trước!");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Prompt "thần thánh" đúng yêu cầu của bạn
    const prompt = `
    Trích xuất thông tin từ ảnh hóa đơn/hợp đồng này.
    Trả về định dạng JSON thuần (không có markdown).
    Các trường cần lấy: 
    - MA_KH (Mã khách hàng/Mã hợp đồng)
    - TEN_KH (Họ tên đầy đủ)
    - SO_TIEN (Số tiền bằng số, lấy nguyên số chưa format)
    - SDT (Số điện thoại)
    - DIA_CHI (Địa chỉ)
    - NOI_DUNG (Nội dung thu/chi)
    
    Nếu không tìm thấy trường nào, để chuỗi rỗng.
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
        const data = await response.json();
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResult) throw new Error("Không nhận được phản hồi từ AI");

        // Làm sạch JSON (bỏ ```json ... ```)
        const cleanJson = textResult.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        log(`Lỗi OCR: ${e.message}`, 'error');
        alert("Lỗi OCR: Kiểm tra lại API Key hoặc ảnh.");
        return null;
    }
}

// --- XỬ LÝ SỰ KIỆN OCR ---
document.getElementById('ocrInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // UI Loading
    const statusDiv = document.getElementById('ocrStatus');
    const originalText = statusDiv.innerHTML;
    statusDiv.innerHTML = `<span class="ocr-loading">🤖 Đang phân tích...</span>`;
    log("Đang gửi ảnh lên Gemini...", 'info');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async function() {
        const base64Str = reader.result.split(',')[1];
        
        const data = await callGeminiOCR(base64Str);
        
        if (data) {
            log("OCR thành công! Đang điền form...", 'success');
            
            // Điền dữ liệu vào Form
            document.getElementById('inpMa').value = data.MA_KH || '';
            document.getElementById('inpTen').value = data.TEN_KH || '';
            document.getElementById('inpSDT').value = data.SDT || '';
            document.getElementById('inpDiaChi').value = data.DIA_CHI || '';
            document.getElementById('inpNoiDung').value = data.NOI_DUNG || '';
            
            // Xử lý tiền (Làm tròn ngay lập tức)
            if (data.SO_TIEN) {
                document.getElementById('inpTien').value = data.SO_TIEN;
                // Kích hoạt event input để update preview tiền
                document.getElementById('inpTien').dispatchEvent(new Event('input'));
            }
        }
        statusDiv.innerHTML = originalText; // Reset UI
    };
});


// --- CÁC HÀM CŨ (GIỮ NGUYÊN) ---
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
        log("Đọc file thành công!", 'success');
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
