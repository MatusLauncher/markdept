async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return resp.status === 204 ? null : resp.json();
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function platformBadge(platform) {
  return `<span class="platform-badge platform-${platform}">${platform}</span>`;
}

function statusBadge(s) {
  return `<span class="status-badge status-${s}">${s}</span>`;
}

async function loadPlatformAccounts() {
  const el = document.getElementById('platform-list');
  if (!el) return;
  try {
    const platforms = await apiFetch('/api/platforms');
    if (!platforms.length) {
      el.innerHTML = '<p>No connected accounts.</p>';
      return;
    }
    el.innerHTML = `<table>
      <thead><tr><th>Platform</th><th>Account</th><th>Instance</th><th>Actions</th></tr></thead>
      <tbody>${platforms.map(p => `
        <tr>
          <td>${platformBadge(p.platform)}</td>
          <td>${p.account_name}</td>
          <td>${p.instance_url || '—'}</td>
          <td><button class="outline secondary" onclick="disconnectPlatform(${p.id})">Disconnect</button></td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) {
    el.innerHTML = `<p class="error">Error: ${e.message}</p>`;
  }
}

async function disconnectPlatform(id) {
  if (!confirm('Disconnect this account?')) return;
  await apiFetch(`/api/platforms/${id}`, { method: 'DELETE' });
  location.reload();
}
