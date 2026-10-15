(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID")
    && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  let supabase = null, currentUser = null, mode = "login", entries = [], settings = null, noteText = "";
  const money = (n) => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
  const dateFmt = (s, options={day:"numeric",month:"short",year:"numeric"}) => new Intl.DateTimeFormat("id-ID", options).format(new Date(s+"T12:00:00"));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const mondayFor = (date = new Date()) => {
    const d = new Date(date); d.setHours(12,0,0,0);
    const day = d.getDay(); d.setDate(d.getDate() - ((day + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const thisMonday = mondayFor();
  const setMessage = (id, msg, good=false) => { const el=$(id); if(el){el.textContent=msg;el.style.color=good?"#4e9b77":"#c84e7d";} };
  const setConnection = (label, state="") => { $("connectionStatus").innerHTML = `<i></i> ${esc(label)}`; $("connectionStatus").className = `status-pill ${state}`; };
  const showAuth = () => {$("authSection").classList.remove("hidden");$("appSection").classList.add("hidden");$("logoutBtn").classList.add("hidden");};
  const showApp = () => {$("authSection").classList.add("hidden");$("appSection").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");};
  const ownEntry = (week=thisMonday) => entries.find(e=>e.week_start===week && e.user_id===currentUser.id);
  const partnerEntries = () => entries.filter(e=>e.user_id!==currentUser.id);
  const nameFor = (uid) => {
    if(uid===currentUser?.id) return settings?.my_name || currentUser?.email?.split("@")[0] || "Kamu";
    return settings?.partner_name || "Pasangan";
  };
  const render = () => {
    const my = entries.filter(e=>e.user_id===currentUser.id);
    const partner = partnerEntries();
    const mySum = my.reduce((s,e)=>s+Number(e.amount),0), partnerSum = partner.reduce((s,e)=>s+Number(e.amount),0);
    const total = mySum+partnerSum, target=Number(cfg.TARGET_AMOUNT||1000000), pct=Math.min(100,Math.round(total/target*100));
    $("totalAmount").textContent=money(total);$("myTotal").textContent=money(mySum);$("partnerTotal").textContent=money(partnerSum);
    $("progressLabel").textContent=`${pct}% dari target`;$("remainingAmount").textContent=total>=target?"Target tercapai! ♡":`Sisa ${money(target-total)}`;
    $("progressBar").style.width=`${pct}%`;$("goalProgressBar").style.width=`${pct}%`;
    $("myName").textContent=settings?.my_name||"Tabungan kamu";$("partnerName").textContent=settings?.partner_name||"Tabungan pasangan";
    $("myWeeks").textContent=`${my.length} setoran`; $("partnerWeeks").textContent=`${partner.length} setoran`;
    $("depositMyName").textContent=nameFor(currentUser.id);$("depositPartnerName").textContent=settings?.partner_name||"Pasangan";
    const me=ownEntry(); const partnerEntry=entries.find(e=>e.week_start===thisMonday&&e.user_id!==currentUser.id);
    $("myDepositStatus").textContent=me?`Sudah dicatat · ${dateFmt(me.created_at.slice(0,10))}`:"Belum dicatat minggu ini";
    $("partnerDepositStatus").textContent=partnerEntry?"Sudah dicatat minggu ini":"Menunggu pasangan";
    $("depositMeBtn").disabled=!!me;$("depositMeBtn").textContent=me?"Tercatat ✓":"Catat";
    $("partnerStatusPill").textContent=partnerEntry?"Selesai ✓":"Menunggu";$("partnerStatusPill").className=partnerEntry?"done-pill":"pending-pill";
    $("weeksTogether").textContent=new Set(entries.map(e=>e.week_start)).size;
    $("goalEta").textContent=Math.max(0,Math.ceil((target-total)/(2*Number(cfg.WEEKLY_AMOUNT_PER_PERSON||25000))));
    $("goalHint").textContent=total>=target?"Yeay! Kalian berhasil mencapai target bersama. ♡":"Kalian pasti bisa, satu Senin demi satu Senin. ♡";
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const todayShort = new Intl.DateTimeFormat("id-ID",{weekday:"short"}).format(today).replace(/[.]/g,"").toUpperCase();
    $("currentDayLabel").textContent=todayShort;
    $("currentWeekBadge").textContent=`Hari ini · ${dateFmt(todayISO,{day:"numeric",month:"short"})}`;
    $("nextMondayDay").textContent=today.getDate();
    const nextDepositMonday = new Date(thisMonday+"T12:00:00");
    if(today.getDay()!==1) nextDepositMonday.setDate(nextDepositMonday.getDate()+7);
    const nextDepositISO = `${nextDepositMonday.getFullYear()}-${String(nextDepositMonday.getMonth()+1).padStart(2,"0")}-${String(nextDepositMonday.getDate()).padStart(2,"0")}`;
    $("weekDateText").textContent = today.getDay()===1
      ? `Hari ini ${dateFmt(todayISO,{weekday:"long",day:"numeric",month:"short"})} · jadwal setoran mingguan.`
      : `Hari ini ${dateFmt(todayISO,{weekday:"long",day:"numeric",month:"short"})} · setoran berikutnya Senin, ${dateFmt(nextDepositISO,{day:"numeric",month:"short"})}.`;
    $("myDisplayName").value=settings?.my_name||"";$("partnerDisplayName").value=settings?.partner_name||"";$("photoUrlInput").value=settings?.photo_url||"";
    $("coupleNote").value=noteText;
    const photo=$("couplePhoto");
    const defaultCouplePhoto="Screenshot%202026-10-14%20000037.png";
    if(settings?.photo_url){
      photo.innerHTML=`<img src="${esc(settings.photo_url)}" alt="Our favorite team" class="couple-photo-image" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='Screenshot%202026-10-14%20000037.png';">`;
    } else {
      photo.innerHTML=`<img src="${defaultCouplePhoto}" alt="Our favorite team" class="couple-photo-image">`;
    }
    renderHistory();
  };
  const renderHistory = () => {
    const filter=$("historyFilter").value;
    let list=[...entries].sort((a,b)=>b.week_start.localeCompare(a.week_start)||b.created_at.localeCompare(a.created_at));
    if(filter==="mine")list=list.filter(e=>e.user_id===currentUser.id);
    if(filter==="partner")list=list.filter(e=>e.user_id!==currentUser.id);
    if(!list.length){$("historyList").innerHTML='<div class="empty-state">Belum ada catatan untuk filter ini. Setoran pertama kalian akan muncul di sini. ♡</div>';return;}
    $("historyList").innerHTML=list.map(e=>{
      const d=new Date(e.week_start+"T12:00:00");
      return `<div class="history-item"><div class="history-date"><b>${d.getDate()}</b><span>${new Intl.DateTimeFormat("id-ID",{month:"short"}).format(d).toUpperCase()}</span></div><div class="history-details"><b>${esc(nameFor(e.user_id))} menabung ♡</b><small>Pekan mulai ${dateFmt(e.week_start)} · dicatat ${dateFmt(e.created_at.slice(0,10))}</small></div><div class="history-value">+${money(e.amount)}<small>${e.user_id===currentUser.id?"Setoran kamu":"Setoran pasangan"}</small></div></div>`;
    }).join("");
  };
  async function loadData(){
    setConnection("Menyinkronkan...");
    const [entriesRes, settingsRes, noteRes] = await Promise.all([
      supabase.from("savings_entries").select("*").eq("couple_id",cfg.COUPLE_ID).order("week_start",{ascending:false}),
      supabase.from("couple_settings").select("*").eq("couple_id",cfg.COUPLE_ID).maybeSingle(),
      supabase.from("couple_notes").select("*").eq("couple_id",cfg.COUPLE_ID).maybeSingle()
    ]);
    const err=[entriesRes.error,settingsRes.error,noteRes.error].find(Boolean);
    if(err) throw err;
    entries=entriesRes.data||[];settings=settingsRes.data||null;noteText=noteRes.data?.note||"";
    render();setConnection("Tersinkron online","online");$("syncText").textContent="Data tersinkron online";
  }
  async function deposit(){
    if(ownEntry()){setMessage("journalMessage","Setoranmu untuk minggu ini sudah tercatat.");return;}
    $("depositMeBtn").disabled=true;
    const {error}=await supabase.from("savings_entries").insert({couple_id:cfg.COUPLE_ID,user_id:currentUser.id,week_start:thisMonday,amount:Number(cfg.WEEKLY_AMOUNT_PER_PERSON||25000)});
    if(error){
      if(error.code==="23505") setMessage("journalMessage","Setoran minggu ini sudah pernah dicatat. Tidak ada duplikasi.");
      else setMessage("journalMessage",`Gagal menyimpan: ${error.message}`);
      $("depositMeBtn").disabled=false;return;
    }
    setMessage("journalMessage","Setoran berhasil dicatat. Semangat menabung bareng! ♡",true);
    await loadData();
  }
  async function saveSettings(){
    const payload={couple_id:cfg.COUPLE_ID,my_name:$("myDisplayName").value.trim(),partner_name:$("partnerDisplayName").value.trim(),photo_url:$("photoUrlInput").value.trim()||null,updated_by:currentUser.id};
    if(payload.photo_url){try{const u=new URL(payload.photo_url);if(!["https:","http:"].includes(u.protocol))throw new Error();}catch{setMessage("settingsMessage","URL foto harus berupa tautan http/https yang valid.");return;}}
    const {error}=await supabase.from("couple_settings").upsert(payload,{onConflict:"couple_id"});
    if(error){setMessage("settingsMessage",`Gagal menyimpan. Pastikan akunmu sudah ditambahkan sebagai anggota. ${error.message}`);return;}
    setMessage("settingsMessage","Personalisasi tersimpan! ♡",true);await loadData();
  }
  async function saveNote(){
    const payload={couple_id:cfg.COUPLE_ID,note:$("coupleNote").value.trim(),updated_by:currentUser.id};
    const {error}=await supabase.from("couple_notes").upsert(payload,{onConflict:"couple_id"});
    if(error){setMessage("noteStatus",`Gagal menyimpan: ${error.message}`);return;}
    noteText=payload.note;setMessage("noteStatus","Catatan berhasil tersimpan online ♡",true);
  }
  async function enterApp(user){
    currentUser=user;showApp();
    try{await loadData();}catch(e){setConnection("Periksa pengaturan","offline");setMessage("journalMessage",`Belum bisa memuat data: ${e.message}. Periksa SQL dan keanggotaan akun di README.`);}
  }
  async function init(){
    $("nextMondayDay").textContent=new Date(thisMonday+"T12:00:00").getDate();
    if(!configured){$("setupNotice").classList.remove("hidden");setConnection("Belum dikonfigurasi","offline");return;}
    if(!window.supabase){setConnection("Library gagal dimuat","offline");return;}
    supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    $("authForm").addEventListener("submit",async e=>{
      e.preventDefault();const email=$("emailInput").value.trim(),password=$("passwordInput").value;
      const btn=$("authSubmit");btn.disabled=true;setMessage("authMessage",mode==="login"?"Sedang masuk...":"Sedang membuat akun...");
      try{
        const result=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
        if(result.error)throw result.error;
        if(mode==="signup"&&!result.data.session){setMessage("authMessage","Akun dibuat! Cek email untuk konfirmasi, lalu masuk.");}
        else if(result.data.user){await enterApp(result.data.user);}
      }catch(err){setMessage("authMessage",err.message||"Terjadi kesalahan.");}
      finally{btn.disabled=false;}
    });
    $("forgotPasswordBtn").addEventListener("click",async()=>{
      const email=$("emailInput").value.trim();
      if(!email){setMessage("authMessage","Masukkan email akun terlebih dahulu, lalu klik Lupa password.");$("emailInput").focus();return;}
      const btn=$("forgotPasswordBtn");btn.disabled=true;
      setMessage("authMessage","Mengirim tautan pemulihan password...");
      try{
        const redirectTo=window.location.origin+window.location.pathname;
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
        if(error)throw error;
        setMessage("authMessage","Permintaan pemulihan dikirim. Periksa email masuk dan folder spam.",true);
      }catch(err){
        setMessage("authMessage",`Gagal mengirim tautan: ${err.message}. Jika tertulis redirect URL tidak diizinkan, URL website perlu ditambahkan di Supabase Auth → URL Configuration.`);
      }finally{btn.disabled=false;}
    });
    document.querySelectorAll(".auth-tab").forEach(b=>b.addEventListener("click",()=>{
      mode=b.dataset.mode;document.querySelectorAll(".auth-tab").forEach(x=>x.classList.toggle("active",x===b));
      $("authSubmit").innerHTML=mode==="login"?'Masuk ke jurnal <span>♡</span>':'Buat akun <span>♡</span>';
      $("forgotPasswordBtn").classList.toggle("hidden",mode!=="login");
      $("passwordInput").autocomplete=mode==="login"?"current-password":"new-password";setMessage("authMessage","");
    }));
    $("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();currentUser=null;entries=[];showAuth();setConnection("Keluar");});
    $("depositMeBtn").addEventListener("click",deposit);$("saveSettingsBtn").addEventListener("click",saveSettings);
    $("saveNoteBtn").addEventListener("click",saveNote);$("historyFilter").addEventListener("change",renderHistory);
    supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"&&session?.user){
        setTimeout(async()=>{
          const newPassword=window.prompt("Buat password baru minimal 6 karakter:");
          if(newPassword===null){
            await supabase.auth.signOut();currentUser=null;showAuth();
            setMessage("authMessage","Pemulihan dibatalkan. Klik Lupa password? jika ingin mencoba lagi.");
            return;
          }
          if(newPassword.length<6){
            await supabase.auth.signOut();currentUser=null;showAuth();
            setMessage("authMessage","Password baru minimal 6 karakter. Klik Lupa password? untuk mencoba lagi.");
            return;
          }
          const {error}=await supabase.auth.updateUser({password:newPassword});
          if(error){
            await supabase.auth.signOut();currentUser=null;showAuth();
            setMessage("authMessage",`Gagal memperbarui password: ${error.message}`);
            return;
          }
          await supabase.auth.signOut();currentUser=null;entries=[];showAuth();
          window.history.replaceState(null,document.title,window.location.pathname);
          setMessage("authMessage","Password berhasil diganti. Silakan masuk dengan password baru.",true);
        },0);
        return;
      }
      if(event==="SIGNED_IN"&&session?.user&&!currentUser)enterApp(session.user);
    });
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user) await enterApp(session.user); else showAuth();
    // Realtime refresh across both devices.
    supabase.channel("shared-savings")
      .on("postgres_changes",{event:"*",schema:"public",table:"savings_entries",filter:`couple_id=eq.${cfg.COUPLE_ID}`},()=>loadData().catch(()=>{}))
      .on("postgres_changes",{event:"*",schema:"public",table:"couple_settings",filter:`couple_id=eq.${cfg.COUPLE_ID}`},()=>loadData().catch(()=>{}))
      .on("postgres_changes",{event:"*",schema:"public",table:"couple_notes",filter:`couple_id=eq.${cfg.COUPLE_ID}`},()=>loadData().catch(()=>{}))
      .subscribe();
  }
  init();
})();