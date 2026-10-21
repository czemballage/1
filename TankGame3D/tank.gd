extends CharacterBody3D
# دبابة: تُستخدم للاعب وللأعداء

const BulletScene := preload("res://bullet.tscn")

signal died(tank)

@export var is_player := false
var speed := 8.0
var turn_speed := 2.2
var hp := 100
var max_hp := 100
var fire_rate := 0.6
var fire_cd := 0.0
var move_input := Vector2.ZERO # x: يمين+ ، y: أمام+
var target: Node3D
@onready var muzzle: Node3D = $Turret/Muzzle


func _ready() -> void:
	add_to_group("player" if is_player else "enemy")
	if not is_player:
		speed = 5.0
		hp = 50
		max_hp = 50
		fire_rate = 1.6


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
	var b := BulletScene.instantiate()
	b.from_player = is_player
	get_parent().add_child(b)
	b.global_position = muzzle.global_position
	b.direction = -global_transform.basis.z


func hit(dmg: int) -> void:
	hp -= dmg
	if hp <= 0:
		died.emit(self)
		queue_free()
