extends CharacterBody3D
# دبابة: تُستخدم للاعب وللأعداء

const BulletScript := preload("res://bullet.gd")

signal died(tank)

var is_player := false
var speed := 8.0
var turn_speed := 2.2
var hp := 100
var max_hp := 100
var fire_rate := 0.6
var fire_cd := 0.0
var move_input := Vector2.ZERO # x: يمين+ ، y: أمام+
var target: Node3D
var turret: Node3D
var muzzle: Node3D


func _ready() -> void:
	add_to_group("player" if is_player else "enemy")
	if not is_player:
		speed = 5.0
		hp = 50
		max_hp = 50
		fire_rate = 1.6
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2.4, 1.2, 3.4)
	col.shape = shape
	col.position.y = 0.6
	add_child(col)
	_build_model()


func _mesh_box(size: Vector3, pos: Vector3, color: Color, parent: Node3D) -> void:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	m.material = mat
	mi.mesh = m
	mi.position = pos
	parent.add_child(mi)


func _build_model() -> void:
	var body_color := Color(0.25, 0.5, 0.25) if is_player else Color(0.65, 0.2, 0.2)
	var dark := Color(0.12, 0.12, 0.12)
	_mesh_box(Vector3(1.8, 0.7, 3.0), Vector3(0, 0.7, 0), body_color, self)
	_mesh_box(Vector3(0.5, 0.6, 3.4), Vector3(-1.1, 0.3, 0), dark, self)
	_mesh_box(Vector3(0.5, 0.6, 3.4), Vector3(1.1, 0.3, 0), dark, self)
	turret = Node3D.new()
	turret.position = Vector3(0, 1.4, 0)
	add_child(turret)
	_mesh_box(Vector3(1.3, 0.55, 1.5), Vector3.ZERO, body_color.darkened(0.2), turret)
	var barrel := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.14
	cyl.bottom_radius = 0.14
	cyl.height = 2.2
	var mat := StandardMaterial3D.new()
	mat.albedo_color = dark
	cyl.material = mat
	barrel.mesh = cyl
	barrel.rotation_degrees.x = 90
	barrel.position = Vector3(0, 0, -1.6)
	turret.add_child(barrel)
	muzzle = Node3D.new()
	muzzle.position = Vector3(0, 0, -2.8)
	turret.add_child(muzzle)


func _physics_process(delta: float) -> void:
	fire_cd = maxf(0.0, fire_cd - delta)
	if not is_player:
		_ai()
	rotate_y(-move_input.x * turn_speed * delta)
	var fwd := -global_transform.basis.z
	velocity = fwd * move_input.y * speed
	velocity.y = -5.0
	move_and_slide()


func _ai() -> void:
	move_input = Vector2.ZERO
	if target == null or not is_instance_valid(target):
		return
	var to := target.global_position - global_position
	to.y = 0
	var dist := to.length()
	var fwd := -global_transform.basis.z
	var angle := fwd.signed_angle_to(to, Vector3.UP)
	move_input.x = clampf(-angle * 2.0, -1.0, 1.0)
	if absf(angle) < 0.6 and dist > 14.0:
		move_input.y = 1.0
	if dist < 35.0 and absf(angle) < 0.12:
		fire()


func fire() -> void:
	if fire_cd > 0.0:
		return
	fire_cd = fire_rate
	var b := BulletScript.new()
	b.from_player = is_player
	get_parent().add_child(b)
	b.global_position = muzzle.global_position
	b.direction = -global_transform.basis.z


func hit(dmg: int) -> void:
	hp -= dmg
	if hp <= 0:
		died.emit(self)
		queue_free()
