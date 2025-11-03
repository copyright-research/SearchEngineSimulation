#!/usr/bin/env fish

# 测试 SQLite 数据库功能

set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set BLUE '\033[0;34m'
set NC '\033[0m'

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  SQLite 数据库测试$NC"
echo -e "$GREEN========================================$NC"
echo ""

set BASE_URL "http://localhost:3000"

echo -e "$BLUE📊 1. 查看数据库文件$NC"
ls -lh data/verification.db
echo ""

echo -e "$BLUE📋 2. 查看所有表$NC"
sqlite3 data/verification.db ".tables"
echo ""

echo -e "$BLUE🔍 3. 查看当前数据$NC"
echo "Sessions:"
sqlite3 data/verification.db "SELECT COUNT(*) as count FROM search_sessions;"
echo "Search History:"
sqlite3 data/verification.db "SELECT COUNT(*) as count FROM search_history;"
echo "Questions:"
sqlite3 data/verification.db "SELECT COUNT(*) as count FROM verification_questions;"
echo "Answers:"
sqlite3 data/verification.db "SELECT COUNT(*) as count FROM user_answers;"
echo ""

echo -e "$YELLOW💡 提示：$NC"
echo "1. 访问: $BASE_URL/?rid=test-001"
echo "2. 进行搜索"
echo "3. 访问: $BASE_URL/verify?rid=test-001"
echo "4. 回答问题"
echo "5. 再次运行此脚本查看数据变化"
echo ""

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  测试完成！$NC"
echo -e "$GREEN========================================$NC"

