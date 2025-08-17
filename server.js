// ================================================================= //
//         BOT WHATSAPP & ADMIN PANEL V3.2 - AUTO WELCOME          //
// ================================================================= //

// --- IMPORTS LIBRARY ---
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia, List } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const path = require('path');

// --- PENGATURAN AWAL & PATH ---
const DB_PATH = './db.json';
const PORT = process.env.PORT || 369;

// --- INISIALISASI WEB SERVER & SOCKET.IO ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

// --- INISIALISASI WHATSAPP & AI ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

let genAI, aiModel, rajaOngkir;

// ================================================================= //
//                         FUNGSI DATABASE & PENGATURAN              //
// ================================================================= //

function getDefaultSettings() {
    return {
        adminWID: ['6285813899649@c.us', '6283872543697@c.us'],
        qrisImageURL: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgHwO_-Mp4mmE5tIQgvrs8ZzsUiKwMWROUa8XAMFdKpYGzqxAXR9ciCYRZ9LBt-i1ukxzhTVQw_mcKbCm5jzFe6vySjmowjplpTMJBwV5HVfETSH6WwqlWHY2BEn_rMJn4jXXRX5ylMRwDGPssCFolj5akwy1Ny-Y3_JHFQZK3Jdf4HzaFwuBRXqwcDVhI/s407/qris.jpg',
        rajaongkirApiKey: 'gBFPpQZd9f94a0b3859a57deidGsYsCm',
        shopOriginSubdistrictId: '2276',
        geminiApiKey: 'AIzaSyBUalvW1ztILdy1dyLryrcJ8EEvUSw6g-o',
        minWithdrawal: 100000,
        dailyBonus: 200
    };
}

function initializeApiClients(settings) {
    try {
        genAI = new GoogleGenerativeAI(settings.geminiApiKey);
        aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        rajaOngkir = axios.create({
            baseURL: 'https://api.rajaongkir.com/starter',
            headers: { 'key': settings.rajaongkirApiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log("✅ Klien API (Gemini & RajaOngkir) berhasil diinisialisasi.");
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Klien API. Periksa API Key Anda:", error.message);
    }
}

function readDb() {
    try {
        if (!fs.existsSync(DB_PATH)) {
             const initialData = { users: {}, products: [], orders: [], withdrawals: [], settings: getDefaultSettings() };
             fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
             return initialData;
        }
        const data = JSON.parse(fs.readFileSync(DB_PATH));
        if (!data.settings) data.settings = getDefaultSettings();
        return data;
    } catch (e) {
        console.error("Error membaca db.json, membuat file baru:", e);
        const initialData = { users: {}, products: [], orders: [], withdrawals: [], settings: getDefaultSettings() };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        return initialData;
    }
}

function writeDb(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    io.emit('data_updated', readDb());
}

let initialData = readDb();
initializeApiClients(initialData.settings);
writeDb(initialData);

// ================================================================= //
//                         FUNGSI PEMBANTU (HELPERS)                 //
// ================================================================= //

function getUser(userId) {
    const db = readDb();
    if (!db.users || !db.users[userId]) {
        if (!db.users) db.users = {};
        db.users[userId] = {
            balance: 0, lastClaim: new Date(0).toISOString(), cart: [],
            state: 'idle', address: null
        };
        writeDb(db);
    }
    return db.users[userId];
}

function setUserState(userId, state, progressData = null) {
    const db = readDb();
    if (db.users[userId]) {
        db.users[userId].state = state;
        const progressKeys = ['addressFormProgress', 'checkoutProgress', 'confirmationProgress', 'generationProgress', 'productFormProgress'];
        progressKeys.forEach(key => {
            if(!['generationProgress', 'productFormProgress'].includes(key)) delete db.users[userId][key]
        });
        if (progressData) {
            const key = Object.keys(progressData)[0];
            db.users[userId][key] = progressData[key];
        }
        if (state === 'idle') {
            delete db.users[userId].generationProgress;
            delete db.users[userId].productFormProgress;
        }
        writeDb(db);
    }
}

async function getGeminiResponse(prompt) {
    try {
        if (!aiModel) throw new Error("AI Model tidak terinisialisasi.");
        const result = await aiModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "🤖 Maaf, AI sedang mengalami sedikit gangguan. Silakan coba lagi nanti.";
    }
}

async function getShippingOptions(destinationSubdistrictId, weightInGrams) {
    try {
        if (!rajaOngkir) throw new Error("RajaOngkir tidak terinisialisasi.");
        const db = readDb();
        const response = await rajaOngkir.post('/cost', {
            origin: db.settings.shopOriginSubdistrictId, originType: 'subdistrict',
            destination: destinationSubdistrictId, destinationType: 'subdistrict',
            weight: weightInGrams, courier: 'jne:tiki:sicepat'
        });
        const results = response.data.rajaongkir.results;
        let options = [];
        for (const courier of results) {
            for (const service of courier.costs) {
                options.push({
                    id: `ship_${courier.code.toUpperCase()}_${service.service}_${service.cost[0].value}`,
                    title: `${courier.code.toUpperCase()} - ${service.service}`,
                    description: `Rp ${service.cost[0].value.toLocaleString('id-ID')} (est. ${service.cost[0].etd} hari)`
                });
            }
        }
        return options;
    } catch (error) {
        console.error("RajaOngkir API Error:", error.response ? error.response.data : error.message);
        return [];
    }
}


// ================================================================= //
//                         KONEKSI SOCKET.IO                         //
// ================================================================= //

io.on('connection', (socket) => {
    console.log('🖥️ Admin Panel terhubung!');
    socket.emit('data_updated', readDb());

    socket.on('update_settings', (newSettings) => {
        console.log('⚙️ Menerima pembaruan pengaturan...');
        const db = readDb();
        db.settings = newSettings;
        writeDb(db);
        initializeApiClients(newSettings);
        socket.emit('settings_saved', { message: 'Pengaturan disimpan! Bot akan restart...' });

        console.log('Server akan restart dalam 2 detik untuk menerapkan perubahan...');
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    });

    socket.on('approve_withdrawal', async (data) => {
        console.log(`Menerima permintaan approve untuk WD ID: ${data.id}`);
        await handleApproveCmd(null, `!approve ${data.id}`);
    });

    socket.on('reject_withdrawal', async (data) => {
        console.log(`Menerima permintaan reject untuk WD ID: ${data.id}`);
        await handleRejectCmd(null, `!reject ${data.id} ${data.reason}`);
    });
    
    socket.on('add_product', (productData) => {
        const db = readDb();
        const newProduct = {
            id: `PROD${Date.now()}`,
            ...productData
        };
        if (!db.products) db.products = [];
        db.products.push(newProduct);
        writeDb(db);
        console.log(`📦 Produk baru ditambahkan: ${newProduct.name}`);
        socket.emit('settings_saved', { message: 'Produk berhasil ditambahkan!' });
    });

    socket.on('disconnect', () => {
        console.log('🔌 Admin Panel terputus.');
    });
});


// ================================================================= //
//                         FUNGSI FITUR BOT                          //
// ================================================================= //

async function handleStart(chatId) {
    const mainRows = [
        { id: 'cmd_katalog', title: '🛍️ Lihat Katalog Produk' },
        { id: 'cmd_profil', title: '👤 Profil Saya', description: 'Lihat saldo, klaim bonus, dan lainnya.' },
        { id: 'cmd_riwayat', title: '📜 Riwayat Transaksi' },
        { id: 'cmd_generator', title: '✨ AI Content Generator' },
    ];
    const sections = [{ title: 'Menu Utama', rows: mainRows }];
    const list = new List('👋 *Selamat Datang di Bot Canggih!*\nSaya adalah ALTO, asisten virtual Anda. Silakan pilih menu di bawah ini atau ketik *!start* untuk melihat menu ini lagi.', 'Buka Menu', sections, 'Menu Utama', 'ALTOS Bot');
    await client.sendMessage(chatId, list);
}

async function sendProfileMenu(chatId) {
    const profileRows = [
        { id: 'cmd_saldo', title: '💰 Cek Saldo Bonus' },
        { id: 'cmd_klaim', title: '🎁 Klaim Bonus Harian' },
        { id: 'cmd_withdraw', title: '💸 Tarik Saldo' },
        { id: 'cmd_start', title: '⬅️ Kembali ke Menu Utama' },
    ];
    const sections = [{ title: 'Menu Profil', rows: profileRows }];
    const list = new List('Silakan pilih salah satu opsi di bawah ini untuk mengelola profil dan saldo Anda.', 'Buka Profil', sections, 'Profil Saya');
    await client.sendMessage(chatId, list);
}

async function sendAdminMenu(chatId) {
    const adminRows = [
        { id: 'cmd_tambahproduk', title: '📦 Tambah Produk Baru', description: 'Memulai alur untuk menambahkan produk ke katalog.' },
        { id: 'cmd_start', title: '⬅️ Kembali ke Menu Utama', description: 'Kembali ke menu pengguna biasa.' },
    ];
    const sections = [{ title: 'Menu Khusus Admin', rows: adminRows }];
    const list = new List('👑 *Selamat Datang, Admin!*\nSilakan pilih salah satu perintah di bawah ini untuk mengelola bot.', 'Buka Menu Admin', sections, 'Menu Admin');
    await client.sendMessage(chatId, list);
}

async function handleSaldoCmd(chatId) {
    const userData = getUser(chatId);
    await client.sendMessage(chatId, `💰 Saldo Anda: *Rp ${userData.balance.toLocaleString('id-ID')}*`);
}

async function handleClaimBonusCmd(chatId) {
    const db = readDb();
    const DAILY_BONUS = db.settings.dailyBonus;
    const userData = getUser(chatId);
    const lastClaimDate = new Date(userData.lastClaim);
    const now = new Date();
    const timeDifference = now.getTime() - lastClaimDate.getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    if (timeDifference >= twentyFourHoursInMs) {
        db.users[chatId].balance += DAILY_BONUS;
        db.users[chatId].lastClaim = now.toISOString();
        writeDb(db);
        const newBalance = db.users[chatId].balance;
        await client.sendMessage(chatId, `🎉 Selamat! Anda berhasil mengklaim bonus harian sebesar *Rp ${DAILY_BONUS}*.\n\nSaldo Anda sekarang: *Rp ${newBalance.toLocaleString('id-ID')}*`);
    } else {
        const remainingTime = twentyFourHoursInMs - timeDifference;
        const hours = Math.floor(remainingTime / (1000 * 60 * 60));
        const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
        await client.sendMessage(chatId, `⏳ Anda sudah mengklaim bonus hari ini.\n\nSilakan coba lagi dalam *${hours} jam ${minutes} menit*.`);
    }
}

async function handleWithdrawCmd(chatId, messageBody) {
    const db = readDb();
    const MIN_WITHDRAWAL = db.settings.minWithdrawal;
    const ADMIN_WID = db.settings.adminWID;

    const parts = messageBody.split(' ');
    if (parts.length < 4 && messageBody.startsWith('!')) {
        await client.sendMessage(chatId, `❌ Format salah. Gunakan:\n*!withdraw <jumlah> <metode> <nomor tujuan>*\n\nContoh:\n*!withdraw 100000 DANA 081234567890*`);
        return;
    }
    if (parts.length === 1 && (messageBody.startsWith('cmd_') || messageBody.startsWith('!'))) {
        await client.sendMessage(chatId, `Untuk menarik saldo, silakan ketik perintah dengan format:\n*!withdraw <jumlah> <metode> <nomor tujuan>*\n\nContoh:\n*!withdraw 100000 DANA 081234567890*`);
        return;
    }
    const amount = parseInt(parts[1]);
    const method = parts[2].toUpperCase();
    const accountDetails = parts[3];
    if (isNaN(amount)) {
        await client.sendMessage(chatId, '❌ Jumlah harus berupa angka.');
        return;
    }
    if (amount < MIN_WITHDRAWAL) {
        await client.sendMessage(chatId, `❌ Minimal penarikan adalah *Rp ${MIN_WITHDRAWAL.toLocaleString('id-ID')}*.`);
        return;
    }
    const userData = getUser(chatId);
    if (amount > userData.balance) {
        await client.sendMessage(chatId, `❌ Saldo Anda tidak mencukupi. Saldo Anda: *Rp ${userData.balance.toLocaleString('id-ID')}*.`);
        return;
    }
    
    db.users[chatId].balance -= amount;
    const withdrawalId = `WD${Date.now()}`;
    const newWithdrawal = { id: withdrawalId, userId: chatId, amount, method, accountDetails, status: 'pending', requestTimestamp: new Date().toISOString() };
    if (!db.withdrawals) db.withdrawals = [];
    db.withdrawals.push(newWithdrawal);
    writeDb(db);
    
    await client.sendMessage(chatId, `✅ Permintaan penarikan Anda sebesar *Rp ${amount.toLocaleString('id-ID')}* telah diterima dan sedang diproses.`);
    const adminMessage = `🔔 *Permintaan Withdraw Baru*\n\nID: \`${withdrawalId}\`\nDari: \`${chatId.split('@')[0]}\`\nJumlah: *Rp ${amount.toLocaleString('id-ID')}*\nMetode: *${method}*\nTujuan: \`${accountDetails}\`\n\nPanel admin juga telah diperbarui.`;
    ADMIN_WID.forEach(admin => client.sendMessage(admin, adminMessage));
}

async function handleApproveCmd(adminChatId, messageBody) {
    const idToApprove = messageBody.split(' ')[1];
    if (!idToApprove) {
        if(adminChatId) await client.sendMessage(adminChatId, 'Format salah. Gunakan: *!approve <ID>*');
        return;
    }
    const db = readDb();
    if (idToApprove.startsWith('WD')) {
        const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToApprove);
        if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') {
            if(adminChatId) await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan atau sudah diproses.');
            return;
        }
        db.withdrawals[wdIndex].status = 'completed';
        const wd = db.withdrawals[wdIndex];
        writeDb(db); 
        if(adminChatId) await client.sendMessage(adminChatId, `✅ Withdraw \`${wd.id}\` berhasil disetujui.`);
        await client.sendMessage(wd.userId, `✅ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* telah berhasil dikirim.`);
    } else {
        if(adminChatId) await client.sendMessage(adminChatId, '❌ Approval dari panel saat ini hanya untuk Withdraw.');
    }
}

async function handleRejectCmd(adminChatId, messageBody) {
    const parts = messageBody.split(' ');
    const idToReject = parts[1];
    const reason = parts.slice(2).join(' ') || 'Tidak ada alasan spesifik.';
    if (!idToReject) {
        if(adminChatId) await client.sendMessage(adminChatId, 'Format salah. Gunakan: *!reject <ID> <alasan>*');
        return;
    }
    const db = readDb();
    if (idToReject.startsWith('WD')) {
        const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToReject);
        if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') {
            if(adminChatId) await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan atau sudah diproses.');
            return;
        }
        const wd = db.withdrawals[wdIndex];
        db.users[wd.userId].balance += wd.amount; // Kembalikan saldo
        db.withdrawals[wdIndex].status = 'rejected';
        writeDb(db);
        if(adminChatId) await client.sendMessage(adminChatId, `🗑️ Withdraw \`${wd.id}\` berhasil ditolak.`);
        await client.sendMessage(wd.userId, `❌ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* ditolak.\n\n*Alasan:* ${reason}\n\nSaldo telah dikembalikan.`);
    } else {
        if(adminChatId) await client.sendMessage(adminChatId, '❌ Penolakan saat ini hanya didukung untuk Withdraw.');
    }
}

// ================================================================= //
//                      INISIALISASI & EVENT LISTENER                //
// ================================================================= //

server.listen(PORT, () => {
    console.log(`🚀 Server Admin Panel berjalan di http://localhost:${PORT}`);
    console.log("Menginisialisasi Bot WhatsApp...");
    client.initialize();
});

client.on('qr', qr => {
    require('qrcode-terminal').generate(qr, { small: true });
    console.log('Pindai QR Code ini dengan aplikasi WhatsApp Anda.');
});

client.on('ready', () => {
    console.log('✅ Bot berhasil terhubung dan siap digunakan!');
});

client.on('auth_failure', msg => {
    console.error('GAGAL AUTENTIKASI', msg);
});

client.on('message', async message => {
    const text = message.body;
    const chatId = message.from;
    const chat = await message.getChat(); // Mendapatkan info chat
    const db = readDb();
    const settings = db.settings;
    const ADMIN_WID = settings.adminWID;
    const isAdmin = ADMIN_WID.includes(chatId);
    const user = getUser(chatId);

    if (text.toLowerCase() === '!batal' && user.state !== 'idle') {
        setUserState(chatId, 'idle');
        await client.sendMessage(chatId, "👍 Proses dibatalkan.");
        return;
    }

    if (user.state !== 'idle') {
        // Logika state machine (jika ada) akan ditangani di sini
        return;
    }
    
    if (text.startsWith('!')) {
        const command = text.toLowerCase().split(' ')[0];
        
        switch (command) {
            case '!start': await handleStart(chatId); return;
            case '!profil': await sendProfileMenu(chatId); return;
            case '!saldo': await handleSaldoCmd(chatId); return;
            case '!klaim': await handleClaimBonusCmd(chatId); return;
            case '!withdraw': await handleWithdrawCmd(chatId, text); return;
        }

        if (isAdmin) {
            switch (command) {
                case '!admin': await sendAdminMenu(chatId); return;
                case '!approve': await handleApproveCmd(chatId, text); return;
                case '!reject': await handleRejectCmd(chatId, text); return;
            }
        }
        // Jika perintah '!' tidak dikenali, akan lanjut ke bawah
    }
    
    if (text.startsWith('cmd_')) {
        const command = text.split('_')[1];
        switch (command) {
            case 'start': await handleStart(chatId); break;
            case 'profil': await sendProfileMenu(chatId); break;
            case 'saldo': await handleSaldoCmd(chatId); break;
            case 'klaim': await handleClaimBonusCmd(chatId); break;
            case 'withdraw': await handleWithdrawCmd(chatId, text); break;
        }
        return; // Setelah memproses cmd, hentikan eksekusi
    }

    // --- PERUBAHAN DI SINI ---
    // Jika pesan dikirim di chat pribadi (bukan grup) dan tidak ada 
    // perintah yang cocok di atas, kirimkan menu utama sebagai sambutan.
    if (!chat.isGroup) {
        await handleStart(chatId);
    }
});
