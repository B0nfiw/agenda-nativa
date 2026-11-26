import { initBookingForm } from "./booking.js";
import { loadSalonConfig } from "./config-loader.js";
import { renderSite, setupNavigation, setupReveal, showError, showLoading } from "./renderer.js";

async function init() {
  showLoading();
  setupNavigation();

  try {
    const config = await loadSalonConfig();
    renderSite(config);
    initBookingForm(config);
    setupReveal();
  } catch (error) {
    console.error("Erro ao iniciar o site configurável:", error);
    showError();
  }
}

document.addEventListener("DOMContentLoaded", init);
