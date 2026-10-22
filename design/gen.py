# Generates the static HTML used to build the Doodleflip redesign in Figma.
import pathlib

def icon(d, size=22, color="currentColor", sw=2, fill="none", name=""):
    return (f'<svg data-a="i|{name}|{color}|{sw}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{d}</svg>')

I = {
 "brush": '<path d="M18.4 2.6a2.2 2.2 0 0 1 3 3L12 15l-4-4 10.4-8.4z"/><path d="M7 14c-2 0-3.5 1.5-3.5 3.5 0 1.4-.8 2.3-1.5 2.5 1 .6 2.4 1 3.5 1C8 21 10 19 10 17a3 3 0 0 0-3-3z"/>',
 "pencil": '<path d="M17 3l4 4L8 20H4v-4L17 3z"/><path d="M14 6l4 4"/>',
 "marker": '<path d="M9 11l6-6 4 4-6 6"/><path d="M9 11l-4 4v4h4l4-4"/><path d="M3 21h8"/>',
 "eraser": '<path d="M20 20H9L4 15a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8"/><path d="M8 9l7 7"/>',
 "fill": '<path d="M5 12l7-7 7 7-7 7-7-7z"/><path d="M12 5L9 2"/><path d="M20 15s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4z"/>',
 "shapes": '<rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17" cy="17" r="4"/><path d="M17 3l4 7h-8z"/>',
 "lasso": '<path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A7 7 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/><circle cx="5" cy="16" r="2"/>',
 "picker": '<path d="M19 3a2.8 2.8 0 0 1 2 5l-2 2-5-5 2-2a2.8 2.8 0 0 1 3 0z"/><path d="M14 5l-9 9v5h5l9-9"/>',
 "hand": '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
 "undo": '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 "redo": '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
 "back": '<path d="M9 18l6-6-6-6"/>',
 "backltr": '<path d="M15 18l-6-6 6-6"/>',
 "play": '<path d="M7 4v16l13-8z" fill="currentColor"/>',
 "pause": '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
 "prev": '<path d="M19 20L9 12l10-8v16z" fill="currentColor"/><path d="M5 19V5"/>',
 "next": '<path d="M5 4l10 8-10 8V4z" fill="currentColor"/><path d="M19 5v14"/>',
 "plus": '<path d="M12 5v14M5 12h14"/>',
 "layers": '<path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
 "onion": '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
 "share": '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
 "more": '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
 "eye": '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 "eyeoff": '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
 "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 "music": '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
 "copy": '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
 "trash": '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
 "grid": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
 "zoom": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
 "check": '<path d="M20 6L9 17l-5-5"/>',
 "close": '<path d="M18 6L6 18M6 6l12 12"/>',
 "repeat": '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
 "film": '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 8h5M2 13h5M2 18h5M17 8h5M17 13h5M17 18h5"/>',
 "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
 "gif": '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M9 10H7.5A1.5 1.5 0 0 0 6 11.5v1A1.5 1.5 0 0 0 7.5 14H9v-2H8M12 10v4M15 14v-4h3M15 12h2"/>',
 "sheet": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
 "sparkle": '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
 "home": '<path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 "compass": '<circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
 "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 "drag": '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
}
def ic(name, size=22, color="currentColor", sw=2): return icon(I[name], size, color, sw, name=name)

# Original mascot "Blip": a round coral creature with one antenna. pose 0..5 changes squash/jump.
def blip(w, pose=0, ghost=None, op=1.0):
    dy = [0, -10, -22, -28, -18, -4][pose % 6]
    sx = [1.12, 1.02, 0.96, 0.94, 0.98, 1.08][pose % 6]
    sy = [0.88, 0.98, 1.05, 1.06, 1.02, 0.92][pose % 6]
    body = ghost or "#FF6B4A"; dark = ghost or "#1B1E27"; belly = ghost or "#FFD3C4"
    fo = 'fill-opacity="0.0"' if ghost else ''
    stroke = f'stroke="{ghost}" stroke-width="2.4" fill="none"' if ghost else ''
    if ghost:
        return (f'<svg data-a="b|{pose%6}|{ghost}" width="{w}" height="{w*1.2:.0f}" viewBox="0 -24 120 144" style="opacity:{op}">'
                f'<g transform="translate(60 {100+dy}) scale({sx} {sy})">'
                f'<path d="M0-78 C 4-90 14-92 14-84" {stroke}/>'
                f'<ellipse cx="0" cy="-40" rx="38" ry="38" {stroke}/>'
                f'<circle cx="-12" cy="-46" r="6" {stroke}/><circle cx="12" cy="-46" r="6" {stroke}/>'
                f'<path d="M-10-28 Q0-20 10-28" {stroke}/>'
                f'<path d="M-16-4 L-18 6 M16-4 L18 6" {stroke}/></g></svg>')
    return (f'<svg data-a="b|{pose%6}|" width="{w}" height="{w*1.2:.0f}" viewBox="0 -24 120 144">'
            f'<ellipse cx="60" cy="108" rx="{30-dy*0.5}" ry="5" fill="#000" fill-opacity="{0.10+dy*0.002}"/>'
            f'<g transform="translate(60 {100+dy}) scale({sx} {sy})">'
            f'<path d="M0-78 C 4-90 14-92 14-84" stroke="{dark}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
            f'<circle cx="15" cy="-84" r="5" fill="#FFC94A" stroke="{dark}" stroke-width="3"/>'
            f'<path d="M-16-4 L-18 6 M16-4 L18 6" stroke="{dark}" stroke-width="5" stroke-linecap="round"/>'
            f'<ellipse cx="0" cy="-40" rx="38" ry="38" fill="{body}" stroke="{dark}" stroke-width="3.5"/>'
            f'<ellipse cx="0" cy="-26" rx="22" ry="15" fill="{belly}"/>'
            f'<circle cx="-12" cy="-48" r="8" fill="#fff" stroke="{dark}" stroke-width="3"/><circle cx="-10" cy="-47" r="3.6" fill="{dark}"/>'
            f'<circle cx="12" cy="-48" r="8" fill="#fff" stroke="{dark}" stroke-width="3"/><circle cx="14" cy="-47" r="3.6" fill="{dark}"/>'
            f'<path d="M-9-31 Q0-23 9-31" stroke="{dark}" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
            f'<ellipse cx="-24" cy="-34" rx="5" ry="3" fill="#FF8FA3" fill-opacity=".7"/><ellipse cx="24" cy="-34" rx="5" ry="3" fill="#FF8FA3" fill-opacity=".7"/>'
            f'</g></svg>')

def hills(w, h):
    return (f'<svg data-a="h" width="{w}" height="{h}" viewBox="0 0 400 225" preserveAspectRatio="none">'
            '<rect width="400" height="225" fill="#FFF8EE"/>'
            '<circle cx="330" cy="48" r="22" fill="#FFC94A"/>'
            '<path d="M0 170 Q 80 120 160 160 T 400 150 V225 H0z" fill="#CFEFD9"/>'
            '<path d="M0 195 Q 120 165 240 190 T 400 185 V225 H0z" fill="#9FDDB5"/>'
            '<path d="M40 60 q10-12 24-4 q8-10 20 0 q14 2 8 12 h-50 q-10-2-2-8z" fill="#fff"/>'
            '</svg>')

def thumb(w, h, pose, bg="#FFF8EE"):
    return (f'<div style="width:{w}px;height:{h}px;background:{bg};position:relative;overflow:hidden;border-radius:6px">'
            f'<div style="position:absolute;inset:0">{hills(w,h)}</div>'
            f'<div style="position:absolute;left:{w/2-h*0.375}px;top:{-h*0.12}px">{blip(int(h*0.75), pose)}</div></div>')

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0A0C11;font-family:'Inter','IBM Plex Sans Arabic',sans-serif;color:#F4F5F7;padding:40px;display:flex;flex-wrap:wrap;gap:60px;align-items:flex-start}
[dir=rtl]{font-family:'IBM Plex Sans Arabic','Inter',sans-serif}
.screen{position:relative;overflow:hidden;background:#0F1117;flex:none}
.phone{width:390px;height:844px}
.desk{width:1440px;height:900px}
.board{width:1440px;background:#0F1117;padding:56px}
.status{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:15px;font-weight:600;font-family:'Inter'}
.row{display:flex;align-items:center}
.col{display:flex;flex-direction:column}
.muted{color:#8E96A8}
.h1{font-size:28px;font-weight:700;letter-spacing:-.3px}
.h2{font-size:20px;font-weight:700}
.h3{font-size:16px;font-weight:600}
.sm{font-size:13px}
.xs{font-size:11px}
.btn{height:48px;border-radius:14px;padding:0 20px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15px}
.btn.primary{background:#FF6B4A;color:#fff;box-shadow:0 8px 24px rgba(255,107,74,.35)}
.btn.ghost{background:#1E2330;color:#F4F5F7}
.btn.dark{background:#0F1117;color:#fff}
.iconbtn{width:40px;height:40px;border-radius:12px;background:#1E2330;display:flex;align-items:center;justify-content:center;color:#C9CEDA}
.chip{height:30px;padding:0 12px;border-radius:999px;background:#1E2330;display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#C9CEDA}
.chip.on{background:#FF6B4A1F;color:#FF8A6E;box-shadow:inset 0 0 0 1.5px #FF6B4A}
.card{background:#161A23;border-radius:20px;box-shadow:inset 0 0 0 1px #232838}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#161A23;border-radius:28px 28px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.5),inset 0 1px 0 #2A3142;padding:12px 20px 34px}
.grab{width:40px;height:5px;border-radius:3px;background:#3A4256;margin:0 auto 14px}
.scrim{position:absolute;inset:0;background:rgba(5,6,10,.55)}
.slider{height:6px;border-radius:3px;background:#2A3142;position:relative;flex:1}
.col>.slider{flex:none;width:100%}
.slider i{position:absolute;top:0;bottom:0;border-radius:3px;background:#FF6B4A}
.slider b{position:absolute;top:-8px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.toggle{width:46px;height:28px;border-radius:14px;background:#2A3142;position:relative;flex:none}
.toggle b{position:absolute;top:3px;width:22px;height:22px;border-radius:50%;background:#fff}
.toggle.on{background:#3DDC97}
.seg{display:flex;background:#0F1117;border-radius:12px;padding:4px;gap:4px}
.seg div{flex:1;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#8E96A8;font-weight:500}
.seg div.on{background:#2A3142;color:#fff}
.sw{width:34px;height:34px;border-radius:50%;flex:none}
.sw.on{box-shadow:0 0 0 3px #161A23,0 0 0 5px #fff}
.label{font-size:12px;color:#8E96A8;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
.paper{background:#FFF8EE;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45);position:relative;overflow:hidden}
.tool{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#C9CEDA}
.tool.on{background:#FF6B4A;color:#fff;box-shadow:0 6px 16px rgba(255,107,74,.4)}
.frame{flex:none;border-radius:10px;position:relative;box-shadow:inset 0 0 0 2px transparent}
.frame.on{box-shadow:0 0 0 2.5px #FF6B4A}
.fnum{position:absolute;bottom:4px;font-size:10px;font-weight:700;color:#1B1E27;background:#ffffffd9;border-radius:5px;padding:1px 5px;font-family:Inter}
.dock{background:#161A23ee;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 0 0 1px #2A3142;padding:6px;display:flex;flex-direction:column;gap:4px}
"""

def phone(title, body, rtl=True):
    return f'<div class="screen phone" data-name="{title}" {"dir=rtl" if rtl else ""}>{body}</div>'

STATUS = '<div class="status" dir="ltr"><span>9:41</span><span class="row" style="gap:6px"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5" width="3" height="7" rx="1" fill="#fff"/><rect x="10" y="2" width="3" height="10" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" stroke="#fff" fill="none" opacity=".5"/><rect x="2" y="2" width="17" height="8" rx="2" fill="#fff"/></svg></span></div>'

# ---------- 1. Home ----------
proj = [("مغامرة بليب", 48, 12, "قبل ساعتين", 2), ("القفزة الكبيرة", 24, 24, "أمس", 3), ("حلقة المشي", 8, 12, "منذ 3 أيام", 1), ("تجربة ألوان", 16, 8, "الأسبوع الماضي", 5)]
cards = ""
for name, fr, fps, when, pose in proj:
    cards += (f'<div class="card" style="width:167px;padding:8px;border-radius:18px">{thumb(151,96,pose)}'
              f'<div style="padding:10px 4px 4px"><div class="h3" style="font-size:14px">{name}</div>'
              f'<div class="row muted xs" style="gap:6px;margin-top:6px"><span>{fr} إطار</span><span>•</span><span>{fps} fps</span></div>'
              f'<div class="muted xs" style="margin-top:2px">{when}</div></div></div>')
templates = ""
for lab, w, h, ico in [("فارغ ١٦:٩", 64, 36, ""), ("قصة ٩:١٦", 30, 54, ""), ("مربع", 46, 46, ""), ("دفتر قلّاب", 58, 42, "")]:
    templates += (f'<div class="col" style="align-items:center;gap:8px;width:76px"><div style="width:76px;height:76px;border-radius:18px;background:#161A23;box-shadow:inset 0 0 0 1px #232838;display:flex;align-items:center;justify-content:center">'
                  f'<div style="width:{w*0.8}px;height:{h*0.8}px;border-radius:5px;background:#FFF8EE;box-shadow:0 4px 10px rgba(0,0,0,.4)"></div></div><span class="xs muted" style="font-weight:500">{lab}</span></div>')
home = STATUS + f'''
<div class="row" style="justify-content:space-between;padding:8px 20px 0">
  <div class="row" style="gap:10px"><div style="width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,#FF6B4A,#FFC94A);display:flex;align-items:center;justify-content:center">{blip(34,0)}</div>
  <div class="col"><span class="muted xs">مساء الخير 👋</span><span class="h3">Doodleflip</span></div></div>
  <div class="row" style="gap:8px"><div class="iconbtn">{ic("search",20)}</div><div class="iconbtn">{ic("settings",20)}</div></div>
</div>
<div style="margin:20px 20px 0;border-radius:26px;background:linear-gradient(135deg,#FF6B4A 0%,#FF8E6B 55%,#FFC94A 100%);height:176px;position:relative;overflow:hidden;padding:22px">
  <div style="position:absolute;left:-6px;bottom:-10px">{blip(150,2)}</div>
  <div style="position:absolute;left:96px;bottom:14px;opacity:.35">{blip(70,4,"#fff",1)}</div>
  <div class="col" style="gap:6px;width:200px;color:#1B1E27"><span class="h2" style="font-size:21px;line-height:1.3">حرّك فكرتك<br>إطاراً بإطار</span><span class="xs" style="opacity:.75">ارسم، أضف إطارات وشاهدها تتحرك</span></div>
  <div class="btn dark" style="position:absolute;bottom:20px;right:22px;height:42px;border-radius:12px;font-size:14px">{ic("plus",18,"#fff",2.4)}مشروع جديد</div>
</div>
<div class="row" style="justify-content:space-between;padding:26px 20px 12px"><span class="h3">ابدأ من قالب</span><span class="sm" style="color:#FF8A6E">الكل</span></div>
<div class="row" style="gap:12px;padding:0 20px">{templates}</div>
<div class="row" style="justify-content:space-between;padding:26px 20px 12px"><span class="h3">مشاريعي</span><div class="row" style="gap:6px"><span class="chip on">الأحدث</span><span class="chip">الأقدم</span></div></div>
<div class="row" style="flex-wrap:wrap;gap:16px;padding:0 20px">{cards}</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:88px;background:linear-gradient(to top,#0F1117 60%,#0F111700);"></div>
<div class="row" style="position:absolute;bottom:22px;left:50%;transform:translateX(-50%);background:#1E2330;border-radius:22px;padding:6px;gap:4px;box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 0 1px #2A3142">
  <div class="row" style="gap:6px;background:#FF6B4A;color:#fff;height:44px;padding:0 16px;border-radius:16px;font-weight:600;font-size:14px">{ic("home",20,"#fff")}الرئيسية</div>
  <div class="row" style="justify-content:center;width:52px;height:44px;color:#8E96A8">{ic("compass",22)}</div>
  <div class="row" style="justify-content:center;width:52px;height:44px;color:#8E96A8">{ic("user",22)}</div>
</div>'''

# ---------- 2. Editor (mobile) ----------
def strip(n, cur, w=58, h=40, start=0):
    s = ""
    for i in range(n):
        on = " on" if i == cur else ""
        s += f'<div class="frame{on}" style="width:{w}px;height:{h}px">{thumb(w,h,i+start)}<span class="fnum" style="right:4px">{i+1}</span></div>'
    return s

def canvas(w, h, pose=2, onion=True):
    sz = int(min(w, h) * 0.6); x0 = w/2 - sz/2; y0 = h*0.66 - sz*1.08; off = sz*0.3
    g = ""
    if onion:
        g += f'<div style="position:absolute;left:{x0-off}px;top:{y0}px">{blip(sz,pose-1,"#FF5A6E",.55)}</div>'
        g += f'<div style="position:absolute;left:{x0+off}px;top:{y0}px">{blip(sz,pose+1,"#4A8CFF",.55)}</div>'
    return (f'<div class="paper" style="width:{w}px;height:{h}px"><div style="position:absolute;inset:0">{hills(w,h)}</div>{g}'
            f'<div style="position:absolute;left:{x0}px;top:{y0}px">{blip(sz,pose)}</div></div>')

tools_m = ""
for n, on in [("brush",1),("pencil",0),("eraser",0),("fill",0),("shapes",0),("lasso",0),("picker",0)]:
    tools_m += f'<div class="tool{" on" if on else ""}" style="width:44px;height:44px">{ic(n,21)}</div>'
editor = STATUS + f'''
<div class="row" style="justify-content:space-between;padding:6px 16px 0">
  <div class="row" style="gap:10px"><div class="iconbtn">{ic("back",20)}</div><div class="col"><span class="h3" style="font-size:15px">مغامرة بليب</span><span class="xs muted">تم الحفظ تلقائياً</span></div></div>
  <div class="row" style="gap:6px"><div class="iconbtn">{ic("undo",19)}</div><div class="iconbtn" style="opacity:.45">{ic("redo",19)}</div>
  <div class="btn primary" style="height:40px;border-radius:12px;padding:0 14px;font-size:14px">{ic("share",18,"#fff")}تصدير</div></div>
</div>
<div style="position:absolute;top:166px;left:0;right:0;height:364px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#1B2030,#0F1117 70%)">
  <div style="transform:translateX(24px)">{canvas(250,333,2)}</div>
</div>
<div class="dock" style="position:absolute;top:170px;left:12px">{tools_m}<div style="height:1px;background:#2A3142;margin:4px 6px"></div>
  <div class="tool" style="width:44px;height:44px"><div class="sw" style="width:26px;height:26px;background:#1B1E27;box-shadow:0 0 0 2px #fff"></div></div></div>
<div class="row" style="position:absolute;top:120px;left:16px;right:16px;gap:8px;justify-content:flex-start">
  <div class="chip" style="background:#161A23ee;box-shadow:inset 0 0 0 1px #2A3142">{ic("layers",15)}الطبقة ٢ / ٣</div>
  <div class="chip on" style="background:#161A23ee">{ic("onion",15)}قشرة البصل</div>
</div>
<div class="row" style="position:absolute;top:538px;left:16px;right:16px;background:#161A23;border-radius:18px;padding:10px 14px;gap:12px;box-shadow:inset 0 0 0 1px #232838">
  <div style="width:30px;height:30px;border-radius:50%;background:#0F1117;display:flex;align-items:center;justify-content:center"><div style="width:12px;height:12px;border-radius:50%;background:#1B1E27;box-shadow:0 0 0 2px #fff"></div></div>
  <div class="col" style="flex:1;gap:4px"><div class="row xs muted" style="justify-content:space-between"><span>الحجم</span><span style="color:#fff;font-family:Inter">12</span></div><div class="slider"><i style="right:0;width:35%"></i><b style="right:calc(35% - 11px)"></b></div></div>
  <div class="col" style="flex:1;gap:4px"><div class="row xs muted" style="justify-content:space-between"><span>الشفافية</span><span style="color:#fff;font-family:Inter">90%</span></div><div class="slider"><i style="right:0;width:90%;background:#4AA8FF"></i><b style="right:calc(90% - 11px)"></b></div></div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:#161A23;border-radius:26px 26px 0 0;box-shadow:inset 0 1px 0 #232838;padding:14px 16px 0">
  <div class="row" style="justify-content:space-between">
    <div class="row" style="gap:8px"><div class="iconbtn" style="width:36px;height:36px">{ic("next",16)}</div>
      <div style="width:52px;height:52px;border-radius:18px;background:#FF6B4A;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 20px rgba(255,107,74,.45)">{ic("play",24,"#fff")}</div>
      <div class="iconbtn" style="width:36px;height:36px">{ic("prev",16)}</div></div>
    <div class="col" style="align-items:center"><span class="h3" style="font-family:Inter;font-size:17px">3 <span class="muted" style="font-weight:500">/ 48</span></span><span class="xs muted">الإطار</span></div>
    <div class="row" style="gap:6px"><span class="chip" style="font-family:Inter">12 fps</span><span class="chip on" style="padding:0 9px">{ic("repeat",15)}</span></div>
  </div>
  <div style="height:3px;border-radius:2px;background:#2A3142;margin:14px 0 12px;position:relative"><i style="position:absolute;right:0;top:0;bottom:0;width:6%;background:#FF6B4A;border-radius:2px"></i></div>
  <div class="row" style="gap:8px;overflow:hidden">{strip(5,2,58,42)}<div class="frame" style="width:42px;height:42px;border-radius:10px;background:#1E2330;box-shadow:inset 0 0 0 1.5px #3A4256;display:flex;align-items:center;justify-content:center;color:#C9CEDA">{ic("plus",20)}</div></div>
  <div class="row" style="justify-content:space-around;margin-top:14px;color:#8E96A8" >
    <div class="col xs" style="align-items:center;gap:4px">{ic("copy",20)}<span>نسخ مكرر</span></div>
    <div class="col xs" style="align-items:center;gap:4px">{ic("layers",20)}<span>الطبقات</span></div>
    <div class="col xs" style="align-items:center;gap:4px">{ic("music",20)}<span>الصوت</span></div>
    <div class="col xs" style="align-items:center;gap:4px">{ic("grid",20)}<span>شبكة</span></div>
    <div class="col xs" style="align-items:center;gap:4px;color:#FF5A6E">{ic("trash",20)}<span>حذف</span></div>
  </div>
</div>'''

# ---------- 3. Brush & colour sheet ----------
pal = ["#1B1E27","#FFFFFF","#8E96A8","#FF5A6E","#FF6B4A","#FFC94A","#3DDC97","#2EC4B6","#4AA8FF","#5B6CFF","#9B5CFF","#FF4FA3","#8D5524","#C68642","#F1C27D","#7CB518"]
sws = "".join(f'<div class="sw{" on" if c=="#FF6B4A" else ""}" style="background:{c};{"box-shadow:inset 0 0 0 1px #3A4256;" if c=="#FFFFFF" else ""}"></div>' for c in pal)
brushes = ""
for n, lab, on, stroke in [("brush","فرشاة",1,'<path d="M8 30 C 30 8, 50 40, 80 14" stroke="#FF6B4A" stroke-width="7" fill="none" stroke-linecap="round"/>'),
                           ("pencil","رصاص",0,'<path d="M8 30 C 30 8, 50 40, 80 14" stroke="#C9CEDA" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
                           ("marker","تحديد",0,'<path d="M8 30 C 30 8, 50 40, 80 14" stroke="#FFC94A" stroke-opacity=".6" stroke-width="12" fill="none"/>'),
                           ("eraser","ممحاة",0,'<path d="M8 30 C 30 8, 50 40, 80 14" stroke="#3A4256" stroke-dasharray="3 5" stroke-width="7" fill="none" stroke-linecap="round"/>')]:
    brushes += (f'<div class="col" style="flex:1;min-width:0;gap:8px;align-items:center;padding:10px 0;border-radius:16px;background:{"#FF6B4A14" if on else "#0F1117"};box-shadow:inset 0 0 0 {"1.5px #FF6B4A" if on else "1px #232838"}">'
                f'<svg width="66" height="30" viewBox="0 0 88 40">{stroke}</svg><span class="xs" style="color:{"#FF8A6E" if on else "#8E96A8"};font-weight:600">{lab}</span></div>')
sheet_brush = STATUS + f'''<div style="position:absolute;top:44px;left:0;right:0;bottom:0;filter:blur(0)">
<div style="position:absolute;top:60px;left:0;right:0;display:flex;justify-content:center">{canvas(286,380,2,False)}</div></div>
<div class="scrim"></div>
<div class="sheet" style="height:560px">
  <div class="grab"></div>
  <div class="row" style="justify-content:space-between;margin-bottom:16px"><span class="h2">الفرشاة واللون</span><div class="iconbtn" style="width:34px;height:34px;border-radius:50%">{ic("close",16)}</div></div>
  <div class="row" style="gap:8px">{brushes}</div>
  <div class="col" style="gap:16px;margin-top:20px">
    <div class="row" style="gap:14px"><span class="sm" style="width:64px">الحجم</span><div class="slider"><i style="right:0;width:35%"></i><b style="right:calc(35% - 11px)"></b></div><span class="sm" style="width:30px;text-align:left;font-family:Inter">12</span></div>
    <div class="row" style="gap:14px"><span class="sm" style="width:64px">الشفافية</span><div class="slider"><i style="right:0;width:90%;background:#4AA8FF"></i><b style="right:calc(90% - 11px)"></b></div><span class="sm" style="width:30px;text-align:left;font-family:Inter">90%</span></div>
    <div class="row" style="gap:14px"><span class="sm" style="width:64px">النعومة</span><div class="slider"><i style="right:0;width:60%;background:#3DDC97"></i><b style="right:calc(60% - 11px)"></b></div><span class="sm" style="width:30px;text-align:left;font-family:Inter">60%</span></div>
  </div>
  <div class="row" style="justify-content:space-between;margin:24px 0 12px"><span class="label">اللوحة</span><div class="row" style="gap:6px"><span class="chip" style="font-family:Inter;height:28px">#FF6B4A</span><div style="width:28px;height:28px;border-radius:50%;background:conic-gradient(#FF5A6E,#FFC94A,#3DDC97,#4AA8FF,#9B5CFF,#FF5A6E)"></div></div></div>
  <div class="row" style="flex-wrap:wrap;gap:12px 10px">{sws}</div>
  <div class="row" style="gap:8px;margin-top:18px"><span class="xs muted">الأخيرة</span><div class="sw" style="width:22px;height:22px;background:#FF6B4A"></div><div class="sw" style="width:22px;height:22px;background:#1B1E27;box-shadow:inset 0 0 0 1px #3A4256"></div><div class="sw" style="width:22px;height:22px;background:#FFD3C4"></div><div class="sw" style="width:22px;height:22px;background:#9FDDB5"></div></div>
</div>'''

# ---------- 4. Layers sheet ----------
lay = ""
for name, on, vis, op, pose in [("الشخصية", 1, 1, 100, 2), ("الظل", 0, 1, 40, 0), ("الخلفية", 0, 0, 100, 9)]:
    th = thumb(64,44,pose) if pose != 9 else f'<div style="width:64px;height:44px;border-radius:6px;overflow:hidden">{hills(64,44)}</div>'
    lay += (f'<div class="row" style="gap:12px;padding:10px;border-radius:18px;background:{"#FF6B4A14" if on else "#0F1117"};box-shadow:inset 0 0 0 {"1.5px #FF6B4A" if on else "1px #232838"}">'
            f'<span style="color:#3A4256">{ic("drag",18)}</span>{th}'
            f'<div class="col" style="flex:1;gap:4px"><span class="h3" style="font-size:15px">{name}</span><span class="xs muted">الشفافية {op}%</span></div>'
            f'<div class="iconbtn" style="width:36px;height:36px;color:{"#C9CEDA" if vis else "#5B6378"}">{ic("eye" if vis else "eyeoff",18)}</div>'
            f'<div class="iconbtn" style="width:36px;height:36px">{ic("more",18)}</div></div>')
sheet_layers = STATUS + f'''<div style="position:absolute;top:104px;left:0;right:0;display:flex;justify-content:center">{canvas(286,380,2,False)}</div>
<div class="scrim"></div>
<div class="sheet" style="height:470px">
  <div class="grab"></div>
  <div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="h2">الطبقات</span><div class="btn primary" style="height:38px;border-radius:12px;padding:0 14px;font-size:14px">{ic("plus",18,"#fff",2.4)}طبقة</div></div>
  <span class="xs muted">٣ من ٨ طبقات • اسحب لإعادة الترتيب</span>
  <div class="col" style="gap:10px;margin-top:16px">{lay}</div>
  <div class="card" style="margin-top:16px;padding:14px 16px;border-radius:16px;background:#0F1117">
    <div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="sm" style="font-weight:600">شفافية «الشخصية»</span><span class="sm" style="font-family:Inter">100%</span></div>
    <div class="slider"><i style="right:0;width:100%"></i><b style="right:calc(100% - 11px)"></b></div>
  </div>
</div>'''

# ---------- 5. Export sheet ----------
fmts = ""
for n, t, d, on in [("gif","GIF متحرك","مثالي للمشاركة",1),("film","فيديو MP4","مع الصوت",0),("image","صورة PNG","الإطار الحالي",0),("sheet","ورقة إطارات","لمحركات الألعاب",0)]:
    fmts += (f'<div class="col" style="width:calc(50% - 6px);gap:10px;padding:14px;border-radius:18px;background:{"#FF6B4A14" if on else "#0F1117"};box-shadow:inset 0 0 0 {"1.5px #FF6B4A" if on else "1px #232838"};position:relative">'
             f'<div style="width:40px;height:40px;border-radius:12px;background:{"#FF6B4A" if on else "#1E2330"};display:flex;align-items:center;justify-content:center;color:{"#fff" if on else "#C9CEDA"}">{ic(n,21)}</div>'
             f'<div class="col" style="gap:2px"><span class="h3" style="font-size:15px">{t}</span><span class="xs muted">{d}</span></div>'
             + (f'<div style="position:absolute;top:12px;left:12px;width:22px;height:22px;border-radius:50%;background:#FF6B4A;display:flex;align-items:center;justify-content:center">{ic("check",13,"#fff",3)}</div>' if on else '') + '</div>')
sheet_export = STATUS + f'''<div style="position:absolute;top:104px;left:0;right:0;display:flex;justify-content:center">{canvas(286,380,2,False)}</div>
<div class="scrim"></div>
<div class="sheet" style="height:700px">
  <div class="grab"></div>
  <div class="row" style="justify-content:space-between;margin-bottom:16px"><span class="h2">تصدير الرسوم</span><div class="iconbtn" style="width:34px;height:34px;border-radius:50%">{ic("close",16)}</div></div>
  <div class="row" style="gap:14px;padding:12px;border-radius:18px;background:#0F1117;box-shadow:inset 0 0 0 1px #232838">{thumb(96,64,2)}
    <div class="col" style="gap:4px"><span class="h3">مغامرة بليب</span><span class="xs muted" style="font-family:Inter">48 frames • 12 fps • 4.0s</span><span class="xs muted" style="font-family:Inter">1280 × 720</span></div></div>
  <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:16px">{fmts}</div>
  <div class="label" style="margin:20px 0 10px">الجودة</div>
  <div class="seg"><div>منخفضة</div><div class="on">متوسطة</div><div>عالية</div></div>
  <div class="row" style="justify-content:space-between;margin-top:18px"><span class="sm">تكرار لا نهائي</span><div class="toggle on"><b style="left:3px"></b></div></div>
  <div class="row" style="justify-content:space-between;margin-top:14px"><span class="sm">إضافة علامة مائية</span><div class="toggle"><b style="right:3px"></b></div></div>
  <div class="btn primary" style="position:absolute;bottom:34px;left:20px;right:20px;height:54px;border-radius:16px;font-size:16px">{ic("share",20,"#fff")}تصدير GIF <span style="opacity:.75;font-weight:500;font-family:Inter">~ 2.4 MB</span></div>
</div>'''

# ---------- 6. New project sheet ----------
sizes = ""
for lab, sub, w, h, on in [("أفقي","16:9",64,36,1),("قصة","9:16",30,54,0),("مربع","1:1",46,46,0),("كلاسيكي","4:3",56,42,0)]:
    sizes += (f'<div class="col" style="flex:1;align-items:center;gap:8px;padding:14px 0;border-radius:18px;background:{"#FF6B4A14" if on else "#0F1117"};box-shadow:inset 0 0 0 {"1.5px #FF6B4A" if on else "1px #232838"}">'
              f'<div style="height:58px;display:flex;align-items:center"><div style="width:{w*0.75}px;height:{h*0.75}px;border-radius:5px;background:{"#FF6B4A" if on else "#3A4256"}"></div></div>'
              f'<span class="xs" style="font-weight:600;color:{"#FF8A6E" if on else "#C9CEDA"}">{lab}</span><span class="xs muted" style="font-family:Inter">{sub}</span></div>')
bgs = "".join(f'<div class="sw{" on" if i==0 else ""}" style="background:{c};{"box-shadow:inset 0 0 0 1px #3A4256;" if i==1 else ""}"></div>' for i, c in enumerate(["#FFF8EE","#FFFFFF","#1B1E27","#CFEFD9","#D8E8FF","#FFE3EC"]))
sheet_new = STATUS + f'''<div style="opacity:.6">{home.split(STATUS)[1][:0]}</div>
<div class="scrim" style="background:rgba(5,6,10,.7)"></div>
<div class="sheet" style="height:640px">
  <div class="grab"></div>
  <div class="row" style="justify-content:space-between;margin-bottom:18px"><span class="h2">مشروع جديد</span><div class="iconbtn" style="width:34px;height:34px;border-radius:50%">{ic("close",16)}</div></div>
  <div class="label" style="margin-bottom:8px">الاسم</div>
  <div class="row" style="height:52px;border-radius:14px;background:#0F1117;box-shadow:inset 0 0 0 1.5px #FF6B4A;padding:0 16px;justify-content:space-between"><span class="h3" style="font-weight:500">مغامرة بليب ٢</span><span style="width:2px;height:22px;background:#FF6B4A"></span></div>
  <div class="label" style="margin:20px 0 8px">حجم اللوحة</div>
  <div class="row" style="gap:8px">{sizes}</div>
  <div class="label" style="margin:20px 0 8px">سرعة الإطارات</div>
  <div class="row" style="gap:8px;font-family:Inter"><span class="chip">6</span><span class="chip">8</span><span class="chip on">12</span><span class="chip">24</span><span class="chip">30</span><span class="chip">60</span></div>
  <div class="label" style="margin:20px 0 8px">الخلفية</div>
  <div class="row" style="gap:12px">{bgs}</div>
  <div class="btn primary" style="position:absolute;bottom:34px;left:20px;right:20px;height:54px;border-radius:16px;font-size:16px">{ic("sparkle",20,"#fff")}ابدأ الرسم</div>
</div>'''
sheet_new = sheet_new.replace('<div style="opacity:.6"></div>', f'<div style="position:absolute;top:44px;left:0;right:0;opacity:.5">' + home.split(STATUS)[1] + '</div>')

# ---------- 7. Desktop editor (English) ----------
tools_d = ""
for n, on in [("brush",1),("pencil",0),("marker",0),("eraser",0),("fill",0),("shapes",0),("lasso",0),("picker",0),("hand",0)]:
    tools_d += f'<div class="tool{" on" if on else ""}">{ic(n,21)}</div>'
NF = 24
cells_hdr = "".join(f'<div style="width:44px;flex:none;text-align:center;font-size:10px;color:{"#FF8A6E" if i==6 else "#5B6378"};font-family:Inter;font-weight:600">{i+1}</div>' for i in range(NF))
def track(name, color, filled, vis=True, sel=False):
    cells = ""
    for i in range(NF):
        k = filled(i)
        st = (f'background:{color};opacity:{1 if k==2 else .45}' if k else 'background:transparent')
        cells += f'<div style="width:44px;height:38px;flex:none;display:flex;align-items:center;justify-content:center;{"background:#FF6B4A12;" if i==6 else ""}"><div style="width:34px;height:26px;border-radius:7px;{st};{"box-shadow:0 0 0 2px #fff;" if (i==6 and sel) else ""}"></div></div>'
    return (f'<div class="row" style="height:42px;{"background:#1E2330;" if sel else ""}"><div class="row" style="width:220px;flex:none;gap:10px;padding:0 14px;height:42px;box-shadow:inset -1px 0 0 #232838">'
            f'<span style="width:10px;height:10px;border-radius:3px;background:{color}"></span><span class="sm" style="flex:1;font-weight:{600 if sel else 500}">{name}</span>'
            f'<span style="color:{"#C9CEDA" if vis else "#5B6378"}">{ic("eye" if vis else "eyeoff",16)}</span><span style="color:#5B6378">{ic("lock",15)}</span></div>'
            f'<div class="row">{cells}</div></div>')
tracks = (track("Character", "#FF6B4A", lambda i: 2 if i < 20 else 0, True, True)
          + track("Shadow", "#9B5CFF", lambda i: 2 if i % 4 == 0 and i < 20 else (1 if i < 20 else 0))
          + track("Background", "#3DDC97", lambda i: 2 if i == 0 else (1 if i < 20 else 0))
          + track("Sound", "#4AA8FF", lambda i: 0, True))
wave = "".join(f'<rect x="{x*4}" y="{19-h}" width="2.4" height="{2*h}" rx="1.2" fill="#4AA8FF"/>' for x, h in enumerate([3,6,10,14,9,5,12,16,11,7,4,8,13,17,12,6,3,5,9,14,10,6,4,7,11,15,12,8,5,3,6,10,13,9,5,4,7,12,16,13,9,6,3,5,8,12,9,6,4,3,6,9,14,11,7,4,8,12,15,10,6,4,3,5,9,12,8,5,4,6,10,14,11,7,5,3,6,9,12,8,5,3,4,7,11,14,10,6,4,3,5,8,12,15,11,7,5,3,6,9,13,10,6,4,3,5,8,11,14,10,6,4,3,5,9,12,8,5,4,6,10,13,9,6,3,5,8,12,15,11,7,4,3,6,9,13,10,6,4,3,5,8,11,14,10,6,4,3,5,9,12,8,5,4,6,10,14,11,7,5,3,6,9,12,8,5,3,4,7,11,14,10,6,4,3,5,8,12,15,11,7,5,3,6,9,13,10,6,4,3,5,8,11,14,10,6,4,3,5,9,12,8,5,4,6,10,13,9,6,3,5,8,12,15,11,7,4,3,6,9,13,10,6,4,3,5,8,11,14,10,6,4,3,5,9,12,8,5,4,6,10,14,11,7,5,3,6,9]) if x < 220)
dpal = "".join(f'<div class="sw{" on" if c=="#FF6B4A" else ""}" style="width:26px;height:26px;background:{c};{"box-shadow:inset 0 0 0 1px #3A4256;" if c=="#FFFFFF" else ""}"></div>' for c in pal)
desk = f'''
<div class="row" style="height:60px;padding:0 16px;gap:12px;background:#161A23;box-shadow:inset 0 -1px 0 #232838">
  <div style="width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#FF6B4A,#FFC94A);display:flex;align-items:center;justify-content:center">{blip(30,0)}</div>
  <div class="iconbtn" style="width:34px;height:34px">{ic("backltr",18)}</div>
  <div class="col"><span class="h3" style="font-size:15px">Blip's Big Adventure</span><span class="xs muted">Saved · 1280 × 720 · 12 fps</span></div>
  <div style="flex:1"></div>
  <div class="row" style="gap:4px;background:#0F1117;border-radius:12px;padding:4px"><div class="iconbtn" style="width:34px;height:34px;background:none">{ic("undo",18)}</div><div class="iconbtn" style="width:34px;height:34px;background:none;opacity:.4">{ic("redo",18)}</div></div>
  <div class="row" style="gap:4px;background:#0F1117;border-radius:12px;padding:4px 10px 4px 4px"><div class="iconbtn" style="width:34px;height:34px;background:none">{ic("zoom",18)}</div><span class="sm" style="font-family:Inter;font-weight:600">86%</span></div>
  <div class="iconbtn" style="width:42px;height:42px">{ic("grid",18)}</div>
  <div class="btn ghost" style="height:42px;border-radius:12px;font-size:14px">{ic("play",16)}Preview</div>
  <div class="btn primary" style="height:42px;border-radius:12px;font-size:14px">{ic("share",18,"#fff")}Export</div>
</div>
<div class="dock" style="position:absolute;top:84px;left:16px">{tools_d}<div style="height:1px;background:#2A3142;margin:4px 6px"></div><div class="tool"><div class="sw" style="width:26px;height:26px;background:#FF6B4A;box-shadow:0 0 0 2px #fff"></div></div></div>
<div style="position:absolute;top:60px;left:90px;right:320px;height:560px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 50%,#1B2030,#0F1117 70%)">
  {canvas(800,450,2)}
  <div class="row" style="position:absolute;bottom:12px;gap:8px"><span class="chip" style="background:#161A23;box-shadow:inset 0 0 0 1px #2A3142"><span style="width:8px;height:8px;border-radius:50%;background:#FF5A6E"></span>Before 2</span><span class="chip" style="background:#161A23;box-shadow:inset 0 0 0 1px #2A3142"><span style="width:8px;height:8px;border-radius:50%;background:#4A8CFF"></span>After 1</span></div>
</div>
<div style="position:absolute;top:60px;right:0;width:320px;height:560px;background:#161A23;box-shadow:inset 1px 0 0 #232838;padding:18px;display:flex;flex-direction:column;gap:18px">
  <div class="seg"><div class="on">Brush</div><div>Layers</div><div>Scene</div></div>
  <div class="row" style="gap:8px">
    <div class="col" style="flex:1;align-items:center;gap:6px;padding:8px 0;border-radius:12px;background:#FF6B4A14;box-shadow:inset 0 0 0 1.5px #FF6B4A"><svg width="60" height="24" viewBox="0 0 88 40"><path d="M8 30 C 30 8, 50 40, 80 14" stroke="#FF6B4A" stroke-width="7" fill="none" stroke-linecap="round"/></svg><span class="xs" style="color:#FF8A6E;font-weight:600">Brush</span></div>
    <div class="col" style="flex:1;align-items:center;gap:6px;padding:8px 0;border-radius:12px;background:#0F1117;box-shadow:inset 0 0 0 1px #232838"><svg width="60" height="24" viewBox="0 0 88 40"><path d="M8 30 C 30 8, 50 40, 80 14" stroke="#C9CEDA" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg><span class="xs muted">Pencil</span></div>
    <div class="col" style="flex:1;align-items:center;gap:6px;padding:8px 0;border-radius:12px;background:#0F1117;box-shadow:inset 0 0 0 1px #232838"><svg width="60" height="24" viewBox="0 0 88 40"><path d="M8 30 C 30 8, 50 40, 80 14" stroke="#FFC94A" stroke-opacity=".6" stroke-width="12" fill="none"/></svg><span class="xs muted">Marker</span></div>
  </div>
  <div class="col" style="gap:14px">
    <div class="row" style="gap:12px"><span class="sm" style="width:60px">Size</span><div class="slider"><i style="left:0;width:35%"></i><b style="left:calc(35% - 11px)"></b></div><span class="sm" style="width:30px;text-align:right;font-family:Inter">12</span></div>
    <div class="row" style="gap:12px"><span class="sm" style="width:60px">Opacity</span><div class="slider"><i style="left:0;width:90%;background:#4AA8FF"></i><b style="left:calc(90% - 11px)"></b></div><span class="sm" style="width:30px;text-align:right;font-family:Inter">90%</span></div>
    <div class="row" style="gap:12px"><span class="sm" style="width:60px">Smooth</span><div class="slider"><i style="left:0;width:60%;background:#3DDC97"></i><b style="left:calc(60% - 11px)"></b></div><span class="sm" style="width:30px;text-align:right;font-family:Inter">60%</span></div>
  </div>
  <div class="row" style="justify-content:space-between"><span class="label">Colour</span><span class="chip" style="height:26px;font-family:Inter">#FF6B4A</span></div>
  <div style="height:120px;border-radius:14px;background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,#FF6B4A);position:relative"><b style="position:absolute;right:30px;top:24px;width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 3px #fff,0 2px 8px rgba(0,0,0,.5)"></b></div>
  <div style="height:12px;border-radius:6px;background:linear-gradient(to right,#FF5A6E,#FFC94A,#3DDC97,#4AA8FF,#9B5CFF,#FF5A6E);position:relative"><b style="position:absolute;left:12px;top:-4px;width:20px;height:20px;border-radius:50%;background:#FF6B4A;box-shadow:0 0 0 3px #fff"></b></div>
  <div class="row" style="flex-wrap:wrap;gap:9px">{dpal}</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:280px;background:#161A23;box-shadow:inset 0 1px 0 #232838">
  <div class="row" style="height:56px;padding:0 16px;gap:10px;box-shadow:inset 0 -1px 0 #232838">
    <div class="iconbtn" style="width:36px;height:36px">{ic("prev",15)}</div>
    <div style="width:44px;height:44px;border-radius:14px;background:#FF6B4A;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 16px rgba(255,107,74,.45)">{ic("play",20,"#fff")}</div>
    <div class="iconbtn" style="width:36px;height:36px">{ic("next",15)}</div>
    <span class="h3" style="font-family:Inter;margin:0 8px">7 <span class="muted" style="font-weight:500">/ 48</span></span>
    <span class="chip" style="font-family:Inter">12 fps</span><span class="chip on">{ic("repeat",14)}Loop</span><span class="chip on">{ic("onion",14)}Onion skin</span>
    <div style="flex:1"></div>
    <div class="btn ghost" style="height:36px;border-radius:10px;font-size:13px;padding:0 12px">{ic("plus",16)}Frame</div>
    <div class="btn ghost" style="height:36px;border-radius:10px;font-size:13px;padding:0 12px">{ic("copy",16)}Duplicate</div>
    <div class="btn ghost" style="height:36px;border-radius:10px;font-size:13px;padding:0 12px">{ic("layers",16)}Layer</div>
    <div class="btn ghost" style="height:36px;border-radius:10px;font-size:13px;padding:0 12px">{ic("music",16)}Audio</div>
  </div>
  <div class="row" style="height:30px"><div style="width:220px;flex:none;padding:0 14px" class="xs muted">LAYERS</div><div class="row">{cells_hdr}</div></div>
  <div style="position:relative">{tracks}
    <svg style="position:absolute;left:226px;top:132px" width="880" height="38" viewBox="0 0 880 38">{wave}</svg>
    <div style="position:absolute;left:{220+6*44+21}px;top:-30px;width:2px;height:200px;background:#FF6B4A"></div>
    <div style="position:absolute;left:{220+6*44+14}px;top:-34px;width:16px;height:10px;border-radius:3px;background:#FF6B4A"></div>
  </div>
</div>'''

# ---------- 8. Design system board ----------
def swatch(name, hexv, role):
    return (f'<div class="col" style="gap:10px;width:150px"><div style="height:96px;border-radius:18px;background:{hexv};box-shadow:inset 0 0 0 1px #ffffff14"></div>'
            f'<span class="h3" style="font-size:14px">{name}</span><span class="xs muted" style="font-family:Inter">{hexv} · {role}</span></div>')
board = f'''
<div class="row" style="gap:16px;margin-bottom:8px"><div style="width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#FF6B4A,#FFC94A);display:flex;align-items:center;justify-content:center">{blip(48,0)}</div>
<div class="col"><span class="h1" style="font-size:40px">Doodleflip Design System</span><span class="muted">Warm, playful, focused on the canvas · v1.0</span></div></div>
<div class="label" style="margin:48px 0 18px">Colour</div>
<div class="row" style="gap:20px;flex-wrap:wrap">
 {swatch("Coral 500","#FF6B4A","Primary / action")}{swatch("Sun 400","#FFC94A","Accent / highlight")}{swatch("Mint 400","#3DDC97","Success / on")}{swatch("Sky 400","#4AA8FF","Info / audio")}{swatch("Onion Before","#FF5A6E","Previous frames")}{swatch("Onion After","#4A8CFF","Next frames")}{swatch("Paper","#FFF8EE","Canvas")}
</div>
<div class="row" style="gap:20px;flex-wrap:wrap;margin-top:24px">
 {swatch("Ink 950","#0F1117","App background")}{swatch("Ink 900","#161A23","Surface / sheet")}{swatch("Ink 800","#1E2330","Control")}{swatch("Ink 700","#2A3142","Track / divider")}{swatch("Text","#F4F5F7","Primary text")}{swatch("Muted","#8E96A8","Secondary text")}
</div>
<div class="label" style="margin:56px 0 18px">Typography · Inter + IBM Plex Sans Arabic</div>
<div class="row" style="gap:60px;align-items:flex-start">
 <div class="col" style="gap:18px">
  <div class="row" style="gap:20px;align-items:baseline"><span class="xs muted" style="width:90px">Display 40/48</span><span style="font-size:40px;font-weight:700">Make it move</span></div>
  <div class="row" style="gap:20px;align-items:baseline"><span class="xs muted" style="width:90px">Title 28/34</span><span class="h1">Frame by frame</span></div>
  <div class="row" style="gap:20px;align-items:baseline"><span class="xs muted" style="width:90px">Heading 20/26</span><span class="h2">Export animation</span></div>
  <div class="row" style="gap:20px;align-items:baseline"><span class="xs muted" style="width:90px">Body 15/22</span><span style="font-size:15px">Draw, add frames and watch it play.</span></div>
  <div class="row" style="gap:20px;align-items:baseline"><span class="xs muted" style="width:90px">Caption 12/16</span><span class="xs muted" style="font-size:12px">48 frames · 12 fps · 4.0s</span></div>
 </div>
 <div class="col" dir="rtl" style="gap:18px">
  <span style="font-size:40px;font-weight:700">حرّكها</span><span class="h1">إطاراً بإطار</span><span class="h2">تصدير الرسوم</span><span style="font-size:15px">ارسم، أضف إطارات وشاهدها تتحرك.</span><span class="xs muted" style="font-size:12px">٤٨ إطار • ١٢ إطار/ث</span>
 </div>
</div>
<div class="label" style="margin:56px 0 18px">Components</div>
<div class="row" style="gap:40px;align-items:flex-start;flex-wrap:wrap">
 <div class="col" style="gap:12px"><span class="xs muted">Buttons</span>
  <div class="btn primary">{ic("share",18,"#fff")}Export</div><div class="btn ghost">{ic("plus",18)}New frame</div><div class="btn primary" style="opacity:.4;box-shadow:none">Disabled</div></div>
 <div class="col" style="gap:12px"><span class="xs muted">Chips</span><div class="row" style="gap:8px"><span class="chip on">{ic("onion",14)}Onion skin</span><span class="chip">12 fps</span></div>
  <span class="xs muted" style="margin-top:12px">Toggle</span><div class="row" style="gap:12px"><div class="toggle on"><b style="right:3px"></b></div><div class="toggle"><b style="left:3px"></b></div></div>
  <span class="xs muted" style="margin-top:12px">Segmented</span><div class="seg" style="width:260px"><div>Low</div><div class="on">Medium</div><div>High</div></div></div>
 <div class="col" style="gap:12px"><span class="xs muted">Tool dock</span><div class="dock" style="flex-direction:row">{tools_d[:0]}<div class="tool on">{ic("brush",21)}</div><div class="tool">{ic("pencil",21)}</div><div class="tool">{ic("eraser",21)}</div><div class="tool">{ic("fill",21)}</div><div class="tool">{ic("shapes",21)}</div></div>
  <span class="xs muted" style="margin-top:12px">Slider</span><div class="row" style="width:260px"><div class="slider"><i style="left:0;width:40%"></i><b style="left:calc(40% - 11px)"></b></div></div>
  <span class="xs muted" style="margin-top:12px">Swatches</span><div class="row" style="gap:10px"><div class="sw on" style="background:#FF6B4A"></div><div class="sw" style="background:#FFC94A"></div><div class="sw" style="background:#3DDC97"></div><div class="sw" style="background:#4AA8FF"></div></div></div>
 <div class="col" style="gap:12px"><span class="xs muted">Frame cell · default / current / add</span><div class="row" style="gap:10px">
  <div class="frame" style="width:72px;height:50px">{thumb(72,50,1)}<span class="fnum" style="left:4px">2</span></div>
  <div class="frame on" style="width:72px;height:50px">{thumb(72,50,2)}<span class="fnum" style="left:4px">3</span></div>
  <div class="frame" style="width:50px;height:50px;border-radius:10px;background:#1E2330;box-shadow:inset 0 0 0 1.5px #3A4256;display:flex;align-items:center;justify-content:center;color:#C9CEDA">{ic("plus",20)}</div></div>
  <span class="xs muted" style="margin-top:12px">Mascot · Blip (squash &amp; stretch cycle)</span><div class="row" style="gap:4px;background:#FFF8EE;border-radius:16px;padding:8px">{"".join(blip(64,i) for i in range(6))}</div></div>
</div>
<div class="label" style="margin:56px 0 18px">Spacing &amp; radius</div>
<div class="row" style="gap:16px;align-items:flex-end">{"".join(f'<div class="col" style="align-items:center;gap:8px"><div style="width:{s}px;height:{s}px;background:#FF6B4A;border-radius:4px;opacity:.85"></div><span class="xs muted" style="font-family:Inter">{s}</span></div>' for s in [4,8,12,16,20,24,32,48])}
<div style="width:60px"></div>{"".join(f'<div class="col" style="align-items:center;gap:8px"><div style="width:64px;height:64px;background:#1E2330;box-shadow:inset 0 0 0 1.5px #3A4256;border-radius:{r}px"></div><span class="xs muted" style="font-family:Inter">r{r}</span></div>' for r in [8,12,14,18,26])}</div>
'''

html = (f'<!doctype html><html><head><meta charset="utf-8"><title>Doodleflip UI</title><style>{CSS}</style></head><body>'
        + phone("01 · Home", home)
        + phone("02 · Editor", editor)
        + phone("03 · Brush & colour", sheet_brush)
        + phone("04 · Layers", sheet_layers)
        + phone("05 · Export", sheet_export)
        + phone("06 · New project", sheet_new)
        + f'<div class="screen desk" data-name="07 · Desktop editor">{desk}</div>'
        + f'<div class="screen board" data-name="08 · Design system">{board}</div>'
        + '</body></html>')
pathlib.Path(__file__).with_name("doodleflip-ui.html").write_text(html, encoding="utf-8")
print(len(html))
