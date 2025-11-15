declare module "@voximplant/react-native-foreground-service" {
  export interface NotificationChannelConfig {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    enableVibration?: boolean;
  }

  export interface ServiceConfig {
    channelId: string;
    id: number;
    title: string;
    text: string;
    icon?: string;
    button?: string;
  }

  const VIForegroundService: {
    createNotificationChannel(config: NotificationChannelConfig): Promise<void>;
    startService(config: ServiceConfig): Promise<void>;
    stopService(): Promise<void>;
  };

  export default VIForegroundService;
}
