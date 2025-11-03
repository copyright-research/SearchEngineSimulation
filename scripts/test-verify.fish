#!/usr/bin/env fish

# 测试 Verify 功能和 Search History

set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set BLUE '\033[0;34m'
set RED '\033[0;31m'
set NC '\033[0m'

echo -e "$GREEN========================================$NC"
echo -e "$GREEN  测试 Verify 和 Search History$NC"
echo -e "$GREEN========================================$NC"
echo ""

set TEST_RID "test-verify-"(date +%s)

echo -e "$BLUE📋 测试 RID: $TEST_RID$NC"
echo ""

# 1. 测试保存搜索历史
echo -e "$YELLOW🔍 测试 1: 保存搜索历史$NC"
set response (curl -s -X POST http://localhost:3000/api/history/save \
  -H "Content-Type: application/json" \
  -d '{
    "rid": "'$TEST_RID'",
    "query": "Next.js 15 features",
    "mode": "search_with_overview",
    "results": [
      {
        "title": "Next.js 15",
        "link": "https://nextjs.org/blog/next-15",
        "snippet": "Next.js 15 introduces new features..."
      }
    ],
    "aiResponse": "Next.js 15 brings several improvements including..."
  }')

echo $response | jq '.'
echo ""

if echo $response | grep -q '"success":true'
    echo -e "$GREEN✓ 搜索历史保存成功$NC"
else
    echo -e "$RED✗ 搜索历史保存失败$NC"
end
echo ""

# 2. 等待问题生成
echo -e "$YELLOW⏳ 等待 5 秒让问题生成...$NC"
sleep 5
echo ""

# 3. 获取验证问题
echo -e "$YELLOW❓ 测试 2: 获取验证问题$NC"
set questions_response (curl -s "http://localhost:3000/api/questions?rid=$TEST_RID")

echo $questions_response | jq '.'
echo ""

set question_count (echo $questions_response | jq '.questions | length')

if test $question_count -gt 0
    echo -e "$GREEN✓ 成功获取 $question_count 个问题$NC"
    
    # 4. 提交答案
    echo ""
    echo -e "$YELLOW✍️  测试 3: 提交答案$NC"
    
    set question_id (echo $questions_response | jq -r '.questions[0].id')
    
    set answer_response (curl -s -X POST http://localhost:3000/api/questions \
      -H "Content-Type: application/json" \
      -d '{
        "rid": "'$TEST_RID'",
        "questionId": '$question_id',
        "answer": 0
      }')
    
    echo $answer_response | jq '.'
    echo ""
    
    if echo $answer_response | grep -q '"success":true'
        echo -e "$GREEN✓ 答案提交成功$NC"
        
        set is_correct (echo $answer_response | jq -r '.isCorrect')
        if test "$is_correct" = "true"
            echo -e "$GREEN  答案正确！$NC"
        else
            echo -e "$YELLOW  答案错误$NC"
        end
    else
        echo -e "$RED✗ 答案提交失败$NC"
    end
else
    echo -e "$RED✗ 没有获取到问题$NC"
    echo -e "$YELLOW提示: 确保 Gemini API 配置正确$NC"
end

echo ""

# 5. 获取统计信息
echo -e "$YELLOW📊 测试 4: 获取答题统计$NC"
set stats_response (curl -s "http://localhost:3000/api/questions?rid=$TEST_RID")

set stats (echo $stats_response | jq '.stats')
echo $stats | jq '.'
echo ""

if echo $stats | grep -q 'total_answered'
    echo -e "$GREEN✓ 统计信息获取成功$NC"
else
    echo -e "$RED✗ 统计信息获取失败$NC"
end

echo ""

# 6. 测试 Verify 页面
echo -e "$YELLOW🌐 测试 5: Verify 页面$NC"
echo "访问: http://localhost:3000/verify?rid=$TEST_RID"
echo ""

# 7. 清理测试数据（SQLite）
if test -f data/verification.db
    echo -e "$YELLOW🧹 清理测试数据...$NC"
    sqlite3 data/verification.db "DELETE FROM user_answers WHERE rid='$TEST_RID';"
    sqlite3 data/verification.db "DELETE FROM verification_questions WHERE rid='$TEST_RID';"
    sqlite3 data/verification.db "DELETE FROM search_history WHERE rid='$TEST_RID';"
    sqlite3 data/verification.db "DELETE FROM search_sessions WHERE rid='$TEST_RID';"
    echo -e "$GREEN✓ 测试数据已清理$NC"
end

echo ""
echo -e "$GREEN========================================$NC"
echo -e "$GREEN  测试完成！$NC"
echo -e "$GREEN========================================$NC"
echo ""

echo -e "$BLUE💡 下一步:$NC"
echo "1. 访问 http://localhost:3000/?rid=$TEST_RID"
echo "2. 进行搜索并启用 AI Overview"
echo "3. 访问 http://localhost:3000/verify?rid=$TEST_RID 查看问题"
echo ""

