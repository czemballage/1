extends Node3D

const TankScript := preload("res://tank.gd")
const HudScript := preload("res://hud.gd")
const ARENA := 60.0

var player
var cam: Camera3D
var score := 0
var game_over := false
var touch_move := Vector2.ZERO
var touch_fire := false
var spawn_timer := 1.0
var hp_label: Label
var msg_label: Label


func _ready() -> void:
	randomize()
	_build_environment()
	_build_ground()
	_build_obstacles()
	_spawn_player()
	_build_ui()


func _box(size: Vector3, pos: Vector3, color: Color) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	m.material = mat
	mi.mesh = m
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var s := BoxShape3D.new()
	s.size = size
	cs.shape = s
	body.add_child(cs)
	add_child(body)


func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.55, 0.75, 0.95)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.75, 0.75, 0.8)
	env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 35, 0)
	add_child(sun)


func _build_ground() -> void:
	_box(Vector3(ARENA * 2 + 10, 1, ARENA * 2 + 10), Vector3(0, -0.5, 0), Color(0.35, 0.5, 0.25))
	var wall := Color(0.45, 0.4, 0.35)
	var L := ARENA * 2 + 6
	_box(Vector3(L, 4, 2), Vector3(0, 2, ARENA + 1), wall)
	_box(Vector3(L, 4, 2), Vector3(0, 2, -ARENA - 1), wall)
	_box(Vector3(2, 4, L), Vector3(ARENA + 1, 2, 0), wall)
	_box(Vector3(2, 4, L), Vector3(-ARENA - 1, 2, 0), wall)


func _build_obstacles() -> void:
	for i in 28:
		var p := Vector2(randf_range(-ARENA + 6, ARENA - 6), randf_range(-ARENA + 6, ARENA - 6))
		if p.length() < 12.0:
			continue
		var s := Vector3(randf_range(3, 8), randf_range(3, 6), randf_range(3, 8))
		_box(s, Vector3(p.x, s.y * 0.5, p.y), Color(0.5, 0.5, 0.52).darkened(randf() * 0.3))


func _spawn_player() -> void:
	player = TankScript.new()
	player.is_player = true
	add_child(player)
	player.position = Vector3(0, 0.1, 0)
	player.died.connect(_on_player_died)
	cam = Camera3D.new()
	cam.far = 250.0
	cam.fov = 70.0
	add_child(cam)
	cam.global_position = Vector3(0, 7, 11)


func _spawn_enemy() -> void:
	var e = TankScript.new()
	e.is_player = false
	e.target = player
	add_child(e)
	var a := randf() * TAU
	var r := 38.0
	var p := Vector3(cos(a) * r, 0.1, sin(a) * r)
	p.x = clampf(p.x, -ARENA + 4, ARENA - 4)
	p.z = clampf(p.z, -ARENA + 4, ARENA - 4)
	e.position = p
	e.died.connect(_on_enemy_died)


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var hud := HudScript.new()
	hud.move_changed.connect(func(v): touch_move = v)
	hud.fire_changed.connect(func(f): touch_fire = f)
	layer.add_child(hud)
	hp_label = Label.new()
	hp_label.position = Vector2(24, 16)
	hp_label.add_theme_font_size_override("font_size", 32)
	layer.add_child(hp_label)
	msg_label = Label.new()
	msg_label.set_anchors_preset(Control.PRESET_CENTER)
	msg_label.add_theme_font_size_override("font_size", 56)
	msg_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	msg_label.position = Vector2(300, 260)
	layer.add_child(msg_label)


func _on_enemy_died(_t) -> void:
	score += 1


func _on_player_died(_t) -> void:
	game_over = true
	msg_label.text = "GAME OVER\nScore: %d\nTouch to restart" % score


func _input(event: InputEvent) -> void:
	if not game_over:
		return
	if (event is InputEventScreenTouch and event.pressed) or (event is InputEventKey and event.pressed):
		get_tree().reload_current_scene()


func _process(delta: float) -> void:
	if player and is_instance_valid(player):
		var want: Vector3 = player.global_position + player.global_transform.basis.z * 11.0 + Vector3.UP * 7.0
		cam.global_position = cam.global_position.lerp(want, 1.0 - exp(-6.0 * delta))
		cam.look_at(player.global_position + Vector3.UP * 1.5, Vector3.UP)
		hp_label.text = "HP: %d   Score: %d" % [maxi(player.hp, 0), score]


func _physics_process(delta: float) -> void:
	if game_over:
		return
	var kb := Vector2(
		float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)) - float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)))
	player.move_input = touch_move if touch_move.length() > 0.05 else kb
	if touch_fire or Input.is_key_pressed(KEY_SPACE):
		player.fire()
	spawn_timer -= delta
	if spawn_timer <= 0.0:
		spawn_timer = 3.0
		if get_tree().get_nodes_in_group("enemy").size() < mini(2 + score / 4, 8):
			_spawn_enemy()
