# Stok Bumbu Dapur V2 — Multi-Device

Versi ini mempertahankan localStorage sebagai cache/offline dan menambahkan Firebase Firestore sebagai cloud database.

## File
- index.html
- style.css
- app.js

## Cara mengaktifkan multi-device
1. Buat project di Firebase Console.
2. Aktifkan Firestore Database.
3. Dari Project settings > Your apps > Web app, salin Firebase config.
4. Buka aplikasi, menu **Cloud / Multi-Device**.
5. Masukkan API Key, Auth Domain, Project ID, Storage Bucket, Messaging Sender ID, App ID.
6. Klik **Aktifkan Cloud**.
7. Buka aplikasi yang sama dari perangkat lain dan masukkan konfigurasi Firebase yang sama.

## Penting: keamanan Firestore
Versi ini memakai satu dokumen bersama `stokBumbuDapur/main` agar sederhana. Untuk penggunaan publik/produksi, tambahkan Firebase Authentication dan Firestore Security Rules sehingga hanya pengguna yang berwenang yang dapat membaca/menulis.

## Data lama
Data localStorage tetap dipertahankan. Saat cloud pertama kali diaktifkan:
- jika dokumen cloud belum ada, data lokal di-upload;
- jika dokumen cloud sudah ada, data cloud menjadi sumber data dan menimpa cache lokal.

Backup JSON tetap dapat digunakan melalui menu Backup/Restore.
