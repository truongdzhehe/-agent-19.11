(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const launcher = $('agentChatToggle');
  const panel = $('agentChatPanel');
  const transcript = $('agentChatTranscript');
  const form = $('agentChatForm');
  const field = $('agentChatQuestion');
  const send = $('agentChatSend');
  const status = $('agentChatStatus');
  const datasetOption = $('agentChatDatasetOption');
  const useDataset = $('agentChatUseDataset');
  const datasetFields = ['totalRev', 'estimatedProfit', 'orderCount', 'allCount', 'canceledCount',
    'completionRate', 'aov', 'uniqueCustomers', 'repeatCustomers', 'repeatRate', 'unknownCustomerOrders'];
  const messages = [];
  let busy = false;
  let datasetGeneration;

  function syncDatasetOption() {
    if (datasetGeneration !== fileReadGeneration || !AppState.workflow.importValid) {
      useDataset.checked = false;
      datasetGeneration = fileReadGeneration;
    }
    datasetOption.hidden = !AppState.workflow.importValid;
  }

  function tableContext() {
    if (!useDataset.checked || !AppState.workflow.importValid) return undefined;
    const { workflow, headers, analytics } = AppState;
    const context = {
      rowCount: (workflow.cleaned ? AppState.cleanRows : AppState.rawRows).length,
      columnCount: headers.length,
      columnNames: headers.slice(0, 30).map(name => Array.from(name).slice(0, 120).join('')).filter(Boolean)
    };
    const metrics = analytics.lastMetrics;
    if (workflow.analysisReady && !workflow.analysisRunning && !workflow.paramsDirty && metrics) {
      context.metrics = Object.fromEntries(datasetFields
        .filter(key => metrics[key] != null && Number.isFinite(Number(metrics[key])))
        .map(key => [key, Number(metrics[key])]));
      context.metrics.period = metrics.period;
      context.metrics.peakPeriodLabel = metrics.peakPeriodLabel;
    }
    return context;
  }

  document.addEventListener('pipeline:data', syncDatasetOption);
  document.addEventListener('pipeline:step', syncDatasetOption);
  field.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  function openChat(open) {
    if (open) syncDatasetOption();
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    (open ? field : launcher).focus();
  }

  function appendMessage(text, role) {
    const bubble = document.createElement('p');
    bubble.className = 'agent-chat-message';
    bubble.dataset.role = role;
    const name = document.createElement('strong');
    name.textContent = role === 'user' ? 'Bạn' : 'Trợ lý';
    const content = document.createElement('span');
    content.textContent = text;
    bubble.append(name, content);
    transcript.append(bubble);
    transcript.scrollTop = transcript.scrollHeight;
    return bubble;
  }

  launcher.addEventListener('click', () => openChat(panel.hidden));
  $('agentChatClose').addEventListener('click', () => openChat(false));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      openChat(false);
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = field.value.trim();
    if (!question || busy) return;
    busy = true;
    panel.toggleAttribute('data-replying', true);
    send.disabled = true;
    field.value = '';
    status.textContent = 'Trợ lý đang trả lời…';
    const userMessage = { role: 'user', text: question };
    const userBubble = appendMessage(question, 'user');
    try {
      syncDatasetOption();
      const { text } = await window.Gemini.request('chat', {
        messages: [...messages.slice(-12), userMessage],
        dataset: tableContext()
      }, AbortSignal.timeout(33000));
      messages.push(userMessage, { role: 'model', text: Array.from(text).slice(0, 3000).join('') });
      if (messages.length > 12) messages.splice(0, messages.length - 12);
      appendMessage(text, 'model');
      status.textContent = '';
    } catch (error) {
      status.textContent = error.name === 'TimeoutError'
        ? 'Gemini trả lời quá lâu. Bạn có thể gửi lại câu hỏi.'
        : error instanceof TypeError
          ? 'Mất kết nối với Agent. Kiểm tra localhost rồi gửi lại câu hỏi.'
          : error.message;
      if (!field.value) {
        userBubble.remove();
        field.value = question;
      }
    } finally {
      busy = false;
      panel.removeAttribute('data-replying');
      send.disabled = false;
    }
  });
})();
