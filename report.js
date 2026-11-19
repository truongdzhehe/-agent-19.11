/* A self-contained, offline report: all charts are SVG, no remote dependencies. */
function buildStandaloneReport(payload, {embedded = false} = {}) {
  const m=payload.metrics;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (m.table) return buildTableReport(payload, esc, embedded);
  const money=value=>'$'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:0});
  const count=value=>Number(value||0).toLocaleString('vi-VN');
  const percent=(part,total)=>(part / total).toLocaleString('vi-VN',{style:'percent',maximumFractionDigits:1});
  const empty='Chưa đủ dữ liệu trong kỳ để đưa ra nhận định.';
  const note=text=>`<aside class="chart-insight"><h3>Nhận định</h3><p>${esc(text)}</p></aside>`;
  const highest=(items,key)=>items.reduce((best,item)=>!best || item[key]>best[key]?item:best,null);
  const explorations=m.explorations || {};
  const series=(m.series || []).slice(-24);
  const peak=highest(series,'revenue');
  const previous=series.at(-2), latest=series.at(-1);
  const difference=previous ? latest.revenue-previous.revenue : 0;
  const comparison=previous
    ? ` Ở mốc ${latest.label}, doanh thu ${difference ? `${difference>0?'tăng':'giảm'} ${money(Math.abs(difference))}` : 'bằng'} so với mốc ${previous.label}.`
    : '';
  const trendNote=peak
    ? `Doanh thu cao nhất trong các mốc hiển thị là ${money(peak.revenue)} tại ${peak.label}, tương ứng lợi nhuận ước tính ${money(peak.revenue*m.profitMargin)}.${comparison}`
    : empty;

  const statuses=Object.entries(m.statusMap || {}).map(([name,orders])=>({name,orders}));
  const statusTotal=statuses.reduce((sum,item)=>sum+item.orders,0);
  const leadStatus=highest(statuses,'orders');
  const statusNote=statusTotal>0
    ? `Trạng thái “${leadStatus.name}” có ${count(leadStatus.orders)} đơn, mức cao nhất, chiếm ${percent(leadStatus.orders,statusTotal)} trong tổng số ${count(statusTotal)} đơn trên biểu đồ.`
    : empty;

  function revenueNote(items, group, noData=empty) {
    const leader=highest((items || []).slice(0,8),'revenue');
    if(!leader) return noData;
    const share=m.totalRev>0 ? ` Số này chiếm ${percent(leader.revenue,m.totalRev)} doanh thu trong kỳ.` : '';
    return `${group} “${leader.name}” đạt doanh thu cao nhất trong các nhóm hiển thị, với ${money(leader.revenue)} từ ${count(leader.orders)} đơn.${share}`;
  }

  const products=explorations.products || [];
  const productNote=products.length===1 && products[0].name==='Chưa có cột sản phẩm'
    ? 'Bảng tính chưa có cột sản phẩm, nên chưa thể so sánh doanh thu giữa các sản phẩm.'
    : revenueNote(products,'Sản phẩm');
  const regionNote=revenueNote(explorations.regions,'Khu vực',explorations.regionAvailable===false
    ? 'Bảng tính chưa có cột khu vực, nên chưa thể so sánh doanh thu theo khu vực.'
    : empty);
  const bins=explorations.bins || [];
  const busiest=highest(bins,'count');
  const binTotal=bins.reduce((sum,bin)=>sum+bin.count,0);
  const distributionNote=binTotal>0
    ? `Khoảng giá trị đơn có nhiều đơn nhất là từ ${money(busiest.from)} đến ${money(busiest.to)} (${busiest===bins.at(-1)?'gồm':'chưa gồm'} mức trên). Khoảng này có ${count(busiest.count)} đơn, chiếm ${percent(busiest.count,binTotal)} số đơn trên biểu đồ.`
    : empty;

  const range=`${payload.dateRange?.from || 'Đầu dữ liệu'} → ${payload.dateRange?.to || 'Cuối dữ liệu'}`;
  const ranks=(items)=>items.map((item,i)=>`<tr><td><span class="rank">${String(i+1).padStart(2,'0')}</span></td><td>${esc(item.name)}</td><td>${count(item.orders)}</td><td>${money(item.revenue)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Chưa có dữ liệu trong kỳ.</td></tr>';
  const table=(title,id,items)=>`<section class="card table-card" id="${id}"><div class="section-head"><div><p class="eyebrow">TOP PERFORMERS</p><h2>${title}</h2></div><label class="table-search"><span class="sr-only">Tìm trong ${title}</span><input type="search" data-table="${id}" placeholder="Tìm tên…"></label></div><div class="table-wrap"><table><thead><tr><th>Hạng</th><th>Tên</th><th>Số đơn</th><th>Doanh thu</th></tr></thead><tbody>${ranks(items)}</tbody></table></div><p class="table-search-empty" hidden>Không tìm thấy kết quả phù hợp.</p></section>`;
  const serialized=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const header = reportHeading(payload, esc, {
    title: 'Báo cáo kinh doanh',
    description: 'Tổng hợp kết quả trong kỳ từ dữ liệu đã được làm sạch và kiểm duyệt.',
    label: 'Tổng doanh thu trong kỳ',
    value: money(m.totalRev),
    detail: count(m.orderCount) + ' đơn được tính · ' + (m.unknownCustomerOrders && !m.uniqueCustomers
      ? 'Khách hàng chưa xác định' : count(m.uniqueCustomers) + ' khách hàng'),
    range,
    sections: [['overview', 'Tổng quan'], ['charts', 'Biểu đồ'], ['rankings', 'Xếp hạng'], ['recommendations', 'Đề xuất']]
  });
  const content = `${header}
  <section class="kpis" id="overview"><article class="kpi"><div class="kpi-top">Lợi nhuận ước tính <span class="kpi-icon">↗</span></div><strong>${money(m.estimatedProfit)}</strong><p>Biên lợi nhuận ${Math.round(m.profitMargin*100)}% do người dùng chọn</p></article><article class="kpi"><div class="kpi-top">Đơn hàng được tính <span class="kpi-icon">▤</span></div><strong>${count(m.orderCount)}</strong><p>${payload.excludeCanceled?'Loại trừ':'Bao gồm'} đơn hủy khi tính tài chính</p></article><article class="kpi"><div class="kpi-top">Giá trị đơn trung bình <span class="kpi-icon">◇</span></div><strong>${money(m.aov)}</strong><p>Doanh thu / số đơn được tính</p></article><article class="kpi"><div class="kpi-top">Khách hàng duy nhất <span class="kpi-icon">◎</span></div><strong>${m.unknownCustomerOrders && !m.uniqueCustomers ? "—" : count(m.uniqueCustomers)}</strong><p>${m.uniqueCustomers ? esc(m.repeatRate) + "% khách có mã mua từ 2 đơn" : "Chưa đủ dữ liệu để tính tỷ lệ mua lại"}${m.unknownCustomerOrders ? " · " + count(m.unknownCustomerOrders) + " đơn chưa xác định khách" : ""}</p></article></section>
  <div class="selection-note" id="reportSelection" role="status">Rê chuột hoặc dùng phím Tab để xem số liệu · Bấm vào biểu đồ để ghim thông tin.</div>
  <div class="grid report-chart-grid" id="charts"><section class="card"><div class="section-head"><div><p class="eyebrow">REVENUE PULSE</p><h2>Nhịp doanh thu &amp; lợi nhuận</h2><p>Gom theo ${m.period==='month'?'tháng':m.period==='week'?'tuần':'ngày'} trong kỳ đã nghiệm thu</p></div><div class="mode-switch" aria-label="Chọn chuỗi biểu đồ"><button class="active" data-mode="both" aria-pressed="true">Cả hai</button><button data-mode="revenue" aria-pressed="false">Doanh thu</button><button data-mode="profit" aria-pressed="false">Lợi nhuận</button></div></div><div class="chart-with-insight"><div><div class="chart" id="reportTrend"></div><p class="chart-caption">Rê chuột lên từng điểm để so sánh · Hiển thị tối đa 24 mốc cuối kỳ; KPI tính trên toàn bộ kỳ.</p></div>${note(trendNote)}</div></section><section class="card"><div class="section-head"><div><p class="eyebrow">ORDER HEALTH</p><h2>Trạng thái đơn hàng</h2><p>${count(m.allCount)} bản ghi trong kỳ · ${esc(m.completionRate)}% hoàn tất / đang giao</p></div></div><div class="chart-with-insight"><div><div class="chart donut-wrap" id="reportStatus"></div><div class="chart-legend" id="reportStatusLegend"></div></div>${note(statusNote)}</div></section></div>
  <div class="grid report-chart-grid"><section class="card"><div class="section-head"><div><p class="eyebrow">PRODUCT MIX</p><h2>Sản phẩm đóng góp doanh thu</h2><p>8 nhóm dẫn đầu · rê chuột để xem số đơn</p></div></div><div class="chart-with-insight"><div><div id="reportProducts" class="bars"></div></div>${note(productNote)}</div></section><section class="card"><div class="section-head"><div><p class="eyebrow">ORDER VALUE</p><h2>Phân bố giá trị đơn hàng</h2><p>Số đơn theo khoảng doanh thu</p></div></div><div class="chart-with-insight"><div><div class="chart" id="reportDistribution"></div></div>${note(distributionNote)}</div></section></div>
  <div class="grid equal" id="rankings">${table('Khách hàng giá trị cao','reportCustomers',m.topCustomers || [])}<section class="card"><div class="section-head"><div><p class="eyebrow">REGIONAL PERFORMANCE</p><h2>Doanh thu theo khu vực</h2><p>Phân bổ thực tế theo cột khu vực trong bảng tính</p></div></div><div class="chart-with-insight"><div><div id="reportRegions" class="bars"></div></div>${note(regionNote)}</div></section></div>
  ${table('Top sản phẩm / dịch vụ','reportProductTable',m.topProducts || [])}
  <section class="card proposals" id="recommendations"><div class="section-head"><div><p class="eyebrow">NEXT OPPORTUNITIES</p><h2>Đề Xuất Kinh Doanh</h2><p>Gợi ý dựa trên số liệu của kỳ đã chọn; cần đánh giá thêm trước khi triển khai.</p></div></div><div class="proposal-grid">${(m.proposals||[]).map((p,i)=>`<article class="proposal"><span class="proposal-tag">0${i+1} / ${esc(p.tag || 'Gợi ý hành động')}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p></article>`).join('')}</div></section>
  <aside class="notes"><p><strong>Nghiệm thu nội bộ:</strong> ${esc(payload.reviewer || 'Người kiểm duyệt')} · ${esc(payload.generatedAt)}.</p><p><strong>Bộ lọc liên kết:</strong> ${Object.entries(payload.linkedFilters || {}).map(([key,value])=>esc(key)+': '+esc(typeof value==='object'?JSON.stringify(value):value)).join(' · ') || 'Không áp dụng'}.</p><p><strong>Phạm vi:</strong> ${esc(range)}. Doanh thu ${payload.excludeCanceled?'loại trừ':'bao gồm'} đơn hủy. Biểu đồ trạng thái phản ánh toàn bộ ${count(m.allCount)} bản ghi trong kỳ. Bản ghi thiếu ngày chỉ được tính khi chọn toàn bộ thời gian.</p><p><strong>Giả định:</strong> Lợi nhuận là ước tính theo biên ${Math.round(m.profitMargin*100)}%; các mục tiêu tăng trưởng là kịch bản kế hoạch, chưa phải dự báo kiểm chứng.</p><p><strong>Định dạng:</strong> Báo cáo tương tác độc lập, xem được khi không có mạng. Thao tác biểu đồ chỉ thay đổi cách hiển thị.</p></aside><footer class="footer"><span class="logo">DuyTruong Insight.</span><span>Data → Clarity → Action · Báo cáo đã nghiệm thu · ${esc(payload.generatedAt)}</span></footer>`;
  return reportDocument(content, `(${standaloneReportRuntime.toString()})(${serialized});(${reportInteractions.toString()})();`,
    esc, 'Báo cáo kinh doanh', embedded);

}

const standaloneReportStyles = `
  :root{--bg:#e4edf5;--card:#ffffff;--ink:#1f2e3f;--muted:#445970;--line:#c9d9e8;--soft:#ecf3f9;--green:#174973;--mint:#709fd2;--gold:#72a3d7;--shadow:0 8px 35px #1b29370a;color-scheme:light}
  *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.65 'Segoe UI',Arial,sans-serif;letter-spacing:-.015em}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,.plot-mark:focus-visible{outline:3px solid #709fd2;outline-offset:4px}a{color:inherit;text-decoration:none}h1,h2,h3,p{margin:0}button{border:0}.wrap{max-width:1360px;margin:auto;padding:26px 34px 38px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}.logo{font-size:27px;font-weight:800;color:var(--green);letter-spacing:-1.3px}.top-actions{display:flex;align-items:center;gap:9px}.pill,.toolbar-btn{font-size:12px;padding:8px 14px;border-radius:100px;background:var(--card);border:1px solid var(--line);color:var(--muted)}.approved{color:var(--green);background:#d4e5f4}.approved:before{content:'';display:inline-block;width:6px;height:6px;background:#174973;border-radius:50%;margin-right:6px}.toolbar-btn:hover{color:var(--green);border-color:var(--mint)}
  .hero{position:relative;overflow:hidden;background:linear-gradient(115deg,#1e2d3d,#2e4863 75%,#3a6798);border-radius:28px;color:white;padding:40px 42px;display:grid;grid-template-columns:1.3fr 1fr;gap:30px}.hero:after{content:'';position:absolute;width:420px;height:420px;border:1px solid #ffffff15;border-radius:50%;right:-140px;top:-220px;box-shadow:0 0 0 40px #ffffff05,0 0 0 85px #ffffff04;pointer-events:none}.eyebrow{font-size:10px;font-weight:650;letter-spacing:.15em;color:var(--muted);text-transform:uppercase;margin-bottom:7px}.hero .eyebrow{color:#a9d4ff}.hero h1{font-size:clamp(25px,3vw,42px);font-weight:450;letter-spacing:-1.6px;line-height:1.25;max-width:600px}.hero-description{color:#bfdaf2;font-size:13px;margin-top:15px;max-width:440px}.hero-total{align-self:center;position:relative;z-index:1;text-align:right}.hero-total small{display:block;font-size:12px;color:#bfdaf2}.hero-total strong{display:block;font-size:clamp(36px,4.3vw,63px);font-weight:400;letter-spacing:-2px;line-height:1.4}.hero-total span{display:inline-block;font-size:11px;border:1px solid #ffffff28;border-radius:30px;padding:5px 12px;background:#ffffff0a}.report-meta{display:flex;gap:10px 20px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin:18px 3px 22px;overflow-wrap:anywhere}.report-meta strong{color:var(--ink);font-weight:550}
  .section-nav{position:sticky;top:12px;z-index:20;display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:7px;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);margin-bottom:22px;width:fit-content}.section-nav a{font-size:12px;padding:8px 18px;border-radius:12px;color:var(--muted)}.section-nav a:hover{background:var(--soft);color:var(--green)}.section-nav a:first-child{background:#d8e7f4;color:#174973}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.kpi{background:var(--card);padding:23px;border:1px solid var(--line);border-radius:21px;box-shadow:var(--shadow)}.kpi-top{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted)}.kpi-icon{font-size:18px;color:var(--green);width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:#ddebf7}.kpi strong{font-size:31px;font-weight:500;letter-spacing:-1px;display:block;margin:12px 0 4px}.kpi p{font-size:11px;color:var(--muted)}.grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:20px;margin-bottom:20px}.grid.equal{grid-template-columns:repeat(2,minmax(0,1fr))}.card{background:var(--card);border:1px solid var(--line);border-radius:23px;padding:25px;min-width:0;box-shadow:var(--shadow)}.section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:20px}h2{font-size:17px;font-weight:600;letter-spacing:-.45px}.section-head p:not(.eyebrow){font-size:11px;color:var(--muted);margin-top:4px}.mode-switch{display:flex;gap:3px;border:1px solid var(--line);background:var(--soft);padding:4px;border-radius:30px;flex-wrap:wrap}.mode-switch button{font-size:10px;color:var(--muted);background:none;padding:6px 10px;border-radius:20px;white-space:nowrap}.mode-switch button.active{background:var(--green);color:#ffffff}.chart{min-height:240px;position:relative}.chart svg{display:block;width:100%;height:auto;max-height:300px;overflow:visible}.chart text{font-family:inherit;fill:var(--muted);font-size:11px}.chart .grid-line{stroke:var(--line);stroke-dasharray:3 5}.plot-mark{cursor:crosshair;transition:opacity .2s,filter .2s,stroke-width .2s}.plot-mark:hover,.plot-mark:focus{filter:brightness(.91);outline:none;stroke:#1e2d3d;stroke-width:2}.chart-caption{font-size:10px;color:var(--muted);margin-top:14px}.chart-legend{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:12px}.chart-legend button{background:var(--soft);color:var(--muted);font-size:11px;border:1px solid var(--line);padding:6px 10px;border-radius:20px}.chart-legend button:hover,.chart-legend button.active{border-color:var(--mint);color:var(--green)}.legend-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}.empty{padding:45px 16px;text-align:center;color:var(--muted);font-size:12px}.donut-wrap{display:grid;place-items:center}.donut-wrap svg{max-height:240px}.donut-total{font-size:30px!important;fill:var(--ink)!important;font-weight:500}.bars{display:flex;flex-direction:column;gap:18px}.bar-line{position:relative;cursor:crosshair;border-radius:9px}.bar-info{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:7px}.bar-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-info strong{font-weight:550;white-space:nowrap}.bar-track{height:9px;border-radius:20px;background:var(--soft);overflow:hidden}.bar-fill{display:block;height:100%;border-radius:20px;background:var(--mint);transform-origin:left;animation:barGrow .8s ease both}.bar-line:hover .bar-fill,.bar-line:focus .bar-fill{background:var(--green)}.bar-line small{color:var(--muted);font-size:10px}.tooltip{position:fixed;z-index:60;max-width:min(330px,calc(100vw - 28px));padding:12px 16px;background:#1c2a39;color:#deedfb;border-radius:13px;font-size:12px;line-height:1.6;box-shadow:0 10px 30px #1a293825;pointer-events:none;white-space:pre-line}.selection-note{padding:11px 16px;color:var(--green);border:1px solid var(--line);background:var(--soft);border-radius:13px;margin:0 0 20px;font-size:11px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:380px;font-size:12px}th{text-align:left;color:var(--muted);font-size:10px;font-weight:550;padding:10px 8px;border-bottom:1px solid var(--line)}td{padding:13px 8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}td:last-child,th:last-child{text-align:right}td:last-child{font-weight:600}tr:last-child td{border:0}tbody tr:hover{background:var(--soft)}.rank{font-size:10px;color:var(--muted);display:grid;place-items:center;width:25px;height:25px;background:var(--soft);border-radius:8px}.table-search input{width:135px;border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:8px 11px;color:var(--ink);font-size:11px}.table-search-empty{font-size:12px;padding:18px;color:var(--muted)}.proposals{margin-top:8px}.proposal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.proposal{background:var(--soft);border:1px solid var(--line);border-radius:18px;padding:22px;transition:transform .25s,border-color .25s}.proposal:hover{transform:translateY(-4px);border-color:var(--mint)}.proposal-tag{font-size:10px;color:var(--green);font-weight:550}.proposal h3{font-size:15px;font-weight:550;line-height:1.5;margin:12px 0}.proposal p{font-size:12px;color:var(--muted);line-height:1.85}.notes{padding:20px 2px;font-size:11px;color:var(--muted);line-height:1.9}.notes strong{color:var(--ink);font-weight:550}.footer{display:flex;justify-content:space-between;gap:15px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:11px}.footer .logo{font-size:20px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.card,.kpi{animation:appear .6s ease both}.kpi:nth-child(2){animation-delay:.06s}.kpi:nth-child(3){animation-delay:.12s}.kpi:nth-child(4){animation-delay:.18s}@keyframes appear{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  body[data-theme="dark"]{--bg:#131b24;--card:#1c2835;--ink:#d0e2f3;--muted:#aac7e1;--line:#354c64;--soft:#25374a;--green:#a9d4ff;--mint:#5987b9;color-scheme:dark}
  [hidden]{display:none!important}@media(max-width:900px){.grid,.grid.equal{grid-template-columns:1fr}.proposal-grid{grid-template-columns:1fr}.hero{grid-template-columns:1fr}.hero-total{text-align:left}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.hero:after{right:-200px}.wrap{padding:20px}.chart svg{max-height:none}}@media(max-width:500px){.wrap{padding:14px}.hero{padding:27px 23px;border-radius:22px}.hero h1{font-size:29px}.kpi{padding:17px}.kpi strong{font-size:26px}.kpi-icon{display:none}.card{padding:19px}.section-head{flex-wrap:wrap}.topbar{gap:8px}.pill{display:none}.section-nav{top:6px;gap:0;width:100%;justify-content:space-between}.section-nav a{font-size:10px;padding:7px 11px}.toolbar-btn{padding:7px 10px;font-size:11px}.footer{flex-direction:column}.table-search input{width:140px}}
  @media(prefers-reduced-motion:reduce){:root:not([data-motion="on"]) *, :root:not([data-motion="on"]) *::before, :root:not([data-motion="on"]) *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
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
  .report-chart-grid { grid-template-columns: minmax(0,1fr); }
  #rankings { grid-template-columns: minmax(0,1fr); }
  .chart-with-insight {
    display:grid;
    grid-template-columns:minmax(0,2fr) minmax(0,1fr);
    gap:16px;
    align-items:start;
  }
  .chart-insight {
    min-width:0;
    padding:13px 15px;
    border-radius:var(--report-inner-radius);
    border:1px solid var(--line);
    border-inline-start:3px solid var(--report-accent);
    background:var(--soft);
    break-inside:avoid;
  }
  .chart-insight h3 { margin:0 0 4px; color:var(--green); font-size:12px; font-weight:700; }
  .chart-insight p { color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
  .notes { font-size:12px; }
  @media(max-width:760px) {
    .hero, .report-embedded .hero, .report-meta, .chart-with-insight { grid-template-columns:1fr; }
    .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .section-nav a { padding-inline:10px; font-size:12px; }
  }
  @media print{body{background:white;color:#1f2e3f}.wrap{padding:0;max-width:none}.top-actions,.section-nav,.mode-switch,.table-search,.selection-note,.tooltip{display:none!important}.hero{print-color-adjust:exact;-webkit-print-color-adjust:exact}.card,.kpi,.proposal{break-inside:avoid;box-shadow:none;animation:none}.grid,.grid.equal{grid-template-columns:1fr 1fr}.report-chart-grid,#rankings{grid-template-columns:1fr}.chart-with-insight{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.kpis{grid-template-columns:repeat(4,1fr)}.proposal-grid{grid-template-columns:1fr}.chart{min-height:180px}.card{padding:16px}.hero{padding:24px}.hero-total strong{font-size:36px}.bar-fill{animation:none}a{color:inherit}body[data-theme="dark"]{--bg:#ffffff;--card:#ffffff;--ink:#1f2e3f;--muted:#445970;--line:#c9d9e8;--soft:#ecf3f9;--green:#174973}}

  .table-report .chart svg { max-height: none; }
  .table-report .table-report-rankings { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .table-report .table-report-rankings > :only-child { grid-column: 1 / -1; }
  .table-report .bar-info span { white-space: normal; overflow-wrap: anywhere; }
  .table-report .chart-with-insight > :only-child { grid-column: 1 / -1; }
  .table-report .footer { margin-top: 20px; }
  .report-analysis-notes { margin-top: 18px; }
  .report-analysis-notes summary { cursor: pointer; font-weight: 650; color: var(--ink); }
  .report-analysis-notes p { margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); }
  .report-analysis-notes .table-wrap { margin-top: 12px; }
  @media(max-width:760px) { .table-report .table-report-rankings { grid-template-columns: minmax(0,1fr); } }
  @media print { .report-analysis-notes > :not(summary) { display: block !important; } }
`;

function reportHeading(payload, esc, {title, description, label, value, detail, range, sections}) {
  const approved = payload.approved !== false;
  return `<header class="topbar">
    <a class="logo" href="#">DuyTruong Insight<span class="logo-accent">.</span></a>
    <div class="top-actions"><span class="pill${approved ? ' approved' : ''}">${approved ? 'Đã nghiệm thu' : 'Bản xem trước'}</span>
      <button type="button" class="toolbar-btn" id="reportTheme" aria-label="Đổi giao diện sáng tối">Sáng / tối</button>
      ${approved ? '<button type="button" class="toolbar-btn" id="reportPrint">In báo cáo ↗</button>' : ''}
    </div>
  </header>
  <section class="hero" aria-labelledby="reportTitle">
    <div><h1 id="reportTitle">${esc(title)}</h1><p class="hero-description">${esc(description)}</p></div>
    <div class="hero-total"><small>${esc(label.toUpperCase())}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></div>
  </section>
  <dl class="report-meta">
    <div><dt>Nguồn dữ liệu</dt><dd>${esc(payload.fileName)}${payload.sheetName ? ' · Sheet: ' + esc(payload.sheetName) : ''}</dd></div>
    <div><dt>Kỳ báo cáo</dt><dd>${esc(range)}</dd></div>
    <div><dt>${approved ? 'Thời điểm xuất' : 'Thời điểm tạo'}</dt><dd>${esc(payload.generatedAt)}</dd></div>
  </dl>
  <nav class="section-nav" aria-label="Mục báo cáo">${sections.map(([id, name], i) =>
    `<a href="#${id}"${i === 0 ? ' class="active" aria-current="location"' : ''}>${name}</a>`).join('')}</nav>`;
}

function reportDocument(content, runtime, esc, title, embedded, isTable = false) {
  const classes = [embedded && 'report-embedded', isTable && 'table-report'].filter(Boolean).join(' ');
  const motion = document.documentElement.dataset.motion === 'on' ? ' data-motion="on"' : '';
  const installMotion = typeof installSmoothMotion === 'function' ? '(' + installSmoothMotion.toString() + ')();' : '';
  return `<!DOCTYPE html><html lang="vi"${motion}><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1"><title>DuyTruong Insight — ${esc(title)}</title>
    <style>${standaloneReportStyles}</style></head><body class="${classes}"><main class="wrap">${content}</main>
    <div id="reportTooltip" class="tooltip" role="tooltip" hidden></div>
    <script>${installMotion}${runtime}${embedded ? '(' + observeEmbeddedReport.toString() + ')();' : ''}</script></body></html>`;
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
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-mode]');if(button){mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el===button);el.setAttribute('aria-pressed',String(el===button));});trend();}
    const legend=event.target.closest('[data-highlight]');if(legend){const active=legend.classList.contains('active');document.querySelectorAll('[data-highlight]').forEach(el=>{el.classList.toggle('active',!active&&el===legend);el.setAttribute('aria-pressed',String(!active&&el===legend));});document.querySelectorAll('[data-series]').forEach(el=>el.style.opacity=active||el.dataset.series===legend.dataset.highlight?'1':'.18');}
  });
  document.querySelectorAll('[data-table]').forEach(input=>input.addEventListener('input',()=>{const section=$(input.dataset.table),query=input.value.toLowerCase();let visible=0;section.querySelectorAll('tbody tr').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query);if(!row.hidden)visible++;});section.querySelector('.table-search-empty').hidden=visible>0;}));
}

function reportInteractions() {
  const $ = id => document.getElementById(id);
  const tooltip=$('reportTooltip');
  function showTip(target,x,y){tooltip.textContent=target.dataset.tip;tooltip.hidden=false;tooltip.style.left=Math.max(12,Math.min(x+14,window.innerWidth-340))+'px';tooltip.style.top=Math.max(12,Math.min(y+14,window.innerHeight-tooltip.offsetHeight-12))+'px';}
  document.addEventListener('pointermove',event=>{const target=event.target.closest('[data-tip]');if(target)showTip(target,event.clientX,event.clientY);else tooltip.hidden=true;});
  document.addEventListener('focusin',event=>{const target=event.target.closest('[data-tip]');if(target){const box=target.getBoundingClientRect();showTip(target,box.left,box.top);}});
  document.addEventListener('focusout',()=>tooltip.hidden=true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')tooltip.hidden=true;});
  document.addEventListener('click', event => {
    const mark = event.target.closest('[data-tip]');
    if (mark) $('reportSelection').textContent = 'Đang xem: ' + mark.dataset.tip.replace(/\n/g, ' · ');
    const link = event.target.closest('.section-nav a');
    if (link) {
      document.querySelectorAll('.section-nav a').forEach(item => {
        item.classList.toggle('active', item === link);
        if (item === link) item.setAttribute('aria-current', 'location');
        else item.removeAttribute('aria-current');
      });
    }
  });
  $('reportTheme').addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  });
  $('reportPrint')?.addEventListener('click', () => window.print());
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

function tableReportSummary(profile) {
  const format = value => Number(value).toLocaleString('vi-VN', {maximumFractionDigits: 4});
  const {columns, groups, matchedCount} = profile;
  const measure = columns.find(column => column.numeric && column.additive)
    || columns.find(column => column.numeric);
  const time = columns.find(column => column.dates);
  const categories = columns.filter(column => column.categories?.length > 1);
  const measureGroups = groups.filter(group => columns[group.measure] === measure && group.values.length > 1);
  const aggregate = ([, sum, count]) => measure.additive ? sum : sum / count;
  const metricLabel = measure ? (measure.additive ? 'Tổng ' : 'Trung bình ') + measure.name : '';
  const rankings = categories.map(column => {
    const group = measureGroups.find(item => columns[item.dimension] === column);
    const entries = group
      ? (group.rankedValues || group.values).map(item => [item[0], aggregate(item), item[2]])
      : column.categories.map(([name, count]) => [name, count, count]);
    return {
      title: column.name,
      label: group ? metricLabel : 'Số bản ghi',
      hasMeasure: Boolean(group),
      entries: entries.toSorted((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }).filter(rank => rank.entries.length > 1);

  const trendGroup = measureGroups.find(group => columns[group.dimension].dates);
  const trendColumn = trendGroup ? columns[trendGroup.dimension] : columns.find(column => column.timeline?.length > 1);
  const trend = trendGroup
    ? {title: metricLabel + ' theo ' + trendColumn.name, entries: trendGroup.values.map(item => [item[0], aggregate(item)])}
    : trendColumn && {title: 'Số bản ghi theo ' + trendColumn.name, entries: trendColumn.timeline};
  const histogram = columns.find(column => column === measure && column.histogram?.length > 1)
    || columns.find(column => column.histogram?.length > 1);
  const insights = [];
  const dateRange = time ? time.dates.first + ' → ' + time.dates.last : '';
  if (trend) {
    const [first, last] = [trend.entries[0], trend.entries.at(-1)];
    const delta = last[1] - first[1];
    insights.push({tag:'Xu hướng', title:trend.title, desc:
      `${first[0]} ghi nhận ${format(first[1])}, còn ${last[0]} ghi nhận ${format(last[1])}. ` +
      (delta ? `Mốc cuối ${delta > 0 ? 'cao' : 'thấp'} hơn mốc đầu ${format(Math.abs(delta))}.` : 'Hai mốc có giá trị bằng nhau.')});
  }
  for (const rank of rankings.slice(0, trend ? 1 : 2)) {
    const [name, value, count] = rank.entries[0];
    insights.push({tag:'So sánh nhóm', title:rank.title + ' · ' + name, desc: rank.hasMeasure
      ? `Dẫn đầu theo ${rank.label} với ${format(value)}, tính trên ${format(count)} bản ghi có giá trị.`
      : `Có ${format(count)} bản ghi, nhiều nhất trong các nhóm của cột ${rank.title}.`});
  }
  if (measure && insights.length < 3) {
    const {count, min, max, average} = measure.numeric;
    insights.push({tag:'Phạm vi giá trị', title:measure.name, desc:
      `Có ${format(count)} giá trị số. Trung bình ${format(average)}, thấp nhất ${format(min)} và cao nhất ${format(max)}.`});
  }
  const missing = columns.filter(column => column.blanks).toSorted((a, b) => b.blanks - a.blanks)[0];
  if (insights.length < 3 && matchedCount) {
    insights.push({tag:'Chất lượng dữ liệu', title:missing ? 'Mức độ đầy đủ của dữ liệu' : 'Phạm vi đã phân tích',
      desc:missing ? `Cột ${missing.name} có ${format(missing.blanks)} ô thiếu trên ${format(matchedCount)} bản ghi được phân tích.`
        : `${format(matchedCount)} bản ghi có giá trị ở cả ${format(columns.length)} cột trong phạm vi phân tích.`});
  }
  return {format, measure, metricLabel, dateRange, rankings, trend, histogram, insights};
}

function buildTableReport(payload, esc, embedded) {
  const {profile, note, findings} = payload.metrics.table;
  const {format, measure, metricLabel, dateRange, rankings, trend, histogram, insights} = tableReportSummary(profile);
  const {matchedCount, sourceCount, columns} = profile;
  const kpis = [
    ['Bản ghi được phân tích', format(matchedCount), 'Trong ' + format(sourceCount) + ' bản ghi đã duyệt', '▤'],
    ['Cột được phân tích', format(columns.length), 'Trong phạm vi đã chọn', '◇']
  ];
  if (measure) {
    kpis.push([measure.additive ? 'Trung bình ' + measure.name : 'Giá trị nhỏ nhất', format(measure.additive ? measure.numeric.average : measure.numeric.min), measure.name, '↗']);
  }
  if (kpis.length < 4 && rankings.length) kpis.push(['Nhóm theo ' + rankings[0].title,
    format(columns.find(column => column.name === rankings[0].title).categoryCount), 'Có dữ liệu trong phạm vi đã chọn', '◎']);
  if (kpis.length < 4 && dateRange) kpis.push(['Khoảng thời gian', dateRange, 'Theo dữ liệu trong tệp', '◷']);

  const overview = columns.map(column => {
    const details = [];
    if (column.numeric) {
      if (column.additive) details.push('Tổng ' + format(column.numeric.sum));
      details.push('Trung bình ' + format(column.numeric.average), 'Từ ' + format(column.numeric.min) + ' đến ' + format(column.numeric.max));
    } else if (column.dates) details.push(column.dates.first + ' đến ' + column.dates.last);
    else if (column.categoryCount) details.push(format(column.categoryCount) + ' nhóm');
    return `<tr><th scope="row">${esc(column.name)}</th><td>${format(matchedCount - column.blanks)}</td><td>${format(column.blanks)}</td><td>${esc(details.join(' · ') || '—')}</td></tr>`;
  }).join('');

  const mark = tip => `class="plot-mark" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}"`;
  const bars = entries => {
    const max = Math.max(0, ...entries.map(([,value]) => Math.abs(value))) || 1;
    return `<div class="bars">${entries.map(([label, value, count]) => {
      const detail = format(value) + (count == null ? '' : ' · ' + format(count) + ' bản ghi');
      return `<div ${mark(label + ' · ' + detail)}><div class="bar-info"><span>${esc(label)}</span><strong>${format(value)}</strong></div><div class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.abs(value) / max * 100}%"></span></div></div>`;
    }).join('')}</div>`;
  };
  const line = ({title, entries}) => {
    const values = entries.map(([,value]) => value);
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const points = entries.map(([label, value], i) => ({label, value, x:72 + i * 630 / (entries.length - 1),
      y:max === min ? 112 : 195 - (value - min) / span * 170}));
    return `<div class="chart"><svg viewBox="0 0 730 245" role="group" aria-label="${esc(title)}">${[0, 1, 2, 3].map(i => {
      const y = 25 + i * 170 / 3;
      return `<line class="grid-line" x1="72" x2="702" y1="${y}" y2="${y}"/><text x="65" y="${y + 4}" text-anchor="end">${esc(new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(max - (max - min) * i / 3))}</text>`;
    }).join('')}<polyline points="${points.map(({x,y}) => x + ',' + y).join(' ')}" fill="none" stroke="var(--green)" stroke-width="3"/>${points.map(({label, value, x, y}, i) =>
      `<circle ${mark(label + ' · ' + format(value))} cx="${x}" cy="${y}" r="5" fill="var(--mint)"/>${i % Math.ceil(points.length / 6) === 0 ? `<text x="${x}" y="220" text-anchor="middle">${esc(label)}</text>` : ''}`).join('')}</svg></div>`;
  };
  const chartCard = (title, chart, observation) => `<article class="card"><div class="section-head"><h2>${esc(title)}</h2></div>
    <div class="chart-with-insight">${chart}${observation ? `<aside class="chart-insight"><h3>Nhận định</h3><p>${esc(observation)}</p></aside>` : ''}</div></article>`;
  const charts = [];
  if (trend) charts.push(chartCard(trend.title, line(trend), insights.find(item => item.tag === 'Xu hướng')?.desc));
  if (histogram) {
    const [label, count] = histogram.histogram.reduce((max, item) => item[1] > max[1] ? item : max);
    charts.push(chartCard('Phân bố ' + histogram.name, bars(histogram.histogram),
      `Khoảng ${label} có ${format(count)} bản ghi, nhiều nhất trong các khoảng hiển thị.`));
  }
  if (!charts.length && rankings.length) {
    const [rank] = rankings;
    charts.push(chartCard(rank.label + ' theo ' + rank.title, bars(rank.entries), 'Hiển thị các nhóm đứng đầu.'));
  }
  const sections = [['overview', 'Tổng quan']];
  if (charts.length) sections.push(['charts', 'Biểu đồ']);
  if (rankings.length) sections.push(['rankings', 'Xếp hạng']);
  if (insights.length || findings) sections.push(['recommendations', 'Nhận định']);
  const header = reportHeading(payload, esc, {
    title:'Báo cáo phân tích dữ liệu',
    description:'Tổng hợp kết quả từ bảng dữ liệu đã làm sạch và kiểm duyệt.',
    label:metricLabel || 'Bản ghi được phân tích',
    value:format(measure ? (measure.additive ? measure.numeric.sum : measure.numeric.average) : matchedCount),
    detail:`${format(matchedCount)} bản ghi · ${format(columns.length)} cột phân tích`,
    range:dateRange || 'Toàn bộ phạm vi đã chọn', sections
  });
  const content = `${header}
    <section class="kpis" id="overview" aria-label="Chỉ số tổng hợp">${kpis.map(([label,value,detail,icon]) =>
      `<article class="kpi"><div class="kpi-top">${esc(label)} <span class="kpi-icon" aria-hidden="true">${icon}</span></div><strong>${esc(value)}</strong><p>${esc(detail)}</p></article>`).join('')}</section>
    ${note ? `<p class="selection-note"><strong>Yêu cầu phân tích</strong> · ${esc(note)}</p>` : ''}
    ${charts.length || rankings.length ? '<div class="selection-note" id="reportSelection" role="status">Rê chuột hoặc dùng phím Tab để xem số liệu · Bấm vào biểu đồ để ghim thông tin.</div>' : ''}
    ${charts.length ? `<section class="grid report-chart-grid" id="charts" aria-label="Biểu đồ">${charts.join('')}</section>` : ''}
    ${rankings.length ? `<section class="grid equal table-report-rankings" id="rankings" aria-label="Xếp hạng">${rankings.map(rank =>
      `<article class="card"><div class="section-head"><div><h2>${esc(rank.title)} nổi bật</h2><p>${esc(rank.label)}</p></div></div>${bars(rank.entries)}</article>`).join('')}</section>` : ''}
    ${insights.length || findings ? `<section class="card proposals" id="recommendations"><div class="section-head"><h2>Nhận định từ dữ liệu</h2></div>
      <div class="proposal-grid">${insights.map(({tag,title,desc}) => `<article class="proposal"><span class="proposal-tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(desc)}</p></article>`).join('')}</div>
      ${findings ? `<details class="report-analysis-notes"><summary>Phân tích bằng Gemini</summary><p>${esc(findings)}</p></details>` : ''}</section>` : ''}
    <details class="card table-card report-analysis-notes" open><summary>Thống kê từng cột</summary><div class="table-wrap"><table>
      <thead><tr><th>Cột</th><th>Có giá trị</th><th>Thiếu giá trị</th><th>Chỉ số</th></tr></thead><tbody>${overview}</tbody></table></div></details>
    <footer class="footer"><span class="logo">DuyTruong Insight.</span><span>${payload.approved === false ? 'Bản xem trước' : 'Nghiệm thu bởi ' + esc(payload.reviewer)}</span></footer>`;
  return reportDocument(content, `(${reportInteractions.toString()})();`, esc,
    'Báo cáo phân tích dữ liệu', embedded, true);
}
