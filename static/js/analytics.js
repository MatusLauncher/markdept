async function loadAnalytics() {
  await Promise.all([loadPostsAnalytics(), loadReports(), loadCampaignOptions()]);
}

async function loadPostsAnalytics() {
  const el = document.getElementById('posts-analytics');
  const summaryEl = document.getElementById('analytics-summary');
  if (!el) return;
  try {
    const data = await apiFetch('/api/analytics/posts');
    if (!data.length) {
      el.innerHTML = '<p>No analytics data yet. <button onclick="fetchLatestMetrics()">Fetch metrics</button> to collect data.</p>';
      if (summaryEl) summaryEl.innerHTML = '<article><p>No data</p></article>';
      return;
    }

    // Aggregate totals
    const totals = data.reduce((acc, a) => {
      acc.likes += a.likes; acc.reposts += a.reposts;
      acc.replies += a.replies; acc.views += a.views;
      return acc;
    }, { likes: 0, reposts: 0, replies: 0, views: 0 });

    if (summaryEl) {
      summaryEl.innerHTML = `
        <article><h3>${totals.views.toLocaleString()}</h3><p>Total Views</p></article>
        <article><h3>${totals.likes.toLocaleString()}</h3><p>Total Likes</p></article>
        <article><h3>${totals.reposts.toLocaleString()}</h3><p>Reposts / Shares</p></article>
        <article><h3>${totals.replies.toLocaleString()}</h3><p>Replies / Comments</p></article>`;
    }

    el.innerHTML = `<table>
      <thead><tr><th>Platform</th><th>Fetched At</th><th>Views</th><th>Likes</th><th>Reposts</th><th>Replies</th></tr></thead>
      <tbody>${data.map(a => `
        <tr>
          <td>${platformBadge(a.platform)}</td>
          <td>${fmtDate(a.fetched_at)}</td>
          <td>${a.views.toLocaleString()}</td>
          <td>${a.likes.toLocaleString()}</td>
          <td>${a.reposts.toLocaleString()}</td>
          <td>${a.replies.toLocaleString()}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

async function loadReports() {
  const el = document.getElementById('reports-list');
  if (!el) return;
  try {
    const reports = await apiFetch('/api/analytics/reports');
    if (!reports.length) {
      el.innerHTML = '<p>No reports yet. Generate one above.</p>';
      return;
    }
    el.innerHTML = reports.map(r => `
      <article>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>${r.title}</h3>
          <small>${fmtDate(r.created_at)}</small>
        </div>
        <p><em>${r.date_range_start?.substring(0,10)} to ${r.date_range_end?.substring(0,10)}</em></p>
        <details>
          <summary>View Report</summary>
          <div class="report-markdown">${markdownToHtml(r.report_text)}</div>
        </details>
      </article>`).join('');
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

async function loadCampaignOptions() {
  const sel = document.getElementById('report-campaign-select');
  if (!sel) return;
  try {
    const campaigns = await apiFetch('/api/campaigns');
    campaigns.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  } catch (e) {}
}

function showReportForm() {
  const el = document.getElementById('report-form');
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

async function fetchLatestMetrics() {
  const btn = event.target;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try {
    const result = await apiFetch('/api/analytics/fetch', { method: 'POST' });
    alert(`Fetched metrics for ${result.fetched} posts.`);
    await loadPostsAnalytics();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('gen-report-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = form.querySelector('button[type="submit"]');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      try {
        await apiFetch('/api/analytics/reports/generate', {
          method: 'POST',
          body: JSON.stringify({
            title: fd.get('title'),
            date_range_start: new Date(fd.get('date_range_start')).toISOString(),
            date_range_end: new Date(fd.get('date_range_end')).toISOString(),
            campaign_id: fd.get('campaign_id') ? parseInt(fd.get('campaign_id')) : null,
          }),
        });
        await loadReports();
        showReportForm();
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        btn.removeAttribute('aria-busy');
        btn.disabled = false;
      }
    });
  }
});

function markdownToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .trim();
}
