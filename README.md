# ALTO - Bot WhatsApp Canggih V1.0
### _Sebuah Proyek dari ALTOMEDIA_

![Header](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgjH6ugvQY59wpkduNt1I5okR9uMHWahNn7yVfHaaU2-V4MjPgDnE2CRT-Dp0Omgwd83M60sL5fWvsOx7VLHzRdfOPObLzIZZaZJJxqI1IVcugWSlOaWVXrlByyBSBQZFrAEzyLyc90NbZpnEmiQpTNwU6gnvTj9wK-qfsqURUfOdYwcLRLP-jRZoSilVQ/s1024/ALTOMEDIA-6-8-2025.png) <!-- Ganti dengan URL gambar header Anda -->

ALTO adalah sebuah bot WhatsApp multifungsi yang dirancang untuk mengotomatisasi berbagai tugas, mulai dari toko online interaktif hingga asisten AI pribadi. Ditenagai oleh **whatsapp-web.js** dan **Google Gemini AI**, bot ini siap melayani pengguna 24/7 dengan berbagai fitur canggih.

<p align="center">
  <a href="https://wa.me/6283872543697?text=!start" target="_blank">
    <img src="https://img.shields.io/badge/Coba%20Live%20Demo-%2325D366.svg?style=for-the-badge&logo=WhatsApp&logoColor=white" alt="Coba Live Demo di WhatsApp"/>
  </a>
</p>
<p align="center">
  
</p>


---

## ✨ Fitur Utama

Bot ini dilengkapi dengan serangkaian fitur yang terbagi dalam beberapa kategori utama:

### 🛍️ Fitur Pengguna (Untuk Pelanggan)
* **Menu Utama & Bantuan (`!start`, `!bantuan`):** Panduan lengkap semua perintah yang tersedia.
* **Katalog & Belanja (`!katalog`, `!keranjang`):**
    * Lihat daftar produk interaktif.
    * Lihat detail produk lengkap dengan gambar.
    * Tambah produk ke keranjang belanja.
    * Lihat isi keranjang beserta total subtotal.
* **Manajemen Akun & Bonus (`!saldo`, `!klaim`, `!withdraw`):**
    * Cek saldo bonus.
    * Klaim bonus harian setiap 24 jam.
    * Ajukan permintaan penarikan saldo ke admin.
* **Riwayat Transaksi (`!riwayat`):** Lihat 5 riwayat pesanan dan penarikan terakhir.
* **Generator Konten AI (`!generator`):**
    * **Konten Cepat:** Buat pantun, ide konten sosial media, atau kutipan motivasi berdasarkan topik.
    * **Generator Storyboard:** Alur interaktif untuk membuat prompt gambar AI yang detail dengan meminta deskripsi karakter, pakaian, dan konsep cerita secara bertahap.
* **Chatbot AI Umum:** Berinteraksi dan mengobrol tentang apa saja dalam chat pribadi dengan AI Gemini 2.5 Flash.

### 👑 Fitur Admin (Khusus Pemilik Bot)
* **Notifikasi Real-time:** Dapatkan pemberitahuan langsung untuk setiap permintaan penarikan saldo baru.
* **Manajemen Transaksi (`!approve`, `!reject`):** Setujui atau tolak permintaan withdraw. Saldo akan otomatis dikembalikan jika ditolak.
* **Komunikasi Pelanggan (`!info`):** Kirim pesan atau update status terkait pesanan langsung ke pelanggan.

### 👥 Fitur Grup
* **Pesan Sambutan Otomatis:** Sambut anggota baru secara otomatis dengan mention saat mereka bergabung ke dalam grup.

---

## ❤️ Dukung & Donasi

Jika Anda merasa proyek ini bermanfaat, Anda dapat mendukung pengembangan lebih lanjut melalui beberapa cara:

**Ikuti Kami di Media Sosial:**
<p align="left">
  <a href="https://youtube.com/@sidhanie06" target="_blank"><img src="https://img.shields.io/badge/YouTube-%23FF0000.svg?style=for-the-badge&logo=YouTube&logoColor=white" alt="YouTube"/></a>
  <a href="https://facebook.com/sidhanie06" target="_blank"><img src="https://img.shields.io/badge/Facebook-%231877F2.svg?style=for-the-badge&logo=Facebook&logoColor=white" alt="Facebook"/></a>
  <a href="https://tiktok.com/@sidhanie" target="_blank"><img src="https://img.shields.io/badge/TikTok-%23000000.svg?style=for-the-badge&logo=tiktok&logoColor=white" alt="TikTok"/></a>
  <a href="https://sidhanie.my.id" target="_blank"><img src="https://img.shields.io/badge/Website-000000?style=for-the-badge&logo=world&logoColor=white" alt="Website"/></a>
</p>

**Donasi:**
Setiap donasi sangat berarti untuk menjaga proyek ini tetap hidup dan terus berkembang.

<a href="https://paypal.me/sidhanie" target="_blank">
  <img src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" alt="Donate with PayPal" />
</a>

**DANA (QRIS):**
![DANA QRIS](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgHwO_-Mp4mmE5tIQgvrs8ZzsUiKwMWROUa8XAMFdKpYGzqxAXR9ciCYRZ9LBt-i1ukxzhTVQw_mcKbCm5jzFe6vySjmowjplpTMJBwV5HVfETSH6WwqlWHY2BEn_rMJn4jXXRX5ylMRwDGPssCFolj5akwy1Ny-Y3_JHFQZK3Jdf4HzaFwuBRXqwcDVhI/s407/qris.jpg) <!-- Ganti dengan URL gambar QRIS DANA Anda -->

---

## 🏆 Sponsor

Terima kasih kepada para sponsor yang telah mendukung proyek ini!

*(Bagian ini dapat diisi dengan logo atau nama sponsor Anda)*

Ingin menjadi sponsor? [Hubungi kami!](mailto:altomediaindonesia@gmail.com)

---

## 🛠️ Prasyarat

Sebelum memulai instalasi, pastikan sistem Anda telah terpasang perangkat lunak berikut:
* **Node.js** (Versi 16 atau lebih tinggi)
* **Git** (Untuk mengkloning repositori)

---

## 📂 Struktur File Proyek

Pastikan Anda memiliki tiga file utama ini dalam satu folder:

/nama-folder-proyek├── server.js         # Logika utama bot├── package.json      # Daftar dependensi & skrip└── db.json           # Database untuk produk, user, dll.
---

## 🚀 Langkah-langkah Instalasi

Berikut adalah panduan instalasi detail untuk tiga platform berbeda.

### 1. Instalasi di Termux (Android)

1.  **Update & Upgrade Termux:**
    ```bash
    pkg update && pkg upgrade
    ```
2.  **Install Git & Node.js:**
    ```bash
    pkg install git nodejs -y
    ```
3.  **Kloning Repositori:**
    ```bash
    git clone https://github.com/kdsmedia/1406bot.git
    ```
    *(Ganti `kdsmedia` dan `1406bot` dengan milik Anda)*
4.  **Masuk ke Direktori Proyek:**
    ```bash
    cd 1406bot
    ```
5.  **Install Dependensi:**
    ```bash
    npm install
    ```
6.  **Jalankan Bot:**
    ```bash
    npm start
    ```
    Pindai QR code yang muncul di terminal menggunakan aplikasi WhatsApp Anda.

### 2. Instalasi di CMD (Windows)

1.  **Install Node.js & Git:**
    * Unduh dan install **Node.js** dari [situs resminya](https://nodejs.org/).
    * Unduh dan install **Git** dari [situs resminya](https://git-scm.com/).
2.  **Buka Command Prompt (CMD):**
    * Tekan `Win + R`, ketik `cmd`, lalu tekan Enter.
3.  **Kloning Repositori:**
    ```bash
    git clone https://github.com/kdsmedia/1406bot.git
    ```
4.  **Masuk ke Direktori Proyek:**
    ```bash
    cd 1406bot
    ```
5.  **Install Dependensi:**
    ```bash
    npm install
    ```
6.  **Jalankan Bot:**
    ```bash
    npm start
    ```
    Sebuah QR code akan muncul. Pindai menggunakan WhatsApp Anda.

### 3. Instalasi di VPS (Linux - Ubuntu/Debian)

1.  **Update Sistem:**
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
2.  **Install Git & Node.js:**
    ```bash
    sudo apt install git -y
    curl -sL [https://deb.nodesource.com/setup_18.x](https://deb.nodesource.com/setup_18.x) | sudo -E bash -
    sudo apt install nodejs -y
    ```
3.  **Kloning Repositori:**
    ```bash
    git clone https://github.com/kdsmedia/1406bot.git
    ```
4.  **Masuk ke Direktori Proyek & Install Dependensi:**
    ```bash
    cd 1406bot
    npm install
    ```
5.  **Jalankan Bot 24/7 dengan PM2:**
    * Install PM2 (Process Manager for Node.js):
        ```bash
        sudo npm install -g pm2
        ```
    * Mulai bot menggunakan PM2:
        ```bash
        pm2 start server.js --name "BotWhatsApp"
        ```
    * Untuk melihat QR code pertama kali, cek log:
        ```bash
        pm2 logs BotWhatsApp
        ```
    * Setelah memindai QR, hentikan log dengan `Ctrl + C`. Bot akan tetap berjalan di latar belakang.

---

## ⚙️ Konfigurasi

Sebelum menjalankan bot, buka file `server.js` dan isi semua konstanta di bagian **KONFIGURASI PENTING**:

```javascript
// --- KONFIGURASI PENTING (WAJIB DIISI!) ---
const ADMIN_WID = '6281234567890@c.us'; // Ganti dengan nomor WhatsApp Anda
const QRIS_IMAGE_URL = '[https://i.imgur.com/your-qris.jpg](https://i.imgur.com/your-qris.jpg)'; // Ganti dengan URL gambar QRIS
const RAJAONGKIR_API_KEY = 'API_KEY_RAJAONGKIR_ANDA'; // Ganti dengan API Key RajaOngkir
const SHOP_ORIGIN_SUBDISTRICT_ID = '2276'; // Ganti dengan ID Kecamatan asal pengiriman
const GEMINI_API_KEY = 'API_KEY_GEMINI_ANDA'; // Ganti dengan API Key Google Gemini
ADMIN_WID: Nomor WhatsApp Anda dalam format internasional, diakhiri dengan @c.us.GEMINI_API_KEY: Kunci API dari Google AI Studio.RAJAONGKIR_API_KEY: Kunci API dari situs RajaOngkir (bisa tipe Starter/Gratis).Anda juga bisa menambahkan produk awal dengan mengedit array products di dalam file db.json.▶️ Menjalankan BotSetelah instalasi dan konfigurasi selesai, jalankan bot dengan perintah:npm start
Atau jika menggunakan PM2 di VPS:pm2 restart BotWhatsApp
🤝 KontribusiKontribusi, isu, dan permintaan fitur sangat kami hargai! Jangan ragu untuk membuat pull request atau membuka issue baru.⚠️ DisclaimerProyek ini dibagikan untuk tujuan edukasi dan portofolio. Dilarang keras untuk menjual kembali, mengubah, atau mendistribusikan ulang kode ini dalam bentuk apapun tanpa izin tertulis dari pembuat asli, ALTOMEDIA.Segala bentuk penyalahgunaan atau pelanggaran terhadap ketentuan ini akan ditindaklanjuti.📜 LisensiProyek ini dilisensikan di bawah Lisensi MIT.</markdown>
