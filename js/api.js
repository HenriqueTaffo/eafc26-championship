window.App = window.App || {};

App.api = {
  async loadApiData(options = {}) {
    const {
      showLoader = true,
      title = "Atualizando dados",
      message = "Aguarde enquanto os dados mais recentes são consultados."
    } = options;

    if (showLoader && App.main?.showLoader) {
      App.main.showLoader(title, message);
    }

    try {
      const response = await fetch(`${App.config.API_URL}?t=${Date.now()}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Erro ao carregar planilha.");

      App.state.apiResults = data.results || [];
      App.state.apiTransfers = data.transfers || [];
      App.state.apiEvents = data.events || [];
      App.state.apiLoaded = true;
      App.main.renderAll();
      return data;
    } catch (error) {
      App.state.apiLoaded = false;
      console.error(error);
      App.main.renderAll();
      const resultMessage = document.getElementById("resultMessage");
      App.utils.setMessage(resultMessage, `Não consegui carregar a planilha: ${error.message}`, "error");
      throw error;
    } finally {
      if (showLoader && App.main?.hideLoader) {
        App.main.hideLoader();
      }
    }
  },

  async postToApi(payload) {
    const response = await fetch(App.config.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, pin: App.config.API_PIN })
    });
    return response.json();
  }
};
