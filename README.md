# Arona

Arona 是一个 OneBot Application，由三个服务和一个站点组成。它们都位于 apps/ 目录下：

- apps/backup：备份能力
- apps/essence：导出精华能力
- apps/subscribe：推特订阅能力
- apps/zju-ba-page：前端，目前仅包含一个精华消息预览页

## features

### backup

- 定期从主群备份群员到备份群，信息存储在 invite 表内
- 定期导出群成员列表到文件，信息存储在 /var/lib/arona/backup/

### subscribe

- 每 5 分钟获取 Blue_ArchiveJP 账号的消息，发送至群内

### essence

获取群精华消息，存储在当前目录下的 essence.json。图片上传到 r2 存储。

### 站点

目前仅有展示群精华消息的能力。
