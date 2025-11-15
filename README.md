# EbenEzerLiveExpo

Aplicación móvil desarrollada en **React Native + Expo** para comunicación en tiempo real mediante WebRTC, con soporte de audio y servicios de señalización.

---

## Características

- Audio en tiempo real mediante WebRTC.
- Gestión de altavoz y audio en Android.
- Configuración de ICE servers (STUN/TURN) segura mediante variables de entorno.
- Compatible con Android y iOS.

---

## Instalación

1. Clonar el repositorio:

   git clone https://github.com/tuusuario/EbenEzerLiveExpo.git
   cd EbenEzerLiveExpo

2. Instalar dependencias:
  
      npm install
      # o
      yarn install

3. Configurar variables de entorno:
   cp .env.example .env
   # Rellena las credenciales necesarias

4. Ejecutar en desarrollo:
   npx expo start

   
Variables de entorno

TURN_USERNAME y TURN_CREDENTIAL para servidores TURN.

SIGNALING_URL para señalización WebRTC.

CONTACT_PHONE, CONTACT_WHATSAPP, CONTACT_EMAIL (opcional).

Importante: Nunca subir el archivo .env a repositorios públicos.

