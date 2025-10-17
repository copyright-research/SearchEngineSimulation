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

interface MousePosition {
  timestamp: number;
  x: number;
  y: number;
}

interface NavigationEvent {
  timestamp: number;
  url: string;
  type: 'load' | 'navigate';
}

interface InputEvent {
  timestamp: number;
  text?: string;
  isChecked?: boolean;
  inputType?: string;
  target?: string;
}

interface KeyboardEvent {
  timestamp: number;
  key: string;
  type: 'keydown' | 'keyup';
  target?: string;
}

interface ScrollEvent {
  timestamp: number;
  x: number;
  y: number;
}

interface WorkflowStep {
  timestamp: number;
  type: 'click' | 'input' | 'scroll' | 'navigate';
  description: string;
  details?: unknown;
}

interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

interface AnalysisResult {
  // 基础统计
  totalEvents: number;
  duration: number;
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
  unclickedElements: string[];

  // 性能指标
  averageEventInterval: number;
  longestInactivity: number;

  // 新增：高级分析
  mouseTrajectory?: MousePosition[];
  heatmapData?: HeatmapPoint[];
  navigations?: NavigationEvent[];
  inputSequence?: InputEvent[];
  keyboardEvents?: KeyboardEvent[];
  scrollSequence?: ScrollEvent[];
  workflow?: WorkflowStep[];
  confusionPoints?: Array<{ timestamp: number; reason: string; details: string }>;
  clickedLinks?: Array<{ timestamp: number; url: string; position: { x: number; y: number } }>;
  activeTime?: number;
  idleTime?: number;
  enterKeyPresses?: Array<{ timestamp: number; afterInput: boolean }>;
}

export class RRWebAnalyzer {
  private events: eventWithTime[];

  constructor(events: eventWithTime[]) {
    this.events = events;
  }

  /**
   * 完整分析（包含所有高级功能）
   */
  analyzeComplete(): AnalysisResult {
    const basicAnalysis = this.analyze();
    
    return {
      ...basicAnalysis,
      mouseTrajectory: this.getMouseTrajectory(),
      heatmapData: this.getHeatmapData(),
      navigations: this.getNavigationEvents(),
      inputSequence: this.getInputEvents(),
      keyboardEvents: this.getKeyboardEvents(),
      scrollSequence: this.getScrollEvents(),
      workflow: this.analyzeWorkflow(),
      confusionPoints: this.detectConfusionPoints(),
      clickedLinks: this.getClickedLinks(),
      activeTime: this.calculateActiveTime(),
      idleTime: this.calculateIdleTime(),
      enterKeyPresses: this.getEnterKeyPresses(),
    };
  }

  /**
   * 基础分析
   */
  analyze(): AnalysisResult {
    const clicks: ClickEvent[] = [];
    let mouseMovements = 0;
    let scrolls = 0;
    let inputs = 0;
    const elementInteractions = new Map<string, ElementInteraction>();

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // 点击事件
      if (eventType === 3 && data?.source === 2) {
        if (data.type === 2) {
          clicks.push({
            timestamp: event.timestamp,
            x: (data.x as number) || 0,
            y: (data.y as number) || 0,
            target: (data.target as string) || 'unknown',
          });

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
      if (eventType === 3 && data?.source === 1) {
        mouseMovements++;
      }

      // 滚动
      if (eventType === 3 && data?.source === 3) {
        scrolls++;
      }

      // 输入
      if (eventType === 3 && data?.source === 5) {
        inputs++;
      }
    });

    const startTime = this.events[0]?.timestamp || 0;
    const endTime = this.events[this.events.length - 1]?.timestamp || 0;
    const duration = endTime - startTime;

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
   * 获取鼠标轨迹
   */
  getMouseTrajectory(): MousePosition[] {
    const trajectory: MousePosition[] = [];
    
    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // MouseMove 事件
      if (eventType === 3 && data?.source === 1) {
        const positions = data.positions as Array<{ x: number; y: number; timeOffset: number }> | undefined;
        if (positions && Array.isArray(positions)) {
          positions.forEach((pos) => {
            trajectory.push({
              timestamp: event.timestamp + (pos.timeOffset || 0),
              x: pos.x || 0,
              y: pos.y || 0,
            });
          });
        }
      }
    });

    return trajectory;
  }

  /**
   * 生成热力图数据
   */
  getHeatmapData(): HeatmapPoint[] {
    const trajectory = this.getMouseTrajectory();
    const heatmap = new Map<string, number>();
    const gridSize = 50; // 50px 网格

    trajectory.forEach((point) => {
      const gridX = Math.floor(point.x / gridSize);
      const gridY = Math.floor(point.y / gridSize);
      const key = `${gridX},${gridY}`;
      heatmap.set(key, (heatmap.get(key) || 0) + 1);
    });

    return Array.from(heatmap.entries()).map(([key, intensity]) => {
      const [x, y] = key.split(',').map(Number);
      return {
        x: x * gridSize + gridSize / 2,
        y: y * gridSize + gridSize / 2,
        intensity,
      };
    }).sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * 获取页面导航事件
   */
  getNavigationEvents(): NavigationEvent[] {
    const navigations: NavigationEvent[] = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // Meta 事件（包含 URL）
      if (eventType === 4 && data?.href) {
        navigations.push({
          timestamp: event.timestamp,
          url: data.href as string,
          type: 'navigate',
        });
      }

      // Load 事件
      if (eventType === 2) { // FullSnapshot
        navigations.push({
          timestamp: event.timestamp,
          url: 'page-load',
          type: 'load',
        });
      }
    });

    return navigations;
  }

  /**
   * 获取输入事件
   */
  getInputEvents(): InputEvent[] {
    const inputs: InputEvent[] = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // Input 事件
      if (eventType === 3 && data?.source === 5) {
        inputs.push({
          timestamp: event.timestamp,
          text: data.text as string | undefined,
          isChecked: data.isChecked as boolean | undefined,
          inputType: (data.inputType as string | undefined) || 'text',
          target: (data.id as string | undefined) || 'unknown',
        });
      }
    });

    return inputs;
  }

  /**
   * 获取键盘事件
   */
  getKeyboardEvents(): KeyboardEvent[] {
    const keyboardEvents: KeyboardEvent[] = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // KeyDown 事件 (type: 6)
      if (eventType === 3 && data?.source === 2 && data?.type === 6) {
        keyboardEvents.push({
          timestamp: event.timestamp,
          key: (data.key as string) || 'unknown',
          type: 'keydown',
          target: (data.id as string | undefined) || 'unknown',
        });
      }

      // KeyUp 事件 (type: 7)
      if (eventType === 3 && data?.source === 2 && data?.type === 7) {
        keyboardEvents.push({
          timestamp: event.timestamp,
          key: (data.key as string) || 'unknown',
          type: 'keyup',
          target: (data.id as string | undefined) || 'unknown',
        });
      }
    });

    return keyboardEvents;
  }

  /**
   * 获取回车键按下事件（特别关注输入后的回车）
   */
  getEnterKeyPresses(): Array<{ timestamp: number; afterInput: boolean }> {
    const keyboardEvents = this.getKeyboardEvents();
    const inputEvents = this.getInputEvents();
    const enterPresses: Array<{ timestamp: number; afterInput: boolean }> = [];

    keyboardEvents.forEach((keyEvent) => {
      // 检测回车键（Enter 或 Return）
      if (
        keyEvent.type === 'keydown' && 
        (keyEvent.key === 'Enter' || keyEvent.key === 'Return')
      ) {
        // 检查回车前 2 秒内是否有输入
        const recentInput = inputEvents.find(
          (input) => 
            input.timestamp < keyEvent.timestamp && 
            keyEvent.timestamp - input.timestamp < 2000
        );

        enterPresses.push({
          timestamp: keyEvent.timestamp,
          afterInput: !!recentInput,
        });
      }
    });

    return enterPresses;
  }

  /**
   * 获取滚动事件
   */
  getScrollEvents(): ScrollEvent[] {
    const scrolls: ScrollEvent[] = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // Scroll 事件
      if (eventType === 3 && data?.source === 3) {
        scrolls.push({
          timestamp: event.timestamp,
          x: (data.x as number) || 0,
          y: (data.y as number) || 0,
        });
      }
    });

    return scrolls;
  }

  /**
   * 分析用户工作流
   */
  analyzeWorkflow(): WorkflowStep[] {
    const workflow: WorkflowStep[] = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // 点击
      if (eventType === 3 && data?.source === 2 && data.type === 2) {
        workflow.push({
          timestamp: event.timestamp,
          type: 'click',
          description: `点击 (${data.x}, ${data.y})`,
          details: { x: data.x, y: data.y, target: data.target },
        });
      }

      // 输入
      if (eventType === 3 && data?.source === 5) {
        workflow.push({
          timestamp: event.timestamp,
          type: 'input',
          description: `输入: ${data.text || '(checkbox/radio)'}`,
          details: { text: data.text || undefined, isChecked: data.isChecked },
        });
      }

      // 键盘事件（特别标注回车键）
      if (eventType === 3 && data?.source === 2 && (data?.type === 6 || data?.type === 7)) {
        const key = data.key as string;
        const isEnter = key === 'Enter' || key === 'Return';
        
        if (isEnter) {
          workflow.push({
            timestamp: event.timestamp,
            type: 'input',
            description: `按下 ${data.type === 6 ? 'Enter ⏎' : 'Enter ⏎ (release)'}`,
            details: { key, eventType: data.type === 6 ? 'keydown' : 'keyup' },
          });
        }
      }

      // 滚动
      if (eventType === 3 && data?.source === 3) {
        workflow.push({
          timestamp: event.timestamp,
          type: 'scroll',
          description: `滚动到 (${data.x}, ${data.y})`,
          details: { x: data.x, y: data.y },
        });
      }

      // 导航
      if (eventType === 4 && data?.href) {
        workflow.push({
          timestamp: event.timestamp,
          type: 'navigate',
          description: `跳转到: ${data.href}`,
          details: { url: data.href },
        });
      }
    });

    return workflow;
  }

  /**
   * 检测用户困惑点
   */
  detectConfusionPoints(): Array<{ timestamp: number; reason: string; details: string }> {
    const confusionPoints: Array<{ timestamp: number; reason: string; details: string }> = [];
    const clicks = this.analyze().clicks;
    const mouseTrajectory = this.getMouseTrajectory();

    // 1. 检测重复点击同一位置
    for (let i = 1; i < clicks.length; i++) {
      const prev = clicks[i - 1];
      const curr = clicks[i];
      const distance = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
      const timeDiff = curr.timestamp - prev.timestamp;

      if (distance < 50 && timeDiff < 2000) { // 2秒内点击同一区域
        confusionPoints.push({
          timestamp: curr.timestamp,
          reason: '重复点击',
          details: `在 (${curr.x}, ${curr.y}) 附近 2 秒内重复点击`,
        });
      }
    }

    // 2. 检测快速往返移动（犹豫）
    for (let i = 2; i < mouseTrajectory.length; i++) {
      const p1 = mouseTrajectory[i - 2];
      const p2 = mouseTrajectory[i - 1];
      const p3 = mouseTrajectory[i];

      const dist12 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const dist23 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
      const dist13 = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));

      // 如果来回移动距离大，但最终距离小，说明犹豫
      if (dist12 > 200 && dist23 > 200 && dist13 < 100) {
        confusionPoints.push({
          timestamp: p3.timestamp,
          reason: '鼠标往返移动',
          details: `在区域 (${p1.x}, ${p1.y}) 周围犹豫`,
        });
      }
    }

    // 3. 检测长时间无活动
    for (let i = 1; i < this.events.length; i++) {
      const gap = this.events[i].timestamp - this.events[i - 1].timestamp;
      if (gap > 30000) { // 超过 30 秒无活动
        confusionPoints.push({
          timestamp: this.events[i].timestamp,
          reason: '长时间无活动',
          details: `${(gap / 1000).toFixed(0)} 秒无操作`,
        });
      }
    }

    return confusionPoints;
  }

  /**
   * 获取点击的链接
   */
  getClickedLinks(): Array<{ timestamp: number; url: string; position: { x: number; y: number } }> {
    const clicks = this.analyze().clicks;
    const navigations = this.getNavigationEvents();
    const clickedLinks: Array<{ timestamp: number; url: string; position: { x: number; y: number } }> = [];

    clicks.forEach((click) => {
      // 查找点击后 2 秒内的导航事件
      const nextNav = navigations.find(
        (nav) => nav.timestamp > click.timestamp && nav.timestamp - click.timestamp < 2000
      );

      if (nextNav) {
        clickedLinks.push({
          timestamp: click.timestamp,
          url: nextNav.url,
          position: { x: click.x, y: click.y },
        });
      }
    });

    return clickedLinks;
  }

  /**
   * 计算活跃时间
   */
  calculateActiveTime(): number {
    let activeTime = 0;
    let lastEventTime = this.events[0]?.timestamp || 0;

    this.events.forEach((event) => {
      const gap = event.timestamp - lastEventTime;
      
      // 如果间隔小于 5 秒，认为是活跃状态
      if (gap < 5000) {
        activeTime += gap;
      }
      
      lastEventTime = event.timestamp;
    });

    return activeTime;
  }

  /**
   * 计算空闲时间
   */
  calculateIdleTime(): number {
    const totalDuration = (this.events[this.events.length - 1]?.timestamp || 0) - (this.events[0]?.timestamp || 0);
    const activeTime = this.calculateActiveTime();
    return totalDuration - activeTime;
  }

  /**
   * 生成完整报告（包含所有高级功能）
   */
  generateCompleteReport(analysis: AnalysisResult): string {
    const basicReport = this.generateReport(analysis);
    
    const additionalSections = `
🔥 热力图分析
- 热点区域数量: ${analysis.heatmapData?.length || 0}
${analysis.heatmapData?.slice(0, 5).map((point, i) => 
  `  ${i + 1}. 位置 (${point.x}, ${point.y}) - 强度: ${point.intensity}`
).join('\n') || '  - 无数据'}

🔗 点击的链接
${analysis.clickedLinks && analysis.clickedLinks.length > 0
  ? analysis.clickedLinks.map((link, i) => 
      `  ${i + 1}. ${new Date(link.timestamp).toLocaleTimeString()} - ${link.url}`
    ).join('\n')
  : '  - 未检测到链接点击'}

📋 用户工作流 (最近 20 步)
${analysis.workflow?.slice(-20).map((step) => {
  const time = new Date(step.timestamp).toLocaleTimeString();
  return `  ${time} - ${step.description}`;
}).join('\n') || '  - 无数据'}

⚠️ 困惑点检测
${analysis.confusionPoints && analysis.confusionPoints.length > 0
  ? analysis.confusionPoints.map((point, i) => 
      `  ${i + 1}. ${new Date(point.timestamp).toLocaleTimeString()} - ${point.reason}: ${point.details}`
    ).join('\n')
  : '  ✅ 未检测到明显困惑点'}

⏱️ 时间分析
- 活跃时间: ${((analysis.activeTime || 0) / 1000 / 60).toFixed(2)} 分钟
- 空闲时间: ${((analysis.idleTime || 0) / 1000 / 60).toFixed(2)} 分钟
- 活跃度: ${((analysis.activeTime || 0) / (analysis.duration || 1) * 100).toFixed(1)}%

📝 输入分析
- 总输入次数: ${analysis.inputSequence?.length || 0}
${analysis.inputSequence?.slice(0, 5).map((input, i) => 
  `  ${i + 1}. ${new Date(input.timestamp).toLocaleTimeString()} - 类型: ${input.inputType}`
).join('\n') || '  - 无输入记录'}

⌨️ 键盘事件
- 总键盘事件: ${analysis.keyboardEvents?.length || 0}
- 回车键按下次数: ${analysis.enterKeyPresses?.length || 0}
${analysis.enterKeyPresses && analysis.enterKeyPresses.length > 0
  ? `- 输入后按回车: ${analysis.enterKeyPresses.filter(e => e.afterInput).length} 次`
  : ''}
${analysis.enterKeyPresses?.slice(0, 5).map((enter, i) => 
  `  ${i + 1}. ${new Date(enter.timestamp).toLocaleTimeString()} ${enter.afterInput ? '(在输入后)' : ''}`
).join('\n') || ''}

📜 滚动行为
- 总滚动次数: ${analysis.scrollSequence?.length || 0}
${analysis.scrollSequence && analysis.scrollSequence.length > 0
  ? `- 平均滚动位置: Y=${Math.round(analysis.scrollSequence.reduce((sum, s) => sum + s.y, 0) / analysis.scrollSequence.length)}`
  : ''}
`;

    return basicReport + additionalSections;
  }

  /**
   * 生成基础报告
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

  private getElementSelector(target: unknown): string | null {
    if (!target) return null;
    return (target as { tagName?: string }).tagName || 'unknown';
  }

  private findUnclickedElements(
    elementInteractions: Map<string, ElementInteraction>
  ): string[] {
    const clickableElements = ['button', 'a', 'input'];
    const clickedElements = new Set(
      Array.from(elementInteractions.keys())
        .filter(selector => elementInteractions.get(selector)!.clicks > 0)
    );

    return clickableElements.filter(el => !clickedElements.has(el));
  }

  private formatElementInteractions(
    interactions: Map<string, ElementInteraction>
  ): string {
    if (interactions.size === 0) {
      return '- (无交互记录)';
    }

    const sorted = Array.from(interactions.entries())
      .sort((a, b) => b[1].clicks - a[1].clicks)
      .slice(0, 10);

    return sorted
      .map(([selector, data]) => 
        `- ${selector}: ${data.clicks} 次点击`
      )
      .join('\n');
  }

  private generateRecommendations(analysis: AnalysisResult): string {
    const recommendations: string[] = [];

    if (analysis.unclickedElements.length > 0) {
      recommendations.push(
        `🔴 发现 ${analysis.unclickedElements.length} 个可点击元素未被交互，可能需要优化 UI 引导`
      );
    }

    if (analysis.longestInactivity > 60000) {
      recommendations.push(
        `🟡 发现 ${(analysis.longestInactivity / 1000 / 60).toFixed(1)} 分钟的无活动时间，用户可能遇到困惑`
      );
    }

    const clicksPerMinute = analysis.totalClicks / (analysis.duration / 1000 / 60);
    if (clicksPerMinute < 2) {
      recommendations.push(
        `🟡 点击频率较低 (${clicksPerMinute.toFixed(1)} 次/分钟)，可能表示用户犹豫或困惑`
      );
    }

    if (analysis.confusionPoints && analysis.confusionPoints.length > 3) {
      recommendations.push(
        `🔴 检测到 ${analysis.confusionPoints.length} 个困惑点，用户体验可能需要改进`
      );
    }

    if (recommendations.length === 0) {
      return '✅ 用户交互流畅，无明显问题';
    }

    return recommendations.join('\n');
  }

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
