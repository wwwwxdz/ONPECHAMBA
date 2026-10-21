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
      console.log(`[PlaywrightScraper] Iniciando Chromium...`);
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

      // Estrategia 1: Interceptar la petición que Angular lanza automáticamente
      let capturedViaAngular: OnpeApiResponse | null = null;
      await page.route('**/sigloc-backend/v1/api/convocatoria/lista', async (route) => {
        try {
          const raw = route.request().postData();
          const data = raw ? JSON.parse(raw) : {};
          data.idOdp = filter.idOdp;
          data.pageSize = filter.pageSize || 20;
          console.log(`[PlaywrightScraper] [A] Interceptando petición Angular → idOdp: ${filter.idOdp}`);
          await route.continue({ postData: JSON.stringify(data) });
        } catch {
          await route.continue();
        }
      });

      page.on('response', async (resp) => {
        if (resp.url().includes('sigloc-backend/v1/api/convocatoria/lista')) {
          try {
            if (resp.status() === 200) {
              capturedViaAngular = await resp.json();
              console.log(`[PlaywrightScraper] [A] Respuesta Angular capturada: HTTP ${resp.status()}`);
            } else {
              console.warn(`[PlaywrightScraper] [A] Respuesta Angular: HTTP ${resp.status()} (ignorada)`);
            }
          } catch {
            console.warn(`[PlaywrightScraper] [A] Respuesta no JSON.`);
          }
        }
      });

      console.log('[PlaywrightScraper] Cargando portal ONPE...');
      await page.goto('https://reclutamiento.onpe.gob.pe/convocatorias', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Esperar hasta 20s por la respuesta de Angular
      const t0 = Date.now();
      while (!capturedViaAngular && Date.now() - t0 < 20000) {
        await page.waitForTimeout(500);
      }

      if (capturedViaAngular) {
        const total = (capturedViaAngular as OnpeApiResponse).data?.convocatoriasPage?.totalRecords ?? 0;
        console.log(`[PlaywrightScraper] ✅ [Estrategia A] Captura exitosa. Convocatorias: ${total}`);
        return capturedViaAngular;
      }

      // Estrategia 2 (fallback): fetch directo desde el contexto de la página
      // Funciona incluso cuando Cloudflare muestra la página de reto ("Un momento...")
      console.warn('[PlaywrightScraper] Angular no respondió en 20s → intentando [Estrategia B] fetch directo...');

      const payload = {
        tipoConvocatoria: filter.tipoConvocatoria,
        idRubro: filter.idRubro,
        idDepartamento: filter.idDepartamento,
        idLugarEjecucion: filter.idLugarEjecucion,
        idOdp: filter.idOdp,
        fechaPublicacion: filter.fechaPublicacion,
        page: filter.page,
        pageSize: filter.pageSize || 20,
        palabraClave: filter.palabraClave,
        verConcluidas: filter.verConcluidas
      };

      const resultB = await page.evaluate(async (body) => {
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
          if (!resp.ok) return { _error: `HTTP ${resp.status}` };
          return await resp.json();
        } catch (e: unknown) {
          return { _error: e instanceof Error ? e.message : String(e) };
        }
      }, payload);

      if (resultB && '_error' in (resultB as { _error?: string })) {
        console.error(`[PlaywrightScraper] [B] Fetch directo falló: ${(resultB as { _error: string })._error}`);
        return null;
      }

      const apiResultB = resultB as OnpeApiResponse;
      const totalB = apiResultB.data?.convocatoriasPage?.totalRecords ?? 0;
      console.log(`[PlaywrightScraper] ✅ [Estrategia B] Fetch directo exitoso. Convocatorias: ${totalB}`);
      return apiResultB;

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
