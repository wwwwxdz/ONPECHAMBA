import { chromium, Browser } from 'playwright';
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
      console.log(`[PlaywrightScraper] Iniciando Chromium (headless: ${this.headless})...`);
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

      const page = await context.newPage();

      // Ocultar señales de automatización
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        (window as unknown as { chrome: unknown }).chrome = { runtime: {} };
      });

      console.log('[PlaywrightScraper] Cargando portal ONPE y resolviendo Cloudflare...');

      // Paso 1: Cargar la página para obtener la cookie cf_clearance válida
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Paso 2: Esperar a que Cloudflare resuelva su reto JS (máx 15s)
      await this.waitForCloudflare(page);

      const title = await page.title();
      console.log(`[PlaywrightScraper] Página cargada: "${title}"`);

      if (title.toLowerCase().includes('moment') || title.toLowerCase().includes('checking')) {
        console.warn('[PlaywrightScraper] Cloudflare aún no superado. Esperando más...');
        await page.waitForTimeout(8000);
      }

      // Paso 3: Hacer el fetch directamente desde el contexto del navegador (ya tiene cf_clearance)
      console.log(`[PlaywrightScraper] Consultando API con idOdp: ${filter.idOdp}...`);

      const payload: ConvocatoriaFilterPayload = {
        ...filter
      };

      const result = await page.evaluate(async (body: ConvocatoriaFilterPayload) => {
        try {
          const resp = await fetch('/sigloc-backend/v1/api/convocatoria/lista', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*'
            },
            credentials: 'include',
            body: JSON.stringify(body)
          });

          if (!resp.ok) {
            return { _error: `HTTP ${resp.status}` };
          }

          return await resp.json();
        } catch (e: unknown) {
          return { _error: e instanceof Error ? e.message : String(e) };
        }
      }, payload);

      if (result && '_error' in result) {
        console.error(`[PlaywrightScraper] Error en fetch interno: ${result._error}`);
        return null;
      }

      const apiResult = result as OnpeApiResponse;
      const totalRecords = apiResult?.data?.convocatoriasPage?.totalRecords ?? 0;
      console.log(`[PlaywrightScraper] ✅ Respuesta OK. Convocatorias encontradas: ${totalRecords}`);

      return apiResult;
    } catch (error) {
      console.error('[PlaywrightScraper] Error durante el scraping:', error);
      return null;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Espera a que la cookie cf_clearance esté presente,
   * lo que indica que Cloudflare validó la sesión del navegador.
   */
  private async waitForCloudflare(page: import('playwright').Page): Promise<void> {
    const maxWaitMs = 15000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const cookies = await page.context().cookies();
      const hasCloudflare = cookies.some(c => c.name === 'cf_clearance');
      if (hasCloudflare) {
        console.log('[PlaywrightScraper] ✅ Cloudflare superado (cf_clearance obtenida).');
        return;
      }
      await page.waitForTimeout(500);
    }

    console.warn('[PlaywrightScraper] ⚠️ cf_clearance no encontrada tras 15s. Continuando de todos modos...');
  }
}
