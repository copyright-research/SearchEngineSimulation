#!/bin/bash

# 本地开发环境设置脚本

set -e

echo "🚀 Setting up local development environment..."

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# 2. 检查 PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed."
    echo "Please install PostgreSQL:"
    echo "  macOS: brew install postgresql@15"
    echo "  Linux: sudo apt-get install postgresql"
    exit 1
fi

echo "✅ PostgreSQL is installed"

# 3. 安装依赖
echo "📦 Installing dependencies..."
npm install

# 4. 检查 .env.local
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local"
        echo "⚠️  Please edit .env.local and add your API keys"
    else
        echo "❌ .env.example not found"
        exit 1
    fi
else
    echo "✅ .env.local exists"
fi

# 5. 检查数据库连接
echo "🗄️  Setting up database..."

# 检查是否使用远程数据库
if grep -q "DATABASE_URL.*neon\|postgres.*cloud\|supabase" .env.local 2>/dev/null; then
    echo "✅ Using remote database (detected from .env.local)"
    echo "⚠️  Skipping local database creation"
else
    # 本地数据库设置
    DB_NAME="copyright"
    
    # 检查 PostgreSQL 是否运行
    if ! pg_isready &> /dev/null; then
        echo "⚠️  PostgreSQL is not running locally."
        echo "If you're using a remote database, this is fine."
        echo "Otherwise, start PostgreSQL with: brew services start postgresql@15"
    else
        # 检查数据库是否存在
        if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
            echo "✅ Database '$DB_NAME' already exists"
        else
            echo "Creating database '$DB_NAME'..."
            createdb $DB_NAME
            echo "✅ Database created"
        fi
    fi
fi

# 6. 运行 Prisma 迁移
echo "🔄 Running Prisma migrations..."
npx prisma generate

echo "📝 Applying database migrations..."
if npx prisma migrate deploy 2>/dev/null; then
    echo "✅ Migrations applied successfully"
else
    echo "⚠️  Running dev migrations..."
    npx prisma migrate dev --name init
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and add your API keys:"
echo "   - GOOGLE_API_KEY"
echo "   - GOOGLE_SEARCH_ENGINE_ID"
echo "   - GOOGLE_GENERATIVE_AI_API_KEY"
echo "   - GEMINI_API_KEY (alias, optional)"
echo "   - TAVILY_API_KEY (optional)"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
