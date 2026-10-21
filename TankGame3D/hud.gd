extends Control
# عصا تحكم عائمة في النصف الأيسر + اضغط في النصف الأيمن لإطلاق النار (يدعم تعدد اللمس)

signal move_changed(v: Vector2)
signal fire_changed(f: bool)

const RADIUS := 110.0

var joy_idx := -1
var joy_center := Vector2.ZERO
var joy_pos := Vector2.ZERO
var fire_idx := -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _input(event: InputEvent) -> void:
	var half := get_viewport_rect().size.x * 0.5
	if event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < half and joy_idx == -1:
				joy_idx = event.index
				joy_center = event.position
				joy_pos = event.position
			elif event.position.x >= half and fire_idx == -1:
				fire_idx = event.index
				fire_changed.emit(true)
		else:
			if event.index == joy_idx:
				joy_idx = -1
				move_changed.emit(Vector2.ZERO)
			elif event.index == fire_idx:
				fire_idx = -1
				fire_changed.emit(false)
		queue_redraw()
	elif event is InputEventScreenDrag and event.index == joy_idx:
		var d: Vector2 = (event.position - joy_center).limit_length(RADIUS)
		joy_pos = joy_center + d
		move_changed.emit(Vector2(d.x, -d.y) / RADIUS)
		queue_redraw()


func _draw() -> void:
	var size_ := get_viewport_rect().size
	var fire_center := Vector2(size_.x - 160, size_.y - 150)
	var active := fire_idx != -1
	draw_circle(fire_center, 80, Color(1, 0.2, 0.2, 0.55 if active else 0.3))
	draw_string(ThemeDB.fallback_font, fire_center + Vector2(-32, 10), "FIRE", HORIZONTAL_ALIGNMENT_CENTER, 64, 28, Color(1, 1, 1, 0.9))
	if joy_idx != -1:
		draw_circle(joy_center, RADIUS, Color(1, 1, 1, 0.15))
		draw_circle(joy_pos, 48, Color(1, 1, 1, 0.5))
