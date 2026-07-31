# Lu Ban Lock Mobile AR Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a non-destructive Blender source file and validated mobile/AR GLB whose assembled maximum dimension is 75 mm, whose AR origin is grounded and centered, whose six animation targets have stable names, and whose 22 Meshes share a 1K light-oak PBR material.

**Architecture:** Keep the imported Sketchfab hierarchy and all 22 Meshes intact, add one outer `LB_AR_Root`, and perform all scale/placement changes at that root. Drive Blender through small Blender MCP checkpoints backed by a reusable Blender-side script; validate the temporary GLB independently with a local parser before atomically publishing the final filename.

**Tech Stack:** Blender Python API (`bpy`, `mathutils`), Blender MCP, Poly Haven MCP integration, glTF 2.0/GLB, Python 3.13, NumPy, Pillow, `unittest`.

---

## File map

- Create: `C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py` — Blender-only import gate, scene modification, UV/material setup, Blender validation, diagnostic save, and temporary export functions.
- Create: `C:\Users\Ocean\Documents\榫卯\scripts\validate_luban_glb.py` — independent GLB parser, post-export validator, JSON/Markdown report writer, failure preservation, and atomic publisher.
- Create: `C:\Users\Ocean\Documents\榫卯\tests\__init__.py` — test package marker.
- Create: `C:\Users\Ocean\Documents\榫卯\tests\test_validate_luban_glb.py` — validator and atomic-publish tests.
- Modify: `C:\Users\Ocean\Documents\榫卯\docs\superpowers\specs\2026-07-31-luban-lock-mobile-ar-design.md` — mark the approved specification status.
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.blend` — editable optimized Blender scene.
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.temp.glb` — validation-only export.
- Generate on success: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.glb` — atomically published final model.
- Generate on success: `C:\Users\Ocean\Documents\榫卯\outputs\validation\lu_ban_lock_mobile_ar.validation.json` and `.md` — machine-readable and human-readable evidence.
- Generate on failure: timestamped `.diagnostic.blend`, `.temp.glb` when available, `.validation.json`, and `.validation.md` under `outputs\diagnostics`.

## Fixed constants and contracts

All implementation files must use these exact names and values:

```python
SOURCE_GLB = r"C:\Users\Ocean\Downloads\lu_ban_lock.glb"
SOURCE_SHA256 = "8E215A86264DAFC2A3A9CF43406E2DB2470EEF0A150264DB91E98EB8BD655A5B"
OUTPUT_DIR = r"C:\Users\Ocean\Documents\榫卯\outputs"
BLEND_PATH = OUTPUT_DIR + r"\lu_ban_lock_mobile_ar.blend"
TEMP_GLB_PATH = OUTPUT_DIR + r"\lu_ban_lock_mobile_ar.temp.glb"
FINAL_GLB_PATH = OUTPUT_DIR + r"\lu_ban_lock_mobile_ar.glb"
UNIFORM_SCALE = 0.0803808599
SIZE_TARGET_M = 0.075
TOLERANCE_M = 0.00001
WOOD_ASSET_ID = "oak_veneer_01"
WOOD_RESOLUTION = "1k"
UV_MAP_NAME = "LB_WoodUV"
MATERIAL_NAME = "MAT_LB_LightOak"
ROOT_NAME = "LB_AR_Root"
OLD_TO_NEW = {
    "1_6": "LB_Part_01_X_A",
    "2_13": "LB_Part_02_X_B",
    "3_17": "LB_Part_03_Y_A",
    "4_21": "LB_Part_04_Y_B",
    "5_25": "LB_Part_05_Z_A",
    "6_27": "LB_Part_06_Z_B",
}
LICENSE_INFO = {
    "author": "LinLUCAS",
    "model": "Lu Ban Lock 鲁班锁",
    "license": "CC BY 4.0",
    "source": "https://sketchfab.com/3d-models/lu-ban-lock-d7abd39400044c47981fe94565301aa3",
    "originality": "Optimized derivative; not an entirely original model.",
}
```

`UNIFORM_SCALE` is an audited fixed input. The implementation must not derive, recompute, optimize, or replace it from imported bounds; bounds are used only for centering, grounding, and pre/post-export verification.

### Task 1: Add the independent validator with failing tests

**Files:**
- Create: `C:\Users\Ocean\Documents\榫卯\tests\__init__.py`
- Create: `C:\Users\Ocean\Documents\榫卯\tests\test_validate_luban_glb.py`
- Create: `C:\Users\Ocean\Documents\榫卯\scripts\validate_luban_glb.py`

- [ ] **Step 1: Create the test package marker**

Create an empty `tests/__init__.py` using `apply_patch`.

- [ ] **Step 2: Write validator tests before implementation**

Create `tests/test_validate_luban_glb.py` with these exact behavioral assertions:

```python
import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_luban_glb import (
    SOURCE_SHA256,
    analyze_glb,
    atomic_publish,
    build_markdown,
    validate_mobile_ar,
)

SOURCE = Path(r"C:\Users\Ocean\Downloads\lu_ban_lock.glb")


class ValidatorTests(unittest.TestCase):
    def test_source_facts_match_audit(self):
        result = analyze_glb(SOURCE)
        self.assertEqual(result["sha256"], SOURCE_SHA256)
        self.assertEqual(result["node_count"], 54)
        self.assertEqual(result["mesh_count"], 22)
        self.assertEqual(result["triangle_count"], 264)
        self.assertEqual(result["animation_names"], ["Disassemble", "Assemble"])

    def test_source_fails_mobile_ar_acceptance(self):
        result = validate_mobile_ar(SOURCE)
        self.assertFalse(result["ok"])
        self.assertIn("maximum dimension is not 0.075 m", result["errors"])
        self.assertIn("required renamed part nodes are missing", result["errors"])
        self.assertIn("required wood PBR material is missing", result["errors"])

    def test_markdown_records_third_party_source(self):
        report = build_markdown({"ok": False, "errors": ["fixture"], "warnings": []})
        self.assertIn("LinLUCAS", report)
        self.assertIn("Lu Ban Lock 鲁班锁", report)
        self.assertIn("CC BY 4.0", report)
        self.assertIn("d7abd39400044c47981fe94565301aa3", report)
        self.assertIn("not an entirely original model", report)

    def test_atomic_publish_refuses_existing_final(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            temp = root / "asset.temp.glb"
            final = root / "asset.glb"
            temp.write_bytes(b"temp")
            final.write_bytes(b"existing")
            with self.assertRaises(FileExistsError):
                atomic_publish(temp, final)
            self.assertEqual(temp.read_bytes(), b"temp")
            self.assertEqual(final.read_bytes(), b"existing")

    def test_atomic_publish_renames_within_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            temp = root / "asset.temp.glb"
            final = root / "asset.glb"
            temp.write_bytes(b"validated")
            atomic_publish(temp, final)
            self.assertFalse(temp.exists())
            self.assertEqual(final.read_bytes(), b"validated")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the tests and verify the expected import failure**

Run:

```powershell
python -m unittest -v tests.test_validate_luban_glb
```

Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.validate_luban_glb'`.

- [ ] **Step 4: Implement the GLB parser and validator**

Create `scripts/validate_luban_glb.py` with these public functions and exact contracts:

```python
def analyze_glb(path: Path) -> dict:
    """Return SHA-256, GLB header/chunks, nodes, meshes, triangles, animations,
    materials, images, texture sizes, cameras/lights, and transformed scene bounds."""

def validate_mobile_ar(path: Path, blender_stage: dict | None = None) -> dict:
    """Return {'ok', 'errors', 'warnings', 'analysis', 'blender_stage', 'license'}.
    Enforce 22 Meshes, 264 triangles, six renamed part nodes, exact animation names,
    0.075 m max dimension, Y-up min Y=0, X/Z centering, material/texture/UV rules,
    no camera/light/skin/morph, and texture maximum edge <=1024."""

def build_markdown(result: dict) -> str:
    """Render every acceptance check and LICENSE_INFO without claiming originality."""

def write_reports(result: dict, json_path: Path, markdown_path: Path) -> None:
    """Create parent directory, refuse existing paths, and write UTF-8 JSON/Markdown."""

def preserve_failure(temp_glb: Path, blend_path: Path, result: dict, output_dir: Path) -> dict:
    """Create one Asia/Shanghai timestamp, copy/save diagnostic Blend, move temp GLB
    if present, and write timestamped JSON/Markdown. Never create the final GLB name."""

def atomic_publish(temp_glb: Path, final_glb: Path) -> None:
    """Require same parent directory and absent final path, then call Path.replace once."""
```

Implementation requirements:

- Parse GLB header and JSON/BIN chunks with `struct` and `json`.
- Decode accessors with NumPy, including byte offsets and byte strides.
- Compose glTF column-major matrices and TRS transforms, then transform every POSITION vertex to world space.
- Count indexed triangle primitives; reject unsupported non-triangle modes.
- Read embedded images with Pillow without extracting them.
- Treat glTF axis orientation as Y-up when checking `min Y`, X/Z center, and dimensions.
- Check all accessor indices, finite numbers, increasing animation times, key-count equality, and unit quaternion tolerance.
- Inspect material JSON for one opaque, double-sided-false wood material with Base Color, Normal, and Roughness references.
- Accept packed metallic-roughness texture output as the Roughness source when the glTF exporter packs channels.
- Confirm every primitive uses the approved wood material and all required textures use one `texCoord` index and equivalent texture transform.
- Merge `blender_stage` evidence into both reports.

- [ ] **Step 5: Run the validator unit tests**

Run:

```powershell
python -m unittest -v tests.test_validate_luban_glb
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit the validator**

```powershell
git add scripts/validate_luban_glb.py tests/__init__.py tests/test_validate_luban_glb.py
git commit -m "test: add GLB mobile AR validator"
```

### Task 2: Implement and run the Blender lightweight import gate

**Files:**
- Create: `C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py`
- Generate on gate failure only: `C:\Users\Ocean\Documents\榫卯\outputs\diagnostics\*`

- [ ] **Step 1: Write the Blender pipeline constants and import-gate functions**

Create `scripts/luban_blender_pipeline.py` with the fixed constants above and these functions:

```python
def require_blender() -> None:
    if bpy.app.background:
        raise RuntimeError("Blender UI/MCP session is required")

def preflight_paths() -> None:
    # Verify SOURCE_GLB SHA-256 exactly.
    # Create outputs/validation and outputs/diagnostics.
    # Refuse BLEND_PATH, TEMP_GLB_PATH, and FINAL_GLB_PATH if any already exists.

def collect_action_nla() -> dict:
    # Return every Action name/frame range/user count/FCurve path and every object's
    # active Action plus NLA track/strip/action/frame-range organization.

def set_imported_clip(name: str) -> tuple[float, float]:
    # Across all animation_data owners, unmute tracks/strips associated with name,
    # mute the other imported clip, and return the union frame range.

def finite_world_matrix(obj: bpy.types.Object) -> bool:
    return all(math.isfinite(v) for row in obj.matrix_world for v in row)

def save_gate_failure(reason: str, evidence: dict) -> None:
    # Use one YYYYMMDD-HHMMSS Asia/Shanghai timestamp.
    # Save diagnostic Blend plus JSON and Markdown; do not export any GLB.

def reset_import_and_gate() -> dict:
    # Clear objects/data from the current scene, import SOURCE_GLB, and only then:
    # require the six exact old names uniquely; collect Action/NLA evidence;
    # require both clips to reconstruct across all six targets; evaluate clip endpoints;
    # stop via save_gate_failure() on any missing/ambiguous/non-finite/playback failure.
```

The import gate must not set units, create `LB_AR_Root`, rename objects, download a material, alter UVs, or save the normal output Blend.

- [ ] **Step 2: Load the script and run only the import gate through Blender MCP**

Call `mcp__blender__execute_blender_code` with:

```python
from pathlib import Path
pipeline_path = Path(r"C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py")
namespace = {"__name__": "luban_blender_pipeline"}
exec(compile(pipeline_path.read_text(encoding="utf-8"), str(pipeline_path), "exec"), namespace)
result = namespace["reset_import_and_gate"]()
print(namespace["json"].dumps(result, ensure_ascii=False, indent=2))
```

Expected MCP output:

- six exact source objects are present;
- `Assemble` and `Disassemble` are reconstructible and endpoint evaluation succeeds;
- Action and NLA organization is printed as JSON;
- `modified` is `false`.

If the gate reports failure, stop the entire plan and confirm the timestamped diagnostic outputs; do not call later tasks.

- [ ] **Step 3: Commit the gate implementation after it passes**

```powershell
git add scripts/luban_blender_pipeline.py
git commit -m "feat: add Blender animation import gate"
```

### Task 3: Add the root transform, approved names, and unified logical-part UVs

**Files:**
- Modify: `C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py`

- [ ] **Step 1: Add scene mutation helpers**

Implement these functions in `scripts/luban_blender_pipeline.py`:

```python
def mesh_descendants(part: bpy.types.Object) -> list[bpy.types.Object]:
    # Recursive descendants filtered to type == 'MESH'.

def world_bounds(mesh_objects: list[bpy.types.Object]) -> dict:
    # Evaluate every mesh bounding-box corner through matrix_world.
    # Return min, max, dimensions, center, max_dimension.

def configure_units_root_and_names() -> dict:
    # Set METRIC / 1.0 / MILLIMETERS.
    # Rename only OLD_TO_NEW targets.
    # Add LB_AR_Root above all imported top-level objects while preserving world matrices.
    # Set only LB_AR_Root scale to UNIFORM_SCALE.
    # Activate assembled pose; compute bounds only for placement/verification.
    # Translate root so X/Y center is zero and min Z is zero.

def create_logical_part_uvs() -> dict:
    # For each renamed LB_Part, gather all descendant Mesh vertices in that part's
    # common local coordinate system. Compute one part-level bounds/scale.
    # Create/replace LB_WoodUV on every descendant Mesh.
    # Project each polygon by dominant part-local normal and write loop UVs from
    # part-local coordinates using the same part-level origin and scale.
    # Never normalize one child Mesh independently.
```

For `create_logical_part_uvs`, use this exact projection rule after computing point `p` and normal `n` in the owning part's coordinate system, with `origin` and `long_length` computed once for the full logical part:

```python
x = (p.x - origin.x) / long_length
y = (p.y - origin.y) / long_length
z = (p.z - origin.z) / long_length
axis = max(range(3), key=lambda i: abs(n[i]))
uv = (z, y) if axis == 0 else ((x, z) if axis == 1 else (x, y))
```

- [ ] **Step 2: Run scene mutation through Blender MCP**

Load the script as in Task 2, then call:

```python
transform_result = namespace["configure_units_root_and_names"]()
uv_result = namespace["create_logical_part_uvs"]()
print(namespace["json"].dumps({"transform": transform_result, "uv": uv_result}, ensure_ascii=False, indent=2))
```

Expected:

- one `LB_AR_Root` with uniform scale `0.0803808599`;
- six renamed targets and none of the six old names;
- 22 Mesh objects and 264 polygons/triangles unchanged;
- every Mesh has active render UV `LB_WoodUV`;
- Blender assembled bounds report max dimension within `0.075 ± 0.00001 m`, min Z within tolerance of zero, and X/Y center within tolerance of zero.

- [ ] **Step 3: Commit the transform and UV phase**

```powershell
git add scripts/luban_blender_pipeline.py
git commit -m "feat: configure AR root and unified wood UVs"
```

### Task 4: Download and bind the approved 1K Poly Haven material

**Files:**
- Modify: `C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py`

- [ ] **Step 1: Download the approved asset through Blender MCP**

Call `mcp__blender__download_polyhaven_asset` with:

```json
{
  "asset_id": "oak_veneer_01",
  "asset_type": "textures",
  "resolution": "1k",
  "file_format": "jpg"
}
```

Expected: the 1K texture asset is downloaded/imported; no 2K+ files are requested.

- [ ] **Step 2: Apply the downloaded texture once through Blender MCP**

Call `mcp__blender__set_texture` with:

```json
{
  "object_name": "Object_6",
  "texture_id": "oak_veneer_01"
}
```

Expected: `Object_6` receives a Poly Haven material containing Base Color/Diffuse, Normal GL, and Roughness image nodes.

- [ ] **Step 3: Add deterministic material binding**

Implement:

```python
def bind_mobile_wood_material(seed_object_name: str = "Object_6") -> dict:
    # Identify the three imported oak_veneer_01 images by node role and filename.
    # Fail if Base Color, Normal GL, or Roughness is ambiguous/missing.
    # Scale an in-memory copy down only when max(width, height) > 1024.
    # Build one MAT_LB_LightOak node tree with:
    # UV Map(LB_WoodUV) -> Mapping -> all three Image Texture Vector inputs;
    # Base Color sRGB; Normal/Roughness Non-Color; Normal Map strength <= 0.35;
    # Principled metallic 0; alpha 1; opaque export behavior; backface culling true.
    # Replace every Mesh material slot with this one shared material.
```

Use explicit node names:

```python
"UVMap_LB_WoodUV"
"Mapping_LB_Wood"
"TEX_LB_BaseColor"
"TEX_LB_NormalGL"
"TEX_LB_Roughness"
"NormalMap_LB"
"Principled_LB"
"MaterialOutput_LB"
```

- [ ] **Step 4: Run and inspect material binding through Blender MCP**

Load the script and call `bind_mobile_wood_material()`. Expected JSON:

- material name `MAT_LB_LightOak`;
- 22 Meshes assigned;
- UV Map node value `LB_WoodUV`;
- the three texture nodes share the same Mapping output;
- image maximum dimensions are no more than 1024;
- Base Color is sRGB; Normal/Roughness are Non-Color.

- [ ] **Step 5: Commit the material phase**

```powershell
git add scripts/luban_blender_pipeline.py
git commit -m "feat: bind 1K light oak PBR material"
```

### Task 5: Validate Blender state, save the Blend, and export only the temporary GLB

**Files:**
- Modify: `C:\Users\Ocean\Documents\榫卯\scripts\luban_blender_pipeline.py`
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.blend`
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\validation\blender-stage.json`
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.temp.glb`

- [ ] **Step 1: Implement Blender validation and temporary export**

Implement:

```python
def validate_clip_continuity(name: str, step_seconds: float = 0.1) -> dict:
    # Activate one imported NLA clip, sample start-to-end at <=0.1 s increments,
    # require finite matrices/nonzero scale, strictly increasing keys, LINEAR key
    # interpolation, and consistent source/action relationships.

def validate_blender_state() -> dict:
    # Require approved units, one root with fixed scale, six new names, 22 Meshes,
    # 264 triangles, no camera/light/armature, correct Z-up bounds, LB_WoodUV on all
    # Meshes, one shared PBR material, explicit shared UV/Mapping chain, texture sizes,
    # clip continuity, Disassemble-start == Assemble-end, and
    # Disassemble-end == Assemble-start within matrix tolerance.

def save_blend_and_export_temp() -> dict:
    # Run validate_blender_state first and save diagnostics on failure.
    # Save BLEND_PATH with bpy.ops.wm.save_as_mainfile.
    # Write blender-stage.json.
    # Export TEMP_GLB_PATH only, with GLB/materials/animations/NLA enabled and Draco off.
    # Dynamically filter exporter keyword arguments against the installed Blender RNA.
```

Use these export keyword values when supported:

```python
export_format="GLB"
export_animations=True
export_nla_strips=True
export_materials="EXPORT"
export_cameras=False
export_lights=False
export_draco_mesh_compression_enable=False
export_extras=True
```

- [ ] **Step 2: Run Blender validation without exporting**

Call `validate_blender_state()` through Blender MCP. Expected: `ok: true`, 22 Meshes, 264 triangles, 75 mm, grounded/centered Z-up bounds, both clips pass, and material/UV checks pass.

- [ ] **Step 3: Capture a viewport screenshot for visual QA**

Use `mcp__blender__get_viewport_screenshot` with `max_size: 1200`. Inspect that the model is assembled, wood grain is visible and not obviously restarting per child Mesh, and no colored palette material remains visible.

- [ ] **Step 4: Save and export the temporary GLB through Blender MCP**

Call `save_blend_and_export_temp()`. Expected: the normal Blend and `.temp.glb` exist; the formal `.glb` does not exist.

- [ ] **Step 5: Commit the completed Blender pipeline script**

```powershell
git add scripts/luban_blender_pipeline.py
git commit -m "feat: validate and export temporary Blender GLB"
```

### Task 6: Validate the temporary GLB and atomically publish

**Files:**
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\validation\lu_ban_lock_mobile_ar.validation.json`
- Generate: `C:\Users\Ocean\Documents\榫卯\outputs\validation\lu_ban_lock_mobile_ar.validation.md`
- Generate on success: `C:\Users\Ocean\Documents\榫卯\outputs\lu_ban_lock_mobile_ar.glb`
- Generate on failure: `C:\Users\Ocean\Documents\榫卯\outputs\diagnostics\*`

- [ ] **Step 1: Run independent post-export validation**

Run:

```powershell
python scripts/validate_luban_glb.py `
  --input 'outputs\lu_ban_lock_mobile_ar.temp.glb' `
  --blender-stage 'outputs\validation\blender-stage.json' `
  --json 'outputs\validation\lu_ban_lock_mobile_ar.validation.json' `
  --markdown 'outputs\validation\lu_ban_lock_mobile_ar.validation.md'
```

Expected success output includes:

```text
PASS nodes: six approved LB_Part names
PASS mesh_count: 22
PASS triangle_count: 264
PASS animations: Assemble, Disassemble
PASS size_max_m: 0.075000 within 0.000010
PASS gltf_y_up_ground: min_y=0 and center_xz=(0,0) within tolerance
PASS pbr: baseColor + normal + roughness, <=1024 px
PASS source_attribution: LinLUCAS / CC BY 4.0
VALIDATION_OK
```

If validation fails, the CLI must call `preserve_failure`, leave no formal GLB, print the timestamped diagnostic paths, and exit nonzero. Stop the plan.

- [ ] **Step 2: Publish only after validation succeeds**

Run:

```powershell
python scripts/validate_luban_glb.py `
  --publish 'outputs\lu_ban_lock_mobile_ar.temp.glb' `
  --final 'outputs\lu_ban_lock_mobile_ar.glb' `
  --require-report 'outputs\validation\lu_ban_lock_mobile_ar.validation.json'
```

Expected: one same-directory atomic rename; final GLB exists and `.temp.glb` no longer exists.

- [ ] **Step 3: Re-run analysis against the formal filename**

Run:

```powershell
python scripts/validate_luban_glb.py `
  --input 'outputs\lu_ban_lock_mobile_ar.glb' `
  --check-only
```

Expected: `VALIDATION_OK` with the same SHA-independent structural results as the validated temp file.

### Task 7: Final verification and delivery audit

**Files:**
- Verify: all generated outputs and reports
- Verify: `C:\Users\Ocean\Downloads\lu_ban_lock.glb`

- [ ] **Step 1: Run all validator tests freshly**

```powershell
python -m unittest -v tests.test_validate_luban_glb
```

Expected: all tests pass.

- [ ] **Step 2: Verify source immutability, output state, and reports**

```powershell
Get-FileHash -Algorithm SHA256 'C:\Users\Ocean\Downloads\lu_ban_lock.glb'
Get-Item 'outputs\lu_ban_lock_mobile_ar.blend','outputs\lu_ban_lock_mobile_ar.glb','outputs\validation\lu_ban_lock_mobile_ar.validation.json','outputs\validation\lu_ban_lock_mobile_ar.validation.md' | Select-Object FullName,Length,LastWriteTime
Test-Path 'outputs\lu_ban_lock_mobile_ar.temp.glb'
```

Expected:

- source hash equals `8E215A86264DAFC2A3A9CF43406E2DB2470EEF0A150264DB91E98EB8BD655A5B`;
- four required output/report files exist and are non-empty;
- `Test-Path` for `.temp.glb` returns `False`.

- [ ] **Step 3: Inspect the Markdown and JSON evidence**

Confirm both reports include Action/NLA organization, Blender Z-up results, GLB Y-up results, all topology/material/animation checks, and the full LinLUCAS/CC BY 4.0/Sketchfab attribution.

- [ ] **Step 4: Check repository state without staging binary outputs**

```powershell
git status --short
git log --oneline -5
```

Expected: implementation scripts/tests and plan/spec commits are present; generated `.blend`/`.glb` outputs remain unstaged unless the user explicitly requests committing binaries.
