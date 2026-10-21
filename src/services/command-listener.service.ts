import { INotifierService } from './notifier.service.js';
import { MonitorService } from './monitor.service.js';

export interface ISchedulerController {
  changeIntervalMinutes(minutes: number): boolean;
  getCurrentIntervalMinutes(): number;
}

export class TelegramCommandListenerService {
  private botToken: string;
  private authorizedChatId: string;
  private monitor: MonitorService;
  private scheduler: ISchedulerController;
  private notifier: INotifierService;
  private isRunning: boolean = false;
  private lastUpdateId: number = 0;

  constructor(
    botToken: string,
    authorizedChatId: string,
    monitor: MonitorService,
    scheduler: ISchedulerController,
    notifier: INotifierService
  ) {
    this.botToken = botToken;
    this.authorizedChatId = String(authorizedChatId);
    this.monitor = monitor;
    this.scheduler = scheduler;
    this.notifier = notifier;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[TelegramCommands] Iniciando escucha de comandos interactivos (/time, /check, /status)...');
    this.pollUpdates();
  }

  public stop(): void {
    this.isRunning = false;
  }

  private async pollUpdates(): Promise<void> {
    while (this.isRunning) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
        const resp = await fetch(url);
        if (!resp.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data = await resp.json() as {
          ok: boolean;
          result: Array<{
            update_id: number;
            message?: {
              chat: { id: number };
              text?: string;
              from?: { first_name?: string };
            };
          }>;
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;
            if (update.message && update.message.text) {
              await this.handleMessage(update.message.chat.id, update.message.text.trim());
            }
          }
        }
      } catch (err) {
        // En caso de corte de red temporal, esperar 5s
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  private async handleMessage(chatId: number, text: string): Promise<void> {
    if (String(chatId) !== this.authorizedChatId) {
      console.warn(`[TelegramCommands] Intento de acceso no autorizado desde chat ID: ${chatId}`);
      return;
    }

    const [command, ...args] = text.split(/\s+/);
    const cmd = command.toLowerCase();

    console.log(`[TelegramCommands] Comando recibido: "${text}"`);

    switch (cmd) {
      case '/start':
      case '/help':
        await this.notifier.sendSystemMessage(
          `🤖 *Panel de Control de ONPE Bot*\n\n` +
          `Comandos disponibles:\n` +
          `⏱️ \`/time <minutos>\` - Cambiar frecuencia de consulta (ej. \`/time 1\` o \`/time 30\`).\n` +
          `🔍 \`/check\` - Forzar una consulta manual inmediata.\n` +
          `📊 \`/status\` - Ver estado del bot, intervalo actual y última hora de revisión.\n` +
          `❓ \`/help\` - Mostrar este mensaje de ayuda.`
        );
        break;

      case '/time': {
        const minArg = parseInt(args[0], 10);
        if (isNaN(minArg) || minArg < 1 || minArg > 1440) {
          await this.notifier.sendSystemMessage(
            `⚠️ Por favor especifica un número de minutos válido entre 1 y 1440.\nEjemplo: \`/time 1\` o \`/time 15\``
          );
          return;
        }

        const success = this.scheduler.changeIntervalMinutes(minArg);
        if (success) {
          await this.notifier.sendSystemMessage(
            `⏱️ *¡Frecuencia actualizada con éxito!*\n\nEl bot ahora consultará la ONPE cada *${minArg} minuto(s)*.`
          );
        } else {
          await this.notifier.sendSystemMessage(`❌ Error al reprogramar el intervalo.`);
        }
        break;
      }

      case '/check': {
        await this.notifier.sendSystemMessage(`⏳ *Iniciando consulta manual en la ONPE...*`);
        const result = await this.monitor.check();
        if (result.success) {
          await this.notifier.sendSystemMessage(
            `✅ *Consulta manual finalizada*\n\n` +
            `📍 ODPE: *SANTA*\n` +
            `📋 Convocatorias vigentes: *${result.totalFound}*\n` +
            `🚨 Nuevas alertas enviadas: *${result.newCount}*`
          );
        } else {
          await this.notifier.sendSystemMessage(`❌ Error en la consulta manual: ${result.message}`);
        }
        break;
      }

      case '/status': {
        const status = this.monitor.getLastStatus();
        const interval = this.scheduler.getCurrentIntervalMinutes();
        await this.notifier.sendSystemMessage(
          `📊 *ESTADO DEL BOT*\n\n` +
          `📍 ODPE vigilada: *${status.odpNombre}* (ID: ${status.idOdp})\n` +
          `⏱️ Intervalo actual: Cada *${interval} minuto(s)*\n` +
          `🕒 Última verificación: *${status.lastCheckTime || 'Aún no ejecutada'}*\n` +
          `📋 Convocatorias activas en la última ronda: *${status.lastTotalFound}*\n` +
          `💾 Historial de IDs recordados: *${status.totalSeenHistory}*`
        );
        break;
      }

      default:
        // Mensaje no reconocido
        break;
    }
  }
}
