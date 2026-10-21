import { IScraperService } from './scraper.service.js';
import { IStorageService } from './storage.service.js';
import { INotifierService } from './notifier.service.js';
import { ConvocatoriaFilterPayload } from '../types/convocatoria.js';

export interface CheckResult {
  success: boolean;
  totalFound: number;
  newCount: number;
  message?: string;
}

export class MonitorService {
  private scraper: IScraperService;
  private storage: IStorageService;
  private notifier: INotifierService;
  private idOdp: number;
  private odpNombre: string;
  private lastCheckTime: string | null = null;
  private lastTotalFound: number = 0;

  constructor(
    scraper: IScraperService,
    storage: IStorageService,
    notifier: INotifierService,
    idOdp: number,
    odpNombre: string
  ) {
    this.scraper = scraper;
    this.storage = storage;
    this.notifier = notifier;
    this.idOdp = idOdp;
    this.odpNombre = odpNombre;
  }

  public getLastStatus() {
    return {
      odpNombre: this.odpNombre,
      idOdp: this.idOdp,
      lastCheckTime: this.lastCheckTime,
      lastTotalFound: this.lastTotalFound,
      totalSeenHistory: this.storage.getTotalSeen()
    };
  }

  public async check(): Promise<CheckResult> {
    const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    this.lastCheckTime = timestamp;

    console.log(`\n========================================`);
    console.log(`[Monitor] Ejecutando verificación: ${timestamp}`);
    console.log(`[Monitor] Monitoreando ODPE: ${this.odpNombre} (ID: ${this.idOdp})`);

    const filter: ConvocatoriaFilterPayload = {
      tipoConvocatoria: 1,
      idRubro: 0,
      idDepartamento: 0,
      idLugarEjecucion: 0,
      idOdp: this.idOdp,
      fechaPublicacion: { start: null, end: null },
      page: 0,
      pageSize: 20,
      palabraClave: null,
      verConcluidas: false
    };

    const response = await this.scraper.fetchConvocatorias(filter);

    if (!response || !response.success || !response.data?.convocatoriasPage) {
      console.warn('[Monitor] No se pudo obtener una respuesta válida de la ONPE.');
      return { success: false, totalFound: 0, newCount: 0, message: 'Fallo al conectar con ONPE / Cloudflare' };
    }

    const rows = response.data.convocatoriasPage.rows || [];
    this.lastTotalFound = rows.length;
    console.log(`[Monitor] Convocatorias activas encontradas en ${this.odpNombre}: ${rows.length}`);

    let newConvocatoriasCount = 0;

    for (const item of rows) {
      const uniqueId = item.id || item.idConvocatoria || item.codigo || item.numeroConvocatoria;
      if (!uniqueId) continue;

      if (!this.storage.isAlreadySeen(uniqueId)) {
        console.log(`[Monitor] ¡NUEVA CONVOCATORIA DETECTADA! ID: ${uniqueId}`);
        await this.notifier.notifyNewConvocatoria(item, this.odpNombre);
        this.storage.markAsSeen(uniqueId);
        newConvocatoriasCount++;
      }
    }

    if (newConvocatoriasCount > 0) {
      this.storage.save();
      console.log(`[Monitor] Se enviaron ${newConvocatoriasCount} alerta(s) y se actualizó el registro.`);
    } else {
      console.log('[Monitor] No hay convocatorias nuevas en esta ronda.');
    }
    console.log(`========================================\n`);

    return {
      success: true,
      totalFound: rows.length,
      newCount: newConvocatoriasCount
    };
  }
}
