<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docx Auto-Fill Pro (V6 - Auto API)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Libs -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.29.0/docxtemplater.js"></script>
    <script src="https://unpkg.com/pizzip@3.1.1/dist/pizzip.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://unpkg.com/docx-preview@0.1.15/dist/docx-preview.js"></script>

    <style>
        body { background-color: #f8fafc; font-family: 'Segoe UI', sans-serif; }
        .tab-btn.active { background-color: #2563eb; color: white; }
        .tab-btn { background-color: #e2e8f0; color: #64748b; }
        .hidden { display: none; }
        #logArea { 
            font-family: monospace; font-size: 11px; 
            max-height: 120px; overflow-y: auto;
            border-top: 1px solid #ddd;
        }
        .ocr-loading { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    </style>
</head>
<body class="h-screen flex flex-col md:flex-row overflow-hidden">

    <!-- CỘT TRÁI -->
    <div class="w-full md:w-[450px] bg-white border-r flex flex-col shadow-xl z-10 shrink-0 h-full">
        <div class="p-4 border-b bg-slate-50 space-y-2">
            <h1 class="text-lg font-bold text-blue-700">⚡ Auto-Fill + Gemini OCR</h1>
            <!-- ĐÃ CẬP NHẬT API KEY VÀO ĐÂY -->
            <input type="password" id="inpApiKey" value="AIzaSyD2Fe6TC3gLa1lSE_C4wQ9BxEGNa2ptLww" class="w-full p-1.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-blue-50 text-blue-800 font-mono">
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
            
            <!-- 1. Upload File Mẫu -->
            <div class="border-2 border-dashed border-slate-300 rounded-xl p-3 text-center hover:bg-slate-50 cursor-pointer relative" id="dropZone">
                <input type="file" id="fileInput" accept=".docx" class="absolute inset-0 opacity-0 cursor-pointer">
                <div id="fileStatus" class="font-bold text-slate-500 text-sm">📂 1. Chọn File Mẫu (.docx)</div>
            </div>

            <!-- 2. Nút OCR -->
            <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center relative group hover:bg-indigo-100 transition">
                <input type="file" id="ocrInput" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                <div id="ocrStatus" class="font-bold text-indigo-600 text-sm flex items-center justify-center gap-2">
                    <span>📸 2. Tải Ảnh Hóa Đơn (OCR)</span>
                </div>
                <div class="text-[10px] text-indigo-400 mt-1">AI tự động đọc & điền Form</div>
            </div>

            <!-- 3. Tabs -->
            <div class="flex rounded-lg overflow-hidden border border-slate-200">
                <button class="flex-1 py-1.5 font-bold text-sm tab-btn active" onclick="switchTab('form')">Form</button>
                <button class="flex-1 py-1.5 font-bold text-sm tab-btn" onclick="switchTab('json')">JSON</button>
            </div>

            <!-- 4. Inputs -->
            <div id="tabForm" class="space-y-2">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs font-bold text-gray-500">Mã HĐ</label>
                        <input type="text" id="inpMa" placeholder="MA_KH" class="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500">Số Tiền</label>
                        <input type="number" id="inpTien" placeholder="Nhập số..." class="w-full p-2 border rounded text-sm font-bold text-blue-600 bg-slate-50 focus:bg-white transition">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500">Họ Tên</label>
                    <input type="text" id="inpTen" placeholder="TEN_KH" class="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs font-bold text-gray-500">SĐT</label>
                        <input type="text" id="inpSDT" placeholder="09xxxxxxxx" class="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500">Địa Chỉ</label>
                        <input type="text" id="inpDiaChi" placeholder="DIA_CHI" class="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500">Nội Dung</label>
                    <textarea id="inpNoiDung" rows="2" placeholder="NOI_DUNG" class="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition"></textarea>
                </div>
                <div class="text-xs bg-slate-100 p-2 rounded text-slate-600 italic border border-slate-200" id="moneyPreview">...</div>
            </div>

            <div id="tabJson" class="hidden h-64">
                <textarea id="inpJson" class="w-full h-full p-2 text-xs font-mono border rounded bg-slate-800 text-green-400"></textarea>
            </div>

            <!-- 5. Action -->
            <button id="btnProcess" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg text-sm transition transform active:scale-95">
                ⚡ 3. THỰC HIỆN
            </button>

            <!-- 6. Log -->
            <div id="logArea" class="bg-slate-900 text-white p-2 rounded shadow-inner">
                <div class="text-slate-400">Hệ thống sẵn sàng...</div>
            </div>
        </div>
    </div>

    <!-- CỘT PHẢI: PREVIEW -->
    <div class="flex-1 bg-slate-200 h-full flex flex-col overflow-hidden relative">
        <div class="h-12 bg-white border-b px-4 flex justify-between items-center shadow-sm z-10">
            <span class="font-bold text-slate-400 text-sm">XEM TRƯỚC TÀI LIỆU</span>
            <button id="btnDownload" class="hidden px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded shadow hover:bg-green-700 transition flex items-center gap-1">
                💾 TẢI VỀ
            </button>
        </div>
        <div class="flex-1 overflow-auto p-8 flex justify-center">
            <div id="previewContainer" class="bg-white shadow-2xl min-h-[297mm] w-[210mm]"></div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
