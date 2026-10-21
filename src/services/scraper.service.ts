import { chromium, Browser, Page } from 'playwright';
import { ConvocatoriaFilterPayload, OnpeApiResponse } from '../types/convocatoria.js';

export interface IScraperService {
  fetchConvocatorias(filter: ConvocatoriaFilterPayload): Promise<OnpeApiResponse | null>;
}

export class PlaywrightScraperService implements IScraperService {
  private headless: boolean;

  constructor(headless: boolean = false) {
    this.headless = headless;
  }

  public async fetchConvocatorias(filter: ConvocatoriaFilterPayload): Promise<OnpeApiResponse | null> {
    let browser: Browser | null = null;
    try {
      console.log(`[PlaywrightScraper] Iniciando Chromium en VPS (headless: ${this.headless})...`);
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,720'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'es-PE',
        timezoneId: 'America/Lima'
      });

      const page: Page = await context.newPage();

      // Ocultar señales de automatización (stealth)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        (window as unknown as { chrome: unknown }).chrome = { runtime: {} };
      });

      let capturedResponse: OnpeApiResponse | null = null;

      // Interceptar la petición de convocatorias que realiza el portal
      await page.route('**/sigloc-backend/v1/api/convocatoria/lista', async (route) => {
        try {
          const raw = route.request().postData();
          const data = raw ? JSON.parse(raw) : {};

          // Inyectamos el ID de la ODPE deseada (85 para Santa)
          data.idOdp = filter.idOdp;
          data.pageSize = filter.pageSize || 20;

          await route.continue({
            postData: JSON.stringify(data)
          });
        } catch {
          await route.continue();
        }
      });

      page.on('response', async (resp) => {
        if (resp.url().includes('convocatoria/lista')) {
          try {
            capturedResponse = await resp.json();
          } catch {
            // Ignorar respuestas que no sean JSON
          }
        }
      });

      console.log('[PlaywrightScraper] Navegando a portal ONPE...');
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Dar tiempo suficiente para que Cloudflare ejecute su cálculo JS (PoW) y cargue la API
      console.log('[PlaywrightScraper] Esperando resolución de Cloudflare y carga de la API...');
      const startWait = Date.now();
      while (!capturedResponse && Date.now() - startWait < 20000) {
        await page.waitForTimeout(500);
      }

      const finalTitle = await page.title().catch(() => 'desconocido');
      console.log(`[PlaywrightScraper] Título de página actual: "${finalTitle}"`);

      if (capturedResponse) {
        console.log('[PlaywrightScraper] ¡API interceptada exitosamente!');
      } else {
        console.warn('[PlaywrightScraper] No se capturó la respuesta a tiempo.');
      }

      return capturedResponse;
    } catch (error) {
      console.error('[PlaywrightScraper] Error durante el scraping:', error);
      return null;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}
