"""Original cleaner shrimp station; no provider or agent brand geometry.
Blender source exports the same mesh to RealityKit and Filament.
"""
from pathlib import Path
import bpy, math, re
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
tokens = (ROOT / 'design/tokens.css').read_text()
def material(name, token):
    value = re.search(r'--'+token+r':\s*#([0-9a-fA-F]{6})', tokens).group(1)
    rgb = [int(value[i:i+2], 16)/255 for i in (0,2,4)]
    rgb = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .55
    return mat
shell=material('Cleaner shrimp shell','coral-500')
stripe=material('Cleaner shrimp stripe','tide-50')
stone=material('Station stone','ink-700')
def ellipsoid(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=loc)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in obj.data.polygons:face.use_smooth=True
    return obj
def line(name, points, radius, mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
ellipsoid('Station stone',(0,0,.12),(.7,.42,.18),stone)
for i in range(6):
    x=.32-i*.13;z=.43+math.sin(i/6*math.pi)*.13
    ellipsoid('Shrimp segment '+str(i),(x,0,z),(.12,.12-i*.009,.10),shell)
    ellipsoid('Dorsal stripe '+str(i),(x,0,z+.088),(.10,.025,.025),stripe)
for side in [-1,1]:
    for i in range(3):line('Walking leg',[(.22-i*.15,side*.06,.44),(.12-i*.15,side*.22,.31),(.22-i*.15,side*.29,.25)],.014,shell)
    line('Long antenna',[(.4,side*.04,.49),(.64,side*.24,.73),(.79,side*.4,.81)],.012,stripe)
    ellipsoid('Eye',(.41,side*.08,.5),(.027,.027,.027),stone)
ellipsoid('Tail fan',(-.49,0,.4),(.13,.21,.035),shell)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/terrarium/ci-station.blend'))
bpy.ops.wm.usd_export(filepath=str(ROOT/'apple/AgentDeck/Resources/Aquarium/ci-station.usdz'),selected_objects_only=True,
    export_animation=False,triangulate_meshes=True,generate_preview_surface=True,convert_orientation=True,
    export_global_forward_selection='NEGATIVE_Z',export_global_up_selection='Y')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'android/app/src/main/assets/residents/ci-station.glb'),export_format='GLB',use_selection=True,export_yup=True)
