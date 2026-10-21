import { chromium, Browser, Page } from 'playwright';
import { ConvocatoriaFilterPayload, OnpeApiResponse } from '../types/convocatoria.js';

export interface IScraperService {
  fetchConvocatorias(filter: ConvocatoriaFilterPayload): Promise<OnpeApiResponse | null>;
}

export class PlaywrightScraperService implements IScraperService {
  private headless: boolean;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  public async fetchConvocatorias(filter: ConvocatoriaFilterPayload): Promise<OnpeApiResponse | null> {
    let browser: Browser | null = null;
    try {
      console.log('[PlaywrightScraper] Iniciando instancia de navegador para resolver Cloudflare...');
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'es-PE'
      });

      const page: Page = await context.newPage();

      console.log('[PlaywrightScraper] Navegando a la página de convocatorias...');
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'networkidle',
        timeout: 45000
      });

      // Breve pausa para asegurar que Cloudflare haya emitido cf_clearance
      await page.waitForTimeout(3000);

      console.log(`[PlaywrightScraper] Consultando API interna de ONPE (idOdp: ${filter.idOdp})...`);
      const apiResult: OnpeApiResponse = await page.evaluate(async (payload) => {
        const response = await fetch('/sigloc-backend/v1/api/convocatoria/lista', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      }, filter);

      return apiResult;
    } catch (error) {
      console.error('[PlaywrightScraper] Error durante el scraping/fetch:', error);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
