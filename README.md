# 光伏空调水蓄能调度系统

面向高校竞赛答辩与校园能源管理验证的数字孪生可视化原型，聚焦“光伏发电 + 空调冷热负荷 + 水蓄冷/蓄热 + AI 调度”。项目采用 Vue 3、Vite、TypeScript、Three.js、ECharts 与 Pinia，默认使用本地 Mock 数据，可扩展为校园级能源管理平台。

当前版本采用分层水罐而非电化学储能：冷水机组或热泵在低谷电价窗口，或在白天光伏有剩余的窗口制取冷水或热水并储存；在需要削峰或降低高价时段购电时，水泵和阀门组织水罐放冷或放热。默认策略是部分蓄能，机组继续承担剩余冷热负荷；只有水罐剩余能量和放冷/放热功率均足够时，才可能短时完全停机。

## 1 项目概览

### 业务边界

- 电侧使用 `kW` 与 `kWh`：光伏与电网进口共同供给基础电负荷、冷水机组或热泵以及水泵等辅机，剩余光伏可上网。
- 热侧使用 `kWth` 与 `kWhth`：机组直接供冷或供热与水罐放冷或放热共同满足建筑冷热负荷；充冷或充热由机组额外制取冷热量。
- 水罐放冷或放热不是电力发电。它通过减少当时机组需要输出的冷热量，按机组 COP 间接降低电功率。
- 光伏替代购电、负荷移峰、设备实际节能、电费下降与碳减排是不同指标，应分别核算。移峰不自动意味着总能耗或碳排下降。

### 当前示范配置

Mock 演示采用 180 m³ 分层保温水罐。显热容量近似为：

```text
kWhth ≈ 1.163 × 水量 m³ × 有效温差 ℃
```

- 制冷季：6/13 ℃，有效温差约 7 ℃，容量约 1465.4 kWhth。
- 供热季：45/35 ℃，有效温差约 10 ℃，容量约 2093.4 kWhth。

这些参数只用于演示，不是工程选型。实际项目还需依据逐时负荷、机组能力、水力条件、保温损失、空间、投资与控制策略完成专项设计。

### 页面能力

- 顶部：当前时间、数据来源、系统状态、制冷/供热季节切换、正常/高温或寒潮/阴天/高峰电价场景切换与核心 KPI。
- 左侧：光伏发电、天气环境、发电趋势与电侧能源结构。
- 中间：Three.js 园区数字孪生，显示楼宇、光伏、冷站或热泵、分层蓄能水罐、电网接入点和热量流向。
- 右侧：冷热负荷与舒适度、水蓄冷/蓄热面板、AI 策略说明和设备详情。
- 底部：电功率趋势、冷热负荷构成、水蓄能充放与水位、节能减碳、收益趋势和 AI 决策时间轴。
- 交互：小时回放、设备定位、告警联动、弹窗详情、沉浸孪生和深度分析工作区。

### 调度窗口

- 低谷电价充冷/充热：由电网供电，适合把机组用电移到低价时段；必须计入充能与水泵用电。
- 光伏剩余窗口充冷/充热：只在光伏超过当时电负荷且水罐有余量时进行，提升本地消纳。
- 高价或高负荷窗口放冷/放热：水罐承担部分建筑热负荷，机组承担余量，避免把部分蓄能误写成整站停机。
- 季节切换：制冷季与供热季使用不同供回水温度、COP、容量、状态文案、图表和三维分层颜色。

## 2 物理系统

当前架构包含：

- 光伏组件、逆变器、园区交流母线和并网计量；
- 冷水机组或热泵、冷冻水或热水循环系统；
- 分层保温水罐、布水器、水泵、阀门、换热器或水力分隔；
- 供回水温度、流量、热量、电功率和水位等计量与传感器；
- 楼宇末端和舒适度监测；
- EMS/AI 调度、数据服务和数字孪生界面。

本仓库不包含真实设备控制、施工图、保护整定、现场网关、生产后端或已投运节能证明。

## 3 软件结构

```text
src/
  components/
    charts/
      GenerationTrendChart.vue
      LoadTrendChart.vue
      PowerTrendChart.vue
      ThermalLoadChart.vue
      ThermalStorageChart.vue
      EnergyMixChart.vue
      SavingsCarbonChart.vue
      RevenueTrendChart.vue
    panels/
      LeftPanel.vue
      RightPanel.vue
      ThermalStoragePanel.vue
      BottomPanel.vue
      AiDecisionPanel.vue
      AiTimelinePanel.vue
      EquipmentDetailModal.vue
    three/
      EnergyTwinScene.vue
  domain/
    thermalStorage.ts
    thermalStorage.test.ts
  mock/
    energyMock.ts
    energyMock.test.ts
  services/
    dashboardService.ts
  store/
    dashboard.ts
    dashboard.test.ts
  three/
    createEnergyScene.ts
  types/
    energy.ts
  views/
    DashboardView.vue
```

关键文件：

- [热储能领域模型](src/domain/thermalStorage.ts)：显热容量、小时递推、边界限制、充放互斥与可用时长。
- [Mock 数据工厂](src/mock/energyMock.ts)：制冷/供热配置、场景负荷、两类充能窗口、电热平衡、成本与碳指标。
- [类型定义](src/types/energy.ts)：`kW`/`kWh` 电侧字段和 `kWth`/`kWhth` 热侧字段。
- [状态管理](src/store/dashboard.ts)：场景、季节、回放、设备详情和告警联动；以请求序号保护最新选择，避免并发响应倒序覆盖当前界面。
- [水蓄能面板](src/components/panels/ThermalStoragePanel.vue)：水位、可用冷/热量、充放热功率、供回水温度和可用时长。
- [热负荷图](src/components/charts/ThermalLoadChart.vue)：建筑冷热负荷、机组直供与水罐放冷/放热。
- [蓄能趋势图](src/components/charts/ThermalStorageChart.vue)：充冷/充热、放冷/放热和水位。
- [三维场景](src/three/createEnergyScene.ts)：分层水罐、季节颜色、机组到水罐和水罐到楼宇的热量流。
- [测试](src/domain/thermalStorage.test.ts)、[Mock 测试](src/mock/energyMock.test.ts)、[状态测试](src/store/dashboard.test.ts)：覆盖物理递推、两类平衡、成本口径和并发选择保护。

## 4 数据与计算口径

每个小时的 Mock 数据同时满足两套独立平衡：

```text
电侧：光伏发电 + 电网进口 = 基础电负荷 + 机组电功率 + 水泵电功率 + 电网上网
热侧：机组直接供冷/供热 + 水罐放冷/放热 = 建筑冷热负荷
```

机组总制冷/制热量还包含进入水罐的充冷/充热量，并通过 COP 换算为机组电功率。水泵电耗单独进入电侧账本。

经济指标采用有符号差额：基线账单减实际账单。实际账单包含水罐充能导致的机组用电以及水泵用电。总体节费使用“无光伏、无水蓄能”基线；水蓄能移峰节费使用“同一光伏、无水蓄能”基线，避免把光伏替代收益归因给水蓄能。电量电费与最大需量或峰值费用应分开分析；当前前端 Mock 主要展示分时电量成本与削峰趋势，不构成现场账单结论。

## 5 Mock 与接口

默认使用本地 Mock。可通过以下变量切换到读取接口：

```text
VITE_DASHBOARD_DATA_SOURCE=api
VITE_DASHBOARD_API_BASE=/api
```

当前读取契约包括：

- `GET /dashboard/scenario?mode=normal&operationMode=cooling`
- `GET /dashboard/presentation`
- `GET /dashboard/runtime`

切换数据源不等于具备真实控制能力。生产接入仍需服务端数据校验、时钟与单位治理、设备身份、权限审计、指令回执、超时回退和现场安全联锁。

## 6 本地运行

```bash
npm ci
npm run dev
```

验证命令：

```bash
npm test
npm run type-check
npm run build
```

## 7 效益与落地边界

- 设备节能：在可比天气、占用与舒适度条件下，机组和水泵实际耗电相对调整基线的下降。
- 光伏替代：自产光伏减少外购电，不应与设备节电重复计算。
- 负荷移峰：把购电从高价或高峰时段移到其他时段，可能降低电费或需量，但总电量可能持平或增加。
- 电费节省：按同一计费规则计算“基线账单 - 实际账单”，必须包含充能和水泵成本。
- 碳核算：应说明基线、排放因子、时段口径及光伏来源；低价充能不自动代表低碳。

实际项目的水罐容积、温差、换热方式、机组容量、泵阀选型和控制边界必须按现场条件设计。本项目现阶段是演示与验证原型，不提供施工、自动控制投运或节能量保证。
