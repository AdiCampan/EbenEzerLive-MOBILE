module.exports = {
  dependencies: {
    // Módulo para controlar el modo de audio
    "local-audiomode": {
      root: __dirname, // apunta a la carpeta actual
      platforms: {
        android: {
          sourceDir: "android",
          packageImportPath:
            "import com.localmodules.audiomode.AudioModePackage;",
          packageInstance: "new AudioModePackage()",
        },
      },
    },

    // Foreground service de Voximplant (mantener funcionalidad de audio con pantalla apagada)
    "@voximplant/react-native-foreground-service": {
      root: __dirname + "/voximplant-react-native-foreground-service",
      platforms: {
        android: {
          sourceDir: "android",
          packageImportPath:
            "import com.voximplant.foregroundservice.VIForegroundServicePackage;",
          packageInstance: "new VIForegroundServicePackage()",
        },
      },
    },
  },
};
