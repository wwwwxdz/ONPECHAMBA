import fs from 'node:fs';
import path from 'node:path';

export interface IStorageService {
  isAlreadySeen(id: string | number): boolean;
  markAsSeen(id: string | number): void;
  save(): void;
}

export class JsonStorageService implements IStorageService {
  private filePath: string;
  private seenIds: Set<string>;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.seenIds = new Set<string>();
    this.init();
  }

  private init(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.seenIds = new Set(parsed.map(String));
        }
      } else {
        this.save();
      }
    } catch (error) {
      console.error(`[StorageService] Error al inicializar almacenamiento:`, error);
    }
  }

  public isAlreadySeen(id: string | number): boolean {
    return this.seenIds.has(String(id));
  }

  public markAsSeen(id: string | number): void {
    this.seenIds.add(String(id));
  }

  public save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.seenIds), null, 2), 'utf-8');
    } catch (error) {
      console.error(`[StorageService] Error al guardar datos en ${this.filePath}:`, error);
    }
  }
}
