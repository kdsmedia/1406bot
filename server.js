// ================================================================= //
//              BOT WHATSAPP CANGGIH V1.0 - FINAL                  //
// ================================================================= //

// --- IMPORTS LIBRARY ---
const fs = require('fs');
const { Client, LocalAuth, MessageMedia, List } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

// --- KONFIGURASI PENTING (WAJIB DIISI!) ---
const ADMIN_WID = '6285813899649';
const QRIS_IMAGE_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgHwO_-Mp4mmE5tIQgvrs8ZzsUiKwMWROUa8XAMFdKpYGzqxAXR9ciCYRZ9LBt-i1ukxzhTVQw_mcKbCm5jzFe6vySjmowjplpTMJBwV5HVfETSH6WwqlWHY2BEn_rMJn4jXXRX5ylMRwDGPssCFolj5akwy1Ny-Y3_JHFQZK3Jdf4HzaFwuBRXqwcDVhI/s407/qris.jpg';
const RAJAONGKIR_API_KEY = 'gBFPpQZd9f94a0b3859a57deidGsYsCm';
const SHOP_ORIGIN_SUBDISTRICT_ID = '32.15.03.2011';
const GEMINI_API_KEY = 'AIzaSyBUalvW1ztILdy1dyLryrcJ8EEvUSw6g-o';

// --- PENGATURAN LAINNYA ---
const DB_PATH = './db.json';
const MIN_WITHDRAWAL = 100000;
const DAILY_BONUS = 200;

// --- INISIALISASI LIBRARY ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // DIUBAH SESUAI PERMINTAAN

const rajaOngkir = axios.create({
    baseURL: 'https://api.rajaongkir.com/starter',
    headers: { 'key': RAJAONGKIR_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
});

// ================================================================= //
//                       FUNGSI PEMBANTU (HELPERS)                   //
// ================================================================= //

function readDb() { try { return JSON.parse(fs.readFileSync(DB_PATH)); } catch (e) { return { users: {}, products: [], orders: [], withdrawals: [] }; } }
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function getUser(userId) {
    const db = readDb();
    if (!db.users || !db.users[userId]) {
        if (!db.users) db.users = {};
        db.users[userId] = {
            balance: 0, lastClaim: new Date(0).toISOString(), cart: [],
            state: 'idle', address: null,
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
            if(key !== 'generationProgress') delete db.users[userId][key]
        });
        if (progressData) {
            const key = Object.keys(progressData)[0];
            db.users[userId][key] = progressData[key];
        }
        if (state === 'idle') {
            delete db.users[userId].generationProgress;
        }
        writeDb(db);
    }
}

async function getGeminiResponse(prompt) {
    try {
        const result = await aiModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "🤖 Maaf, AI sedang mengalami sedikit gangguan. Silakan coba lagi nanti.";
    }
}

async function getShippingOptions(destinationSubdistrictId, weightInGrams) {
    try {
        const response = await rajaOngkir.post('/cost', {
            origin: SHOP_ORIGIN_SUBDISTRICT_ID, originType: 'subdistrict',
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
//                      Fungsi Fitur Lengkap                         //
// ================================================================= //

async function handleStart(chatId) {
    const startMessage = `👋 *Selamat Datang di Bot Canggih!*
Saya adalah asisten virtual yang siap melayani Anda 24/7.

🛒 *Menu Belanja*
- Ketik *!katalog* untuk melihat semua produk.
- Ketik *!keranjang* untuk melihat keranjang belanja Anda.
- Ketik *!checkout* untuk memproses pesanan.

💰 *Fitur Akun & Bonus*
- Ketik *!saldo* untuk cek saldo bonus Anda.
- Ketik *!klaim* untuk mendapatkan bonus harian.
- Ketik *!withdraw* untuk menarik saldo.
- Ketik *!riwayat* untuk melihat riwayat transaksi.

✨ *Fitur AI*
- Ketik *!generator* untuk membuat konten kreatif.
- Atau, langsung saja ajak saya ngobrol apa saja! (di chat pribadi)

ℹ️ *Bantuan*
- Ketik *!alamat* untuk mengatur alamat pengiriman Anda.
- Ketik *!bantuan* atau *!start* untuk melihat pesan ini lagi.`;
    await client.sendMessage(chatId, startMessage);
}

async function handleSaldoCmd(chatId) {
    const userData = getUser(chatId);
    await client.sendMessage(chatId, `💰 Saldo Anda saat ini adalah: *Rp ${userData.balance.toLocaleString('id-ID')}*`);
}

async function handleClaimBonusCmd(chatId) {
    const userData = getUser(chatId);
    const lastClaimDate = new Date(userData.lastClaim);
    const now = new Date();
    const timeDifference = now.getTime() - lastClaimDate.getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    if (timeDifference >= twentyFourHoursInMs) {
        const db = readDb();
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
    const parts = messageBody.split(' ');
    if (parts.length < 4) {
        await client.sendMessage(chatId, `❌ Format salah. Gunakan:\n*!withdraw <jumlah> <metode> <nomor tujuan>*\n\nContoh:\n*!withdraw 10000 DANA 081234567890*`);
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
    const db = readDb();
    db.users[chatId].balance -= amount;
    const withdrawalId = `WD${Date.now()}`;
    const newWithdrawal = {
        id: withdrawalId, userId: chatId, amount, method, accountDetails,
        status: 'pending', requestTimestamp: new Date().toISOString()
    };
    if (!db.withdrawals) db.withdrawals = [];
    db.withdrawals.push(newWithdrawal);
    writeDb(db);
    await client.sendMessage(chatId, `✅ Permintaan penarikan Anda sebesar *Rp ${amount.toLocaleString('id-ID')}* telah diterima dan sedang diproses.`);
    const adminMessage = `🔔 *Permintaan Withdraw Baru*\n\nID: \`${withdrawalId}\`\nDari: \`${chatId.split('@')[0]}\`\nJumlah: *Rp ${amount.toLocaleString('id-ID')}*\nMetode: *${method}*\nTujuan: \`${accountDetails}\`\n\nBalas dengan:\n*!approve ${withdrawalId}*\n*!reject ${withdrawalId} <alasan>*`;
    await client.sendMessage(ADMIN_WID, adminMessage);
}

async function sendCatalogList(chatId) {
    const db = readDb();
    const products = db.products;
    if (!products || products.length === 0) {
        await client.sendMessage(chatId, "Maaf, saat ini belum ada produk yang tersedia.");
        return;
    }

    const productRows = products.map(product => ({
        id: `product_${product.id}`,
        title: product.name,
        description: `Rp ${product.price.toLocaleString('id-ID')}`
    }));

    const sections = [{ title: 'Produk Tersedia', rows: productRows }];
    const catalogList = new List(
        'Selamat datang di toko kami! Silakan pilih produk dari daftar di bawah untuk melihat detailnya.',
        'Lihat Produk',
        sections,
        'Katalog Produk Kami',
        'Toko Bot Canggih'
    );

    await client.sendMessage(chatId, catalogList);
}

async function sendProductDetail(chatId, productId) {
    const db = readDb();
    const product = db.products.find(p => p.id === productId);
    if (!product) {
        await client.sendMessage(chatId, "Maaf, produk tidak ditemukan.");
        return;
    }

    let caption = `*${product.name}*\n\n`;
    caption += `${product.description}\n\n`;
    caption += `Harga: *Rp ${product.price.toLocaleString('id-ID')}*\n`;
    caption += `Kategori: ${product.category}\n`;
    caption += `Berat: ${product.weight} gram\n`;

    if (product.colors && product.colors.length > 0) {
        caption += `Pilihan Warna: ${product.colors.join(', ')}\n`;
    }
    if (product.sizes && product.sizes.length > 0) {
        caption += `Pilihan Ukuran: ${product.sizes.join(', ')}\n`;
    }

    if (product.imageUrls && product.imageUrls.length > 0) {
        try {
            const media = await MessageMedia.fromUrl(product.imageUrls[0], { unsafeMime: true });
            await client.sendMessage(chatId, media, { caption: caption });
        } catch (e) {
            console.error("Gagal mengambil gambar dari URL:", e.message);
            await client.sendMessage(chatId, caption + "\n\n_(Gambar produk tidak dapat ditampilkan saat ini)_");
        }
    } else {
        await client.sendMessage(chatId, caption);
    }

    const actionRows = [
        { id: `action_beli_${product.id}_1`, title: '🛒 Tambah ke Keranjang', description: 'Menambahkan 1 item ke keranjang.' },
        { id: `action_checkout_${product.id}_1`, title: '⚡ Beli Sekarang', description: 'Langsung lanjut ke pembayaran.' }
    ];
    const actionSections = [{ title: 'Pilih Tindakan', rows: actionRows }];
    const actionList = new List('Apa yang ingin Anda lakukan?', 'Pilih Aksi', actionSections, product.name);
    await client.sendMessage(chatId, actionList);
}

async function handleAddToCart(chatId, productId, quantity) {
    const db = readDb();
    getUser(chatId);
    if (!db.users[chatId].cart) {
        db.users[chatId].cart = [];
    }

    const existingItemIndex = db.users[chatId].cart.findIndex(item => item.productId === productId);

    if (existingItemIndex > -1) {
        db.users[chatId].cart[existingItemIndex].quantity += quantity;
    } else {
        db.users[chatId].cart.push({ productId, quantity });
    }
    
    writeDb(db);
    const product = db.products.find(p => p.id === productId);
    await client.sendMessage(chatId, `✅ Berhasil menambahkan *${quantity}x ${product.name}* ke keranjang.`);
}

async function handleViewCart(chatId) {
    const user = getUser(chatId);
    if (!user.cart || user.cart.length === 0) {
        await client.sendMessage(chatId, "🛒 Keranjang belanja Anda kosong.");
        return;
    }

    const db = readDb();
    let subtotal = 0;
    let cartText = "🛒 *Isi Keranjang Belanja Anda*\n\n";

    for (const item of user.cart) {
        const product = db.products.find(p => p.id === item.productId);
        if (product) {
            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;
            cartText += `📦 *${product.name}*\n   ${item.quantity} x Rp ${product.price.toLocaleString('id-ID')} = *Rp ${itemTotal.toLocaleString('id-ID')}*\n\n`;
        }
    }

    cartText += `-----------------------------------\n*Subtotal:* *Rp ${subtotal.toLocaleString('id-ID')}*\n\nKetik *!checkout* untuk melanjutkan ke pembayaran.`;
    await client.sendMessage(chatId, cartText);
}

async function sendGeneratorMenu(chatId) {
    const generatorRows = [
        { id: 'gen_pantun', title: '✍️ Buat Pantun', description: 'Membuat pantun jenaka 4 baris.' },
        { id: 'gen_idekonten', title: '💡 Ide Konten Sosmed', description: 'Dapatkan 3 ide konten untuk Instagram/TikTok.' },
        { id: 'gen_quote', title: '📜 Kata-Kata Bijak', description: 'Membuat quote motivasi original.' },
        { id: 'gen_storyboard', title: '🎬 Buat Storyboard', description: 'Hasilkan 4 adegan dari sebuah konsep cerita.' }
    ];
    const sections = [{ title: 'Pilih Generator Konten', rows: generatorRows }];
    const generatorList = new List(
        'Pilih jenis konten yang ingin Anda buat dengan bantuan AI.',
        'Pilih Generator',
        sections,
        'Menu AI Generator'
    );
    await client.sendMessage(chatId, generatorList);
}

async function sendHistoryMenu(chatId) {
    const historyRows = [
        { id: 'history_orders', title: '📜 Riwayat Pesanan', description: 'Lihat semua pesanan pembelian Anda.' },
        { id: 'history_withdrawals', title: '💸 Riwayat Withdraw', description: 'Lihat semua riwayat penarikan saldo.' },
    ];
    const sections = [{ title: 'Pilih Jenis Riwayat', rows: historyRows }];
    const historyList = new List(
        'Silakan pilih jenis riwayat yang ingin Anda lihat dari daftar di bawah.',
        'Pilih Riwayat',
        sections,
        'Menu Riwayat Transaksi'
    );
    await client.sendMessage(chatId, historyList);
}

async function handleViewOrderHistory(chatId) {
    const db = readDb();
    const userOrders = db.orders.filter(o => o.userId === chatId);
    if (userOrders.length === 0) {
        await client.sendMessage(chatId, "Anda belum memiliki riwayat pesanan.");
        return;
    }
    let historyText = "📜 *Riwayat 5 Pesanan Terakhir Anda*\n\n";
    const recentOrders = userOrders.reverse().slice(0, 5);
    for (const order of recentOrders) {
        const orderDate = new Date(order.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        historyText += `-----------------------------------\n`;
        historyText += `*ID:* \`${order.id}\`\n`;
        historyText += `*Tanggal:* ${orderDate}\n`;
        historyText += `*Total:* Rp ${order.grandTotal.toLocaleString('id-ID')}\`\n`;
        historyText += `*Status:* *${order.status.replace('_', ' ').toUpperCase()}*\n`;
    }
    await client.sendMessage(chatId, historyText);
}

async function handleViewWithdrawalHistory(chatId) {
    const db = readDb();
    const userWithdrawals = db.withdrawals.filter(w => w.userId === chatId);
    if (userWithdrawals.length === 0) {
        await client.sendMessage(chatId, "Anda belum memiliki riwayat penarikan saldo.");
        return;
    }
    let historyText = "💸 *Riwayat 5 Penarikan Terakhir Anda*\n\n";
    const recentWithdrawals = userWithdrawals.reverse().slice(0, 5);
    for (const wd of recentWithdrawals) {
        const wdDate = new Date(wd.requestTimestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        historyText += `-----------------------------------\n`;
        historyText += `*ID:* \`${wd.id}\`\n`;
        historyText += `*Tanggal:* ${wdDate}\n`;
        historyText += `*Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\`\n`;
        historyText += `*Status:* *${wd.status.toUpperCase()}*\n`;
    }
    await client.sendMessage(chatId, historyText);
}

async function handleInfoCmd(adminChatId, messageBody) {
    if (adminChatId !== ADMIN_WID) return;
    const parts = messageBody.split(' ');
    if (parts.length < 3) {
        await client.sendMessage(adminChatId, "❌ Format salah.\nGunakan: *!info <ID Pesanan> <pesan Anda>*");
        return;
    }
    const orderId = parts[1];
    const infoMessage = parts.slice(2).join(' ');
    const db = readDb();
    const orderIndex = db.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
        await client.sendMessage(adminChatId, `❌ Pesanan dengan ID \`${orderId}\` tidak ditemukan.`);
        return;
    }
    const order = db.orders[orderIndex];
    if (order.status === 'paid') {
        db.orders[orderIndex].status = 'processing';
        writeDb(db);
    }
    const userMessage = `🔔 *UPDATE PESANAN - \`${orderId}\`*\n\n${infoMessage}`;
    await client.sendMessage(order.userId, userMessage);
    await client.sendMessage(adminChatId, `✅ Pesan info berhasil dikirim ke user untuk pesanan \`${orderId}\`.`);
}

async function handleApproveCmd(adminChatId, messageBody) {
    if (adminChatId !== ADMIN_WID) return;
    const idToApprove = messageBody.split(' ')[1];
    if (!idToApprove) {
        await client.sendMessage(adminChatId, 'Format salah. Gunakan: *!approve <ID Withdraw/Order>*');
        return;
    }
    const db = readDb();
    if (idToApprove.startsWith('ORD')) {
        const orderIndex = db.orders.findIndex(o => o.id === idToApprove);
        if (orderIndex === -1 || db.orders[orderIndex].status !== 'waiting_confirmation') {
            await client.sendMessage(adminChatId, '❌ ID Pesanan tidak ditemukan atau tidak sedang menunggu konfirmasi.');
            return;
        }
        db.orders[orderIndex].status = 'paid';
        writeDb(db);
        const order = db.orders[orderIndex];
        await client.sendMessage(adminChatId, `✅ Pesanan \`${order.id}\` berhasil disetujui.`);
        await client.sendMessage(order.userId, `✅ Pembayaran untuk pesanan \`${order.id}\` telah diverifikasi! Pesanan Anda sekarang sedang diproses.`);
    } else if (idToApprove.startsWith('WD')) {
        const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToApprove);
        if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') {
            await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan atau sudah diproses.');
            return;
        }
        db.withdrawals[wdIndex].status = 'completed';
        writeDb(db);
        const wd = db.withdrawals[wdIndex];
        await client.sendMessage(adminChatId, `✅ Withdraw \`${wd.id}\` berhasil disetujui.`);
        await client.sendMessage(wd.userId, `✅ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* telah berhasil dikirim.`);
    } else {
        await client.sendMessage(adminChatId, '❌ ID tidak dikenali.');
    }
}

async function handleRejectCmd(adminChatId, messageBody) {
    if (adminChatId !== ADMIN_WID) return;
    const parts = messageBody.split(' ');
    const idToReject = parts[1];
    const reason = parts.slice(2).join(' ') || 'Tidak ada alasan spesifik.';
    if (!idToReject) {
        await client.sendMessage(adminChatId, 'Format salah. Gunakan: *!reject <ID> <alasan>*');
        return;
    }
    const db = readDb();
    if (idToReject.startsWith('WD')) {
        const wdIndex = db.withdrawals.findIndex(wd => wd.id === idToReject);
        if (wdIndex === -1 || db.withdrawals[wdIndex].status !== 'pending') {
            await client.sendMessage(adminChatId, '❌ ID Withdraw tidak ditemukan atau sudah diproses.');
            return;
        }
        const wd = db.withdrawals[wdIndex];
        db.users[wd.userId].balance += wd.amount; // Kembalikan saldo
        db.withdrawals[wdIndex].status = 'rejected';
        writeDb(db);
        await client.sendMessage(adminChatId, `🗑️ Withdraw \`${wd.id}\` berhasil ditolak.`);
        await client.sendMessage(wd.userId, `❌ Penarikan Anda sebesar *Rp ${wd.amount.toLocaleString('id-ID')}* ditolak.\n\n*Alasan:* ${reason}\n\nSaldo telah dikembalikan.`);
    }
    else {
        await client.sendMessage(adminChatId, '❌ Penolakan saat ini hanya didukung untuk Withdraw.');
    }
}

// ================================================================= //
//                   INISIALISASI & EVENT LISTENER                   //
// ================================================================= //

console.log("Menginisialisasi Bot...");
client.initialize();

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

client.on('group_join', async (notification) => {
    try {
        const chat = await client.getChatById(notification.chatId);
        const newMembers = notification.recipientIds;

        for (const memberId of newMembers) {
            const contact = await client.getContactById(memberId);
            const welcomeMessage = `👋 Halo @${contact.number}, selamat datang di grup *${chat.name}*!

Semoga betah dan jangan lupa baca deskripsi grup ya. 😊`;
            
            await chat.sendMessage(welcomeMessage, { mentions: [contact] });
        }
    } catch (e) {
        console.error("Gagal mengirim pesan sambutan:", e);
    }
});

// ================================================================= //
//                   ROUTER PESAN UTAMA (LENGKAP)                    //
// ================================================================= //

client.on('message', async message => {
    const text = message.body;
    const chatId = message.from;
    const user = getUser(chatId);
    const chat = await message.getChat();
    const db = readDb();
    const isAdmin = chatId === ADMIN_WID;

    // --- UNIVERSAL CANCEL COMMAND ---
    if (text.toLowerCase() === '!batal' && user.state !== 'idle') {
        setUserState(chatId, 'idle');
        await client.sendMessage(chatId, "👍 Proses dibatalkan.");
        return;
    }

    // --- STATE-BASED INTERACTION HANDLER ---
    if (user.state !== 'idle') {
        // --- State untuk Generator Biasa ---
        if (user.state === 'awaiting_generation_topic') {
            const topic = text;
            const genType = user.generationProgress.type;
            let prompt = '';
            
            if (genType === 'pantun') prompt = `Buatkan sebuah pantun jenaka 4 baris tentang "${topic}".`;
            else if (genType === 'idekonten') prompt = `Berikan 3 ide konten sosial media (Instagram/TikTok) yang menarik tentang "${topic}".`;
            else if (genType === 'quote') prompt = `Buat sebuah quote atau kata-kata bijak yang memotivasi tentang "${topic}".`;

            await client.sendMessage(chatId, "🤖 AI sedang meracik kata-kata...");
            const response = await getGeminiResponse(prompt);
            await client.sendMessage(chatId, response);
            setUserState(chatId, 'idle');
        } 
        // --- State untuk Alur Storyboard ---
        else if (user.state === 'awaiting_storyboard_character') {
            user.generationProgress.character = text;
            setUserState(chatId, 'awaiting_storyboard_clothing', { generationProgress: user.generationProgress });
            await client.sendMessage(chatId, "👕 Oke, sekarang masukkan *deskripsi pakaian & aksesoris* karakter.");
        }
        else if (user.state === 'awaiting_storyboard_clothing') {
            user.generationProgress.clothing = text;
            setUserState(chatId, 'awaiting_storyboard_concept', { generationProgress: user.generationProgress });
            await client.sendMessage(chatId, "💡 Terakhir, masukkan *konsep cerita* singkatnya.");
        }
        else if (user.state === 'awaiting_storyboard_concept') {
            const concept = text;
            const prompt = `Anda adalah asisten kreatif. Berdasarkan konsep berikut, buat 4 deskripsi adegan satu kalimat. Balas HANYA dengan format JSON: {"scenes": ["adegan 1", "adegan 2", "adegan 3", "adegan 4"]}. Konsep: "${concept}"`;
            
            await client.sendMessage(chatId, "🤖 AI sedang membuat 4 adegan dari konsep Anda...");
            const rawResponse = await getGeminiResponse(prompt);
            
            try {
                const jsonString = rawResponse.replace(/```json\n|```/g, '').trim();
                const result = JSON.parse(jsonString);
                if (result.scenes && result.scenes.length === 4) {
                    const { character, clothing } = user.generationProgress;
                    const finalPrompt = `Kolase cerita visual dalam 4 panel. Menampilkan satu karakter yang konsisten di seluruh panel.

Deskripsi Karakter: ${character}
Pakaian Karakter: ${clothing}

Panel 1: ${result.scenes[0]}
Panel 2: ${result.scenes[1]}
Panel 3: ${result.scenes[2]}
Panel 4: ${result.scenes[3]}

Gaya: fotorealistik, dengan pencahayaan sinematik. Pastikan penampilan karakter identik di setiap panel untuk konsistensi yang sempurna. Output akhir harus berupa satu gambar dengan tata letak grid 2x2.`;

                    await client.sendMessage(chatId, `✅ Berhasil! Berikut adalah prompt final yang bisa Anda salin dan gunakan di generator gambar AI (seperti DALL-E di ChatGPT atau lainnya):`);
                    await client.sendMessage(chatId, "```\n" + finalPrompt + "\n```");

                } else {
                    throw new Error("Format balasan AI tidak sesuai.");
                }
            } catch (e) {
                console.error("Gagal mem-parsing JSON dari AI:", e);
                await client.sendMessage(chatId, "Maaf, terjadi kesalahan saat memproses hasil dari AI. Coba lagi dengan konsep yang berbeda.");
            }
            setUserState(chatId, 'idle');
        }
        return;
    }
    
    // --- MEDIA-BASED COMMAND HANDLER ---
    if (message.hasMedia) {
        if (text.toLowerCase().startsWith('!konfirmasi')) { /* ... */ } 
        else if (isAdmin && text.toLowerCase().startsWith('!resi')) { /* ... */ }
        return;
    }
    
    // --- TEXT-BASED COMMAND HANDLER ---
    if (text.startsWith('!')) {
        const command = text.toLowerCase().split(' ')[0];
        
        switch (command) {
            case '!start': case '!bantuan': await handleStart(chatId); break;
            case '!katalog': sendCatalogList(chatId); break;
            case '!keranjang': handleViewCart(chatId); break;
            case '!saldo': handleSaldoCmd(chatId); break;
            case '!klaim': case '!bonus': handleClaimBonusCmd(chatId); break;
            case '!withdraw': handleWithdrawCmd(chatId, text); break;
            case '!generator': sendGeneratorMenu(chatId); break;
            case '!riwayat': sendHistoryMenu(chatId); break;
        }

        if (isAdmin) {
            switch (command) {
                case '!tambahproduk': /* ... */ break;
                case '!info': handleInfoCmd(chatId, text); break;
                case '!approve': handleApproveCmd(chatId, text); break;
                case '!reject': handleRejectCmd(chatId, text); break;
            }
        }
        return;
    }
    
    // --- LIST-BASED RESPONSE HANDLER ---
    if (text.startsWith('product_')) {
        const productId = text.split('_')[1];
        await sendProductDetail(chatId, productId);
        return;
    }

    if (text.startsWith('action_')) {
        const parts = text.split('_');
        const action = parts[1], productId = parts[2], quantity = parseInt(parts[3]);
        if (action === 'beli') {
            await handleAddToCart(chatId, productId, quantity);
        } else if (action === 'checkout') {
            await handleAddToCart(chatId, productId, quantity);
            await client.sendMessage(chatId, "Produk telah ditambahkan. Ketik *!checkout* untuk melanjutkan.");
        }
        return;
    }

    if (text.startsWith('history_')) {
        const historyType = text.split('_')[1];
        if (historyType === 'orders') await handleViewOrderHistory(chatId);
        else if (historyType === 'withdrawals') await handleViewWithdrawalHistory(chatId);
        return;
    }
    
    if (text.startsWith('gen_')) {
        const genType = text.split('_')[1];
        if (genType === 'storyboard') {
            setUserState(chatId, 'awaiting_storyboard_character', { generationProgress: { type: 'storyboard' } });
            await client.sendMessage(chatId, "🎬 Oke, mari kita buat storyboard. Pertama, masukkan *deskripsi karakter* Anda.\n\nContoh: _wanita muda Indonesia, rambut hitam panjang_");
        } else {
            setUserState(chatId, 'awaiting_generation_topic', { generationProgress: { type: genType } });
            await client.sendMessage(chatId, `✍️ Silakan ketik *topik* yang Anda inginkan untuk dibuatkan ${genType}.`);
        }
        return;
    }

    if (text.startsWith('pay_') || text.startsWith('ship_')) { /* ... */ return; }

    // --- FALLBACK TO GEMINI AI ---
    if (!chat.isGroup) {
        await client.sendMessage(chatId, "🤖 AI sedang berpikir...");
        const geminiResponse = await getGeminiResponse(text);
        await client.sendMessage(chatId, geminiResponse);
    }
});
