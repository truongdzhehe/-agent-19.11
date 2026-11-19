/* Prepare and apply repairs in the file import dialog. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const extraAliases = {
    customer_id: ['clientcode', 'clientid', 'customercode', 'customerkey', 'makhach', 'makhachhangid', 'makhnoibo'],
    order_id: ['ordercode', 'orderno', 'ordernumber', 'sodonhang', 'sohoadon', 'donhangid'],
    date: ['delivery', 'deliveredat', 'actualdeliverydate', 'ngaygiaothucte', 'ngaygiaonhan'],
    revenue: ['totalamount', 'netrevenue', 'doanhthuthuan', 'tongthanhtien', 'doanhthu(vnd)', 'doanhthu(usd)', 'doanhthuvnd', 'doanhthuusd'],
    status: ['orderstate', 'orderstatus', 'tinhtrangdon', 'tinhtrangdonhang']
  };
  let state = null;

  function setStatus(message, tone = 'error') {
    const status = $('fileRepairStatus');
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', Boolean(message) && tone === 'error');
    status.classList.toggle('is-success', tone === 'success');
  }

  function togglePanel(panelId, buttonId, open) {
    $(panelId).hidden = !open;
    $(buttonId).setAttribute('aria-expanded', String(open));
  }

  function suggestColumns(initial) {
    const used = new Set(Object.values(initial.fieldMap));
    const suggestions = initial.missingFields.map(field => {
      const aliases = new Set(extraAliases[field.key] || []);
      const candidates = initial.headers.filter(header => !used.has(header) && aliases.has(normalizeHeaderKey(header)));
      return [field.key, candidates.length === 1 ? candidates[0] : null];
    });
    return new Map(suggestions.filter(([, source]) => source && suggestions.filter(([, other]) => other === source).length === 1));
  }

  function render() {
    const { initial, blocked, noData, plan, busy } = state;
    const note = readScopeNote();
    const errors = plan?.errors || (blocked && !note ? initial.errors : []);
    const ready = Boolean(plan && !errors.length);
    const detailsButton = $('btnShowRepairDetails');

    $('btnAutoRepairFile').disabled = Boolean(noData || (blocked && !note) || busy);
    $('repairNoDataMessage').hidden = !noData;
    if (noData) $('btnAutoRepairFile').setAttribute('aria-describedby', 'repairNoDataMessage');
    else $('btnAutoRepairFile').removeAttribute('aria-describedby');
    $('btnDismissErrorX').disabled = Boolean(busy);
    $('btnCloseErrorModal').disabled = Boolean(busy);
    $('fileRepairScope').disabled = Boolean(busy || noData);
    $('fileRepairAutoLabel').textContent = note ? 'Phân tích theo ghi chú' : 'Tự động sửa';
    detailsButton.disabled = Boolean(busy);

    $('repairAuditTable').hidden = !plan?.changes.length;
    $('fileRepairChanges').innerHTML = (plan?.changes || []).map(({ from, to, rows, added }) =>
      '<tr><td>' + escapeHtml(from) + '</td><td><strong>' + escapeHtml(to) +
      '</strong><br>' + (added ? 'Thêm cột' : 'Cập nhật ô') + '</td><td>' + rows + '</td></tr>'
    ).join('');
    $('repairScopeColumns').hidden = !plan?.columns?.length;
    $('repairScopeColumns').textContent = plan?.columns?.length
      ? 'Cột dự kiến phân tích: ' + plan.columns.join(', ') + '.' : '';
    $('repairScopeFilters').hidden = !plan?.filters?.length;
    const operators = { equals: '=', not_equals: '≠', contains: 'chứa', gt: '>', gte: '≥',
      lt: '<', lte: '≤', blank: 'để trống', not_blank: 'có giá trị' };
    $('repairScopeFilters').textContent = plan?.filters?.length ? 'Điều kiện: ' +
      plan.filters.map(({ column, op, value }) => [column, operators[op], value].filter(Boolean).join(' ')).join(' · ') : '';
    $('repairPlanSummary').textContent = summaryFor(state);
    $('fileRepairRemaining').innerHTML = errors.map(error => '<li>' + escapeHtml(error) + '</li>').join('');
    $('repairRemainingSection').hidden = !errors.length;
    $('btnShowRepairFeedback').hidden = !plan?.mapping || Boolean(note || blocked) || !initial.missingFields.length;
    $('btnShowRepairFeedback').disabled = Boolean(busy);
    $('errorLockNotice').classList.toggle('repair-valid', ready);
    $('errorLockNoticeText').textContent = ready
      ? 'SẴN SÀNG XỬ LÝ TỆP'
      : 'CẦN KIỂM TRA VÀ SỬA FILE ĐỂ TIẾP TỤC';
  }

  function summaryFor({ plan, blocked, noData }) {
    if (noData) return 'Tệp thiếu cột có nội dung rõ ràng để phân tích.';
    if (!plan) return readScopeNote() ? 'AI sẽ đọc ghi chú để xác định các cột cần phân tích.' : blocked || 'Chọn xem trước để AI lập kế hoạch sửa tệp.';
    if (plan.columns) {
      if (plan.errors.length) return 'AI cần làm rõ phạm vi phân tích.';
      const coverage = plan.omittedColumns ? ' Bản tóm tắt ưu tiên tối đa 12 cột để bao quát các loại dữ liệu trong tệp.' : '';
      return 'Agent sẽ làm sạch bảng để bạn kiểm tra trước khi phân tích.' + coverage;
    }
    if (!plan.changes.length) return 'Bản kiểm tra chưa phát hiện ô cần cập nhật.';
    return 'Dự kiến cập nhật ' + plan.changes.length + ' cột.'
      + (plan.warnings.length ? ' ' + plan.warnings.join(' · ') + '.' : '');
  }

  function readScopeNote() {
    return $('fileRepairScope').value.trim();
  }

  function openDetails(open) {
    togglePanel('fileRepairDetails', 'btnShowRepairDetails', open);
    if (open) $('fileRepairDetails').scrollIntoView({ block: 'nearest' });
  }

  function load(file) {
    if (file && state?.file === file) return;
    state?.controller?.abort();
    const initial = inspectDataset(file?.rows || [], AppState.requiredSchema);
    const ambiguous = initial.errors.some(error => /^(Các tiêu đề cột trùng|Tên cột bị trùng)|bị ánh xạ không rõ ràng/.test(error));
    const blocked = !initial.rows.length || file?.isEmptyOrInvalid
      ? 'File chưa đọc được hoặc không có dữ liệu hợp lệ. Hãy kiểm tra file gốc rồi tải lại.'
      : ambiguous ? 'Tên cột bị trùng hoặc chưa rõ nghĩa. Hãy đặt tên riêng trong file gốc rồi tải lại.' : '';
    const evidenceColumns = initial.headers.filter(name => !identifierColumn(name)
      && initial.rows.some(row => hasEvidence(row[name]) && !/^x$/i.test(String(row[name]).trim())));
    const noData = !evidenceColumns.some(name => !genericColumn(name));
    state = { file, initial, blocked, noData, evidenceColumns, plan: null, controller: new AbortController() };
    $('fileRepairScope').value = '';
    setStatus('');
    togglePanel('fileRepairDetails', 'btnShowRepairDetails', false);
    togglePanel('repairFeedbackPanel', 'btnShowRepairFeedback', false);
    render();
  }

  function showFeedback() {
    const panel = $('repairFeedbackPanel');
    const open = panel.hidden;
    if (open) {
      const { initial, plan } = state;
      const reserved = new Set(Object.values(initial.fieldMap));
      const columns = initial.headers.filter(header => !reserved.has(header));
      $('fileRepairMapping').innerHTML = initial.missingFields.map(field =>
        '<label class="repair-mapping-row"><strong>' + escapeHtml(field.label) +
        '</strong><select name="' + escapeHtml(field.key) + '"><option value="">Chưa chọn cột</option>' +
        columns.map(header => '<option value="' + escapeHtml(header) + '"' +
          (plan.mapping.get(field.key) === header ? ' selected' : '') + '>' + escapeHtml(header) + '</option>').join('') +
        '</select></label>'
      ).join('');
    }
    togglePanel('repairFeedbackPanel', 'btnShowRepairFeedback', open);
    if (open) panel.querySelector('select')?.focus({ preventScroll: true });
  }

  function applyFeedback(event) {
    event.preventDefault();
    if (!state || state.busy || state.blocked || state.file !== AppState.failedFile) return;
    const selections = new FormData(event.currentTarget);
    const mapping = new Map();
    const used = new Set(Object.values(state.initial.fieldMap));
    for (const field of state.initial.missingFields) {
      const source = selections.get(field.key);
      if (!source) continue;
      if (!state.initial.headers.includes(source) || used.has(source)) {
        setStatus('Mỗi cột trong file chỉ có thể dùng một lần. Hãy kiểm tra lại lựa chọn.');
        $('fileRepairStatus').scrollIntoView({ block: 'nearest' });
        return;
      }
      mapping.set(field.key, source);
      used.add(source);
    }
    const order = buildAutomaticPlan(state.initial, mapping, false);
    state.plan = realOrderData(state.initial, order) ? order : adaptivePlan(state);
    togglePanel('repairFeedbackPanel', 'btnShowRepairFeedback', false);
    setStatus('');
    render();
    $('btnShowRepairFeedback').focus({ preventScroll: true });
  }

  const blank = value => !String(value ?? '').trim();
  const noteAliases = ['ghichu', 'notes', 'note', 'remarks', 'ordernotes'];
  const noteFields = {
    order_id: /(?:^|[;\n|])\s*(?:mã đơn(?: hàng)?|order (?:id|no))\s*[:=]\s*([^;\n|]+)/i,
    customer_id: /(?:^|[;\n|])\s*(?:mã khách(?: hàng)?|customer (?:id|no))\s*[:=]\s*([^;\n|]+)/i,
    date: /(?:^|[;\n|])\s*(?:ngày giao(?: hàng)?|delivery date)\s*[:=]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})(?!\d)/i,
    status: /(?:^|[;\n|])\s*(?:trạng thái|status)\s*[:=]\s*([^;\n|]+)/i
  };

  function allowedSource(field, header, rows) {
    const name = normalizeHeaderKey(header);
    if (noteAliases.includes(name) || /^(?:stt|index|rowindex|rownumber|sothutu)$/.test(name)) return false;
    if (field.key === 'customer_id' && /tenkhach|customername|clientname|email|dienthoai|phone|sodienthoai|^sdt$/.test(name)) return false;
    if (field.key === 'date' && /ngaydat|orderdate|createdat|shippingdate|shipdate|estimate|expected|dukien/.test(name)) return false;
    if (field.key === 'revenue' && /dongia|soluong|unitprice|quantity|qty/.test(name)) return false;
    if (field.key !== 'status' && field.key !== 'date') return true;
    const sample = rows.map(row => row[header]).filter(value => !blank(value)).slice(0, 30);
    const valid = value => field.key === 'date'
      ? Boolean(normalizeDateCell(value).value)
      : classifyStatusMeta(value).key !== 'Unknown';
    return sample.length > 0 && sample.filter(valid).length > sample.length / 2;
  }

  function buildAutomaticPlan(initial, mapping, geminiUnavailable) {
    const rows = initial.rows.map(row => ({ ...row }));
    const noteHeaders = initial.headers.filter(header => noteAliases.includes(normalizeHeaderKey(header)));
    const changes = [];
    let temporaryOrderIds = 0, unknownCustomers = 0, unresolvedDates = 0, unknownStatuses = 0;
    const orderField = AppState.requiredSchema.find(field => field.key === 'order_id');
    const orderSource = initial.fieldMap.order_id || mapping.get('order_id');
    const readNote = (row, field) => {
      const pattern = noteFields[field];
      if (!pattern) return '';
      const values = noteHeaders.map(header => String(row[header] ?? '').match(pattern)?.[1].trim()).filter(Boolean);
      return new Set(values).size === 1 ? values[0] : '';
    };
    const occupiedOrders = new Set(rows.map(row => String((orderSource && row[orderSource]) || readNote(row, 'order_id')).trim()));
    let orderSequence = 0;

    for (const field of AppState.requiredSchema) {
      const source = initial.fieldMap[field.key] || mapping.get(field.key);
      const target = initial.fieldMap[field.key] || field.label;
      let affected = 0, copied = 0, fromNotes = 0;
      for (const row of rows) {
        const before = row[target];
        let value = source ? row[source] ?? '' : '';
        const originalValue = value;
        let recovered = false;
        if (field.key === 'customer_id') {
          if (!knownCustomerId(value)) {
            value = knownCustomerId(readNote(row, field.key));
            recovered = Boolean(value);
          }
          if (blank(value)) {
            value = UNKNOWN_CUSTOMER_ID;
            unknownCustomers++;
          }
        } else if (field.key === 'date') {
          if (!normalizeDateCell(value).value) {
            value = normalizeDateCell(readNote(row, field.key)).value;
            recovered = Boolean(value);
          }
          if (blank(value)) unresolvedDates++;
        } else if (field.key === 'status' && blank(value)) {
          const status = classifyStatusMeta(readNote(row, field.key)).key;
          recovered = status !== 'Unknown';
          value = recovered ? status : 'Chưa rõ';
          if (status === 'Unknown') unknownStatuses++;
        } else if (blank(value)) {
          value = readNote(row, field.key);
          recovered = !blank(value);
          if (field === orderField && blank(value)) {
            do {
              value = 'AGENT-DONG-' + String(++orderSequence).padStart(6, '0');
            } while (occupiedOrders.has(value));
            occupiedOrders.add(value);
            temporaryOrderIds++;
          }
        }
        row[target] = value;
        if (before !== value) {
          affected++;
          if (recovered) fromNotes++;
          else if (source && !blank(value) && value === originalValue
            && (field.key !== 'customer_id' || knownCustomerId(value))) copied++;
        }
      }
      if (!affected) continue;
      const fallback = {
        customer_id: 'Ghi “Chưa xác định”',
        order_id: 'Tạo mã đơn nội bộ',
        date: 'Để trống ngày giao chưa xác định',
        status: 'Ghi “Chưa rõ”',
        revenue: 'Để trống ô chưa có doanh thu'
      };
      const other = affected - copied - fromNotes;
      const actions = [];
      if (copied) actions.push('Lấy từ cột “' + source + '” (' + copied + ')');
      if (fromNotes) actions.push('Lấy từ ghi chú trong tệp (' + fromNotes + ')');
      if (other) actions.push((fallback[field.key] || 'Giữ ô chưa xác định') + ' (' + other + ')');
      changes.push({ from: actions.join(' · '), to: target, rows: affected, added: !initial.headers.includes(target) });
    }

    const warnings = [];
    if (temporaryOrderIds) warnings.push(temporaryOrderIds + ' mã đơn nội bộ cho dòng thiếu mã');
    if (unknownCustomers) warnings.push(unknownCustomers + ' dòng chưa xác định được khách hàng, vẫn được tính vào đơn hàng và doanh thu');
    if (unresolvedDates) warnings.push(unresolvedDates + ' ngày giao để trống');
    if (unknownStatuses) warnings.push(unknownStatuses + ' trạng thái ghi là “Chưa rõ”');
    if (geminiUnavailable) warnings.push('Gemini chưa phản hồi, Agent đã dùng quy tắc trên máy');
    return { mapping, changes, rows, errors: inspectDataset(rows, AppState.requiredSchema).errors, warnings };
  }

  async function prepareAutomaticPlan({ initial, controller }) {
    const mapping = new Map();
    const reserved = new Set(Object.values(initial.fieldMap));
    const headers = initial.headers.filter(header => !reserved.has(header) && Array.from(header).length <= 160).slice(0, 100);
    const fields = initial.missingFields;
    let geminiUnavailable = false;
    const setMapping = (field, header) => {
      if (!header || reserved.has(header) || !allowedSource(field, header, initial.rows)) return;
      mapping.set(field.key, header);
      reserved.add(header);
    };
    if (headers.length && fields.length) {
      try {
        const { suggestions } = await window.Gemini.request('repair', {
          headers, fields: fields.map(field => field.label)
        }, AbortSignal.any([controller.signal, AbortSignal.timeout(22000)]));
        fields.forEach((field, index) => setMapping(field, headers[suggestions[index]]));
      } catch (error) {
        if (controller.signal.aborted) throw error;
        geminiUnavailable = true;
      }
    }
    const local = suggestColumns(initial);
    for (const field of fields) {
      if (!mapping.has(field.key)) setMapping(field, local.get(field.key));
    }
    return buildAutomaticPlan(initial, mapping, geminiUnavailable);
  }

  async function prepareScopePlan({ initial, controller, file }, note) {
    const headers = initial.headers.slice(0, 150);
    const empty = { columns: [], changes: [], errors: [] };
    if (!initial.rows.length || !headers.length || file?.isEmptyOrInvalid
      || initial.errors.some(error => /^(Các tiêu đề cột trùng|Tên cột bị trùng)/.test(error))) {
      return { ...empty, errors: ['Tệp chưa có bảng dữ liệu đọc được.'] };
    }
    const displayHeaders = headers.map(header => Array.from(header).slice(0, 160).join(''));
    const result = await window.Gemini.request('scope', { headers: displayHeaders, note },
      AbortSignal.any([controller.signal, AbortSignal.timeout(22000)]));
    if (result.clarification) return { ...empty, errors: [result.clarification] };
    const columns = result.columns.map(index => headers[index]);
    const filters = result.filters.map(filter => ({ ...filter, column: headers[filter.column] }));
    const groupBy = result.groupBy.map(index => headers[index]);
    return { ...empty, columns, filters, groupBy };
  }

  function scopeNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const text = String(value ?? '').trim().replace(/(?:₫|đ|vnd|usd|\$)/gi, '').trim();
    if (!/^-?(?:\d+|\d{1,3}(?:[,. ]\d{3})+)(?:[,.]\d+)?$/.test(text)) return NaN;
    if (/[,.]/.test(text) && /[,.]/.test(text.slice(0, -4))) {
      const decimal = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'));
      const groups = text.slice(0, decimal).split(/[,.]/);
      if (groups.length > 1 && groups.slice(1).every(group => group.length === 3) && text.length - decimal === 4) {
        return Number(text.replace(/[,. ]/g, ''));
      }
      return Number(text.slice(0, decimal).replace(/[,. ]/g, '') + '.' + text.slice(decimal + 1));
    }
    if (/^-?[1-9]\d{0,2}[.,]\d{3}$/.test(text)) return Number(text.replace(/[.,]/g, ''));
    return Number(text.replace(/ /g, '').replace(',', '.'));
  }

  function scopeDate(value, column) {
    const header = normalizeHeaderKey(column);
    const month = /^(?:thang|month|kithang|kythang|monthperiod)$/.test(header);
    const numeric = month || /^ngay|^date|date$/.test(header);
    const text = String(value ?? '').trim();
    if (month) {
      const iso = text.match(/^(\d{4})[-/](0?[1-9]|1[0-2])$/);
      const local = text.match(/^(0?[1-9]|1[0-2])[-/](\d{4})$/);
      if (iso) return iso[1] + '-' + iso[2].padStart(2, '0');
      if (local) return local[2] + '-' + local[1].padStart(2, '0');
    }
    if (!numeric && !/\d[-/]\d/.test(text)) return '';
    const date = dateToISO(normalizeDateCell(value).value);
    return month ? date.slice(0, 7) : date;
  }

  function scopeMatch(value, filter) {
    if (filter.op === 'blank') return blank(value);
    if (filter.op === 'not_blank') return !blank(value);
    if (filter.op === 'contains') return normalizeFeedback(String(value ?? '')).includes(normalizeFeedback(filter.value));
    const expected = scopeNumber(filter.value);
    const date = scopeDate(filter.value, filter.column);
    const isEquality = filter.op === 'equals' || filter.op === 'not_equals';
    const numeric = Number.isFinite(expected) && (typeof value === 'number' || !isEquality);
    const actual = date ? scopeDate(value, filter.column) : numeric
      ? scopeNumber(value) : normalizeFeedback(String(value ?? ''));
    const target = date || (numeric ? expected : normalizeFeedback(filter.value));
    if ((date && !actual) || (numeric && !Number.isFinite(actual))) return false;
    switch (filter.op) {
      case 'equals': return actual === target;
      case 'not_equals': return actual !== target;
      case 'gt': return actual > target;
      case 'gte': return actual >= target;
      case 'lt': return actual < target;
      case 'lte': return actual <= target;
      default: return false;
    }
  }

  function summarizeColumns(rows, columns, filters, groupBy, adaptive = false) {
    const matched = filterTableRows(rows, filters);
    const groups = [];
    const excerpt = value => Array.from(value).slice(0, 40).join('');
    const profiles = columns.map((name, index) => {
      let blanks = 0, count = 0, sum = 0, min = Infinity, max = -Infinity;
      let dateCount = 0, first = '', last = '';
      const frequencies = new Map();
      const days = new Map();
      const months = new Map();
      const numbers = [];
      let highCardinality = false;
      for (const row of matched) {
        const value = row[name];
        if (adaptive ? !hasEvidence(value) : blank(value)) {
          blanks++;
          continue;
        }
        const date = scopeDate(value, name);
        const number = date ? NaN : scopeNumber(value);
        if (date) {
          dateCount++;
          if (adaptive) {
            const month = date.slice(0, 7);
            months.set(month, (months.get(month) || 0) + 1);
            days.set(date, (days.get(date) || 0) + 1);
          }
          if (!first || date < first) first = date;
          if (!last || date > last) last = date;
        }
        if (Number.isFinite(number)) {
          count++;
          sum += number;
          if (adaptive) numbers.push(number);
          min = Math.min(min, number);
          max = Math.max(max, number);
        }
        if (!highCardinality) {
          const category = String(value).trim();
          if (!frequencies.has(category) && frequencies.size === (adaptive ? 250 : 20)) highCardinality = true;
          else frequencies.set(category, (frequencies.get(category) || 0) + 1);
        }
      }
      const numeric = count && Number.isFinite(sum) ? { count, sum, min, max, average: sum / count } : null;
      const dates = dateCount ? { count: dateCount, first, last } : null;
      const isCategory = !highCardinality && !dateCount && frequencies.size > 0
        && (groupBy.includes(name) || count < matched.length - blanks);
      const rankedCategories = adaptive ? [...frequencies].sort(([, a], [, b]) => b - a).slice(0, 20) : [...frequencies];
      const frequenciesList = isCategory ? rankedCategories.map(([value, count]) => [excerpt(value), count]) : [];
      const column = { name, index, blanks, numeric, dates, categories: frequenciesList };
      if (adaptive) {
        column.additive = additiveColumn(name);
        if (isCategory) column.categoryCount = frequencies.size;
      }
      if (adaptive && dateCount) {
        column.timeline = [...(months.size > 1 ? months : days)]
          .sort(([a], [b]) => a.localeCompare(b)).slice(-24);
      }
      if (adaptive && numeric && min < max && Number.isFinite(max - min)) {
        const bucketCount = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(numbers.length))));
        const width = (max - min) / bucketCount;
        if (width > 0) {
          const buckets = Array.from({ length: bucketCount }, (_, bucket) => [
            localeNumber.format(min + width * bucket) + ' – ' +
              localeNumber.format(bucket === bucketCount - 1 ? max : min + width * (bucket + 1)), 0
          ]);
          for (const number of numbers) buckets[Math.min(bucketCount - 1, Math.floor((number - min) / width))][1]++;
          column.histogram = buckets;
        }
      }
      return column;
    });
    for (const dimension of profiles.filter(profile => profile.categories.length || profile.dates)) {
      for (const measure of profiles.filter(profile => profile.numeric && profile !== dimension)) {
        if (groups.length === 12) break;
        const totals = new Map();
        const byMonth = Boolean(dimension.dates)
          && (!adaptive || dimension.dates.first.slice(0, 7) !== dimension.dates.last.slice(0, 7));
        for (const row of matched) {
          const source = row[dimension.name];
          if (adaptive && !hasEvidence(source)) continue;
          const group = dimension.dates
            ? scopeDate(source, dimension.name).slice(0, byMonth ? 7 : 10)
            : String(source ?? '').trim();
          const value = scopeNumber(row[measure.name]);
          if (!group || !Number.isFinite(value)) continue;
          if (!totals.has(group)) totals.set(group, { sum: 0, count: 0 });
          const total = totals.get(group);
          total.sum += value;
          total.count++;
        }
        const totalsList = [...totals].filter(([, total]) => Number.isFinite(total.sum));
        const items = dimension.dates
          ? totalsList.toSorted(([a], [b]) => a.localeCompare(b)).slice(-24)
          : adaptive ? totalsList.sort(([, a], [, b]) => b.count - a.count).slice(0, 20) : totalsList;
        const aggregate = ([, total]) => measure.additive ? total.sum : total.sum / total.count;
        const rankedValues = adaptive && !dimension.dates
          ? totalsList.toSorted((a, b) => aggregate(b) - aggregate(a)).slice(0, 5)
            .map(([group, {sum, count}]) => [excerpt(group), sum, count])
          : undefined;
        groups.push({
          rankedValues, dimension: dimension.index, measure: measure.index, byMonth,
          groupsOmitted: totalsList.length - items.length,
          values: items.map(([group, { sum, count }]) => [excerpt(group), sum, count])
        });
      }
    }
    return {
      sourceCount: rows.length, matchedCount: matched.length, filters,
      columns: profiles.map(profile => ({ ...profile, name: Array.from(profile.name).slice(0, 160).join('') })),
      groups
    };
  }

  const hasEvidence = value => !isMissingTableValue(value);
  const identifierColumn = name => /^(?:stt|index|row|rowindex|rownumber|sothutu|id|ma(?:khach|don|sku|sanpham|nhanvien|hocsinh|sinhvien|giaodich)|sku|email|sdt|sodienthoai|dienthoai|phone)|id$/.test(normalizeHeaderKey(name)) || /(?:^|\s)mã\s/i.test(name);
  const numberedColumn = name => /^(?:cot|col|column|field|truong|unnamed)(?:[:.]*\d+)?$/.test(normalizeHeaderKey(name));
  const genericColumn = name => numberedColumn(name) || /^(?:giatri|value|data|dulieu)(?:\d+)?$/.test(normalizeHeaderKey(name));
  const additiveColumn = name => /doanhthu|revenue|salesamount|soluong|quantity|chiphi|giavon|cost|luongban/.test(normalizeHeaderKey(name));
  const localeNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
  let repairCharts = [];

  function realOrderData(initial, plan) {
    if (plan.errors.length) return false;
    const { rows } = plan;
    const key = field => initial.fieldMap[field]
      || AppState.requiredSchema.find(item => item.key === field)?.label;
    const [order, customer, date, revenue, status] = ['order_id', 'customer_id', 'date', 'revenue', 'status'].map(key);
    const revenueSource = plan.mapping.get('revenue') || revenue;
    if (/vnd|eur|gbp|jpy|₫|€|£|¥/i.test(revenueSource)) return false;
    return new Set(rows.map(row => normalizeDateCell(row[date]).value).filter(Boolean)).size >= 2
      && rows.every(row => hasEvidence(row[order]) && !String(row[order]).startsWith('AGENT-DONG-')
        && hasEvidence(row[customer]) && parsePositiveNumber(row[revenue]) === scopeNumber(row[revenue])
        && !/₫|vnd|eur|gbp|jpy|€|£|¥/i.test(String(row[revenue]))
        && normalizeDateCell(row[date]).value && hasEvidence(row[status])
        && classifyStatusMeta(row[status]).key !== 'Unknown');
  }

  function resemblesOrders({ headers, rows, fieldMap }) {
    const matches = pattern => headers.find(name => pattern.test(normalizeHeaderKey(name))
      && rows.some(row => hasEvidence(row[name])));
    const order = fieldMap.order_id || matches(/^(?:madonhang|madon|sodonhang|orderid|orderno|ordernumber|ordercode|donhangid)$/);
    const product = matches(/^(?:sanpham|product|dichvu|item|mathang)/);
    const region = matches(/^(?:khuvuc|region|tinhthanh|thanhpho)/);
    return Boolean(order && product && region);
  }

  function adaptivePlan({ initial, evidenceColumns }) {
    const rows = initial.rows;
    const candidates = evidenceColumns.filter(name => !numberedColumn(name));
    const columns = candidates.slice(0, 12);
    if (candidates.length > 12) {
      const firstByKind = new Map();
      for (const name of candidates) {
        const examples = [];
        for (const row of rows) {
          if (hasEvidence(row[name])) examples.push(row[name]);
          if (examples.length === 30) break;
        }
        const dates = examples.filter(value => scopeDate(value, name)).length;
        const numbers = examples.filter(value => Number.isFinite(scopeNumber(value))).length;
        const kind = dates * 2 >= examples.length ? 'date' : numbers * 2 >= examples.length ? 'number'
          : new Set(examples.map(String)).size < examples.length || /khuvuc|sanpham|nhom|loai|region|category/.test(normalizeHeaderKey(name))
            ? 'category' : 'text';
        if (!firstByKind.has(kind)) firstByKind.set(kind, name);
      }
      columns.splice(0, columns.length, ...[...new Set([...firstByKind.values(), ...candidates])].slice(0, 12));
    }
    return { columns, changes: [], errors: [], omittedColumns: candidates.length - columns.length };
  }

  const compactNumber = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

  function appendAdaptiveChart(host, { title, subtitle, labels, values, type = 'bar', horizontal = false, histogram = false }) {
    const card = document.createElement('article');
    card.className = 'chart-panel table-chart-panel';
    const heading = document.createElement('div');
    heading.className = 'panel-head';
    heading.innerHTML = '<div><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(subtitle) + '</p></div>';
    const area = document.createElement('div');
    area.className = 'canvas-holder';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', title);
    area.append(canvas);
    card.append(heading, area);
    host.append(card);

    const dark = document.documentElement.dataset.theme === 'dark';
    const ink = dark ? '#b3cbe2' : '#405975';
    const grid = dark ? '#c2d9ef20' : '#223b5519';
    const palette = dark ? ['#7fafe0', '#538fbe', '#3d6799', '#9ac6dc', '#476e80', '#b5a4dc', '#527ea9', '#93a7bb']
      : ['#193e63', '#3d79aa', '#77add4', '#afcfe5', '#4c8a8e', '#8c82b2', '#55748d', '#c6d6e5'];
    const isDonut = type === 'doughnut';
    const isLine = type === 'line';
    const shortLabel = value => value.length > 23 ? value.slice(0, 22) + '…' : value;
    const compactRange = label => label.split(' – ').map(part => {
      const number = Number(part.replaceAll('.', '').replace(',', '.'));
      return Number.isFinite(number) ? compactNumber.format(number) : part;
    }).join('–');
    const categoryAxis = {
      grid: { display: false },
      ticks: { color: ink, maxRotation: 0, autoSkip: !horizontal, callback(index) {
        const label = this.getLabelForValue(index);
        return histogram ? compactRange(label) : shortLabel(label);
      } }
    };
    const valueAxis = { beginAtZero: true, grid: { color: grid }, border: { display: false },
      ticks: { color: ink, maxTicksLimit: 6, callback: value => compactNumber.format(value) } };
    const visibleTotal = chart => values.reduce((sum, value, index) => sum + (chart.getDataVisibility(index) ? value : 0), 0);
    const percent = (value, total) => (total ? value / total : 0)
      .toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
    const center = {
      id: 'tableDonutTotal',
      afterDatasetsDraw(chart) {
        const arc = chart.getDatasetMeta(0).data[0];
        if (!arc || arc.innerRadius < 25) return;
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ink;
        ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(compactNumber.format(visibleTotal(chart)), arc.x, arc.y - 8);
        ctx.font = '11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Tổng', arc.x, arc.y + 13);
        ctx.restore();
      }
    };
    repairCharts.push(new Chart(canvas, {
      type,
      data: { labels, datasets: [{
        data: values, label: title, borderColor: isDonut ? (dark ? '#162a40' : '#f7fafc') : palette[0],
        backgroundColor: isDonut || horizontal ? palette : isLine ? (dark ? '#6da5da28' : '#4d89bf22') : palette[2],
        borderWidth: isDonut ? 2 : isLine ? 2 : 0, borderRadius: isDonut ? 0 : 6, maxBarThickness: 48,
        tension: .25, pointRadius: isLine ? 3 : 0, fill: isLine
      }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: false,
        color: ink, cutout: '69%', interaction: { mode: 'nearest', intersect: !isLine },
        plugins: {
          legend: { display: isDonut, position: 'bottom', labels: {
            color: ink, usePointStyle: true, boxWidth: 8, padding: 14,
            generateLabels(chart) {
              const total = visibleTotal(chart);
              return labels.map((label, index) => {
                const hidden = !chart.getDataVisibility(index);
                return { text: shortLabel(label) + (hidden ? '' : ' · ' + percent(values[index], total)),
                  fillStyle: palette[index % palette.length], fontColor: ink, strokeStyle: 'transparent',
                  lineWidth: 0, pointStyle: 'circle', index, hidden };
              });
            }
          } },
          tooltip: { callbacks: { label(context) {
            const value = context.raw;
            const share = isDonut ? ' · ' + percent(value, visibleTotal(context.chart)) : '';
            return localeNumber.format(value) + share;
          } } }
        },
        scales: isDonut ? {} : horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis }
      },
      plugins: isDonut ? [center] : []
    }));
  }

  function renderTableResults(result) {
    const profile = result?.profile;
    $('tableAnalysisNote').textContent = result?.note || '';
    $('tableAnalysisFindings').textContent = result?.findings || '';
    $('tableAnalysisGemini').hidden = !result?.findings;
    $('tableAnalysisGemini').open = false;
    const cards = $('tableAnalysisKpis');
    const list = $('repairAdaptiveSummary');
    const featured = $('tableAnalysisCharts');
    const charts = $('repairAdaptiveCharts');
    const ranks = $('tableAnalysisRankings');
    const proposals = $('tableAnalysisProposals');
    repairCharts.forEach(chart => chart.destroy());
    repairCharts = [];
    for (const host of [cards, list, featured, charts, ranks, proposals]) host.replaceChildren();
    if (!profile) return;

    const {measure, rankings, insights, format} = tableReportSummary(profile);
    ranks.innerHTML = rankings.map(({title, label, hasMeasure, entries}, i) => {
      const largest = Math.max(0, ...entries.map(([, value]) => Math.abs(value))) || 1;
      return `<article class="insight-list-card"><div class="insight-card-head"><h4>
        <i data-lucide="layers" aria-hidden="true"></i>${escapeHtml(title)} nổi bật</h4>
        <span class="insight-tag">${escapeHtml(label)}</span></div><div class="ranking-bars-list">
        ${entries.map(([name, value, count], j) => `<div class="rank-item">
          <div class="rank-label-row"><span>#${j + 1} ${escapeHtml(name)}</span>
            <span>${format(count)} bản ghi${hasMeasure ? ' · ' + format(value) : ''}</span></div>
          <div class="rank-bar-track" aria-hidden="true"><div class="rank-bar-fill${i % 2 ? ' fill-indigo' : ''}"
            style="width:${Math.abs(value) / largest * 100}%"></div></div>
        </div>`).join('')}</div></article>`;
    }).join('');
    proposals.innerHTML = insights.map(({tag, title, desc}) => `<article class="prop-card">
      <span class="prop-tag">${escapeHtml(tag)}</span>
      <h4 class="prop-title">${escapeHtml(title)}</h4>
      <p class="prop-desc">${escapeHtml(desc)}</p>
    </article>`).join('');
    $('tableAnalysisInsights').hidden = !insights.length && !result?.findings;

    const time = profile.columns.find(column => column.dates);
    const category = profile.columns.find(column => column.categories.length > 1);
    const kpis = [];
    if (measure?.additive) kpis.push(['Tổng ' + measure.name, localeNumber.format(measure.numeric.sum), 'Tính trên ' + localeNumber.format(measure.numeric.count) + ' giá trị số', 'wallet']);
    kpis.push(['Số bản ghi phân tích', localeNumber.format(profile.matchedCount),
      profile.matchedCount === profile.sourceCount ? 'Từ bảng đã duyệt' : 'Trong ' + localeNumber.format(profile.sourceCount) + ' bản ghi đã duyệt', 'list-checks']);
    if (measure) kpis.push(['Trung bình ' + measure.name, localeNumber.format(measure.numeric.average),
      'Từ ' + localeNumber.format(measure.numeric.min) + ' đến ' + localeNumber.format(measure.numeric.max), 'chart-column']);
    if (category) kpis.push(['Số nhóm theo ' + category.name, localeNumber.format(category.categoryCount),
      localeNumber.format(profile.matchedCount - category.blanks) + ' bản ghi có giá trị', 'layers']);
    if (kpis.length < 4 && time) {
      kpis.push(['Khoảng thời gian', time.dates.first + ' – ' + time.dates.last, localeNumber.format(time.dates.count) + ' dòng có mốc thời gian', 'calendar-days']);
    }
    if (kpis.length < 4) kpis.push(['Số cột phân tích', localeNumber.format(profile.columns.length), 'Trong phạm vi đã chọn', 'columns-3']);
    cards.innerHTML = kpis.map(([label, value, detail, icon]) => '<article class="stat-mini-card">'
      + '<div class="stat-icon-wrap icon-primary"><i data-lucide="' + icon + '" aria-hidden="true"></i></div>'
      + '<div class="stat-content"><span class="stat-label">' + escapeHtml(label) + '</span>'
      + '<h3 class="stat-amount">' + escapeHtml(value) + '</h3>'
      + '<span class="badge-growth neutral">' + escapeHtml(detail) + '</span></div></article>').join('');

    for (const column of profile.columns) {
      const row = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = column.name;
      const facts = [localeNumber.format(profile.matchedCount - column.blanks) + ' ô có dữ liệu'];
      if (column.blanks) facts.push(localeNumber.format(column.blanks) + ' ô thiếu');
      if (column.numeric) {
        const { sum, average, min, max } = column.numeric;
        if (column.additive) facts.push('tổng ' + localeNumber.format(sum));
        facts.push('trung bình ' + localeNumber.format(average), 'từ ' + localeNumber.format(min) + ' đến ' + localeNumber.format(max));
      } else if (column.dates) {
        facts.push(column.dates.first + ' đến ' + column.dates.last);
      } else if (column.categories.length) {
        facts.push(localeNumber.format(column.categoryCount) + ' nhóm');
      }
      row.append(label, document.createTextNode(facts.join(' · ')));
      list.append(row);
    }
    if (!profile.matchedCount || !window.Chart) return;

    const groupCharts = profile.groups.filter(group => group.values.length > 1).map(group => {
      const metric = profile.columns[group.measure];
      const dimension = profile.columns[group.dimension];
      const aggregate = ([, sum, count]) => metric.additive ? sum : sum / count;
      const data = dimension.dates ? group.values : group.values.toSorted((a, b) => aggregate(b) - aggregate(a)).slice(0, 8);
      const limited = group.groupsOmitted + group.values.length - data.length;
      return {
        title: (metric.additive ? 'Tổng ' : 'Trung bình ') + metric.name + ' theo ' + dimension.name,
        subtitle: limited ? 'Hiển thị ' + data.length + ' nhóm có dữ liệu'
          : data.length + (dimension.dates ? ' mốc có dữ liệu' : ' nhóm có dữ liệu'),
        labels: data.map(([label]) => label),
        values: data.map(aggregate),
        type: dimension.dates ? 'line' : 'bar',
        horizontal: !dimension.dates,
        canShowShare: !limited && metric.additive && !dimension.dates,
        metric
      };
    });
    const preferred = groupCharts.filter(chart => chart.metric === measure);
    const primary = preferred.find(chart => chart.type === 'line') || groupCharts.find(chart => chart.type === 'line')
      || (time?.timeline?.length > 1 ? {
        title: 'Số bản ghi theo ' + time.name, subtitle: 'Số dòng theo từng mốc có dữ liệu',
        labels: time.timeline.map(([label]) => label), values: time.timeline.map(([, count]) => count), type: 'line'
      } : preferred[0] || groupCharts[0]);
    const secondary = [...preferred, ...groupCharts].find(chart =>
      chart !== primary && chart.canShowShare && chart.values.every(value => value > 0));
    if (primary) appendAdaptiveChart(featured, primary);
    if (secondary) appendAdaptiveChart(featured, { ...secondary, type: 'doughnut', horizontal: false, subtitle: 'Tỷ trọng trong các nhóm có dữ liệu' });

    const details = groupCharts.filter(chart => chart !== primary && chart !== secondary).slice(0, 6);
    if (!secondary && category && !groupCharts.some(chart => chart.horizontal)) {
      const groups = category.categories.toSorted((a, b) => b[1] - a[1]).slice(0, 8);
      details.push({ title: 'Số bản ghi theo ' + category.name,
        subtitle: category.categoryCount > groups.length ? 'Các nhóm phổ biến nhất' : 'Số dòng theo từng nhóm',
        labels: groups.map(([name]) => name), values: groups.map(([, count]) => count), horizontal: true });
    }
    const histogram = (measure?.histogram?.length > 1 ? measure : null)
      || profile.columns.find(column => column.histogram?.length > 1);
    if (histogram) details.push({ title: 'Phân bố ' + histogram.name, subtitle: 'Số dòng trong từng khoảng giá trị',
      labels: histogram.histogram.map(([label]) => label), values: histogram.histogram.map(([, count]) => count), histogram: true });
    for (const chart of details) appendAdaptiveChart(charts, chart);
    if (!featured.childElementCount && charts.firstElementChild) featured.append(charts.firstElementChild);
  }

  async function chooseAutomaticPlan(current) {
    if (resemblesOrders(current.initial)) {
      const order = await prepareAutomaticPlan(current);
      if (realOrderData(current.initial, order)) return order;
    }
    return adaptivePlan(current);
  }

  async function actOnFile(preview) {
    const current = state;
    if (!current || current.busy) return;
    if (preview && !$('fileRepairDetails').hidden) {
      openDetails(false);
      return;
    }
    if (preview && current.plan) {
      openDetails(true);
      return;
    }
    const { file, controller } = current;
    if (!file || file !== AppState.failedFile) return;
    const note = readScopeNote();
    if (current.noData || (current.blocked && !note)) {
      if (preview) openDetails(true);
      return;
    }
    current.busy = true;
    setStatus(note ? 'AI đang đọc yêu cầu trong ghi chú…' : 'Đang kiểm tra những cột và giá trị có trong tệp…', 'info');
    togglePanel('repairFeedbackPanel', 'btnShowRepairFeedback', false);
    if (preview) openDetails(true);
    $('fileRepairStatus').scrollIntoView({ block: 'nearest' });
    render();

    const isCurrent = () => state === current && !controller.signal.aborted;
    function finish(message = '', tone = 'info') {
      if (!isCurrent()) return;
      current.busy = false;
      setStatus(message, tone);
      render();
    }
    try {
      const plan = current.plan || (note ? await prepareScopePlan(current, note) : await chooseAutomaticPlan(current));
      if (!isCurrent() || file !== AppState.failedFile) return;
      current.plan = plan;
      if (plan.errors.length) {
        finish('Cần thêm thông tin để tiếp tục.', 'error');
        openDetails(true);
        return;
      }
      if (preview) {
        finish('Bản xem trước đã sẵn sàng.');
        return;
      }
      const tableAnalysis = plan.columns ? {
        columns: plan.columns, note, filters: plan.filters || [], groupBy: plan.groupBy || []
      } : null;
      const rows = tableAnalysis ? current.initial.rows : plan.rows;
      const imported = validateFileSchema(rows, file.fileName, {
        sheetName: file.sheetName, tableAnalysis, importChanges: plan.changes,
        repairReview: {
          sourceRows: current.initial.rows, sourceHeaders: current.initial.headers,
          sourceLines: file.rows.map(row => Number.isInteger(row.__rowNum__) ? row.__rowNum__ + 1 : null),
          comparison: null, preview: null, revisions: []
        }
      });
      if (!imported) finish('Bảng chưa đạt yêu cầu kiểm tra.', 'error');
      else current.busy = false;
    } catch (error) {
      if (!isCurrent()) return;
      finish('Chưa xử lý được tệp: ' + error.message, 'error');
    }
  }

  function filterTableRows(rows, filters) {
    return filters.length ? rows.filter(row => filters.every(filter => scopeMatch(row[filter.column], filter))) : rows;
  }

  async function analyzeTable(rows, plan, signal) {
    const profile = summarizeColumns(rows, plan.columns, plan.filters, plan.groupBy, true);
    const question = plan.note || 'Tóm tắt bằng tiếng Việt nội dung bảng. Dùng đúng tên cột và đơn vị. '
      + 'Ưu tiên phân bố, phân nhóm và xu hướng có chứng cứ. Chỉ cộng đại lượng có thể cộng. '
      + 'Chỉ đề cập đơn hàng, doanh thu hoặc lợi nhuận nếu tệp có các trường tương ứng. Nêu phần thiếu dữ liệu.';
    let findings = 'Bộ lọc hiện tại không có dòng phù hợp. Bạn có thể điều chỉnh phạm vi ở bước 6.';
    if (profile.matchedCount) {
      try {
        const result = await window.Gemini.request('custom-analysis', { note: question, profiles: profile },
          AbortSignal.any([signal, AbortSignal.timeout(22000)]));
        findings = result.text;
      } catch (error) {
        if (signal.aborted) throw error;
        findings = 'Số liệu đã được tổng hợp bên dưới. Gemini chưa phản hồi để viết nhận xét.';
      }
    }
    return { profile, findings, note: plan.note };
  }

  async function resolveTableScope(rows, headers, note, controller) {
    const plan = await prepareScopePlan({ initial: { rows, headers, errors: [] }, controller }, note);
    if (plan.errors.length) throw new Error(plan.errors.join(' '));
    return { columns: plan.columns, note, filters: plan.filters, groupBy: plan.groupBy };
  }

  let reviewRequest = null;

  function resetReview() {
    reviewRequest?.abort();
    reviewRequest = null;
    $('step2RepairFeedback').value = '';
    $('step2RepairMessage').textContent = '';
    $('step2RepairComparison').open = false;
    $('step2RepairPreview').open = false;
    $('step2RepairHistory').open = false;
    AppState.repairReview = null;
    renderReview();
  }

  function captureReview(result) {
    const review = AppState.repairReview;
    if (!review || review.comparison || !result.sourceIndices) return;
    const source = review.sourceRows;
    const kept = new Set(result.sourceIndices);
    const sourceLine = i => review.sourceLines?.[i] ?? i + 2;
    const cells = [], removed = [];
    const counts = new Map();
    const previewValue = value => {
      const text = String(value ?? '');
      return text.length > 240 ? text.slice(0, 237) + '…' : text;
    };
    result.rows.forEach((row, index) => {
      const sourceIndex = result.sourceIndices[index];
      for (const [column, after] of Object.entries(row)) {
        const before = source[sourceIndex][column];
        if (Object.is(before ?? '', after ?? '')) continue;
        counts.set(column, (counts.get(column) || 0) + 1);
        if (cells.length < 100) {
          const sameText = String(before ?? '') === String(after ?? '');
          cells.push({row:sourceLine(sourceIndex), column,
            before:previewValue(sameText && typeof before === 'string' ? JSON.stringify(before) : before),
            after:previewValue(sameText && typeof after === 'string' ? JSON.stringify(after) : after)});
        }
      }
    });
    source.forEach((row, i) => {
      if (!kept.has(i) && removed.length < 100) removed.push(sourceLine(i));
    });
    review.comparison = {
      before: source.length, after: result.rows.length,
      added: AppState.headers.filter(column => !review.sourceHeaders.includes(column)),
      columns: [...counts].map(([name, count]) => ({name, count})),
      changed: [...counts.values()].reduce((total, count) => total + count, 0),
      cells, removed
    };
    delete review.sourceRows;
    delete review.sourceLines;
    $('step2RepairComparison').open = true;
    const plan = AppState.tableAnalysis;
    if (plan) {
      review.preview = reviewPreview(summarizeColumns(result.rows, plan.columns, plan.filters, plan.groupBy, true));
    }
  }

  function reviewPreview(profile, findings = '') {
    const {insights} = tableReportSummary(profile);
    return {matchedCount: profile.matchedCount, sourceCount: profile.sourceCount,
      columnCount: profile.columns.length, insights, findings};
  }

  const reviewOperators = {equals:'=', not_equals:'≠', contains:'chứa', gt:'>', gte:'≥',
    lt:'<', lte:'≤', blank:'để trống', not_blank:'có giá trị'};

  function reviewFilters(filters) {
    return filters.map(({column, op, value}) => [column, reviewOperators[op], value].filter(Boolean).join(' ')).join(' · ');
  }

  function renderReview() {
    const review = AppState.repairReview;
    const panel = $('step2RepairReview');
    panel.hidden = !review;
    if (!review) return;
    const comparison = review.comparison;
    const busy = Boolean(reviewRequest);
    const ready = AppState.workflow.cleaned && AppState.cleanRows.length > 0 && !AppState.workflow.cleaning;
    $('step2RepairFeedback').disabled = !ready || busy;
    $('btnStep2RepairFeedback').disabled = !ready || busy;
    $('step2RepairComparison').hidden = !comparison;
    $('step2RepairSummary').textContent = comparison
      ? `${comparison.before} dòng gốc → ${comparison.after} dòng sau sửa · ${comparison.changed} ô thay đổi · ${comparison.added.length} cột thêm`
      : 'Bản đối chiếu sẽ xuất hiện sau khi làm sạch.';
    $('step2RepairColumns').innerHTML = (comparison?.columns || []).map(({name, count}) => {
      const action = AppState.importChanges.find(change => change.to === name)?.from;
      return `<li><strong>${escapeHtml(name)}</strong> · ${count} ô${action ? ' · ' + escapeHtml(action) : ''}</li>`;
    }).join('');
    const structural = [];
    if (comparison?.added.length) structural.push('Cột thêm vào bảng làm việc: ' + comparison.added.join(', ') + '.');
    if (comparison && comparison.before > comparison.after) {
      structural.push(`Đã loại ${comparison.before - comparison.after} dòng trùng hoặc không có dữ liệu. Vị trí trong bảng gốc: ${comparison.removed.join(', ')}${comparison.removed.length < comparison.before - comparison.after ? '…' : ''}.`);
    }
    $('step2RepairStructure').textContent = structural.join(' ');
    $('step2RepairDiffTable').hidden = !comparison?.cells.length;
    $('step2RepairDiffRows').innerHTML = (comparison?.cells || []).map(({row, column, before, after}) =>
      `<tr><td>${row}</td><th scope="row">${escapeHtml(column)}</th><td class="diff-before">${escapeHtml(before) || '∅'}</td><td class="diff-after">${escapeHtml(after) || '∅'}</td></tr>`).join('');
    $('step2RepairDiffLimit').textContent = !comparison ? '' : !comparison.changed
      ? 'Các giá trị ô trong tệp gốc được giữ nguyên.'
      : `Hiển thị ${comparison.cells.length} trên ${comparison.changed} ô thay đổi. Ký hiệu ∅ chỉ ô trống hoặc chưa có cột.`;
    const plan = AppState.tableAnalysis;
    const scope = [
      plan ? 'Cột phân tích: ' + plan.columns.join(', ') + '.' : 'Phân tích theo các trường của báo cáo đơn hàng.',
      plan?.filters.length ? 'Bộ lọc: ' + reviewFilters(plan.filters) + '.' : '',
      plan?.groupBy.length ? 'Phân nhóm theo: ' + plan.groupBy.join(', ') + '.' : ''
    ];
    $('step2RepairScope').textContent = scope.filter(Boolean).join(' ');
    const preview = review.preview;
    $('step2RepairPreview').hidden = !preview;
    $('step2RepairCoverage').textContent = preview
      ? `Phạm vi tính: ${preview.matchedCount} trên ${preview.sourceCount} dòng · ${preview.columnCount} cột.` : '';
    $('step2RepairHighlights').innerHTML = (preview?.insights || []).map(({title, desc}) =>
      `<li><strong>${escapeHtml(title)}</strong> · ${escapeHtml(desc)}</li>`).join('');
    $('step2RepairFindings').textContent = preview?.findings || '';
    $('step2RepairHistory').hidden = !review.revisions.length;
    $('step2RepairHistoryList').innerHTML = review.revisions.map(({note, columns, matchedCount}, i) =>
      `<li><strong>Lượt ${i + 1}:</strong> ${escapeHtml(note)} · ${matchedCount} dòng · ${escapeHtml(columns.join(', '))}</li>`).join('');
  }

  async function reviseReview(event) {
    event.preventDefault();
    const review = AppState.repairReview;
    const note = $('step2RepairFeedback').value.trim();
    const status = $('step2RepairMessage');
    if (!review || reviewRequest || !canEnterStep(3) || AppState.currentStep !== 2) return;
    if (!note) {
      status.textContent = 'Hãy nhập yêu cầu điều chỉnh.';
      return;
    }
    const rows = AppState.cleanRows;
    const previous = AppState.tableAnalysis;
    const controller = new AbortController();
    reviewRequest = controller;
    const isCurrent = () => reviewRequest === controller && AppState.repairReview === review && AppState.cleanRows === rows;
    const context = previous
      ? 'Phạm vi hiện tại: ' + previous.columns.join(', ') + '. Điều kiện: ' + reviewFilters(previous.filters)
        + '. Phân nhóm: ' + previous.groupBy.join(', ') + '.'
      : '';
    status.textContent = 'AI đang xác định lại các cột và điều kiện phân tích…';
    syncWorkflowControls();
    try {
      const scopeNote = context
        ? context.slice(0, 320) + ' Giữ phần phạm vi chưa được yêu cầu đổi. Yêu cầu mới: ' + note
        : note;
      const plan = await resolveTableScope(rows, AppState.headers, scopeNote, controller);
      if (!isCurrent()) return;
      if (!plan.columns.length) throw new Error('Hãy nêu cột hoặc chỉ số bạn muốn phân tích.');
      plan.note = note;
      if (!filterTableRows(rows, plan.filters).length) {
        throw new Error('Bộ lọc mới không có dòng phù hợp. Hãy đổi điều kiện hoặc giá trị lọc.');
      }
      status.textContent = 'AI đang tổng hợp và viết nhận xét theo yêu cầu mới…';
      const result = await analyzeTable(rows, plan, controller.signal);
      if (!isCurrent()) return;
      AppState.tableAnalysis = plan;
      AppState.analysisFeedbackHistory.push(note);
      review.preview = reviewPreview(result.profile, result.findings);
      review.revisions.push({note, columns: plan.columns, matchedCount: result.profile.matchedCount});
      $('step2RepairFeedback').value = '';
      $('step2RepairPreview').open = true;
      status.textContent = `Đã cập nhật phạm vi phân tích cho ${result.profile.matchedCount} dòng. Bạn có thể góp ý tiếp hoặc sang bước 3.`;
      invalidateAnalysis(true);
      document.dispatchEvent(new CustomEvent('pipeline:data'));
    } catch (error) {
      if (isCurrent() && !controller.signal.aborted) status.textContent = 'Chưa áp dụng yêu cầu. ' + error.message;
    } finally {
      if (reviewRequest === controller) {
        reviewRequest = null;
        syncWorkflowControls();
      }
    }
  }

  function init() {
    $('step2RepairForm').addEventListener('submit', reviseReview);
    $('btnAutoRepairFile').addEventListener('click', () => actOnFile(false));
    $('fileRepairScope').addEventListener('input', () => {
      if (!state || state.busy) return;
      state.plan = null;
      openDetails(false);
      togglePanel('repairFeedbackPanel', 'btnShowRepairFeedback', false);
      setStatus('');
      render();
    });
    $('btnShowRepairDetails').addEventListener('click', () => actOnFile(true));
    $('btnShowRepairFeedback').addEventListener('click', showFeedback);
    $('repairFeedbackPanel').addEventListener('submit', applyFeedback);
  }
  window.FileRepair = { load, isBusy: () => Boolean(state?.busy), analyzeTable, renderTableResults, filterTableRows, resolveTableScope,
    resetReview, captureReview, renderReview, isReviewBusy: () => Boolean(reviewRequest) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
