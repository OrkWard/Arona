# Arona 核心

Arona 由两个服务组成，收集、存储服务的 db-worker，核心服务 arona；前者的入口是 db-worker.ts，后者的入口是 arona.ts

两个服务使用 docker compose 部署，Dockerfile 均位于 dockerfiles/ 下；
