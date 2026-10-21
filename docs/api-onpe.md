# 📡 Documentación Técnica de la API de la ONPE

Detalle de ingeniería inversa del servicio web utilizado por el portal de convocatorias de la ONPE (`reclutamiento.onpe.gob.pe`).

---

## 1. Endpoint Principal

- **URL:** `https://reclutamiento.onpe.gob.pe/sigloc-backend/v1/api/convocatoria/lista`
- **Método HTTP:** `POST`
- **Content-Type:** `application/json`
- **Autenticación:** Sesión gestionada vía cookies de Cloudflare (`cf_clearance`).

---

## 2. Parámetros del Payload (Request Body)

```json
{
  "tipoConvocatoria": 1,
  "idRubro": 0,
  "idDepartamento": 0,
  "idLugarEjecucion": 0,
  "idOdp": 85,
  "fechaPublicacion": {
    "start": null,
    "end": null
  },
  "page": 0,
  "pageSize": 20,
  "palabraClave": null,
  "verConcluidas": false
}
```

### Descripción de campos:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `tipoConvocatoria` | `number` | Modalidad de contratación (`1` = Locación de servicios / SIGLOC). |
| `idRubro` | `number` | Categoría/rubro profesional (`0` = Todos). |
| `idDepartamento` | `number` | Código de departamento geográfico (`0` = Todos). |
| `idLugarEjecucion` | `number` | Ubicación específica de ejecución (`0` = Todos). |
| `idOdp` | `number` | Identificador de la **Oficina Descentralizada de Procesos Electorales (ODPE)**. Ej: **`85` = SANTA**. |
| `fechaPublicacion` | `object` | Rango de fechas `{ start: string \| null, end: string \| null }`. |
| `page` | `number` | Índice de página base cero (`0`, `1`, `2`...). |
| `pageSize` | `number` | Cantidad de registros por página (ej. `10` o `20`). |
| `palabraClave` | `string \| null` | Filtro textual de búsqueda libre por título o palabra. |
| `verConcluidas` | `boolean` | `false` para mostrar solo convocatorias con proceso vigente / postulaciones abiertas. |

---

## 3. Estructura de Respuesta (Response JSON)

```json
{
  "success": true,
  "message": "La operación se ejecutó correctamente",
  "messageInterno": null,
  "titulo": null,
  "tipoIcono": null,
  "data": {
    "convocatoriasPage": {
      "rows": [
        {
          "idConvocatoria": 1420,
          "codigo": "LOC-2026-0045",
          "cargo": "Coordinador de Local de Votación",
          "remuneracion": 800,
          "fechaInicioPostulacion": "2026-10-25",
          "fechaFinPostulacion": "2026-10-30",
          "odpe": "SANTA"
        }
      ],
      "page": 0,
      "pageSize": 20,
      "totalPages": 1,
      "totalRecords": 1
    }
  }
}
```

---

## 4. Retos de Seguridad y Protección (Cloudflare)

El dominio está tras Cloudflare WAF:
1. **Rechazo a clientes HTTP estándar:** Librerías como `requests` (Python), `fetch` (Node) o `cURL` reciben `HTTP 403 Forbidden` si la cabecera TLS (JA3 fingerprint) o las cookies de validación no son emitidas por un motor JavaScript verificado.
2. **Solución implementada:** Playwright levanta Chromium con Xvfb en Linux, completando el reto JS de Cloudflare de forma natural y ejecutando la llamada con las credenciales de sesión activas.
