async function loadCampaigns() {
  const el = document.getElementById('campaigns-list');
  if (!el) return;
  try {
    const campaigns = await apiFetch('/api/campaigns');
    if (!campaigns.length) {
      el.innerHTML = '<p>No campaigns yet. <a href="/campaigns/new">Create one</a>.</p>';
      return;
    }
    el.innerHTML = campaigns.map(c => `
      <article>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <hgroup style="margin:0">
            <h3 style="margin:0"><a href="/campaigns/${c.id}">${c.name}</a></h3>
            <p style="margin:0;color:var(--pico-muted-color)">${c.topic}</p>
          </hgroup>
          <div style="display:flex;gap:0.5rem;align-items:center">
            ${statusBadge(c.status)}
            ${(c.target_platforms || []).map(p => platformBadge(p)).join(' ')}
          </div>
        </div>
        <footer style="display:flex;gap:0.5rem;margin-top:0.5rem">
          <a href="/campaigns/${c.id}" role="button" class="outline">View</a>
          <button class="outline secondary" onclick="deleteCampaign(${c.id})">Delete</button>
        </footer>
      </article>`).join('');
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

async function loadCampaignDetail(id) {
  const el = document.getElementById('campaign-detail');
  if (!el) return;
  try {
    const c = await apiFetch(`/api/campaigns/${id}`);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <hgroup>
          <h1>${c.name}</h1>
          <p>${c.topic}</p>
        </hgroup>
        <div style="display:flex;gap:0.5rem">
          ${statusBadge(c.status)}
          <button onclick="generateCalendar(${c.id})">Generate Calendar</button>
          <button class="outline secondary" onclick="deleteCampaign(${c.id})">Delete</button>
        </div>
      </div>
      <p><strong>Goals:</strong> ${c.goals}</p>
      <p><strong>Platforms:</strong> ${(c.target_platforms || []).map(p => platformBadge(p)).join(' ')}</p>
      ${c.start_date ? `<p><strong>Start:</strong> ${fmtDate(c.start_date)}</p>` : ''}
      ${c.end_date ? `<p><strong>End:</strong> ${fmtDate(c.end_date)}</p>` : ''}

      <h2>Content Calendar</h2>
      <div id="calendar-container">
        ${renderCalendar(c.content_calendar)}
      </div>

      <h2>Posts</h2>
      <div id="campaign-posts"><article aria-busy="true"><p>Loading…</p></article></div>
    `;
    loadCampaignPosts(id);
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

function renderCalendar(calendar) {
  if (!calendar || !calendar.length) {
    return '<p>No content calendar yet. Click "Generate Calendar" to create one with Claude.</p>';
  }
  return `<table>
    <thead><tr><th>Platform</th><th>Topic</th><th>Content Type</th><th>Timing</th></tr></thead>
    <tbody>${calendar.map(item => `
      <tr>
        <td>${platformBadge(item.platform)}</td>
        <td>${item.topic}</td>
        <td>${item.content_type || '—'}</td>
        <td>${item.timing_suggestion || '—'}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function loadCampaignPosts(campaignId) {
  const el = document.getElementById('campaign-posts');
  if (!el) return;
  try {
    const posts = await apiFetch(`/api/posts?campaign_id=${campaignId}`);
    if (!posts.length) {
      el.innerHTML = '<p>No posts in this campaign.</p>';
      return;
    }
    el.innerHTML = renderPostsTable(posts);
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

async function generateCalendar(id) {
  const btn = event.target;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try {
    const result = await apiFetch(`/api/campaigns/${id}/generate-calendar`, { method: 'POST' });
    document.getElementById('calendar-container').innerHTML = renderCalendar(result.content_calendar);
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

async function createCampaign(formData) {
  const platforms = [...document.querySelectorAll('input[name="platforms"]:checked')].map(el => el.value);
  const payload = {
    name: formData.get('name'),
    topic: formData.get('topic'),
    goals: formData.get('goals'),
    description: formData.get('description') || null,
    target_platforms: platforms,
    start_date: formData.get('start_date') || null,
    end_date: formData.get('end_date') || null,
  };
  try {
    const c = await apiFetch('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) });
    window.location.href = `/campaigns/${c.id}`;
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign and all its posts?')) return;
  await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
  window.location.href = '/campaigns';
}

function renderPostsTable(posts) {
  if (!posts.length) return '<p>No posts.</p>';
  return `<table>
    <thead><tr><th>Platform</th><th>Content</th><th>Status</th><th>Scheduled</th><th>Actions</th></tr></thead>
    <tbody>${posts.map(p => `
      <tr>
        <td>${platformBadge(p.platform)}</td>
        <td>${p.content.substring(0, 60)}${p.content.length > 60 ? '…' : ''}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${p.scheduled_at ? fmtDate(p.scheduled_at) : '—'}</td>
        <td>
          ${p.status === 'draft' ? `<button class="outline" onclick="publishPost(${p.id})">Publish</button>` : ''}
          <button class="outline secondary" onclick="deletePost(${p.id})">Delete</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}
