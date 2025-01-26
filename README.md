# Arona 核心

Arona 由两个服务组成，收集、存储服务的 db-worker，核心服务 arona；前者的入口是 db-worker.ts，后者的入口是 arona.ts

两个服务使用 docker compose 部署，Dockerfile 均位于 dockerfiles/ 下；

# 备份能力

1. 英灵殿
   - 定期从主群备份群员到备份群：建立一个 invite 表，包括三个 key 构成的主键：主群 id、备份群 id、qq 用户。定期从主群向备份群、
     已邀请过的群成员做集合差，并处理下一批群友
   - 定期导出群成员列表到文件
