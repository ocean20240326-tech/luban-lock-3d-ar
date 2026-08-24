# `lu_ban_lock.glb` 模型审计报告

- 审计日期：2026-07-31
- 源文件：`C:\Users\Ocean\Downloads\lu_ban_lock.glb`
- 文件大小：48,232 bytes（47.1 KiB / 0.046 MiB）
- SHA-256：`8E215A86264DAFC2A3A9CF43406E2DB2470EEF0A150264DB91E98EB8BD655A5B`
- 审计方式：直接读取 GLB 2.0 的 JSON/BIN chunk，并计算静态场景世界坐标包围盒；未修改源文件

## 结论

**结论：模型具备用于手机端 3D/AR 网站的基础条件，但不建议原样上线。**

优点是文件非常小、几何量低、确实有六个可独立变换的逻辑零件，而且 `Assemble` / `Disassemble` 动画齐全且端点相互对应。主要上线阻碍是物理尺寸不正确：按 glTF 的米制约定，当前组装状态最大尺寸约为 **933.058 mm**，不是 75 mm。另外，零件和 Mesh 名称不清晰，Sketchfab 导出层级较冗余，材质还使用了没有必要的透明裁切与双面渲染设置。

| 检查项 | 结果 | 判断 |
|---|---|---|
| GLB/glTF 版本 | GLB 2.0；JSON chunk 26,408 bytes，BIN chunk 21,796 bytes | 正常 |
| 六个独立零件 | 有 6 个逻辑零件组，动画直接作用于这 6 个节点 | 通过 |
| Mesh 数量 | 22 个 Mesh，不是“一件一个 Mesh” | 可用，建议合并为 6 个 |
| 动画 | `Disassemble`、`Assemble` | 通过 |
| 材质/贴图 | 1 个材质、1 张内嵌 PNG 调色板贴图 | 轻量，但设置可优化 |
| 静态组装尺寸 | 931.118 × 931.118 × 933.058 mm | 不通过 75 mm 目标 |
| 摄像机/灯光 | 均无 | 通过 |
| 文件大小 | 47.1 KiB；528 个位置顶点、264 个三角形 | 非常适合移动网页 |
| 命名与层级 | 54 个节点，多数为自动生成名和导出包装节点 | 建议清理 |

## 1. 节点结构

默认场景为 `Sketchfab_Scene`，唯一场景根节点是 `Sketchfab_model`。完整层级如下；方括号中是引用的 glTF Mesh 索引和 Mesh 名称。

```text
Sketchfab_Scene
└─ [0] Sketchfab_model
   └─ [1] root
      └─ [2] GLTF_SceneRootNode
         └─ [3] _28
            ├─ [4] 1_6                         ← 逻辑零件 1
            │  ├─ [5] cube_0  → [6] Object_6  [Mesh 0: Object_0]
            │  ├─ [7] cube_1  → [8] Object_8  [Mesh 1: Object_1]
            │  ├─ [9] cube_2  → [10] Object_10 [Mesh 2: Object_2]
            │  ├─ [11] cube_3 → [12] Object_12 [Mesh 3: Object_3]
            │  ├─ [13] cube_4 → [14] Object_14 [Mesh 4: Object_4]
            │  └─ [15] cube_5 → [16] Object_16 [Mesh 5: Object_5]
            ├─ [17] 2_13                        ← 逻辑零件 2
            │  ├─ [18] cube_7  → [19] Object_19 [Mesh 6: Object_6]
            │  ├─ [20] cube_8  → [21] Object_21 [Mesh 7: Object_7]
            │  ├─ [22] cube_9  → [23] Object_23 [Mesh 8: Object_8]
            │  ├─ [24] cube_10 → [25] Object_25 [Mesh 9: Object_9]
            │  ├─ [26] cube_11 → [27] Object_27 [Mesh 10: Object_10]
            │  └─ [28] cube_12 → [29] Object_29 [Mesh 11: Object_11]
            ├─ [30] 3_17                        ← 逻辑零件 3
            │  ├─ [31] cube_14 → [32] Object_32 [Mesh 12: Object_12]
            │  ├─ [33] cube_15 → [34] Object_34 [Mesh 13: Object_13]
            │  └─ [35] cube_16 → [36] Object_36 [Mesh 14: Object_14]
            ├─ [37] 4_21                        ← 逻辑零件 4
            │  ├─ [38] cube_18 → [39] Object_39 [Mesh 15: Object_15]
            │  ├─ [40] cube_19 → [41] Object_41 [Mesh 16: Object_16]
            │  └─ [42] cube_20 → [43] Object_43 [Mesh 17: Object_17]
            ├─ [44] 5_25                        ← 逻辑零件 5
            │  ├─ [45] cube_22 → [46] Object_46 [Mesh 18: Object_18]
            │  ├─ [47] cube_23 → [48] Object_48 [Mesh 19: Object_19]
            │  └─ [49] cube_24 → [50] Object_50 [Mesh 20: Object_20]
            └─ [51] 6_27                        ← 逻辑零件 6
               └─ [52] cube_26 → [53] Object_53 [Mesh 21: Object_21]
```

结构统计：

- Node：54
- 含 Mesh 的 Node：22
- 逻辑零件组：6
- Mesh：22
- Primitive：22（每个 Mesh 1 个三角形 Primitive）
- Skin / 骨骼：0
- Morph target：0

## 2. 全部 Mesh 名称

所有 Mesh 都是自动生成名称；每个 Mesh 有 24 个位置顶点、36 个索引和 12 个三角形。

| Mesh 索引 | Mesh 名称 | 引用它的 Node | 所属逻辑零件 |
|---:|---|---|---|
| 0 | `Object_0` | `[6] Object_6` | `[4] 1_6` |
| 1 | `Object_1` | `[8] Object_8` | `[4] 1_6` |
| 2 | `Object_2` | `[10] Object_10` | `[4] 1_6` |
| 3 | `Object_3` | `[12] Object_12` | `[4] 1_6` |
| 4 | `Object_4` | `[14] Object_14` | `[4] 1_6` |
| 5 | `Object_5` | `[16] Object_16` | `[4] 1_6` |
| 6 | `Object_6` | `[19] Object_19` | `[17] 2_13` |
| 7 | `Object_7` | `[21] Object_21` | `[17] 2_13` |
| 8 | `Object_8` | `[23] Object_23` | `[17] 2_13` |
| 9 | `Object_9` | `[25] Object_25` | `[17] 2_13` |
| 10 | `Object_10` | `[27] Object_27` | `[17] 2_13` |
| 11 | `Object_11` | `[29] Object_29` | `[17] 2_13` |
| 12 | `Object_12` | `[32] Object_32` | `[30] 3_17` |
| 13 | `Object_13` | `[34] Object_34` | `[30] 3_17` |
| 14 | `Object_14` | `[36] Object_36` | `[30] 3_17` |
| 15 | `Object_15` | `[39] Object_39` | `[37] 4_21` |
| 16 | `Object_16` | `[41] Object_41` | `[37] 4_21` |
| 17 | `Object_17` | `[43] Object_43` | `[37] 4_21` |
| 18 | `Object_18` | `[46] Object_46` | `[44] 5_25` |
| 19 | `Object_19` | `[48] Object_48` | `[44] 5_25` |
| 20 | `Object_20` | `[50] Object_50` | `[44] 5_25` |
| 21 | `Object_21` | `[53] Object_53` | `[51] 6_27` |

## 3. 全部 Node 名称

| Node 索引 | Node 名称 | 类型/关系 |
|---:|---|---|
| 0 | `Sketchfab_model` | 场景根容器 |
| 1 | `root` | 容器，父节点 0 |
| 2 | `GLTF_SceneRootNode` | 坐标转换容器，父节点 1 |
| 3 | `_28` | 六零件总容器，父节点 2 |
| 4 | `1_6` | 逻辑零件 1，动画目标 |
| 5 | `cube_0` | Mesh 包装节点 |
| 6 | `Object_6` | Mesh Node → `Object_0` |
| 7 | `cube_1` | Mesh 包装节点 |
| 8 | `Object_8` | Mesh Node → `Object_1` |
| 9 | `cube_2` | Mesh 包装节点 |
| 10 | `Object_10` | Mesh Node → `Object_2` |
| 11 | `cube_3` | Mesh 包装节点 |
| 12 | `Object_12` | Mesh Node → `Object_3` |
| 13 | `cube_4` | Mesh 包装节点 |
| 14 | `Object_14` | Mesh Node → `Object_4` |
| 15 | `cube_5` | Mesh 包装节点 |
| 16 | `Object_16` | Mesh Node → `Object_5` |
| 17 | `2_13` | 逻辑零件 2，动画目标 |
| 18 | `cube_7` | Mesh 包装节点 |
| 19 | `Object_19` | Mesh Node → `Object_6` |
| 20 | `cube_8` | Mesh 包装节点 |
| 21 | `Object_21` | Mesh Node → `Object_7` |
| 22 | `cube_9` | Mesh 包装节点 |
| 23 | `Object_23` | Mesh Node → `Object_8` |
| 24 | `cube_10` | Mesh 包装节点 |
| 25 | `Object_25` | Mesh Node → `Object_9` |
| 26 | `cube_11` | Mesh 包装节点 |
| 27 | `Object_27` | Mesh Node → `Object_10` |
| 28 | `cube_12` | Mesh 包装节点 |
| 29 | `Object_29` | Mesh Node → `Object_11` |
| 30 | `3_17` | 逻辑零件 3，动画目标 |
| 31 | `cube_14` | Mesh 包装节点 |
| 32 | `Object_32` | Mesh Node → `Object_12` |
| 33 | `cube_15` | Mesh 包装节点 |
| 34 | `Object_34` | Mesh Node → `Object_13` |
| 35 | `cube_16` | Mesh 包装节点 |
| 36 | `Object_36` | Mesh Node → `Object_14` |
| 37 | `4_21` | 逻辑零件 4，动画目标 |
| 38 | `cube_18` | Mesh 包装节点 |
| 39 | `Object_39` | Mesh Node → `Object_15` |
| 40 | `cube_19` | Mesh 包装节点 |
| 41 | `Object_41` | Mesh Node → `Object_16` |
| 42 | `cube_20` | Mesh 包装节点 |
| 43 | `Object_43` | Mesh Node → `Object_17` |
| 44 | `5_25` | 逻辑零件 5，动画目标 |
| 45 | `cube_22` | Mesh 包装节点 |
| 46 | `Object_46` | Mesh Node → `Object_18` |
| 47 | `cube_23` | Mesh 包装节点 |
| 48 | `Object_48` | Mesh Node → `Object_19` |
| 49 | `cube_24` | Mesh 包装节点 |
| 50 | `Object_50` | Mesh Node → `Object_20` |
| 51 | `6_27` | 逻辑零件 6，动画目标 |
| 52 | `cube_26` | Mesh 包装节点 |
| 53 | `Object_53` | Mesh Node → `Object_21` |

## 4. 六个独立零件检查

**存在六个独立的逻辑零件，但不是六个独立 Mesh。** 六个零件是 `_28` 的直接子节点，均能作为整体独立平移/旋转，且两段动画直接以它们为目标。

| 零件节点 | 世界坐标下长轴 | 子 Mesh 数 | 静态世界尺寸（m） |
|---|---|---:|---|
| `[4] 1_6` | X | 6 | 0.931118 × 0.116390 × 0.116390 |
| `[17] 2_13` | X | 6 | 0.931118 × 0.116390 × 0.116390 |
| `[30] 3_17` | Y | 3 | 0.116390 × 0.931118 × 0.116390 |
| `[37] 4_21` | Y | 3 | 0.116390 × 0.931118 × 0.116390 |
| `[44] 5_25` | Z | 3 | 0.116390 × 0.116390 × 0.931118 |
| `[51] 6_27` | Z | 1 | 0.116390 × 0.116390 × 0.931118 |

对网站交互而言，可以直接以这六个节点作为点击、拖动、拆解和高亮对象。若前端代码期望“六个 Mesh”，则当前文件不满足该假设，应在 Blender 中把每个零件组内的几何合并为一个 Mesh，同时保留六个零件父节点。

## 5. 动画

文件包含两段动画，名称大小写如下：

| 动画名称 | 关键帧时间范围 | 通道数 | 目标零件 | 插值 |
|---|---:|---:|---|---|
| `Disassemble` | 0.0–10.0 s | 10 | 六个零件全部覆盖 | LINEAR |
| `Assemble` | 0.5–8.5 s | 10 | 六个零件全部覆盖 | LINEAR |

补充说明：

- `Disassemble` 的名义时长是 10.0 s。
- `Assemble` 的关键帧运动跨度是 8.0 s；由于最早关键帧从 0.5 s 开始，大多数引擎会把 clip 结束时间视为 8.5 s，并在开始处保持首帧约 0.5 s。
- 两段动画各自作用于节点 `1_6`、`2_13`、`3_17`、`4_21`、`5_25`、`6_27`。
- 两段动画的对应通道端点相互反向；`Assemble` 的结束值与文件的静态组装变换一致。
- 因此，`Assemble` 和 `Disassemble` 不只是同名空动画，数据有效。

## 6. 材质和贴图

### 材质

仅有一个材质：`material_0`。22 个 Primitive 全部使用它。

| 属性 | 当前值 |
|---|---|
| PBR metallic | `0.0` |
| PBR roughness | 未显式写入，glTF 默认值为 `1.0` |
| Base color | 使用纹理索引 0 |
| Alpha mode | `MASK` |
| Alpha cutoff | `0.05` |
| Double sided | `true` |
| Normal / occlusion / emissive texture | 无 |

### 贴图

- 1 张内嵌 PNG：bufferView 名称 `material_0_baseColor.png`
- 分辨率：128 × 16 px
- 内嵌数据大小：210 bytes
- 图像模式：索引色，无 Alpha 通道
- 实际包含 7 种 RGB 颜色；主要是黑色和六种高饱和颜色
- 采样：`NEAREST` 放大、`NEAREST` 缩小、S/T 均为 `CLAMP_TO_EDGE`

这是一张极小的颜色调色板贴图，不是木纹贴图。它对体积和显存几乎没有压力，适合彩色教学模型；如果网站目标是写实木质鲁班锁，则需要重新制作木纹 PBR 材质。

因为贴图没有 Alpha，当前的 `MASK` + `alphaCutoff` 没有实际作用。若确认所有外表面法线正确且几何闭合，建议改为 `OPAQUE` 并关闭 `Double Sided`，可减少移动端透明裁切和双面片元处理开销。

## 7. 整体尺寸和单位

glTF 2.0 不在本文件中另存自定义单位字段；按 glTF 约定，线性距离按米解释。默认静态组装状态、包含全部节点变换后的世界坐标 AABB 为：

| 项目 | X | Y | Z |
|---|---:|---:|---:|
| 最小值（m） | -0.465559 | -0.407364 | -0.465559 |
| 最大值（m） | 0.465559 | 0.523754 | 0.467499 |
| 尺寸（m） | 0.931118 | 0.931118 | 0.933058 |
| 尺寸（mm） | 931.118 | 931.118 | 933.058 |

包围盒中心约为 `(0.000000, 0.058195, 0.000970) m`，并未精确位于世界原点。外层 `Sketchfab_model` 节点含统一比例 `0.9311183095` 和坐标轴旋转。

### 缩放到整体最大尺寸 75 mm

以“组装模型的最大包围盒尺寸应为 75 mm”为目标：

```text
统一缩放系数 = 75 / 933.057945 = 0.0803808599
统一缩放百分比 = 8.03808599%
```

应对整个模型统一乘以 **0.08038086**。如果直接修改最外层 `Sketchfab_model` 的现有统一比例，则其 `0.9311183095` 应变为约 **0.0748440904**。

### 如果“75 mm”指单根零件的长轴

每根零件当前长轴是 931.118309 mm。若产品规格中的 75 mm 指单根零件长度，而不是整个组装包围盒，则应使用：

```text
统一缩放系数 = 75 / 931.118309 = 0.0805483033
```

此时外层现有统一比例恰好变为 `0.075`。本报告默认采用上一节的“整体最大尺寸 75 mm”解释。

## 8. 摄像机、灯光和多余对象

- Camera：无 `cameras` 数组，也无 Node 引用 camera。
- Light：无 `KHR_lights_punctual`，也没有其他灯光扩展。
- Skin / 骨骼：无。
- 多余导出层级：有。

可视为导出包装层的节点包括：

- `Sketchfab_model`
- `root`
- `GLTF_SceneRootNode`
- `_28`
- 22 个 `cube_*` 中间节点

这些节点并非全部可以直接删除：`Sketchfab_model`、`GLTF_SceneRootNode` 以及部分 `cube_*` 节点带有旋转、比例或平移。清理层级时必须先把静态变换烘焙到对应几何或新的根节点，并在两段动画中复测六个零件的位置。

理想的网页运行时层级可简化为：

```text
LB_Root
├─ LB_Part_01_X_A → LB_Part_01_X_A_Geo
├─ LB_Part_02_X_B → LB_Part_02_X_B_Geo
├─ LB_Part_03_Y_A → LB_Part_03_Y_A_Geo
├─ LB_Part_04_Y_B → LB_Part_04_Y_B_Geo
├─ LB_Part_05_Z_A → LB_Part_05_Z_A_Geo
└─ LB_Part_06_Z_B → LB_Part_06_Z_B_Geo
```

## 9. 手机网页性能判断

**性能方面非常适合手机网页。**

- 总文件仅 47.1 KiB。
- 528 个位置顶点，264 个三角形。
- 1 个材质、1 张 128 × 16 的极小贴图。
- 无骨骼、无 Morph、无大图、无摄像机/灯光资产。
- 动画关键帧总量很低：`Disassemble` 45 组时间键，`Assemble` 44 组时间键。

当前潜在运行时成本主要不是下载量或面数，而是 22 个 Mesh Node 可能形成约 22 次绘制。这个数量本身仍很低；若要做到最干净的交互结构，可按六个逻辑零件合并到 6 个 Mesh，把绘制对象和命中测试对象都降到六个。文件已经足够小，没有必要仅为体积引入 Draco 压缩及其移动端解码成本。

## 10. Blender 中需要修改的具体项目

### 上线前必须处理

1. **统一物理尺寸。** 若目标是整体最大尺寸 75 mm，对最外层根对象统一乘以 `0.0803808599`；不要分别缩放六个动画零件。
2. **确认 Blender 单位。** 建议 Scene Units 使用 Metric、Unit Scale `1.0`，显示单位可设为 Millimeters；导出前确认世界尺寸最大值是 `0.075 m`。
3. **重命名六个动画零件。** 前端应使用稳定、可读的节点名，避免依赖 `1_6`、`2_13` 等导出编号。
4. **复测动画。** 缩放和层级调整后分别播放 `Assemble` 与 `Disassemble`，确认六个零件没有跳帧、错位或父级比例叠加。
5. **设置 AR 放置原点。** 建议只移动统一根节点，使组装模型水平居中并让底面落在地面原点；不要直接改六个动画目标节点的静态变换。

### 推荐优化

6. **每个零件合并为一个 Mesh。** 在每个零件组内合并子几何，最终保留六个可独立选择的 Mesh/零件；不要把六个零件合成一个 Mesh。
7. **清理 Sketchfab 包装节点。** 烘焙静态坐标变换后，将四层根容器整理为一个 `LB_Root`。不要在未烘焙变换时直接删除带矩阵的节点。
8. **优化材质透明设置。** 若法线检查正常，将材质 Blend Mode 改为 Opaque，并启用背面剔除；然后从正反方向检查是否丢面。
9. **按视觉目标决定材质。** 彩色教学版可保留当前调色板贴图；写实产品版应新增木纹 Base Color、Normal 和 Roughness，并控制移动端贴图分辨率。
10. **保持动画名称精确。** 导出 Action/NLA 时继续使用 `Assemble` 与 `Disassemble`，前端按这两个精确名称查找 clip。
11. **导出后再审计。** 用导出的新 GLB 重新检查节点名、六零件数量、尺寸、动画列表和材质，避免 Blender 导出选项改变层级或漏掉动画。

## 11. 重命名建议

当前六个零件节点的名字勉强可用于动画，但不适合作为长期 API。建议采用只含 ASCII、无空格、能反映长轴和配对关系的命名：

| 当前节点名 | 建议零件名 | 合并后几何名 |
|---|---|---|
| `1_6` | `LB_Part_01_X_A` | `LB_Part_01_X_A_Geo` |
| `2_13` | `LB_Part_02_X_B` | `LB_Part_02_X_B_Geo` |
| `3_17` | `LB_Part_03_Y_A` | `LB_Part_03_Y_A_Geo` |
| `4_21` | `LB_Part_04_Y_B` | `LB_Part_04_Y_B_Geo` |
| `5_25` | `LB_Part_05_Z_A` | `LB_Part_05_Z_A_Geo` |
| `6_27` | `LB_Part_06_Z_B` | `LB_Part_06_Z_B_Geo` |

其他建议名称：

- 根节点：`LB_Root`
- 材质：`MAT_Luban_ColorPalette`
- 贴图：`TEX_Luban_ColorPalette`
- 动画：保留 `Assemble`、`Disassemble`

如果前端已经按旧名称绑定动画或交互逻辑，重命名后必须同步更新代码或导出映射。

## 12. 数据一致性与来源备注

只读结构检查未发现以下问题：越界的节点/Mesh/Accessor 引用、超出顶点范围的索引、非有限顶点、非递增动画时间、关键帧数量不匹配或非单位四元数。该结果是针对文件内部数据的专项检查，不等同于 Khronos 官方 glTF Validator 的完整规范验证。

GLB 的 `asset.extras` 内嵌了以下来源信息：

- 作者：LinLUCAS
- 标题：Lu Ban Lock 鲁班锁
- 来源：<https://sketchfab.com/3d-models/lu-ban-lock-d7abd39400044c47981fe94565301aa3>
- 许可：CC BY 4.0

用于公开网站时，应保留并展示相应署名；本报告仅转述文件内嵌的许可元数据，未对许可状态做外部核验。
