"""Fake Ollama server to test the app without a GPU (streamed NDJSON answers)."""
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODELS = [{"name": "gemma3:12b", "size": 8100000000}]
LOG = []

class H(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path == "/api/version": return self._json({"version": "0.12-mock"})
        if self.path == "/api/tags": return self._json({"models": MODELS})
        if self.path == "/_log": return self._json(LOG)
        self._json({"error": "not found"}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        LOG.append({"path": self.path, "body": body, "origin": self.headers.get("Origin")})
        self.send_response(200); self.send_header("Content-Type", "application/x-ndjson"); self.end_headers()
        if self.path == "/api/chat":
            ctx = [m["content"] for m in body["messages"] if m["role"] == "system"]
            has_q = any("Question affichée" in c for c in ctx)
            user = body["messages"][-1]["content"]
            text = (f"**Coco (test)** : j'ai bien reçu « {user} ».\n\n"
                    f"- Contexte de question : {'oui' if has_q else 'non'}\n- Modèle : {body['model']}\n\n"
                    "Le mot « laïcité » se dit *laiklik* en turc.")
            for i in range(0, len(text), 6):
                self.wfile.write((json.dumps({"message": {"role": "assistant", "content": text[i:i+6]}, "done": False}) + "\n").encode()); self.wfile.flush(); time.sleep(0.01)
            self.wfile.write((json.dumps({"message": {"role": "assistant", "content": ""}, "done": True}) + "\n").encode())
        elif self.path == "/api/pull":
            total = 1000
            for c in range(0, total + 1, 100):
                self.wfile.write((json.dumps({"status": "pulling manifest" if c == 0 else "downloading", "total": total, "completed": c}) + "\n").encode()); self.wfile.flush(); time.sleep(0.05)
            MODELS.append({"name": body.get("model"), "size": 1})
            self.wfile.write((json.dumps({"status": "success"}) + "\n").encode())

    def log_message(self, *a): pass

ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 11435), H).serve_forever()
