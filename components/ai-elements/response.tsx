"use client";

import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown> & {
  onCitationClick?: (citationNumber: number) => void;
};

// 处理引用的通用函数
const processText = (
  text: string,
  onCitationClick?: (citationNumber: number) => void
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
    
    // 添加引用元素
    parts.push(
      <sup
        key={match.index}
        className="inline-flex items-center gap-0.5 ml-0.5"
      >
        {numbers.map((num, idx) => (
          <span key={num} className="inline-flex items-center">
            <button
              onClick={() => onCitationClick?.(num)}
              className="relative inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded border border-blue-200 dark:border-blue-800 transition-all duration-150 hover:scale-110 hover:shadow-sm"
              aria-label={`Citation ${num}`}
            >
              {num}
            </button>
            {idx < numbers.length - 1 && (
              <span className="text-gray-400 dark:text-gray-500 text-[10px] mx-0.5">,</span>
            )}
          </span>
        ))}
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
  onCitationClick?: (citationNumber: number) => void
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
  onCitationClick?: (citationNumber: number) => void;
}) => {
  return <p>{processChildren(children, onCitationClick)}</p>;
};

// 自定义列表项组件
const CustomListItem = ({ 
  children, 
  onCitationClick 
}: { 
  children: React.ReactNode;
  onCitationClick?: (citationNumber: number) => void;
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
