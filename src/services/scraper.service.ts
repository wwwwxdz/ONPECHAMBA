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

      // Stealth: ocultar señales de automatización
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        (window as unknown as { chrome: unknown }).chrome = { runtime: {} };
      });

      let capturedResponse: OnpeApiResponse | null = null;

      // Interceptar la petición que Angular lanza automáticamente al cargar la página
      // Solo modificamos el idOdp, dejamos que Angular envíe todos sus headers nativos
      await page.route('**/sigloc-backend/v1/api/convocatoria/lista', async (route) => {
        try {
          const raw = route.request().postData();
          const data = raw ? JSON.parse(raw) : {};

          // Inyectar la ODPE deseada
          data.idOdp = filter.idOdp;
          data.pageSize = filter.pageSize || 20;

          console.log(`[PlaywrightScraper] Interceptando petición Angular → inyectando idOdp: ${filter.idOdp}`);
          await route.continue({ postData: JSON.stringify(data) });
        } catch {
          await route.continue();
        }
      });

      // Capturar la respuesta de la API
      page.on('response', async (resp) => {
        if (resp.url().includes('sigloc-backend/v1/api/convocatoria/lista')) {
          console.log(`[PlaywrightScraper] Respuesta API recibida: HTTP ${resp.status()}`);
          try {
            capturedResponse = await resp.json();
          } catch {
            const text = await resp.text().catch(() => '(no text)');
            console.warn(`[PlaywrightScraper] Respuesta no JSON: ${text.substring(0, 100)}`);
          }
        }
      });

      console.log('[PlaywrightScraper] Cargando portal ONPE (esperando que Angular haga la petición)...');
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Esperar hasta 30 segundos a que Angular cargue y haga la petición
      // Cloudflare puede tomar entre 5-20s en un VPS
      const startWait = Date.now();
      const maxWait = 30000;
      while (!capturedResponse && Date.now() - startWait < maxWait) {
        await page.waitForTimeout(500);
      }

      const elapsed = Math.round((Date.now() - startWait) / 1000);

      if (!capturedResponse) {
        // Si Angular no disparó la petición en 30s (raro), intentar hacer click en "BUSCAR"
        console.warn(`[PlaywrightScraper] Angular no disparó petición en ${elapsed}s. Intentando click en BUSCAR...`);
        try {
          await page.locator('button:has-text("BUSCAR")').click({ timeout: 5000 });
          await page.waitForTimeout(5000);
        } catch {
          console.warn('[PlaywrightScraper] No se encontró botón BUSCAR.');
        }
      }

      if (capturedResponse) {
        const apiData = capturedResponse as OnpeApiResponse;
        const total = apiData.data?.convocatoriasPage?.totalRecords ?? 0;
        console.log(`[PlaywrightScraper] ✅ Captura exitosa en ${elapsed}s. Convocatorias: ${total}`);
      } else {
        console.warn('[PlaywrightScraper] ⚠️ No se capturó respuesta. Probablemente Cloudflare bloqueó el VPS.');
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
