# card.xiaowenz.com 静态站镜像:Caddy 托管 web/ 目录。
# 复刻 Zeabur 静态托管口径(仅 web/ 进镜像;fonts/ 为构建期资源,不随镜像分发)。
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY web/ /usr/share/caddy/
EXPOSE 8080
