(function(){
  const SUPABASE_URL='https://dqmjhsyjhgqvnwxufxnt.supabase.co';
  const SUPABASE_KEY='sb_publishable_YXpCaY5ZRxrDOJssMCFqLw_3PEpzrZY';
  if(!window.supabase?.createClient){console.error('Supabase client ачаалсангүй.');return}

  const cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const cloud={session:null,profile:null,ready:false};
  window.wishStudioCloud={client:cloudClient,state:cloud};

  const toast=(message)=>{
    const old=document.getElementById('cloudToast');if(old)old.remove();
    const el=document.createElement('div');el.id='cloudToast';el.textContent=message;
    el.style.cssText='position:fixed;z-index:9999;right:18px;bottom:18px;max-width:360px;padding:13px 16px;border:1px solid #ffffff26;border-radius:14px;background:#211019;color:#fff;box-shadow:0 18px 55px #0009;font:700 12px system-ui';
    document.body.appendChild(el);setTimeout(()=>el.remove(),4200);
  };
  const setBusy=(button,busy,label)=>{if(!button)return;button.disabled=busy;if(label)button.textContent=busy?'Түр хүлээнэ үү…':label};
  const normalizePhone=(value)=>String(value||'').replace(/\D/g,'').slice(-8);
  const accountEmail=(phone)=>'user-'+phone+'@accounts.wish-studio.mn';
  const accountPassword=(pin)=>'WishStudio-'+pin+'-2026';
  const sessionPhone=()=>normalizePhone(cloud.session?.user?.user_metadata?.phone||cloud.profile?.email?.match(/^user-(\d{8})@/)?.[1]||'');
  const userFromProfile=()=>cloud.profile?{id:cloud.profile.id,name:cloud.profile.name||sessionPhone(),email:cloud.profile.email,phone:sessionPhone(),isAdmin:Boolean(cloud.profile.is_admin)}:null;
  const rowProject=(row)=>({...row.data,id:row.id,status:row.status,shareSlug:row.share_slug,createdAt:row.created_at,updatedAt:row.updated_at,ownerId:row.owner_id,shareUrl:location.href.split('#')[0]+'#gift='+encodeURIComponent(row.share_slug)});
  const rowPayment=(row)=>({...row.data,id:row.id,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at,ownerId:row.owner_id});
  const rowCode=(row)=>({code:row.code,plan:row.plan,used:row.used,projectId:row.project_id,paymentId:row.payment_id,createdAt:row.created_at,usedAt:row.used_at});

  async function loadCloudData(){
    if(!cloud.session){adminData={projects:[],payments:[],codes:[],settings:{...DEFAULT_SITE_SETTINGS}};authData={users:[]};return}
    const [profileResult,settingsResult]=await Promise.all([
      cloudClient.from('profiles').select('*').eq('id',cloud.session.user.id).single(),
      cloudClient.from('site_settings').select('data').eq('id',1).maybeSingle()
    ]);
    cloud.profile=profileResult.data||{
      id:cloud.session.user.id,
      name:cloud.session.user.user_metadata?.name||'',
      email:cloud.session.user.email||'',
      is_admin:false
    };
    const isAdmin=Boolean(cloud.profile?.is_admin);
    const projectQuery=cloudClient.from('projects').select('*').order('updated_at',{ascending:false});
    const paymentQuery=cloudClient.from('payments').select('*').order('created_at',{ascending:false});
    const [projectsResult,paymentsResult,codesResult,profilesResult]=await Promise.all([
      isAdmin?projectQuery:projectQuery.eq('owner_id',cloud.session.user.id),
      isAdmin?paymentQuery:paymentQuery.eq('owner_id',cloud.session.user.id),
      isAdmin?cloudClient.from('activation_codes').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[]}),
      isAdmin?cloudClient.from('profiles').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[cloud.profile]})
    ]);
    adminData={
      projects:(projectsResult.data||[]).map(rowProject),
      payments:(paymentsResult.data||[]).map(rowPayment),
      codes:(codesResult.data||[]).map(rowCode),
      settings:{...DEFAULT_SITE_SETTINGS,...(settingsResult.data?.data||{})}
    };
    authData={users:(profilesResult.data||[]).map(p=>({id:p.id,name:p.name,email:p.email,phone:p.email,createdAt:p.created_at,isAdmin:p.is_admin}))};
    applySiteSettings();refreshAccountButton();
  }

  window.loadAdminData=()=>adminData;
  window.loadAuthData=()=>authData;
  window.saveAdminData=()=>{};
  window.saveAuthData=()=>{};
  window.currentUser=userFromProfile;
  window.refreshAccountButton=function(){
    const button=document.getElementById('accountButton');if(!button)return;
    const user=userFromProfile();button.textContent=user?(user.name||user.email):'Нэвтрэх';
  };
  window.completeUserLogin=function(){
    refreshAccountButton();const action=pendingAction;pendingAction=null;
    if(action?.type==='choose'){choose(action.pkg,action.price);return}
    if(action?.type==='demo'){demoBuilder();return}
    if(action?.type==='guide'){go('packages');return}
    if(cloud.profile?.is_admin){renderAdmin();go('adminPage');return}
    renderUserDashboard();go('userPage');
  };
  window.userRegister=async function(){
    const error=document.getElementById('authError');error.textContent='';
    const name=document.getElementById('registerName').value.trim();
    const phone=normalizePhone(document.getElementById('registerPhone').value);
    const pin=document.getElementById('registerPin').value;
    const again=document.getElementById('registerPinAgain').value;
    if(name.length<2){error.textContent='Нэрээ бүтнээр нь оруулна уу.';return}
    if(!/^\d{8}$/.test(phone)){error.textContent='8 оронтой утасны дугаар оруулна уу.';return}
    if(!/^\d{4,6}$/.test(pin)){error.textContent='PIN 4–6 оронтой тоо байна.';return}
    if(pin!==again){error.textContent='Давтан оруулсан PIN таарахгүй байна.';return}
    const button=document.querySelector('#registerForm .btn');setBusy(button,true,'Бүртгүүлэх →');
    const {data,error:signError}=await cloudClient.auth.signUp({
      email:accountEmail(phone),
      password:accountPassword(pin),
      options:{data:{name,phone}}
    });
    setBusy(button,false,'Бүртгүүлэх →');
    if(signError){error.textContent=signError.message.includes('registered')?'Энэ дугаараар account үүссэн байна. Нэвтрэх хэсгийг ашиглана уу.':'Бүртгүүлэх үед алдаа гарлаа.';return}
    if(!data.session){error.textContent='Cloud бүртгэлийн тохиргоо бэлэн болоогүй байна.';return}
    cloud.session=data.session;await loadCloudData();window.completeUserLogin();
  };
  window.userLogin=async function(){
    const error=document.getElementById('authError');error.textContent='';
    const phone=normalizePhone(document.getElementById('loginPhone').value);
    const pin=document.getElementById('loginPin').value;
    if(!/^\d{8}$/.test(phone)||!/^\d{4,6}$/.test(pin)){error.textContent='Утасны дугаар болон PIN-ээ зөв оруулна уу.';return}
    const button=document.querySelector('#loginForm .btn');setBusy(button,true,'Нэвтрэх →');
    const {data,error:signError}=await cloudClient.auth.signInWithPassword({email:accountEmail(phone),password:accountPassword(pin)});
    setBusy(button,false,'Нэвтрэх →');
    if(signError){error.textContent='Утасны дугаар эсвэл PIN буруу байна.';return}
    cloud.session=data.session;await loadCloudData();window.completeUserLogin();
  };
  window.userLogout=async function(){await cloudClient.auth.signOut();cloud.session=null;cloud.profile=null;adminData={projects:[],payments:[],codes:[],settings:{...DEFAULT_SITE_SETTINGS}};authData={users:[]};refreshAccountButton();go('home')};
  window.openAccount=function(){
    if(cloud.profile?.is_admin){renderAdmin();go('adminPage');return}
    if(userFromProfile()){renderUserDashboard();go('userPage');return}
    showAuthMode('login');go('authPage');
  };
  window.openAdmin=function(){
    if(cloud.profile?.is_admin){renderAdmin();go('adminPage');return}
    toast('Admin хэсэгт зөвхөн эрхтэй хэрэглэгч нэвтэрнэ.');showAuthMode('login');go('authPage');
  };
  window.adminLogin=async function(){
    const error=document.getElementById('adminError');error.textContent='';
    const email=document.getElementById('adminUsername').value.trim().toLowerCase();
    const password=document.getElementById('adminPassword').value;
    const {data,error:signError}=await cloudClient.auth.signInWithPassword({email,password});
    if(signError){error.textContent='Admin имэйл эсвэл нууц үг буруу байна.';return}
    cloud.session=data.session;await loadCloudData();
    if(!cloud.profile?.is_admin){await cloudClient.auth.signOut();cloud.session=null;cloud.profile=null;error.textContent='Энэ account admin эрхгүй байна.';return}
    renderAdmin();go('adminPage');
  };
  window.adminLogout=window.userLogout;

  window.saveSiteSettings=async function(){
    if(!cloud.profile?.is_admin){toast('Admin эрх шаардлагатай.');return}
    const message=document.getElementById('settingsMessage');
    const settings={
      brand:document.getElementById('settingBrand').value.trim()||DEFAULT_SITE_SETTINGS.brand,
      eyebrow:document.getElementById('settingEyebrow').value.trim()||DEFAULT_SITE_SETTINGS.eyebrow,
      headline:document.getElementById('settingHeadline').value.trim()||DEFAULT_SITE_SETTINGS.headline,
      intro:document.getElementById('settingIntro').value.trim()||DEFAULT_SITE_SETTINGS.intro,
      normalPrice:Number(document.getElementById('settingNormalPrice').value)||0,premiumPrice:Number(document.getElementById('settingPremiumPrice').value)||0,advancedPrice:Number(document.getElementById('settingAdvancedPrice').value)||0,
      normalSub:document.getElementById('settingNormalSub').value.trim(),premiumSub:document.getElementById('settingPremiumSub').value.trim(),advancedSub:document.getElementById('settingAdvancedSub').value.trim(),
      normalFeatures:document.getElementById('settingNormalFeatures').value.trim(),premiumFeatures:document.getElementById('settingPremiumFeatures').value.trim(),advancedFeatures:document.getElementById('settingAdvancedFeatures').value.trim(),
      bankRecipient:document.getElementById('settingBankRecipient').value.trim(),bankIban:document.getElementById('settingBankIban').value.trim().replace(/\s/g,'').toUpperCase(),bankOwner:document.getElementById('settingBankOwner').value.trim(),paymentInfo:document.getElementById('settingPaymentInfo').value.trim()
    };
    const {error}=await cloudClient.from('site_settings').upsert({id:1,data:settings,updated_at:new Date().toISOString()});
    if(error){message.style.color='#ff9fb2';message.textContent=error.message;return}
    adminData.settings={...DEFAULT_SITE_SETTINGS,...settings};applySiteSettings();message.style.color='#9de6b8';message.textContent='✓ Website-ийн мэдээлэл cloud дээр шинэчлэгдлээ.';
  };

  async function uploadFile(file,projectId,label){
    if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase();
    const path=cloud.session.user.id+'/'+projectId+'/'+label+'-'+Date.now()+'.'+ext;
    const {error}=await cloudClient.storage.from('gift-media').upload(path,file,{upsert:true,contentType:file.type});
    if(error)throw error;return cloudClient.storage.from('gift-media').getPublicUrl(path).data.publicUrl;
  }
  window.canPersistBuilder=function(){
    if(selectedPackage==='Demo'||!userFromProfile())return false;
    if(cloud.profile?.is_admin||editingProjectId)return true;
    return adminData.payments.some(p=>p.status==='paid'&&p.activationCode===activePurchaseCode&&(!p.projectId||p.projectId===editingProjectId));
  };
  window.saveProject=async function(status){
    if(!userFromProfile()){pendingAction={type:'guide'};showAuthMode('login');go('authPage');return null}
    if(selectedPackage==='Demo'){toast('Link авахын тулд багц сонгоно уу.');return null}
    if(!canPersistBuilder()){toast('Төлөгдсөн багцын activation code шаардлагатай.');return null}
    const button=document.getElementById(status==='published'?'finalizeBtn':'saveDraftBtn');setBusy(button,true,status==='published'?'Finalize & Link':'Save draft');
    try{
      const project=currentProjectData(status);const existing=adminData.projects.find(x=>x.id===project.id);
      const photoFiles=[...document.getElementById('photos').files].slice(0,photoLimit);
      project.photoUrls=photoFiles.length?await Promise.all(photoFiles.map((file,i)=>uploadFile(file,project.id,'photo-'+i))):(existing?.photoUrls||[]);
      const videoFile=document.getElementById('video').files[0];project.videoUrl=videoFile?await uploadFile(videoFile,project.id,'video'):(existing?.videoUrl||'');
      const surpriseFile=document.getElementById('surpriseImage').files[0];project.surpriseImageUrl=surpriseFile?await uploadFile(surpriseFile,project.id,'surprise'):(existing?.surpriseImageUrl||'');
      const signedInUser=userFromProfile();project.photoCount=project.photoUrls.length;project.hasVideo=Boolean(project.videoUrl);project.ownerId=cloud.session.user.id;project.ownerName=cloud.profile.name;project.ownerPhone=signedInUser?.phone||'';
      if(!cloud.profile?.is_admin&&project.activationCode){
        const {data:claimed,error:claimError}=await cloudClient.rpc('claim_payment_code',{p_code:project.activationCode,p_project_id:project.id});
        if(claimError||!claimed)throw new Error('Activation code ашиглах боломжгүй байна.');
      }
      const payload={id:project.id,owner_id:cloud.session.user.id,status,data:project,updated_at:new Date().toISOString()};
      const {data,error}=await cloudClient.from('projects').upsert(payload).select().single();if(error)throw error;
      const saved=rowProject(data);const index=adminData.projects.findIndex(x=>x.id===saved.id);if(index>=0)adminData.projects[index]=saved;else adminData.projects.unshift(saved);
      editingProjectId=saved.id;
      if(status==='published')document.getElementById('finalMsg').innerHTML='<span class="success">✓ Published · Cloud link бэлэн</span><div class="publishedLink"><code>'+escapeHtml(saved.shareUrl)+'</code><button class="btn secondary small" onclick="copyPublishedLink(\''+saved.id+'\')">🔗 Link хуулах</button></div>';
      else document.getElementById('finalMsg').innerHTML='<span class="success">✓ Cloud draft хадгалагдлаа</span> · ID: <b>'+escapeHtml(saved.id)+'</b>';
      toast(status==='published'?'Мэндчилгээ нийтлэгдлээ.':'Draft хадгалагдлаа.');return saved;
    }catch(error){console.error(error);toast('Хадгалах үед алдаа гарлаа: '+error.message);return null}
    finally{setBusy(button,false,status==='published'?'Finalize & Link':'Save draft')}
  };
  window.saveDraft=()=>window.saveProject('draft');
  window.fakeFinalize=()=>window.saveProject('published');
  window.copyPublishedLink=function(id){const project=adminData.projects.find(x=>x.id===id);if(!project)return;navigator.clipboard?.writeText(project.shareUrl).then(()=>toast('Link хуулагдлаа.')).catch(()=>prompt('Link-ээ хуулна уу:',project.shareUrl))};

  const originalEdit=window.adminEditProject;
  window.adminEditProject=function(id){
    const item=adminData.projects.find(x=>x.id===id);if(!item)return;originalEdit(id);
    const gallery=document.getElementById('gallery');gallery.innerHTML='';(item.photoUrls||[]).forEach(url=>{const img=document.createElement('img');img.src=url;gallery.appendChild(img)});
    if(!gallery.children.length)gallery.innerHTML='<div class="ph">Photo 1</div><div class="ph">Photo 2</div>';
    const video=document.getElementById('pvVideo');video.src=item.videoUrl||'';video.style.display=item.videoUrl?'block':'none';
    if(item.surpriseImageUrl){surpriseImageUrl=item.surpriseImageUrl;renderSurprise()}syncPreview();
  };
  window.openPublishedGiftFromHash=async function(){
    const match=location.hash.match(/^#gift=([^&]+)/);if(!match)return;const value=decodeURIComponent(match[1]);
    let {data}=await cloudClient.from('projects').select('*').eq('share_slug',value).eq('status','published').maybeSingle();
    if(!data)({data}=await cloudClient.from('projects').select('*').eq('id',value).eq('status','published').maybeSingle());
    if(!data){toast('Мэндчилгээ олдсонгүй.');return}const item=rowProject(data);adminData.projects=[item,...adminData.projects.filter(x=>x.id!==item.id)];window.adminEditProject(item.id);openViewer();
  };

  window.createPaymentOrder=async function(plan,amount){
    const user=userFromProfile();if(!user)return;const payment={id:makeId('PAY'),reference:'WS-'+Date.now().toString().slice(-6)+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),plan,amount:Number(amount)||0,status:'pending',ownerPhone:user.phone,ownerName:user.name,createdAt:new Date().toISOString(),activationCode:''};
    adminData.payments.unshift(payment);currentPaymentId=payment.id;sessionStorage.setItem('wishStudioPaymentId',payment.id);renderPaymentCheckout(payment);
    const {error}=await cloudClient.from('payments').insert({id:payment.id,owner_id:cloud.session.user.id,status:'pending',data:payment});if(error)toast('Төлбөрийн хүсэлт хадгалагдсангүй: '+error.message);
  };
  window.verifyPayment=async function(){
    const result=document.getElementById('paymentVerifyResult');
    const {data,error}=await cloudClient.from('payments').select('*').eq('id',currentPaymentId).maybeSingle();
    if(error||!data){result.className='verifyResult error show';result.textContent='Төлбөрийн хүсэлт олдсонгүй.';return}
    const payment=rowPayment(data);const index=adminData.payments.findIndex(x=>x.id===payment.id);if(index>=0)adminData.payments[index]=payment;else adminData.payments.unshift(payment);renderPaymentCheckout(payment);
    if(payment.status==='pending'){result.className='verifyResult pending show';result.innerHTML='⏳ Төлбөр хараахан баталгаажаагүй байна.<br>Гүйлгээний утга: <b>'+escapeHtml(payment.reference)+'</b>';return}
    if(payment.status==='rejected'){result.className='verifyResult error show';result.textContent='Төлбөр баталгаажаагүй байна.';return}
    result.className='verifyResult success show';result.innerHTML='<b>🎉 Төлбөр баталгаажлаа!</b><code class="paymentCode">'+escapeHtml(payment.activationCode)+'</code><div class="verifyActions"><button class="btn small" onclick="useVerifiedPaymentCode(\''+escapeHtml(payment.activationCode)+'\')">Builder нээх →</button></div>';
  };
  window.activate=function(){
    const entered=document.getElementById('code').value.trim().toUpperCase();
    const payment=adminData.payments.find(p=>p.status==='paid'&&p.activationCode===entered);
    if(!payment){alert('Code буруу эсвэл төлбөр баталгаажаагүй байна.');return}
    if(payment.projectId){alert('Энэ code аль хэдийн website-д ашиглагдсан байна.');return}
    activePurchaseCode=entered;selectedPackage=payment.plan;applyPackage(selectedPackage);go('builder');
  };
  window.markPaymentStatus=async function(id,status){
    if(!cloud.profile?.is_admin)return;const payment=adminData.payments.find(x=>x.id===id);if(!payment)return;payment.status=status;payment.updatedAt=new Date().toISOString();
    if(status==='paid'&&!payment.activationCode){payment.activationCode='WISH-'+payment.plan.slice(0,3).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();payment.paidAt=new Date().toISOString()}
    const {error}=await cloudClient.from('payments').update({status,data:payment,updated_at:payment.updatedAt}).eq('id',id);
    if(!error&&payment.activationCode)await cloudClient.from('activation_codes').upsert({code:payment.activationCode,plan:payment.plan,payment_id:id,used:Boolean(payment.projectId),project_id:payment.projectId||null});
    if(error)toast(error.message);else renderAdmin();
  };
  window.deleteOrder=async function(id){if(!confirm('Энэ захиалгыг устгах уу?'))return;const {error}=await cloudClient.from('projects').delete().eq('id',id);if(error){toast(error.message);return}adminData.projects=adminData.projects.filter(x=>x.id!==id);renderAdmin()};
  window.setOrderStatus=async function(id,status){const item=adminData.projects.find(x=>x.id===id);if(!item)return;const {error}=await cloudClient.from('projects').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)toast(error.message);else{item.status=status;renderAdmin()}};

  async function boot(){
    const {data}=await cloudClient.auth.getSession();cloud.session=data.session;
    if(cloud.session)await loadCloudData();else{adminData.settings={...DEFAULT_SITE_SETTINGS};const {data:settings}=await cloudClient.from('site_settings').select('data').eq('id',1).maybeSingle();if(settings?.data)adminData.settings={...DEFAULT_SITE_SETTINGS,...settings.data};applySiteSettings()}
    cloud.ready=true;refreshAccountButton();await window.openPublishedGiftFromHash();
  }
  cloudClient.auth.onAuthStateChange((_event,session)=>{cloud.session=session;if(!session){cloud.profile=null;refreshAccountButton()}});
  boot().catch(error=>{console.error(error);toast('Cloud холболт түр ажиллахгүй байна.')});
})();
