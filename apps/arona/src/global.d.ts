namespace NodeJS {
  interface ProcessEnv {
    ONEBOT_AUTH_TOKEN: string;
    ONEBOT_ORIGIN: string;
    QQ_GROUP_ID: string;
    QQ_ADMIN_ID: string;

    STATIC_ROOT: string;
    STATIC_HOST: string;
    STATIC_PORT: string;

    TRPC_SERVER: string;
    REDIS: string;
    SENTRY_DSN: string;
  }
}
