// --- BIẾN TOÀN CỤC ---
let fileBuffer = null;
let generatedBlob = null;
let downloadName = "result.docx";

// --- DOM ELEMENTS ---
const els = {
    logArea: document.getElementById('logArea'),
    fileInput: document.getElementById('fileInput'),
    fileStatus: document.getElementById('fileStatus'),
    ocrInput: document.getElementById('ocrInput'),
    ocrStatus: document.getElementById('ocrStatus'),
    btnTabForm: document.getElementById('btnTabForm'),
    btnTabJson: document.getElementById('btnTabJson'),
    tabForm: document.getElementById('tabForm'),
    tabJson: document.getElementById('tabJson'),
    inpTien: document.getElementById('inpTien'),
    moneyPreview: document.getElementById('moneyPreview'),
    btnProcess: document.getElementById('btnProcess'),
    previewContainer: document.getElementById('previewContainer'),
    btnDownload: document.getElementById('btnDownload'),
    inpApiKey: document.getElementById('inpApiKey')
};

// --- LOGGING ---
const log = (msg, type = 'info') => {
    const color = type === 'error' ? 'text-red-400' : (type === 'success' ? 'text-green-400' : 'text-blue-300');
    const time = new Date().toLocaleTimeString();
    els.logArea.innerHTML += `<div class="${color} mb-1 border-b border-slate-700 pb-1">[${time}] ${msg}</div>`;
    els.logArea.scrollTop = els.logArea.scrollHeight;
    console.log(`[${type}] ${msg}`);
};

log("Hệ thống đã sẵn sàng!", 'success');

// --- XỬ LÝ TIỀN ---
const processMoney = (val) => {
    if (!val) return { raw: 0, fmt: '', text: '' };
    const cleanVal = String(val).replace(/[^0-9]/g, '');
    let num = parseFloat(cleanVal);
    if (isNaN(num)) return { raw: 0, fmt: val, text: '' };

    num = Math.ceil(num / 1000) * 1000;
    const fmt = num.toLocaleString('vi-VN');
    const text = `(Bằng chữ: ... đồng)`; 
    return { raw: num, fmt, text };
};

// --- API GEMINI (ĐÃ NÂNG CẤP) ---
async function callGeminiOCR(base64Image) {
    const apiKey = els.inpApiKey.value.trim();
    if (!apiKey) {
        alert("Chưa có API Key!");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Prompt chi tiết
    const prompt = `
    Trích xuất thông tin hóa đơn. Trả về JSON thuần.
    Fields: MA_KH, TEN_KH (Viết Hoa Chữ Cái Đầu), SO_TIEN (số nguyên, bỏ chữ đ), SDT, DIA_CHI, NOI_DUNG.
    Nếu không có thì để trống.
    `;

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }],
        // CẤU HÌNH AN TOÀN (QUAN TRỌNG ĐỂ KHÔNG BỊ BLOCK TEXT)
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if(!response.ok) throw new Error("Lỗi kết nối Gemini: " + response.status);

        const data = await response.json();
        
        // Kiểm tra block
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error("AI chặn nội dung: " + data.promptFeedback.blockReason);
        }

        let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) {
            // Log chi tiết để debug
            console.warn("AI Response:", data);
            throw new Error("AI không phản hồi text (Kiểm tra Log Console)");
        }
        
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(textResult);
    } catch (e) {
        log(`Lỗi OCR: ${e.message}`, 'error');
        alert("Lỗi AI: " + e.message);
        return null;
    }
}

// --- EVENT LISTENERS ---

// 1. Upload File Mẫu
els.fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.readAsArrayBuffer(f);
    reader.onload = (evt) => {
        fileBuffer = evt.target.result;
        els.fileStatus.innerText = `✅ Đã chọn: ${f.name}`;
        els.fileStatus.classList.add('text-green-600');
        log("Đọc file mẫu thành công!", 'success');
    };
});

// 2. OCR Upload
els.ocrInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const originalText = els.ocrStatus.innerHTML;
    els.ocrStatus.innerHTML = `<span class="ocr-loading">🤖 Đang đọc ảnh...</span>`;
    log("Đang gửi ảnh lên AI...", 'info');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64Str = reader.result.split(',')[1];
        const data = await callGeminiOCR(base64Str);
        
        if (data) {
            log("AI đọc thành công! Đang điền form...", 'success');
            document.getElementById('inpMa').value = data.MA_KH || '';
            document.getElementById('inpTen').value = data.TEN_KH || '';
            document.getElementById('inpSDT').value = data.SDT || '';
            document.getElementById('inpDiaChi').value = data.DIA_CHI || '';
            document.getElementById('inpNoiDung').value = data.NOI_DUNG || '';
            
            if (data.SO_TIEN) {
                els.inpTien.value = data.SO_TIEN;
                els.inpTien.dispatchEvent(new Event('input')); 
            }
        }
        els.ocrStatus.innerHTML = originalText;
        e.target.value = ''; 
    };
});

// 3. Tab Switching
els.btnTabForm.addEventListener('click', () => {
    els.tabForm.classList.remove('hidden');
    els.tabJson.classList.add('hidden');
    els.btnTabForm.classList.add('active');
    els.btnTabJson.classList.remove('active');
});
els.btnTabJson.addEventListener('click', () => {
    els.tabForm.classList.add('hidden');
    els.tabJson.classList.remove('hidden');
    els.btnTabForm.classList.remove('active');
    els.btnTabJson.classList.add('active');
});

// 4. Input Tiền
els.inpTien.addEventListener('input', (e) => {
    const { fmt, text } = processMoney(e.target.value);
    els.moneyPreview.innerHTML = `Làm tròn: <b>${fmt}</b><br>${text}`;
});

// 5. Nút Thực Hiện
els.btnProcess.addEventListener('click', async () => {
    if (!fileBuffer) { alert("Chưa chọn file mẫu .docx!"); return; }

    els.btnProcess.disabled = true;
    els.btnProcess.innerText = "⏳ Đang xử lý...";
    els.previewContainer.innerHTML = "";
    els.btnDownload.classList.add('hidden');

    try {
        let dataList = [];
        const isJsonTab = !els.tabJson.classList.contains('hidden');

        if (!isJsonTab) {
            const ma = document.getElementById('inpMa').value;
            const ten = document.getElementById('inpTen').value;
            const tien = els.inpTien.value;
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
            dataList = JSON.parse(jsonVal);
            if (!Array.isArray(dataList)) dataList = [dataList];
        }

        log(`Đã nhận ${dataList.length} bộ dữ liệu.`);
        
        const zip = new JSZip();
        let firstDocBlob = null;
        let successCount = 0;

        // AUTO PATCH XML (Sửa lỗi tag)
        const pzipMain = new PizZip(fileBuffer);
        const docXmlPath = "word/document.xml";
        if (pzipMain.files[docXmlPath]) {
            try {
                let xml = pzipMain.file(docXmlPath).asText();
                xml = xml.replace(/(<w:t>\{<\/w:t>)([\s\S]*?)(<w:t>\{<\/w:t>)/g, (m,s,mid,e) => `<w:t>{{</w:t>${mid}`);
                xml = xml.replace(/(<w:t>\}<\/w:t>)([\s\S]*?)(<w:t>\}<\/w:t>)/g, (m,s,mid,e) => `${mid}<w:t>}}</w:t>`);
                pzipMain.file(docXmlPath, xml);
            } catch (e) {}
        }
        const fixedBuffer = pzipMain.generate({type: "arraybuffer"});

        dataList.forEach((item, index) => {
            if (item.SO_TIEN && typeof item.SO_TIEN !== 'undefined') {
                const { fmt, text } = processMoney(item.SO_TIEN);
                item.SO_TIEN_SO = fmt; 
                item.SO_TIEN_CHU = item.SO_TIEN_CHU || text;
            }

            const pzip = new PizZip(fixedBuffer);
            const doc = new window.docxtemplater(pzip, { 
                paragraphLoop: true, 
                linebreaks: true, 
                nullGetter: () => "" 
            });
            
            doc.render(item);
            const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
            const fileName = `${item.MA_KH || 'Doc'}_${index+1}.docx`;
            zip.file(fileName, blob);
            
            if (index === 0) firstDocBlob = blob;
            successCount++;
        });

        if (dataList.length === 1) {
            generatedBlob = firstDocBlob;
            downloadName = `${dataList[0].MA_KH || 'KetQua'}.docx`;
        } else {
            generatedBlob = await zip.generateAsync({ type: "blob" });
            downloadName = "Ket_Qua_Hang_Loat.zip";
        }

        log(`Thành công! Tạo ${successCount} file.`, 'success');
        
        if (window.docx && firstDocBlob) {
            await window.docx.renderAsync(firstDocBlob, els.previewContainer);
        }
        els.btnDownload.classList.remove('hidden');

    } catch (err) {
        log(`LỖI: ${err.message}`, 'error');
        alert("Có lỗi xảy ra: " + err.message);
    } finally {
        els.btnProcess.disabled = false;
        els.btnProcess.innerText = "⚡ 3. THỰC HIỆN";
    }
});

// 6. Nút Tải Về
els.btnDownload.addEventListener('click', () => {
    if (!generatedBlob) return;
    const url = window.URL.createObjectURL(generatedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
});
