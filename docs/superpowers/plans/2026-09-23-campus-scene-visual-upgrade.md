# 园区 3D 主体升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三栋建筑、光伏、冷热源、水罐、电网接口及流线从基础几何体升级为统一、可辨认且保持交互和状态联动的园区数字孪生模型。

**Architecture:** 把静态造型拆到建筑和设备工厂，动态蓄能罐工厂单独返回需要更新的材质与网格引用；场景编排文件只负责放置、交互、状态更新和渲染循环。重复窗格、光伏电池片和格栅使用实例化网格，沿用原节点 ID 与场景数据协议。

**Tech Stack:** Vue 3, Three.js 0.177, TypeScript, Vitest, Vite.

---

## 文件边界

- 新建 `src/three/campusBuildings.ts`：建筑工厂、楼层/窗格/入口/屋顶细节。
- 新建 `src/three/campusBuildings.test.ts`：建筑尺寸、风格差异、交互元数据、实例化窗格。
- 新建 `src/three/energyEquipment.ts`：光伏、冷热源机房、电网接口造型工厂。
- 新建 `src/three/energyEquipment.test.ts`：面板数量/布局、设备结构、交互元数据。
- 新建 `src/three/thermalTankModel.ts`：蓄能水罐造型与现有动画部件引用。
- 新建 `src/three/thermalTankModel.test.ts`：分层部件与可视结构不遮挡。
- 新建 `src/three/flowVisuals.ts`：四类能源路径共用的管线和方向脉冲工厂。
- 新建 `src/three/createEnergyScene.test.ts`：流线结构与业务路径回归。
- 修改 `src/three/createEnergyScene.ts`：接入工厂，调整能量流管线与粒子，保留状态、相机、射线交互和清理逻辑。
- 修改 `src/presentationPolish.test.ts`：更新受造型拆分影响的源文件级检查。

## Task 1：建筑工厂

- [ ] **先写失败测试**：`campusBuildings.test.ts` 调用 `createCampusBuilding({ id: 'building-a', label: '教学楼 A', kind: 'teaching', width: 4.6, height: 6, depth: 4.2, position: [-6.2, 0, -0.8] })`；断言交互元数据、世界包围盒最高点约为 6.2、至少 3 条楼层带、窗格为 `THREE.InstancedMesh`。另测 `library` 含中庭组、`laboratory` 含屋顶设备组。
- [ ] **验证红灯**：`npm test -- src/three/campusBuildings.test.ts`；预期模块缺失导致失败。
- [ ] **实现造型**：新工厂创建不透明结构体、独立玻璃幕墙、带框窗格、楼层水平带、入口雨棚和屋顶女儿墙；按 `kind` 添加教学楼水平分带、图书馆竖向中庭、实验楼设备组。窗格按确定性行列写入两个 `InstancedMesh`（深色与少量暖色）；不得使用 `Math.random()`。工厂返回顶层 `Group`，设置 `{id,label,interactive:true}` 并使用传入坐标。
- [ ] **验证绿灯和集成**：运行建筑测试；在 `createEnergyScene.ts` 用三个工厂调用替换旧 `createBuilding`，原建筑尺寸、位置、ID 不变；运行 `npm run type-check`、`npm test`。
- [ ] **提交**：`git add src/three/campusBuildings.ts src/three/campusBuildings.test.ts src/three/createEnergyScene.ts && git commit -m "feat: detail campus building models"`。

## Task 2：光伏、冷热源和电网接口

- [ ] **先写失败测试**：`energyEquipment.test.ts` 断言 `createPvArray()` 包含恰好 24 块有效光伏板及实例化电池片，全部面板中心落在教学楼或图书馆屋顶范围；`createAcStation()` 包含机房壳体、三组风机与外露管道；`createGridGateway()` 包含柜体、绝缘子和导线。每个工厂保留 `pv`、`ac`、`grid` ID、标签与可交互性。
- [ ] **验证红灯**：`npm test -- src/three/energyEquipment.test.ts`；预期模块缺失导致失败。
- [ ] **实现造型**：光伏板由暗蓝电池面、细金属框、分格线和倾斜支架构成，使用确定性两屋顶排布；冷热源加入低矮实体机房、风机罩/叶片、百叶与供回水管；电网接口加入变配电柜、双立柱、横担、绝缘子与悬接导线。装饰色保持克制，透明命中体继续覆盖设备主体。
- [ ] **验证绿灯和集成**：运行设备测试并将场景文件旧工厂替换为模块导入；运行 `npm run type-check`、`npm test`。
- [ ] **提交**：`git add src/three/energyEquipment.ts src/three/energyEquipment.test.ts src/three/createEnergyScene.ts && git commit -m "feat: detail campus energy equipment"`。

## Task 3：蓄能罐与流线

- [ ] **先写失败测试**：`thermalTankModel.test.ts` 调用 `createThermalTank()`，断言返回 `group`、`storedLayer`、`returnLayer`、`interfaceSurface`、`interfaceRim`、`pulseRing` 和四种动画材质；断言罐体外部存在支座、检修梯、阀门、双层管线，并断言内部层高仍为 3.72、起点仍为 0.38。
- [ ] **验证红灯**：`npm test -- src/three/thermalTankModel.test.ts`；预期模块缺失导致失败。
- [ ] **实现造型并集成**：将现有 `createThermalTank` 移到 `thermalTankModel.ts`，保持动态部件及 `renderOrder`/`depthWrite`，只增加不遮蔽液层的外部细节；场景文件改为导入工厂。保留 `applyThermalVisuals()` 所有颜色、层高、界面与脉冲更新。
- [ ] **先写流线回归测试**：在 `createEnergyScene.test.ts` 增加 `createFlowVisual()` 的结构测试，断言电力/冷热水路径拥有细管、定向脉冲与同色线，路径仍为四条业务 ID；测试失败后再将流线造型抽到 `src/three/flowVisuals.ts` 实现，并由场景文件接入。
- [ ] **验证绿灯**：运行 `npm test -- src/three/thermalTankModel.test.ts src/three/createEnergyScene.test.ts`、`npm run type-check`、`npm test`。
- [ ] **提交**：`git add src/three/thermalTankModel.ts src/three/thermalTankModel.test.ts src/three/flowVisuals.ts src/three/createEnergyScene.test.ts src/three/createEnergyScene.ts && git commit -m "feat: refine thermal tank and energy flows"`。

## Task 4：综合画面和性能验收

- [ ] **自动化**：运行 `npm test`、`npm run type-check`、`npm run build`、`git diff --check`；修复任何真实失败。若旧的源文件正则断言与新模块边界冲突，先调整测试断言使其检查行为，再运行全套测试。
- [ ] **浏览器视觉检查**：运行本地 Vite 服务并查看总览、光伏、空调、水罐视角；检查楼顶光伏贴合、罐体冷热层可见、设备不穿模、桌面/窄屏画面、悬停/点击、控制台告警及明显掉帧。调整后重新运行自动化验证。
- [ ] **代码复查**：检查模型面数与 `InstancedMesh` 使用、共享材质释放、交互 ID、状态联动和最终 `git diff`；不得提交 `.superpowers/` 或用户备份目录。
- [ ] **提交**：`git add src/three src/presentationPolish.test.ts && git commit -m "test: verify upgraded campus scene visuals"`（仅在本任务确有修改时提交）。

## 完成条件

依照 `docs/superpowers/specs/2026-09-23-campus-scene-visual-upgrade-design.md` 逐项核对。只有自动化测试、生产构建和浏览器视觉验收均通过，才能声称已完成；合并/推送/发布依据用户既有授权与当前分支收尾流程办理。
