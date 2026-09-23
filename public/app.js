// Minimal frontend for Wireless Workbench. Uses the REST API + WebSocket.
(() => {
  const state = {
    token: localStorage.getItem('ww_token') || null,
    devices: [],
    telemetry: new Map(),
    interferenceCount: 0,
    ws: null,
  };

  const $ = (id) => document.getElementById(id);

  function showLogin(show) {
    $('login-overlay').style.display = show ? 'flex' : 'none';
  }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(`/api${path}`, { ...opts, headers });
    if (res.status === 401) {
      state.token = null;
      localStorage.removeItem('ww_token');
      showLogin(true);
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    if (res.status === 204) return null;
    return res.json();
  }

  async function login() {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('login-username').value, password: $('login-password').value }),
      });
      if (!res.ok) { alert('Login failed'); return; }
      const data = await res.json();
      state.token = data.token;
      localStorage.setItem('ww_token', data.token);
      showLogin(false);
      await init();
    } catch (e) {
      alert('Login error: ' + e.message);
    }
  }

  function logout() {
    state.token = null;
    localStorage.removeItem('ww_token');
    if (state.ws) state.ws.close();
    showLogin(true);
  }

  function renderDevices() {
    const tbody = $('device-table').querySelector('tbody');
    tbody.innerHTML = '';
    state.devices.forEach((d) => {
      const t = state.telemetry.get(d.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escape(d.name)}</td>
        <td>${d.type}</td>
        <td>${escape(d.model)}</td>
        <td>${d.frequencyMhz ? d.frequencyMhz + ' MHz' : '-'}</td>
        <td>${t ? t.batteryPercent.toFixed(1) + '%' : '-'}</td>
        <td>${t ? t.rfSignalDb.toFixed(1) + ' dB' : '-'}</td>
        <td><span class="status ${d.status}">${d.status}</span></td>
        <td><button class="secondary" data-delete="${d.id}">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this device?')) return;
        await api(`/devices/${btn.dataset.delete}`, { method: 'DELETE' });
        await refreshDevices();
      });
    });
    $('metric-devices').textContent = state.devices.length;
  }

  function updateMetrics() {
    const samples = Array.from(state.telemetry.values());
    if (samples.length === 0) return;
    const avgBat = samples.reduce((s, x) => s + x.batteryPercent, 0) / samples.length;
    const avgRf = samples.reduce((s, x) => s + x.rfSignalDb, 0) / samples.length;
    $('metric-avg-battery').textContent = avgBat.toFixed(1);
    $('metric-avg-rf').textContent = avgRf.toFixed(1);
    $('metric-interference').textContent = state.interferenceCount;
  }

  function logTelemetry(msg) {
    const log = $('telemetry-log');
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(line);
    while (log.children.length > 40) log.removeChild(log.lastChild);
  }

  async function refreshDevices() {
    state.devices = await api('/devices');
    renderDevices();
  }

  async function discover() {
    const res = await api('/devices/discover?count=3', { method: 'POST' });
    logTelemetry(`Discovered ${res.discovered} devices`);
    await refreshDevices();
  }

  async function addDevice() {
    const name = prompt('Device name?');
    if (!name) return;
    const model = prompt('Model?', 'ULXD4Q') || 'Unknown';
    await api('/devices', {
      method: 'POST',
      body: JSON.stringify({
        name, model, manufacturer: 'Shure', type: 'microphone',
        frequencyRange: { minMhz: 470, maxMhz: 534 },
      }),
    });
    await refreshDevices();
  }

  async function coordinate() {
    const band = { minMhz: parseFloat($('band-min').value), maxMhz: parseFloat($('band-max').value) };
    const spacingMhz = parseFloat($('spacing').value);
    if (state.devices.length === 0) { alert('No devices to coordinate'); return; }
    const result = await api('/coordinate', {
      method: 'POST',
      body: JSON.stringify({ deviceIds: state.devices.map((d) => d.id), band, spacingMhz }),
    });
    $('coord-result').textContent = JSON.stringify(result, null, 2);
    await refreshDevices();
  }

  function connectWs() {
    if (!state.token) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws?token=${state.token}`);
    state.ws = ws;
    ws.onopen = () => {
      const s = $('ws-status');
      s.textContent = 'WS: connected';
      s.className = 'status online';
    };
    ws.onclose = () => {
      const s = $('ws-status');
      s.textContent = 'WS: disconnected';
      s.className = 'status offline';
      setTimeout(connectWs, 3000);
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'sample') {
        state.telemetry.set(msg.data.deviceId, msg.data);
        renderDevices();
        updateMetrics();
      } else if (msg.type === 'interference') {
        state.interferenceCount++;
        logTelemetry(`INTERFERENCE detected on device ${msg.data.deviceId} (RF ${msg.data.rfSignalDb} dB)`);
        updateMetrics();
      } else if (msg.type === 'welcome') {
        (msg.data || []).forEach((s) => state.telemetry.set(s.deviceId, s));
        renderDevices();
        updateMetrics();
      }
    };
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function init() {
    // Mark devices online so the monitoring service produces telemetry.
    await refreshDevices();
    if (state.devices.length > 0) {
      await Promise.all(state.devices.filter((d) => d.status === 'offline').map((d) =>
        api(`/devices/${d.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'online' }) })));
      await refreshDevices();
    }
    connectWs();
  }

  $('login-btn').addEventListener('click', login);
  $('logout').addEventListener('click', logout);
  $('discover').addEventListener('click', discover);
  $('add-device').addEventListener('click', addDevice);
  $('refresh').addEventListener('click', refreshDevices);
  $('coordinate').addEventListener('click', coordinate);

  if (state.token) {
    showLogin(false);
    init().catch((e) => console.error(e));
  } else {
    showLogin(true);
  }
})();
