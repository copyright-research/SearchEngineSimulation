#!/bin/bash

# 数据库初始化脚本
# 用于初始化 Vercel Postgres 数据库表结构

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  数据库初始化脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查环境变量
if [ -z "$CRON_SECRET" ]; then
  echo -e "${RED}错误: CRON_SECRET 环境变量未设置${NC}"
  echo "请在 .env.local 文件中设置 CRON_SECRET"
  exit 1
fi

# 询问环境
echo -e "${YELLOW}请选择环境:${NC}"
echo "1) 本地开发 (http://localhost:3000)"
echo "2) 生产环境 (自定义URL)"
read -p "请输入选项 (1 或 2): " env_choice

if [ "$env_choice" = "1" ]; then
  BASE_URL="http://localhost:3000"
elif [ "$env_choice" = "2" ]; then
  read -p "请输入生产环境URL (例如: https://your-app.vercel.app): " BASE_URL
else
  echo -e "${RED}无效的选项${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}正在初始化数据库...${NC}"
echo "URL: $BASE_URL/api/db/init"
echo ""

# 调用初始化API
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/db/init" \
  -H "Authorization: Bearer $CRON_SECRET")

# 分离响应体和状态码
http_body=$(echo "$response" | head -n -1)
http_code=$(echo "$response" | tail -n 1)

# 检查响应
if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ 数据库初始化成功!${NC}"
  echo ""
  echo "响应内容:"
  echo "$http_body" | jq '.' 2>/dev/null || echo "$http_body"
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  初始化完成！${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "接下来你可以："
  echo "1. 访问搜索页面: $BASE_URL/?rid=test-001"
  echo "2. 进行搜索以生成验证问题"
  echo "3. 访问验证页面: $BASE_URL/verify?rid=test-001"
else
  echo -e "${RED}✗ 数据库初始化失败${NC}"
  echo "HTTP 状态码: $http_code"
  echo "响应内容:"
  echo "$http_body"
  exit 1
fi

