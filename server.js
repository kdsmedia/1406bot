// ================================================================= //
//         BOT WHATSAPP & ADMIN PANEL V4.0 - FULLY FUNCTIONAL        //
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
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

let genAI, aiModel, rajaOngkir;
let tempProductData = {}; // Variabel sementara untuk alur tambah produk via chat

// ================================================================= //
//                         FUNGSI DATABASE & PENGATURAN              //
// ================================================================= //

function getDefaultSettings() {
    return {
        adminWID: ['6283872543697@c.us'],
        qrisImageURL: 'https://example.com/qris.jpg',
        rajaongkirApiKey: 'YOUR_RAJAONGKIR_API_KEY',
        shopOriginSubdistrictId: '2276',
        geminiApiKey: 'YOUR_GEMINI_API_KEY',
        minWithdrawal: 100000,
        dailyBonus: 200
    };
}

function initializeApiClients(settings) {
    try {
        if (settings.geminiApiKey && settings.geminiApiKey !== 'YOUR_GEMINI_API_KEY') {
            genAI = new GoogleGenerativeAI(settings.geminiApiKey);
            aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            console.log("✅ Klien Google Generative AI (Gemini) berhasil diinisialisasi.");
        }
        if (settings.rajaongkirApiKey && settings.rajaongkirApiKey !== 'YOUR_RAJAONGKIR_API_KEY') {
            rajaOngkir = axios.create({
                baseURL: 'https://api.rajaongkir.com/starter',
                headers: { 'key': settings.rajaongkirApiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log("✅ Klien RajaOngkir berhasil diinisialisasi.");
        }
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Klien API:", error.message);
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
        db.users[userId] = { balance: 0, lastClaim: new Date(0).toISOString(), state: 'idle', address: null };
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
        console.log('⚙️ Menerima pembaruan pengaturan dari panel...');
        const db = readDb();
        db.settings = newSettings;
        writeDb(db);
        initializeApiClients(newSettings);
        socket.emit('settings_saved', { message: 'Pengaturan disimpan! Bot akan restart...' });
        console.log('Server akan restart dalam 2 detik untuk menerapkan pengaturan...');
        setTimeout(() => { process.exit(0); }, 2000);
    });

    socket.on('approve_withdrawal', async (data) => { await handleApproveCmd(null, `!approve ${data.id}`); });
    socket.on('reject_withdrawal', async (data) => { await handleRejectCmd(null, `!reject ${data.id} ${data.reason}`); });
    
    socket.on('add_product', (productData) => {
        const db = readDb();
        const newProduct = { 
            id: `PROD${Date.now()}`, 
            ...productData,
            stock: productData.stock || 0
        };
        if (!db.products) db.products = [];
        db.products.push(newProduct);
        writeDb(db);
        console.log(`📦 Produk baru ditambahkan dari panel: ${newProduct.name}`);
        socket.emit('settings_saved', { message: 'Produk berhasil ditambahkan!' });
    });
    
    socket.on('disconnect', () => { console.log('🔌 Admin Panel terputus.'); });
});

// ================================================================= //
//                         FUNGSI FITUR BOT LENGKAP                  //
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

async function sendAdminMenu(chatId) {
    console.log(`[FUNGSI] Menjalankan sendAdminMenu untuk ${chatId}`);
    const list = new List(
        '👑 *Selamat Datang, Admin!*\nSilakan pilih salah satu perintah di bawah ini untuk mengelola bot.',
        'Buka Menu Admin',
        [{ title: 'Menu Khusus Admin', rows: [
            { id: 'cmd_tambahproduk', title: '📦 Tambah Produk Baru' },
            { id: 'cmd_start', title: '⬅️ Kembali ke Menu Utama' },
        ]}],
        'Menu Admin'
    );
    await client.sendMessage(chatId, list);
}

async function handleSaldoCmd(chatId) {
    console.log(`[FUNGSI] Menjalankan handleSaldoCmd untuk ${chatId}`);
    const userData = getUser(chatId);
    await client.sendMessage(chatId, `💰 Saldo Anda: *Rp ${userData.balance.toLocaleString('id-ID')}*`);
}

async function handleClaimBonusCmd(chatId) {
    console.log(`[FUNGSI] Menjalankan handleClaimBonusCmd untuk ${chatId}`);
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
    console.log(`[FUNGSI] Menjalankan handleWithdrawCmd untuk ${chatId}`);
    const db = readDb();
    const { minWithdrawal, adminWID } = db.settings;
    const parts = messageBody.split(' ');
    if (parts.length < 4 && messageBody.startsWith('!')) {
        await client.sendMessage(chatId, `❌ Format salah. Gunakan:\n*!withdraw <jumlah> <metode> <nomor tujuan>*`); return;
    }
    if (parts.length === 1 && (messageBody.startsWith('cmd_') || messageBody.startsWith('!'))) {
        await client.sendMessage(chatId, `Untuk menarik saldo, ketik:\n*!withdraw <jumlah> <metode> <nomor tujuan>*`); return;
    }
    const amount = parseInt(parts[1]);
    const method = parts[2].toUpperCase();
    const accountDetails = parts.slice(3).join(' ');
    if (isNaN(amount)) { await client.sendMessage(chatId, '❌ Jumlah harus berupa angka.'); return; }
    if (amount < minWithdrawal) { await client.sendMessage(chatId, `❌ Minimal penarikan adalah *Rp ${minWithdrawal.toLocaleString('id-ID')}*.`); return; }
    const userData = getUser(chatId);
    if (amount > userData.balance) { await client.sendMessage(chatId, `❌ Saldo Anda tidak mencukupi.`); return; }
    
    db.users[chatId].balance -= amount;
    const withdrawalId = `WD${Date.now()}`;
    const newWithdrawal = { id: withdrawalId, userId: chatId, amount, method, accountDetails, status: 'pending', requestTimestamp: new Date().toISOString() };
    if (!db.withdrawals) db.withdrawals = [];
    db.withdrawals.push(newWithdrawal);
    writeDb(db);
    
    await client.sendMessage(chatId, `✅ Permintaan penarikan Anda sebesar *Rp ${amount.toLocaleString('id-ID')}* telah diterima.`);
    const adminMessage = `🔔 *Permintaan Withdraw Baru*\n\nID: \`${withdrawalId}\`\nDari: \`${chatId.split('@')[0]}\`\nJumlah: *Rp ${amount.toLocaleString('id-ID')}*\nMetode: *${method}*\nTujuan: \`${accountDetails}\``;
    adminWID.forEach(admin => client.sendMessage(admin, adminMessage));
}

async function handleApproveCmd(adminChatId, messageBody) {
    console.log(`[FUNGSI] Menjalankan handleApproveCmd`);
    const idToApprove = messageBody.split(' ')[1];
    if (!idToApprove) { if(adminChatId) await client.sendMessage(adminChatId, 'Format salah: *!approve <ID>*'); return; }
    const db = readDb();
    const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToApprove);
    if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') { 
        if(adminChatId) await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan/sudah diproses.'); 
        return; 
    }
    db.withdrawals[wdIndex].status = 'completed';
    const wd = db.withdrawals[wdIndex];
    writeDb(db); 
    if(adminChatId) await client.sendMessage(adminChatId, `✅ Withdraw \`${wd.id}\` berhasil disetujui.`);
    await client.sendMessage(wd.userId, `✅ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* telah berhasil dikirim.`);
}

async function handleRejectCmd(adminChatId, messageBody) {
    console.log(`[FUNGSI] Menjalankan handleRejectCmd`);
    const parts = messageBody.split(' ');
    const idToReject = parts[1];
    const reason = parts.slice(2).join(' ') || 'Tidak ada alasan spesifik.';
    if (!idToReject) { if(adminChatId) await client.sendMessage(adminChatId, 'Format salah: *!reject <ID> <alasan>*'); return; }
    const db = readDb();
    const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToReject);
    if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') { 
        if(adminChatId) await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan/sudah diproses.'); 
        return; 
    }
    const wd = db.withdrawals[wdIndex];
    db.users[wd.userId].balance += wd.amount;
    db.withdrawals[wdIndex].status = 'rejected';
    writeDb(db);
    if(adminChatId) await client.sendMessage(adminChatId, `🗑️ Withdraw \`${wd.id}\` berhasil ditolak.`);
    await client.sendMessage(wd.userId, `❌ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* ditolak.\n\n*Alasan:* ${reason}\n\nSaldo telah dikembalikan.`);
}

async function handleKatalogCmd(chatId) {
    console.log(`[FUNGSI] Menjalankan handleKatalogCmd untuk ${chatId}`);
    const db = readDb();
    if (!db.products || db.products.length === 0) {
        return client.sendMessage(chatId, "😔 Maaf, saat ini belum ada produk yang tersedia.");
    }
    let catalogMessage = '🛍️ *KATALOG PRODUK KAMI* 🛍️\n\n';
    db.products.forEach(p => {
        catalogMessage += `*${p.name}*\n`;
        catalogMessage += `💰 Harga: Rp ${p.price.toLocaleString('id-ID')}\n`;
        catalogMessage += `📦 Stok: ${p.stock}\n`;
        catalogMessage += `🆔 ID: \`${p.id}\`\n\n`;
    });
    catalogMessage += "Untuk membeli, ketik:\n*!beli <ID Produk> <Jumlah>*";
    await client.sendMessage(chatId, catalogMessage);
}

async function handleBeliCmd(chatId, messageBody) {
    console.log(`[FUNGSI] Menjalankan handleBeliCmd untuk ${chatId}`);
    const parts = messageBody.split(' ');
    if (parts.length < 3) {
        return client.sendMessage(chatId, "❌ Format salah. Gunakan: *!beli <ID Produk> <Jumlah>*");
    }
    
    const productId = parts[1];
    const quantity = parseInt(parts[2]);

    if (isNaN(quantity) || quantity <= 0) {
        return client.sendMessage(chatId, "❌ Jumlah pembelian tidak valid.");
    }

    const db = readDb();
    const productIndex = db.products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return client.sendMessage(chatId, "❌ Produk dengan ID tersebut tidak ditemukan.");
    }

    if (db.products[productIndex].stock < quantity) {
        return client.sendMessage(chatId, `❌ Maaf, stok produk *${db.products[productIndex].name}* tidak mencukupi. Sisa stok: ${db.products[productIndex].stock}`);
    }

    const product = db.products[productIndex];
    const totalPrice = product.price * quantity;
    const orderId = `ORDER${Date.now()}`;
    
    const newOrder = {
        id: orderId,
        userId: chatId,
        productId: product.id,
        productName: product.name,
        quantity: quantity,
        totalPrice: totalPrice,
        status: 'pending',
        timestamp: new Date().toISOString()
    };
    
    if (!db.orders) db.orders = [];
    db.orders.push(newOrder);
    
    db.products[productIndex].stock -= quantity;
    
    writeDb(db);

    await client.sendMessage(chatId, `✅ Pesanan Anda berhasil dibuat!\n\nID Pesanan: \`${orderId}\`\nProduk: *${product.name}*\nJumlah: *${quantity}*\nTotal Harga: *Rp ${totalPrice.toLocaleString('id-ID')}*\n\nSilakan lakukan pembayaran dan konfirmasi ke admin.`);
    
    const adminMessage = `🔔 *Pesanan Baru Masuk!*\n\nID: \`${orderId}\`\nDari: \`${chatId.split('@')[0]}\`\nProduk: *${product.name}*\nJumlah: *${quantity}*\nTotal: *Rp ${totalPrice.toLocaleString('id-ID')}*`;
    db.settings.adminWID.forEach(admin => client.sendMessage(admin, adminMessage));
}

async function handleAddProductCmd(chatId) {
    console.log(`[FUNGSI] Memulai proses tambah produk untuk admin ${chatId}`);
    const db = readDb();
    db.users[chatId].state = 'adding_product_name';
    writeDb(db);
    await client.sendMessage(chatId, '📦 Oke, kita mulai proses tambah produk baru.\n\nSilakan ketik *nama produk* yang ingin ditambahkan:');
}

async function handleAiQuery(message) {
    if (!aiModel) {
        return message.reply("Maaf, fitur AI sedang tidak aktif. Pastikan API Key Gemini sudah diatur.");
    }
    try {
        const chat = await message.getChat();
        const question = message.body.replace(/@\d+/g, '').trim();
        if (!question) {
            return message.reply("Halo! Ada yang bisa saya bantu? Silakan ajukan pertanyaan setelah me-mention saya.");
        }
        
        await chat.sendStateTyping();
        console.log(`[AI] Menerima pertanyaan dari ${message.from}: "${question}"`);
        const result = await aiModel.generateContent(question);
        const response = await result.response;
        const text = response.text();
        await message.reply(text);
        await chat.clearState();
    } catch (error) {
        console.error("[ERROR AI] Gagal memproses permintaan AI:", error);
        await message.reply("🤖 Maaf, terjadi sedikit gangguan pada otak AI saya. Coba lagi nanti ya.");
    }
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

client.on('group_join', async (notification) => {
    try {
        const groupId = notification.chatId;
        const chat = await client.getChatById(groupId);
        console.log(`[EVENT] Ada anggota baru di grup: ${chat.name}`);
        for (const recipientId of notification.recipients) {
            const newMemberContact = await client.getContactById(recipientId);
            const mention = `@${newMemberContact.number}`;
            const welcomeList = new List(
                `👋 Halo ${mention}, selamat datang di grup *${chat.name}*!\n\nSaya adalah asisten bot di sini. Silakan pilih menu di bawah untuk memulai.`,
                'Buka Menu',
                [{ title: 'Menu Utama', rows: [
                        { id: 'cmd_katalog', title: '🛍️ Lihat Katalog' },
                        { id: 'cmd_profil', title: '👤 Profil Saya' }
                    ]}], 'Selamat Datang!');
            await chat.sendMessage(welcomeList, { mentions: [newMemberContact] });
            console.log(`[SAMBUTAN] Pesan selamat datang terkirim untuk ${mention} di grup ${chat.name}`);
        }
    } catch (error) {
        console.error('[ERROR GROUP JOIN] Gagal mengirim pesan sambutan:', error);
    }
});

// ================================================================= //
//                      ROUTER PESAN UTAMA                           //
// ================================================================= //

client.on('message', async (message) => {
    try {
        if (!message.body || message.isStatus) return;

        const text = message.body.trim();
        const chatId = message.from;
        const chat = await message.getChat();
        const userData = getUser(chatId);
        
        console.log(`[PESAN] Dari: ${chatId} (${userData.state}) | Isi: "${text}"`);

        const db = readDb();
        const isAdmin = db.settings.adminWID.includes(chatId);
        const lowerCaseText = text.toLowerCase();
        
        // Penanganan stateful untuk admin (tambah produk via chat)
        if (isAdmin && userData.state.startsWith('adding_product')) {
            switch (userData.state) {
                case 'adding_product_name':
                    tempProductData[chatId] = { name: text };
                    db.users[chatId].state = 'adding_product_price';
                    writeDb(db);
                    await client.sendMessage(chatId, '✅ Nama produk disimpan.\n\nSekarang, masukkan *harga produk* (hanya angka, contoh: 50000):');
                    return;
                case 'adding_product_price':
                    const price = parseInt(text);
                    if (isNaN(price)) {
                        await client.sendMessage(chatId, '❌ Harga tidak valid. Harap masukkan angka saja.\n\nSilakan masukkan *harga produk* lagi:');
                        return;
                    }
                    tempProductData[chatId].price = price;
                    db.users[chatId].state = 'adding_product_stock';
                    writeDb(db);
                    await client.sendMessage(chatId, '✅ Harga disimpan.\n\nSekarang, masukkan *jumlah stok* (angka):');
                    return;
                case 'adding_product_stock':
                    const stock = parseInt(text);
                    if (isNaN(stock)) {
                        await client.sendMessage(chatId, '❌ Stok tidak valid. Harap masukkan angka saja.\n\nSilakan masukkan *jumlah stok* lagi:');
                        return;
                    }
                    tempProductData[chatId].stock = stock;
                    db.users[chatId].state = 'adding_product_description';
                    writeDb(db);
                    await client.sendMessage(chatId, '✅ Stok disimpan.\n\nTerakhir, masukkan *deskripsi singkat produk*:');
                    return;
                case 'adding_product_description':
                    tempProductData[chatId].description = text;
                    const newProduct = {
                        id: `PROD${Date.now()}`,
                        ...tempProductData[chatId]
                    };
                    if (!db.products) db.products = [];
                    db.products.push(newProduct);
                    db.users[chatId].state = 'idle';
                    writeDb(db);
                    delete tempProductData[chatId];
                    await client.sendMessage(chatId, `🎉 *Produk Berhasil Ditambahkan!*\n\n*Nama:* ${newProduct.name}\n*Harga:* Rp ${newProduct.price.toLocaleString('id-ID')}\n*Stok:* ${newProduct.stock}\n*ID:* \`${newProduct.id}\``);
                    return;
            }
        }
        
        if (message.mentionedIds.includes(client.info.wid)) {
            await handleAiQuery(message);
            return;
        }

        if (lowerCaseText.startsWith('cmd_')) {
            const command = lowerCaseText.split('_')[1];
            console.log(`[CMD MENU] ${command}`);
            switch (command) {
                case 'start': await handleStart(chatId); break;
                case 'profil': await sendProfileMenu(chatId); break;
                case 'saldo': await handleSaldoCmd(chatId); break;
                case 'klaim': await handleClaimBonusCmd(chatId); break;
                case 'withdraw': await handleWithdrawCmd(chatId, text); break;
                case 'katalog': await handleKatalogCmd(chatId); break;
                case 'tambahproduk': if(isAdmin) await handleAddProductCmd(chatId); break;
                default: console.log(`Perintah menu tidak dikenal: ${command}`);
            }
            return;
        }
        
        if (lowerCaseText.startsWith('!')) {
            const command = lowerCaseText.split(' ')[0];
            console.log(`[CMD KETIK] ${command}`);
            switch (command) {
                case '!start': await handleStart(chatId); break;
                case '!profil': await sendProfileMenu(chatId); break;
                case '!saldo': await handleSaldoCmd(chatId); break;
                case '!klaim': await handleClaimBonusCmd(chatId); break;
                case '!withdraw': await handleWithdrawCmd(chatId, text); break;
                case '!katalog': await handleKatalogCmd(chatId); break;
                case '!beli': await handleBeliCmd(chatId, text); break;
                default: 
                    if (!isAdmin) { await client.sendMessage(chatId, "Maaf, perintah tidak dikenali. Ketik *!start* untuk melihat menu."); }
            }
            if (isAdmin) {
                 switch (command) {
                    case '!admin': await sendAdminMenu(chatId); break;
                    case '!approve': await handleApproveCmd(chatId, text); break;
                    case '!reject': await handleRejectCmd(chatId, text); break;
                    case '!tambahproduk': await handleAddProductCmd(chatId); break;
                 }
            }
            return;
        }

        if (!chat.isGroup) {
            console.log(`[FALLBACK] Mengirim menu sambutan ke ${chatId}.`);
            await handleStart(chatId);
        }

    } catch (error) {
        console.error(`[ERROR UTAMA] Gagal memproses pesan:`, error);
    }
});
