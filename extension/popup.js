const statusEl = document.getElementById('status');
const buttons = [...document.querySelectorAll('[data-mode]')];

function render(data) {
  const mode = data?.mode || 'NORMAL';
  for (const button of buttons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }
  const s = data?.status;
  if (!s) {
    statusEl.textContent = 'Nessun dato ancora.';
    return;
  }
  statusEl.textContent =
    `Modalità: ${mode}\nLimite background: ${s.limit}\nScaricate ora: ${s.discardedNow}\nFinestre background selezionate: ${s.backgroundSelected}`;
}

async function refresh() {
  render(await browser.runtime.sendMessage({ type: 'get-status' }));
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'set-mode', mode: button.dataset.mode });
    await refresh();
  });
}

document.getElementById('enforce').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'enforce-now' });
  await refresh();
});

refresh();
