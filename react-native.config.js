module.exports = {
  dependencies: {
    "@voximplant/react-native-foreground-service": {
      root:
        __dirname + "/local-modules/voximplant-react-native-foreground-service",
      platforms: {
        android: {
          sourceDir: "android",
          packageImportPath:
            "import com.voximplant.foregroundservice.VIForegroundServicePackage;",
          packageInstance: "new VIForegroundServicePackage()",
        },
      },
    },
    "local-audiomode": {
      root: __dirname + "/local-modules/android",
      platforms: {
        android: {
          sourceDir: "android",
          packageImportPath:
            "import com.localmodules.audiomode.AudioModePackage;",
          packageInstance: "new AudioModePackage()",
        },
      },
    },
  },
};
