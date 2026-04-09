/**
 * GateReadyâ¢ â Express Server v8 (Vercel-Ready)
 * Full site + admin backend + Gate.AI proxy
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const https    = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  });
  return out;
}

function renderPage(pageName, vars = {}) {
  const layout = fs.readFileSync(path.join(__dirname, 'views/layout.html'), 'utf8');
  const page   = fs.readFileSync(path.join(__dirname, 'views/pages', pageName), 'utf8');
  let html = layout.replace('{{CONTENT}}', page);
  Object.entries(vars).forEach(([k, v]) => { html = html.split(`{{${k}}}`).join(v); });
  html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
  return html;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@begateready.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GateReady2026!';
const adminSessions = new Map();
const sessions = new Map();

function hashPass(p) { return require('crypto').createHash('sha256').update(p).digest('hex'); }
function createAdminSession() { const t = require('crypto').randomBytes(32).toString('hex'); adminSessions.set(t, {created:Date.now()}); return t; }
function isAdminLoggedIn(req) { const c=parseCookies(req); if(!c.gr_admin)return false; const s=adminSessions.get(c.gr_admin); if(!s||Date.now()-s.created>8*3600000){adminSessions.delete(c.gr_admin);return false;} return true; }
function createVendorSession(email) { const t=require('crypto').randomBytes(32).toString('hex'); sessions.set(t,{email,created:Date.now()}); return t; }
function getVendorSession(req) { const c=parseCookies(req); if(!c.gr_session)return null; const s=sessions.get(c.gr_session); if(!s||Date.now()-s.created>7*86400000){ sessions.delete(c.gr_session);return null;} return s; }
function isVendorLoggedIn(req) { const s=getVendorSession(req); if(!s)return false; const v=vendorAccounts.get(s.email); return v&&v.approved; }

const TIERS = [
  {qty:10,label:'Starter',per:16,total:160},
  {qty:50,label:'Most Popular',per:13,total:650},
  {qty:100,label:'Vendor Standard',per:11,total:1100},
  {qty:250,label:'High Volume',per:10,total:2500},
  {qty:500,label:'Distributor',per:9,total:null},
];

const vendorAccounts = new Map([
  ['demo@vendor.com',{id:'v_001',email:'demo@vendor.com',password_hash:hashPass('demo123'),name:'Marcus Johnson',business:'Stadium Snacks LLC',phone:'404-555-0100',city:'Atlanta, GA',type:'Concession Stand',tier:50,approved:true,active:true,created:Date.now()-45*86400000,last_login:Date.now()-2*86400000,embed_key:'gr_emb_demo0001',embed_plan:'$99/mo ',notes:'Demo vendor'}],
  ['gate@go.com',{id:'v_002',email:'gate@go.com',password_hash:hashPass('gatepass'),name:'Deja Williams',business:'Gate & Go ATL',phone:'404-555-0222',city:'Atlanta, GA',type:'Stadium Vendor',tier:100,approved:true,active:true,created:Date.now()-30*86400000,last_login:Date.now()-5*86400000,embed_key:'gr_emb_gate0002',embed_plan:'$49/mo ',notes:''}],
]);
const applications = new Map();
const orders = new Map([['ord_001',{id:'ord_001',vendor:'demo@vendor.com',qty:50,per:13,total:650,status:'Shipped',date:Date.now()-10*86400000}],['ord_002',{id:'ord_002',vendor:'gate@go.com',qty:100,per:11,total:1100,status:'Delivered',date:Date.now()-22*86400000}]]);
const analytics = {gate_check_hits:0,gate_check_misses:0,gate_check_llm_calls:0,llm_cost_usd:0,email_captures:0,page_views:{}};
const emailCaptures=[],gateCheckLog=[],gateAIRateMap=new Map();
function checkGateAIRate(ip){const now=Date.now();const e=gateAIRateMap.get(ip)||{count:0,reset:now+60000};if(now>e.reset){e.count=0;e.reset=now+60000;}e.count++;gateAIRateMap.set(ip,e);return e.count<=10;}

const {handleGateCheck,handleGateCheckWithEmail}=require('./api/gatecheck');

app.get('/',(req,res)=>{analytics.page_views['/']=(analytics.page_views['/']||0)+1;res.send(renderPage('home.html'));});
app.get('/shop',(req,res)=>{analytics.page_views['/shop']=(analytics.page_views['/shop'])+1;res.send(renderPage('shop.html'));});
app.get('/game-day-guide',(req,res)=>res.send(renderPage('guide.html')));
app.get('/about',(req,res)=>res.send(renderPage('about.html')));
app.get('/embed',(req,res)=>res.send(renderPage('embed.html')));
app.get('/gate-check',(req,res)=>{analytics.page_views['/gate-check']=(analytics.page_views['/gate-check']||0)+1;res.send(renderPage('gatecheck.html'));});
app.get('/world-cup',(req,res)=>{analytics.page_views['/world-cup']=(analytics.page_views['/world-cup']||0)+1;res.send(renderPage('worldcup.html'));});
app.get('/wholesale',(req,res)=>{analytics.page_views['/wholesale']=(analytics.page_views['/wholesale']||0)+1;if(isVendorLoggedIn(req)){const s=getVendorSession(req);const v=vendorAccounts.get(s.email);res.send(renderPage('wholesale-auth.html',{VENDOR_NAME:v.name,VENDOR_BUSINESS:v.business,TIERS_JSON:JSON.stringify(TIERS),}));}else{res.send(renderPage('wholesale-public.html',{TIERS_JSON:JSON.stringify(TIERS)}));}});
app.get('/vendor-portal',(req,res)=>{if(isVendorLoggedIn(req)){const s=getVendorSession(req);const v=vendorAccounts.get(s.email);const vOrders=[...orders.values()].filter(o=>o.vendor===s.email);res.send(renderPage('vendor-dashboard.html',{VENDOR_JSON:JSON.stringify(v),ORDERS_JSON:JSON.stringify(vOrders),}));}else{res.send(renderPage('vendor.html'));}});
app.get('/admin',(req,res)=>{if(isAdminLoggedIn(req))return res.redirect('/admin/dashboard');res.send(renderPage('admin.html'));});
app.get('/admin/dashboard',(req,res)=>{if(!isAdminLoggedIn(req))return res.redirect('/admin');const allVendors=[...vendorAccounts.values()];const allOrders=[...orders.values()];const allApps=[...applications.values()];res.send(renderPage('admin-dashboard.html',{VENDORS_JSON:JSON.stringify(allVendors),ORDERS_JSON:JSON.stringify(allOrders),APPS_JSON:JSON.stringify(allApps),ANALRTICIS_JSON:JSON.stringify(analytics),EMAILS_JSON:JSON.stringify(emailCaptures),GC_LOG_JSON:JSON.stringify(gateCheckLog.slice(-100)),}));});

app.post('/api/gate-check',async(req,res)=>{try{analytics.gate_check_hits++;const result=await handleGateCheck(req.body);res.json(result);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/gate-check-lookup',async(req,res)=>>{try{analytics.gate_check_llm_calls++;analytics.llm_cost_usd+=0.0003;if(req.body.email){analytics.email_captures++;emailCaptures.push({email:req.body.email,query:req.body.query,ts:Date.now()});}const result=await handleGateCheckWithEmail(req.body);gateCheckLog.push({query:req.body.query,result:result.policy,ts:Date.now()});res.json(result);}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/gateai',async(req,res)=>{const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown';if(!checkGateAIRate(ip))return res.status(429).json({error:'Rate limit exceeded.'});const apiKey=process.env.ANTHROPCI_API_KEY;if(!apiKey)return res.status(503).json({error:'AI service not configured.'});const{messages,system}=req.body;const body=JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:400,system,messages});const opts={hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'}};const pr=require('https').request(opts,prRes=>{let data='';prRes.on('data',c=>data+=c);prRes.on('end',()=>{try{res.json(JSON.parse(data));}catch(e){res.status(500).json({error:'Upstream parse error'});}})});pr.on('error',e=>res.status(502).json({error:e.message}));pr.write(body);pr.end();});

app.post('/api/vendor/login',(req,res)=>{app.use(express.json());const {email,password}=req.body;const vendor=vendorAccounts.get(email);if(!vendor||vendor.password_hash!==hashPass(password))return res.status(401).json({error:'Invalid credentials.'});if(!vendor.approved)return res.status(403).json({error:'Account pending approval.'});vendor.last_login=Date.now();const token=createVendorSession(email);res.setHeader('Set-Cookie',`gr_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);res.json({ok:true});});
app.get('/api/vendor/logout',(req,res)=>{app.use(express.json());const c=parseCookies(req);if(c.gr_session)sessions.delete(c.gr_session);res.setHeader('Set-Cookie','gr_session=; Path=/; Max-Age=0');res.redirect('/vendor-portal');});
app.post('/api/vendor/apply',(req,res)=>{const id=`app_${Date.now()}`;applications.set(id,{id,...req.body,status:'Pending',created:Date.now()});res.json({ok:true,id});});
app.post('/api/admin/login',(req,res)=>{const{email,password}=req.body;if(email!==ADMIN_EMAIL||password!==ADMIN_PASSWORD)return res.status(401).json({error:'Invalid admin credentials.'});const token=createAdminSession();res.setHeader('Set-Cookie',`gr_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);res.json({ok:true});});
app.get('/api/admin/logout',(req,res)=>{const c=parseCookies(req);if(c.gr_admin)adminSessions.delete(c.gr_admin);res.setHeader('Set-Cookie','gr_admin=; Path=/; Max-Age=0');res.redirect('/admin');});
function requireAdmin(req,res,next){if(!isAdminLoggedIn(req))return res.status(401).json({error:'Unauthorized'});next();}
app.get('/api/admin/analytics',requireAdmin,(req,res)=>{res.json({...analytics,total_vendors:vendorAccounts.size,total_orders:orders.size,pending_applications:[...applications.values()].filter(a=>a.status==='Pending').length,total_revenue:[...orders.values()].reduce((s,o)=>s+,o.total||0),0),email_list_size:emailCaptures.length});});
app.get('/api/admin/vendors',requireAdmin,(req,res)=>res.json([...vendorAccounts.values()].map(v=>({...v,password_hash:undefined}))));
app.get('/api/admin/orders',requireAdmin,(req,res)=>res.json([...orders.values()]));
app.get('/api/admin/applications',requireAdmin,(req,res)=>res.json([...applications.values()]));
app.get('/api/admin/sales/summary',requireAdmin,(req,res)=>{const all=[...orders.values()];const byV={};all.forEach(o=>{byV[o.vendor]=(byV[o.vendor]||0)+(o.total||0);});res.json({total_revenue:all.reduce((s,o)=>s+(o.total||0),0),total_orders:all.length,by_vendor:byV});});
app.get('/api/admin/emails',requireAdmin,(req,res)=>res.json(emailCaptures));
app.get('/api/admin/gc-log,requireAdmin,(req,res)=>{const page=parseInt(req.query.page)||1;const limit=parseInt(req.query.limit)||50;const start=(page-1)*limit;res.json({total:gateCheckLog.length,page,items:gateCheckLog.slice(start,start+limit)});});
app.use((req,res)=>res.status(404).send(renderPage('home.html')));
if(process.env.NODE_ENV!=='test'){app.listen(PORT,()=>console.log(`GateReadyè¢ running â http://localhost:${PORT}`));}
module.exports=app;

module.exports = app;
