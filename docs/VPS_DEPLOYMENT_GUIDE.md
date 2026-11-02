# 🚀 Panduan Deployment VPS & GitHub — CeritaObim Studio

Panduan ini berisi langkah-langkah memasang CeritaObim Studio di server VPS (Ubuntu/Debian) atau mengunggahnya ke GitHub dengan aman.

---

## 1. Persiapan GitHub (Aman Tanpa Kebocoran Secret)

Sistem sudah dikonfigurasi dengan `.gitignore` yang ketat. File rahasia seperti `.env.local`, folder `.data/media/`, dan `00.FolderOwner/` tidak akan pernah terdorong ke GitHub.

### Langkah Push ke GitHub:
```bash
# 1. Inisialisasi repo (jika belum)
git add .
git commit -m "feat: modern minimal UI, buffer auto-publish, tools hub, and vps readiness"

# 2. Hubungkan ke GitHub remote repository Anda
git remote add origin https://github.com/USERNAME/ceritaobim-studio.git
git branch -M main
git push -u origin main
```

---

## 2. Pilihan Deployment di VPS

Rekomendasi spesifikasi VPS:
- **OS:** Ubuntu 22.04 LTS atau 24.04 LTS
- **RAM:** Minimal 2 GB (Disarankan 4 GB untuk rendering FFmpeg)
- **Disk:** Minimal 20 GB SSD

---

### Cara A: Menggunakan Docker & Docker Compose (Paling Mudah)

1. **Install Docker & Docker Compose di VPS:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. **Clone Repository & Konfigurasi ENV:**
   ```bash
   git clone https://github.com/USERNAME/ceritaobim-studio.git
   cd ceritaobim-studio
   cp .env.example .env.local
   nano .env.local  # Masukkan BUFFER_ACCESS_TOKEN, LLM_API_KEY, dll.
   ```

3. **Jalankan Aplikasi:**
   ```bash
   docker compose up -d --build
   ```
   *Aplikasi akan langsung berjalan di latar belakang pada port 3000.*

---

### Cara B: Menggunakan Node.js 20 & PM2 (Native)

1. **Install Node.js 20 & FFmpeg di VPS:**
   ```bash
   sudo apt update && sudo apt install -y curl git ffmpeg
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

2. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/USERNAME/ceritaobim-studio.git
   cd ceritaobim-studio
   npm ci
   cp .env.example .env.local
   nano .env.local
   ```

3. **Build & Jalankan via PM2:**
   ```bash
   npm run build
   pm2 start npm --name "ceritaobim-studio" -- start
   pm2 save
   pm2 startup
   ```

---

## 3. Konfigurasi Domain & SSL Gratis (Nginx + Certbot)

Agar aplikasi dapat diakses melalui domain Anda (misal `https://studio.ceritaobim.com`):

1. **Install Nginx:**
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Buat file konfigurasi Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/ceritaobim
   ```
   *Isi dengan:*
   ```nginx
   server {
       server_name studio.ceritaobim.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           client_max_body_size 100M;
       }
   }
   ```

3. **Aktifkan Konfigurasi & Pasang SSL:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/ceritaobim /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   sudo certbot --nginx -d studio.ceritaobim.com
   ```

Setelah langkah ini selesai, studio Anda aktif 24/7 di domain publik dengan HTTPS resmi!
