# 鲁班锁手机 3D/AR 模型优化设计

## 状态

- 设计日期：2026-07-31
- 状态：方案 1 及追加实施规则已由用户批准
- 选定方案：外层安全包装，不重建动画层级
- 视觉方向：浅色榉木 / 白橡
- 贴图来源：Poly Haven `oak_veneer_01`，CC0，1K

## 目标

在不修改原始 `C:\Users\Ocean\Downloads\lu_ban_lock.glb` 的前提下，通过 Blender MCP 生成适合手机端 3D/AR 网站的新模型。新模型的静态组装状态最大尺寸为 75 mm，具有稳定的六零件节点名、正确的 AR 放置原点、保留且可播放的 `Assemble` / `Disassemble` 动画，以及轻量的浅色木纹 Base Color、Normal 和 Roughness PBR 贴图。

## 非目标

- 不覆盖或修改原始 GLB。
- 不把 22 个子 Mesh 合并为 6 个 Mesh。
- 不删除现有 Sketchfab 导出包装节点。
- 不重制动画路径、时序或运动方式。
- 不增加摄像机、灯光、骨骼、Morph target 或高模细节。
- 不制作彩色教学材质、写实端面木纹或多材质变体。

## 输入与输出

### 输入

- `C:\Users\Ocean\Downloads\lu_ban_lock.glb`
- Poly Haven 纹理：`oak_veneer_01`

### 输出

- `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.blend`
- `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.temp.glb`（验证前临时文件）
- `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.glb`
- `C:\Users\Ocean\Documents\榫卯\outputs\validation\lu_ban_lock_mobile_ar.validation.json`
- `C:\Users\Ocean\Documents\榫卯\outputs\validation\lu_ban_lock_mobile_ar.validation.md`

正式 GLB 只能由已通过全部验证的 `.temp.glb` 在同一目录内原子重命名产生。若验证失败，不创建正式 GLB 文件名；改为保留带时间戳的诊断 Blend、临时 GLB、JSON 报告和 Markdown 报告。任何输出均不得覆盖已有同名文件。

## 方案选择

### 方案 1：外层安全包装（采用）

导入原模型后，在现有 `Sketchfab_model` 之上新增 `LB_AR_Root`。尺寸、水平居中和落地全部由这一层处理。六个原动画目标节点只重命名，不改变它们的位置、旋转、缩放、关键帧或父子关系。

优点：对现有父级矩阵和动画影响最小，容易回退和验证。缺点：继续保留 22 个子 Mesh 与 Sketchfab 包装层级。

### 方案 2：原层级直接清理（未采用）

直接修改现有根节点并烘焙/删除包装节点。运行层级较简洁，但更容易产生父级矩阵叠加、动画跳变或导出坐标错误。

### 方案 3：重建六个 Mesh（未采用）

把每个逻辑零件的子几何合并后重新整理动画绑定。运行时结构最干净，但属于更高风险的结构性重制，不在本次范围内。

## 轻量导入门禁

导入源 GLB 后、执行任何缩放、重命名、UV、材质下载或材质修改之前，只做以下轻量检查：

1. 确认对象 `1_6`、`2_13`、`3_17`、`4_21`、`5_25`、`6_27` 全部存在且名称唯一。
2. 记录 Blender 的实际动画组织方式：
   - `bpy.data.actions` 中每个 Action 的名称、frame range、用户数、FCurve 数和目标数据路径；
   - 六个目标对象各自的 `animation_data.action`；
   - 每个目标对象的 NLA track、strip 名称、Action 引用和 frame range。
3. 尝试分别激活并播放/求值 `Assemble` 与 `Disassemble` 的起点和终点，确认六个对象的变换可正常求值且为有限数值。
4. Blender glTF 导入器把一个源 clip 表示为多个对象级 Action 或 NLA strip 本身不判为失败；只有当这些 Action/strip 无法按 `Assemble`、`Disassemble` 重新关联为覆盖六个目标对象的完整 clip 时，才视为异常拆分。
5. 出现任一以下情况立即停止，不进入任何修改步骤：
   - 六个目标对象缺失、重复或类型异常；
   - `Assemble` 或 `Disassemble` 丢失；
   - 任一 clip 缺少应有的零件通道；
   - Action/NLA 关系无法确定、clip 无法激活或无法求值；
   - 求值产生 NaN、无穷、零比例、异常跳变或 Blender 播放错误。

导入门禁的记录必须写入最终验证报告；若门禁失败，则写入失败报告和诊断 Blend，并停止。由于门禁发生在导出前，此类失败不会产生临时 GLB。

## 场景和单位设计

1. 清空 Blender 当前场景后导入源 GLB。
2. 将 Scene Unit System 设置为 `METRIC`，Unit Scale 设置为 `1.0`，Length 设置为 `MILLIMETERS`。
3. 在所有现有顶层对象之上新增 Empty：`LB_AR_Root`。
4. 将原顶层对象父级设为 `LB_AR_Root`，保持父级创建前的世界变换。
5. 对 `LB_AR_Root` 使用审计已确认的统一缩放系数 `0.0803808599`。实施时不得重新推导或替换该系数，也不得分别缩放六个动画零件。
6. 在静态组装状态计算全部 Mesh 的世界坐标包围盒；此计算只用于根级居中、落地和最终尺寸验证，不用于重新计算缩放系数。
7. 缩放后再次计算包围盒，以 Blender Z 轴为竖直轴：
   - 根节点在 X/Y 方向平移包围盒中心的相反数，使模型水平居中；
   - 根节点在 Z 方向平移包围盒最小值的相反数，使底面位于 `Z=0`；
   - 不直接修改六个动画目标节点的静态变换。
8. Blender 内最终静态组装包围盒必须满足：最大尺寸 `0.075 m ± 0.00001 m`、`min Z = 0 ± 0.00001 m`、X/Y 水平中心均为 `0 ± 0.00001 m`。

`LB_AR_Root` 可以保留非 1 的统一缩放；这是为了避免把缩放烘焙到带动画的子节点。导出的 glTF 世界尺寸仍必须正确。

## 零件命名设计

只重命名六个动画目标对象，不更改它们的数据块、父子关系或动画数据：

| 原名称 | 新名称 |
|---|---|
| `1_6` | `LB_Part_01_X_A` |
| `2_13` | `LB_Part_02_X_B` |
| `3_17` | `LB_Part_03_Y_A` |
| `4_21` | `LB_Part_04_Y_B` |
| `5_25` | `LB_Part_05_Z_A` |
| `6_27` | `LB_Part_06_Z_B` |

重命名后必须确认动画仍以这六个对象为目标。动作/动画名称继续保持 `Assemble` 和 `Disassemble`，大小写不得改变。

## 木纹材质设计

### 来源和分辨率

- Poly Haven 资产 ID：`oak_veneer_01`
- 下载分辨率：`1k`
- 许可：CC0
- 官方页面：<https://polyhaven.com/a/oak_veneer_01>

通过 Blender MCP 下载材质，使用 Poly Haven 提供的 Base Color/Diffuse、OpenGL Normal 和 Roughness 数据。不得下载 2K、4K、8K 或 16K 版本。

### 材质设置

创建或整理为一个共享材质：`MAT_LB_LightOak`，并赋给全部 22 个 Mesh。

- Base Color：sRGB
- Normal：Non-Color，经 Normal Map 节点连接到 Principled BSDF Normal
- Roughness：Non-Color，连接到 Principled BSDF Roughness
- Metallic：`0.0`
- Alpha/Surface Render Method：Opaque
- Backface Culling：启用
- Normal strength：以 Poly Haven 导入默认值为起点，限制为不会在 75 mm 模型上产生夸张沟槽的细腻效果
- 纹理坐标链路：显式使用一个 UV Map 节点读取 `LB_WoodUV`，再连接到一个共享 Mapping 节点；Base Color、Normal、Roughness 三个 Image Texture 的 Vector 输入必须来自同一个 Mapping 输出

### UV 设计

现有 UV 只服务于 128 × 16 调色板，不适合木纹。为全部 Mesh 新建 UV 层 `LB_WoodUV`，保留原 UV 层但把 `LB_WoodUV` 设为活动渲染 UV。

UV 根据每个逻辑零件的统一局部坐标生成，使纹理沿零件长轴连续。六个零件的世界长轴虽为 X/Y/Z，但其子几何必须先转换到所属 `LB_Part` 的同一逻辑零件坐标系，再按统一尺度写入 UV。禁止对 22 个子 Mesh 分别独立归一化、分别执行 `Smart UV Project` 或分别把各自包围盒映射到 0–1。相邻子 Mesh 必须共享同一逻辑零件坐标范围，避免每个小块从 UV 原点重新开始造成纹理接缝和尺度变化。

木纹尺度以手机屏幕可读性为优先：单根约 75 mm 长轴上保留清晰但不过密的连续纹理。端面继续使用同一纹理投影，不增加第二套端面材质。

## 动画保留与验证

### Blender 内验证

对 `Assemble` 和 `Disassemble` 分别执行以下检查：

1. 确认六个新名称对象都拥有对应动画通道。
2. 在 clip 的起点、终点和至少每 0.1 s 的采样点计算六对象世界矩阵。
3. 所有矩阵值必须为有限数值；不得出现 NaN、无穷或零比例。
4. 检查相邻采样的平移与旋转变化；若出现不符合相邻关键帧线性插值的瞬间跳变，则停止导出。
5. `Assemble` 终点必须回到静态组装姿态。
6. `Disassemble` 起点必须与静态组装姿态一致。
7. 根级缩放必须只出现一次，不得在六个零件上产生重复缩放。
8. 重新记录 Scene Units、22 个 Mesh、264 个三角形、Action/NLA 结构和材质节点链路。
9. 静态组装姿态必须满足 Blender Z-up 坐标规则：`min Z = 0`，X/Y 水平居中。

### 导出后验证

重新读取 `lu_ban_lock_mobile_ar.temp.glb` 并确认：

- 动画名称恰好包含 `Assemble` 和 `Disassemble`；
- 两段动画都覆盖六个重命名零件；
- 动画输入时间递增，输出数量与输入关键帧数量匹配；
- 四元数为有限值并保持单位长度容差；
- 静态组装世界包围盒最大尺寸为 `0.075 m ± 0.00001 m`；
- glTF/GLB 采用 Y-up；包围盒必须满足 `min Y = 0 ± 0.00001 m`，X/Z 水平中心均为 `0 ± 0.00001 m`；
- Mesh 数量仍为 22，三角形数量仍为 264；
- 所有 Mesh 均引用木纹材质；
- Base Color、Normal、Roughness 贴图存在且最大边不超过 1024 px；
- 无摄像机和灯光被意外加入。

验证报告必须同时记录：

- Blender 导入后的 Action/NLA 组织方式；
- Blender 内 Z-up 尺寸、中心和 `min Z`；
- 导出 GLB 后 Y-up 尺寸、中心和 `min Y`；
- 六零件名称、22 个 Mesh、264 个三角形和两段动画；
- 材质节点、UV Map 名称和三张纹理的尺寸/色彩空间；
- 原作者 `LinLUCAS`；
- 模型名称 `Lu Ban Lock 鲁班锁`；
- 许可 `CC BY 4.0`；
- 原始 Sketchfab 来源 `https://sketchfab.com/3d-models/lu-ban-lock-d7abd39400044c47981fe94565301aa3`；
- 优化内容是对上述第三方模型的尺寸、命名、原点、UV 和材质处理，不得描述为完全原创模型。

## 导出设置

使用 Blender glTF 2.0 导出器先输出临时单文件 GLB：

- Format：GLB
- Include：当前场景中的模型对象
- Transform：遵循 glTF 标准坐标转换
- Materials：Export
- Images：自动嵌入 GLB
- Animations：启用，导出所有相关 Actions/NLA tracks
- Shape Keys / Skinning：无需额外启用
- Draco：不启用；模型几何本身极小，避免增加移动端解码依赖

导出前先保存 `.blend`。临时导出路径固定为 `outputs\lu_ban_lock_mobile_ar.temp.glb`。导出目标存在时先停止并报告，不静默覆盖。

临时 GLB 通过全部导出后验证后，确认正式路径不存在，再在同一 `outputs` 目录内将临时文件原子重命名为 `lu_ban_lock_mobile_ar.glb`。验证失败时不得创建正式文件名。

## 错误处理和回退

- Blender MCP 无法连接：停止并请用户恢复 MCP 连接。
- 找不到六个原节点：停止，不按名称猜测其他对象。
- 找不到 `Assemble` 或 `Disassemble`：停止，不导出无动画版本。
- Poly Haven 下载失败或缺少 Base Color、Normal、Roughness：停止，不以程序化材质替代已批准方案。
- 1K 贴图实际尺寸超过 1024 px：在 Blender 内复制并缩小到最长边 1024 px，再连接缩小后的图像。
- 动画验证、尺寸验证、原点验证、UV/材质验证或拓扑计数验证失败：
  - 保存 `outputs\diagnostics\lu_ban_lock_mobile_ar.<YYYYMMDD-HHMMSS>.diagnostic.blend`；
  - 若临时 GLB 已经产生，将其保留为 `outputs\diagnostics\lu_ban_lock_mobile_ar.<YYYYMMDD-HHMMSS>.temp.glb`；导入门禁失败时禁止为满足此项而继续导出；
  - 输出同一时间戳的 `.validation.json` 和 `.validation.md`；
  - 不创建 `lu_ban_lock_mobile_ar.glb`。
- 成功时也输出固定名称的 JSON 和 Markdown 验证报告，然后才原子重命名临时 GLB。
- 任一步骤均不得写入源 GLB 路径。

## 验收标准

只有同时满足以下条件才算完成：

1. 原始 GLB 的 SHA-256 仍为 `8E215A86264DAFC2A3A9CF43406E2DB2470EEF0A150264DB91E98EB8BD655A5B`。
2. 输出 `.blend`、正式 `.glb`、JSON 验证报告和 Markdown 验证报告均存在于规定目录，且 `.temp.glb` 已通过原子重命名消失。
3. Scene Units 为 Metric / Unit Scale 1.0 / Millimeters。
4. 输出 GLB 最大静态组装尺寸为 `0.075 m ± 0.00001 m`。
5. Blender 内满足 Z-up：`min Z=0`、X/Y 居中；GLB 内满足 Y-up：`min Y=0`、X/Z 居中。
6. 六个目标节点使用批准的新名称。
7. `Assemble` 和 `Disassemble` 均存在、覆盖六个零件并通过连续性检查。
8. 22 个 Mesh 和 264 个三角形仍保留，且全部使用 `MAT_LB_LightOak`。
9. 材质显式使用 `LB_WoodUV` →共享 Mapping 链路，Base Color、Normal、Roughness 共用该链路；GLB 内三张贴图最长边均不超过 1024 px。
10. 输出不含摄像机、灯光、骨骼或 Morph target。
11. 未静默覆盖任何已有输出文件。
12. 验证报告完整记录来源作者、模型名、CC BY 4.0 许可和原始 Sketchfab URL，且未把优化模型描述为完全原创。
