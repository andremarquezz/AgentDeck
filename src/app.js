import UlanziApi from './vendor/ulanzi-api/index.js';
import { queryAllAccounts } from './codex.js';
import { gaugeSvg, initRenderer, svgToDataUri } from './render.js';

const PLUGIN_UUID = 'com.ulanzi.ulanzistudio.jeycodex';
const REFRESH_MS = 30000;

const ACTIONS = {
  'com.ulanzi.ulanzistudio.jeycodex.jey5h': { account: 'jey', window: 'fiveHour', label: '5H' },
  'com.ulanzi.ulanzistudio.jeycodex.jey7d': { account: 'jey', window: 'sevenDay', label: '7D' },
  'com.ulanzi.ulanzistudio.jeycodex.americano5h': { account: 'americano', window: 'fiveHour', label: '5H' },
  'com.ulanzi.ulanzistudio.jeycodex.americano7d': { account: 'americano', window: 'sevenDay', label: '7D' },
};

const api = new UlanziApi();
const instances = new Map();
let accounts = new Map();
let refreshing = null;
const lastGood = new Map();

await initRenderer();

function specFor(message) {
  return ACTIONS[message.actionid] || null;
}

function accountFor(spec) {
  return accounts.get(spec.account) || lastGood.get(spec.account) || {
    id: spec.account,
    label: spec.account === 'jey' ? 'JEY' : 'AMERICANO',
    status: 'loading',
    fiveHour: null,
    sevenDay: null,
  };
}

function renderInstance(instance) {
  const spec = ACTIONS[instance.actionid];
  if (!spec) return;

  const current = accountFor(spec);
  const fresh = accounts.get(spec.account);
  const stale = !fresh && lastGood.has(spec.account);
  const reading = current[spec.window] || null;
  const status = stale ? 'ok' : current.status;

  const svg = gaugeSvg({
    account: current.label,
    windowLabel: spec.label,
    reading,
    status,
    stale,
  });

  api.setBaseDataIcon(instance.context, svgToDataUri(svg));
}

function renderAll() {
  for (const instance of instances.values()) {
    try {
      renderInstance(instance);
    } catch {}
  }
}

async function refresh() {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const fresh = await queryAllAccounts();

    for (const [id, result] of fresh) {
      if (result.status === 'ok') lastGood.set(id, result);
    }

    accounts = new Map();
    for (const [id, result] of fresh) {
      if (result.status === 'error' && lastGood.has(id)) continue;
      accounts.set(id, result);
    }

    renderAll();
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

api.onAdd((message) => {
  if (!specFor(message)) return;

  instances.set(message.context, {
    context: message.context,
    actionid: message.actionid,
    key: message.key,
  });

  renderInstance(instances.get(message.context));
  void refresh();
});

api.onClear((message) => {
  if (Array.isArray(message.param)) {
    for (const item of message.param) {
      if (item && item.context) instances.delete(item.context);
    }
    return;
  }
  if (message.context) instances.delete(message.context);
});

api.onRun(() => {
  void refresh();
});

api.onConnected(() => {
  void refresh();
});

api.onError(() => {});
api.onClose(() => {});

api.connect(PLUGIN_UUID);

setInterval(() => {
  if (instances.size > 0) void refresh();
}, REFRESH_MS);
