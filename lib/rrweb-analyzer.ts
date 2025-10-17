import type { eventWithTime } from '@rrweb/types';

interface ClickEvent {
  timestamp: number;
  x: number;
  y: number;
  target?: string;
}

interface ElementInteraction {
  selector: string;
  clicks: number;
  hovers: number;
  lastInteraction: number;
}

interface AnalysisResult {
  // 基础统计
  totalEvents: number;
  duration: number; // 毫秒
  startTime: number;
  endTime: number;

  // 交互统计
  clicks: ClickEvent[];
  totalClicks: number;
  mouseMovements: number;
  scrolls: number;
  inputs: number;

  // 元素交互
  elementInteractions: Map<string, ElementInteraction>;
  unclickedElements: string[]; // 可点击但未被点击的元素

  // 性能指标
  averageEventInterval: number; // 平均事件间隔
  longestInactivity: number; // 最长无活动时间
}

export class RRWebAnalyzer {
  private events: eventWithTime[];

  constructor(events: eventWithTime[]) {
    this.events = events;
  }

  /**
   * 分析录制内容
   */
  analyze(): AnalysisResult {
    const clicks: ClickEvent[] = [];
    let mouseMovements = 0;
    let scrolls = 0;
    let inputs = 0;
    const elementInteractions = new Map<string, ElementInteraction>();

    // 遍历所有事件
    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // 点击事件
      if (eventType === 3 && data?.source === 2) { // IncrementalSource.MouseInteraction
        if (data.type === 2) { // Click
          clicks.push({
            timestamp: event.timestamp,
            x: (data.x as number) || 0,
            y: (data.y as number) || 0,
            target: (data.target as string) || 'unknown',
          });

          // 更新元素交互统计
          const selector = this.getElementSelector(data.target);
          if (selector) {
            const interaction = elementInteractions.get(selector) || {
              selector,
              clicks: 0,
              hovers: 0,
              lastInteraction: event.timestamp,
            };
            interaction.clicks++;
            interaction.lastInteraction = event.timestamp;
            elementInteractions.set(selector, interaction);
          }
        }
      }

      // 鼠标移动
      if (eventType === 3 && data?.source === 1) { // IncrementalSource.MouseMove
        mouseMovements++;
      }

      // 滚动
      if (eventType === 3 && data?.source === 3) { // IncrementalSource.Scroll
        scrolls++;
      }

      // 输入
      if (eventType === 3 && data?.source === 5) { // IncrementalSource.Input
        inputs++;
      }
    });

    // 计算时间范围
    const startTime = this.events[0]?.timestamp || 0;
    const endTime = this.events[this.events.length - 1]?.timestamp || 0;
    const duration = endTime - startTime;

    // 计算平均事件间隔
    let totalInterval = 0;
    let longestInactivity = 0;
    for (let i = 1; i < this.events.length; i++) {
      const interval = this.events[i].timestamp - this.events[i - 1].timestamp;
      totalInterval += interval;
      longestInactivity = Math.max(longestInactivity, interval);
    }
    const averageEventInterval = this.events.length > 1 
      ? totalInterval / (this.events.length - 1) 
      : 0;

    return {
      totalEvents: this.events.length,
      duration,
      startTime,
      endTime,
      clicks,
      totalClicks: clicks.length,
      mouseMovements,
      scrolls,
      inputs,
      elementInteractions,
      unclickedElements: this.findUnclickedElements(elementInteractions),
      averageEventInterval,
      longestInactivity,
    };
  }

  /**
   * 获取元素选择器（简化版）
   */
  private getElementSelector(target: unknown): string | null {
    if (!target) return null;
    // 这里简化处理，实际可以根据 rrweb 的 mirror 获取更准确的选择器
    return (target as { tagName?: string }).tagName || 'unknown';
  }

  /**
   * 查找未被点击的可点击元素
   */
  private findUnclickedElements(
    elementInteractions: Map<string, ElementInteraction>
  ): string[] {
    // 这里简化处理，实际应该从 DOM 快照中提取所有可点击元素
    // 然后与 elementInteractions 对比
    const clickableElements = ['button', 'a', 'input'];
    const clickedElements = new Set(
      Array.from(elementInteractions.keys())
        .filter(selector => elementInteractions.get(selector)!.clicks > 0)
    );

    return clickableElements.filter(el => !clickedElements.has(el));
  }

  /**
   * 生成分析报告（文本格式）
   */
  generateReport(analysis: AnalysisResult): string {
    const durationMin = (analysis.duration / 1000 / 60).toFixed(2);
    const durationSec = (analysis.duration / 1000).toFixed(1);

    return `
=== rrweb Recording Analysis Report ===

📊 基础统计
- 总事件数: ${analysis.totalEvents.toLocaleString()}
- 录制时长: ${durationMin} 分钟 (${durationSec} 秒)
- 开始时间: ${new Date(analysis.startTime).toLocaleString()}
- 结束时间: ${new Date(analysis.endTime).toLocaleString()}

🖱️ 交互统计
- 点击次数: ${analysis.totalClicks}
- 鼠标移动: ${analysis.mouseMovements.toLocaleString()}
- 滚动次数: ${analysis.scrolls}
- 输入次数: ${analysis.inputs}

⚡ 性能指标
- 平均事件间隔: ${analysis.averageEventInterval.toFixed(2)} ms
- 最长无活动时间: ${(analysis.longestInactivity / 1000).toFixed(1)} 秒

🎯 元素交互分析
${this.formatElementInteractions(analysis.elementInteractions)}

⚠️ 未交互的可点击元素
${analysis.unclickedElements.length > 0 
  ? analysis.unclickedElements.map(el => `- ${el}`).join('\n')
  : '- (所有可点击元素都被交互过)'}

💡 建议
${this.generateRecommendations(analysis)}
`;
  }

  private formatElementInteractions(
    interactions: Map<string, ElementInteraction>
  ): string {
    if (interactions.size === 0) {
      return '- (无交互记录)';
    }

    const sorted = Array.from(interactions.entries())
      .sort((a, b) => b[1].clicks - a[1].clicks)
      .slice(0, 10); // 只显示前 10 个

    return sorted
      .map(([selector, data]) => 
        `- ${selector}: ${data.clicks} 次点击`
      )
      .join('\n');
  }

  private generateRecommendations(analysis: AnalysisResult): string {
    const recommendations: string[] = [];

    // 检查未点击元素
    if (analysis.unclickedElements.length > 0) {
      recommendations.push(
        `🔴 发现 ${analysis.unclickedElements.length} 个可点击元素未被交互，可能需要优化 UI 引导`
      );
    }

    // 检查长时间无活动
    if (analysis.longestInactivity > 60000) { // 超过 1 分钟
      recommendations.push(
        `🟡 发现 ${(analysis.longestInactivity / 1000 / 60).toFixed(1)} 分钟的无活动时间，用户可能遇到困惑`
      );
    }

    // 检查点击密度
    const clicksPerMinute = analysis.totalClicks / (analysis.duration / 1000 / 60);
    if (clicksPerMinute < 2) {
      recommendations.push(
        `🟡 点击频率较低 (${clicksPerMinute.toFixed(1)} 次/分钟)，可能表示用户犹豫或困惑`
      );
    }

    if (recommendations.length === 0) {
      return '✅ 用户交互流畅，无明显问题';
    }

    return recommendations.join('\n');
  }

  /**
   * 导出为 JSON
   */
  exportAnalysis(analysis: AnalysisResult): string {
    return JSON.stringify(
      {
        ...analysis,
        elementInteractions: Array.from(analysis.elementInteractions.entries()),
      },
      null,
      2
    );
  }
}

