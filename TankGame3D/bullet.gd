extends Area3D

var direction := Vector3.FORWARD
var speed := 45.0
var from_player := false
var damage := 25
var life := 3.0


func _ready() -> void:
	body_entered.connect(_on_body)


func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	life -= delta
	if life <= 0.0:
		queue_free()


func _on_body(body: Node3D) -> void:
	if body.has_method("hit"):
		if body.is_player == from_player:
			return
		body.hit(damage)
	queue_free()
