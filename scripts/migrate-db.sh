#!/bin/bash

# 数据库迁移脚本
# 适用于本地和远程数据库

set -e

echo "🔄 Running database migrations..."

# 检查 .env.local 是否存在
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found!"
    echo "Please create .env.local with DATABASE_URL"
    exit 1
fi

# 加载环境变量
export $(cat .env.local | grep DATABASE_URL | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env.local"
    exit 1
fi

echo "✅ Found DATABASE_URL"

# 生成 Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# 运行迁移
echo "📝 Syncing database schema..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Database schema synced successfully!"
else
    echo "❌ Failed to sync database schema"
    exit 1
fi

echo ""
echo "✨ Database setup complete!"
echo ""
echo "You can now run: npm run dev"

