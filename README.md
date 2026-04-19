# 光伏空调宏观能源调度系统

面向高校竞赛答辩场景的数字孪生可视化大屏原型，聚焦“光伏发电 + 空调负荷 + 储能系统 + AI 调度引擎”的协同运行展示。项目采用 Vue 3 + Vite + TypeScript + Three.js + ECharts + Pinia，默认使用本地 Mock 数据，可直接扩展为校园级能源管理平台。

## 1. 整体方案概览

### 项目亮点
- 3D 数字孪生主视觉：中部采用 Three.js 低模园区场景，覆盖楼宇、光伏阵列、空调冷站、储能电池柜、电网接入点与动态能量流光。
- 业务逻辑完整：覆盖发电、负荷、储能、节能、环境影响、经济收益、AI 决策全链路。
- 比赛友好：支持正常、高温、阴天、高峰电价四种场景联动切换，便于答辩时展示不同策略效果。
- 扩展性强：使用类型化 Mock 数据与 Pinia 状态管理，后续接后端接口、物联网数据、AI 优化算法都比较顺滑。

### 页面模块结构
- 顶部：项目标题、当前时间、系统状态、场景切换、核心 KPI。
- 左侧：光伏发电、天气环境、发电趋势、能源结构占比。
- 中间：Three.js 3D 园区数字孪生场景，支持视角切换、hover 高亮、点击联动。
- 右侧：空调负荷与舒适度、储能状态、AI 策略引擎、经济效益分析。
- 底部：24 小时功率趋势、碳减排与节能分析、峰谷电价与收益、AI 决策时间轴。

### 技术架构
- 前端框架：Vue 3 + Vite + TypeScript
- 状态管理：Pinia
- 可视化图表：ECharts
- 3D 场景：Three.js
- 样式方案：SCSS + 自定义科技大屏主题变量
- 数据方案：本地 Mock 数据工厂 + 场景模式联动

### 比赛展示卖点
- 双碳目标：实时展示碳减排量、绿色能源占比、等效植树量。
- 智慧校园：以校园楼宇与空调系统为业务载体，贴合高校场景。
- AI 决策：不仅展示建议文本，还以策略评分、收益、减碳效果和时间轴进行可视化。
- 协同调度：突出“光伏优先消纳、储能柔性削峰、电网兜底”的能源协同逻辑。

### 第二阶段增强
- 一键答辩模式：自动切换场景、时间窗口、镜头视角与核心设备，适合现场讲解。
- 设备详情弹窗：点击 3D 设备后查看核心指标、短时趋势、关联告警和 AI 建议。
- 告警总线：将高温、光伏出力下降、电网购电敏感、储能策略关注等信息统一高亮。
- 后端适配层：通过 `dashboardService` 抽象 Mock 演示模式和未来 API 模式。

## 2. 页面信息架构

### 顶部信息栏
- 项目名称
- 当前时间 / 日期 / 天气
- 当前总功率、今日节能率、碳减排、经济收益
- 场景切换：正常模式 / 高温模式 / 阴天模式 / 高峰电价模式

### 左侧区域
- 光伏发电模块：当前发电功率、日累计发电量、太阳辐照强度、发电波动、发电效率
- 天气环境模块：天气、温度、湿度、云量、风速、舒适度
- 发电趋势图：24 小时光伏功率变化
- 能源结构占比图：光伏直供 / 储能调节 / 电网补给

### 中间 3D 场景
- 设备：楼宇、屋顶光伏板、空调冷站、储能电池柜、电网接口
- 动效：光伏到储能、光伏到空调、储能到空调、电网到空调的动态流光
- 交互：hover 高亮、点击选中、视角切换、自动巡航
- 叠加信息：绿电占比、网购电功率、选中模块详情

### 右侧区域
- 空调模块：总负荷、运行状态、舒适度、各楼栋分区负载
- 储能模块：SOC、容量、充放电功率、运行状态
- AI 调度引擎：策略标题、置信度、策略规则评分、预期收益与预期减碳
- 经济模块：日电费节省、月度节省成本、峰谷套利收益、投资收益趋势

### 底部区域
- 发电/负荷趋势图
- 节能率与碳减排图
- 峰谷电价与调度收益图
- AI 决策记录时间轴

## 3. 项目目录结构

```text
src/
  components/
    charts/
      BaseChart.vue
      GenerationTrendChart.vue
      LoadTrendChart.vue
      EnergyMixChart.vue
      PowerTrendChart.vue
      SavingsCarbonChart.vue
      RevenueTrendChart.vue
      chartTheme.ts
    common/
      AnimatedNumber.vue
    layout/
      SectionCard.vue
      TopHeader.vue
    presentation/
      DashboardCommandBar.vue
    panels/
      LeftPanel.vue
      RightPanel.vue
      BottomPanel.vue
      AiDecisionPanel.vue
      AiTimelinePanel.vue
      EquipmentDetailModal.vue
    three/
      EnergyTwinScene.vue
  mock/
    energyMock.ts
  services/
    dashboardService.ts
  store/
    dashboard.ts
  three/
    createEnergyScene.ts
  types/
    energy.ts
  utils/
    format.ts
  views/
    DashboardView.vue
  App.vue
  main.ts
  style.scss
```

## 4. Mock 数据结构设计

核心类型定义在 [src/types/energy.ts](/Volumes/高达 RX/home/max/src/types/energy.ts)，主要包含：
- `DashboardScenarioData`：单个场景的完整大屏数据
- `LiveDashboardSnapshot`：随动态回放实时刷新的快照数据
- `HourlyPoint`：24 小时趋势数据
- `WeeklyStat`：近 7 天统计数据
- `AiDecisionOutput`：AI 策略与决策结果
- `SystemNodeStatus`：3D 场景节点对应的设备状态
- `SystemAlert`：实时告警总线数据
- `PresentationChapter`：答辩脚本章节数据
- `NodeDetailData`：设备详情弹窗数据

示例数据生成逻辑在 [src/mock/energyMock.ts](/Volumes/高达 RX/home/max/src/mock/energyMock.ts)：
- 中午光照强，`photovoltaicKw` 达峰
- 下午高温时 `loadKw` 上升
- 高峰电价模式下 `storageDischargeKw` 增强
- 阴天模式下 `gridImportKw` 增加
- AI 输出根据场景切换不同策略文本、评分和收益

## 5. 核心页面与组件

- 首页主框架：[src/views/DashboardView.vue](/Volumes/高达 RX/home/max/src/views/DashboardView.vue)
- 顶部信息栏：[src/components/layout/TopHeader.vue](/Volumes/高达 RX/home/max/src/components/layout/TopHeader.vue)
- 左侧面板：[src/components/panels/LeftPanel.vue](/Volumes/高达 RX/home/max/src/components/panels/LeftPanel.vue)
- 右侧面板：[src/components/panels/RightPanel.vue](/Volumes/高达 RX/home/max/src/components/panels/RightPanel.vue)
- 底部图表区：[src/components/panels/BottomPanel.vue](/Volumes/高达 RX/home/max/src/components/panels/BottomPanel.vue)
- AI 决策面板：[src/components/panels/AiDecisionPanel.vue](/Volumes/高达 RX/home/max/src/components/panels/AiDecisionPanel.vue)
- 答辩模式控制条：[src/components/presentation/DashboardCommandBar.vue](/Volumes/高达 RX/home/max/src/components/presentation/DashboardCommandBar.vue)
- 设备详情弹窗：[src/components/panels/EquipmentDetailModal.vue](/Volumes/高达 RX/home/max/src/components/panels/EquipmentDetailModal.vue)
- 数据适配层：[src/services/dashboardService.ts](/Volumes/高达 RX/home/max/src/services/dashboardService.ts)

## 6. Three.js 场景设计

Three.js 核心文件为 [src/three/createEnergyScene.ts](/Volumes/高达 RX/home/max/src/three/createEnergyScene.ts)。

### 场景组成
- 园区底盘：八边形平台 + 科技环形发光边
- 楼宇模型：3 栋低模建筑
- 光伏阵列：实例化屋顶面板阵列
- 空调冷站：冷站底座 + 风机 + 管道
- 储能电池柜：多柜体组合 + 发光状态条
- 电网接口：简化输电塔
- 天空元素：太阳、云层、粒子

### 动画与交互
- 自动巡航镜头
- 视角切换：总览 / 光伏 / 空调 / 储能
- 能量流动粒子：沿曲线路径持续运动
- hover 高亮与 tooltip
- click 选中并同步右下角模块信息
- 告警节点脉冲高亮
- 答辩章节悬浮信息

### 性能优化思路
- 光伏面板使用 `InstancedMesh`
- 低模几何体替代复杂模型
- 限制像素比到 `1.8`
- 粒子数量控制在轻量级范围
- 将交互对象限定为少量核心节点

## 7. ECharts 图表说明

- 发电趋势图：[src/components/charts/GenerationTrendChart.vue](/Volumes/高达 RX/home/max/src/components/charts/GenerationTrendChart.vue)
- 负荷趋势图：[src/components/charts/LoadTrendChart.vue](/Volumes/高达 RX/home/max/src/components/charts/LoadTrendChart.vue)
- 负荷/发电/电网综合趋势：[src/components/charts/PowerTrendChart.vue](/Volumes/高达 RX/home/max/src/components/charts/PowerTrendChart.vue)
- 能源结构占比：[src/components/charts/EnergyMixChart.vue](/Volumes/高达 RX/home/max/src/components/charts/EnergyMixChart.vue)
- 节能/碳减排：[src/components/charts/SavingsCarbonChart.vue](/Volumes/高达 RX/home/max/src/components/charts/SavingsCarbonChart.vue)
- 收益趋势图：[src/components/charts/RevenueTrendChart.vue](/Volumes/高达 RX/home/max/src/components/charts/RevenueTrendChart.vue)

## 8. 可继续扩展建议

### 后端接口接入
- 将 `buildScenarioData` 替换为 `/api/dashboard/overview`
- 将 `hourly`、`weekly`、`ai` 拆分成独立接口
- 通过 WebSocket 推送实时功率、SOC、温湿度、告警信息
- 可通过 `VITE_DASHBOARD_DATA_SOURCE=api` 与 `VITE_DASHBOARD_API_BASE=/api` 切换到真实接口模式

### 接入真实传感器数据
- 光伏逆变器：接入 Modbus / MQTT / OPC UA
- 空调系统：接入楼宇自控 BACnet 或冷站控制器
- 储能系统：接入 BMS/PCS 的实时状态
- 天气数据：接入校园气象站或第三方气象接口

### AI 算法增强
- 用时序预测模型预测负荷与光照
- 用强化学习或混合整数规划做削峰填谷优化
- 输出调度策略评分、节能率对比、收益模拟结果
- 增加“AI 解释层”，展示策略依据与约束条件

### 提升答辩效果
- 增加“一键剧情演示”脚本，自动切换四种场景
- 增加“基线方案 vs AI 调度方案”对比页
- 增加校园级扩展蓝图，说明未来可扩展到宿舍、图书馆、实验楼群
- 结合双碳目标，强调可复制、可推广、可运营

## 9. 启动方式

```bash
npm install
npm run dev
```

当前仓库已包含完整前端骨架代码，但我没有在当前环境里执行依赖安装，因此最终运行前需要先安装依赖。
