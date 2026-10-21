extends Area3D

var direction := Vector3.FORWARD
var speed := 45.0
var from_player := false
var damage := 25
var life := 3.0


func _ready() -> void:
	var mi := MeshInstance3D.new()
	var m := SphereMesh.new()
	m.radius = 0.25
	m.height = 0.5
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1, 0.85, 0.2)
	mat.emission_enabled = true
	mat.emission = Color(1, 0.7, 0.1)
	m.material = mat
	mi.mesh = m
	add_child(mi)
	var cs := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.3
	cs.shape = s
	add_child(cs)
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
