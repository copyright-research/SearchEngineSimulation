#!/usr/bin/env fish

# 测试 Tavily 集成

set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set BLUE '\033[0;34m'
set RED '\033[0;31m'
set NC '\033[0m'

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  Tavily 集成测试$NC"
echo -e "$GREEN========================================$NC"
echo ""

# 检查 TAVILY_API_KEY
if test -f .env.local
    set TAVILY_KEY (grep TAVILY_API_KEY .env.local | cut -d '=' -f2 | string trim -c '"')
end

if test -z "$TAVILY_KEY"
    echo -e "$YELLOW⚠️  TAVILY_API_KEY 未配置$NC"
    echo "系统将只使用 Google Search"
    echo ""
    echo "如需启用 Tavily："
    echo "1. 访问 https://tavily.com"
    echo "2. 注册并获取 API Key"
    echo "3. 添加到 .env.local:"
    echo "   TAVILY_API_KEY=tvly-xxxxxxxxxxxxx"
    echo ""
else
    echo -e "$GREEN✓ TAVILY_API_KEY 已配置$NC"
    echo ""
end

echo -e "$BLUE📊 测试搜索功能$NC"
echo ""

# 测试搜索
echo "测试查询: Next.js 15"
echo ""

set response (curl -s "http://localhost:3000/api/search?q=Next.js+15")

# 检查结果
if echo $response | grep -q "items"
    set count (echo $response | jq '.items | length' 2>/dev/null)
    echo -e "$GREEN✓ 搜索成功$NC"
    echo "返回结果数: $count"
    echo ""
    
    # 显示前3个结果
    echo "前3个结果:"
    echo $response | jq -r '.items[0:3] | .[] | "  - \(.title)"' 2>/dev/null
    echo ""
else
    echo -e "$RED✗ 搜索失败$NC"
    echo $response | jq '.' 2>/dev/null
    echo ""
end

echo -e "$BLUE💡 使用提示$NC"
echo ""
echo "1. 混合搜索会自动合并 Google 和 Tavily 结果"
echo "2. Tavily 结果会优先显示（更相关）"
echo "3. 系统会自动去除重复的 URL"
echo "4. 如果 Tavily 失败，会自动回退到 Google"
echo ""

echo -e "$BLUE📚 相关文档$NC"
echo "- TAVILY_INTEGRATION.md - 完整集成文档"
echo "- 查看服务器日志了解搜索详情"
echo ""

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  测试完成！$NC"
echo -e "$GREEN========================================$NC"

