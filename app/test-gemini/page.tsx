'use client';

import { useState, useRef } from 'react';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import { Streamdown } from 'streamdown';

export default function TestGeminiPage() {
  const [prompt, setPrompt] = useState(`请生成一个包含数学公式的技术说明，要求：

1. 使用内联数学公式，例如 $E = mc^2$
2. 使用块级数学公式，例如：
$$
f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}
$$

3. 包含代码块
4. 使用 Markdown 格式（标题、列表、粗体等）
5. 添加引用 [1, 2, 3]

请生成关于"机器学习中的梯度下降算法"的说明。`);
  
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setResponse('');
    setRawOutput('');

    try {
      const res = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error('Failed to generate response');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setResponse(accumulated);
        setRawOutput(accumulated);
      }

      setIsLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Error:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Gemini 原始输出测试
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">输入 Prompt</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-[400px] p-4 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入你的 prompt..."
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader size={20} className="text-white" />
                    生成中...
                  </>
                ) : (
                  '发送到 Gemini'
                )}
              </button>
            </form>

            {/* 原始输出 */}
            {rawOutput && (
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">原始输出（Raw Text）</h3>
                <div className="border rounded-lg p-4 bg-white">
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                    {rawOutput}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：渲染预览 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Streamdown 渲染预览</h2>
            <div className="border rounded-lg p-6 bg-white min-h-[400px]">
              {isLoading && !response ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader size={16} />
                  <span>等待响应...</span>
                </div>
              ) : response ? (
                <>
                  <Streamdown>{response}</Streamdown>
                  {isLoading && (
                    <div className="mt-2 flex items-center gap-2 text-blue-600">
                      <Loader size={14} />
                      <span className="text-xs">流式传输中...</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  点击"发送到 Gemini"查看结果
                </p>
              )}
            </div>

            {/* 字符统计 */}
            {response && (
              <div className="border rounded-lg p-4 bg-white space-y-2">
                <h3 className="font-semibold">统计信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">字符数：</span>
                    <span className="font-mono ml-2">{response.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">行数：</span>
                    <span className="font-mono ml-2">{response.split('\n').length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">包含 $ ：</span>
                    <span className="font-mono ml-2">{(response.match(/\$/g) || []).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">包含 $$ ：</span>
                    <span className="font-mono ml-2">{(response.match(/\$\$/g) || []).length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 border rounded-lg p-6 bg-white">
          <h3 className="text-xl font-semibold mb-4">使用说明</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 这个页面用于测试 Gemini 的原始输出和 Streamdown 的渲染效果</li>
            <li>• 左侧显示原始文本输出，右侧显示 Streamdown 渲染后的效果</li>
            <li>• 可以在浏览器控制台查看完整的请求和响应日志</li>
            <li>• 数学公式使用 LaTeX 语法：内联 <code>$...$</code>，块级 <code>$$...$$</code></li>
            <li>• 测试不同的 prompt 来验证各种 Markdown 特性</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
