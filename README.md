# Desvalls Cultura - Web Oficial 2026

Aquest és el repositori oficial de la plataforma web de l'**Associació Cultura Sant Jordi Desvalls**. El portal inclou tota la informació sobre els festivals (Pluja de Lletres, Pluja d'Art) i el sistema d'inscripcions per a l'edició 2026.

## 🚀 Tecnologies i Arquitectura

- **Frontend:** HTML5, CSS3 (Glassmorphism), JavaScript (Vanilla).
- **Backend:** Google Apps Script (GAS) per a la gestió de formularis sense base de dades externa.
- **Base de dades:** Google Sheets (actuant com a receptor multicanal).
- **Desplegament:** GitHub Pages.

## 🛠️ Configuració del Backend

Per a que el sistema d'inscripcions funcioni, s'ha de configurar el connector de Google Sheets:

1. Obre el fitxer `web/google-sheets-script.gs`.
2. Segueix les instruccions detallades als comentaris del fitxer per desplegar-lo com a **Web App** a Google.
3. Copia l'URL de l'script (`/exec`) i enganxa'l a la línia 272 de `web/participa-pluja-art.html`.

## 🎨 Disseny

El web utilitza un disseny premium basat en el concepte de **Glassmorphism**, amb una paleta de colors alineada amb el logotip oficial de l'entitat:
- **Primary:** Teal (#12a298)
- **Secondary:** Vermell/Rosa (#f43f5e) contrastat.

## 🌍 Desplegament a Producció

Aquest repositori està preparat per ser servit via **GitHub Pages**. Un cop configurat el domini oficial `desvallscultura.cat`, la web estarà totalment operativa per al públic.

---
*Fent xarxa a Sant Jordi Desvalls.*
