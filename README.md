# epm-mentoria

Chatbot de mentoría en marketing digital, impulsado por IA (Gemini AI) y diseñado para integrarse con el ecosistema EPM App. Automatiza el asesoramiento y la generación de contenido para redes sociales, ofreciendo respuestas personalizadas y sugerencias estratégicas para negocios.

---

## Objetivo

**epm-mentoria** brinda acompañamiento y mentoría automatizada en marketing, usando IA para analizar datos de redes sociales y guiar a usuarios sobre estrategias, generación de contenido y mejora de métricas, todo integrado con el flujo de EPM App.

---

## Stack tecnológico

- **Frontend:** React + Material UI
- **API IA:** Gemini AI (Google Vertex)
- **Integración:** Recepción de datos vía UTM/parametros desde epm-app-v2
- **Automatización:** Generación de respuestas y sugerencias personalizadas en tiempo real

---

## Integración con epm-app-v2

- Recibe datos del usuario (ID, nombre, imagen, token) por parámetros en la URL.
- Usa las métricas y perfil de Instagram para personalizar las recomendaciones.
- Permite iniciar sesiones de mentoría AI directamente desde el dashboard de epm-app-v2.
- El flujo es transparente para el usuario y mantiene la seguridad de la sesión.

---

## Funcionalidades principales

- Chatbot mentor en marketing digital
- Respuestas y sugerencias estratégicas personalizadas vía IA
- Generación automática de textos para redes sociales
- Integración directa con métricas de Instagram/Facebook
- Automatización del proceso de asesoría y gestión de contenido

---

## Ventajas en AI Ops & Automation

- **Automatización:** El usuario recibe mentoría y asesoría sin intervención humana directa.
- **AI personalizada:** Gemini AI adapta el contenido y las recomendaciones a cada usuario y contexto.
- **Interoperabilidad:** Integración fluida con otras apps y herramientas externas (EPM App, Google Sheets).
- **Escalabilidad:** Permite atender múltiples usuarios simultáneamente sin saturación.

---

## Instalación y uso

### Prerrequisitos

- Tener desplegada la instancia de **epm-app-v2** y configurados los permisos de Meta Developers.
- Acceso a la API de Gemini AI (Google Vertex).

### Instalación

1. Clona el repositorio:
   ```sh
   git clone https://github.com/Leacou/epm-mentoria.git
   cd epm-mentoria
   ```

2. Instala las dependencias:
   ```sh
   npm install
   ```

3. Configura variables de entorno si corresponde (ejemplo de `.env`):
   ```
   VITE_GEMINI_API_KEY=tu_api_key
   ```

### Ejecución

```sh
npm run dev
```
Abre el navegador en la URL que indique la terminal (usualmente `http://localhost:5173`).

---

## Uso integrado

- Accede a epm-mentoria a través del dashboard de epm-app-v2.
- Los datos del usuario se pasan automáticamente, personalizando la experiencia de mentoría.
- El chatbot responde en base a métricas y contexto real del usuario.

---

## Contacto y contribuciones

¿Quieres colaborar o necesitas ayuda?  
- Abre un issue en este repositorio.
- Contacto: [leacou@gmail.com](mailto:leacou@gmail.com)

---
