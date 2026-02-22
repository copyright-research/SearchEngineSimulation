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

interface SearchResultClick {
  timestamp: number;
  resultIndex: number | null; // 搜索结果排名（第几个）
  linkText: string;
  linkUrl: string;
  elementInfo: {
    tagName: string;
    className: string;
    id: string;
    textContent: string;
  };
  position: { x: number; y: number };
}

interface PageVisibilityChange {
  timestamp: number;
  type: 'hidden' | 'visible'; // 页面是否可见
  reason: string; // 离开或返回的原因描述
}

interface UserJourney {
  searchResultClicks: SearchResultClick[];
  pageVisibilityChanges: PageVisibilityChange[];
  linkClicks: Array<{
    timestamp: number;
    linkIndex: number | null; // 蓝色链接在页面中的排名
    linkText: string;
    linkUrl: string;
    isSearchResult: boolean;
    position: { x: number; y: number };
  }>;
  timeline: Array<{
    timestamp: number;
    type: 'click_result' | 'click_link' | 'leave_page' | 'return_page' | 'navigate';
    description: string;
    details: unknown;
  }>;
}

interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

interface CitationClick {
  timestamp: number;
  kind: 'inline_citation_button' | 'source_link' | 'show_more' | 'show_less';
  citationNumbers: number[];
  sourceNumber: number | null;
  label: string;
  element: {
    tagName: string;
    className: string;
    id: string;
    dataAttributes: Record<string, string>;
    textContent: string;
  };
  position: { x: number; y: number };
}

interface SnapshotNodeLike {
  id?: number;
  type?: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  childNodes?: SnapshotNodeLike[];
  parentId?: number;
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
  userJourney?: UserJourney;
  citationClicks?: CitationClick[];
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
      userJourney: this.analyzeUserJourney(),
      citationClicks: this.getCitationClicks(),
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

🗺️ 用户旅程分析
${this.formatUserJourney(analysis.userJourney)}

📚 Citation 点击分析
${this.formatCitationClicks(analysis.citationClicks)}
`;

    return basicReport + additionalSections;
  }

  /**
   * 格式化用户旅程报告
   */
  private formatUserJourney(journey: UserJourney | undefined): string {
    if (!journey) return '- 无用户旅程数据';

    const sections: string[] = [];

    // 搜索结果点击
    if (journey.searchResultClicks.length > 0) {
      sections.push('🔍 搜索结果点击:');
      journey.searchResultClicks.forEach((click, i) => {
        const time = new Date(click.timestamp).toLocaleTimeString();
        sections.push(`  ${i + 1}. ${time} - 结果 #${click.resultIndex || '?'}: ${click.linkText}`);
        sections.push(`     URL: ${click.linkUrl}`);
      });
    } else {
      sections.push('🔍 搜索结果点击: 未检测到');
    }

    // 链接点击
    if (journey.linkClicks.length > 0) {
      sections.push('\n🔗 蓝色链接点击:');
      journey.linkClicks.forEach((click, i) => {
        const time = new Date(click.timestamp).toLocaleTimeString();
        sections.push(`  ${i + 1}. ${time} - 链接 #${click.linkIndex || '?'}: ${click.linkText}`);
        sections.push(`     URL: ${click.linkUrl}`);
      });
    } else {
      sections.push('\n🔗 蓝色链接点击: 未检测到');
    }

    // 页面可见性变化
    if (journey.pageVisibilityChanges.length > 0) {
      sections.push('\n👁️ 页面离开/返回:');
      journey.pageVisibilityChanges.forEach((change, i) => {
        const time = new Date(change.timestamp).toLocaleTimeString();
        const icon = change.type === 'hidden' ? '🚪' : '🔙';
        sections.push(`  ${i + 1}. ${time} ${icon} ${change.reason}`);
      });
    } else {
      sections.push('\n👁️ 页面离开/返回: 未检测到');
    }

    // 时间线（完整序列）
    if (journey.timeline.length > 0) {
      sections.push('\n📅 完整时间线 (按时间顺序):');
      journey.timeline.forEach((event, i) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const icon = {
          click_result: '🔍',
          click_link: '🔗',
          leave_page: '🚪',
          return_page: '🔙',
          navigate: '🧭',
        }[event.type] || '•';
        sections.push(`  ${i + 1}. ${time} ${icon} ${event.description}`);
      });
    }

    return sections.join('\n') || '- 无用户旅程数据';
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

  private formatCitationClicks(citationClicks: CitationClick[] | undefined): string {
    if (!citationClicks || citationClicks.length === 0) {
      return '- 未检测到 citation 相关点击';
    }

    return citationClicks
      .slice(-20)
      .map((click, idx) => {
        const time = new Date(click.timestamp).toLocaleTimeString();
        const suffix = [
          click.citationNumbers.length > 0
            ? `citations=[${click.citationNumbers.join(', ')}]`
            : '',
          click.sourceNumber !== null ? `source=${click.sourceNumber}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        return `  ${idx + 1}. ${time} - ${click.kind} - ${click.label}${suffix ? ` (${suffix})` : ''}`;
      })
      .join('\n');
  }

  /**
   * 分析用户旅程：追踪搜索结果点击、链接点击、页面离开/返回
   */
  analyzeUserJourney(): UserJourney {
    const searchResultClicks: SearchResultClick[] = [];
    const pageVisibilityChanges: PageVisibilityChange[] = [];
    const linkClicks: Array<{
      timestamp: number;
      linkIndex: number | null;
      linkText: string;
      linkUrl: string;
      isSearchResult: boolean;
      position: { x: number; y: number };
    }> = [];
    const timeline: Array<{
      timestamp: number;
      type: 'click_result' | 'click_link' | 'leave_page' | 'return_page' | 'navigate';
      description: string;
      details: unknown;
    }> = [];

    // 用于存储 DOM 快照，帮助识别点击的元素
    let currentDomSnapshot: Record<string, unknown> | null = null;
    let allLinks: Array<{ id: number; href: string; text: string }> = [];

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      // 1. 处理 FullSnapshot 事件 (type: 2) - 获取 DOM 结构
      if (eventType === 2) {
        currentDomSnapshot = data as Record<string, unknown> | null;
        // 从快照中提取所有链接
        allLinks = this.extractLinksFromSnapshot(currentDomSnapshot);
      }

      // 2. 处理 IncrementalSnapshot 事件 (type: 3) - DOM 更新
      if (eventType === 3 && data?.source === 0) {
        // Mutation 事件，可能有新的链接添加
        const adds = (data.adds as Array<Record<string, unknown>>) || [];
        adds.forEach((add) => {
          const node = add.node as Record<string, unknown> | undefined;
          if (node?.type === 2 && (node.tagName as string)?.toLowerCase() === 'a') {
            const attributes = (node.attributes as Record<string, string>) || {};
            allLinks.push({
              id: (add.nextId as number) || (node.id as number) || 0,
              href: attributes.href || '',
              text: this.extractTextContent(node),
            });
          }
        });
      }

      // 3. 处理点击事件 (type: 3, source: 2, type: 2)
      if (eventType === 3 && data?.source === 2 && data.type === 2) {
        const clickX = (data.x as number) || 0;
        const clickY = (data.y as number) || 0;
        const targetId = (data.id as number) || 0;

        // 尝试从点击目标中提取元素信息
        const elementInfo = this.getElementInfo(targetId, currentDomSnapshot);
        
        // 判断是否点击了链接
        const clickedLink = allLinks.find((link) => link.id === targetId);
        
        if (clickedLink) {
          // 判断是否是搜索结果
          const isSearchResult = this.isSearchResultLink(elementInfo);
          const linkIndex = allLinks.indexOf(clickedLink) + 1;

          if (isSearchResult) {
            // 搜索结果点击
            const resultClick: SearchResultClick = {
              timestamp: event.timestamp,
              resultIndex: this.extractSearchResultIndex(elementInfo),
              linkText: clickedLink.text,
              linkUrl: clickedLink.href,
              elementInfo: {
                tagName: elementInfo.tagName || 'a',
                className: elementInfo.className || '',
                id: elementInfo.id || '',
                textContent: clickedLink.text,
              },
              position: { x: clickX, y: clickY },
            };
            searchResultClicks.push(resultClick);

            timeline.push({
              timestamp: event.timestamp,
              type: 'click_result',
              description: `点击搜索结果 #${resultClick.resultIndex || '?'}: ${clickedLink.text}`,
              details: resultClick,
            });
          } else {
            // 普通链接点击
            linkClicks.push({
              timestamp: event.timestamp,
              linkIndex: linkIndex,
              linkText: clickedLink.text,
              linkUrl: clickedLink.href,
              isSearchResult: false,
              position: { x: clickX, y: clickY },
            });

            timeline.push({
              timestamp: event.timestamp,
              type: 'click_link',
              description: `点击链接 #${linkIndex}: ${clickedLink.text}`,
              details: { linkUrl: clickedLink.href, linkText: clickedLink.text },
            });
          }
        }
      }

      // 4. 处理页面导航事件 (type: 4) - 检测页面跳转
      if (eventType === 4 && data?.href) {
        timeline.push({
          timestamp: event.timestamp,
          type: 'navigate',
          description: `导航到: ${data.href}`,
          details: { url: data.href },
        });
      }

      // 5. 处理页面可见性变化 (通过检测特定的 Plugin 事件)
      // rrweb 使用 plugin 来记录 visibilitychange 事件
      if (eventType === 6) { // Plugin 事件
        const pluginData = data?.plugin;
        if (pluginData === 'rrweb/console@1') {
          // 这是 console 插件，跳过
        } else if (data?.payload) {
          // 可能是 visibility 相关事件
          const payload = data.payload as Record<string, unknown>;
          if (payload.type === 'visibilitychange') {
            const isHidden = payload.hidden as boolean;
            const change: PageVisibilityChange = {
              timestamp: event.timestamp,
              type: isHidden ? 'hidden' : 'visible',
              reason: isHidden ? '用户离开了页面（切换标签页或最小化）' : '用户返回了页面',
            };
            pageVisibilityChanges.push(change);

            timeline.push({
              timestamp: event.timestamp,
              type: isHidden ? 'leave_page' : 'return_page',
              description: change.reason,
              details: { hidden: isHidden },
            });
          }
        }
      }
    });

    return {
      searchResultClicks,
      pageVisibilityChanges,
      linkClicks,
      timeline,
    };
  }

  /**
   * 从 DOM 快照中提取所有链接
   */
  private extractLinksFromSnapshot(snapshot: Record<string, unknown> | null): Array<{ id: number; href: string; text: string }> {
    if (!snapshot) return [];
    
    const links: Array<{ id: number; href: string; text: string }> = [];
    
    const traverse = (node: Record<string, unknown> | null) => {
      if (!node) return;
      
      // 检查是否是元素节点 (type: 2)
      if (node.type === 2) {
        const tagName = (node.tagName as string)?.toLowerCase();
        if (tagName === 'a') {
          const attributes = (node.attributes as Record<string, string>) || {};
          links.push({
            id: (node.id as number) || 0,
            href: attributes.href || '',
            text: this.extractTextContent(node),
          });
        }
        
        // 遍历子节点
        const childNodes = (node.childNodes as Array<Record<string, unknown>>) || [];
        childNodes.forEach((child) => traverse(child));
      }
    };
    
    traverse(snapshot);
    return links;
  }

  /**
   * 提取元素的文本内容
   */
  private extractTextContent(node: Record<string, unknown>): string {
    let text = '';
    
    const traverse = (n: Record<string, unknown>) => {
      // 文本节点 (type: 3)
      if (n.type === 3) {
        text += (n.textContent as string) || '';
      }
      
      // 遍历子节点
      const childNodes = (n.childNodes as Array<Record<string, unknown>>) || [];
      childNodes.forEach((child) => traverse(child));
    };
    
    traverse(node);
    return text.trim();
  }

  /**
   * 获取元素信息
   */
  private getElementInfo(targetId: number, snapshot: Record<string, unknown> | null): {
    tagName: string;
    className: string;
    id: string;
    dataAttributes?: Record<string, string>;
  } {
    if (!snapshot) {
      return { tagName: '', className: '', id: '', dataAttributes: {} };
    }
    
    let foundElement: Record<string, unknown> | null = null;
    
    const traverse = (node: Record<string, unknown> | null): boolean => {
      if (!node) return false;
      
      if (node.id === targetId) {
        foundElement = node;
        return true;
      }
      
      const childNodes = (node.childNodes as Array<Record<string, unknown>>) || [];
      for (const child of childNodes) {
        if (traverse(child)) return true;
      }
      
      return false;
    };
    
    traverse(snapshot);
    
    if (foundElement && typeof foundElement === 'object' && foundElement !== null) {
      const elem = foundElement as { attributes?: Record<string, string>; tagName?: string };
      const attributes = elem.attributes || {};
      
      // 提取 data- 属性
      const dataAttributes: Record<string, string> = {};
      Object.keys(attributes).forEach((key) => {
        if (key.startsWith('data-')) {
          const dataKey = key.replace('data-', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          dataAttributes[dataKey] = attributes[key];
        }
      });
      
      return {
        tagName: elem.tagName || '',
        className: attributes.class || '',
        id: attributes.id || '',
        dataAttributes,
      };
    }
    
    return { tagName: '', className: '', id: '', dataAttributes: {} };
  }

  /**
   * 判断是否是搜索结果链接
   */
  private isSearchResultLink(elementInfo: { tagName: string; className: string; id: string; dataAttributes?: Record<string, string> }): boolean {
    // 根据你的页面结构判断
    // 例如，搜索结果可能有特定的 class 名
    const className = elementInfo.className.toLowerCase();
    const id = elementInfo.id.toLowerCase();
    const dataAttrs = elementInfo.dataAttributes || {};
    
    return (
      className.includes('search-result') ||
      className.includes('result-item') ||
      className.includes('result-link') ||
      id.includes('result') ||
      'resultIndex' in dataAttrs
    );
  }

  /**
   * 提取搜索结果的索引（第几个）
   */
  private extractSearchResultIndex(elementInfo: { tagName: string; className: string; id: string; dataAttributes?: Record<string, string> }): number | null {
    // 优先从 data-result-index 属性中提取
    const dataAttrs = elementInfo.dataAttributes || {};
    if (dataAttrs.resultIndex) {
      const index = parseInt(dataAttrs.resultIndex, 10);
      if (!isNaN(index)) return index;
    }
    
    // 尝试从 class 或 id 中提取索引
    const text = `${elementInfo.className} ${elementInfo.id}`;
    const match = text.match(/result[-_]?(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private getCitationClicks(): CitationClick[] {
    const citationClicks: CitationClick[] = [];
    const nodeMap = new Map<number, SnapshotNodeLike>();

    this.events.forEach((event) => {
      const eventType = (event as Record<string, unknown>).type;
      const data = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;

      if (eventType === 2) {
        nodeMap.clear();
        const root = (data?.node as SnapshotNodeLike | undefined) || (data as SnapshotNodeLike | undefined);
        if (root) {
          this.indexSnapshotNode(root, nodeMap, undefined);
        }
      }

      if (eventType === 3 && data?.source === 0) {
        this.applyMutationsToNodeMap(data, nodeMap);
      }

      if (!(eventType === 3 && data?.source === 2 && data.type === 2)) {
        return;
      }

      const targetId = typeof data.id === 'number' ? data.id : 0;
      if (!targetId) return;

      const resolvedTargetId = this.findNearestActionableNodeId(targetId, nodeMap) || targetId;
      const resolvedNode = nodeMap.get(resolvedTargetId);
      if (!resolvedNode || resolvedNode.type !== 2) {
        return;
      }

      const attributes = resolvedNode.attributes || {};
      const tagName = (resolvedNode.tagName || '').toLowerCase();
      const className = attributes.class || '';
      const textContent = this.extractTextFromNodeMap(resolvedTargetId, nodeMap).trim();
      const ariaLabel = attributes['aria-label'] || '';
      const title = attributes.title || '';
      const dataSourceNumber = this.toNullableInt(attributes['data-source-number']);
      const citationNumbers = this.extractCitationNumbers(
        attributes['data-citation-numbers'] || ariaLabel || title || textContent
      );

      const isCitationButton =
        tagName === 'button' &&
        /citation/i.test(ariaLabel || title) &&
        citationNumbers.length > 0;

      const isShowMoreButton =
        tagName === 'button' &&
        /\bshow\s+more\b/i.test(textContent);

      const isShowLessButton =
        tagName === 'button' &&
        /\bshow\s+less\b/i.test(textContent);

      const isCitationSourceLink =
        tagName === 'a' &&
        dataSourceNumber !== null;

      if (!isCitationButton && !isShowMoreButton && !isShowLessButton && !isCitationSourceLink) {
        return;
      }

      const kind: CitationClick['kind'] = isCitationButton
        ? 'inline_citation_button'
        : isShowMoreButton
          ? 'show_more'
          : isShowLessButton
            ? 'show_less'
            : 'source_link';

      const label = isCitationButton
        ? ariaLabel || title || 'Citation button'
        : isCitationSourceLink
          ? textContent || attributes.href || 'Citation source link'
          : textContent || (isShowMoreButton ? 'Show more' : 'Show less');

      citationClicks.push({
        timestamp: event.timestamp,
        kind,
        citationNumbers,
        sourceNumber: dataSourceNumber,
        label,
        element: {
          tagName,
          className,
          id: attributes.id || '',
          dataAttributes: this.extractDataAttributes(attributes),
          textContent,
        },
        position: {
          x: typeof data.x === 'number' ? data.x : 0,
          y: typeof data.y === 'number' ? data.y : 0,
        },
      });
    });

    return citationClicks;
  }

  private indexSnapshotNode(
    node: SnapshotNodeLike,
    nodeMap: Map<number, SnapshotNodeLike>,
    parentId: number | undefined
  ): void {
    const copy: SnapshotNodeLike = {
      ...node,
      parentId,
      attributes: node.attributes ? { ...node.attributes } : {},
      childNodes: Array.isArray(node.childNodes) ? node.childNodes : [],
    };

    if (typeof node.id === 'number') {
      nodeMap.set(node.id, copy);
    }

    const children = Array.isArray(node.childNodes) ? node.childNodes : [];
    children.forEach((child) => {
      this.indexSnapshotNode(child, nodeMap, typeof node.id === 'number' ? node.id : parentId);
    });
  }

  private applyMutationsToNodeMap(
    mutationData: Record<string, unknown>,
    nodeMap: Map<number, SnapshotNodeLike>
  ): void {
    const removes = (mutationData.removes as Array<Record<string, unknown>> | undefined) || [];
    removes.forEach((remove) => {
      const id = typeof remove.id === 'number' ? remove.id : null;
      if (id !== null) {
        this.removeNodeFromMap(id, nodeMap);
      }
    });

    const adds = (mutationData.adds as Array<Record<string, unknown>> | undefined) || [];
    adds.forEach((add) => {
      const node = add.node as SnapshotNodeLike | undefined;
      const parentId = typeof add.parentId === 'number' ? add.parentId : undefined;
      if (node) {
        this.indexSnapshotNode(node, nodeMap, parentId);
      }
    });

    const attributes = (mutationData.attributes as Array<Record<string, unknown>> | undefined) || [];
    attributes.forEach((attr) => {
      const id = typeof attr.id === 'number' ? attr.id : null;
      if (id === null) return;
      const target = nodeMap.get(id);
      if (!target) return;
      const incoming = (attr.attributes as Record<string, string> | undefined) || {};
      target.attributes = {
        ...(target.attributes || {}),
        ...incoming,
      };
      nodeMap.set(id, target);
    });

    const texts = (mutationData.texts as Array<Record<string, unknown>> | undefined) || [];
    texts.forEach((textChange) => {
      const id = typeof textChange.id === 'number' ? textChange.id : null;
      if (id === null) return;
      const target = nodeMap.get(id);
      if (!target) return;
      target.textContent =
        (typeof textChange.value === 'string' ? textChange.value : undefined) ||
        (typeof textChange.text === 'string' ? textChange.text : undefined) ||
        target.textContent;
      nodeMap.set(id, target);
    });
  }

  private removeNodeFromMap(id: number, nodeMap: Map<number, SnapshotNodeLike>): void {
    const toDelete = new Set<number>([id]);
    let found = true;

    while (found) {
      found = false;
      nodeMap.forEach((node, nodeId) => {
        if (
          typeof node.parentId === 'number' &&
          toDelete.has(node.parentId) &&
          !toDelete.has(nodeId)
        ) {
          toDelete.add(nodeId);
          found = true;
        }
      });
    }

    toDelete.forEach((nodeId) => nodeMap.delete(nodeId));
  }

  private findNearestActionableNodeId(
    startId: number,
    nodeMap: Map<number, SnapshotNodeLike>
  ): number | null {
    let currentId: number | undefined = startId;
    let depth = 0;

    while (typeof currentId === 'number' && depth < 12) {
      const node = nodeMap.get(currentId);
      if (!node) break;
      const tagName = (node.tagName || '').toLowerCase();
      const attrs = node.attributes || {};
      if (tagName === 'button' || tagName === 'a' || 'data-source-number' in attrs) {
        return currentId;
      }
      currentId = node.parentId;
      depth += 1;
    }

    return null;
  }

  private extractTextFromNodeMap(
    nodeId: number,
    nodeMap: Map<number, SnapshotNodeLike>
  ): string {
    const root = nodeMap.get(nodeId);
    if (!root) return '';

    const parts: string[] = [];
    const walk = (node: SnapshotNodeLike) => {
      if (node.type === 3 && typeof node.textContent === 'string') {
        parts.push(node.textContent);
      }
      if (node.type === 2 && typeof node.textContent === 'string') {
        parts.push(node.textContent);
      }
      const children = Array.isArray(node.childNodes) ? node.childNodes : [];
      children.forEach((child) => {
        if (typeof child.id === 'number' && nodeMap.has(child.id)) {
          const mapped = nodeMap.get(child.id);
          if (mapped) walk(mapped);
          return;
        }
        walk(child);
      });
    };

    walk(root);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private extractDataAttributes(attributes: Record<string, string>): Record<string, string> {
    return Object.entries(attributes).reduce<Record<string, string>>((acc, [key, value]) => {
      if (key.startsWith('data-')) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  private extractCitationNumbers(text: string): number[] {
    if (!text) return [];
    const matches = text.match(/\d+/g);
    if (!matches) return [];
    return Array.from(
      new Set(
        matches
          .map((raw) => parseInt(raw, 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    );
  }

  private toNullableInt(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
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
