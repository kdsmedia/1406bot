// ================================================================= //
//         BOT WHATSAPP & ADMIN PANEL V3.6 - CONNECTION FIX        //
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
const PORT = process.env.PORT || 3000;

// --- INISIALISASI WEB SERVER & SOCKET.IO ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

// --- INISIALISASI WHATSAPP & AI ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, // Pastikan berjalan tanpa UI
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Opsional, bisa membantu di lingkungan terbatas
            '--disable-gpu'
        ],
        executablePath: '/usr/bin/google-chrome-stable'
    }
});

let genAI, aiModel, rajaOngkir;

// ================================================================= //
//                         FUNGSI DATABASE & PENGATURAN              //
// ================================================================= //

function getDefaultSettings() {
    return {
        adminWID: ['6283872543697@c.us'],
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
        if (settings.geminiApiKey) {
            genAI = new GoogleGenerativeAI(settings.geminiApiKey);
            aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        }
        if (settings.rajaongkirApiKey) {
            rajaOngkir = axios.create({
                baseURL: 'https://api.rajaongkir.com/starter',
                headers: { 'key': settings.rajaongkirApiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        }
        console.log("✅ Klien API berhasil diinisialisasi.");
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

// ================================================================= //
//                         FUNGSI PEMBANTU (HELPERS)                 //
// ================================================================= //

function getUser(userId) {
    const db = readDb();
    if (!db.users || !db.users[userId]) {
        if (!db.users) db.users = {};
        db.users[userId] = { balance: 0, lastClaim: new Date(0).toISOString(), cart: [], state: 'idle', address: null };
        writeDb(db);
    }
    return db.users[userId];
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
        setTimeout(() => { process.exit(0); }, 2000);
    });
    socket.on('approve_withdrawal', async (data) => { await handleApproveCmd(null, `!approve ${data.id}`); });
    socket.on('reject_withdrawal', async (data) => { await handleRejectCmd(null, `!reject ${data.id} ${data.reason}`); });
    socket.on('add_product', (productData) => {
        const db = readDb();
        const newProduct = { id: `PROD${Date.now()}`, ...productData };
        if (!db.products) db.products = [];
        db.products.push(newProduct);
        writeDb(db);
        console.log(`📦 Produk baru ditambahkan: ${newProduct.name}`);
        socket.emit('settings_saved', { message: 'Produk berhasil ditambahkan!' });
    });
    socket.on('disconnect', () => { console.log('🔌 Admin Panel terputus.'); });
});

// ================================================================= //
//                         FUNGSI FITUR BOT (LENGKAP)                //
// ================================================================= //

async function handleStart(chatId) {
    console.log(`[FUNGSI] Menjalankan handleStart untuk ${chatId}`);
    const list = new List(
        '👋 *Selamat Datang di Bot Canggih!*\n\nSaya adalah asisten virtual Anda. Silakan pilih menu di bawah ini atau ketik *!start* untuk melihat menu ini lagi.', 
        'Buka Menu', 
        [{ title: 'Menu Utama', rows: [
            { id: 'cmd_katalog', title: '🛍️ Lihat Katalog' },
            { id: 'cmd_profil', title: '👤 Profil Saya' }
        ]}],
        'Menu Utama'
    );
    await client.sendMessage(chatId, list);
}

async function sendProfileMenu(chatId) {
    console.log(`[FUNGSI] Menjalankan sendProfileMenu untuk ${chatId}`);
    const list = new List(
        'Silakan pilih salah satu opsi di bawah ini untuk mengelola profil dan saldo Anda.',
        'Buka Profil',
        [{ title: 'Menu Profil', rows: [
            { id: 'cmd_saldo', title: '💰 Cek Saldo Bonus' },
            { id: 'cmd_klaim', title: '🎁 Klaim Bonus Harian' },
            { id: 'cmd_withdraw', title: '💸 Tarik Saldo' },
            { id: 'cmd_start', title: '⬅️ Kembali' },
        ]}],
        'Profil Saya'
    );
    await client.sendMessage(chatId, list);
}

// ... (Semua fungsi bot lainnya seperti handleWithdrawCmd, dll. harus ada di sini)
async function handleSaldoCmd(chatId) {
    console.log(`[FUNGSI] Menjalankan handleSaldoCmd untuk ${chatId}`);
    const userData = getUser(chatId);
    await client.sendMessage(chatId, `💰 Saldo Anda: *Rp ${userData.balance.toLocaleString('id-ID')}*`);
}

// ================================================================= //
//                      INISIALISASI & EVENT LISTENER                //
// ================================================================= //

server.listen(PORT, () => {
    console.log(`🚀 Server Admin Panel berjalan di http://localhost:${PORT}`);
    console.log("===================================================");
    console.log("⏳ Menginisialisasi Bot WhatsApp...");
    client.initialize();
});

client.on('loading_screen', (percent, message) => { console.log(`[PROSES] Memuat: ${percent}% - ${message}`); });
client.on('qr', qr => {
    console.log("[PROSES] QR Code diterima, silakan pindai.");
    require('qrcode-terminal').generate(qr, { small: true });
});
client.on('authenticated', () => { console.log('[PROSES] Autentikasi berhasil!'); });
client.on('ready', () => {
    console.log("===================================================");
    console.log('✅ Bot berhasil terhubung dan siap digunakan!');
    console.log("===================================================");
});
client.on('auth_failure', msg => { console.error('❌ GAGAL AUTENTIKASI:', msg); });
client.on('disconnected', (reason) => { console.log('🔌 Bot terputus:', reason); });

// ================================================================= //
//                      ROUTER PESAN UTAMA (STABIL)                  //
// ================================================================= //

client.on('message', async (message) => {
    try {
        if (!message.body || message.isStatus) return;

        const text = message.body.trim();
        const chatId = message.from;
        const chat = await message.getChat();
        
        console.log(`[PESAN] Dari: ${chatId} | Isi: "${text}"`);

        const db = readDb();
        const isAdmin = db.settings.adminWID.includes(chatId);
        const lowerCaseText = text.toLowerCase();

        // Perintah tes paling dasar
        if (lowerCaseText === '!ping') {
            console.log(`[PING] Menerima ping dari ${chatId}. Membalas...`);
            await client.sendMessage(chatId, 'Pong!');
            return;
        }

        // Router untuk perintah List (cmd_)
        if (lowerCaseText.startsWith('cmd_')) {
            const command = lowerCaseText.split('_')[1];
            console.log(`[CMD] Perintah dari menu: ${command}`);
            switch (command) {
                case 'start': await handleStart(chatId); break;
                case 'profil': await sendProfileMenu(chatId); break;
                case 'saldo': await handleSaldoCmd(chatId); break;
                default: console.log(`Perintah cmd tidak dikenal: ${command}`);
            }
            return;
        }
        
        // Router untuk perintah ketik (!)
        if (lowerCaseText.startsWith('!')) {
            const command = lowerCaseText.split(' ')[0];
            console.log(`[CMD] Perintah ketik: ${command}`);
            switch (command) {
                case '!start': await handleStart(chatId); break;
                case '!profil': await sendProfileMenu(chatId); break;
                case '!saldo': await handleSaldoCmd(chatId); break;
                default: 
                    if (!isAdmin) {
                         await client.sendMessage(chatId, "Maaf, perintah tidak dikenali. Ketik *!start* untuk melihat menu.");
                    }
            }
            if (isAdmin) {
                 // ... (perintah admin di sini)
            }
            return;
        }

        // Fallback: Jika bukan perintah dan bukan dari grup, kirim menu sambutan
        if (!chat.isGroup) {
            console.log(`[FALLBACK] Mengirim menu sambutan ke ${chatId}.`);
            await handleStart(chatId);
        }

    } catch (error) {
        console.error(`[ERROR UTAMA] Gagal memproses pesan:`, error);
    }
});
