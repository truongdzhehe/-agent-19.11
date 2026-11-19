(() => {
  'use strict';

  async function request(feature, body, signal) {
    const response = await fetch('/api/gemini/' + feature, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw new Error(result?.error || 'Không kết nối được với Gemini. Hãy mở agent qua localhost.');
    }
    return result;
  }

  let displayedMetrics;
  let activeRequest;

  function syncInsights() {
    const button = document.getElementById('btnGeminiInsights');
    const status = document.getElementById('geminiInsightsStatus');
    if (!button || !status) return;
    const metrics = canEnterStep(5) ? AppState.analytics.lastMetrics : null;
    if (metrics !== displayedMetrics) {
      activeRequest?.abort();
      activeRequest = null;
      status.textContent = '';
      displayedMetrics = metrics;
    }
    button.disabled = !metrics?.allCount || Boolean(activeRequest);
  }

  async function runInsights() {
    syncInsights();
    const button = document.getElementById('btnGeminiInsights');
    const status = document.getElementById('geminiInsightsStatus');
    if (button.disabled) return;

    const requestController = new AbortController();
    const metrics = displayedMetrics;
    const { totalRev, estimatedProfit, profitMargin, orderCount, allCount,
      canceledCount, completionRate, aov, uniqueCustomers, repeatRate } = metrics;
    activeRequest = requestController;
    syncInsights();
    status.textContent = 'Gemini đang phân tích…';
    try {
      const { text } = await request('insights', {
        totalRev, estimatedProfit, profitMargin, orderCount, allCount, canceledCount,
        completionRate: Number(completionRate), aov, uniqueCustomers, repeatRate: Number(repeatRate),
        focus: AppState.analytics.focusStrategy
      }, requestController.signal);
      if (!requestController.signal.aborted) status.textContent = text;
    } catch (error) {
      if (!requestController.signal.aborted) status.textContent = error.message;
    } finally {
      if (activeRequest === requestController) activeRequest = null;
      syncInsights();
    }
  }

  window.Gemini = { request, syncInsights };
  document.getElementById('btnGeminiInsights')?.addEventListener('click', runInsights);
})();
