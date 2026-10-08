# Mi Despacho

App de bitini labs para gestorías y empresas. Cada cuenta ve las apps que tiene contratadas.

- **Primera vez:** tipo de cuenta (gestoría o empresa), nombre, logo y colores.
- **Contabilidad:** abre la app de contabilidad de la usuaria y su carpeta en la nube.
- **Contratos → Crear → Contrato de cuentas en participación:** plantilla jurídica fija (no la escribe la IA), con editor de cláusulas, Word y "¿Quieres guardarlo en tu Drive/OneDrive?".
- **Revisar con IA:** pirámide gratuita (Gemma 4 → Gemini → gpt-oss → Llama → OpenRouter) con las claves de cada usuaria; Claude solo con su permiso.
- **Instalable** en el ordenador o el móvil como app.

Todo se guarda en el navegador de cada usuaria. Para guardar contratos directamente en Drive/OneDrive, rellenar `src/config.js`.

```
npm install
npm run dev
```
