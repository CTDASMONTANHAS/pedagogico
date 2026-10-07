// URL da implantação "App da Web" do Apps Script (termina em /exec).
// Deixe vazio para usar o modo demonstração (dados salvos só no navegador).
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwmzAW-7MzoLcLgMFuiU4dj8zavW0Gx5llgqx96b7OvFarnmC6O4KrifpnRRcTdOPK9/exec',
};
// ?demo no endereço abre o modo demonstração (dados só neste navegador), útil para testes
if (/[?&]demo\b/.test(location.search)) window.APP_CONFIG.API_URL = '';
