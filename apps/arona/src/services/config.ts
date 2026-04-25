export type AppConfig = {
  // OneBot
  onebotOrigin: string;
  onebotAuthToken: string;
  adminId: number;

  // Target groups (bot only processes messages from these groups)
  groupId: number | number[];

  // Redis
  redisUrl: string;

  // S3 server
  s3Endpoint: string;
  s3Ak: string;
  s3Sk: string;

  // Wormface
  wormfaceOrigin: string;

  // Arona-Machine-Learning
  mlOrigin: string;

  // MongoDB
  mongoUrl: string;
};
