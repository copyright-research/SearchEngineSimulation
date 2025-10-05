"use client";

import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown> & {
  onCitationClick?: (citationNumbers: number[]) => void;
};

// 处理引用的通用函数
const processText = (
  text: string,
  onCitationClick?: (citationNumbers: number[]) => void
) => {
  // 匹配 [1], [1, 2], [1, 2, 3] 等格式
  const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    // 添加引用前的文本
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // 解析引用数字
    const numbers = match[1].split(',').map(n => parseInt(n.trim()));
    
    // 添加引用元素 - 只显示链接图标
    parts.push(
      <sup
        key={match.index}
        className="inline-flex items-center ml-0.5"
      >
        <button
          onClick={() => onCitationClick?.(numbers)}
          className="relative inline-flex items-center justify-center w-4 h-4 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded border border-blue-200 dark:border-blue-800 transition-all duration-150 hover:scale-110 hover:shadow-sm"
          aria-label={`Citations ${numbers.join(', ')}`}
          title={`Sources: ${numbers.join(', ')}`}
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      </sup>
    );

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// 递归处理子节点
const processChildren = (
  node: React.ReactNode,
  onCitationClick?: (citationNumbers: number[]) => void
): React.ReactNode => {
  if (typeof node === 'string') {
    return processText(node, onCitationClick);
  }
  
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <span key={idx}>{processChildren(child, onCitationClick)}</span>
    ));
  }

  return node;
};

// 自定义段落组件
const CustomParagraph = ({ 
  children, 
  onCitationClick 
}: { 
  children: React.ReactNode;
  onCitationClick?: (citationNumbers: number[]) => void;
}) => {
  return <p>{processChildren(children, onCitationClick)}</p>;
};

// 自定义列表项组件
const CustomListItem = ({ 
  children, 
  onCitationClick 
}: { 
  children: React.ReactNode;
  onCitationClick?: (citationNumbers: number[]) => void;
}) => {
  return <li>{processChildren(children, onCitationClick)}</li>;
};

export const Response = memo(
  ({ onCitationClick, ...props }: ResponseProps) => (
    <Streamdown
      parseIncompleteMarkdown={true}
      components={{
        p: ({ children }) => (
          <CustomParagraph onCitationClick={onCitationClick}>
            {children}
          </CustomParagraph>
        ),
        li: ({ children }) => (
          <CustomListItem onCitationClick={onCitationClick}>
            {children}
          </CustomListItem>
        ),
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) => 
    prevProps.children === nextProps.children &&
    prevProps.onCitationClick === nextProps.onCitationClick
);

Response.displayName = "Response";
