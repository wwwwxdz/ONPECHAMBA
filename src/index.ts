import cron, { ScheduledTask } from 'node-cron';
import { config } from './config/env.js';
import { JsonStorageService } from './services/storage.service.js';
import { TelegramNotifierService } from './services/notifier.service.js';
import { PlaywrightScraperService } from './services/scraper.service.js';
import { MonitorService } from './services/monitor.service.js';
import { TelegramCommandListenerService, ISchedulerController } from './services/command-listener.service.js';

class DynamicScheduler implements ISchedulerController {
  private currentTask: ScheduledTask | null = null;
  private currentMinutes: number = 1; // Por defecto 1 minuto para pruebas
  private onTrigger: () => Promise<void>;

  constructor(initialMinutes: number, onTrigger: () => Promise<void>) {
    this.currentMinutes = initialMinutes;
    this.onTrigger = onTrigger;
    this.scheduleTask(this.currentMinutes);
  }

  public changeIntervalMinutes(minutes: number): boolean {
    try {
      this.currentMinutes = minutes;
      this.scheduleTask(this.currentMinutes);
      return true;
    } catch (e) {
      console.error('[DynamicScheduler] Error reprogramando cron:', e);
      return false;
    }
  }

  public getCurrentIntervalMinutes(): number {
    return this.currentMinutes;
  }

  private scheduleTask(minutes: number): void {
    if (this.currentTask) {
      this.currentTask.stop();
    }

    const cronExpr = minutes === 1 ? '* * * * *' : `*/${minutes} * * * *`;
    console.log(`[DynamicScheduler] Programando verificación cada ${minutes} minuto(s) (${cronExpr})...`);

    this.currentTask = cron.schedule(cronExpr, async () => {
      try {
        await this.onTrigger();
      } catch (err) {
        console.error('[DynamicScheduler] Error durante la ejecución:', err);
      }
    });
  }

  public stop(): void {
    if (this.currentTask) {
      this.currentTask.stop();
    }
  }
}

async function bootstrap() {
  console.log('--------------------------------------------------');
  console.log('🤖 INICIANDO ONPE BOT DE ALERTAS INTERACTIVO');
  console.log(`📍 Zona / ODPE objetivo: ${config.odpNombre} (idOdp: ${config.idOdp})`);
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

  // Inicializar scheduler con 1 minuto por defecto para testear
  const scheduler = new DynamicScheduler(1, async () => {
    await monitor.check();
  });

  // Inicializar escucha interactiva de comandos de Telegram (/time, /check, /status)
  const commandListener = new TelegramCommandListenerService(
    config.telegramBotToken,
    config.telegramChatId,
    monitor,
    scheduler,
    notifierService
  );
  commandListener.start();

  // Mensaje de bienvenida con botones y comandos disponibles
  await notifierService.sendSystemMessage(
    `🤖 *ONPE Bot Activado*\n\n` +
    `📍 ODPE Monitoreada: *${config.odpNombre}*\n` +
    `⏱️ Frecuencia inicial: Cada *1 minuto* (modo prueba)\n\n` +
    `💡 *Comandos disponibles desde este chat:*\n` +
    `• \`/time 1\` o \`/time 30\` : Ajustar los minutos de consulta\n` +
    `• \`/check\` : Hacer una consulta manual ahora mismo\n` +
    `• \`/status\` : Ver estado general del bot`
  );

  // Primera ejecución inmediata al arrancar
  await monitor.check();

  const handleShutdown = (signal: string) => {
    console.log(`\n[Main] Recibida señal ${signal}. Cerrando bot...`);
    scheduler.stop();
    commandListener.stop();
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
