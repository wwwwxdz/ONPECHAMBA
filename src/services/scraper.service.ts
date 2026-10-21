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
      console.log(`[PlaywrightScraper] Iniciando navegador (headless: ${this.headless})...`);
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page: Page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
        locale: 'es-PE'
      });

      let capturedResponse: OnpeApiResponse | null = null;

      // Interceptar la petición de convocatorias que realiza el portal
      await page.route('**/sigloc-backend/v1/api/convocatoria/lista', async (route) => {
        try {
          const raw = route.request().postData();
          const data = raw ? JSON.parse(raw) : {};

          // Inyectamos el ID de la ODPE deseada (ej. 85 para Santa)
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

      console.log('[PlaywrightScraper] Navegando a la página de convocatorias de la ONPE...');
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'networkidle',
        timeout: 45000
      });

      if (!capturedResponse) {
        await page.waitForTimeout(4000);
      }

      return capturedResponse;
    } catch (error) {
      console.error('[PlaywrightScraper] Error durante el scraping:', error);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
