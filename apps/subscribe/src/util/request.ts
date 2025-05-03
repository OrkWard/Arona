import got from "got";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyEnv = process.env.https_proxy || process.env.all_rpoxy;
const proxyAgent = proxyEnv ? new HttpsProxyAgent(proxyEnv) : undefined;

const instance = got.extend({ mutableDefaults: true });
instance.defaults.options.agent.https = proxyAgent;

export const { get, post } = instance;
