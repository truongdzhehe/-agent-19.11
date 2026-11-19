/* A self-contained, offline report: all charts are SVG, no remote dependencies. */
function buildStandaloneReport(payload, {embedded = false} = {}) {
  const m=payload.metrics;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>'$'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:0});
  const count=value=>Number(value||0).toLocaleString('vi-VN');
  const range=`${payload.dateRange?.from || 'Đầu dữ liệu'} → ${payload.dateRange?.to || 'Cuối dữ liệu'}`;
  const ranks=(items)=>items.map((item,i)=>`<tr><td><span class="rank">${String(i+1).padStart(2,'0')}</span></td><td>${esc(item.name)}</td><td>${count(item.orders)}</td><td>${money(item.revenue)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Chưa có dữ liệu trong kỳ.</td></tr>';
  const table=(title,id,items)=>`<section class="card table-card" id="${id}"><div class="section-head"><div><p class="eyebrow">TOP PERFORMERS</p><h2>${title}</h2></div><label class="table-search"><span class="sr-only">Tìm trong ${title}</span><input type="search" data-table="${id}" placeholder="Tìm tên…"></label></div><div class="table-wrap"><table><thead><tr><th>Hạng</th><th>Tên</th><th>Số đơn</th><th>Doanh thu</th></tr></thead><tbody>${ranks(items)}</tbody></table></div><p class="table-search-empty" hidden>Không tìm thấy kết quả phù hợp.</p></section>`;
  const serialized=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DuyTruong Insight — Báo cáo kinh doanh đã nghiệm thu</title><style>
  :root{--bg:#e4edf5;--card:#ffffff;--ink:#1f2e3f;--muted:#445970;--line:#c9d9e8;--soft:#ecf3f9;--green:#174973;--mint:#709fd2;--gold:#72a3d7;--shadow:0 8px 35px #1b29370a;color-scheme:light}
  *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.65 'Segoe UI',Arial,sans-serif;letter-spacing:-.015em}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,.plot-mark:focus-visible{outline:3px solid #709fd2;outline-offset:4px}a{color:inherit;text-decoration:none}h1,h2,h3,p{margin:0}button{border:0}.wrap{max-width:1360px;margin:auto;padding:26px 34px 38px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}.logo{font-size:27px;font-weight:800;color:var(--green);letter-spacing:-1.3px}.top-actions{display:flex;align-items:center;gap:9px}.pill,.toolbar-btn{font-size:12px;padding:8px 14px;border-radius:100px;background:var(--card);border:1px solid var(--line);color:var(--muted)}.approved{color:var(--green);background:#d4e5f4}.approved:before{content:'';display:inline-block;width:6px;height:6px;background:#174973;border-radius:50%;margin-right:6px}.toolbar-btn:hover{color:var(--green);border-color:var(--mint)}
  .hero{position:relative;overflow:hidden;background:linear-gradient(115deg,#1e2d3d,#2e4863 75%,#3a6798);border-radius:28px;color:white;padding:40px 42px;display:grid;grid-template-columns:1.3fr 1fr;gap:30px}.hero:after{content:'';position:absolute;width:420px;height:420px;border:1px solid #ffffff15;border-radius:50%;right:-140px;top:-220px;box-shadow:0 0 0 40px #ffffff05,0 0 0 85px #ffffff04;pointer-events:none}.eyebrow{font-size:10px;font-weight:650;letter-spacing:.15em;color:var(--muted);text-transform:uppercase;margin-bottom:7px}.hero .eyebrow{color:#a9d4ff}.hero h1{font-size:clamp(25px,3vw,42px);font-weight:450;letter-spacing:-1.6px;line-height:1.25;max-width:600px}.hero-description{color:#bfdaf2;font-size:13px;margin-top:15px;max-width:440px}.hero-total{align-self:center;position:relative;z-index:1;text-align:right}.hero-total small{display:block;font-size:12px;color:#bfdaf2}.hero-total strong{display:block;font-size:clamp(36px,4.3vw,63px);font-weight:400;letter-spacing:-2px;line-height:1.4}.hero-total span{display:inline-block;font-size:11px;border:1px solid #ffffff28;border-radius:30px;padding:5px 12px;background:#ffffff0a}.report-meta{display:flex;gap:10px 20px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin:18px 3px 22px;overflow-wrap:anywhere}.report-meta strong{color:var(--ink);font-weight:550}
  .section-nav{position:sticky;top:12px;z-index:20;display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:7px;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);margin-bottom:22px;width:fit-content}.section-nav a{font-size:12px;padding:8px 18px;border-radius:12px;color:var(--muted)}.section-nav a:hover{background:var(--soft);color:var(--green)}.section-nav a:first-child{background:#d8e7f4;color:#174973}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.kpi{background:var(--card);padding:23px;border:1px solid var(--line);border-radius:21px;box-shadow:var(--shadow)}.kpi-top{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted)}.kpi-icon{font-size:18px;color:var(--green);width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:#ddebf7}.kpi strong{font-size:31px;font-weight:500;letter-spacing:-1px;display:block;margin:12px 0 4px}.kpi p{font-size:11px;color:var(--muted)}.grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:20px;margin-bottom:20px}.grid.equal{grid-template-columns:repeat(2,minmax(0,1fr))}.card{background:var(--card);border:1px solid var(--line);border-radius:23px;padding:25px;min-width:0;box-shadow:var(--shadow)}.section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:20px}h2{font-size:17px;font-weight:600;letter-spacing:-.45px}.section-head p:not(.eyebrow){font-size:11px;color:var(--muted);margin-top:4px}.mode-switch{display:flex;gap:3px;border:1px solid var(--line);background:var(--soft);padding:4px;border-radius:30px;flex-wrap:wrap}.mode-switch button{font-size:10px;color:var(--muted);background:none;padding:6px 10px;border-radius:20px;white-space:nowrap}.mode-switch button.active{background:var(--green);color:#ffffff}.chart{min-height:240px;position:relative}.chart svg{display:block;width:100%;height:auto;max-height:300px;overflow:visible}.chart text{font-family:inherit;fill:var(--muted);font-size:11px}.chart .grid-line{stroke:var(--line);stroke-dasharray:3 5}.plot-mark{cursor:crosshair;transition:opacity .2s,filter .2s,stroke-width .2s}.plot-mark:hover,.plot-mark:focus{filter:brightness(.91);outline:none;stroke:#1e2d3d;stroke-width:2}.chart-caption{font-size:10px;color:var(--muted);margin-top:14px}.chart-legend{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:12px}.chart-legend button{background:var(--soft);color:var(--muted);font-size:11px;border:1px solid var(--line);padding:6px 10px;border-radius:20px}.chart-legend button:hover,.chart-legend button.active{border-color:var(--mint);color:var(--green)}.legend-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}.empty{padding:45px 16px;text-align:center;color:var(--muted);font-size:12px}.donut-wrap{display:grid;place-items:center}.donut-wrap svg{max-height:240px}.donut-total{font-size:30px!important;fill:var(--ink)!important;font-weight:500}.bars{display:flex;flex-direction:column;gap:18px}.bar-line{position:relative;cursor:crosshair;border-radius:9px}.bar-info{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:7px}.bar-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-info strong{font-weight:550;white-space:nowrap}.bar-track{height:9px;border-radius:20px;background:var(--soft);overflow:hidden}.bar-fill{display:block;height:100%;border-radius:20px;background:var(--mint);transform-origin:left;animation:barGrow .8s ease both}.bar-line:hover .bar-fill,.bar-line:focus .bar-fill{background:var(--green)}.bar-line small{color:var(--muted);font-size:10px}.tooltip{position:fixed;z-index:60;max-width:min(330px,calc(100vw - 28px));padding:12px 16px;background:#1c2a39;color:#deedfb;border-radius:13px;font-size:12px;line-height:1.6;box-shadow:0 10px 30px #1a293825;pointer-events:none;white-space:pre-line}.selection-note{padding:11px 16px;color:var(--green);border:1px solid var(--line);background:var(--soft);border-radius:13px;margin:0 0 20px;font-size:11px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:380px;font-size:12px}th{text-align:left;color:var(--muted);font-size:10px;font-weight:550;padding:10px 8px;border-bottom:1px solid var(--line)}td{padding:13px 8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}td:last-child,th:last-child{text-align:right}td:last-child{font-weight:600}tr:last-child td{border:0}tbody tr:hover{background:var(--soft)}.rank{font-size:10px;color:var(--muted);display:grid;place-items:center;width:25px;height:25px;background:var(--soft);border-radius:8px}.table-search input{width:135px;border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:8px 11px;color:var(--ink);font-size:11px}.table-search-empty{font-size:12px;padding:18px;color:var(--muted)}.proposals{margin-top:8px}.proposal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.proposal{background:var(--soft);border:1px solid var(--line);border-radius:18px;padding:22px;transition:transform .25s,border-color .25s}.proposal:hover{transform:translateY(-4px);border-color:var(--mint)}.proposal-tag{font-size:10px;color:var(--green);font-weight:550}.proposal h3{font-size:15px;font-weight:550;line-height:1.5;margin:12px 0}.proposal p{font-size:12px;color:var(--muted);line-height:1.85}.notes{padding:20px 2px;font-size:11px;color:var(--muted);line-height:1.9}.notes strong{color:var(--ink);font-weight:550}.footer{display:flex;justify-content:space-between;gap:15px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:11px}.footer .logo{font-size:20px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.card,.kpi{animation:appear .6s ease both}.kpi:nth-child(2){animation-delay:.06s}.kpi:nth-child(3){animation-delay:.12s}.kpi:nth-child(4){animation-delay:.18s}@keyframes appear{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  body[data-theme="dark"]{--bg:#131b24;--card:#1c2835;--ink:#d0e2f3;--muted:#aac7e1;--line:#354c64;--soft:#25374a;--green:#a9d4ff;--mint:#5987b9;color-scheme:dark}
  [hidden]{display:none!important}@media(max-width:900px){.grid,.grid.equal{grid-template-columns:1fr}.proposal-grid{grid-template-columns:1fr}.hero{grid-template-columns:1fr}.hero-total{text-align:left}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.hero:after{right:-200px}.wrap{padding:20px}.chart svg{max-height:none}}@media(max-width:500px){.wrap{padding:14px}.hero{padding:27px 23px;border-radius:22px}.hero h1{font-size:29px}.kpi{padding:17px}.kpi strong{font-size:26px}.kpi-icon{display:none}.card{padding:19px}.section-head{flex-wrap:wrap}.topbar{gap:8px}.pill{display:none}.section-nav{top:6px;gap:0;width:100%;justify-content:space-between}.section-nav a{font-size:10px;padding:7px 11px}.toolbar-btn{padding:7px 10px;font-size:11px}.footer{flex-direction:column}.table-search input{width:140px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
  body[data-theme="dark"] :is(.pill.approved,.mode-switch button.active) { background:#a9d4ff;color:#152433;border-color:#a9d4ff }
  body[data-theme="dark"] .kpi-icon { background:#273b50;color:#b2d5f4 }
  body[data-theme="dark"] :is(.toolbar-btn,.chart-legend button) { color:#cee4f8 }
  body[data-theme="dark"] :is(.chart-caption,.report-meta,.kpi p,.bar-line small,.notes) { color:#bbd6ee }
  body[data-theme="dark"] :is(.hero .eyebrow,.hero-description,.hero-total small) { color:#dcecfa }
  .report-embedded .wrap { max-width:none;padding:14px clamp(12px,2vw,26px) 20px }
  .report-embedded .topbar { margin-bottom:12px }
  .report-embedded .hero { padding:clamp(16px,2.3vw,30px);gap:16px }
  .report-embedded .hero-description { margin-top:8px;max-width:62ch }
  .report-embedded .report-meta { margin:11px 3px 12px }
  .report-embedded .section-nav { margin-bottom:12px }
  :root {
    --report-accent:#a52b43;
    --report-wash:#f6f8fc;
    --report-card-radius:24px;
    --report-inner-radius:16px;
  }
  body[data-theme="dark"] {
    --report-accent:#ffa3b4;
    --report-wash:var(--bg);
  }
  .wrap { padding:clamp(18px,3vw,42px); }
  .report-embedded .wrap { padding:clamp(16px,2.5vw,30px); }
  .topbar, .report-embedded .topbar {
    margin-bottom:0;
    padding-bottom:14px;
    border-bottom:1px solid var(--line);
  }
  .topbar .logo { font-size:clamp(16px,2vw,21px); letter-spacing:-.04em; }
  .logo-accent { color:var(--report-accent); }
  .top-actions { flex-wrap:wrap; justify-content:flex-end; }
  .toolbar-btn, .pill { padding:6px 10px; border-radius:999px; }
  .hero, .report-embedded .hero {
    background:var(--card);
    color:var(--ink);
    border:1px solid var(--line);
    border-radius:var(--report-card-radius);
    grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);
    align-items:center;
    gap:clamp(18px,3vw,36px);
    margin-top:18px;
    padding:clamp(18px,3vw,36px);
  }
  .hero::after { content:none; }
  .hero h1 {
    font-size:clamp(27px,4.5vw,48px);
    font-weight:720;
    line-height:1.1;
    letter-spacing:-.05em;
    overflow-wrap:anywhere;
  }
  .hero-description, .report-embedded .hero-description,
  body[data-theme="dark"] .hero .hero-description {
    margin-top:12px;
    color:var(--muted);
    font-size:14px;
  }
  .hero-total {
    text-align:left;
    background:#163453;
    color:#fff;
    border-radius:var(--report-inner-radius);
    border-inline-start:4px solid #d8556c;
    padding:clamp(14px,2.5vw,26px);
    font-variant-numeric:tabular-nums;
  }
  .hero-total strong {
    font-size:clamp(26px,4.6vw,52px);
    line-height:1.12;
    font-weight:700;
    letter-spacing:-.045em;
    margin-block:7px 8px;
    overflow-wrap:anywhere;
  }
  .hero-total span { padding:0; border:0; background:none; color:#dceafa; font-size:12px; }
  .report-meta, .report-embedded .report-meta {
    display:grid;
    grid-template-columns:minmax(0,1.55fr) minmax(0,1fr) minmax(0,1fr);
    gap:12px 22px;
    margin:0 0 20px;
    padding:15px 0 0;
  }
  .report-meta dt { font-size:11px; }
  .report-meta dd { margin:2px 0 0; color:var(--ink); font-weight:600; font-size:12px; }
  .section-nav, .report-embedded .section-nav {
    position:relative;
    top:auto;
    width:fit-content;
    max-width:100%;
    margin:0 0 16px;
    padding:5px;
    justify-content:flex-start;
    gap:4px;
    border:1px solid var(--line);
    border-radius:24px;
    background:var(--card);
    box-shadow:none;
  }
  .section-nav a { padding:7px 13px; border-radius:999px; font-size:13px; font-weight:600; }
  .wrap .section-nav a.active {
    color:var(--ink);
    background:var(--soft) !important;
    box-shadow:inset 0 0 0 1px var(--report-accent) !important;
  }
  .section-nav .motion-active-track { display:none; }
  .kpis { grid-template-columns:repeat(4,minmax(0,1fr)); gap:clamp(10px,1.35vw,16px); }
  .kpi {
    min-width:0;
    padding:clamp(14px,2vw,24px);
    border-radius:var(--report-card-radius);
  }
  .kpi-icon, .rank { border-radius:50%; flex-shrink:0; }
  .kpi-top { color:var(--ink); font-weight:650; }
  .kpi strong {
    margin:6px 0 5px;
    font-size:clamp(24px,3vw,36px);
    font-weight:700;
    font-variant-numeric:tabular-nums;
    overflow-wrap:anywhere;
  }
  .kpi p { font-size:12px; }
  .card { padding:clamp(15px,2.35vw,28px); border-radius:var(--report-card-radius); box-shadow:none; }
  .card h2 { font-size:clamp(18px,2vw,24px); font-weight:700; line-height:1.25; }
  .card .eyebrow { display:none; }
  .section-head p:not(.eyebrow), .chart-caption { font-size:12px; }
  .chart .grid-line { stroke-dasharray:none; }
  .table-card thead { background:var(--soft); }
  .table-wrap, .selection-note, .tooltip { border-radius:var(--report-inner-radius); }
  .table-search input { border-radius:999px; }
  .table-card th { font-size:11px; }
  .table-card :is(td,th):nth-last-child(-n+2) { text-align:right; font-variant-numeric:tabular-nums; }
  .proposal { border-radius:var(--report-inner-radius); background:var(--report-wash); }
  .proposal-tag { color:var(--report-accent); }
  .notes { font-size:12px; }
  @media(max-width:760px) {
    .hero, .report-embedded .hero, .report-meta { grid-template-columns:1fr; }
    .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .section-nav a { padding-inline:10px; font-size:12px; }
  }
  @media print{body{background:white;color:#1f2e3f}.wrap{padding:0;max-width:none}.top-actions,.section-nav,.mode-switch,.table-search,.selection-note,.tooltip{display:none!important}.hero{print-color-adjust:exact;-webkit-print-color-adjust:exact}.card,.kpi,.proposal{break-inside:avoid;box-shadow:none;animation:none}.grid,.grid.equal{grid-template-columns:1fr 1fr}.kpis{grid-template-columns:repeat(4,1fr)}.proposal-grid{grid-template-columns:1fr}.chart{min-height:180px}.card{padding:16px}.hero{padding:24px}.hero-total strong{font-size:36px}.bar-fill{animation:none}a{color:inherit}body[data-theme="dark"]{--bg:#ffffff;--card:#ffffff;--ink:#1f2e3f;--muted:#445970;--line:#c9d9e8;--soft:#ecf3f9;--green:#174973}}
  </style></head><body${embedded ? ' class="report-embedded"' : ''}><main class="wrap"><header class="topbar"><a class="logo" href="#">DuyTruong Insight<span class="logo-accent">.</span></a><div class="top-actions"><span class="pill approved">Đã nghiệm thu</span><button class="toolbar-btn" id="reportTheme" aria-label="Đổi giao diện sáng tối">Sáng / tối</button><button class="toolbar-btn" id="reportPrint">In báo cáo ↗</button></div></header>
  <section class="hero" aria-labelledby="reportTitle">
    <div><h1 id="reportTitle">Báo cáo kinh doanh</h1><p class="hero-description">Tổng hợp kết quả trong kỳ từ dữ liệu đã được làm sạch và kiểm duyệt.</p></div>
    <div class="hero-total"><small>TỔNG DOANH THU TRONG KỲ</small><strong>${money(m.totalRev)}</strong><span>${count(m.orderCount)} đơn được tính · ${count(m.uniqueCustomers)} khách hàng</span></div>
  </section>
  <dl class="report-meta">
    <div><dt>Nguồn dữ liệu</dt><dd>${esc(payload.fileName)}${payload.sheetName ? ' · Sheet: '+esc(payload.sheetName):''}</dd></div>
    <div><dt>Kỳ báo cáo</dt><dd>${esc(range)}</dd></div>
    <div><dt>Thời điểm xuất</dt><dd>${esc(payload.generatedAt)}</dd></div>
  </dl>
  <nav class="section-nav" aria-label="Mục báo cáo"><a href="#overview">Tổng quan</a><a href="#charts">Biểu đồ</a><a href="#rankings">Xếp hạng</a><a href="#recommendations">Đề xuất</a></nav>
  <section class="kpis" id="overview"><article class="kpi"><div class="kpi-top">Lợi nhuận ước tính <span class="kpi-icon">↗</span></div><strong>${money(m.estimatedProfit)}</strong><p>Biên lợi nhuận ${Math.round(m.profitMargin*100)}% do người dùng chọn</p></article><article class="kpi"><div class="kpi-top">Đơn hàng được tính <span class="kpi-icon">▤</span></div><strong>${count(m.orderCount)}</strong><p>${payload.excludeCanceled?'Loại trừ':'Bao gồm'} đơn hủy khi tính tài chính</p></article><article class="kpi"><div class="kpi-top">Giá trị đơn trung bình <span class="kpi-icon">◇</span></div><strong>${money(m.aov)}</strong><p>Doanh thu / số đơn được tính</p></article><article class="kpi"><div class="kpi-top">Khách hàng duy nhất <span class="kpi-icon">◎</span></div><strong>${count(m.uniqueCustomers)}</strong><p>${esc(m.repeatRate)}% khách mua từ 2 đơn</p></article></section>
  <div class="selection-note" id="reportSelection" role="status">Rê chuột hoặc dùng phím Tab để xem số liệu · Bấm vào biểu đồ để ghim thông tin.</div>
  <div class="grid" id="charts"><section class="card"><div class="section-head"><div><p class="eyebrow">REVENUE PULSE</p><h2>Nhịp doanh thu &amp; lợi nhuận</h2><p>Gom theo ${m.period==='month'?'tháng':m.period==='week'?'tuần':'ngày'} trong kỳ đã nghiệm thu</p></div><div class="mode-switch" aria-label="Chọn chuỗi biểu đồ"><button class="active" data-mode="both" aria-pressed="true">Cả hai</button><button data-mode="revenue" aria-pressed="false">Doanh thu</button><button data-mode="profit" aria-pressed="false">Lợi nhuận</button></div></div><div class="chart" id="reportTrend"></div><p class="chart-caption">Rê chuột lên từng điểm để so sánh · Hiển thị tối đa 24 mốc cuối kỳ; KPI tính trên toàn bộ kỳ.</p></section><section class="card"><div class="section-head"><div><p class="eyebrow">ORDER HEALTH</p><h2>Trạng thái đơn hàng</h2><p>${count(m.allCount)} bản ghi trong kỳ · ${esc(m.completionRate)}% hoàn tất / đang giao</p></div></div><div class="chart donut-wrap" id="reportStatus"></div><div class="chart-legend" id="reportStatusLegend"></div></section></div>
  <div class="grid equal"><section class="card"><div class="section-head"><div><p class="eyebrow">PRODUCT MIX</p><h2>Sản phẩm đóng góp doanh thu</h2><p>8 nhóm dẫn đầu · rê chuột để xem số đơn</p></div></div><div id="reportProducts" class="bars"></div></section><section class="card"><div class="section-head"><div><p class="eyebrow">ORDER VALUE</p><h2>Phân bố giá trị đơn hàng</h2><p>Số đơn theo khoảng doanh thu</p></div></div><div class="chart" id="reportDistribution"></div></section></div>
  <div class="grid equal" id="rankings">${table('Khách hàng giá trị cao','reportCustomers',m.topCustomers || [])}<section class="card"><div class="section-head"><div><p class="eyebrow">REGIONAL PERFORMANCE</p><h2>Doanh thu theo khu vực</h2><p>Phân bổ thực tế theo cột khu vực trong bảng tính</p></div></div><div id="reportRegions" class="bars"></div></section></div>
  ${table('Top sản phẩm / dịch vụ','reportProductTable',m.topProducts || [])}
  <section class="card proposals" id="recommendations"><div class="section-head"><div><p class="eyebrow">NEXT OPPORTUNITIES</p><h2>Đề Xuất Kinh Doanh</h2><p>Gợi ý dựa trên số liệu của kỳ đã chọn; cần đánh giá thêm trước khi triển khai.</p></div></div><div class="proposal-grid">${(m.proposals||[]).map((p,i)=>`<article class="proposal"><span class="proposal-tag">0${i+1} / ${esc(p.tag || 'Gợi ý hành động')}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p></article>`).join('')}</div></section>
  <aside class="notes"><p><strong>Nghiệm thu nội bộ:</strong> ${esc(payload.reviewer || 'Người kiểm duyệt')} · ${esc(payload.generatedAt)}.</p><p><strong>Bộ lọc liên kết:</strong> ${Object.entries(payload.linkedFilters || {}).map(([key,value])=>esc(key)+': '+esc(typeof value==='object'?JSON.stringify(value):value)).join(' · ') || 'Không áp dụng'}.</p><p><strong>Phạm vi:</strong> ${esc(range)}. Doanh thu ${payload.excludeCanceled?'loại trừ':'bao gồm'} đơn hủy. Biểu đồ trạng thái phản ánh toàn bộ ${count(m.allCount)} bản ghi trong kỳ. Bản ghi thiếu ngày chỉ được tính khi chọn toàn bộ thời gian.</p><p><strong>Giả định:</strong> Lợi nhuận là ước tính theo biên ${Math.round(m.profitMargin*100)}%; các mục tiêu tăng trưởng là kịch bản kế hoạch, chưa phải dự báo kiểm chứng.</p><p><strong>Định dạng:</strong> Báo cáo tương tác độc lập, xem được khi không có mạng. Thao tác biểu đồ chỉ thay đổi cách hiển thị.</p></aside><footer class="footer"><span class="logo">DuyTruong Insight.</span><span>Data → Clarity → Action · Báo cáo đã nghiệm thu · ${esc(payload.generatedAt)}</span></footer></main><div id="reportTooltip" class="tooltip" role="tooltip" hidden></div>
  <script>${typeof installSmoothMotion === 'function' ? '('+installSmoothMotion.toString()+')();' : ''}(${standaloneReportRuntime.toString()})(${serialized});${embedded ? ';('+observeEmbeddedReport.toString()+')();' : ''}</script></body></html>`;
}

function standaloneReportRuntime(payload) {
  'use strict';
  const m=payload.metrics, data=m.explorations || {products:[],regions:[],bins:[]};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>'$'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:0});
  const colors=['#174973','#4b7cb1','#8bb5e2','#a9d4ff','#547599','#435e7b'];
  const mark=(tip,kind='')=>`class="plot-mark ${kind}" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}"`;
  let mode='both';
  function trend() {
    const series=(m.series||[]).slice(-24);
    if(!series.length){$('reportTrend').innerHTML='<p class="empty">Chưa có dữ liệu trong kỳ.</p>';return;}
    const w=720,h=260,left=52,right=18,top=24,bottom=40,pw=w-left-right,ph=h-top-bottom;
    const max=Math.max(1,...series.map(s=>s.revenue));
    const x=i=>left+(series.length===1?pw/2:i*pw/(series.length-1)), y=value=>top+ph-value/max*ph;
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Doanh thu và lợi nhuận trong kỳ"><defs><linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#174973" stop-opacity=".18"/><stop offset="100%" stop-color="#174973" stop-opacity="0"/></linearGradient></defs>`;
    for(let i=0;i<=3;i++){const yy=top+ph*i/3,value=max*(1-i/3);svg+=`<line class="grid-line" x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}"/><text x="${left-9}" y="${yy+4}" text-anchor="end">${value>=1000?(value/1000).toFixed(0)+'k':Math.round(value)}</text>`;}
    const line=ratio=>series.map((s,i)=>`${i?'L':'M'}${x(i)},${y(s.revenue*ratio)}`).join(' ');
    if(mode!=='profit') svg+=`<path d="${line(1)} L${x(series.length-1)},${top+ph} L${x(0)},${top+ph}Z" fill="url(#trendArea)"/><path d="${line(1)}" fill="none" stroke="#174973" stroke-width="3" stroke-linejoin="round"/>`;
    if(mode!=='revenue') svg+=`<path d="${line(m.profitMargin)}" fill="none" stroke="#3f73ab" stroke-width="2.5" stroke-dasharray="5 5"/>`;
    series.forEach((s,i)=>{const tip=`${s.label}\nDoanh thu ${money(s.revenue)}\nLợi nhuận ước tính ${money(s.revenue*m.profitMargin)}`;if(mode!=='profit')svg+=`<circle ${mark(tip)} cx="${x(i)}" cy="${y(s.revenue)}" r="5" fill="#174973" stroke="white" stroke-width="2"/>`;if(mode==='profit')svg+=`<circle ${mark(tip)} cx="${x(i)}" cy="${y(s.revenue*m.profitMargin)}" r="5" fill="#3f73ab"/>`;if(i===0||i===series.length-1||i%Math.ceil(series.length/5)===0)svg+=`<text x="${x(i)}" y="${h-10}" text-anchor="middle">${esc(s.label)}</text>`;});
    $('reportTrend').innerHTML=svg+'</svg>';
    window.SmoothMotion?.watchSVG($('reportTrend'),'report-trend:'+mode);
  }
  function status() {
    const entries=Object.entries(m.statusMap||{}),total=entries.reduce((sum,e)=>sum+e[1],0),r=76,circ=2*Math.PI*r;
    if(!total){$('reportStatus').innerHTML='<p class="empty">Chưa có dữ liệu trong kỳ.</p>';return;}
    let offset=0,svg='<svg viewBox="0 0 300 220" role="img" aria-label="Cơ cấu trạng thái"><circle cx="150" cy="105" r="76" fill="none" stroke="var(--soft)" stroke-width="28"/>';
    entries.forEach(([label,value],i)=>{const len=value/total*circ;svg+=`<circle ${mark(`${label}: ${value} đơn (${(value/total*100).toFixed(1)}%)`)} data-series="${i}" cx="150" cy="105" r="${r}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="28" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 150 105)"/>`;offset+=len;});
    svg+=`<text class="donut-total" x="150" y="108" text-anchor="middle">${total.toLocaleString()}</text><text x="150" y="132" text-anchor="middle">đơn hàng trong kỳ</text></svg>`;
    $('reportStatus').innerHTML=svg;
    $('reportStatusLegend').innerHTML=entries.map(([label,value],i)=>`<button data-highlight="${i}" aria-pressed="false"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${esc(label)} · ${value}</button>`).join('');
  }
  function bars(id,items) {
    if(!items.length){$(id).innerHTML='<p class="empty">Không có dữ liệu phù hợp hoặc chưa có cột tương ứng.</p>';return;}
    const max=Math.max(1,...items.map(p=>p.revenue));
    $(id).innerHTML=items.slice(0,8).map(p=>`<div ${mark(`${p.name}\n${money(p.revenue)} · ${p.orders} đơn`,'bar-line')}><div class="bar-info"><span>${esc(p.name)}</span><strong>${money(p.revenue)}</strong></div><div class="bar-track"><span class="bar-fill" style="width:${Math.max(0,p.revenue/max*100)}%"></span></div><small>${p.orders} đơn · ${m.totalRev?(p.revenue/m.totalRev*100).toFixed(1):0}% doanh thu</small></div>`).join('');
  }
  function distribution() {
    const bins=data.bins||[],max=Math.max(1,...bins.map(b=>b.count));
    if(!bins.length||!m.orderCount){$('reportDistribution').innerHTML='<p class="empty">Chưa có đơn hàng trong kỳ.</p>';return;}
    let svg='<svg viewBox="0 0 600 260" role="img" aria-label="Phân bố giá trị đơn hàng">';
    for(let i=0;i<4;i++){const y=25+i*60;svg+=`<line class="grid-line" x1="35" x2="590" y1="${y}" y2="${y}"/><text x="25" y="${y+4}" text-anchor="end">${Math.round(max*(1-i/3))}</text>`;}
    bins.forEach((b,i)=>{const x=47+i*90,height=b.count/max*180;svg+=`<rect ${mark(`${money(b.from)} – ${money(b.to)}${i===5?' (gồm trần)':' (không gồm trần)'}\n${b.count} đơn`)} x="${x}" y="${205-height}" width="61" height="${Math.max(1,height)}" rx="9" fill="${i%2?'#174973':'#709fd2'}"/><text x="${x+30}" y="228" text-anchor="middle">${money(b.from)}</text><text x="${x+30}" y="${195-height}" text-anchor="middle">${b.count}</text>`;});
    $('reportDistribution').innerHTML=svg+'</svg>';
  }
  trend();status();bars('reportProducts',data.products||[]);bars('reportRegions',data.regions||[]);distribution();
  ['reportStatus','reportProducts','reportRegions','reportDistribution'].forEach(id=>window.SmoothMotion?.watchSVG($(id),id));
  const tooltip=$('reportTooltip');
  function showTip(target,x,y){tooltip.textContent=target.dataset.tip;tooltip.hidden=false;tooltip.style.left=Math.max(12,Math.min(x+14,window.innerWidth-340))+'px';tooltip.style.top=Math.max(12,Math.min(y+14,window.innerHeight-tooltip.offsetHeight-12))+'px';}
  document.addEventListener('pointermove',event=>{const target=event.target.closest('[data-tip]');if(target)showTip(target,event.clientX,event.clientY);else tooltip.hidden=true;});
  document.addEventListener('focusin',event=>{const target=event.target.closest('[data-tip]');if(target){const box=target.getBoundingClientRect();showTip(target,box.left,box.top);}});
  document.addEventListener('focusout',()=>tooltip.hidden=true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')tooltip.hidden=true;});
  document.addEventListener('click',event=>{
    const mark=event.target.closest('[data-tip]');if(mark)$('reportSelection').textContent='Đang xem: '+mark.dataset.tip.replace(/\n/g,' · ');
    const button=event.target.closest('[data-mode]');if(button){mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el===button);el.setAttribute('aria-pressed',String(el===button));});trend();}
    const legend=event.target.closest('[data-highlight]');if(legend){const active=legend.classList.contains('active');document.querySelectorAll('[data-highlight]').forEach(el=>{el.classList.toggle('active',!active&&el===legend);el.setAttribute('aria-pressed',String(!active&&el===legend));});document.querySelectorAll('[data-series]').forEach(el=>el.style.opacity=active||el.dataset.series===legend.dataset.highlight?'1':'.18');}
  });
  document.querySelectorAll('[data-table]').forEach(input=>input.addEventListener('input',()=>{const section=$(input.dataset.table),query=input.value.toLowerCase();let visible=0;section.querySelectorAll('tbody tr').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query);if(!row.hidden)visible++;});section.querySelector('.table-search-empty').hidden=visible>0;}));
  $('reportTheme').addEventListener('click',()=>document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark');
  $('reportPrint').addEventListener('click',()=>window.print());
}

function observeEmbeddedReport() {
  const report = document.querySelector('.wrap');
  if (!report || typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(() => {
    window.parent.postMessage({type:'duytruong-report-size', height:Math.ceil(report.getBoundingClientRect().bottom + window.scrollY)}, '*');
  });
  observer.observe(report);
  report.querySelectorAll('.section-nav a').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      window.parent.postMessage({type:'duytruong-report-jump', top:target.getBoundingClientRect().top + window.scrollY}, '*');
    });
  });
}
