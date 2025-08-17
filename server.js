/*
================================================================================
|   SERVER.JS LENGKAP UNTUK PANEL ADMIN & BOT WHATSAPP                          |
|   Disiapkan untuk deployment di VPS dengan PM2 & Nginx.                       |
================================================================================
*/

// --- 1. IMPORT MODUL & INISIALISASI ---
const http = require('http');
const express = require('express');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inisialisasi Aplikasi Express, Server HTTP, dan Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Konfigurasi Konstanta
// Di lingkungan produksi (seperti VPS), port akan diberikan oleh sistem.
// Jika tidak, default ke 3000 untuk pengembangan lokal.
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- 2. MANAJEMEN DATABASE (FILE JSON) ---
let db = {};

// Fungsi untuk memuat database dari file `db.json`
const loadDatabase = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            db = JSON.parse(data);
            console.log('✅ Database berhasil dimuat dari db.json.');
        } else {
            // Jika file tidak ada, buat struktur default untuk mencegah crash.
            console.warn('⚠️ db.json tidak ditemukan. Membuat struktur database default.');
            db = {
                settings: { adminWID: [], geminiApiKey: "", rajaongkirApiKey: "", qrisImageURL: "", shopOriginSubdistrictId: "", minWithdrawal: 0, dailyBonus: 0 },
                users: {}, products: [], orders: [], withdrawals: []
            };
            saveDatabase(); // Langsung simpan file baru
        }
    } catch (error) {
        console.error('❌ Gagal memuat database:', error.message);
        process.exit(1); // Keluar dari aplikasi jika database tidak bisa di-load.
    }
};

// Fungsi untuk menyimpan perubahan ke `db.json` dan menyiarkan pembaruan
const saveDatabase = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
        // Siarkan (broadcast) data terbaru ke semua panel admin yang terhubung
        io.emit('data_updated', db);
        console.log('💾 Database disimpan dan pembaruan dikirim ke klien.');
    } catch (error) {
        console.error('❌ Gagal menyimpan database:', error.message);
    }
};

// Panggil fungsi untuk memuat database saat server dimulai
loadDatabase();

// --- 3. PENGATURAN EXPRESS SERVER ---
// Menyajikan file `index.html` saat seseorang mengakses root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public'));
});

// --- 4. INISIALISASI WHATSAPP CLIENT (BOT) ---
console.log('Menginisialisasi WhatsApp Client...');
const client = new Client({
    authStrategy: new LocalAuth(), // Menyimpan sesi login di server
    puppeteer: {
        headless: true,
        // Argumen ini SANGAT PENTING untuk berjalan di VPS Linux
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Opsional, bisa membantu di lingkungan RAM terbatas
            '--disable-gpu'
        ]
    }
});

// Event untuk menampilkan QR Code di log (akan dilihat melalui `pm2 logs`)
client.on('qr', qr => {
    console.log('====== QR CODE READY TO SCAN ======');
    qrcode.generate(qr, { small: true });
    console.log('===================================');
    console.log('Pindai QR code di atas. Anda dapat melihat log ini dengan `pm2 logs wa-bot`');
});

// Event ketika bot berhasil terhubung
client.on('ready', () => {
    console.log('🚀 WhatsApp Client sudah siap dan terhubung!');
});

// Event ketika koneksi bot terputus (untuk debugging)
client.on('disconnected', (reason) => {
    console.log('🔌 WhatsApp Client terputus:', reason);
    // Di sini Anda bisa menambahkan logika untuk mencoba reconnect atau mengirim notifikasi
});

// --- 5. LOGIKA UTAMA BOT WHATSAPP ---
client.on('message', async (message) => {
    const senderId = message.from;
    const body = message.body.toLowerCase().trim();

    // Daftarkan pengguna baru jika belum ada
    if (!db.users[senderId]) {
        db.users[senderId] = { joinedAt: new Date().toISOString(), balance: 0, lastBonus: null };
        console.log(`🙋 Pengguna baru ditambahkan: ${senderId}`);
        saveDatabase();
    }

    // Contoh perintah untuk simulasi di panel admin
    if (body.startsWith('!order')) {
        const newOrder = { id: `order_${Date.now()}`, userId: senderId, product: "Produk Demo", amount: 50000, status: "pending", createdAt: new Date().toISOString() };
        db.orders.push(newOrder);
        saveDatabase();
        message.reply(`🛍️ Pesanan demo Anda untuk "${newOrder.product}" telah dibuat!`);
    }

    if (body.startsWith('!withdraw')) {
        const amountToWithdraw = 25000;
        db.users[senderId].balance += 50000; // Tambah saldo bohongan untuk demo
        const newWithdrawal = { id: `wd_${Date.now()}`, userId: senderId, amount: amountToWithdraw, method: "DANA", accountDetails: "081234567890", status: "pending", createdAt: new Date().toISOString() };
        db.withdrawals.push(newWithdrawal);
        saveDatabase();
        message.reply(`💸 Permintaan penarikan dana demo sebesar Rp ${amountToWithdraw.toLocaleString('id-ID')} telah diajukan.`);
    }
});

// Mulai koneksi bot
client.initialize().catch(err => console.error("❌ Gagal menginisialisasi client:", err));


// --- 6. LOGIKA SOCKET.IO UNTUK PANEL ADMIN ---
io.on('connection', (socket) => {
    console.log('🔗 Panel Admin terhubung via Socket.IO');

    // Kirim semua data terbaru ke panel admin yang baru terhubung
    socket.emit('data_updated', db);

    // Listener untuk memperbarui pengaturan
    socket.on('update_settings', (settingsData) => {
        console.log('⚙️ Menerima pembaruan pengaturan...');
        db.settings = { ...db.settings, ...settingsData };
        saveDatabase();
        socket.emit('settings_saved', { message: 'Pengaturan berhasil disimpan!' });
    });

    // Listener untuk menambah produk baru
    socket.on('add_product', (productData) => {
        console.log('📦 Menambahkan produk baru...');
        const newProduct = { id: `prod_${Date.now()}`, ...productData };
        db.products.push(newProduct);
        saveDatabase();
    });

    // Listener untuk menyetujui penarikan dana
    socket.on('approve_withdrawal', async ({ id }) => {
        const withdrawal = db.withdrawals.find(w => w.id === id);
        if (withdrawal && withdrawal.status === 'pending') {
            withdrawal.status = 'completed';
            console.log(`✅ Penarikan ${id} disetujui.`);
            saveDatabase();
            await client.sendMessage(withdrawal.userId, `✅ Penarikan dana Anda sebesar Rp ${withdrawal.amount.toLocaleString('id-ID')} telah **DISETUJUI** dan akan segera kami proses. Terima kasih!`);
        }
    });

    // Listener untuk menolak penarikan dana
    socket.on('reject_withdrawal', async ({ id, reason }) => {
        const withdrawal = db.withdrawals.find(w => w.id === id);
        if (withdrawal && withdrawal.status === 'pending') {
            withdrawal.status = 'rejected';
            console.log(`❌ Penarikan ${id} ditolak. Alasan: ${reason}`);
            saveDatabase();
            await client.sendMessage(withdrawal.userId, `❌ Mohon maaf, permintaan penarikan dana Anda sebesar Rp ${withdrawal.amount.toLocaleString('id-ID')} **DITOLAK**.\n\n*Alasan:* ${reason}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Panel Admin terputus.');
    });
});


// --- 7. JALANKAN SERVER ---
server.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`  🚀 Server Bot berjalan di port ${PORT}`);
    console.log(`     Aplikasi ini akan diakses publik melalui Nginx.`);
    console.log(`================================================`);
});
