const STORAGE_KEY = "stokBumbuDapur_v2";
const FIREBASE_CONFIG_KEY = "stokBumbuFirebaseConfig_v1";
let cloud = { enabled:false, db:null, app:null, auth:null, unsub:null };
const seed = {
  bumbu: [
    {id:"1",kode:"BMB001",nama:"Bawang Merah",satuan:"Kg",min:5,stok:25},
    {id:"2",kode:"BMB002",nama:"Bawang Putih",satuan:"Kg",min:5,stok:18},
    {id:"3",kode:"BMB003",nama:"Cabai Merah",satuan:"Kg",min:8,stok:12},
    {id:"4",kode:"BMB004",nama:"Merica",satuan:"Kg",min:3,stok:3},
    {id:"5",kode:"BMB005",nama:"Ketumbar",satuan:"Kg",min:3,stok:7}
  ],
  transaksi: []
};

let db = loadDB();
const $ = id => document.getElementById(id);
const today = new Date().toLocaleDateString("en-CA");
$("masukTanggal").value = today;
$("keluarTanggal").value = today;

function loadDB(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seed); }
  catch(e){ return structuredClone(seed); }
}
async function saveDB(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  renderAll();
  if(cloud.enabled) await cloudSave();
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function esc(v){ return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function fmt(n){ return Number(n).toLocaleString("id-ID",{maximumFractionDigits:2}); }
function showToast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }

function navigate(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===page));
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const titles={dashboard:"Dashboard",master:"Master Bumbu",masuk:"Stok Masuk",keluar:"Stok Keluar",riwayat:"Riwayat Transaksi",laporan:"Laporan",pengaturan:"Cloud / Multi-Device"};
  $("pageTitle").textContent=titles[page]||"Dashboard";
  document.querySelector(".sidebar").classList.remove("open");
}
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));
$("mobileMenu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
$("quickMasuk").onclick=()=>navigate("masuk");
$("quickKeluar").onclick=()=>navigate("keluar");

function status(b){
  const stok=Number(b.stok), min=Number(b.min);
  if(stok<=0) return ["Habis","empty"];
  if(stok<=min) return ["Menipis","low"];
  return ["Aman","safe"];
}
function renderDashboard(){
  $("totalJenis").textContent=db.bumbu.length;
  $("totalStok").textContent=fmt(db.bumbu.reduce((a,b)=>a+Number(b.stok),0));
  $("totalMasuk").textContent=fmt(db.transaksi.filter(t=>t.jenis==="masuk").reduce((a,t)=>a+Number(t.jumlah),0));
  $("totalKeluar").textContent=fmt(db.transaksi.filter(t=>t.jenis==="keluar").reduce((a,t)=>a+Number(t.jumlah),0));
  const low=db.bumbu.filter(b=>Number(b.stok)<=Number(b.min));
  $("stockAlert").innerHTML=low.length?low.map(b=>{let s=status(b);return `<div class="alert-row"><div><div class="item-name">${esc(b.nama)}</div><div class="sub">${esc(b.kode)} · minimum ${fmt(b.min)} ${esc(b.satuan)}</div></div><span class="badge ${s[1]}">${s[0]} · ${fmt(b.stok)} ${esc(b.satuan)}</span></div>`}).join(""):`<div class="empty">🎉 Semua stok berada di atas batas minimum.</div>`;
  const tx=[...db.transaksi].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  $("recentTransactions").innerHTML=tx.length?tx.map(t=>`<div class="transaction-row"><div><div class="item-name">${t.jenis==="masuk"?"📥":"📤"} ${esc(t.nama)}</div><div class="sub">${esc(t.tanggal)} · ${esc(t.keterangan||"Tanpa keterangan")}</div></div><strong>${t.jenis==="masuk"?"+":"−"}${fmt(t.jumlah)} ${esc(t.satuan)}</strong></div>`).join(""):`<div class="empty">Belum ada transaksi.</div>`;
}
function renderMaster(){
  const q=($("masterSearch").value||"").toLowerCase();
  const rows=db.bumbu.filter(b=>(b.kode+" "+b.nama).toLowerCase().includes(q));
  $("masterBody").innerHTML=rows.length?rows.map(b=>{let s=status(b);return `<tr><td><b>${esc(b.kode)}</b></td><td>${esc(b.nama)}</td><td>${esc(b.satuan)}</td><td>${fmt(b.min)}</td><td><b>${fmt(b.stok)}</b></td><td><span class="badge ${s[1]}">${s[0]}</span></td><td><div class="actions"><button class="icon-btn" onclick="editBumbu('${b.id}')">✏️</button><button class="icon-btn delete" onclick="deleteBumbu('${b.id}')">🗑️</button></div></td></tr>`}).join(""):`<tr><td colspan="7" class="empty">Data bumbu tidak ditemukan.</td></tr>`;
  $("kodeList").innerHTML=db.bumbu.map(b=>`<option value="${esc(b.kode)}">${esc(b.nama)}</option>`).join("");
}
function renderHistory(){
  const q=($("historySearch").value||"").toLowerCase(), type=$("historyType").value;
  const rows=[...db.transaksi].sort((a,b)=>b.createdAt-a.createdAt).filter(t=>(!type||t.jenis===type)&&(t.kode+" "+t.nama+" "+(t.keterangan||"")).toLowerCase().includes(q));
  $("historyBody").innerHTML=rows.length?rows.map(t=>`<tr><td>${esc(t.tanggal)}</td><td><span class="badge ${t.jenis==="masuk"?"safe":"low"}">${t.jenis==="masuk"?"MASUK":"KELUAR"}</span></td><td>${esc(t.kode)}</td><td>${esc(t.nama)}</td><td><b>${fmt(t.jumlah)}</b></td><td>${esc(t.satuan)}</td><td>${esc(t.keterangan||"-")}</td><td><button class="icon-btn delete" onclick="deleteTransaksi('${t.id}')">🗑️</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">Belum ada transaksi.</td></tr>`;
}
function renderAll(){renderDashboard();renderMaster();renderHistory();}

function openModal(b=null){
  $("modalTitle").textContent=b?"Edit Bumbu":"Tambah Bumbu";
  $("editId").value=b?.id||"";
  $("bumbuKode").value=b?.kode||"";
  $("bumbuNama").value=b?.nama||"";
  $("bumbuSatuan").value=b?.satuan||"Kg";
  $("bumbuMin").value=b?.min??1;
  $("bumbuStok").value=b?.stok??0;
  $("bumbuKode").disabled=!!b;
  $("modalBackdrop").classList.add("show");
}
function closeModal(){ $("modalBackdrop").classList.remove("show"); }
$("addBumbuBtn").onclick=()=>openModal();
$("closeModal").onclick=closeModal;
$("cancelModal").onclick=closeModal;

$("bumbuForm").onsubmit=e=>{
  e.preventDefault();
  const id=$("editId").value, kode=$("bumbuKode").value.trim().toUpperCase(), nama=$("bumbuNama").value.trim();
  if(!id && db.bumbu.some(b=>b.kode.toUpperCase()===kode)){showToast("Kode bumbu sudah digunakan.");return;}
  const data={kode,nama,satuan:$("bumbuSatuan").value,min:Number($("bumbuMin").value),stok:Number($("bumbuStok").value)};
  if(id){Object.assign(db.bumbu.find(b=>b.id===id),data);showToast("Data bumbu diperbarui.");}
  else {db.bumbu.push({id:uid(),...data});showToast("Bumbu berhasil ditambahkan.");}
  closeModal();saveDB();
};
window.editBumbu=id=>openModal(db.bumbu.find(b=>b.id===id));
window.deleteBumbu=id=>{
  const b=db.bumbu.find(x=>x.id===id);
  if(!b)return;
  if(!confirm(`Hapus bumbu "${b.nama}"?`))return;
  db.bumbu=db.bumbu.filter(x=>x.id!==id); saveDB(); showToast("Bumbu dihapus.");
};
window.deleteTransaksi=id=>{
  const t=db.transaksi.find(x=>x.id===id);
  if(!t)return;
  if(!confirm("Hapus transaksi ini? Stok akan dikembalikan seperti sebelum transaksi."))return;
  const b=db.bumbu.find(x=>x.kode===t.kode);
  if(b) b.stok += t.jenis==="masuk" ? -Number(t.jumlah) : Number(t.jumlah);
  db.transaksi=db.transaksi.filter(x=>x.id!==id); saveDB(); showToast("Transaksi dihapus.");
};

function bindCode(prefix){
  const code=$(prefix+"Kode").value.trim().toUpperCase();
  const b=db.bumbu.find(x=>x.kode.toUpperCase()===code);
  $(prefix+"Nama").value=b?b.nama:"";
  $(prefix+"Satuan").value=b?b.satuan:"";
}
$("masukKode").oninput=()=>bindCode("masuk");
$("keluarKode").oninput=()=>bindCode("keluar");

function submitTrans(prefix,jenis){
  const kode=$(prefix+"Kode").value.trim().toUpperCase(), b=db.bumbu.find(x=>x.kode.toUpperCase()===kode), jumlah=Number($(prefix+"Jumlah").value);
  if(!b){showToast("Kode bumbu tidak ditemukan.");return false;}
  if(!jumlah||jumlah<=0){showToast("Jumlah harus lebih dari 0.");return false;}
  if(jenis==="keluar" && jumlah>b.stok){showToast(`Stok tidak cukup. Stok tersedia ${fmt(b.stok)} ${b.satuan}.`);return false;}
  b.stok += jenis==="masuk"?jumlah:-jumlah;
  db.transaksi.push({id:uid(),tanggal:$(prefix+"Tanggal").value,jenis,kode:b.kode,nama:b.nama,jumlah,satuan:b.satuan,keterangan:$(prefix+"Keterangan").value.trim(),createdAt:Date.now()});
  saveDB(); $(prefix+"Form").reset(); $(prefix+"Tanggal").value=today; showToast(jenis==="masuk"?"Stok masuk tersimpan.":"Stok keluar tersimpan."); return true;
}
$("masukForm").onsubmit=e=>{e.preventDefault();submitTrans("masuk","masuk")};
$("keluarForm").onsubmit=e=>{e.preventDefault();submitTrans("keluar","keluar")};

$("masterSearch").oninput=renderMaster;
$("historySearch").oninput=renderHistory;
$("historyType").onchange=renderHistory;

$("backupBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="backup-stok-bumbu-"+today+".json";a.click();URL.revokeObjectURL(a.href);
  showToast("Backup data dibuat.");
};
$("restoreInput").onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const x=JSON.parse(reader.result);
      if(!Array.isArray(x.bumbu)||!Array.isArray(x.transaksi))throw Error();
      if(confirm("Restore akan mengganti data saat ini. Lanjutkan?")){db=x;saveDB();showToast("Data berhasil dipulihkan.");}
    }catch(err){alert("File backup tidak valid.");}
    e.target.value="";
  };reader.readAsText(file);
};
$("resetBtn").onclick=()=>{
  if(confirm("Reset SEMUA data bumbu dan transaksi? Data yang tersimpan saat ini akan hilang.")){
    db=structuredClone(seed);saveDB();showToast("Data dikembalikan ke data awal.");
  }
};
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

/* ===================== AUTH + CLOUD / FIREBASE ===================== */
let authUser = null;
let authReady = false;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-i_X27dw9U8ei5Bnfgp1Qp_L8MUXo5Ek",
  authDomain: "stok-bumbu-dapur.firebaseapp.com",
  projectId: "stok-bumbu-dapur",
  storageBucket: "stok-bumbu-dapur.firebasestorage.app",
  messagingSenderId: "451573124577",
  appId: "1:451573124577:web:2a380e92be88ed522796a0"
};

function setSyncStatus(text, cls=""){
  const el=$("syncStatus"); if(!el)return;
  el.textContent=text; el.className="sync-status "+cls;
}

function injectAuthStyles(){
  if($("authStyles")) return;
  const s=document.createElement("style");
  s.id="authStyles";
  s.textContent=`
    body.auth-locked > *:not(#authScreen){visibility:hidden}
    #authScreen{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eef8f1,#f7faf8);padding:20px;font-family:inherit}
    .auth-card{width:min(430px,100%);box-sizing:border-box;background:#fff;border:1px solid #dce7df;border-radius:22px;padding:30px;box-shadow:0 18px 50px rgba(0,0,0,.10)}
    .auth-brand{display:flex;align-items:center;gap:14px;margin-bottom:24px}
    .auth-logo{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:#e3f2e8;font-size:28px}
    .auth-card h2{margin:0 0 6px;font-size:26px}
    .auth-card p{margin:0;color:#6d7b73}
    .auth-field{display:block;margin-top:17px;font-weight:600;font-size:14px}
    .auth-field input{width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:1px solid #cfdcd4;border-radius:11px;font-size:15px;outline:none}
    .auth-field input:focus{border-color:#27784f;box-shadow:0 0 0 3px rgba(39,120,79,.10)}
    .auth-password{position:relative}.auth-password input{padding-right:48px}
    .auth-eye{position:absolute;right:9px;bottom:7px;border:0;background:transparent;cursor:pointer;font-size:18px;padding:7px}
    .auth-submit{width:100%;margin-top:22px;border:0;border-radius:11px;padding:13px;background:#27784f;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
    .auth-submit:disabled{opacity:.65;cursor:wait}
    .auth-error{display:none;margin-top:14px;padding:11px 12px;border-radius:10px;background:#fff0f0;color:#b42318;font-size:13px}
    .auth-user{display:flex;align-items:center;gap:8px;margin-left:8px;color:#425248;font-size:13px}
    .auth-user button{border:1px solid #d6e1da;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}
    @media(max-width:700px){.auth-card{padding:24px}.auth-user{display:none}}
  `;
  document.head.appendChild(s);
}

function createAuthScreen(){
  injectAuthStyles();
  if($("authScreen")) return;
  const el=document.createElement("div");
  el.id="authScreen";
  el.innerHTML=`
    <div class="auth-card">
      <div class="auth-brand">
        <div class="auth-logo">🌿</div>
        <div><h2>Stok Bumbu</h2><p>Masuk untuk mengakses aplikasi</p></div>
      </div>
      <form id="loginForm">
        <label class="auth-field">Email
          <input id="loginEmail" type="email" autocomplete="username" placeholder="nama@email.com" required>
        </label>
        <label class="auth-field auth-password">Password
          <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Masukkan password" required>
          <button class="auth-eye" id="togglePassword" type="button" aria-label="Tampilkan password">👁️</button>
        </label>
        <div class="auth-error" id="loginError"></div>
        <button class="auth-submit" id="loginSubmit" type="submit">🔐 Masuk</button>
      </form>
    </div>`;
  document.body.appendChild(el);

  $("togglePassword").onclick=()=>{
    const p=$("loginPassword");
    p.type=p.type==="password"?"text":"password";
    $("togglePassword").textContent=p.type==="password"?"👁️":"🙈";
  };
}

function setLoginError(msg){
  const el=$("loginError"); if(!el)return;
  el.textContent=msg||""; el.style.display=msg?"block":"none";
}

function showAuthScreen(show){
  createAuthScreen();
  $("authScreen").style.display=show?"flex":"none";
  document.body.classList.toggle("auth-locked",show);
}

function addUserControls(){
  const top=document.querySelector(".top-actions");
  if(!top || $("authUserBox")) return;
  const box=document.createElement("div");
  box.className="auth-user"; box.id="authUserBox";
  box.innerHTML=`<span id="authUserEmail"></span><button id="logoutBtn" type="button">🚪 Keluar</button>`;
  top.prepend(box);
  $("logoutBtn").onclick=async()=>{
    try{
      const {signOut}=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      await signOut(cloud.auth);
    }catch(err){console.error(err);showToast("Gagal keluar.");}
  };
}

async function startFirestore(user){
  try{
    const {getFirestore,doc,getDoc,setDoc,onSnapshot}=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
    cloud.db=getFirestore(cloud.app); cloud.enabled=true;
    setSyncStatus("🟢 Cloud aktif","online");

    const ref=doc(cloud.db,"stokBumbuDapur","main");
    const snap=await getDoc(ref);

    if(snap.exists()){
      const remote=snap.data();
      if(Array.isArray(remote.bumbu)&&Array.isArray(remote.transaksi)){
        db={bumbu:remote.bumbu,transaksi:remote.transaksi};
        localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
        renderAll();
      }
    }else{
      await setDoc(ref,{...db,updatedAt:Date.now(),updatedBy:user.uid});
    }

    if(cloud.unsub) cloud.unsub();
    cloud.unsub=onSnapshot(ref,s=>{
      if(!s.exists())return;
      const remote=s.data();
      if(Array.isArray(remote.bumbu)&&Array.isArray(remote.transaksi)){
        db={bumbu:remote.bumbu,transaksi:remote.transaksi};
        localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
        renderAll();
      }
    },err=>{
      console.error(err); setSyncStatus("🔴 Cloud error","error");
      showToast("Gagal membaca Cloud. Periksa Security Rules.");
    });

    showToast("Login berhasil. Sinkronisasi aktif.");
  }catch(err){
    console.error(err); cloud.enabled=false; cloud.db=null;
    setSyncStatus("🔴 Cloud error","error");
    showToast("Login berhasil, tetapi Firestore gagal diakses.");
  }
}

async function initFirebaseAuth(){
  try{
    const {initializeApp,getApps}=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
    const {getAuth,onAuthStateChanged,signInWithEmailAndPassword}=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");

    cloud.app=getApps().length?getApps()[0]:initializeApp(FIREBASE_CONFIG);
    cloud.auth=getAuth(cloud.app);
    createAuthScreen();

    $("loginForm").onsubmit=async e=>{
      e.preventDefault(); setLoginError("");
      const btn=$("loginSubmit"); btn.disabled=true; btn.textContent="⏳ Memproses...";
      try{
        await signInWithEmailAndPassword(cloud.auth,$("loginEmail").value.trim(),$("loginPassword").value);
      }catch(err){
        console.error(err);
        const messages={
          "auth/invalid-credential":"Email atau password salah.",
          "auth/invalid-email":"Format email tidak valid.",
          "auth/user-disabled":"Akun ini dinonaktifkan.",
          "auth/too-many-requests":"Terlalu banyak percobaan. Coba lagi beberapa saat."
        };
        setLoginError(messages[err?.code]||"Login gagal. Periksa email dan password.");
      }finally{
        btn.disabled=false; btn.textContent="🔐 Masuk";
      }
    };

    onAuthStateChanged(cloud.auth,async user=>{
      authUser=user;
      if(user){
        showAuthScreen(false);
        addUserControls();
        $("authUserEmail").textContent=user.email||"Pengguna";
        await startFirestore(user);
      }else{
        if(cloud.unsub){cloud.unsub();cloud.unsub=null;}
        cloud.enabled=false; cloud.db=null;
        setSyncStatus("🔒 Login diperlukan","local");
        showAuthScreen(true);
      }
    });
  }catch(err){
    console.error(err);
    showAuthScreen(true);
    setLoginError("Firebase Authentication gagal dimuat. Periksa koneksi internet.");
  }
}

async function cloudSave(){
  if(!cloud.enabled||!cloud.db||!authUser)return;
  try{
    const {doc,setDoc}=await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
    await setDoc(doc(cloud.db,"stokBumbuDapur","main"),{...db,updatedAt:Date.now(),updatedBy:authUser.uid});
    setSyncStatus("🟢 Tersinkron","online");
  }catch(err){
    console.error(err); setSyncStatus("🔴 Belum tersimpan","error");
    showToast("Data tersimpan lokal, tetapi gagal sinkron ke Cloud.");
  }
}

function fillFirebaseForm(){
  const c=FIREBASE_CONFIG;
  if($("fbApiKey"))$("fbApiKey").value=c.apiKey||"";
  if($("fbAuthDomain"))$("fbAuthDomain").value=c.authDomain||"";
  if($("fbProjectId"))$("fbProjectId").value=c.projectId||"";
  if($("fbStorageBucket"))$("fbStorageBucket").value=c.storageBucket||"";
  if($("fbMessagingSenderId"))$("fbMessagingSenderId").value=c.messagingSenderId||"";
  if($("fbAppId"))$("fbAppId").value=c.appId||"";
}

function useLocalMode(){
  showToast("Mode lokal dinonaktifkan. Silakan login untuk menggunakan aplikasi.");
  showAuthScreen(true);
}

$("firebaseForm").onsubmit=e=>{
  e.preventDefault();
  showToast("Konfigurasi Firebase sudah tersimpan di aplikasi.");
};
$("useLocalBtn").onclick=useLocalMode;

/* ===================== REPORT ===================== */
function renderReport(){
  const from=$("reportFrom")?.value||"0000-01-01", to=$("reportTo")?.value||"9999-12-31";
  const rows=db.bumbu.map(b=>{
    const tx=db.transaksi.filter(t=>t.kode===b.kode && t.tanggal>=from && t.tanggal<=to);
    const masuk=tx.filter(t=>t.jenis==="masuk").reduce((a,t)=>a+Number(t.jumlah),0);
    const keluar=tx.filter(t=>t.jenis==="keluar").reduce((a,t)=>a+Number(t.jumlah),0);
    const s=status(b);
    return `<tr><td>${esc(b.kode)}</td><td>${esc(b.nama)}</td><td>${esc(b.satuan)}</td><td><b>${fmt(b.stok)}</b></td><td>${fmt(masuk)}</td><td>${fmt(keluar)}</td><td><span class="badge ${s[1]}">${s[0]}</span></td></tr>`;
  });
  $("reportBody").innerHTML=rows.join("")||`<tr><td colspan="7" class="empty">Tidak ada data.</td></tr>`;
}
function csvEscape(v){return '"'+String(v??"").replace(/"/g,'""')+'"';}
function exportReportCsv(){
  const from=$("reportFrom").value,to=$("reportTo").value;
  const lines=[["Kode","Bumbu","Satuan","Stok Saat Ini","Masuk Periode","Keluar Periode","Status"]];
  db.bumbu.forEach(b=>{
    const tx=db.transaksi.filter(t=>t.kode===b.kode&&t.tanggal>=from&&t.tanggal<=to);
    const masuk=tx.filter(t=>t.jenis==="masuk").reduce((a,t)=>a+Number(t.jumlah),0);
    const keluar=tx.filter(t=>t.jenis==="keluar").reduce((a,t)=>a+Number(t.jumlah),0);
    lines.push([b.kode,b.nama,b.satuan,b.stok,masuk,keluar,status(b)[0]]);
  });
  const csv="\ufeff"+lines.map(r=>r.map(csvEscape).join(";")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`laporan-stok-${today}.csv`;a.click();URL.revokeObjectURL(a.href);
}
$("generateReportBtn").onclick=renderReport;
$("exportCsvBtn").onclick=exportReportCsv;
$("printReportBtn").onclick=()=>window.print();

/* ===================== BOOTSTRAP ===================== */
$("reportFrom").value=today;
$("reportTo").value=today;
renderAll();
fillFirebaseForm();
injectAuthStyles();
createAuthScreen();
showAuthScreen(true);
initFirebaseAuth();
