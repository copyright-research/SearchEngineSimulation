'use client';

import { useState } from 'react';
import { Response } from '@/components/ai-elements/response';
import { Streamdown } from 'streamdown';

export default function TestPage() {
  const [markdown, setMarkdown] = useState(`# Streamdown Test Page

## 1. 数学公式测试

### 内联数学公式
这是一个内联公式：$E = mc^2$，爱因斯坦的质能方程。

另一个例子：二次方程的解是 $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

### 块级数学公式

正态分布的概率密度函数：

$$
f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}
$$

傅里叶变换：

$$
F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt
$$

## 2. Markdown 基础测试

### 文本样式
- **粗体文本**
- *斜体文本*
- ***粗斜体***
- ~~删除线~~
- \`内联代码\`

### 列表
1. 有序列表项 1
2. 有序列表项 2
   - 嵌套无序列表
   - 另一项

### 引用
> 这是一段引用文本
> 可以有多行

### 代码块

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = {
  id: 1,
  name: "Test User",
  email: "test@example.com"
};
\`\`\`

### 表格

| 特性 | Streamdown | react-markdown |
|------|-----------|----------------|
| 数学公式 | ✅ | ❌ |
| 代码高亮 | ✅ | ⚠️ |
| 流式渲染 | ✅ | ❌ |

### 链接
[访问 Google](https://www.google.com)

## 3. 引用测试

带引用的文本示例 [1, 2, 3]

### Key Details

- 第一个要点 [1]
- 第二个要点 [2, 3]
- 第三个要点 [4]

AI responses may include mistakes.
`);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Streamdown 测试页面
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 编辑器 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Markdown 输入</h2>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="w-full h-[800px] p-4 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="在这里输入 Markdown..."
            />
          </div>

          {/* 预览 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">渲染预览</h2>
            <div className="border rounded-lg p-6 bg-white min-h-[800px]">
              <Streamdown>{markdown}</Streamdown>
            </div>
          </div>
        </div>

        {/* 原始 HTML 输出 */}
        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-semibold">调试信息</h2>
          <details className="border rounded-lg p-4 bg-white">
            <summary className="cursor-pointer font-medium text-lg">
              查看原始 Markdown
            </summary>
            <pre className="mt-4 p-4 bg-gray-100 rounded overflow-x-auto text-xs">
              {markdown}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
