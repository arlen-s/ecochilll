# Ubuntu Static Deployment

适用于当前这个 Vue + Vite 静态大屏项目。

## 本地构建

```bash
npm run build
tar -czf /tmp/ancientherbs.ac.cn-dist.tar.gz -C dist .
```

## 服务器准备

把下面三个文件传到 Ubuntu 服务器：

- `deploy/server-setup.sh`
- `deploy/ancientherbs.ac.cn.conf`
- `/tmp/ancientherbs.ac.cn-dist.tar.gz`

## 服务器执行

```bash
chmod +x /root/server-setup.sh
/root/server-setup.sh ancientherbs.ac.cn /tmp/ancientherbs.ac.cn-dist.tar.gz /root/ancientherbs.ac.cn.conf
```

## 发布目录

- 站点目录：`/var/www/ancientherbs.ac.cn/current`
- nginx 配置：`/etc/nginx/sites-available/ancientherbs.ac.cn.conf`

## 检查

```bash
nginx -t
systemctl status nginx --no-pager
curl -I http://ancientherbs.ac.cn
```
