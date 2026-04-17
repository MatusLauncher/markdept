async function loadPosts(statusFilter) {
  const el = document.getElementById('posts-list');
  if (!el) return;
  el.innerHTML = '<article aria-busy="true"><p>Loading…</p></article>';
  try {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    const posts = await apiFetch(`/api/posts${qs}`);
    if (!posts.length) {
      el.innerHTML = '<p>No posts found. <a href="/posts/new">Create one</a>.</p>';
      return;
    }
    el.innerHTML = `<table>
      <thead><tr><th>Platform</th><th>Content</th><th>Status</th><th>Scheduled/Published</th><th>Actions</th></tr></thead>
      <tbody>${posts.map(p => `
        <tr>
          <td>${platformBadge(p.platform)}</td>
          <td>${p.video_title ? `<strong>${p.video_title}</strong><br>` : ''}${p.content.substring(0, 60)}${p.content.length > 60 ? '…' : ''}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${p.scheduled_at ? fmtDate(p.scheduled_at) : p.published_at ? fmtDate(p.published_at) : '—'}</td>
          <td style="white-space:nowrap">
            ${p.status === 'draft' ? `<button class="outline" onclick="publishPost(${p.id})">Publish</button> ` : ''}
            ${p.status === 'scheduled' ? `<button class="outline secondary" onclick="cancelSchedule(${p.id})">Cancel</button> ` : ''}
            <button class="outline secondary" onclick="deletePost(${p.id})">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) {
    el.innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

function filterPosts(s) {
  const url = new URL(window.location);
  if (s) url.searchParams.set('status', s);
  else url.searchParams.delete('status');
  window.history.pushState({}, '', url);
  loadPosts(s);
}

async function generateContent() {
  const sel = document.getElementById('platform-select');
  const platform = sel.options[sel.selectedIndex]?.dataset.platform;
  if (!platform) { alert('Select a platform account first.'); return; }
  const topic = document.getElementById('gen-topic').value;
  if (!topic) { alert('Enter a topic first.'); return; }

  const btn = event.target;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try {
    const result = await apiFetch('/api/posts/generate', {
      method: 'POST',
      body: JSON.stringify({ platform, topic }),
    });
    const textarea = document.getElementById('post-content');
    if (textarea) {
      textarea.value = result.body || result.content || '';
      textarea.dispatchEvent(new Event('input'));
    }
    // Quick post on dashboard
    const dashTextarea = document.querySelector('#quick-post-form textarea[name="content"]');
    if (dashTextarea) {
      dashTextarea.value = result.body || result.content || '';
      document.getElementById('publish-btn').disabled = false;
    }
    if (result.title && document.querySelector('input[name="video_title"]')) {
      document.querySelector('input[name="video_title"]').value = result.title;
    }
  } catch (e) {
    alert('Generation failed: ' + e.message);
  } finally {
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

async function generateQuickPost() {
  const form = document.getElementById('quick-post-form');
  const sel = form.querySelector('select[name="platform_account_id"]');
  const platform = sel.options[sel.selectedIndex]?.text.split(' —')[0].toLowerCase();
  const topic = form.querySelector('input[name="topic"]').value;
  if (!platform || !topic) { alert('Select platform and enter topic.'); return; }

  const btn = event.target;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try {
    const result = await apiFetch('/api/posts/generate', {
      method: 'POST',
      body: JSON.stringify({ platform, topic }),
    });
    document.getElementById('generated-content').value = result.body || '';
    document.getElementById('publish-btn').disabled = false;
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

async function savePost(formData) {
  const sel = document.getElementById('platform-select');
  const platform = sel.options[sel.selectedIndex]?.dataset.platform;
  const tagsRaw = formData.get('video_tags_raw') || '';
  const payload = {
    platform_account_id: parseInt(formData.get('platform_account_id')),
    platform,
    content: formData.get('content'),
    campaign_id: formData.get('campaign_id') ? parseInt(formData.get('campaign_id')) : null,
    video_title: formData.get('video_title') || null,
    video_tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    video_file_path: formData.get('video_file_path') || null,
  };
  const scheduledAt = formData.get('scheduled_at');
  try {
    const post = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
    if (scheduledAt) {
      await apiFetch(`/api/posts/${post.id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_at: new Date(scheduledAt).toISOString() }),
      });
    }
    window.location.href = '/posts';
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function publishNow() {
  // same form data as savePost but publish immediately
  const form = document.getElementById('post-form');
  const formData = new FormData(form);
  const sel = document.getElementById('platform-select');
  const platform = sel.options[sel.selectedIndex]?.dataset.platform;
  const payload = {
    platform_account_id: parseInt(formData.get('platform_account_id')),
    platform,
    content: formData.get('content'),
    campaign_id: formData.get('campaign_id') ? parseInt(formData.get('campaign_id')) : null,
    video_title: formData.get('video_title') || null,
    video_file_path: formData.get('video_file_path') || null,
  };
  try {
    const post = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
    await apiFetch(`/api/posts/${post.id}/publish`, { method: 'POST' });
    window.location.href = '/posts';
  } catch (e) {
    alert('Publish failed: ' + e.message);
  }
}

async function publishPost(id) {
  if (!confirm('Publish this post now?')) return;
  try {
    await apiFetch(`/api/posts/${id}/publish`, { method: 'POST' });
    location.reload();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function cancelSchedule(id) {
  if (!confirm('Cancel the scheduled publish?')) return;
  try {
    await apiFetch(`/api/posts/${id}/cancel-schedule`, { method: 'POST' });
    location.reload();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  try {
    await apiFetch(`/api/posts/${id}`, { method: 'DELETE' });
    location.reload();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
