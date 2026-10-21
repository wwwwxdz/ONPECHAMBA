import { ConvocatoriaItem } from '../types/convocatoria.js';

export interface INotifierService {
  notifyNewConvocatoria(item: ConvocatoriaItem, odpNombre: string): Promise<boolean>;
  sendSystemMessage(message: string): Promise<boolean>;
}

export class TelegramNotifierService implements INotifierService {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  public async notifyNewConvocatoria(item: ConvocatoriaItem, odpNombre: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.warn('[TelegramNotifier] Bot Token o Chat ID no configurados. Omitiendo notificación.');
      return false;
    }

    const title = item.cargo || item.puesto || item.descripcion || item.numeroConvocatoria || 'Nueva Convocatoria Disponible';
    const codigo = item.codigo || item.numeroConvocatoria || 'N/A';
    const remuneracion = item.remuneracion ? `S/ ${item.remuneracion}` : 'Ver en bases';
    const fechas = (item.fechaInicioPostulacion && item.fechaFinPostulacion)
      ? `${item.fechaInicioPostulacion} hasta ${item.fechaFinPostulacion}`
      : 'Revisar cronograma en web';

    const message = [
      `🚨 *¡NUEVA CONVOCATORIA ONPE!* 🚨`,
      ``,
      `📍 *Zona / ODPE:* ${odpNombre}`,
      `💼 *Cargo / Puesto:* ${title}`,
      `🏷️ *Código:* \`${codigo}\``,
      `💰 *Honorarios:* ${remuneracion}`,
      `📅 *Postulación:* ${fechas}`,
      ``,
      `🔗 [Ir al Portal de Convocatorias](https://reclutamiento.onpe.gob.pe/convocatorias)`
    ].join('\n');

    return this.sendMessage(message);
  }

  public async sendSystemMessage(text: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) return false;
    return this.sendMessage(`ℹ️ *[ONPE Bot]* ${text}`);
  }

  private async sendMessage(text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: text,
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[TelegramNotifier] Error al enviar mensaje: ${response.status} - ${errorData}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[TelegramNotifier] Error de conexión con Telegram:', error);
      return false;
    }
  }
}
