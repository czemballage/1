extends Node3D

const TankScene := preload("res://tank.tscn")
const ARENA := 60.0

@onready var player = $Player
@onready var cam: Camera3D = $Camera3D
@onready var hud = $UI/Hud
@onready var hp_label: Label = $UI/HpLabel
@onready var msg_label: Label = $UI/MsgLabel

var score := 0
var game_over := false
var touch_move := Vector2.ZERO
var touch_fire := false
var spawn_timer := 1.0


func _ready() -> void:
	randomize()
	hud.move_changed.connect(func(v): touch_move = v)
	hud.fire_changed.connect(func(f): touch_fire = f)
	player.died.connect(_on_player_died)
	msg_label.text = ""


func _spawn_enemy() -> void:
	var e = TankScene.instantiate()
	e.is_player = false
	e.target = player
	add_child(e)
	var a := randf() * TAU
	var p := Vector3(cos(a) * 38.0, 0.1, sin(a) * 38.0)
	p.x = clampf(p.x, -ARENA + 4, ARENA - 4)
	p.z = clampf(p.z, -ARENA + 4, ARENA - 4)
	e.position = p
	e.died.connect(func(_t): score += 1)


func _on_player_died(_t) -> void:
	game_over = true
	msg_label.text = "GAME OVER\nScore: %d\nTouch to restart" % score


func _input(event: InputEvent) -> void:
	if game_over and ((event is InputEventScreenTouch and event.pressed) or (event is InputEventKey and event.pressed)):
		get_tree().reload_current_scene()


func _process(delta: float) -> void:
	if is_instance_valid(player):
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
