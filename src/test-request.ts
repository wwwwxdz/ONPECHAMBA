import { config } from './config/env.js';
import { PlaywrightScraperService } from './services/scraper.service.js';
import { TelegramNotifierService } from './services/notifier.service.js';
import { ConvocatoriaFilterPayload } from './types/convocatoria.js';

async function runTest() {
  console.log('🧪 ================================================');
  console.log('🧪 INICIANDO TEST DE PETICIÓN A LA API DE LA ONPE');
  console.log(`📍 ODPE Objetivo: ${config.odpNombre} (ID: ${config.idOdp})`);
  console.log('🧪 ================================================\n');

  const scraper = new PlaywrightScraperService(config.headless);
  const notifier = new TelegramNotifierService(config.telegramBotToken, config.telegramChatId);

  const filter: ConvocatoriaFilterPayload = {
    tipoConvocatoria: 1,
    idRubro: 0,
    idDepartamento: 0,
    idLugarEjecucion: 0,
    idOdp: config.idOdp,
    fechaPublicacion: { start: null, end: null },
    page: 0,
    pageSize: 10,
    palabraClave: null,
    verConcluidas: false
  };

  const startTime = Date.now();
  console.log('⏳ Abriendo navegador invisible y pasando validación de Cloudflare...');
  const response = await scraper.fetchConvocatorias(filter);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n⏱️ Tiempo de respuesta: ${duration}s`);
  console.log('📦 Respuesta obtenida de la ONPE:');
  console.log(JSON.stringify(response, null, 2));

  if (response && response.success) {
    const totalRecords = response.data?.convocatoriasPage?.totalRecords ?? 0;
    const rows = response.data?.convocatoriasPage?.rows ?? [];
    console.log(`\n✅ ¡PETICIÓN EXITOSA!`);
    console.log(`📊 Convocatorias vigentes en ${config.odpNombre}: ${totalRecords}`);

    // Enviar notificación de prueba a Telegram
    await notifier.sendSystemMessage(
      `✅ *Test de Conexión Exitoso*\n\n` +
      `Se consultó la API de la ONPE correctamente en ${duration}s.\n` +
      `📍 Sede: *${config.odpNombre}*\n` +
      `📋 Convocatorias activas encontradas: *${totalRecords}*`
    );
    console.log('📲 Mensaje de confirmación enviado a tu Telegram.');
  } else {
    console.error('\n❌ No se pudo completar la petición o la ONPE devolvió error.');
  }
}

runTest().catch((err) => {
  console.error('Error en el test:', err);
});
