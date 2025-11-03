#!/usr/bin/env fish

# 测试 Debug 模式

set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set BLUE '\033[0;34m'
set CYAN '\033[0;36m'
set RED '\033[0;31m'
set NC '\033[0m'

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  Debug 模式测试$NC"
echo -e "$GREEN========================================$NC"
echo ""

echo -e "$BLUE📋 测试说明$NC"
echo "Debug 模式会在搜索结果中显示来源标记："
echo "  - [来源: Tavily 🎯] - 来自 Tavily API"
echo "  - [来源: Google 🔍] - 来自 Google Search"
echo ""

echo -e "$YELLOW🔍 测试 1: 普通搜索 API$NC"
echo "查询: Next.js 15"
echo ""

set response (curl -s "http://localhost:3000/api/search?q=Next.js+15&debug=true")

# 检查是否有来源标记
if echo $response | grep -q "来源:"
    echo -e "$GREEN✓ Debug 模式已启用$NC"
    echo ""
    
    # 统计来源
    set tavily_count (echo $response | grep -o "Tavily 🎯" | wc -l | string trim)
    set google_count (echo $response | grep -o "Google 🔍" | wc -l | string trim)
    
    echo "结果统计:"
    echo "  - Tavily: $tavily_count 个结果"
    echo "  - Google: $google_count 个结果"
    echo ""
    
    # 显示前 2 个结果的来源
    echo "前 2 个结果:"
    echo $response | jq -r '.items[0:2] | .[] | "  \(.title)\n  来源: \(.snippet | match("\\[来源: ([^\\]]+)\\]") | .captures[0].string)"' 2>/dev/null
    echo ""
else
    echo -e "$RED✗ Debug 模式未生效$NC"
    echo "可能的原因:"
    echo "  1. 服务器未运行"
    echo "  2. debug 参数未正确传递"
    echo ""
end

echo -e "$YELLOW🤖 测试 2: AI 模式$NC"
echo "提示: 在浏览器中测试 AI 模式"
echo ""
echo "访问以下 URL:"
echo -e "$CYAN  http://localhost:3000/ai?rid=test-debug&debug=true$NC"
echo ""

echo -e "$BLUE📊 服务器日志示例$NC"
echo "启用 debug 模式时，服务器日志应显示:"
echo ""
echo -e "$CYAN[Tavily] Searching for: \"Next.js 15\"$NC"
echo -e "$CYAN[Tavily] Found 5 results$NC"
echo -e "$CYAN[Merge] Combined 5 Tavily + 10 Google = 10 unique results (5 from Tavily, 5 from Google)$NC"
echo ""

echo -e "$BLUE💡 使用提示$NC"
echo ""
echo "启用 debug 模式:"
echo "  - 普通搜索: /?rid=test&debug=true"
echo "  - AI 模式: /ai?rid=test&debug=true"
echo ""
echo "关闭 debug 模式:"
echo "  - 移除 debug=true 参数"
echo "  - 或设置 debug=false"
echo ""

echo -e "$BLUE📚 相关文档$NC"
echo "- DEBUG_MODE.md - 完整使用指南"
echo "- TAVILY_INTEGRATION.md - Tavily 集成文档"
echo ""

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  测试完成！$NC"
echo -e "$GREEN========================================$NC"

