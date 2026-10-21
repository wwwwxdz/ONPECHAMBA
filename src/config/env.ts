import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  telegramBotToken: string;
  telegramChatId: string;
  cronSchedule: string;
  idOdp: number;
  odpNombre: string;
  headless: boolean;
  dataPath: string;
}

export const config: AppConfig = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  cronSchedule: process.env.CRON_SCHEDULE || '*/30 * * * *', // Cada 30 minutos por defecto
  idOdp: Number(process.env.ONPE_ID_ODP || '85'), // 85 = SANTA
  odpNombre: process.env.ONPE_ODP_NOMBRE || 'SANTA',
  headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
  dataPath: process.env.DATA_PATH || './data/seen_ids.json'
};
