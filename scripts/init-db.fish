#!/usr/bin/env fish

# 数据库初始化脚本 (Fish Shell 版本)
# 用于初始化 Vercel Postgres 数据库表结构

# 颜色输出
set RED '\033[0;31m'
set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set NC '\033[0m' # No Color

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  数据库初始化脚本$NC"
echo -e "$GREEN========================================$NC"
echo ""

# 从 .env.local 加载 CRON_SECRET
if test -f .env.local
    set CRON_SECRET (grep CRON_SECRET .env.local | cut -d '=' -f2 | string trim)
end

# 检查环境变量
if test -z "$CRON_SECRET"
    echo -e "$RED错误: CRON_SECRET 环境变量未设置$NC"
    echo "请在 .env.local 文件中设置 CRON_SECRET"
    exit 1
end

# 询问环境
echo -e "$YELLOW请选择环境:$NC"
echo "1) 本地开发 (http://localhost:3001)"
echo "2) 生产环境 (自定义URL)"
read -P "请输入选项 (1 或 2): " env_choice

if test "$env_choice" = "1"
    set BASE_URL "http://localhost:3001"
else if test "$env_choice" = "2"
    read -P "请输入生产环境URL (例如: https://your-app.vercel.app): " BASE_URL
else
    echo -e "$RED无效的选项$NC"
    exit 1
end

echo ""
echo -e "$YELLOW正在初始化数据库...$NC"
echo "URL: $BASE_URL/api/db/init"
echo ""

# 调用初始化API
set -l temp_file (mktemp)
set http_code (curl -s -w "%{http_code}" -o $temp_file -X GET "$BASE_URL/api/db/init" \
  -H "Authorization: Bearer $CRON_SECRET")
set http_body (cat $temp_file)
rm -f $temp_file

# 检查响应
if test "$http_code" = "200"
    echo -e "$GREEN✓ 数据库初始化成功!$NC"
    echo ""
    echo "响应内容:"
    echo $http_body | jq '.' 2>/dev/null; or echo $http_body
    echo ""
    echo -e "$GREEN========================================$NC"
    echo -e "$GREEN  初始化完成！$NC"
    echo -e "$GREEN========================================$NC"
    echo ""
    echo "接下来你可以："
    echo "1. 访问搜索页面: $BASE_URL/?rid=test-001"
    echo "2. 进行搜索以生成验证问题"
    echo "3. 访问验证页面: $BASE_URL/verify?rid=test-001"
else
    echo -e "$RED✗ 数据库初始化失败$NC"
    echo "HTTP 状态码: $http_code"
    echo "响应内容:"
    echo $http_body
    exit 1
end

