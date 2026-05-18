# 针对的免费泛域名 HTTPS 完整指南

我们申请的是**`*.lightfish.top`泛域名证书**，不仅覆盖`app-webdev.lightfish.top`，以后你添加任何子域名（如`api.lightfish.top`、`admin.lightfish.top`）都**不需要重新申请证书**，直接用就行。

---

## 第一步：创建阿里云 RAM 子账号（安全第一）

**绝对不要用主账号的 AccessKey**，一旦泄露会危及你整个阿里云账号的安全。

1. 登录阿里云，进入 [RAM 访问控制控制台](https://ram.console.aliyun.com/users)
2. 点击"创建用户"
   - 用户名称：`acme-dns`（随便起，好记就行）
   - 访问方式：**只勾选"编程访问"**，不要勾选控制台登录
   - 点击"确定"
3. **立即保存生成的 `AccessKey ID` 和 `AccessKey Secret`**（只显示一次，一定要保存好）
4. 回到用户列表，点击刚创建的`acme-dns`用户
5. 点击"添加权限"
6. 在搜索框输入 `AliyunDNSFullAccess`，选择这个权限，点击"确定"

✅ 现在你有了一个只有 DNS 解析权限的专用子账号，非常安全。

---

## 第二步：安装 acme.sh（国内加速版）

登录到你的 Linux 服务器，执行以下命令：

```bash
# 安装依赖（Ubuntu/Debian）
sudo apt update && sudo apt install -y curl socat

# 使用国内Gitee镜像安装acme.sh（比GitHub快10倍）
curl https://gitee.com/acmesh-official/acme.sh/raw/master/acme.sh | sh -s email=你的邮箱地址

# 使命令生效（必须执行，否则会提示acme.sh: command not found）
source ~/.bashrc

# 验证安装成功
acme.sh --version
```

安装完成后，acme.sh 会自动创建一个每日定时任务，检查并续期即将过期的证书。

> 国内云服务器默认是 CentOS 系统，所以你先试这个命令：

```bash
sudo yum install -y curl socat openssl
```

> acme 安装失败：使用官方推荐的一键安装（推荐）

```bash
curl https://get.acme.sh | sh -s email=1426286337@qq.com
```

---

## 第三步：配置阿里云 DNS 凭证

把刚才保存的 AccessKey 替换进去，执行：

```bash
export Ali_Key="你的AccessKey ID"
export Ali_Secret="你的AccessKey Secret"
```

acme.sh 会自动把这两个密钥保存到`~/.acme.sh/account.conf`中，**以后续期不需要再重新设置**。

---

## 第四步：一键申请泛域名证书

执行这一条命令，全程自动完成：

```bash
acme.sh --issue --dns dns_ali -d lightfish.top -d *.lightfish.top --server letsencrypt
```

**说明**：

- `--dns dns_ali`：指定使用阿里云 DNS 自动验证
- `-d lightfish.top -d *.lightfish.top`：同时为**主域名**和**所有一级子域名**申请证书
- `--server letsencrypt`：使用 Let's Encrypt 签发证书（默认是 ZeroSSL，也可以不用加这个参数）

整个过程大约需要 1-2 分钟，acme.sh 会自动在你的域名下添加临时 TXT 记录完成验证，验证完成后会自动删除。

看到类似下面的输出，就说明证书申请成功了：

```
[Thu May 14 22:30:00 CST 2026] Your cert is in: /root/.acme.sh/lightfish.top/lightfish.top.cer
[Thu May 14 22:30:00 CST 2026] Your cert key is in: /root/.acme.sh/lightfish.top/lightfish.top.key
[Thu May 14 22:30:00 CST 2026] The intermediate CA cert is in: /root/.acme.sh/lightfish.top/ca.cer
[Thu May 14 22:30:00 CST 2026] And the full chain certs is there: /root/.acme.sh/lightfish.top/fullchain.cer
```

---

## 第五步：安装证书到 Nginx

执行以下命令，把证书安装到 Nginx 的标准目录，并配置自动续期时重载 Nginx：

```bash
# 创建证书存放目录
sudo mkdir -p /etc/nginx/ssl/lightfish.top

# 安装证书
acme.sh --install-cert -d lightfish.top \
  --key-file /etc/nginx/ssl/lightfish.top/privkey.pem \
  --fullchain-file /etc/nginx/ssl/lightfish.top/fullchain.pem \
  --reloadcmd "sudo systemctl reload nginx"
```

✅ **自动续期已经配置完成**！以后证书到期前 30 天，acme.sh 会自动续期，并且自动重载 Nginx，你完全不用管。

---

## 第六步：配置 Nginx HTTPS

修改你的 Nginx 配置文件（通常在`/etc/nginx/sites-available/`目录下），替换成下面的内容：

```nginx
# HTTP 80端口：强制跳转到HTTPS
server {
    listen 80;
    server_name lightfish.top *.lightfish.top;
    return 301 https://$host$request_uri;
}

# HTTPS 443端口：主配置
server {
    listen 443 ssl http2;
    server_name app-webdev.lightfish.top; # 你的子域名

    # 证书路径（不要修改）
    ssl_certificate /etc/nginx/ssl/lightfish.top/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/lightfish.top/privkey.pem;

    # 推荐的SSL安全配置（复制粘贴就行）
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 你的反向代理配置（原来的内容复制到这里）
    location / {
        proxy_pass http://127.0.0.1:3000; # 你的应用端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

保存后，测试 Nginx 配置并重启：

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 验证是否成功

1. 访问 `https://app-webdev.lightfish.top`，浏览器地址栏应该显示安全锁图标
2. 点击安全锁图标，查看证书信息，有效期应该是 90 天
3. 测试自动续期：
   ```bash
   acme.sh --renew -d lightfish.top --dry-run
   ```
   看到"Success"就说明自动续期配置正常。

---

## 常见问题

### Q：以后添加新的子域名怎么办？

A：什么都不用做！因为我们申请的是`*.lightfish.top`泛域名证书，直接在 Nginx 里添加新的 server 块就行，证书会自动生效。

### Q：证书有效期只有 90 天，会不会过期？

A：不会！acme.sh 安装时已经自动创建了每日定时任务，会在证书到期前 30 天自动续期，并且自动重载 Nginx。

### Q：我想同时支持多个泛域名怎么办？

A：比如你还想支持`*.api.lightfish.top`，只需要重新执行申请命令：

```bash
acme.sh --issue --dns dns_ali -d lightfish.top -d *.lightfish.top -d *.api.lightfish.top
```
