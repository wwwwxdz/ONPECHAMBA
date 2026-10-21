import cron from 'node-cron';
import { config } from './config/env.js';
import { JsonStorageService } from './services/storage.service.js';
import { TelegramNotifierService } from './services/notifier.service.js';
import { PlaywrightScraperService } from './services/scraper.service.js';
import { MonitorService } from './services/monitor.service.js';

async function bootstrap() {
  console.log('--------------------------------------------------');
  console.log('🤖 INICIANDO ONPE BOT DE ALERTAS DE CONVOCATORIAS');
  console.log(`📍 Zona / ODPE objetivo: ${config.odpNombre} (idOdp: ${config.idOdp})`);
  console.log(`⏱️ Cron programado: "${config.cronSchedule}"`);
  console.log(`📁 Ruta de persistencia: "${config.dataPath}"`);
  console.log('--------------------------------------------------');

  const storageService = new JsonStorageService(config.dataPath);
  const notifierService = new TelegramNotifierService(config.telegramBotToken, config.telegramChatId);
  const scraperService = new PlaywrightScraperService(config.headless);

  const monitor = new MonitorService(
    scraperService,
    storageService,
    notifierService,
    config.idOdp,
    config.odpNombre
  );

  // Mensaje inicial opcional de confirmación a Telegram
  await notifierService.sendSystemMessage(
    `Bot iniciado correctamente en Dokploy.\nMonitoreando ODPE: *${config.odpNombre}* cada ${config.cronSchedule}`
  );

  // Primera ejecución inmediata al arrancar el contenedor
  await monitor.check();

  // Programar ejecuciones periódicas
  cron.schedule(config.cronSchedule, async () => {
    try {
      await monitor.check();
    } catch (err) {
      console.error('[Main] Error durante la tarea programada:', err);
    }
  });

  const handleShutdown = (signal: string) => {
    console.log(`\n[Main] Recibida señal ${signal}. Cerrando bot de forma segura...`);
    storageService.save();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Error fatal al iniciar el bot:', err);
  process.exit(1);
});
