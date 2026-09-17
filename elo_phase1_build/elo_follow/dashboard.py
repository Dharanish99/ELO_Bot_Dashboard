from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


HTML = r'''<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ELO Follow Control</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:16px}button{padding:10px 14px;margin:4px;border:0;border-radius:8px;cursor:pointer}.on{background:#41c778}.off{background:#e85b5b;color:#fff}.card{background:#1c1c1c;border-radius:12px;padding:12px;margin:10px 0}.row{display:flex;gap:8px;flex-wrap:wrap}.track{border:1px solid #444;border-radius:10px;padding:10px;min-width:160px}.selected{border-color:#41c778}.mono{font-family:monospace}.small{opacity:.75;font-size:.9em}img{max-width:100%;border-radius:10px;background:#222}</style></head>
<body><h1>ELO Phase 1</h1>
<div class="card"><div class="row"><button id="move">MOVING</button><button id="stop">INTERACTING / STOP</button><button id="follow">FOLLOW</button></div><div id="status" class="mono small"></div></div>
<div class="card"><h3>Camera / Targets</h3><img id="preview" src="/preview.jpg"><div id="tracks" class="row"></div></div>
<div class="card"><h3>Obstacle Sensors</h3><div id="obs" class="mono"></div><div id="cmd" class="mono"></div></div>
<script>
let selected=null;
async function post(path, body={}){await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
function btn(text, fn, cls=''){let b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b;}
async function refresh(){let r=await fetch('/api/state');let s=await r.json();
 document.getElementById('status').textContent=`moving=${s.moving} follow=${s.follow_enabled} selected=${s.selected_id??'-'} vision=${s.vision_fps.toFixed(1)}fps tflite=${s.tflite_ms.toFixed(1)}ms reason=${s.reason}`;
 document.getElementById('obs').textContent=JSON.stringify(s.obstacles);
 document.getElementById('cmd').textContent=`L/R=${s.command[0].toFixed(1)} / ${s.command[1].toFixed(1)} | search=${s.search_active} avoid=${s.avoid_active}`;
 let box=document.getElementById('tracks');box.innerHTML='';
 for(let t of s.tracks){let d=document.createElement('div');d.className='track'+(t.id===s.selected_id?' selected':'');d.appendChild(document.createTextNode(`Person ${t.id}  score=${t.score.toFixed(2)}`));d.appendChild(document.createElement('br'));d.appendChild(document.createTextNode(`hits=${t.hits} misses=${t.misses} side=${t.last_side}`));d.appendChild(document.createElement('br'));d.appendChild(btn(t.id===s.selected_id?'Selected':'Select',async()=>{selected=t.id;await post('/api/select',{id:t.id});}));box.appendChild(d);}
 document.getElementById('follow').textContent=s.follow_enabled?'FOLLOW ON':'FOLLOW OFF';document.getElementById('follow').className=s.follow_enabled?'on':'off';
}
document.getElementById('move').onclick=()=>post('/api/state',{moving:true});document.getElementById('stop').onclick=()=>post('/api/state',{moving:false});document.getElementById('follow').onclick=async()=>{let s=await (await fetch('/api/state')).json();await post('/api/follow',{enabled:!s.follow_enabled});};
setInterval(()=>{document.getElementById('preview').src='/preview.jpg?t='+Date.now();refresh().catch(()=>{});},500);refresh();
</script></body></html>'''


class Dashboard:
    def __init__(self, cfg, state):
        self.cfg = cfg
        self.state = state
        self.server = None
        self.thread = None

    def _handler(self):
        parent = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                return
            def _json(self, data, code=200):
                payload=json.dumps(data).encode()
                self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
            def do_GET(self):
                p=urlparse(self.path).path
                if p=='/':
                    data=HTML.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
                if p=='/api/state': self._json(parent.state.snapshot());return
                if p=='/preview.jpg':
                    with parent.state.lock: img=parent.state.preview_jpeg
                    if not img: self.send_error(503);return
                    self.send_response(200);self.send_header('Content-Type','image/jpeg');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(img)));self.end_headers();self.wfile.write(img);return
                self.send_error(404)
            def do_POST(self):
                p=urlparse(self.path).path
                n=int(self.headers.get('Content-Length','0'));body=self.rfile.read(n) if n else b'{}'
                try: data=json.loads(body or b'{}')
                except Exception: data={}
                if p=='/api/state':
                    with parent.state.lock:
                        parent.state.moving=bool(data.get('moving',parent.state.moving))
                        if not parent.state.moving:
                            parent.state.reason='interacting/stop'
                    self._json({'ok':True});return
                if p=='/api/follow':
                    with parent.state.lock: parent.state.follow_enabled=bool(data.get('enabled',False))
                    self._json({'ok':True});return
                if p=='/api/select':
                    try: tid=int(data['id'])
                    except Exception: self._json({'ok':False},400);return
                    with parent.state.lock:
                        valid=any(t['id']==tid for t in parent.state.tracks)
                        if valid:
                            parent.state.requested_selected_id=tid
                            parent.state.selected_id=tid
                            parent.state.target_last_seen=__import__('time').monotonic()
                            target=next(t for t in parent.state.tracks if t['id']==tid)
                            parent.state.target_last_side=target.get('last_side','center')
                            parent.state.reason='target-selected'
                    self._json({'ok':valid});return
                self.send_error(404)
        return Handler

    def start(self):
        self.server=ThreadingHTTPServer((self.cfg.dashboard_host,self.cfg.dashboard_port),self._handler())
        self.thread=threading.Thread(target=self.server.serve_forever,name='dashboard',daemon=True);self.thread.start()

    def stop(self):
        if self.server: self.server.shutdown()
