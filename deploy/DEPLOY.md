# Ubuntu Static Deployment

适用于当前这个 Vue + Vite 静态大屏项目。

## 本地构建

```bash
npm run build
tar -czf /tmp/ecochill-159.89.93.140-dist.tar.gz -C dist .
```

## 服务器准备

把下面三个文件传到 Ubuntu 服务器：

- `deploy/server-setup.sh`
- `deploy/159.89.93.140.conf`
- `/tmp/ecochill-159.89.93.140-dist.tar.gz`

## 服务器执行

```bash
chmod +x /root/server-setup.sh
/root/server-setup.sh 159.89.93.140 /tmp/ecochill-159.89.93.140-dist.tar.gz /root/159.89.93.140.conf
```

## 发布目录

- 站点目录：`/var/www/159.89.93.140/current`
- nginx 配置：`/etc/nginx/sites-available/159.89.93.140.conf`

## 检查

```bash
nginx -t
systemctl status nginx --no-pager
curl -I http://159.89.93.140
```
